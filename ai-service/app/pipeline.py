"""SANA deterministik AI pipeline (orkestratör).

Akış: Intent Parser → Data (hava) → Social Memory (match_routes) →
      Budget/Logistics → Flood Composer.

Test:  cd ai-service && py -m app.pipeline "Bugün İstanbul'da yalnızım, kafa dinlemek istiyorum, bütçem az"
"""
from __future__ import annotations

import json
import sys
import time

import random

from app.clients import (
    _CITY_COORDS, city_coords, get_route, get_weather, google_photo_url, google_place_lookup,
    google_places_search, google_walk_leg, load_env, match_routes, nvidia_chat,
    nvidia_embed, sb_delete, sb_insert, sb_patch, sb_select,
)

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
    "Sen SANA'nın 'Flood Bestecisi'sin. Sana niyet, kullanıcı profili, hava ve SEÇİLMİŞ gerçek bir rota "
    "(sıralı duraklar) verilir. Görevin bu rotayı sıcak, samimi bir günlük anlatısına çevirmek.\n"
    "'kullanici_profili' verildiyse anlatının tonunu ve vurgularını ona göre kişiselleştir "
    "(örn. kahve seven birine kahve duraklarını öne çıkar) ama ASLA yeni mekan uydurma.\n"
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

# --------------------------- Kullanıcı hafızası (onboarding) ---------------------------
# Onboarding tercihleri doğal dil cümlesine çevrilip embed'lenir; plan_route bu profili
# hem rota eşleştirmesine (embedding) hem anlatı tonuna (composer) harmanlar.

_VIBE_TR = {
    "sakin": "sakin", "tarih": "tarih ve kültür", "deniz": "deniz kenarı",
    "kahve": "kahve mekânları", "sanat": "sanat ve galeriler", "gece": "gece hayatı",
    "yesil": "yeşil alanlar ve doğa", "yuruyus": "uzun yürüyüşler",
}
_BUDGET_TR = {1: "düşük bütçeli", 2: "orta bütçeli", 3: "keyfine düşkün"}


def save_onboarding_memory(user_id: str, vibes: list, budget: int) -> dict:
    """Onboarding tercihlerini kullanıcı profili olarak hafızaya yazar (upsert)."""
    env = load_env()
    names = [_VIBE_TR.get(v, v) for v in (vibes or [])]
    likes = ", ".join(names) if names else "genel keşif"
    btxt = _BUDGET_TR.get(int(budget or 2), "orta bütçeli")
    content = f"Kullanıcı profili: {likes} temalı günleri seven, {btxt} bir İstanbul gezgini."
    vec = nvidia_embed(env, content, input_type="passage")
    sb_delete(env, "ai_memory_embeddings",
              {"owner_id": f"eq.{user_id}", "source_type": "eq.onboarding"})
    sb_insert(env, "ai_memory_embeddings", {
        "owner_id": user_id, "source_type": "onboarding", "content": content,
        "embedding": vec, "metadata": {"vibes": vibes, "budget": budget},
    })
    return {"ok": True, "profile": content}


def _load_profile(env: dict, user_id: str) -> dict | None:
    rows = sb_select(
        env, "ai_memory_embeddings",
        f"owner_id=eq.{user_id}&source_type=eq.onboarding&select=content,metadata&limit=1",
    )
    return rows[0] if rows else None


def _load_pref_events(env: dict, user_id: str, limit: int = 3) -> list[str]:
    """Son davranış hafızaları (favori/yolculuk/yorum) — 2.2."""
    q = (f"owner_id=eq.{user_id}&source_type=eq.preference_update"
         f"&select=content&order=created_at.desc&limit={limit}")
    try:
        rows = sb_select(env, "ai_memory_embeddings", q)
    except Exception:  # created_at yoksa sırasız al
        rows = sb_select(env, "ai_memory_embeddings", q.replace("&order=created_at.desc", ""))
    return [r.get("content") or "" for r in rows if r.get("content")]


_KIND_TR = {"favorite": "favorilerine ekledi", "journey": "yürüyüp tamamladı", "comment": "yorumladı"}


def save_memory_event(user_id: str, kind: str, route_id: str) -> dict:
    """Davranış hafızası (2.2): favori/yolculuk/yorum → preference_update embed'i."""
    env = load_env()
    r = get_route(env, route_id)
    if not r:
        return {"ok": False, "reason": "not_found"}
    tags = ", ".join(r.get("vibe_tags") or [])
    content = f"Kullanıcı '{r.get('title')}' rotasını {_KIND_TR.get(kind, kind)} (etiketler: {tags})."
    vec = nvidia_embed(env, content, input_type="passage")
    sb_insert(env, "ai_memory_embeddings", {
        "owner_id": user_id, "route_id": route_id, "source_type": "preference_update",
        "content": content, "embedding": vec, "metadata": {"kind": kind},
    })
    return {"ok": True, "content": content}


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


