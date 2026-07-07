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

    # ==================== ANKARA (3.0c) ====================
    {
        "title": "Anıtkabir'den Seğmenler'e",
        "city": "Ankara",
        "vibe_tags": ["tarih", "sakin", "yesil"],
        "weather_fit": "any",
        "ll": "@39.9251,32.8369,14z",
        "stops": [
            {"q": "Anıtkabir", "category": "historical_site", "kind": "experience", "note": "Cumhuriyetin kalbinde saygı duruşuyla başla."},
            {"q": "Seğmenler Parkı Çankaya", "ll": "@39.8930,32.8600,15z", "category": "park", "kind": "experience", "note": "Şehrin ortasındaki vadide nefes al."},
            {"q": "üçüncü dalga kahve Kavaklıdere", "ll": "@39.9042,32.8618,15z", "category": "cafe", "kind": "experience", "note": "Tunalı civarında sakin bir kahve molası."},
            {"q": "halka açık tuvalet Kuğulu Park", "ll": "@39.9042,32.8618,15z", "category": "public_toilet", "kind": "utility", "note": "Park civarı ücretsiz WC."},
        ],
    },
    {
        "title": "Hamamönü & Kale Tarihi Doku",
        "city": "Ankara",
        "vibe_tags": ["tarih", "kesif", "fotograf"],
        "weather_fit": "any",
        "ll": "@39.9403,32.8560,15z",
        "stops": [
            {"q": "Hamamönü tarihi evler", "category": "historical_site", "kind": "experience", "note": "Restore edilmiş Ankara evleri arasında dolan."},
            {"q": "Ankara Kalesi", "category": "historical_site", "kind": "experience", "note": "Surlardan eski Ankara'ya tepeden bak."},
            {"q": "Rahmi Koç Müzesi Ankara", "category": "museum", "kind": "experience", "note": "Çengelhan'da nostaljik bir tur."},
            {"q": "çay evi Hamamönü", "category": "cafe", "kind": "experience", "note": "Avlulu bir konakta çay molası."},
            {"q": "halka açık tuvalet Hamamönü", "category": "public_toilet", "kind": "utility", "note": "Meydan civarı ücretsiz WC."},
        ],
    },
    {
        "title": "CerModern & Gençlik Parkı",
        "city": "Ankara",
        "vibe_tags": ["sanat", "sosyal", "kultur"],
        "weather_fit": "any",
        "ll": "@39.9334,32.8480,15z",
        "stops": [
            {"q": "CerModern", "category": "gallery", "kind": "experience", "note": "Eski cer atölyesinde çağdaş sanat."},
            {"q": "Gençlik Parkı Ankara", "category": "park", "kind": "experience", "note": "Havuz kenarında Ankara klasiği bir yürüyüş."},
            {"q": "kafe Kızılay", "ll": "@39.9208,32.8541,15z", "category": "cafe", "kind": "experience", "note": "Şehrin nabzında bir mola."},
            {"q": "halka açık tuvalet Gençlik Parkı", "category": "public_toilet", "kind": "utility", "note": "Park içi ücretsiz WC."},
        ],
    },
    {
        "title": "Kuğulu Park & Tunalı Keyfi",
        "city": "Ankara",
        "vibe_tags": ["sakin", "kahve", "sosyal"],
        "weather_fit": "any",
        "ll": "@39.9042,32.8618,15z",
        "stops": [
            {"q": "Kuğulu Park", "category": "park", "kind": "experience", "note": "Kuğuları izleyerek güne yumuşak başla."},
            {"q": "Tunalı Hilmi Caddesi", "category": "bazaar", "kind": "experience", "note": "Cadde boyunca vitrinlere takıla takıla yürü."},
            {"q": "üçüncü dalga kahve Tunalı", "category": "cafe", "kind": "experience", "note": "Ara sokakta iyi bir filtre kahve."},
            {"q": "halka açık tuvalet Tunalı", "category": "public_toilet", "kind": "utility", "note": "Cadde civarı ücretsiz WC."},
        ],
    },

    # ==================== GAZİANTEP (3.0c) ====================
    {
        "title": "Zeugma & Kale Kültür Günü",
        "city": "Gaziantep",
        "vibe_tags": ["tarih", "kultur", "fotograf"],
        "weather_fit": "any",
        "ll": "@37.0662,37.3833,14z",
        "stops": [
            {"q": "Zeugma Mozaik Müzesi", "category": "museum", "kind": "experience", "note": "Çingene Kızı'yla göz göze gel."},
            {"q": "Gaziantep Kalesi", "category": "historical_site", "kind": "experience", "note": "Kalenin çevresinden şehre bak."},
            {"q": "Tarihi kahve Gaziantep kale", "category": "cafe", "kind": "experience", "note": "Kale eteğinde menengiç kahvesi."},
            {"q": "halka açık tuvalet Gaziantep merkez", "category": "public_toilet", "kind": "utility", "note": "Merkez civarı ücretsiz WC."},
        ],
    },
    {
        "title": "Antep Çarşı Lezzet Turu",
        "city": "Gaziantep",
        "vibe_tags": ["lezzet", "kesif", "sosyal"],
        "weather_fit": "any",
        "ll": "@37.0625,37.3800,15z",
        "stops": [
            {"q": "Almacı Pazarı Gaziantep", "category": "bazaar", "kind": "experience", "note": "Baharat kokuları arasında güne başla."},
            {"q": "Bakırcılar Çarşısı Gaziantep", "category": "bazaar", "kind": "experience", "note": "Çekiç sesleri eşliğinde bakır işçiliği."},
            {"q": "İmam Çağdaş", "category": "restaurant", "kind": "experience", "note": "Baklava + kebap: Antep'in özeti."},
            {"q": "künefe Gaziantep", "category": "street_food", "kind": "experience", "note": "Sıcak künefeyle tatlı bir final."},
            {"q": "halka açık tuvalet Gaziantep çarşı", "category": "public_toilet", "kind": "utility", "note": "Çarşı civarı ücretsiz WC."},
        ],
    },
    {
        "title": "Bey Mahallesi Sokakları",
        "city": "Gaziantep",
        "vibe_tags": ["tarih", "fotograf", "sakin"],
        "weather_fit": "outdoor",
        "ll": "@37.0605,37.3792,15z",
        "stops": [
            {"q": "Bey Mahallesi Gaziantep", "category": "viewpoint", "kind": "experience", "note": "Taş konaklar arasında ağır ağır yürü."},
            {"q": "Emine Göğüş Mutfak Müzesi", "category": "museum", "kind": "experience", "note": "Antep mutfağının hikâyesini dinle."},
            {"q": "kahveci Bey Mahallesi Gaziantep", "category": "cafe", "kind": "experience", "note": "Avlulu konakta bir mola."},
            {"q": "halka açık tuvalet Bey Mahallesi", "category": "public_toilet", "kind": "utility", "note": "Mahalle civarı ücretsiz WC."},
        ],
    },
    {
        "title": "100. Yıl Parkı Nefes",
        "city": "Gaziantep",
        "vibe_tags": ["yesil", "sakin", "acik-hava"],
        "weather_fit": "outdoor",
        "ll": "@37.0796,37.3610,14z",
        "stops": [
            {"q": "100. Yıl Atatürk Kültür Parkı", "category": "park", "kind": "experience", "note": "Şehrin yeşil koridorunda yürüyüş."},
            {"q": "Gaziantep Botanik Bahçesi", "category": "park", "kind": "experience", "note": "Bitkiler arasında sakin bir tur."},
            {"q": "kafe 100. Yıl Parkı Gaziantep", "category": "cafe", "kind": "experience", "note": "Park çıkışında soluklan."},
            {"q": "halka açık tuvalet 100. Yıl Parkı", "category": "public_toilet", "kind": "utility", "note": "Park içi ücretsiz WC."},
        ],
    },

    # ==================== İZMİR (3.0c) ====================
    {
        "title": "Kordon Gün Batımı",
        "city": "Izmir",
        "vibe_tags": ["deniz", "manzara", "sosyal"],
        "weather_fit": "outdoor",
        "ll": "@38.4189,27.1287,14z",
        "stops": [
            {"q": "Konak Meydanı Saat Kulesi", "category": "historical_site", "kind": "experience", "note": "İzmir'in simgesiyle başla."},
            {"q": "Kordon Boyu Alsancak", "category": "waterfront", "kind": "experience", "note": "Denize karşı çimlerde yürü, gün batımını bekle."},
            {"q": "kafe Kordon Alsancak", "category": "cafe", "kind": "experience", "note": "Körfeze karşı bir kahve."},
            {"q": "halka açık tuvalet Kordon", "category": "public_toilet", "kind": "utility", "note": "Sahil boyu ücretsiz WC."},
        ],
    },
    {
        "title": "Kemeraltı Keşif Turu",
        "city": "Izmir",
        "vibe_tags": ["tarih", "kesif", "butce-dostu"],
        "weather_fit": "any",
        "ll": "@38.4180,27.1280,15z",
        "stops": [
            {"q": "Kemeraltı Çarşısı", "category": "bazaar", "kind": "experience", "note": "Labirent sokaklarda kaybolmaya izin ver."},
            {"q": "Kızlarağası Hanı", "category": "historical_site", "kind": "experience", "note": "Osmanlı hanında Türk kahvesi kokusu."},
            {"q": "Agora Ören Yeri İzmir", "category": "historical_site", "kind": "experience", "note": "Antik Smyrna'nın kalbinde dur."},
            {"q": "Türk kahvesi Kızlarağası", "category": "cafe", "kind": "experience", "note": "Han avlusunda közde kahve."},
            {"q": "halka açık tuvalet Kemeraltı", "category": "public_toilet", "kind": "utility", "note": "Çarşı içi ücretsiz WC."},
        ],
    },
    {
        "title": "Alsancak Sanat Rotası",
        "city": "Izmir",
        "vibe_tags": ["sanat", "kahve", "sosyal"],
        "weather_fit": "any",
        "ll": "@38.4370,27.1428,15z",
        "stops": [
            {"q": "Arkas Sanat Merkezi", "category": "gallery", "kind": "experience", "note": "Levanten köşkünde seçkin sergiler."},
            {"q": "Kıbrıs Şehitleri Caddesi", "category": "bazaar", "kind": "experience", "note": "Alsancak'ın canlı caddesinde dolan."},
            {"q": "üçüncü dalga kahve Alsancak", "category": "cafe", "kind": "experience", "note": "Ara sokakta iyi bir espresso."},
            {"q": "halka açık tuvalet Alsancak", "category": "public_toilet", "kind": "utility", "note": "Cadde civarı ücretsiz WC."},
        ],
    },
    {
        "title": "Asansör'den Karataş'a",
        "city": "Izmir",
        "vibe_tags": ["manzara", "fotograf", "sakin"],
        "weather_fit": "outdoor",
        "ll": "@38.4093,27.1249,15z",
        "stops": [
            {"q": "Tarihi Asansör İzmir", "category": "viewpoint", "kind": "experience", "note": "Yukarıdan körfezi seyret."},
            {"q": "Dario Moreno Sokağı", "category": "viewpoint", "kind": "experience", "note": "Begonvilli merdivenli sokakta fotoğraf."},
            {"q": "Karataş sahil İzmir", "category": "waterfront", "kind": "experience", "note": "Sakin sahil hattında yürüyüşle bitir."},
            {"q": "kafe Karataş İzmir", "category": "cafe", "kind": "experience", "note": "Mahalle kahvecisinde soluklan."},
            {"q": "halka açık tuvalet Karataş", "category": "public_toilet", "kind": "utility", "note": "Sahil civarı ücretsiz WC."},
        ],
    },

    # ==================== BURSA (3.0c) ====================
    {
        "title": "Hanlar Bölgesi & Koza Han",
        "city": "Bursa",
        "vibe_tags": ["tarih", "kultur", "sosyal"],
        "weather_fit": "any",
        "ll": "@40.1846,29.0610,15z",
        "stops": [
            {"q": "Ulu Cami Bursa", "category": "mosque", "kind": "experience", "note": "Yirmi kubbenin altında sessizlik."},
            {"q": "Koza Han", "category": "bazaar", "kind": "experience", "note": "İpek hanının avlusunda çay iç."},
            {"q": "Kapalıçarşı Bursa", "category": "bazaar", "kind": "experience", "note": "Bıçakçılar'dan havlucular'a çarşı turu."},
            {"q": "kafe Koza Han Bursa", "category": "cafe", "kind": "experience", "note": "Avluda bir fincan daha."},
            {"q": "halka açık tuvalet Bursa Kapalıçarşı", "category": "public_toilet", "kind": "utility", "note": "Çarşı civarı ücretsiz WC."},
        ],
    },
    {
        "title": "Yeşil'den Irgandı'ya",
        "city": "Bursa",
        "vibe_tags": ["tarih", "sakin", "fotograf"],
        "weather_fit": "any",
        "ll": "@40.1815,29.0742,15z",
        "stops": [
            {"q": "Yeşil Türbe Bursa", "category": "historical_site", "kind": "experience", "note": "Turkuaz çinili türbede dur."},
            {"q": "Yeşil Camii Bursa", "category": "mosque", "kind": "experience", "note": "Erken Osmanlı zarafeti."},
            {"q": "Irgandı Köprüsü", "category": "viewpoint", "kind": "experience", "note": "Sanatçı atölyeli taş köprüden geç."},
            {"q": "kafe Yeşil Bursa", "category": "cafe", "kind": "experience", "note": "Türbe manzaralı bir mola."},
            {"q": "halka açık tuvalet Yeşil Bursa", "category": "public_toilet", "kind": "utility", "note": "Meydan civarı ücretsiz WC."},
        ],
    },
    {
        "title": "Kültürpark Nefes Turu",
        "city": "Bursa",
        "vibe_tags": ["yesil", "sakin", "kultur"],
        "weather_fit": "any",
        "ll": "@40.1900,29.0500,15z",
        "stops": [
            {"q": "Kültürpark Bursa", "category": "park", "kind": "experience", "note": "Gölet çevresinde geniş bir tur."},
            {"q": "Bursa Kent Müzesi", "category": "museum", "kind": "experience", "note": "Şehrin hikâyesine kısa bir dalış."},
            {"q": "kafe Altıparmak Bursa", "category": "cafe", "kind": "experience", "note": "Cadde üstünde kahve molası."},
            {"q": "halka açık tuvalet Kültürpark", "category": "public_toilet", "kind": "utility", "note": "Park içi ücretsiz WC."},
        ],
    },
    {
        "title": "Cumalıkızık Köy Sabahı",
        "city": "Bursa",
        "vibe_tags": ["doga", "tarih", "kesif"],
        "weather_fit": "outdoor",
        "ll": "@40.1786,29.1725,15z",
        "stops": [
            {"q": "Cumalıkızık", "category": "historical_site", "kind": "experience", "note": "700 yıllık köyün arnavut kaldırımlarında yürü."},
            {"q": "kahvaltı Cumalıkızık", "category": "restaurant", "kind": "experience", "note": "Köy kahvaltısıyla güne başla."},
            {"q": "Cumalıkızık Etnografya Müzesi", "category": "museum", "kind": "experience", "note": "Köy yaşamının izleri."},
            {"q": "halka açık tuvalet Cumalıkızık", "category": "public_toilet", "kind": "utility", "note": "Köy meydanı ücretsiz WC."},
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
    _CITY_TR = {"Istanbul": "İstanbul'da", "Ankara": "Ankara'da", "Gaziantep": "Gaziantep'te",
                "Izmir": "İzmir'de", "Bursa": "Bursa'da"}
    description = f"{_CITY_TR.get(tpl['city'], tpl['city'] + chr(39) + 'da')} tematik bir gün: {exp_names}."
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
