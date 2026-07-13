# SANA — AI Service (FastAPI)

Deterministik AI orkestrasyonu. Mobil uygulama yalnızca AI istekleri için buraya konuşur;
CRUD/Auth/Storage doğrudan Supabase'e gider.

## Kurulum

```bash
cd ai-service
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
pip install -r requirements.txt

cp .env.example .env   # değerleri doldur (NVIDIA_API_KEY vb.)
uvicorn app.main:app --reload
```

Sağlık kontrolü: http://127.0.0.1:8000/health · Swagger: http://127.0.0.1:8000/docs

## Yapı

```
app/
  clients.py   # stdlib istemciler: NVIDIA NIM, Supabase REST, Google (Routes/Places/
               # Weather/Geocoding/Roads), polyline decoder
  pipeline.py  # deterministik pipeline: niyet → hafıza → hava → eşleştirme/ÜRETİM →
               # anlatı; norm_city (81 il), enrich/embed/geometri işleri
  main.py      # FastAPI: ince HTTP/CORS katmanı (uçlar aşağıda)
```

## Uçlar

| Uç | Açıklama |
|---|---|
| `GET /health` | Sağlayıcı bilgisi |
| `POST /embed` | `{text, input_type}` → embedding vektörü (1024) |
| `POST /plan-route` | Deterministik pipeline; `force_generate` ile AI üretici, `city` ile aktif şehir (81 il) |
| `POST /nav-route` | Çok modlu canlı navigasyon (walk/transit/drive) — transit adımları, hat renkleri, alternatifler |
| `POST /walk-route` | Eski istemciler için yürüme kısayolu |
| `POST /detect-city` | Koordinat → il (Geocoding, tüm Türkiye; Datça→Mugla gibi kanonikleştirme) |
| `POST /snap-track` | Ham GPS izini yola oturtur (Roads) |
| `POST /search-place` | Mekan araması (Places New, aktif şehre bias'lı) |
| `POST /enrich-route` | Kullanıcı duraklarına başlık/etiket/anlatı |
| `POST /enrich-photos` | Fotosuz duraklara Places foto + puan |
| `POST /route-geometry` | Duraklara gerçek sokak geometrisi |
| `POST /embed-route` | Rotayı topluluk aramasına embed'ler |
| `POST /memory/onboarding` · `/memory/event` | AI hafızası: profil + davranış |
| `POST /summarize-comments` | ≥3 yorumda AI topluluk özeti (1 saat cache) |

## Hızlı test

```bash
curl -X POST http://127.0.0.1:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"text":"kafa dinlemelik sakin bir rota","input_type":"query"}'
```

## Sağlayıcı değiştirme

`.env` → `LLM_PROVIDER=nvidia|gemini`. Pipeline kodu değişmez (provider abstraction).
NVIDIA embedding modeli `nv-embedqa-e5-v5` → **1024 boyut**; Gemini'ye geçilirse
`text-embedding-004` → 768 boyut olur, DB şemasındaki `vector(...)` ve `EMBED_DIM` ile tutarlı olmalı.