# --------------------------- AI Rota Üretici (2.7) ---------------------------
# Havuzda eşleşme yoksa (ya da kullanıcı isterse) LLM, GERÇEK Places adaylarından
# yepyeni bir rota kurar. Mekan uydurulamaz: composer yalnız aday index'i seçebilir.
# Semt niyete göre seçilir → tüm adaylar aynı semtten gelir → rota doğal yürünebilir.

_DISTRICTS: dict[str, list[dict]] = {
    "Istanbul": [
        {"name": "Kadıköy · Moda", "lat": 40.9819, "lng": 29.0250,
         "vibes": ["sakin", "deniz", "kahve", "yuruyus", "kafa-dinleme", "sosyal"]},
        {"name": "Balat", "lat": 41.0292, "lng": 28.9486,
         "vibes": ["tarih", "fotograf", "kesif", "sanat", "kahve"]},
        {"name": "Karaköy · Galata", "lat": 41.0256, "lng": 28.9744,
         "vibes": ["sanat", "kahve", "kultur", "gece", "fotograf"]},
        {"name": "Üsküdar", "lat": 41.0226, "lng": 29.0078,
         "vibes": ["tarih", "deniz", "manzara", "sakin"]},
        {"name": "Ortaköy", "lat": 41.0472, "lng": 29.0269,
         "vibes": ["deniz", "manzara", "sosyal", "gece"]},
        {"name": "Sultanahmet", "lat": 41.0054, "lng": 28.9768,
         "vibes": ["tarih", "kultur", "kalabalik"]},
        {"name": "Bebek · Arnavutköy", "lat": 41.0662, "lng": 29.0430,
         "vibes": ["deniz", "sakin", "yesil", "yuruyus"]},
    ],
    "Ankara": [
        {"name": "Kızılay · Tunalı", "lat": 39.9120, "lng": 32.8580,
         "vibes": ["kahve", "sosyal", "kalabalik"]},
        {"name": "Ulus · Hamamönü", "lat": 39.9403, "lng": 32.8560,
         "vibes": ["tarih", "kultur", "kesif", "fotograf"]},
        {"name": "Çankaya · Seğmenler", "lat": 39.8930, "lng": 32.8600,
         "vibes": ["yesil", "sakin", "yuruyus", "kafa-dinleme"]},
    ],
    "Gaziantep": [
        {"name": "Kale · Çarşı", "lat": 37.0640, "lng": 37.3820,
         "vibes": ["tarih", "kultur", "lezzet", "kesif", "kalabalik"]},
        {"name": "Bey Mahallesi", "lat": 37.0605, "lng": 37.3792,
         "vibes": ["tarih", "fotograf", "sakin"]},
        {"name": "100. Yıl", "lat": 37.0796, "lng": 37.3610,
         "vibes": ["yesil", "sakin", "yuruyus", "kafa-dinleme"]},
    ],
    "Izmir": [
        {"name": "Alsancak · Kordon", "lat": 38.4370, "lng": 27.1428,
         "vibes": ["deniz", "kahve", "sanat", "sosyal", "gece"]},
        {"name": "Konak · Kemeraltı", "lat": 38.4189, "lng": 27.1287,
         "vibes": ["tarih", "kultur", "kesif", "kalabalik"]},
        {"name": "Karataş", "lat": 38.4093, "lng": 27.1249,
         "vibes": ["manzara", "fotograf", "sakin", "deniz"]},
    ],
    "Bursa": [
        {"name": "Hanlar Bölgesi", "lat": 40.1846, "lng": 29.0610,
         "vibes": ["tarih", "kultur", "kesif", "kalabalik"]},
        {"name": "Yeşil · Irgandı", "lat": 40.1815, "lng": 29.0742,
         "vibes": ["tarih", "sakin", "fotograf"]},
        {"name": "Kültürpark", "lat": 40.1900, "lng": 29.0500,
         "vibes": ["yesil", "sakin", "yuruyus", "kafa-dinleme"]},
    ],
    "Mugla": [
        {"name": "Bodrum", "lat": 37.0344, "lng": 27.4305,
         "vibes": ["deniz", "gece", "sosyal", "manzara", "tarih"]},
        {"name": "Marmaris", "lat": 36.8552, "lng": 28.2742,
         "vibes": ["deniz", "yuruyus", "manzara", "doga"]},
        {"name": "Datça", "lat": 36.7276, "lng": 27.6873,
         "vibes": ["sakin", "deniz", "kafa-dinleme", "doga"]},
        {"name": "Fethiye", "lat": 36.6550, "lng": 29.1263,
         "vibes": ["deniz", "manzara", "fotograf", "tarih"]},
        {"name": "Akyaka", "lat": 37.0540, "lng": 28.3260,
         "vibes": ["sakin", "deniz", "yesil", "kafa-dinleme"]},
    ],
}


