"""SANA seed üretici — tematik İstanbul gezi rotalarını SerpApi ile gerçek
mekanlara bağlar, supabase/seed/seed_routes.json üretir.

Çalıştır:  py ai-service/scripts/build_seed.py
SerpApi yanıtları cache'lenir → tekrar çalıştırınca kota harcanmaz.
"""
from __future__ import annotations

import json

from sana_seed_lib import (
    SEED_JSON, best_place, haversine_m, load_env, price_to_level, serpapi_search,
)

# Her rota: tematik bir gün. stops = sıralı duraklar.
# kind: experience (yaşanan durak) | utility (WC/dinlenme/çeşme — yardımcı pin)
TEMPLATES = [
    {
        "title": "Kadıköy Sakin Gün",
        "city": "Istanbul",
        "vibe_tags": ["sakin", "kafa-dinleme", "butce-dostu"],
        "weather_fit": "any",
        "ll": "@40.9901,29.0270,15z",
        "stops": [
            {"q": "Moda Sahili Kadıköy", "category": "waterfront", "kind": "experience", "note": "Denize karşı yavaş bir yürüyüşle başla."},
            {"q": "Mephisto Kitabevi Kadıköy", "category": "bookstore", "kind": "experience", "note": "Raflar arasında kaybol, bir kitap karıştır."},
            {"q": "üçüncü dalga kahve Moda", "category": "cafe", "kind": "experience", "note": "Sessiz bir köşede filtre kahveni yudumla."},
            {"q": "Moda Parkı", "category": "park", "kind": "experience", "note": "Banka otur, biraz nefeslen."},
            {"q": "halka açık tuvalet Kadıköy", "category": "public_toilet", "kind": "utility", "note": "Yol üstünde ücretsiz/halka açık WC."},
        ],
    },
    {
        "title": "Sultanahmet Tarih Yürüyüşü",
        "city": "Istanbul",
        "vibe_tags": ["kultur", "tarih", "fotograf"],
        "weather_fit": "any",
        "ll": "@41.0054,28.9768,15z",
        "stops": [
            {"q": "Ayasofya", "category": "historical_site", "kind": "experience", "note": "Yüzyılların izini taşıyan kubbenin altında dur."},
            {"q": "Sultanahmet Camii", "category": "mosque", "kind": "experience", "note": "Mavi çinilerin huzurunu hisset."},
            {"q": "Yerebatan Sarnıcı", "category": "historical_site", "kind": "experience", "note": "Serin, loş sarnıçta sessizliği dinle."},
            {"q": "Gülhane Parkı", "category": "park", "kind": "experience", "note": "Tarihi surların yanında dinlen."},
            {"q": "halka açık tuvalet Sultanahmet", "category": "public_toilet", "kind": "utility", "note": "Park çıkışı ücretsiz WC."},
        ],
    },
    {
        "title": "Balat Renkli Sokaklar",
        "city": "Istanbul",
        "vibe_tags": ["fotograf", "kesif", "sakin"],
        "weather_fit": "outdoor",
        "ll": "@41.0294,28.9489,15z",
        "stops": [
            {"q": "Balat renkli evler", "category": "viewpoint", "kind": "experience", "note": "Rengârenk cepheler arasında fotoğraf çek."},
            {"q": "Fener Rum Patrikhanesi", "category": "church", "kind": "experience", "note": "Mahallenin tarihli dokusuna bir uğra."},
            {"q": "antikacı Balat", "category": "gallery", "kind": "experience", "note": "Eski eşyalar arasında küçük hazineler bul."},
            {"q": "kafe Balat", "category": "cafe", "kind": "experience", "note": "Sokak aralarında mütevazı bir kahve molası."},
            {"q": "çeşme Balat", "category": "water_fountain", "kind": "utility", "note": "Tarihi çeşme — su molası."},
        ],
    },
    {
        "title": "Ortaköy Boğaz Esintisi",
        "city": "Istanbul",
        "vibe_tags": ["acik-hava", "manzara", "sosyal"],
        "weather_fit": "outdoor",
        "ll": "@41.0470,29.0096,15z",
        "stops": [
            {"q": "Ortaköy Camii", "category": "mosque", "kind": "experience", "note": "Köprü manzarasıyla simgeleşmiş duruş."},
            {"q": "Ortaköy sahil", "category": "waterfront", "kind": "experience", "note": "Boğaz kıyısında martıları seyret."},
            {"q": "Ortaköy kumpir", "category": "street_food", "kind": "experience", "note": "Klasik kumpir + boğaz = tam isabet."},
            {"q": "kafe Ortaköy manzara", "category": "cafe", "kind": "experience", "note": "Manzaraya karşı kahveyle bitir."},
            {"q": "halka açık tuvalet Ortaköy", "category": "public_toilet", "kind": "utility", "note": "Meydan civarı ücretsiz WC."},
        ],
    },
    {
        "title": "Galata & Beyoğlu Kültür Turu",
        "city": "Istanbul",
        "vibe_tags": ["kultur", "sanat", "kalabalik"],
        "weather_fit": "any",
        "ll": "@41.0256,28.9744,15z",
        "stops": [
            {"q": "Galata Kulesi", "category": "viewpoint", "kind": "experience", "note": "Şehrin çatılarına tepeden bak."},
            {"q": "SALT Galata", "category": "gallery", "kind": "experience", "note": "Çağdaş sergilerde biraz oyalan."},
            {"q": "kitapçı İstiklal Caddesi", "category": "bookstore", "kind": "experience", "note": "İstiklal'de bir kitap molası."},
            {"q": "üçüncü dalga kahve Galata", "category": "cafe", "kind": "experience", "note": "Daracık sokakta sakin bir kahve."},
            {"q": "halka açık tuvalet Beyoğlu", "category": "public_toilet", "kind": "utility", "note": "Cadde üstü ücretsiz WC."},
        ],
    },
    {
        "title": "Vapurla İki Yaka: Karaköy → Kadıköy",
        "city": "Istanbul",
        "vibe_tags": ["acik-hava", "manzara", "ulasim", "sosyal"],
        "weather_fit": "outdoor",
        "ll": "@40.9920,29.0230,15z",
        "stops": [
            {"q": "Karaköy Sahil", "ll": "@41.0240,28.9770,15z", "category": "waterfront", "kind": "experience", "note": "Vapura binmeden Boğaz kıyısında kısa bir tur.", "transport_mode": "start"},
            {"q": "Kadıköy Vapur İskelesi", "category": "waterfront", "kind": "experience", "note": "Vapurda çay + simit, martılarla karşı yakaya geç.", "transport_mode": "ferry", "transport_note": "Karaköy–Kadıköy vapuru ~20 dk"},
            {"q": "Kadıköy Çarşı", "category": "bazaar", "kind": "experience", "note": "Çarşının canlı sokaklarında dolan.", "transport_mode": "walk"},
            {"q": "Moda Sahili Kadıköy", "ll": "@40.9901,29.0270,15z", "category": "waterfront", "kind": "experience", "note": "Moda'ya doğru sahil yürüyüşüyle bitir.", "transport_mode": "walk"},
            {"q": "halka açık tuvalet Kadıköy", "ll": "@40.9901,29.0270,15z", "category": "public_toilet", "kind": "utility", "note": "Ücretsiz/halka açık WC.", "transport_mode": "walk"},
        ],
    },
    {
        "title": "Emirgan Yeşil Kaçış",
        "city": "Istanbul",
        "vibe_tags": ["sakin", "doga", "acik-hava"],
        "weather_fit": "outdoor",
        "ll": "@41.1085,29.0540,15z",
        "stops": [
            {"q": "Emirgan Korusu", "category": "park", "kind": "experience", "note": "Ağaçların altında uzun bir yürüyüş."},
            {"q": "Emirgan sahil", "category": "waterfront", "kind": "experience", "note": "Boğaz kıyısında oturup dinlen."},
            {"q": "kafe Emirgan", "category": "cafe", "kind": "experience", "note": "Koru çıkışında çay/kahve molası."},
            {"q": "halka açık tuvalet Emirgan", "category": "public_toilet", "kind": "utility", "note": "Koru civarı ücretsiz WC."},
        ],
    },
]


