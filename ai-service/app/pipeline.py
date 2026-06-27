"""SANA deterministik AI pipeline (orkestratör).

Akış: Intent Parser → Data (hava) → Social Memory (match_routes) →
      Budget/Logistics → Flood Composer.

Test:  cd ai-service && py -m app.pipeline "Bugün İstanbul'da yalnızım, kafa dinlemek istiyorum, bütçem az"
"""
from __future__ import annotations

import json
import sys

from app.clients import get_route, get_weather, load_env, match_routes, nvidia_chat, nvidia_embed, sb_insert

# --------------------------- Prompt'lar ---------------------------
INTENT_SYS = (
    "Sen SANA'nın niyet ayrıştırıcısısın. Kullanıcının serbest metnini yapılandırılmış "
    "JSON'a çevir. SADECE şu alanlarla geçerli JSON döndür, başka metin yazma:\n"
    '{"city": string (örn. "Istanbul"), "mood": string (kısa, örn. "sakin"), '
    '"vibe_tags": string[] (örn. ["kafa-dinleme","butce-dostu"]), '
    '"budget_max": integer 1-4 (1=çok ucuz, 4=lüks), '
    '"group_size": integer, "time_available_min": integer, '
    '"indoor_outdoor_pref": "indoor"|"outdoor"|"any"}'
)

COMPOSER_SYS = (
    "Sen SANA'nın 'Flood Bestecisi'sin. Sana niyet, hava ve SEÇİLMİŞ gerçek bir rota "
    "(sıralı duraklar) verilir. Görevin bu rotayı sıcak, samimi bir günlük anlatısına çevirmek.\n"
    "Kurallar:\n"
    "1. Durakların SIRASINI değiştirme, yeni mekan UYDURMA. Sadece verilen durakları kullan.\n"
    "2. Her durak için TEK cümlelik sıcak bir anlatı yaz (kısa tut); yazarın notunu zenginleştir.\n"
    "3. Havaya 1 cümlelik pratik dokunuş kat. Bütçeyi açıkça belirt.\n"
    "4. SADECE şu JSON ile dön:\n"
    '{"title": string, "summary": string (2-3 cümle, davetkar), '
    '"weather_note": string, "budget_note": string, '
    '"stops": [{"seq": int, "name": string, "narrative": string}], '
    '"social_signal": string (kısa, "yakında senin gibi X seven birkaç kişi var" tarzı simüle mesaj)}'
)


BUDGET_LABELS = {1: "çok uygun (₺)", 2: "uygun (₺₺)", 3: "orta (₺₺₺)", 4: "lüks (₺₺₺₺)"}


def fallback_ai(route: dict, exp: list, weather: dict) -> dict:
    """Composer (LLM) takılırsa: rotayı yine de mekan notlarıyla döndür."""
    temp = weather.get("temp")
    return {
        "title": route.get("title"),
        "summary": route.get("description") or "Hafızandan sana göre seçtiğimiz bir rota.",
        "weather_note": (f"Bugün hava {temp}°, {weather.get('desc', '')}." if temp is not None else ""),
        "budget_note": f"Bütçe: {BUDGET_LABELS.get(route.get('budget_level'), 'uygun')}.",
        "stops": [{"seq": i, "name": w["name"], "narrative": w.get("note") or ""} for i, w in enumerate(exp)],
        "social_signal": "Yakında senin gibi rotalar seven kişiler olabilir.",
        "_fallback": True,
    }


def parse_intent(env: dict, text: str) -> dict:
    try:
        raw = nvidia_chat(env, INTENT_SYS, text, json_mode=True, temperature=0.2, max_tokens=250)
        d = json.loads(raw)
    except Exception:  # noqa: BLE001 — LLM/timeout/JSON hatası → güvenli varsayılan
        d = {}
    if not isinstance(d, dict):
        d = {}
    d.setdefault("city", "Istanbul")
    d.setdefault("budget_max", 4)
    d.setdefault("indoor_outdoor_pref", "any")
    d.setdefault("vibe_tags", [])
    d.setdefault("mood", "")
    return d


def plan_route(text: str) -> dict:
    env = load_env()

    # [1] Intent
    intent = parse_intent(env, text)
    city = intent.get("city") or "Istanbul"
    try:
        budget_max = int(intent.get("budget_max") or 4)
    except (TypeError, ValueError):
        budget_max = 4

    # [2] Data: hava
    weather = get_weather(env, city) or {"bias": "any", "desc": "", "temp": None, "rainy": False}

    # [3] Social Memory: niyeti embedle → match_routes
    qtext = f"{intent.get('mood','')} {' '.join(intent.get('vibe_tags', []))} {text}".strip()
    emb = nvidia_embed(env, qtext, input_type="query")
    candidates = match_routes(env, emb, match_count=5, filter_city=city, max_budget=budget_max)
    if not candidates:
        return {"ok": False, "reason": "no_match", "intent": intent, "weather": weather}

    # [4] Budget/Logistics: hava biası ile en uygun adayı seç
    bias = weather.get("bias", "any")
    pref = intent.get("indoor_outdoor_pref", "any")
    chosen = None
    for c in candidates:
        r = get_route(env, c["route_id"])
        if not r:
            continue
        fit = r.get("weather_fit", "any")
        if bias == "indoor" and fit == "outdoor":
            continue
        if pref == "indoor" and fit == "outdoor":
            continue
        chosen = r
        chosen["_similarity"] = c.get("similarity")
        break
    if chosen is None:
        chosen = get_route(env, candidates[0]["route_id"])
        chosen["_similarity"] = candidates[0].get("similarity")

    wps = sorted(chosen.get("waypoints", []), key=lambda w: w.get("seq", 0))
    exp = [w for w in wps if w.get("kind") == "experience"]

    # [5] Flood Composer
    composer_input = {
        "niyet": intent,
        "hava": weather,
        "rota": {
            "title": chosen.get("title"),
            "butce": BUDGET_LABELS.get(chosen.get("budget_level"), "uygun"),
            "vibe_tags": chosen.get("vibe_tags"),
            "duraklar": [{"seq": i, "name": w["name"], "not": w.get("note")} for i, w in enumerate(exp)],
        },
    }
    try:
        raw = nvidia_chat(env, COMPOSER_SYS, json.dumps(composer_input, ensure_ascii=False),
                          json_mode=True, temperature=0.6, max_tokens=700)
        ai = json.loads(raw)
        if not isinstance(ai, dict) or not ai.get("stops"):
            ai = fallback_ai(chosen, exp, weather)
    except Exception:  # noqa: BLE001 — composer takılırsa rota yine dönsün
        ai = fallback_ai(chosen, exp, weather)

    return {
        "ok": True,
        "intent": intent,
        "weather": weather,
        "route_id": chosen.get("id"),
        "route": chosen,
        "ai": ai,
    }


