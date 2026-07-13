"""Stdlib HTTP istemcileri — NVIDIA (chat+embed), Supabase REST, OpenWeather.
pip GEREKMEZ; `py` ile çalışır. FastAPI katmanı bunları kullanır.
"""
from __future__ import annotations

import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# Windows konsolunda Türkçe/emoji için UTF-8
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # ai-service/
_SSL = ssl.create_default_context()


def load_env(path: str | None = None) -> dict:
    path = path or os.path.join(ROOT, ".env")
    env: dict[str, str] = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    for k in list(env):
        if os.environ.get(k):
            env[k] = os.environ[k]
    # .env dosyası olmayan ortamlar (Render vb.): ilgili değişkenleri os.environ'dan tamamla
    _PREFIXES = ("SUPABASE_", "NVIDIA_", "GOOGLE_", "GEMINI_", "OPENWEATHER", "LLM_", "EMBED_")
    for k, v in os.environ.items():
        if k not in env and k.startswith(_PREFIXES):
            env[k] = v
    return env


def _req(url: str, method: str = "GET", headers: dict | None = None, body=None, timeout: int = 90):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_SSL) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} {method} {url}\n{e.read().decode('utf-8', 'ignore')}") from e


# --------------------------- NVIDIA ---------------------------
def nvidia_chat(env: dict, system: str, user: str, json_mode: bool = False,
                temperature: float = 0.5, max_tokens: int | None = None,
                retries: int = 1, timeout: int = 45) -> str:
    """NVIDIA chat — anlık yoğunluk/timeout'a karşı otomatik tekrar dener."""
    url = env["NVIDIA_BASE_URL"].rstrip("/") + "/chat/completions"
    body: dict = {
        "model": env.get("NVIDIA_CHAT_MODEL", "meta/llama-3.3-70b-instruct"),
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": temperature,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    if max_tokens:
        body["max_tokens"] = max_tokens
    headers = {"Authorization": f"Bearer {env['NVIDIA_API_KEY']}", "Content-Type": "application/json"}

    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            r = _req(url, "POST", headers, body, timeout=timeout)
            return r["choices"][0]["message"]["content"] or ""
        except Exception as e:  # noqa: BLE001 — timeout/5xx → tekrar dene
            last_err = e
            if attempt < retries:
                time.sleep(1.5)
    raise RuntimeError(f"NVIDIA chat başarısız ({retries + 1} deneme): {last_err}")


def nvidia_embed(env: dict, text: str, input_type: str = "query", retries: int = 2, timeout: int = 30) -> list[float]:
    url = env["NVIDIA_BASE_URL"].rstrip("/") + "/embeddings"
    body = {"input": [text], "model": env.get("NVIDIA_EMBED_MODEL", "nvidia/nv-embedqa-e5-v5"),
            "input_type": input_type, "truncate": "END"}
    headers = {"Authorization": f"Bearer {env['NVIDIA_API_KEY']}", "Content-Type": "application/json"}
    last_err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            r = _req(url, "POST", headers, body, timeout=timeout)
            return r["data"][0]["embedding"]
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt < retries:
                time.sleep(1.0)
    raise RuntimeError(f"NVIDIA embed başarısız: {last_err}")


# --------------------------- Supabase REST ---------------------------
def _sb_headers(env: dict) -> dict:
    k = env["SUPABASE_SERVICE_ROLE_KEY"]
    return {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json"}


def match_routes(env: dict, query_embedding, match_count=5, filter_city=None, max_budget=4):
    url = env["SUPABASE_URL"].rstrip("/") + "/rest/v1/rpc/match_routes"
    body = {"query_embedding": query_embedding, "match_count": match_count,
            "filter_city": filter_city, "max_budget": max_budget}
    return _req(url, "POST", _sb_headers(env), body) or []


def get_route(env: dict, route_id: str):
    url = env["SUPABASE_URL"].rstrip("/") + f"/rest/v1/routes?select=*,waypoints(*)&id=eq.{route_id}"
    rows = _req(url, "GET", _sb_headers(env))
    return rows[0] if rows else None


def sb_insert(env: dict, table: str, rows):
    """service_role ile tabloya satır ekler (RLS bypass)."""
    url = env["SUPABASE_URL"].rstrip("/") + f"/rest/v1/{table}"
    headers = _sb_headers(env)
    headers["Prefer"] = "return=representation"
    return _req(url, "POST", headers, rows)


def sb_patch(env: dict, table: str, filters: dict, patch: dict):
    """service_role ile satır günceller. filters: {"id": "eq.<uuid>"} biçiminde."""
    q = urllib.parse.urlencode(filters)
    url = env["SUPABASE_URL"].rstrip("/") + f"/rest/v1/{table}?{q}"
    headers = _sb_headers(env)
    headers["Prefer"] = "return=minimal"
    return _req(url, "PATCH", headers, patch)


def sb_select(env: dict, table: str, query: str):
    """service_role ile serbest sorgu (PostgREST query string)."""
    url = env["SUPABASE_URL"].rstrip("/") + f"/rest/v1/{table}?{query}"
    return _req(url, "GET", _sb_headers(env)) or []


def sb_delete(env: dict, table: str, filters: dict):
    """service_role ile satır siler. filters: {"owner_id": "eq.<uuid>"} biçiminde."""
    q = urllib.parse.urlencode(filters)
    url = env["SUPABASE_URL"].rstrip("/") + f"/rest/v1/{table}?{q}"
    headers = _sb_headers(env)
    headers["Prefer"] = "return=minimal"
    return _req(url, "DELETE", headers)


# --------------------------- Google Routes API ---------------------------
def _google_server_key(env: dict) -> str | None:
    # Tek sunucu anahtarı (sana-server: Weather + Routes + Places) — eski değişken adı yedek
    return env.get("GOOGLE_SERVER_API_KEY") or env.get("GOOGLE_WEATHER_API_KEY") or None


def decode_polyline(encoded: str, precision: int = 5) -> list[dict]:
    """Google encoded polyline → [{lat, lng}, ...] (stdlib, harici paket yok)."""
    coords: list[dict] = []
    index = lat = lng = 0
    factor = 10 ** precision
    while index < len(encoded):
        for is_lng in (False, True):
            shift = result = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            delta = ~(result >> 1) if (result & 1) else (result >> 1)
            if is_lng:
                lng += delta
            else:
                lat += delta
        coords.append({"lat": lat / factor, "lng": lng / factor})
    return coords


_TRAVEL_MODES = {"walk": "WALK", "transit": "TRANSIT", "drive": "DRIVE"}


def google_nav_leg(env: dict, a_lat: float, a_lng: float, b_lat: float, b_lng: float,
                   mode: str = "walk"):
    """İki nokta arası rota, seçilen ULAŞIM MODUNDA (4.0: 🚶🚌🚗) — geometri +
    gerçek mesafe/süre; TRANSIT'te ilk hat bilgisi (hat adı, biniş durağı, yön).
    Anahtar yoksa/hata olursa None (çağıran kuş uçuşuna düşer)."""
    key = _google_server_key(env)
    if not key:
        return None
    travel = _TRAVEL_MODES.get(mode, "WALK")
    body = {
        "origin": {"location": {"latLng": {"latitude": a_lat, "longitude": a_lng}}},
        "destination": {"location": {"latLng": {"latitude": b_lat, "longitude": b_lng}}},
        "travelMode": travel,
    }
    mask = "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline"
    if travel == "TRANSIT":
        # GMaps paritesi (4.0b): alternatifler + adım talimatları + ADIM GEOMETRİSİ
        # (haritada yürüme=noktalı, transit=hat renginde çizim için)
        body["computeAlternativeRoutes"] = True
        mask += (",routes.legs.steps.transitDetails,routes.legs.steps.navigationInstruction"
                 ",routes.legs.steps.distanceMeters,routes.legs.steps.travelMode"
                 ",routes.legs.steps.polyline.encodedPolyline")
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": mask,
    }
    try:
        r = _req("https://routes.googleapis.com/directions/v2:computeRoutes", "POST", headers, body, timeout=30)
    except Exception:
        return None
    routes = (r or {}).get("routes") or []
    if not routes:
        return None

    if travel != "TRANSIT":
        return _nav_route_payload(routes[0])

    # TRANSIT: en fazla 3 alternatif — her biri kendi geometrisi, adımları ve hat özetiyle
    alts = [_nav_route_payload(rt, with_steps=True) for rt in routes[:3]]
    primary = dict(alts[0])
    primary["alternatives"] = alts
    return primary


_VEHICLE_EMOJI = {
    "SUBWAY": "🚇", "METRO_RAIL": "🚇",
    "TRAM": "🚊", "LIGHT_RAIL": "🚊",
    "HEAVY_RAIL": "🚆", "COMMUTER_TRAIN": "🚆", "RAIL": "🚆", "HIGH_SPEED_TRAIN": "🚄",
    "FERRY": "⛴️",
    "FUNICULAR": "🚡", "GONDOLA_LIFT": "🚡", "CABLE_CAR": "🚋",
    "BUS": "🚌", "INTERCITY_BUS": "🚌", "TROLLEYBUS": "🚌",
}


def _nav_route_payload(rt: dict, with_steps: bool = False) -> dict:
    """Tek Routes yanıtını app'in beklediği şekle çevirir; transit'te adım listesi +
    hat özeti ('⛴️ Vapur → 🚶') üretir — GMaps'teki gibi seçenek karşılaştırması için."""
    enc = ((rt.get("polyline") or {}).get("encodedPolyline")) or ""
    dur_s = int(str(rt.get("duration", "0s")).rstrip("s") or 0)
    out = {
        "coords": decode_polyline(enc) if enc else [],
        "distance_m": int(rt.get("distanceMeters") or 0),
        "duration_min": max(1, round(dur_s / 60)),
        "transit": None,
    }
    if not with_steps:
        return out

    steps: list[dict] = []
    segments: list[dict] = []   # harita çizimi: yürüme=noktalı, transit=hat renginde (4.0b)
    transit = None
    transit_steps = 0
    summary_parts: list[str] = []
    dep_first = None
    arr_last = None
    for leg in rt.get("legs") or []:
        for st in leg.get("steps") or []:
            s_enc = ((st.get("polyline") or {}).get("encodedPolyline")) or ""
            coords = decode_polyline(s_enc) if s_enc else []
            td = st.get("transitDetails")
            if td:
                transit_steps += 1
                line = td.get("transitLine") or {}
                stop_details = td.get("stopDetails") or {}
                lv = td.get("localizedValues") or {}
                veh = _VEHICLE_EMOJI.get(((line.get("vehicle") or {}).get("type") or "").upper(), "🚌")
                name = line.get("nameShort") or line.get("name") or "hat"
                color = line.get("color")           # hat rengi (rozet + harita çizgisi)
                text_color = line.get("textColor")
                board = (stop_details.get("departureStop") or {}).get("name")
                alight = (stop_details.get("arrivalStop") or {}).get("name")
                count = td.get("stopCount")
                dep_t = ((lv.get("departureTime") or {}).get("time") or {}).get("text")
                arr_t = ((lv.get("arrivalTime") or {}).get("time") or {}).get("text")
                if dep_first is None:
                    dep_first = dep_t
                if arr_t:
                    arr_last = arr_t
                steps.append({
                    "kind": "transit", "line": name, "vehicle": veh,
                    "color": color, "text_color": text_color,
                    "board": board, "alight": alight, "stop_count": count,
                    "dep": dep_t, "arr": arr_t, "headsign": td.get("headsign"),
                })
                if len(coords) >= 2:
                    segments.append({"kind": "transit", "color": color, "coords": coords})
                summary_parts.append(f"{veh} {name}")
                if transit is None:
                    transit = {
                        "line": name, "board": board,
                        "headsign": td.get("headsign"), "vehicle": veh,
                    }
            else:
                dm = int(st.get("distanceMeters") or 0)
                instr = ((st.get("navigationInstruction") or {}).get("instructions")) or ""
                if len(coords) >= 2:
                    segments.append({"kind": "walk", "coords": coords})
                if dm < 15:
                    continue  # anlamsız mini yürüyüş adımlarını timeline'a alma (çizgide dursun)
                steps.append({"kind": "walk", "dist_m": dm, "text": instr})
    if transit:
        transit["transfers"] = max(0, transit_steps - 1)
    out["transit"] = transit
    out["steps"] = steps
    out["segments"] = segments
    out["summary"] = " → ".join(summary_parts) if summary_parts else "🚶 yürüyerek"
    out["dep"] = dep_first
    out["arr"] = arr_last
    return out


def google_walk_leg(env: dict, a_lat: float, a_lng: float, b_lat: float, b_lng: float):
    """Yürüme kısayolu (geometri yazımı vb. eski çağıranlar için)."""
    return google_nav_leg(env, a_lat, a_lng, b_lat, b_lng, "walk")


# --------------------------- Google Places (New) — foto + puan (3.2a) ---------------------------
def google_place_lookup(env: dict, name: str, lat: float, lng: float):
    """Text Search (koordinat bias'lı, tek sonuç): place_id + puan + foto adı.
    Anahtar yoksa/hata olursa None döner (çağıran fotosuz devam eder)."""
    key = _google_server_key(env)
    if not key or not name:
        return None
    body = {
        "textQuery": name,
        "pageSize": 1,
        "languageCode": "tr",
        "locationBias": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": 2000.0}},
    }
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.rating,places.photos",
    }
    try:
        r = _req("https://places.googleapis.com/v1/places:searchText", "POST", headers, body, timeout=20)
    except Exception:
        return None
    places = (r or {}).get("places") or []
    if not places:
        return None
    p = places[0]
    photos = p.get("photos") or []
    return {
        "place_id": p.get("id"),
        "rating": p.get("rating"),
        "photo_name": photos[0].get("name") if photos else None,
    }


