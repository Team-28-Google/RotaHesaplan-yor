"""SANA AI Service — FastAPI giriş noktası (Sprint 2).

Uçlar:
  GET  /health
  POST /embed        {text, input_type} → embedding
  POST /plan-route   {text} → deterministik pipeline (intent→hava→hafıza→bütçe→flood)

İş mantığı stdlib `app.clients` + `app.pipeline` içinde; FastAPI yalnızca ince
HTTP/CORS taşıma katmanıdır (mobil app buraya konuşur).
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.clients import google_walk_leg, load_env, nvidia_embed, serpapi_search
from app.pipeline import embed_route as run_embed_route
from app.pipeline import enrich_route as run_enrich_route
from app.pipeline import plan_route as run_pipeline
from app.pipeline import route_geometry as run_route_geometry
from app.pipeline import save_memory_event, save_onboarding_memory, summarize_comments

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


class OnboardingMemoryRequest(BaseModel):
    user_id: str = Field(..., min_length=10)
    vibes: list[str] = []
    budget: int = Field(2, ge=1, le=3)


class WalkRouteRequest(BaseModel):
    from_lat: float
    from_lng: float
    to_lat: float
    to_lng: float


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


class EmbedRouteRequest(BaseModel):
    route_id: str


class SearchRequest(BaseModel):
    q: str = Field(..., min_length=1)


class SearchRequest(BaseModel):
    q: str = Field(..., min_length=1)


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
def plan_route(req: PlanRouteRequest) -> dict:
    """Deterministik AI pipeline: niyet (+kullanıcı hafızası) → rota → AI flood anlatısı."""
    try:
        return run_pipeline(req.text, req.user_id, req.force_weather_fit)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Pipeline hatası: {e}") from e


@app.post("/memory/onboarding")
def memory_onboarding(req: OnboardingMemoryRequest) -> dict:
    """Onboarding tercihlerini kullanıcı profili olarak AI hafızasına yazar."""
    try:
        return save_onboarding_memory(req.user_id, req.vibes, req.budget)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Hafıza hatası: {e}") from e


@app.post("/memory/event")
def memory_event(req: MemoryEventRequest) -> dict:
    """Davranış hafızası (2.2): favori/yolculuk/yorum → preference_update embed'i."""
    try:
        return save_memory_event(req.user_id, req.kind, req.route_id)
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
        return run_enrich_route([s.model_dump() for s in req.stops])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Enrich hatası: {e}") from e


@app.post("/embed-route")
def embed_route(req: EmbedRouteRequest) -> dict:
    """Kaydedilen rotayı hafızaya embedler (başkalarının AI aramasında çıksın)."""
    try:
        return run_embed_route(req.route_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Embed hatası: {e}") from e


@app.post("/walk-route")
def walk_route(req: WalkRouteRequest) -> dict:
    """Canlı navigasyon: kullanıcı konumu → hedef durak yürüme rotası (journey modu)."""
    leg = google_walk_leg(load_env(), req.from_lat, req.from_lng, req.to_lat, req.to_lng)
    return {"ok": bool(leg), **(leg or {})}


@app.post("/route-geometry")
def route_geometry(req: EmbedRouteRequest) -> dict:
    """Rotanın yürüme bacaklarına gerçek sokak geometrisi yazar (Google Routes)."""
    try:
        return run_route_geometry(req.route_id)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Geometri hatası: {e}") from e


@app.post("/search-place")
def search_place(req: SearchRequest) -> dict:
    """Mekan araması (SerpApi) — rota oluştururken durak eklemek için."""
    return {"results": serpapi_search(load_env(), req.q)}