ENRICH_SYS = (
    "Sen SANA'nın 'Rota Ortak-Yazarı'sın. Kullanıcı haritaya birkaç durak ekledi "
    "(ad + opsiyonel kişisel not). Bunlardan sıcak, paylaşılabilir bir günlük rota üret.\n"
    "Kurallar:\n"
    "1. Durakların SIRASINI ve adlarını koru, yeni mekan UYDURMA.\n"
    "2. Her durağa bir kategori ata (şu kümeden): cafe, restaurant, street_food, park, "
    "historical_site, museum, mosque, church, bookstore, gallery, bazaar, viewpoint, waterfront, other.\n"
    "3. Her durağa 1 sıcak cümlelik anlatı yaz (varsa kullanıcının notunu zenginleştir).\n"
    "4. SADECE şu JSON ile dön:\n"
    '{"title": string (kısa, davetkar), "description": string (1-2 cümle), '
    '"vibe_tags": string[] (3-5, örn. ["sakin","kafa-dinleme"]), '
    '"weather_fit": "indoor"|"outdoor"|"any", '
    '"stops": [{"category": string, "narrative": string}]}'
)


def enrich_route(stops: list[dict]) -> dict:
    """Kullanıcının eklediği duraklar (ad+not) → AI başlık/etiket/kategori/anlatı."""
    env = load_env()
    names = [{"name": s.get("name"), "note": s.get("note")} for s in stops]
    try:
        raw = nvidia_chat(env, ENRICH_SYS, json.dumps(names, ensure_ascii=False),
                          json_mode=True, temperature=0.5, max_tokens=600)
        data = json.loads(raw)
        if not isinstance(data, dict):
            data = {}
    except Exception:  # noqa: BLE001
        data = {}
    data.setdefault("title", "Benim Rotam")
    data.setdefault("description", ", ".join(s.get("name", "") for s in stops))
    data.setdefault("vibe_tags", [])
    data.setdefault("weather_fit", "any")
    enriched = data.get("stops") or []
    out_stops = []
    for i, s in enumerate(stops):
        e = enriched[i] if i < len(enriched) and isinstance(enriched[i], dict) else {}
        out_stops.append({
            "category": e.get("category", "other"),
            "narrative": e.get("narrative", s.get("note") or ""),
        })
    data["stops"] = out_stops
    return {"ok": True, **data}


def embed_route(route_id: str) -> dict:
    """Kaydedilmiş bir rotayı hafızaya (ai_memory_embeddings) embedler."""
    env = load_env()
    r = get_route(env, route_id)
    if not r:
        return {"ok": False, "reason": "not_found"}
    wps = sorted(r.get("waypoints", []), key=lambda w: w.get("seq", 0))
    exp = [w for w in wps if w.get("kind") == "experience"]
    stops = "; ".join(f"{w['name']} ({w.get('note') or ''})" for w in exp)
    tags = ", ".join(r.get("vibe_tags") or [])
    content = f"{r.get('title')}. {r.get('description') or ''} Etiketler: {tags}. Duraklar: {stops}."
    vec = nvidia_embed(env, content, input_type="passage")
    sb_insert(env, "ai_memory_embeddings", {
        "route_id": route_id, "source_type": "route", "content": content,
        "embedding": vec, "metadata": {"city": r.get("city"), "vibe_tags": r.get("vibe_tags")},
    })
    return {"ok": True}


if __name__ == "__main__":
    query = sys.argv[1] if len(sys.argv) > 1 else \
        "Bugün İstanbul'da yalnızım, kafa dinlemek istiyorum, bütçem az"
    res = plan_route(query)
    print("\n=== NIYET ===")
    print(json.dumps(res.get("intent"), ensure_ascii=False, indent=2))
    print("\n=== HAVA ===", res.get("weather"))
    if not res.get("ok"):
        print("\nSONUC YOK:", res.get("reason"))
        sys.exit(0)
    print("\n=== SECILEN ROTA ===", res["route"].get("title"), "| similarity:", res["route"].get("_similarity"))
    ai = res.get("ai", {})
    print("\n=== AI FLOOD ===")
    print("Baslik :", ai.get("title"))
    print("Ozet   :", ai.get("summary"))
    print("Hava   :", ai.get("weather_note"))
    print("Butce  :", ai.get("budget_note"))
    for s in ai.get("stops", []):
        print(f"  {s.get('seq')}. {s.get('name')} — {s.get('narrative')}")
    print("Sosyal :", ai.get("social_signal"))