def build_route(env: dict, tpl: dict) -> dict | None:
    waypoints = []
    seq = 0
    for stop in tpl["stops"]:
        serp = serpapi_search(env, stop["q"], stop.get("ll", tpl["ll"]))
        place = best_place(serp)
        if not place:
            print(f"  [atla] sonuç yok: {stop['q']}")
            continue
        gps = place.get("gps_coordinates", {})
        is_exp = stop["kind"] == "experience"
        default_mode = "start" if not waypoints else "walk"
        waypoints.append({
            "seq": seq,
            "name": place.get("title", stop["q"]),
            "place_id": place.get("place_id"),
            "lat": gps["latitude"],
            "lng": gps["longitude"],
            "category": stop["category"],
            "kind": stop["kind"],
            "price_level": price_to_level(place.get("price")) if is_exp else None,
            "note": stop["note"],
            "transport_mode": stop.get("transport_mode", default_mode),
            "transport_note": stop.get("transport_note"),
            "photo_urls": ([place["thumbnail"]] if place.get("thumbnail") else []),
            "metadata": ({"is_free": True} if stop["kind"] == "utility"
                         else {"rating": place.get("rating"), "address": place.get("address")}),
        })
        seq += 1
        print(f"  [ok] {place.get('title')}  ({gps['latitude']},{gps['longitude']})")

    if len([w for w in waypoints if w["kind"] == "experience"]) < 2:
        print(f"  [HATA] yeterli durak yok: {tpl['title']}")
        return None

    exp = [w for w in waypoints if w["kind"] == "experience"]
    levels = [w["price_level"] for w in exp if w["price_level"]]
    budget_level = max(min(max(levels) if levels else 2, 4), 1)

    # toplam mesafe (haversine, sıralı)
    dist = 0
    for i in range(1, len(waypoints)):
        a = (waypoints[i - 1]["lat"], waypoints[i - 1]["lng"])
        b = (waypoints[i]["lat"], waypoints[i]["lng"])
        dist += haversine_m(a, b)

    exp_names = ", ".join(w["name"] for w in exp)
    description = f"{tpl['city']}'da tematik bir gün: {exp_names}."
    cover = next((w["photo_urls"][0] for w in waypoints if w.get("photo_urls")), None)

    return {
        "title": tpl["title"],
        "description": description,
        "city": tpl["city"],
        "vibe_tags": tpl["vibe_tags"],
        "budget_level": budget_level,
        "weather_fit": tpl["weather_fit"],
        "cover_photo_url": cover,
        "total_distance_m": dist,
        "total_duration_min": int(dist / 80),  # ~80 m/dk yürüyüş
        "is_seed": True,
        "waypoints": waypoints,
    }


def main():
    env = load_env()
    if not env.get("SERPAPI_KEY"):
        raise SystemExit("SERPAPI_KEY yok (.env kontrol et).")
    routes = []
    for tpl in TEMPLATES:
        print(f"\n== {tpl['title']} ==")
        r = build_route(env, tpl)
        if r:
            routes.append(r)
    with open(SEED_JSON, "w", encoding="utf-8") as f:
        json.dump(routes, f, ensure_ascii=False, indent=2)
    print(f"\nTamam: {len(routes)} rota -> {SEED_JSON}")


if __name__ == "__main__":
    main()
