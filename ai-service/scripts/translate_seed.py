"""SANA seed çevirisi — seed_routes.json (TR) → seed_routes_en.json (EN).

Yalnız ANLATI çevrilir: title, description, waypoint.note, transport_note.
Mekân adı (name), koordinat, place_id, foto, kategori, etiketler AYNEN kalır
(harita doğruluğu + gerçek yer adları korunur).

Rota başına TEK NVIDIA chat çağrısı (JSON in/out) → hızlı + kota dostu.
Sonuçlar diske cache'lenir (kaynak metin değişmedikçe tekrar çağrılmaz).

Çalıştır:  py ai-service/scripts/translate_seed.py
"""
from __future__ import annotations

import copy
import hashlib
import json
import os

from sana_seed_lib import SEED_JSON, load_env, nvidia_chat

SEED_EN = os.path.join(os.path.dirname(SEED_JSON), "seed_routes_en.json")
CACHE_DIR = os.path.join(os.path.dirname(SEED_JSON), "cache_en")

SYSTEM = (
    "You are a professional travel-content translator. Translate the given JSON "
    "from Turkish to natural, fluent English. Rules:\n"
    "1) Return ONLY a JSON object with the SAME keys and SAME array lengths/order.\n"
    "2) Keep as-is ONLY genuine proper names of places: neighborhoods, districts, "
    "cities, streets, named venues (e.g. Kadıköy, Moda, Balat, Ortaköy, Kordon, Tunalı, "
    "Koza Han, CerModern). Do NOT keep common/descriptive words untranslated.\n"
    "3) TITLES are descriptive themes — translate every descriptive word fully, keeping "
    "only the proper place name. Examples:\n"
    "   'Ortaköy Boğaz Esintisi' → 'Ortaköy Bosphorus Breeze'\n"
    "   'Datça Sakin Koylar' → 'Datça Quiet Coves'  (koy = cove/bay, NOT town)\n"
    "   '100. Yıl Parkı Nefes' → 'A Breather at 100. Yıl Park'\n"
    "   'Kuğulu Park & Tunalı Keyfi' → 'Kuğulu Park & Tunalı Delight'\n"
    "   'Hanlar Bölgesi & Koza Han' → 'The Hans District & Koza Han'\n"
    "4) Translate common nouns everywhere (badem→almond, koy→cove, çeşme→fountain, "
    "nefes→a breather, esinti→breeze).\n"
    "5) Well-known landmarks may use their common English name inside prose if unambiguous "
    "(Ayasofya→Hagia Sophia, Sultanahmet Camii→Blue Mosque).\n"
    "6) Tone: warm, concise, second person — like a friend's travel tip. No emojis.\n"
    "7) Empty strings stay empty strings."
)


def _payload(route: dict) -> dict:
    return {
        "title": route["title"],
        "description": route.get("description") or "",
        "notes": [w.get("note") or "" for w in route["waypoints"]],
        "transport_notes": [w.get("transport_note") or "" for w in route["waypoints"]],
    }


def _cache_path(payload: dict) -> str:
    h = hashlib.sha1(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()[:16]
    return os.path.join(CACHE_DIR, h + ".json")


def translate_route(env: dict, route: dict) -> dict:
    src = _payload(route)
    cache_file = _cache_path(src)
    if os.path.exists(cache_file):
        with open(cache_file, encoding="utf-8") as f:
            out = json.load(f)
    else:
        raw = nvidia_chat(env, SYSTEM, json.dumps(src, ensure_ascii=False), json_mode=True)
        out = json.loads(raw)
        os.makedirs(CACHE_DIR, exist_ok=True)
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)

    # Güvenli birleştirme: dizi uzunluğu tutmuyorsa orijinale düş
    en = copy.deepcopy(route)
    en["title"] = out.get("title") or route["title"]
    if route.get("description"):
        en["description"] = out.get("description") or route["description"]
    notes = out.get("notes") or []
    tnotes = out.get("transport_notes") or []
    for i, w in enumerate(en["waypoints"]):
        if i < len(notes) and notes[i]:
            w["note"] = notes[i]
        if w.get("transport_note") and i < len(tnotes) and tnotes[i]:
            w["transport_note"] = tnotes[i]
    return en


def main():
    env = load_env()
    if not env.get("NVIDIA_API_KEY"):
        raise SystemExit("NVIDIA_API_KEY yok (ai-service/.env kontrol et).")
    with open(SEED_JSON, encoding="utf-8") as f:
        routes = json.load(f)
    print(f"{len(routes)} rota çevriliyor (TR→EN)...")

    out = []
    for r in routes:
        en = translate_route(env, r)
        out.append(en)
        print(f"  [ok] {r['title']}  →  {en['title']}")

    with open(SEED_EN, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"\nTamam: {len(out)} EN rota -> {SEED_EN}")


if __name__ == "__main__":
    main()