def google_photo_url(env: dict, photo_name: str | None, max_w: int = 1000):
    """Photo media redirect'i SUNUCUDA çözülür → kalıcı googleusercontent URL'si.
    API anahtarı asla DB'ye/istemciye sızmaz (skipHttpRedirect + header ile)."""
    key = _google_server_key(env)
    if not key or not photo_name:
        return None
    url = (f"https://places.googleapis.com/v1/{photo_name}/media"
           f"?maxWidthPx={max_w}&skipHttpRedirect=true")
    try:
        r = _req(url, "GET", {"X-Goog-Api-Key": key})
    except Exception:
        return None
    return (r or {}).get("photoUri")


def google_places_search(env: dict, query: str, lat: float, lng: float,
                         radius_m: float = 2500.0, limit: int = 6) -> list[dict]:
    """Text Search (New), çevre bias'lı ÇOKLU sonuç — AI Rota Üretici aday havuzu (2.7).
    Anahtar yoksa/hata olursa boş liste döner."""
    key = _google_server_key(env)
    if not key or not query:
        return []
    body = {
        "textQuery": query,
        "pageSize": min(limit, 10),
        "languageCode": "tr",
        "locationBias": {"circle": {"center": {"latitude": lat, "longitude": lng}, "radius": radius_m}},
    }
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": ("places.id,places.displayName,places.location,places.rating,"
                             "places.userRatingCount,places.priceLevel,places.types,"
                             "places.formattedAddress,places.photos"),
    }
    try:
        r = _req("https://places.googleapis.com/v1/places:searchText", "POST", headers, body, timeout=20)
    except Exception:
        return []
    out = []
    for p in (r or {}).get("places") or []:
        loc = p.get("location") or {}
        name = ((p.get("displayName") or {}).get("text")) or ""
        if loc.get("latitude") is None or not name:
            continue
        photos = p.get("photos") or []
        out.append({
            "place_id": p.get("id"),
            "name": name,
            "lat": loc["latitude"], "lng": loc["longitude"],
            "rating": p.get("rating"),
            "rating_count": p.get("userRatingCount"),
            "price_level": p.get("priceLevel"),  # enum string (PRICE_LEVEL_MODERATE vb.)
            "types": p.get("types") or [],
            "address": p.get("formattedAddress"),
            "photo_name": photos[0].get("name") if photos else None,
        })
    return out


