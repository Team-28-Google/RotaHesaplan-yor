# Seed Verisi — İstanbul Tematik Gezi Rotaları

Soğuk başlangıç (cold-start) çözümü: MVP'de gerçek kullanıcı yokken Social Memory
Agent'ın getirebileceği içerik olması için **20-40 elle/AI ile hazırlanmış İstanbul rotası**.

Bunlar sadece kafe listesi değil; gerçek bir **gezme/yürüyüş günü**: tarihi yerler,
parklar, manzara, sahil + dinlenme + **pratik POI'ler (ücretsiz WC, çeşme)**.

## Kurallar

- Tüm seed rotalar DB'de `routes.is_seed = true` ile işaretlenir (şeffaflık + diskalifiye riskinden kaçınma).
- Her rota **4-7 waypoint** içerir, türler **karışık** olmalı (sadece kafe değil).
- Koordinat/fiyat/ad bilgisi **SerpApi (google_maps engine)** ile çekilir, diske cache'lenir (kota dostu).
- Çeşitli `vibe_tags` ve `budget_level` dağılımı (sakin/kalabalık, ucuz/orta) — arama çeşitliliği için.

## Waypoint taksonomisi (kind + category)

| kind | category örnekleri | haritada / anlatıda |
|---|---|---|
| `experience` | historical_site, museum, mosque, church, park, viewpoint, cafe, restaurant, street_food, bookstore, gallery, bazaar, waterfront | Ana duraklar; flood anlatısının parçası |
| `utility` | public_toilet (ücretsiz WC), rest_area (dinlenme bankı), water_fountain (çeşme) | Küçük yardımcı pin; "yol üstünde ücretsiz WC var" pratik notu |

> Ücretsiz/halka açık bilgisi `waypoints.metadata` (örn. `{"is_free": true}`) veya `note` alanında.

## Örnek tematik rotalar (taslak)

1. **Sultanahmet Tarih Yürüyüşü** (sakin değil ama kültür) — Ayasofya → Sultanahmet Camii →
   Yerebatan Sarnıcı → *(dinlenme: Sultanahmet Parkı)* → *(ücretsiz WC)* → çay bahçesi.
2. **Kadıköy Sakin Gün** (kafa-dinleme, bütçe-dostu) — Moda sahili (yürüyüş) → kitapçı →
   üçüncü dalga kahve → Moda Parkı *(dinlenme)* → *(ücretsiz WC)*.
3. **Balat Renkli Sokaklar** (fotoğraf, keşif) — renkli evler → antikacılar → manzara →
   kafe → *(çeşme/dinlenme)*.
4. **Boğaz & Yeşil** (açık hava, outdoor) — Emirgan Korusu → sahil yürüyüşü → manzara →
   kafe → *(WC/rest)*.

> Hava 'indoor' ise kapalı ağırlıklı rotalar (müze, kapalı çarşı, kitapçı, kafe) öne çıkar;
> 'outdoor' ise park/sahil/manzara ağırlıklılar (bkz. `routes.weather_fit`).

## Üretim akışı (Sprint 1 sonu → Sprint 2)

1. `scripts/build_seed.py` — her (kategori, semt) için SerpApi araması yapar, ham yanıtı
   `seed/cache/` altına kaydeder, fiyat aralığını `price_level`'a map'ler, rotaları
   (experience + utility karışık) `seed_routes.json` olarak yazar.
2. `scripts/backfill.py` — `seed_routes.json`'u Supabase'e yazar (service_role) **ve** her
   rotanın metnini (`title + description + vibe_tags + waypoint adları/notları`) NVIDIA ile
   embedler, `ai_memory_embeddings` (source_type='route') tablosuna ekler.

## Embed edilecek metin formatı (öneri)

```
{title}. {description}. Etiketler: {vibe_tags}.
Duraklar: {experience waypoint adları ve notları}.
```
> Not: `utility` POI'ler (WC/çeşme) embed metnine **dahil edilmez** — semantik aramayı
> kirletmesin; sadece haritada yardımcı pin olarak taşınır.

## Fiyat → price_level eşlemesi (SerpApi `price` aralığı)

| SerpApi price | price_level |
|---|---|
| ücretsiz / yok | 0-1 |
| ₺1–200 | 1 |
| ₺200–400 | 2 |
| ₺400–600 | 3 |
| ₺600+ | 4 |
