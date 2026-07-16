"""SANA AI Service — FastAPI giriş noktası (Sprint 2).

Uçlar:
  GET  /health
  POST /embed        {text, input_type} → embedding
  POST /plan-route   {text} → deterministik pipeline (intent→hava→hafıza→bütçe→flood)

İş mantığı stdlib `app.clients` + `app.pipeline` içinde; FastAPI yalnızca ince
HTTP/CORS taşıma katmanıdır (mobil app buraya konuşur).
"""
from __future__ import annotations

from fastapi import FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.clients import (app_key_ok, google_autocomplete_city, google_nav_leg,
                         google_place_latlng, google_reverse_geocode_place, google_search_city,
                         google_snap_to_roads, google_static_map, google_walk_leg, load_env,
                         nvidia_embed, sb_select, verify_supabase_token)
from app.pipeline import _TR_PROVINCES, norm_city
from app.pipeline import embed_route as run_embed_route
from app.pipeline import enrich_photos as run_enrich_photos
from app.pipeline import enrich_route as run_enrich_route
from app.pipeline import plan_route as run_pipeline
from app.pipeline import route_geometry as run_route_geometry
from app.pipeline import save_memory_event, save_onboarding_memory, summarize_comments
from app.pipeline import search_places as run_search_places

app = FastAPI(title="SANA AI Service", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


class EmbedRequest(BaseModel):
    text: str = Field(..., min_length=1)
    input_type: str = Field("passage", pattern="^(query|passage)$")


class PlanRouteRequest(BaseModel):
    text: str = Field(..., min_length=1, examples=["Bugün İstanbul'da yalnızım, kafa dinlemek istiyorum, bütçem az"])
    user_id: str | None = None  # verilirse plan kullanıcının hafızasıyla kişiselleştirilir
    force_weather_fit: str | None = Field(None, pattern="^(indoor|outdoor|any)$")  # ☔ kapalı alternatif
    force_generate: bool = False  # 🎲 AI Rota Üretici (2.7): havuzdan değil, yepyeni rota kur
    # 🎲 üretim merkezi (2.7b): kullanıcı konumu YA DA semt adı; ikisi de yoksa AI semt seçer
    gen_lat: float | None = None
    gen_lng: float | None = None
    gen_district: str | None = None
    # 3.0c: app'in aktif şehri (cümlede açıkça başka şehir geçmiyorsa bu kullanılır)
    city: str | None = None
    # 4.x: üretilen anlatının dili + rotanın havuz etiketi (EN modda İngilizce yaz)
    lang: str = Field("tr", pattern="^(tr|en)$")


class OnboardingMemoryRequest(BaseModel):
    user_id: str = Field(..., min_length=10)
    vibes: list[str] = []
    budget: int = Field(2, ge=1, le=3)


class WalkRouteRequest(BaseModel):
    from_lat: float
    from_lng: float
    to_lat: float
    to_lng: float
    lang: str = Field("tr", pattern="^(tr|en)$")  # 4.x: yön talimatları dili


class NavRouteRequest(WalkRouteRequest):
    mode: str = Field("walk", pattern="^(walk|transit|drive)$")  # 4.0 mod seçici


class MemoryEventRequest(BaseModel):
    user_id: str = Field(..., min_length=10)
    kind: str = Field(..., pattern="^(favorite|journey|comment)$")
    route_id: str = Field(..., min_length=10)


class EnrichStop(BaseModel):
    name: str
    note: str | None = None
    lat: float
    lng: float


class EnrichRequest(BaseModel):
    stops: list[EnrichStop] = Field(..., min_length=2)
    lang: str = Field("tr", pattern="^(tr|en)$")  # 4.x: anlatı dili (EN modda İngilizce)


class EmbedRouteRequest(BaseModel):
    route_id: str


class SearchRequest(BaseModel):
    q: str = Field(..., min_length=1)
    city: str | None = None  # 3.0c: arama aktif şehir merkezine bias'lanır


class TrackPoint(BaseModel):
    lat: float
    lng: float


class SnapTrackRequest(BaseModel):
    points: list[TrackPoint] = Field(..., min_length=2)


class DetectCityRequest(BaseModel):
    lat: float
    lng: float
    lang: str = Field("tr", pattern="^(tr|en)$")  # 4.x: şehir adı app diliyle tutarlı (Munich/Münih)


class CitySearchRequest(BaseModel):
    q: str = Field(..., min_length=2)
    lang: str = Field("tr", pattern="^(tr|en)$")  # 4.x: sonuç adları app diline uysun


class CityLatLngRequest(BaseModel):
    place_id: str | None = None
    name: str | None = None


# ---- Kimlik yardımcıları (güvenlik review #1) ----
def _uid_or_401(authorization: str | None) -> str:
    """Geçerli Supabase oturumu şart olan uçlar için: token → uid, yoksa 401."""
    uid = verify_supabase_token(load_env(), authorization)
    if not uid:
        raise HTTPException(status_code=401, detail="Giriş doğrulanamadı")
    return uid


def _guard_app_key(x_app_key: str | None, k: str | None = None) -> None:
    """Anonim (oturumsuz) maliyet uçları için bot kalkanı (#3a): app-key header'ı
    ya da ?k= sorgu parametresi. SANA_APP_SECRET tanımlı değilse serbest."""
    if not app_key_ok(load_env(), x_app_key or k):
        raise HTTPException(status_code=403, detail="Geçersiz istek")


def _can_touch_route(env: dict, uid: str, route_id: str) -> bool:
    """Rota mutasyonu izni: sahibi ya da collaborator (geometri/foto vandalizmi kapanır)."""
    rows = sb_select(env, "routes", f"select=author_id&id=eq.{route_id}") or []
    if not rows:
        return False
    if rows[0].get("author_id") == uid:
        return True
    c = sb_select(env, "route_collaborators",
                  f"select=user_id&route_id=eq.{route_id}&user_id=eq.{uid}") or []
    return bool(c)


@app.get("/health")
def health() -> dict:
    env = load_env()
    return {"status": "ok", "provider": env.get("LLM_PROVIDER", "nvidia")}


@app.post("/embed")
def embed(req: EmbedRequest) -> dict:
    try:
        vec = nvidia_embed(load_env(), req.text, input_type=req.input_type)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Embedding hatası: {e}") from e
    return {"dim": len(vec), "embedding": vec}


@app.post("/plan-route")
def plan_route(req: PlanRouteRequest, authorization: str | None = Header(None),
               x_app_key: str | None = Header(None)) -> dict:
    """Deterministik AI pipeline: niyet (+kullanıcı hafızası) → rota → AI flood anlatısı.
    user_id gövdeden DEĞİL token'dan alınır — başkasının profiliyle plan çekilemez;
    token yoksa plan anonim çalışır (kişiselleştirmesiz, üretim yazarı seed)."""
    uid = verify_supabase_token(load_env(), authorization)
    if uid is None:  # oturumsuz plan yine mümkün ama bot kalkanından geçmeli (#3a)
        _guard_app_key(x_app_key)
    try:
        gen_center = (req.gen_lat, req.gen_lng) if req.gen_lat is not None and req.gen_lng is not None else None
        return run_pipeline(req.text, uid, req.force_weather_fit, req.force_generate,
                            gen_center, req.gen_district, req.city, req.lang)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Pipeline hatası: {e}") from e


@app.post("/memory/onboarding")
def memory_onboarding(req: OnboardingMemoryRequest, authorization: str | None = Header(None)) -> dict:
    """Onboarding tercihlerini kullanıcı profili olarak AI hafızasına yazar.
    Kimlik TOKEN'dan — gövdedeki user_id yok sayılır (başkasının hafızası ezilemez)."""
    uid = _uid_or_401(authorization)
    try:
        return save_onboarding_memory(uid, req.vibes, req.budget)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Hafıza hatası: {e}") from e


@app.post("/memory/event")
def memory_event(req: MemoryEventRequest, authorization: str | None = Header(None)) -> dict:
    """Davranış hafızası (2.2): favori/yolculuk/yorum → preference_update embed'i.
    Kimlik TOKEN'dan — gövdedeki user_id yok sayılır."""
    uid = _uid_or_401(authorization)
    try:
        return save_memory_event(uid, req.kind, req.route_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Hafıza hatası: {e}") from e


@app.post("/summarize-comments")
def summarize(req: EmbedRouteRequest) -> dict:
    """Topluluk yorum özeti (2.4): ≥3 yorumu 2 cümle + 3 etikete indirger (1 saat cache)."""
    try:
        return summarize_comments(req.route_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Özet hatası: {e}") from e


@app.post("/enrich-route")
def enrich_route(req: EnrichRequest) -> dict:
    """Kullanıcının eklediği duraklar → AI başlık/etiket/kategori/anlatı."""
    try:
        return run_enrich_route([s.model_dump() for s in req.stops], req.lang)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Enrich hatası: {e}") from e


@app.post("/embed-route")
def embed_route(req: EmbedRouteRequest, authorization: str | None = Header(None)) -> dict:
    """Kaydedilen rotayı hafızaya embedler (başkalarının AI aramasında çıksın).
    Oturum şart (anonim embed spam'i kapanır)."""
    _uid_or_401(authorization)
    try:
        return run_embed_route(req.route_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Embed hatası: {e}") from e


@app.post("/walk-route")
def walk_route(req: WalkRouteRequest, x_app_key: str | None = Header(None)) -> dict:
    """Canlı navigasyon: kullanıcı konumu → hedef durak yürüme rotası (journey modu)."""
    _guard_app_key(x_app_key)
    leg = google_walk_leg(load_env(), req.from_lat, req.from_lng, req.to_lat, req.to_lng, req.lang)
    return {"ok": bool(leg), **(leg or {})}


@app.post("/nav-route")
def nav_route(req: NavRouteRequest, x_app_key: str | None = Header(None)) -> dict:
    """Çok modlu canlı navigasyon (4.0): 🚶 walk / 🚌 transit (+hat bilgisi) / 🚗 drive."""
    _guard_app_key(x_app_key)
    leg = google_nav_leg(load_env(), req.from_lat, req.from_lng, req.to_lat, req.to_lng, req.mode, req.lang)
    return {"ok": bool(leg), **(leg or {})}


@app.post("/enrich-photos")
def enrich_photos(req: EmbedRouteRequest, authorization: str | None = Header(None)) -> dict:
    """Fotosuz duraklara Places foto+puan yazar (3.2a) — rota yazımı sonrası fire-and-forget.
    Yalnız rotanın sahibi/collaborator'ı tetikleyebilir."""
    uid = _uid_or_401(authorization)
    if not _can_touch_route(load_env(), uid, req.route_id):
        raise HTTPException(status_code=403, detail="Bu rota üzerinde yetkin yok")
    try:
        return run_enrich_photos(req.route_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Foto hatası: {e}") from e


@app.post("/route-geometry")
def route_geometry(req: EmbedRouteRequest, authorization: str | None = Header(None)) -> dict:
    """Rotanın yürüme bacaklarına gerçek sokak geometrisi yazar (Google Routes).
    Yalnız rotanın sahibi/collaborator'ı tetikleyebilir."""
    uid = _uid_or_401(authorization)
    if not _can_touch_route(load_env(), uid, req.route_id):
        raise HTTPException(status_code=403, detail="Bu rota üzerinde yetkin yok")
    try:
        return run_route_geometry(req.route_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Geometri hatası: {e}") from e


@app.post("/search-place")
def search_place(req: SearchRequest, x_app_key: str | None = Header(None)) -> dict:
    """Mekan araması — Google Places (New), aktif şehre bias'lı (SerpApi yedek)."""
    _guard_app_key(x_app_key)
    return {"results": run_search_places(req.q, req.city)}


@app.post("/snap-track")
def snap_track(req: SnapTrackRequest, x_app_key: str | None = Header(None)) -> dict:
    """Yürünen GPS izini yola oturtur (4.0c Roads). Hatada ok:false → app ham izi kullanır."""
    _guard_app_key(x_app_key)
    snapped = google_snap_to_roads(load_env(), [p.model_dump() for p in req.points])
    return {"ok": len(snapped) >= 2, "points": snapped}


@app.get("/static-map")
def static_map(path: str, w: int = 608, h: int = 300, line: str = "coral",
               k: str | None = None) -> Response:
    """Rota izli koyu harita PNG'si (4.0c Static Maps) — paylaşım kartı arka planı.
    path: "lat,lng|lat,lng|..." (≤100 nokta). Anahtar sunucuda kalır; görsel proxy'lenir.
    Image kaynağı header taşıyamadığı için app-key ?k= ile gelir (#3a)."""
    _guard_app_key(None, k)
    try:
        pts = [{"lat": float(a), "lng": float(b)}
               for a, b in (p.split(",", 1) for p in path.split("|") if p)][:100]
    except ValueError as e:
        raise HTTPException(status_code=422, detail="path biçimi: lat,lng|lat,lng") from e
    img = google_static_map(load_env(), pts, w, h, line)
    if not img:
        raise HTTPException(status_code=502, detail="static map üretilemedi (API kapalı olabilir)")
    return Response(content=img, media_type="image/png",
                    headers={"Cache-Control": "public, max-age=86400"})


@app.post("/detect-city")
def detect_city(req: DetectCityRequest, x_app_key: str | None = Header(None)) -> dict:
    """Konumdan şehir algılama (Geocoding, TÜM DÜNYA): TR'de il → kanonik ad
    (Datça→Mugla); yurtdışında şehir adı aynen (Berlin). Çözülemezse city:null."""
    _guard_app_key(x_app_key)
    place = google_reverse_geocode_place(load_env(), req.lat, req.lng, req.lang)
    if not place:
        return {"ok": False, "province": None, "city": None, "country": None}
    if place.get("country_code") == "TR":
        city = norm_city(place["name"])
        if city not in _TR_PROVINCES:
            city = None
    else:
        city = norm_city(place["name"])  # dünya: ASCII kanonik (Münih→Munih) — app'le aynı
    return {"ok": True, "province": place["name"], "city": city,
            "country": place.get("country_code")}


@app.post("/search-city")
def search_city(req: CitySearchRequest, x_app_key: str | None = Header(None)) -> dict:
    """DÜNYA şehir OTOMATİK-TAMAMLAMA (Places Autocomplete) — yazdıkça ön-ek eşleştirmeli
    çoklu şehir önerisi ('berl'→Berlin/Bern). Koordinat seçimde /city-latlng ile çözülür.
    Autocomplete boş dönerse Geocoding'e düşer (tam ad yazıldıysa yine bulur)."""
    _guard_app_key(x_app_key)
    env = load_env()
    hits = google_autocomplete_city(env, req.q, lang=req.lang)
    if not hits:  # yedek: tam ad girildiyse Geocoding koordinatla döner
        hits = google_search_city(env, req.q, lang=req.lang)
    return {"results": hits}


@app.post("/city-latlng")
def city_latlng(req: CityLatLngRequest, x_app_key: str | None = Header(None)) -> dict:
    """Seçilen şehrin koordinatı: önce placeId (Place Details), yoksa/olmazsa ada göre
    Geocoding. Şehir seçici, autocomplete sonucuna dokununca çağırır."""
    _guard_app_key(x_app_key)
    env = load_env()
    loc = google_place_latlng(env, req.place_id) if req.place_id else None
    if not loc and req.name:
        from app.clients import city_coords
        lat, lng = city_coords(env, req.name)
        loc = {"lat": lat, "lng": lng}
    if not loc:
        raise HTTPException(status_code=404, detail="Konum çözülemedi")
    return {"ok": True, **loc}