# --------------------------- Static Maps (4.0c) ---------------------------
def encode_polyline(points: list[dict], precision: int = 5) -> str:
    """[{lat,lng}] → Google encoded polyline (decode_polyline'ın tersi)."""
    factor = 10 ** precision
    out: list[str] = []
    prev_lat = prev_lng = 0
    for p in points:
        lat, lng = round(p["lat"] * factor), round(p["lng"] * factor)
        for delta in (lat - prev_lat, lng - prev_lng):
            v = ~(delta << 1) if delta < 0 else (delta << 1)
            while v >= 0x20:
                out.append(chr((0x20 | (v & 0x1F)) + 63))
                v >>= 5
            out.append(chr(v + 63))
        prev_lat, prev_lng = lat, lng
    return "".join(out)


# Paylaşım kartının koyu marka görünümü — app'in DARK_MAP_STYLE'ının kompakt hali
_STATIC_DARK_STYLE = [
    "element:geometry|color:0x141B33",
    "element:labels.text.fill|color:0x8A93B8",
    "element:labels.text.stroke|color:0x0B1022",
    "feature:poi|visibility:off",
    "feature:transit|visibility:off",
    "feature:administrative|element:geometry|visibility:off",
    "feature:road|element:labels.icon|visibility:off",
    "feature:road|element:geometry|color:0x232C4E",
    "feature:road.highway|element:geometry|color:0x2E3960",
    "feature:water|element:geometry|color:0x0E1B33",
    "feature:landscape|element:geometry|color:0x101731",
]
_LINE_COLORS = {"coral": "0xF4503BE6", "teal": "0x2DD4BFE6"}  # planlanan / yürünen


