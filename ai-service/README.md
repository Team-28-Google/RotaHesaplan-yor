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
  config.py          # .env → Settings (pydantic-settings)
  llm/provider.py    # Sağlayıcı soyutlama: NvidiaClient (gerçek) + GeminiClient (stub)
  main.py            # FastAPI: /health, /embed, /plan-route
```

## Uçlar

| Uç | Durum | Açıklama |
|---|---|---|
| `GET /health` | ✅ | Sağlayıcı + embed boyutu |
| `POST /embed` | ✅ | `{text, input_type}` → embedding vektörü |
| `POST /plan-route` | 🚧 Sprint 2 | Deterministik pipeline (Intent→Memory→Budget→Logistics→Flood) |

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
