"""SANA seed/backfill yardımcıları — SADECE standart kütüphane (pip gerektirmez).

NVIDIA (embedding), SerpApi (mekan verisi, cache'li) ve Supabase REST (DB) için
basit HTTP istemcileri. `py` launcher ile çalışır.
"""
from __future__ import annotations

import json
import math
import os
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
import sys

# Windows konsolunda Türkçe/ok karakterleri için UTF-8 çıktı
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# ai-service/ kök dizini (bu dosya ai-service/scripts/ altında)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(ROOT)
CACHE_DIR = os.path.join(REPO, "supabase", "seed", "cache")
SEED_JSON = os.path.join(REPO, "supabase", "seed", "seed_routes.json")

_SSL = ssl.create_default_context()


# --------------------------- .env yükleyici ---------------------------
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
    # Gerçek ortam değişkenleri .env'i ezer
    for k in list(env):
        if os.environ.get(k):
            env[k] = os.environ[k]
    return env


# --------------------------- HTTP ---------------------------
def _request(url: str, method: str = "GET", headers: dict | None = None,
             body=None, timeout: int = 90):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=_SSL) as r:
            raw = r.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")
        raise RuntimeError(f"HTTP {e.code} {method} {url}\n{detail}") from e


def http_get(url, headers=None):
    return _request(url, "GET", headers)


def http_post(url, headers=None, body=None):
    return _request(url, "POST", headers, body)


# --------------------------- NVIDIA embedding ---------------------------
def nvidia_embed(env: dict, text: str, input_type: str = "passage") -> list[float]:
    url = env["NVIDIA_BASE_URL"].rstrip("/") + "/embeddings"
    headers = {
        "Authorization": f"Bearer {env['NVIDIA_API_KEY']}",
        "Content-Type": "application/json",
    }
    body = {
        "input": [text],
        "model": env.get("NVIDIA_EMBED_MODEL", "nvidia/nv-embedqa-e5-v5"),
        "input_type": input_type,
        "truncate": "END",
    }
    r = http_post(url, headers, body)
    return r["data"][0]["embedding"]


# --------------------------- NVIDIA chat (çeviri) ---------------------------
def nvidia_chat(env: dict, system: str, user: str, json_mode: bool = False,
                temperature: float = 0.2) -> str:
    """NVIDIA NIM chat/completions — seed çevirisi için. provider.py ile aynı endpoint."""
    url = env["NVIDIA_BASE_URL"].rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {env['NVIDIA_API_KEY']}",
        "Content-Type": "application/json",
    }
    body: dict = {
        "model": env.get("NVIDIA_CHAT_MODEL", "meta/llama-3.3-70b-instruct"),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": temperature,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    r = http_post(url, headers, body)
    return (r["choices"][0]["message"]["content"] or "").strip()


# --------------------------- SerpApi (cache'li) ---------------------------
def serpapi_search(env: dict, query: str, ll: str, hl: str = "tr") -> dict:
    """google_maps engine araması. Yanıt diske cache'lenir → kota dostu."""
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_key = re.sub(r"[^0-9A-Za-z]+", "_", f"{query}_{ll}")[:120]
    cache_file = os.path.join(CACHE_DIR, cache_key + ".json")
    if os.path.exists(cache_file):
        with open(cache_file, encoding="utf-8") as f:
            return json.load(f)
    params = urllib.parse.urlencode({
        "engine": "google_maps", "q": query, "ll": ll, "hl": hl,
        "type": "search", "api_key": env["SERPAPI_KEY"],
    })
    r = http_get("https://serpapi.com/search?" + params)
    with open(cache_file, "w", encoding="utf-8") as f:
        json.dump(r, f, ensure_ascii=False)
    time.sleep(1.0)  # nazik davran
    return r


def best_place(serp: dict) -> dict | None:
    """local_results içinden gps koordinatı olan ilk anlamlı sonucu döndürür."""
    for item in serp.get("local_results", []) or []:
        gps = item.get("gps_coordinates") or {}
        if gps.get("latitude") and gps.get("longitude"):
            return item
    # type=search tek sonuç döndürdüyse place_results olabilir
    pr = serp.get("place_results")
    if pr and (pr.get("gps_coordinates") or {}).get("latitude"):
        return pr
    return None


# --------------------------- Supabase REST ---------------------------
def _sb_headers(env: dict, prefer: str | None = None) -> dict:
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if prefer:
        h["Prefer"] = prefer
    return h


def sb_insert(env: dict, table: str, rows):
    url = env["SUPABASE_URL"].rstrip("/") + f"/rest/v1/{table}"
    return http_post(url, _sb_headers(env, "return=representation"), rows)


def sb_get(env: dict, table: str, query: str = ""):
    url = env["SUPABASE_URL"].rstrip("/") + f"/rest/v1/{table}"
    if query:
        url += "?" + query
    return http_get(url, _sb_headers(env))


def sb_delete(env: dict, table: str, query: str):
    url = env["SUPABASE_URL"].rstrip("/") + f"/rest/v1/{table}?" + query
    return _request(url, "DELETE", _sb_headers(env, "return=minimal"))


def sb_admin_create_user(env: dict, email: str, password: str) -> dict:
    url = env["SUPABASE_URL"].rstrip("/") + "/auth/v1/admin/users"
    body = {"email": email, "password": password, "email_confirm": True}
    return http_post(url, _sb_headers(env), body)


def sb_admin_find_user(env: dict, email: str) -> dict | None:
    url = env["SUPABASE_URL"].rstrip("/") + "/auth/v1/admin/users?per_page=200"
    res = http_get(url, _sb_headers(env))
    for u in (res or {}).get("users", []):
        if u.get("email") == email:
            return u
    return None


# --------------------------- yardımcılar ---------------------------
def price_to_level(price: str | None) -> int:
    """SerpApi fiyat aralığı (örn. '₺200–400') → price_level (1-4)."""
    if not price:
        return 1
    nums = [int(n) for n in re.findall(r"\d+", price)]
    hi = max(nums) if nums else 0
    if hi <= 200:
        return 1
    if hi <= 400:
        return 2
    if hi <= 600:
        return 3
    return 4


def haversine_m(a: tuple[float, float], b: tuple[float, float]) -> int:
    R = 6371000.0
    lat1, lon1, lat2, lon2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return int(2 * R * math.asin(math.sqrt(h)))