def google_static_map(env: dict, points: list[dict], w: int = 608, h: int = 300,
                      line: str = "coral") -> bytes | None:
    """Rota izli koyu temalı harita PNG'si (Maps Static API) — paylaşım kartı arka planı.
    Anahtar sunucuda kalır; app bu byte'ları /static-map proxy'sinden alır."""
    key = _google_server_key(env)
    if not key or len(points) < 2:
        return None
    params: list[tuple[str, str]] = [
        ("size", f"{min(w, 640)}x{min(h, 640)}"),
        ("scale", "2"),
        ("maptype", "roadmap"),
        ("path", f"color:{_LINE_COLORS.get(line, _LINE_COLORS['coral'])}|weight:4|enc:"
                 + encode_polyline(points)),
        # başlangıç yeşil, bitiş mercan nokta (kart dilindeki renkler)
        ("markers", f"size:small|color:0x34D399|{points[0]['lat']:.5f},{points[0]['lng']:.5f}"),
        ("markers", f"size:small|color:0xF4503B|{points[-1]['lat']:.5f},{points[-1]['lng']:.5f}"),
        ("key", key),
    ]
    params += [("style", s) for s in _STATIC_DARK_STYLE]
    url = "https://maps.googleapis.com/maps/api/staticmap?" + urllib.parse.urlencode(params)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "sana-ai"})
        with urllib.request.urlopen(req, timeout=20, context=_SSL) as r:
            if "image" not in (r.headers.get("Content-Type") or ""):
                return None
            return r.read()
    except Exception:
        return None


