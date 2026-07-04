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


def google_walk_leg(env: dict, a_lat: float, a_lng: float, b_lat: float, b_lng: float):
    """İki nokta arası YÜRÜME rotası (Routes API): sokak geometrisi + gerçek mesafe/süre.
    Anahtar yoksa veya hata olursa None döner (çağıran kuş uçuşuna düşer)."""
    key = _google_server_key(env)
    if not key:
        return None
    body = {
        "origin": {"location": {"latLng": {"latitude": a_lat, "longitude": a_lng}}},
        "destination": {"location": {"latLng": {"latitude": b_lat, "longitude": b_lng}}},
        "travelMode": "WALK",
    }
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    }
    try:
        r = _req("https://routes.googleapis.com/directions/v2:computeRoutes", "POST", headers, body, timeout=30)
    except Exception:
        return None
    routes = (r or {}).get("routes") or []
    if not routes:
        return None
    rt = routes[0]
    enc = ((rt.get("polyline") or {}).get("encodedPolyline")) or ""
    dur_s = int(str(rt.get("duration", "0s")).rstrip("s") or 0)
    return {
        "coords": decode_polyline(enc) if enc else [],
        "distance_m": int(rt.get("distanceMeters") or 0),
        "duration_min": max(1, round(dur_s / 60)),
    }


# --------------------------- SerpApi mekan arama ---------------------------
_SEARCH_CACHE: dict = {}


def serpapi_search(env: dict, query: str, ll: str = "@41.0082,28.9784,12z", hl: str = "tr") -> list[dict]:
    """Mekan araması (Google Maps engine). Kota dostu basit cache."""
    key = query.lower().strip()
    if not key:
        return []
    if key in _SEARCH_CACHE:
        return _SEARCH_CACHE[key]
    params = urllib.parse.urlencode({
        "engine": "google_maps", "q": query, "ll": ll, "hl": hl,
        "type": "search", "api_key": env.get("SERPAPI_KEY", ""),
    })
    try:
        r = _req("https://serpapi.com/search?" + params, "GET")
    except Exception:  # noqa: BLE001
        return []
    out = []
    for item in (r.get("local_results") or [])[:8]:
        gps = item.get("gps_coordinates") or {}
        if not gps.get("latitude"):
            continue
        out.append({
            "name": item.get("title"),
            "lat": gps["latitude"], "lng": gps["longitude"],
            "place_id": item.get("place_id"),
            "address": item.get("address"),
            "rating": item.get("rating"),
            "thumbnail": item.get("thumbnail"),
            "price": item.get("price"),
            "type": item.get("type"),
        })
    _SEARCH_CACHE[key] = out
    return out


# --------------------------- Hava durumu ---------------------------
# Öncelik: Google Weather API (GOOGLE_WEATHER_API_KEY varsa) → OpenWeather (yedek).
# İkisi de aynı şekle döner: {temp, desc, rainy, bias}.

_CITY_COORDS = {"istanbul": (41.0082, 28.9784)}


def _weather_google(env: dict, city: str):
    key = _google_server_key(env)
    if not key:
        return None
    lat, lng = _CITY_COORDS.get(city.lower(), _CITY_COORDS["istanbul"])
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