# Tüm-Türkiye desteği: 81 ilin ASCII kanonik adları. plan_route/detect-city şehir
# doğrulamasını buna karşı yapar — LLM halüsinasyonu ("çarşıda"→şehir) yine elenir,
# ama artık her gerçek il geçer (havuzda rota yoksa AI orada üretir).
_TR_PROVINCES = {
    "Adana", "Adiyaman", "Afyonkarahisar", "Agri", "Amasya", "Ankara", "Antalya", "Artvin",
    "Aydin", "Balikesir", "Bilecik", "Bingol", "Bitlis", "Bolu", "Burdur", "Bursa",
    "Canakkale", "Cankiri", "Corum", "Denizli", "Diyarbakir", "Edirne", "Elazig",
    "Erzincan", "Erzurum", "Eskisehir", "Gaziantep", "Giresun", "Gumushane", "Hakkari",
    "Hatay", "Isparta", "Mersin", "Istanbul", "Izmir", "Kars", "Kastamonu", "Kayseri",
    "Kirklareli", "Kirsehir", "Kocaeli", "Konya", "Kutahya", "Malatya", "Manisa",
    "Kahramanmaras", "Mardin", "Mugla", "Mus", "Nevsehir", "Nigde", "Ordu", "Rize",
    "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Tekirdag", "Tokat", "Trabzon",
    "Tunceli", "Sanliurfa", "Usak", "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt",
    "Karaman", "Kirikkale", "Batman", "Sirnak", "Bartin", "Ardahan", "Igdir", "Yalova",
    "Karabuk", "Kilis", "Osmaniye", "Duzce",
}

_TR_ASCII = str.maketrans("çğıöşüÇĞİÖŞÜâî", "cgiosuCGIOSUai")


def norm_city(raw: str | None) -> str | None:
    """Serbest şehir metnini DB'deki ASCII kanonik ada çevirir (İzmir→Izmir,
    Çanakkale→Canakkale). İlçe adları ve yaygın kısaltmalar iline çözülür
    (Datça→Mugla, Urfa→Sanliurfa) — 'Datça vakası' kalıcı çözümü."""
    if not raw:
        return None
    c = raw.casefold()
    if "stanbul" in c:
        return "Istanbul"
    if "antep" in c:
        return "Gaziantep"
    if "zmir" in c:
        return "Izmir"
    if any(x in c for x in ("muğla", "mugla", "datça", "datca", "bodrum", "marmaris", "fethiye", "akyaka")):
        return "Mugla"
    if "afyon" in c:
        return "Afyonkarahisar"
    if "urfa" in c:
        return "Sanliurfa"
    if "maraş" in c or "maras" in c:
        return "Kahramanmaras"
    if "içel" in c or "icel" in c:
        return "Mersin"
    base = raw.strip().split("'")[0].split("’")[0].strip()  # "Çanakkale'de" → "Çanakkale"
    return base.title().translate(_TR_ASCII) if base else None

_VIBE_QUERIES = {
    "sakin": ["sakin park", "manzaralı çay bahçesi"],
    "kafa-dinleme": ["sakin kahve dükkanı", "sahil parkı"],
    "tarih": ["tarihi yer", "tarihi cami"],
    "kultur": ["müze", "sanat galerisi"],
    "sanat": ["sanat galerisi", "bağımsız kitabevi"],
    "deniz": ["sahil yürüyüş yolu", "iskele"],
    "manzara": ["seyir terası", "manzara noktası"],
    "kahve": ["üçüncü dalga kahveci"],
    "yesil": ["park", "koru"],
    "gece": ["gece manzarası", "canlı cadde"],
    "yuruyus": ["yürüyüş yolu", "seyir noktası"],
    "sosyal": ["popüler kafe", "çarşı"],
    "fotograf": ["renkli sokaklar", "fotoğraf noktası"],
    "kesif": ["antikacılar", "yerel çarşı"],
    "butce-dostu": ["ucuz yerel lokanta"],
}
_GENERIC_QUERIES = ["kahve dükkanı", "park", "manzara noktası", "tarihi yer"]

_PRICE_ENUM = {"PRICE_LEVEL_FREE": 0, "PRICE_LEVEL_INEXPENSIVE": 1, "PRICE_LEVEL_MODERATE": 2,
               "PRICE_LEVEL_EXPENSIVE": 3, "PRICE_LEVEL_VERY_EXPENSIVE": 4}