# --------------------------- Roads + Geocoding (4.0c) ---------------------------
def google_snap_to_roads(env: dict, points: list[dict]) -> list[dict]:
    """Ham GPS izini yola oturtur (Roads API snapToRoads, interpolate=true).
    API limiti istek başına 100 nokta → uzun izler eşit aralıkla 100'e indirilir.
    Hata/anahtar yoksa [] döner — çağıran ham izi kullanmaya devam eder."""
    key = _google_server_key(env)
    if not key or len(points) < 2:
        return []
    pts = points
    if len(pts) > 100:
        step = (len(pts) - 1) / 99.0
        pts = [points[round(i * step)] for i in range(100)]
    path = "|".join(f"{p['lat']:.6f},{p['lng']:.6f}" for p in pts)
    url = ("https://roads.googleapis.com/v1/snapToRoads?"
           + urllib.parse.urlencode({"path": path, "interpolate": "true", "key": key}))
    try:
        r = _req(url, timeout=20)
    except Exception:
        return []
    out = []
    for sp in (r or {}).get("snappedPoints") or []:
        loc = sp.get("location") or {}
        if loc.get("latitude") is None:
            continue
        out.append({"lat": loc["latitude"], "lng": loc["longitude"]})
    return out


_GEO_CACHE: dict[str, tuple[float, float]] = {}


