# SANA — Sosyal Rota & Deneyim Platformu

> Şehirde yalnız hisseden insanlar, gerçek kişilerin yaşadığı günleri (kafe → sokak →
> kitapçı → fotoğraf + kişisel not) sıralı bir **harita flood'u** olarak keşfeder, kendileri
> de deneyimler ve kendi deneyimlerini ekler. *Şehirler için Strava + AI hafıza.*

Google AI Academy 2026 Bootcamp — 3 Sprint × 2 hafta MVP.

> 📌 **Geliştiriciye:** Projenin güncel durumu, kararlar ve sıradaki adımlar için
> [PROGRESS.md](PROGRESS.md) — tek başına devam etmeye yeter.

## Mimari (özet)

```
Mobil App (Expo/RN)  ──RLS──►  Supabase (Postgres + pgvector + Auth + Storage)
        │                              ▲
        └──/plan-route, /embed──►  AI Service (FastAPI)
                                       │
                          NVIDIA NIM (LLM+Embed) ↔ Gemini
                          Google Places/Directions + OpenWeather
```

AI akışı **deterministik pipeline**: Intent Parser → Data (hava) → Social Memory
(pgvector) → Budget filtre → Logistics (haversine + Directions) → Flood Composer.

Tam mimari ve karar gerekçeleri için: `docs/` ve proje planı.

## Monorepo yapısı

| Dizin | İçerik |
|---|---|
| `app/` | React Native + Expo mobil uygulama (harita, flood UI, saha takibi) |
| `ai-service/` | Python/FastAPI — AI orkestrasyonu, provider abstraction, `/embed` & `/plan-route` |
| `supabase/` | SQL migration'lar (şema + RLS) ve seed verisi |
| `docs/` | Mimari notlar, Scrum çıktıları (backlog, sprint review/retro) |

## Hızlı başlangıç

1. **Hesaplar (Faz 0):** Supabase projesi, NVIDIA API key, Google Maps key, OpenWeather key.
2. `cp .env.example .env` ve değerleri doldur.
3. **DB:** `supabase/migrations/*.sql` dosyalarını Supabase SQL editöründe sırayla çalıştır.
4. **AI servis:** `cd ai-service && python -m venv .venv && pip install -r requirements.txt && uvicorn app.main:app --reload`
5. **Mobil:** `cd app && npm install && npx expo start` (bkz. `app/README.md`).

## Ekip / Scrum

5 kişi (PO + SM + 3 Dev). Önerilen iş bölümü: Mobil/Harita · AI Servisi · Veri/Backend.
Her sprint Scrum kanıtları `docs/` altında (Backlog, User Stories, Daily Scrum, Review, Retro).

> **Sıfırdan geliştirme:** Tüm uygulama kodu ekip tarafından yazılır. AI ile üretilen
> başlangıç (seed) içerikleri DB'de `is_seed = true` ile şeffafça işaretlidir.