# Üretici SADECE seçim+sıra yapar (dar iş = güvenilir JSON); anlatı ve kategoriyi
# kanıtlanmış ENRICH_SYS (Rota Ortak-Yazarı) ikinci aşamada yazar.
GENERATOR_SYS = (
    "Sen SANA'nın rota mimarısın. Kullanıcının niyeti ve şehirden GERÇEK mekan adayları "
    "(index'li) verilir. SADECE adaylardan seçim yap; mekan UYDURMA.\n"
    "Kurallar:\n"
    "1. 4-6 FARKLI aday seç; koordinatlara bakarak yürüme sırasına koy (zikzak yapma).\n"
    "2. Çeşitlilik: aynı türden en fazla 2 durak (hepsi kafe olmasın).\n"
    "3. Bütçe sınırına uy; puanı yüksek adayları tercih et.\n"
    "4. BAŞLIK KURALI: Kullanıcının cümlesinde geçen şehir/yer adını başlığa KOYMA "
    "(rota oraya kurulmuyor olabilir); başlıkta yalnız adayların bulunduğu semti kullanabilirsin.\n"
    "5. SADECE şu JSON ile dön:\n"
    '{"title": string (kısa, davetkar; semt adı geçebilir), "description": string (1-2 cümle), '
    '"vibe_tags": string[] (3-5 kısa Türkçe etiket), "weather_fit": "indoor"|"outdoor"|"any", '
    '"budget_level": 1-4, "stops": [integer (aday index, yürüme sırasında)]}'
)


def _pick_district(city: str, vibe_tags: list, mood: str) -> dict:
    """Şehrin semtlerinden niyet vibe'larıyla en çok örtüşeni; eşitlikte rastgele (çeşitlilik)."""
    pool = _DISTRICTS.get(city) or _DISTRICTS["Istanbul"]
    wanted = set(vibe_tags or []) | ({mood} if mood else set())
    scored = [(len(wanted & set(d["vibes"])), d) for d in pool]
    best = max(s for s, _ in scored)
    return random.choice([d for s, d in scored if s == best])


def _gather_candidates(env: dict, district: dict, vibe_tags: list, mood: str) -> list[dict]:
    """Semt merkezine bias'lı en fazla 4 Places sorgusu → tekil aday havuzu."""
    queries: list[str] = []
    for v in (vibe_tags or []) + ([mood] if mood else []):
        queries += _VIBE_QUERIES.get(v, [])
    seen_q: set = set()
    q_final: list[str] = []
    for q in queries + _GENERIC_QUERIES:
        if q not in seen_q:
            seen_q.add(q)
            q_final.append(q)
        if len(q_final) >= 4:
            break
    cands: list[dict] = []
    seen_ids: set = set()
    for q in q_final:
        for p in google_places_search(env, q, district["lat"], district["lng"]):
            if p["place_id"] in seen_ids:
                continue
            # locationBias kesin filtre değil — semtten uzak sonuçlar rotayı yürünemez yapar
            if _haversine_m(district["lat"], district["lng"], p["lat"], p["lng"]) > 4000:
                continue
            seen_ids.add(p["place_id"])
            cands.append(p)
    return cands