def city_coords(env: dict, city: str) -> tuple[float, float]:
    """Şehir → (lat, lng). Önce sabit tablo, yoksa Geocoding ile merkez bulunur
    (tüm dünya: 'Berlin' de çözülür; TR bias'ı korunur) ve cache'lenir. Hatada Istanbul."""
    c = (city or "istanbul").casefold()
    if c in _CITY_COORDS:
        return _CITY_COORDS[c]
    if c in _GEO_CACHE:
        return _GEO_CACHE[c]
    key = _google_server_key(env)
    if key:
        url = ("https://maps.googleapis.com/maps/api/geocode/json?"
               + urllib.parse.urlencode({"address": city, "region": "tr",
                                         "language": "tr", "key": key}))
        try:
            r = _req(url, timeout=15)
            loc = (((r or {}).get("results") or [{}])[0].get("geometry") or {}).get("location") or {}
            if loc.get("lat") is not None:
                _GEO_CACHE[c] = (loc["lat"], loc["lng"])
                return _GEO_CACHE[c]
        except Exception:
            pass
    return _CITY_COORDS["istanbul"]


def google_reverse_geocode_place(env: dict, lat: float, lng: float) -> dict | None:
    """Koordinattan yer: TR'de İL (admin_area_1), dünyada ŞEHİR (locality).
    → {"name": "Muğla"|"Berlin", "country_code": "TR"|"DE"} — kanonikleştirme çağıranda."""
    key = _google_server_key(env)
    if not key:
        return None
    url = ("https://maps.googleapis.com/maps/api/geocode/json?"
           + urllib.parse.urlencode({
               "latlng": f"{lat:.6f},{lng:.6f}",
               "result_type": "locality|administrative_area_level_1",
               "language": "tr", "key": key,
           }))
    try:
        r = _req(url, timeout=15)
    except Exception:
        return None
    locality = admin1 = country = None
    for res in (r or {}).get("results") or []:
        for comp in res.get("address_components") or []:
            t = set(comp.get("types") or [])
            if "locality" in t and not locality:
                locality = comp.get("long_name")
            if "administrative_area_level_1" in t and not admin1:
                admin1 = comp.get("long_name")
            if "country" in t and not country:
                country = comp.get("short_name")
    name = admin1 if country == "TR" else (locality or admin1)  # TR=il, dünya=şehir
    return {"name": name, "country_code": country} if name else None


def google_reverse_geocode_city(env: dict, lat: float, lng: float) -> str | None:
    """Geriye uyumluluk: yalnız yer adını döner (TR'de il, dünyada şehir)."""
    p = google_reverse_geocode_place(env, lat, lng)
    return p["name"] if p else None