def _generate_route(env: dict, text: str, intent: dict, weather: dict, budget_max: int,
                    user_id: str | None, profile_text: str, _mark, city: str = "Istanbul",
                    gen_center: tuple | None = None, gen_district: str | None = None) -> dict | None:
    """Yepyeni rota üret + kalıcılaştır + zenginleştir. Başarısızsa None (çağıran no_match döner).
    Merkez önceliği: kullanıcı konumu > seçilen semt > AI semt seçimi (2.7b; 3.0c şehir-bazlı)."""
    if gen_center:
        district = {"name": "konumunun çevresi", "lat": gen_center[0], "lng": gen_center[1], "vibes": []}
    elif gen_district:
        district = next((d for d in _DISTRICTS.get(city, []) if d["name"] == gen_district), None) \
            or _pick_district(city, intent.get("vibe_tags") or [], intent.get("mood") or "")
    elif city not in _DISTRICTS:
        # Tüm-Türkiye: semt haritası olmayan ilde merkez Geocoding'den bulunur —
        # seed/elle şehir ekleme gerekmez, AI her ilde üretebilir
        lat, lng = city_coords(env, city)
        district = {"name": f"{city} merkezi", "lat": lat, "lng": lng, "vibes": []}
    else:
        district = _pick_district(city, intent.get("vibe_tags") or [], intent.get("mood") or "")
    cands = _gather_candidates(env, district, intent.get("vibe_tags") or [], intent.get("mood") or "")
    _mark("Mekânlar arandı", f"{len(cands)} gerçek aday · {district['name']}")
    if len(cands) < 4:
        return None

    lines = []
    for i, c in enumerate(cands):
        price = _PRICE_ENUM.get(c.get("price_level") or "", None)
        lines.append(
            f"{i}. {c['name']} | tür: {','.join(c['types'][:3]) or '?'} | puan: {c.get('rating') or '?'}"
            f" | fiyat: {price if price is not None else '?'} | ({c['lat']:.4f},{c['lng']:.4f})"
        )
    gen_input = {
        "niyet": intent, "kullanici_profili": profile_text or "bilinmiyor",
        "hava": weather, "butce_siniri": budget_max, "adaylar": lines,
    }
    gen = None
    for temp in (0.7, 0.4):  # ilk deneme yaratıcı; bozuk JSON'da daha soğuk tekrar
        try:
            raw = nvidia_chat(env, GENERATOR_SYS, json.dumps(gen_input, ensure_ascii=False),
                              json_mode=True, temperature=temp, max_tokens=500, timeout=35)
            d = json.loads(raw)
            picks = []
            seen_i: set = set()
            for i in d.get("stops") or []:
                if isinstance(i, int) and 0 <= i < len(cands) and i not in seen_i:
                    seen_i.add(i)
                    picks.append(cands[i])
            picks = picks[:6]  # model fazla seçtiyse kırp (fail etme)
            if len(picks) >= 4 and d.get("title"):
                gen = (d, picks)
                break
        except Exception:  # noqa: BLE001 — ikinci turda tekrar dener
            continue
    if not gen:
        return None
    d, picks = gen
    _mark("Yeni rota kuruldu", f"{len(picks)} durak · {d['title']}")

    # Anlatı + kategori: kanıtlanmış Rota Ortak-Yazarı (enrich_route) ile
    enriched = enrich_route([{"name": c["name"], "note": None} for c in picks])
    e_stops = enriched.get("stops") or []

    # Kalıcılaştır: yazar = isteyen kullanıcı (yoksa seed hesabı)
    author = user_id
    if not author:
        rows = sb_select(env, "routes", "select=author_id&limit=1")
        author = rows[0]["author_id"] if rows else None
    if not author:
        return None
    try:
        budget = int(d.get("budget_level") or 2)
    except (TypeError, ValueError):
        budget = 2
    route_row = sb_insert(env, "routes", {
        "author_id": author, "title": d["title"], "description": d.get("description") or "",
        "city": city, "vibe_tags": (d.get("vibe_tags") or [])[:5],
        "weather_fit": d.get("weather_fit") if d.get("weather_fit") in ("indoor", "outdoor", "any") else "any",
        "budget_level": min(max(budget, 1), 4), "is_seed": False,
        "is_public": False,  # 3.13: üretilen rota da ÖZEL başlar; kullanıcı paylaşınca açılır
    })[0]
    rid = route_row["id"]
    wp_rows = []
    for seq, c in enumerate(picks):
        e = e_stops[seq] if seq < len(e_stops) and isinstance(e_stops[seq], dict) else {}
        photo = google_photo_url(env, c.get("photo_name"))  # foto adı elimizde: tek media çağrısı
        wp_rows.append({
            "route_id": rid, "seq": seq, "name": c["name"], "lat": c["lat"], "lng": c["lng"],
            "category": e.get("category") or "other", "kind": "experience",
            "note": e.get("narrative") or "", "place_id": c.get("place_id"),
            "transport_mode": "start" if seq == 0 else "walk",
            "photo_urls": [photo] if photo else [],
            "metadata": {"rating": c["rating"]} if c.get("rating") is not None else {},
        })
    sb_insert(env, "waypoints", wp_rows)
    cover = next((w["photo_urls"][0] for w in wp_rows if w["photo_urls"]), None)
    if cover:
        sb_patch(env, "routes", {"id": f"eq.{rid}"}, {"cover_photo_url": cover})

    # Mevcut zincir: sokak geometrisi + hafızaya embed (foto/puan yukarıda yazıldı)
    try:
        route_geometry(rid)
    except Exception:  # noqa: BLE001 — geometri süs; rota yine döner
        pass
    try:
        embed_route(rid)
    except Exception:  # noqa: BLE001
        pass
    _mark("Zenginleştirildi", "foto + sokak geometrisi + hafıza")

    chosen = get_route(env, rid)
    exp = [w for w in sorted(chosen.get("waypoints", []), key=lambda w: w.get("seq", 0))
           if w.get("kind") == "experience"]
    ai = {
        "title": d["title"],
        "summary": d.get("description") or "",
        "weather_note": None,
        "budget_note": BUDGET_LABELS.get(chosen.get("budget_level"), "uygun"),
        "stops": [{"seq": i, "name": w["name"], "narrative": w.get("note") or ""}
                  for i, w in enumerate(exp)],
        "social_signal": "Bu rota az önce senin için üretildi — ilk yürüyen sen olabilirsin.",
    }
    return {"route": chosen, "ai": ai}


def plan_route(text: str, user_id: str | None = None, force_weather_fit: str | None = None,
               force_generate: bool = False, gen_center: tuple | None = None,
               gen_district: str | None = None, app_city: str | None = None) -> dict:
    env = load_env()

    # Agent adımları: her aşamanın süresi + tek satır özeti (app bekleme ekranı + jüri için)
    steps: list[dict] = []
    _t = [time.perf_counter()]

    def _mark(name: str, note: str = "") -> None:
        now = time.perf_counter()
        steps.append({"name": name, "ms": int((now - _t[0]) * 1000), "note": note})
        _t[0] = now

    # [1] Intent
    intent = parse_intent(env, text)
    _mark("Niyet çözümlendi", f"{intent.get('mood') or 'genel'} · bütçe {intent.get('budget_max')}")
    # Şehir çözümü (3.0c): cümlede AÇIKÇA İstanbul-dışı BİLİNEN bir şehir geçiyorsa o kazanır;
    # yoksa app'in aktif şehri; en son Istanbul. Bilinmeyen ad = LLM halüsinasyonu sayılır
    # (örn. "çarşıda"yı şehir sanabiliyor) ve yok sayılır.
    intent_city = norm_city(intent.get("city"))
    if intent_city not in _TR_PROVINCES:  # gerçek il değilse LLM halüsinasyonu say
        intent_city = None
    app_city_n = norm_city(app_city)
    if app_city_n not in _TR_PROVINCES:
        app_city_n = None
    if intent_city and intent_city != "Istanbul":
        city = intent_city
    else:
        city = app_city_n or intent_city or "Istanbul"
    try:
        budget_max = int(intent.get("budget_max") or 4)
    except (TypeError, ValueError):
        budget_max = 4

    # [1b] Kullanıcı hafızası: onboarding profili + son davranışlar (2.1 + 2.2)
    profile = None
    pref_notes: list[str] = []
    if user_id:
        try:
            profile = _load_profile(env, user_id)
            pref_notes = _load_pref_events(env, user_id)
        except Exception:  # noqa: BLE001 — hafıza okunamazsa kişiselleştirmesiz devam
            profile, pref_notes = None, []
    profile_text = (profile or {}).get("content") or ""
    if pref_notes:
        profile_text = (profile_text + " Son davranışları: " + " ".join(pref_notes)).strip()
    prof_budget = ((profile or {}).get("metadata") or {}).get("budget")
    # Kullanıcı cümlede bütçe belirtmediyse (varsayılan 4) profil bütçesini uygula
    if profile and budget_max >= 4 and prof_budget:
        budget_max = {1: 2, 2: 3, 3: 4}.get(int(prof_budget), 4)
    _note = "profil yok"
    if profile and pref_notes:
        _note = f"profil + {len(pref_notes)} davranış"
    elif profile:
        _note = "profil bulundu"
    elif pref_notes:
        _note = f"{len(pref_notes)} davranış"
    _mark("Hafıza tarandı", _note)

    # [2] Data: hava
    weather = get_weather(env, city) or {"bias": "any", "desc": "", "temp": None, "rainy": False}
    _mark("Hava kontrol edildi",
          f"{weather.get('temp')}° {weather.get('desc', '')}".strip() if weather.get("temp") is not None else "veri yok")

    def _generated_response() -> dict | None:
        """2.7: yepyeni rota üret; başarılıysa plan_route ile aynı şekilde yanıt döndür."""
        g = _generate_route(env, text, intent, weather, budget_max, user_id, profile_text, _mark,
                            city, gen_center, gen_district)
        if not g:
            return None
        return {
            "ok": True, "generated": True,
            "intent": intent, "weather": weather,
            "route_id": g["route"].get("id"), "route": g["route"], "ai": g["ai"],
            "personalized": bool(profile or pref_notes), "profile": profile_text or None,
            "forced_fit": None, "steps": steps,
        }

    # [2b] Kullanıcı açıkça yeni rota istedi (🎲) → eşleştirmeyi atla, üret
    if force_generate:
        res = _generated_response()
        if res:
            return res
        # üretim başarısızsa normal eşleştirmeye düş (aşağıda devam)

    # [3] Social Memory: niyet + profil birlikte embed'lenir → match_routes
    qtext = f"{intent.get('mood','')} {' '.join(intent.get('vibe_tags', []))} {text} {profile_text}".strip()
    emb = nvidia_embed(env, qtext, input_type="query")
    candidates = match_routes(env, emb, match_count=5, filter_city=city, max_budget=budget_max)
    _mark("Rotalar eşleştirildi", f"{len(candidates)} aday")
    if not candidates:
        # 2.7 akıllı tetik: havuz boş kaldıysa yepyeni rota üretmeyi dene
        res = _generated_response()
        if res:
            return res
        return {"ok": False, "reason": "no_match", "intent": intent, "weather": weather, "steps": steps}

    # [4] Budget/Logistics: hava biası (+ kullanıcı "kapalı alternatif" istediyse ZORLAMALI filtre)
    bias = weather.get("bias", "any")
    pref = force_weather_fit or intent.get("indoor_outdoor_pref", "any")

    def _pick(allowed_fits: set | None):
        for c in candidates:
            r = get_route(env, c["route_id"])
            if not r:
                continue
            # 3.13: ÖZEL rota yalnız sahibine önerilebilir (service RLS bypass'ı deler; elle koru)
            if r.get("is_public") is False and r.get("author_id") != user_id:
                continue
            fit = r.get("weather_fit", "any")
            if allowed_fits is not None and fit not in allowed_fits:
                continue
            if allowed_fits is None:
                if bias == "indoor" and fit == "outdoor":
                    continue
                if pref == "indoor" and fit == "outdoor":
                    continue
            r["_similarity"] = c.get("similarity")
            return r
        return None

    if force_weather_fit == "indoor":
        chosen = _pick({"indoor"}) or _pick({"indoor", "any"})  # önce tam kapalı, sonra "any"
    else:
        chosen = _pick(None)
    if chosen is None:
        chosen = get_route(env, candidates[0]["route_id"])
        chosen["_similarity"] = candidates[0].get("similarity")

    wps = sorted(chosen.get("waypoints", []), key=lambda w: w.get("seq", 0))
    exp = [w for w in wps if w.get("kind") == "experience"]
    _mark("Rota seçildi", f"{chosen.get('title') or ''} · {chosen.get('weather_fit', 'any')}"
          + (" · kapalı zorlandı" if force_weather_fit else ""))

    # [5] Flood Composer
    composer_input = {
        "niyet": intent,
        "kullanici_profili": profile_text or "bilinmiyor",
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
    _mark("Anlatı yazıldı", "yedek anlatı" if ai.get("_fallback") else f"{len(ai.get('stops', []))} durak")

    return {
        "ok": True,
        "intent": intent,
        "weather": weather,
        "route_id": chosen.get("id"),
        "route": chosen,
        "ai": ai,
        "personalized": bool(profile or pref_notes),
        "profile": profile_text or None,
        "forced_fit": force_weather_fit,
        "steps": steps,
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


# --------------------------- Topluluk yorum özeti (2.4) ---------------------------
SUMMARY_SYS = (
    "Sen SANA'nın topluluk özetleyicisisin. Sana bir rotanın kullanıcı yorumları verilir. "
    "SADECE şu JSON'u döndür, başka metin yazma:\n"
    '{"summary": string (Türkçe, en fazla 2 sıcak cümle, yorumların ortak hissini ver), '
    '"tags": string[] (tam 3 kısa Türkçe etiket, örn. "manzara", "kalabalık", "uygun fiyat")}'
)

_SUMMARY_CACHE: dict = {}  # route_id → (timestamp, sonuç); TTL 1 saat


def summarize_comments(route_id: str) -> dict:
    now = time.time()
    hit = _SUMMARY_CACHE.get(route_id)
    if hit and now - hit[0] < 3600:
        return hit[1]
    env = load_env()
    rows = sb_select(env, "flood_comments",
                     f"route_id=eq.{route_id}&select=body,rating&order=created_at.desc&limit=20")
    bodies = [r for r in rows if (r.get("body") or "").strip()]
    if len(bodies) < 3:
        res = {"ok": False, "reason": "not_enough_comments", "count": len(bodies)}
    else:
        text = "\n".join(
            f"- {r['body']}" + (f" (puan: {r['rating']}/5)" if r.get("rating") else "")
            for r in bodies
        )
        try:
            raw = nvidia_chat(env, SUMMARY_SYS, text, json_mode=True, temperature=0.4, max_tokens=200)
            d = json.loads(raw)
            res = {"ok": True, "summary": d.get("summary", ""), "tags": (d.get("tags") or [])[:3],
                   "count": len(bodies)}
        except Exception:  # noqa: BLE001
            res = {"ok": False, "reason": "llm_error"}
    _SUMMARY_CACHE[route_id] = (now, res)
    return res


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


# --------------------------- Foto zenginleştirme (3.2a) ---------------------------
def enrich_photos(route_id: str) -> dict:
    """Fotosuz deneyim duraklarına Places (New) fotoğrafı + puanı yazar (idempotent:
    fotolu duraklar atlanır). Rota kapağı boşsa ilk bulunan fotoğraf kapak yapılır."""
    env = load_env()
    r = get_route(env, route_id)
    if not r:
        return {"ok": False, "reason": "not_found"}
    wps = sorted(r.get("waypoints", []), key=lambda w: w.get("seq", 0))
    exp = [w for w in wps if w.get("kind") == "experience"]
    updated = 0
    cover = r.get("cover_photo_url")
    for w in exp:
        if w.get("photo_urls"):
            cover = cover or w["photo_urls"][0]
            continue
        info = google_place_lookup(env, w.get("name") or "", w["lat"], w["lng"])
        if not info:
            continue
        photo = google_photo_url(env, info.get("photo_name"))
        patch: dict = {}
        if photo:
            patch["photo_urls"] = [photo]
        if info.get("place_id") and not w.get("place_id"):
            patch["place_id"] = info["place_id"]
        if info.get("rating") is not None:
            md = dict(w.get("metadata") or {})
            md["rating"] = info["rating"]
            patch["metadata"] = md  # RouteFlood ⭐ bunu okur (getRating)
        if not patch:
            continue
        sb_patch(env, "waypoints", {"id": f"eq.{w['id']}"}, patch)
        updated += 1
        cover = cover or photo
    cover_set = bool(cover and not r.get("cover_photo_url"))
    if cover_set:
        sb_patch(env, "routes", {"id": f"eq.{route_id}"}, {"cover_photo_url": cover})
    return {"ok": True, "updated": updated, "cover_set": cover_set}


# --------------------------- Mekan araması (durak ekleme) ---------------------------
def search_places(q: str, city: str | None = None) -> list[dict]:
    """Durak ekleme araması — Google Places (New), AKTİF ŞEHİR merkezine bias'lı.
    (Eski hali Photon/SerpApi + sabit İstanbul merkeziydi: Ankara'da 'Anıtkabir' saçmalıyordu.)"""
    env = load_env()
    c = norm_city(city) or "Istanbul"
    lat, lng = city_coords(env, c)  # bilinmeyen il → Geocoding il merkezi (tüm-Türkiye)
    out = []
    for p in google_places_search(env, q, lat, lng, radius_m=25000.0, limit=6):
        out.append({
            "name": p["name"], "lat": p["lat"], "lng": p["lng"],
            "place_id": p.get("place_id"), "address": p.get("address"),
            "rating": p.get("rating"),
            "type": (p.get("types") or [None])[0],
            # küçük önizleme — CreateRoute thumbnail'ı için (kalıcı URL, key sızmaz)
            "thumbnail": google_photo_url(env, p.get("photo_name"), max_w=400),
            "price": None,
        })
    return out


# --------------------------- Rota geometrisi (Google Routes) ---------------------------
# Yürüme bacakları: gerçek sokak geometrisi + gerçek süre (Routes API, yazım anında BİR KEZ).
# Transit bacaklar (vapur/metro...): düz hat kalır; süre = mesafe/250m-dk + 3 dk bekleme.

def _haversine_m(a_lat, a_lng, b_lat, b_lng) -> int:
    import math
    R = 6371000
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = math.radians(b_lat - a_lat), math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return round(2 * R * math.asin(math.sqrt(h)))


_WALKISH = {"walk", "start", "other"}


def route_geometry(route_id: str) -> dict:
    """Rotanın ardışık deneyim durakları arasına gerçek yürüme geometrisi yazar.
    waypoints.leg_geometry/leg_distance_m/leg_duration_min doldurulur;
    routes.total_distance_m/total_duration_min gerçek verilerle güncellenir."""
    env = load_env()
    r = get_route(env, route_id)
    if not r:
        return {"ok": False, "reason": "not_found"}
    wps = sorted(r.get("waypoints", []), key=lambda w: w.get("seq", 0))
    exp = [w for w in wps if w.get("kind") == "experience"]
    if len(exp) < 2:
        return {"ok": False, "reason": "too_few_stops"}

    legs_updated = 0
    total_dist = 0
    total_dur = 0
    for i in range(1, len(exp)):
        prev, cur = exp[i - 1], exp[i]
        mode = (cur.get("transport_mode") or "walk").lower()
        if mode in _WALKISH:
            leg = google_walk_leg(env, prev["lat"], prev["lng"], cur["lat"], cur["lng"])
            if leg and leg["coords"]:
                sb_patch(env, "waypoints", {"id": f"eq.{cur['id']}"}, {
                    "leg_geometry": leg["coords"],
                    "leg_distance_m": leg["distance_m"],
                    "leg_duration_min": leg["duration_min"],
                })
                total_dist += leg["distance_m"]
                total_dur += leg["duration_min"]
                legs_updated += 1
                continue
        # transit ya da Routes başarısız → düz hat tahmini
        d = _haversine_m(prev["lat"], prev["lng"], cur["lat"], cur["lng"])
        total_dist += d
        total_dur += (round(d / 250) + 3) if mode not in _WALKISH else max(1, round(d / 80))

    # Durak başına ~20 dk deneyim süresi ekle (gezme/oturma), toplamları güncelle
    total_dur += len(exp) * 20
    sb_patch(env, "routes", {"id": f"eq.{route_id}"}, {
        "total_distance_m": total_dist,
        "total_duration_min": total_dur,
    })
    return {"ok": True, "legs_updated": legs_updated,
            "total_distance_m": total_dist, "total_duration_min": total_dur}


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