def google_search_city(env: dict, q: str, limit: int = 5) -> list[dict]:
    """DÜNYA geneli şehir arama (Geocoding forward): yalnız şehir/il tipindeki
    sonuçlar → [{name, country, lat, lng}]. LLM şehir doğrulamasında da kullanılır."""
    key = _google_server_key(env)
    if not key or not q.strip():
        return []
    url = ("https://maps.googleapis.com/maps/api/geocode/json?"
           + urllib.parse.urlencode({"address": q.strip(), "language": "tr", "key": key}))
    try:
        r = _req(url, timeout=15)
    except Exception:
        return []
    out = []
    for res in (r or {}).get("results") or []:
        types = set(res.get("types") or [])
        if not (types & {"locality", "administrative_area_level_1"}):
            continue  # sokak/POI sonuçları şehir sayılmaz (halüsinasyon koruması)
        loc = (res.get("geometry") or {}).get("location") or {}
        name = country = None
        for comp in res.get("address_components") or []:
            t = set(comp.get("types") or [])
            if not name and (t & {"locality", "administrative_area_level_1"}):
                name = comp.get("long_name")
            if "country" in t and not country:
                country = comp.get("long_name")
        if name and loc.get("lat") is not None:
            out.append({"name": name, "country": country, "lat": loc["lat"], "lng": loc["lng"]})
        if len(out) >= limit:
            break
    return out


# --------------------------- Hava durumu ---------------------------
# Öncelik: Google Weather API (GOOGLE_WEATHER_API_KEY varsa) → OpenWeather (yedek).
# İkisi de aynı şekle döner: {temp, desc, rainy, bias}.

_CITY_COORDS = {
    "istanbul": (41.0082, 28.9784),
    "ankara": (39.9334, 32.8597),
    "gaziantep": (37.0662, 37.3833),
    "izmir": (38.4192, 27.1287),
    "bursa": (40.1885, 29.0610),
    "mugla": (36.9000, 28.0500),  # il geneli merkez (Bodrum-Fethiye hattının ortası)
}


def _weather_google(env: dict, city: str):
    key = _google_server_key(env)
    if not key:
        return None
    lat, lng = city_coords(env, city)
    q = urllib.parse.urlencode({
        "key": key,
        "location.latitude": lat,
        "location.longitude": lng,
        "languageCode": "tr",
        "unitsSystem": "METRIC",
    })
    try:
        r = _req("https://weather.googleapis.com/v1/currentConditions:lookup?" + q, "GET")
    except Exception:
        return None
    cond = r.get("weatherCondition") or {}
    ctype = (cond.get("type") or "").upper()
    desc = ((cond.get("description") or {}).get("text") or "").lower()
    temp = (r.get("temperature") or {}).get("degrees")
    if temp is None:
        return None
    rainy = any(t in ctype for t in ("RAIN", "SNOW", "THUNDER", "DRIZZLE", "SHOWER", "STORM"))
    return {
        "temp": round(float(temp), 1),
        "desc": desc,
        "rainy": rainy,
        "bias": "indoor" if rainy else "any",
    }


def _weather_openweather(env: dict, city: str):
    key = env.get("OPENWEATHER_API_KEY")
    if not key:
        return None
    q = urllib.parse.urlencode({"q": city, "appid": key, "units": "metric", "lang": "tr"})
    try:
        r = _req("https://api.openweathermap.org/data/2.5/weather?" + q, "GET")
    except Exception:
        return None
    w = (r.get("weather") or [{}])[0]
    main = (w.get("main") or "").lower()
    rainy = main in ("rain", "drizzle", "thunderstorm", "snow")
    return {
        "temp": round(r.get("main", {}).get("temp", 0), 1),
        "desc": w.get("description", ""),
        "rainy": rainy,
        "bias": "indoor" if rainy else "any",
    }


def get_weather(env: dict, city: str = "Istanbul"):
    return _weather_google(env, city) or _weather_openweather(env, city)
