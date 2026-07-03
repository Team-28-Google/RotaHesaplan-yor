# SANA — İlerleme & Handoff Log

> **Amaç:** Bu dosya tek başına projeyi devam ettirmeye yeter. Yeni oturumda
> **önce bunu oku**, tüm dosyaları tek tek okuyup token harcama.
> **Son güncelleme:** 2026-06-24 (Sprint 3). Harita **react-native-maps + Google**'a geçti, arama **sunucusuz Photon/OSM**'e taşındı, **app-içi yolculuk** eklendi. **Bölüm 10'a bak** (bu oturum + AÇIK SORUNLAR).

---

## 0. TL;DR — Şu an ne durumdayız

Backend **veri katmanı bitti ve uçtan uca doğrulandı**. Geriye Expo mobil app (görsel) + AI pipeline endpoint'leri kaldı.

- ✅ Supabase şema (6 tablo) + RLS + pgvector + `match_routes` RPC — **5 migration çalıştırıldı**
- ✅ NVIDIA (embedding 1024 + chat JSON), SerpApi (mekan verisi), Supabase entegrasyonları **canlı test edildi**
- ✅ 7 tematik İstanbul seed rotası DB'de (utility WC + vapur ayağı dahil)
- ✅ Semantik arama (Social Memory) gerçek veriyle **doğru sonuç veriyor**
- ✅ **Expo mobil app** (Map + RouteFlood + Plan) — SDK 54, OSM harita, Inter font, tsc temiz
- ✅ **Sprint 2 / AI pipeline BİTTİ:** `/plan-route` (intent→hava→hafıza→bütçe→flood) FastAPI'de çalışıyor; app **Planla** ekranı bağlı (LAN 192.168.1.5:8000)
- ✅ **Sprint 3 büyük ölçüde yapıldı:** auth + haritaya pin/arama ile rota oluşturma + AI enrich + favori/kaydet + journey modu
- ✅ **Harita react-native-maps + Google'a geçti** (PROVIDER_GOOGLE, key app.json'da); tap → rota çizgisi, callout
- ✅ **Arama sunucusuz oldu** — Photon/OSM (anahtar/fatura/AI-sunucu gerekmez), yazdıkça canlı arama
- ✅ **App-içi yolculuk** — "Yolculuğa Başla" Google'a yönlendirmiyor; harita konumu takip eder, ~25m'de auto-advance
- ⏳ Sıradaki: **Bölüm 10 AÇIK SORUNLAR** (journey konum takibi cihazda çalışmıyor; foto marker "çeyrek" bug)

---

## 1. Mimari & Kararlar (hepsi onaylandı)

| Konu | Karar | Not |
|---|---|---|
| Platform | **React Native + Expo** (native mobil) | Saha takibi (canlı konum) için; PWA = yedek |
neyse geri al yolumuza bakalım
| Orkestrasyon | **Deterministik pipeline** | CrewAI değil |
| Backend | **Supabase-direct + ince FastAPI** | CRUD/Auth/Storage Supabase; FastAPI sadece AI |
| Harita verisi | **SerpApi** (google_maps) | Kredi kartsız, 250/ay, cache'li; Google'a swap |
| Harita gösterimi | **react-native-maps** | Mobilde ücretsiz (veri API'sinden ayrı) |
| Rota oluşturma | **Haritaya pin + AI ortak-yazar** | 0 dış API; AI başlık/etiket/kategori/anlatı (`/enrich-route`) |
| Favori | **Favori = Kaydet** (tek aksiyon) | like_count trigger ile |
| Sosyal eşleşme | **Simüle / ertele** | V2 |
| Veri stratejisi | Seed = cold-start; pin-UGC = büyüme | AI hem tüketim hem üretimde |

Plan dosyası (detay): `~/.claude/plans/sana-google-ai-academy-graceful-pinwheel.md`

---

## 2. Repo dosya haritası

```
README.md                    Proje + mimari özeti
PROGRESS.md                  (bu dosya)
.env.example  .gitignore     Anahtar şablonu (gerçek .env gitignore'lu)

supabase/
  migrations/
    0001_schema.sql          profiles, routes, waypoints, flood_comments,
                             ai_memory_embeddings + match_routes RPC + updated_at trigger
    0002_rls.sql             RLS politikaları (tüm tablolar)
    0003_waypoint_kind.sql   waypoints.kind (experience|utility) + metadata
    0004_favorites.sql       route_favorites + like_count trigger + RLS
    0005_transport.sql       waypoints.transport_mode + transport_note
  seed/
    README.md                Seed stratejisi (tematik rotalar + taksonomi)
    seed_routes.json         ÜRETİLEN 7 rota (build_seed çıktısı)
    cache/                   SerpApi ham yanıt cache'i (kota dostu)

ai-service/                  Python/FastAPI (AI servisi) — .venv kurulu (fastapi+uvicorn, Python 3.14)
  requirements.txt  README.md  .env (GERÇEK anahtarlar, gitignore'lu)  .env.example
  app/
    clients.py               STDLIB HTTP: NVIDIA chat+embed, Supabase REST, OpenWeather (pip'siz)
    pipeline.py              Deterministik orkestratör: plan_route() (intent→hava→memory→bütçe→flood)
    main.py                  FastAPI: /health, /embed, /plan-route (CORS açık) → pipeline'ı çağırır
    config.py                .env → Settings (pydantic-settings, opsiyonel)
    llm/provider.py          LLMClient soyutlaması (NvidiaClient + Gemini stub) — şu an pipeline stdlib kullanıyor
  Çalıştır: kökte `npm run ai`  → http://0.0.0.0:8000 (telefon http://<PC-IP>:8000)
  scripts/                   (stdlib-only, pip GEREKMEZ, `py` ile çalışır)
    sana_seed_lib.py         HTTP helper'ları: NVIDIA, SerpApi(cache), Supabase REST, haversine
    build_seed.py            Tematik rota şablonları → SerpApi → seed_routes.json
    backfill.py              seed_routes.json → Supabase + NVIDIA embedding

app/                         Expo / React Native (SDK 54)
  App.tsx                    SEKME navigasyonu: Akış(Home)·Harita(Map)·Planla(Plan)·Kayıtlı(Saved) + RouteFlood (stack üstte). Auth gate (AUTH_ENABLED).
  src/components/OSMMap.tsx   Harita = OpenStreetMap (WebView+Leaflet, CartoDB Positron); focusId ile rota vurgu/zoom
  src/lib/                   config (AUTH_ENABLED, AI_SERVICE_URL, dev creds), supabase, auth, types, api, ui, theme
  src/screens/
    HomeScreen               ANASAYFA akışı — görselli rota kartları (cover_photo_url gerçek foto)
    MapScreen                Harita + kart karüseli
    RouteFloodScreen         Hero + zaman çizelgesi + favori kalbi + "Yakında" utility
    PlanScreen               AI /plan-route (niyet → rota + flood)
    SavedScreen              Kaydettiklerim (favoriler)
    AuthScreen               Giriş/kayıt (AUTH_ENABLED=true iken)
  Görsel: Inter font, expo-linear-gradient, sekmeli nav. Auth: Supabase + AsyncStorage; dev auto-login.
  NOT: seed'de gerçek foto (SerpApi thumbnail) → routes.cover_photo_url + waypoints.photo_urls + metadata.rating

docs/
  PRODUCT_BACKLOG.md         5 Epic, user story'ler (Scrum kanıtı)
```

---

## 3. DB Şeması (migration'ları tekrar okumana gerek yok)

- **profiles** — id (auth.users FK), username, full_name, home_city, onboarding(jsonb)
- **routes** — id, author_id, title, description, city, vibe_tags[], budget_level(1-4),
  weather_fit(indoor/outdoor/any), total_distance_m, total_duration_min, is_seed, like_count
- **waypoints** — id, route_id, seq, name, place_id, lat, lng, category, price_level(0-4),
  note, photo_urls[], **kind(experience|utility)**, **transport_mode**, **transport_note**, metadata(jsonb)
  - unique(route_id, seq)
- **flood_comments** — id, route_id, waypoint_id?, author_id, body, photo_urls[], rating(1-5)
- **ai_memory_embeddings** — id, owner_id?, route_id?, source_type(onboarding/route/comment/preference_update),
  content, **embedding vector(1024)**, metadata — HNSW cosine index
- **route_favorites** — (user_id, route_id) PK, created_at — insert/delete → routes.like_count trigger
- **RPC** `match_routes(query_embedding vector(1024), match_count, filter_city, max_budget)`
  → route_id, content, similarity (cosine). Sadece source_type='route'.

**Migration durumu:** 0001–0005 hepsi Supabase'de çalıştırıldı. ✅

---

## 4. Hesaplar & Anahtarlar

- **Supabase:** proje ref `vwqeupcbmlqkbhmwqyuq` → URL `https://vwqeupcbmlqkbhmwqyuq.supabase.co`
  - anon + service_role anahtarları `ai-service/.env` içinde.
- **NVIDIA NIM:** anahtar `ai-service/.env`. Model: `nvidia/nv-embedqa-e5-v5` (embed, 1024),
  `meta/llama-3.3-70b-instruct` (chat, JSON modu çalışıyor).
- **SerpApi:** anahtar `ai-service/.env`. 250 istek/ay; ~37 harcandı, cache var.
- **OpenWeather:** anahtar `ai-service/.env` ama **401 veriyor** — yeni anahtar aktivasyonu
  (~2 saat) bekliyor olabilir; Sprint 2'de tekrar test et.
- **Google Maps:** SADECE app harita gösterimi (Android SDK, ücretsiz) için gerekecek — henüz alınmadı.

> ⚠️ **GÜVENLİK (yapılacak):** service_role + NVIDIA + SerpApi anahtarları sohbette düz metin
> paylaşıldı. Repo **public olmadan önce rotate et**. `.env` gitignore'lu, repoya gitmez.

---

## 5. Seed verisi — nasıl yeniden üretilir

```powershell
# 1) Mekanları çek + rotaları kur (SerpApi cache'li → tekrar çalıştırmak kota harcamaz)
py "ai-service/scripts/build_seed.py"     # → supabase/seed/seed_routes.json

# 2) DB'ye yaz + NVIDIA ile embedle (idempotent: eski is_seed rotaları siler)
py "ai-service/scripts/backfill.py"
```

**7 rota:** Kadıköy Sakin Gün · Sultanahmet Tarih Yürüyüşü · Balat Renkli Sokaklar ·
Ortaköy Boğaz Esintisi · Galata & Beyoğlu Kültür Turu · **Vapurla İki Yaka (Karaköy→Kadıköy, ferry)** ·
Emirgan Yeşil Kaçış. Her rota 4-5 durak; utility WC'ler (İBB) dahil.

Yeni rota eklemek: `build_seed.py` içindeki `TEMPLATES` listesine ekle → iki script'i çalıştır.

---

## 6. Doğrulanan testler (tekrar yapmana gerek yok, çalışıyor)

- NVIDIA embed → **1024 boyut**; chat + `response_format=json_object` → temiz JSON.
- SerpApi google_maps → koordinat + price + place_id (İBB WC'leri bile buluyor).
- `match_routes` gerçek veriyle doğru sıralıyor:
  - "kafa dinlemek, sakin, bütçem az" → **Kadıköy Sakin Gün**
  - "tarihi ve kültürel yerler" → **Sultanahmet Tarih Yürüyüşü**
  - "boğazda açık hava manzara" → **Ortaköy Boğaz Esintisi**
- Transport DB'de doğru: vapur rotasında seq1 = `ferry` + "Karaköy–Kadıköy vapuru ~20 dk".

---

## 7. SIRADAKİ ADIMLAR (öncelik sırası)

1. ✅ **Expo mobil app KURULDU** (Map + RouteFlood; tsc/doctor/export temiz).
   - Çalıştır: kök dizinde `npm start` (kök package.json app'e yönlendirir) → Expo Go ile tara.
     Harita = OpenStreetMap → **Google/key/kart YOK**, Android dahil her yerde çalışır. Farklı ağda `npm run tunnel`.
   - Kalan UI (Sprint 3): AuthScreen (login), haritaya pin ile rota oluşturma, favori butonu, flood_comments.
2. **AI servis `/plan-route` (Sprint 2):** Intent Parser → Data(hava) → Social Memory(match_routes)
   → Budget → Logistics(haversine + transport-aware süre) → Flood Composer. (Pipeline parçaları
   bugün ayrı ayrı kanıtlandı; birleştirme kaldı.)
3. **`/enrich-route` (Sprint 3):** pin'ler → AI başlık/etiket/kategori/anlatı + eksik utility önerisi → embed.
4. **flood_comments + favori UI + foto upload** (Supabase Storage) — Sprint 3.
5. OpenWeather anahtarını tekrar test et.
6. **git init + public GitHub repo** (kullanıcı erteledi; requirement — yapmadan önce anahtarları rotate et).

---

## 8. Bilinen kısıtlar / küçük borçlar

- Seed rota süresi (total_duration_min) vapur ayağını yürüme hızıyla hesaplıyor → şişkin.
  Sprint 2 Logistics Agent moda göre düzeltecek.
- `ai-service` henüz `pip install` edilmedi (FastAPI'yi çalıştırmak için gerekecek). Seed
  script'leri stdlib olduğu için pip'siz çalışıyor.
- Harita = **react-native-maps + PROVIDER_GOOGLE** (`src/components/OSMMap.tsx` — isim eski kaldı). Google Maps key `app.json`'da (android.config.googleMaps). Expo Go'da render oluyor; native custom marker'lar Expo Go'da bug'lı (bkz. Bölüm 10). (Eski OSM WebView/Leaflet kaldırıldı.)
- **Expo SDK 54'e sabitlendi** (RN 0.81.5, React 19.1.0) — kullanıcının Expo Go'su 54.0.8 (SDK 54). Modern Expo Go tek SDK destekler; proje onunla eşlenmeli. Expo Go ileride güncellenirse projeyi de yükselt. SDK uyumsuzluğunda: stale Metro'yu öldür + `.expo` sil + `npm run reset` (cache temizleyerek başlatır).
- App henüz cihazda görsel test edilmedi (bundle/tip/doctor temiz; render telefonda doğrulanacak).

---

## 9. Bağlam (bootcamp)

Google AI Academy 2026 Bootcamp. 3 Sprint × 2 hafta. Teslim **2 Ağustos 2026 23:59**
(public GitHub + 3 dk YouTube videosu). Puanlama AI-ağırlıklı (agent+hafıza+orkestrasyon 15,
model 20, final AI öğeleri 35) → tasarımımız buna birebir oturuyor. Ekip: 5 kişi (PO+SM+3 Dev).

---

## 10. Bu oturum (2026-06-24) + AÇIK SORUNLAR

### Bu oturumda yapılanlar ✅
1. **Harita yenileme (Native Google):** OSM WebView/Leaflet → **react-native-maps + PROVIDER_GOOGLE**.
   Google Maps key `app.json`'da. Tap-to-show-line (çizgi sadece bir işarete dokununca), callout (foto+isim),
   foto kare marker'lar, recenter, "buradasın" noktası. Default Google rengi (customMapStyle yok).
2. **App-içi yolculuk (`RouteFloodScreen`):** "Yolculuğa Başla" artık **Google Maps'e yönlendirmiyor**.
   - `OSMMap`'e `followLocation` prop'u: journey'de kamera canlı konumu takip eder (`animateCamera`, zoom 16.5).
   - Journey bar: sıradaki durak + canlı mesafe ("📍 X ileride · seni takip ediyorum"); ~25m'de **auto-advance**
     (`✓ Vardın`); konum yoksa "Konum bekleniyor…". Google "Aç" butonu kaldırıldı.
   - (Zaman çizelgesindeki tek tek durak "🧭 Yol tarifi" hâlâ Google'ı açar — opsiyonel; kalsın mı diye soruldu.)
3. **Arama düzeltildi + premium (`CreateRouteScreen` + `api.searchPlaces`):** Önceki arama AI sunucusuna
   (SerpApi `/search-place`) bağlıydı → sunucu kapalıyken **arama yapılamıyordu**. Şimdi **Photon (Komoot/OSM)**
   doğrudan app'ten çağrılıyor → **anahtar/fatura/AI-sunucu gerekmez, hep çalışır**. İstanbul'a yanlı.
   Yazdıkça canlı arama (debounce 350ms + eski yanıt iptali), gömülü 🔎/✕ arama çubuğu, kategori-emoji'li
   sonuç kartları (☕🏛️📚…). Canlı doğrulandı (Topkapı Sarayı → Fatih, doğru koordinat).

### 🔴 AÇIK SORUNLAR (sıradaki oturumda bak)
1. **Yolculuk konum takibi cihazda çalışmıyor** — "Yolculuğa Başla → konumum / nereden nereye gideceğim"
   beklendiği gibi işlemiyor (kullanıcı bildirdi). Kod eklendi (`followLocation`, auto-advance) ama cihazda
   doğrulanmadı. İncelenecek:
   - `useUserLocation` (expo-location) gerçek konumu döndürüyor mu? İzin verildi mi? (emülatörde konum sahte olabilir)
   - `OSMMap.animateCamera` Expo Go'da PROVIDER_GOOGLE ile çalışıyor mu (yoksa `animateToRegion`'a düş)?
   - "Nereden→nereye": şu an sadece sıradaki **durağa mesafe** var; **kullanıcı konumundan durağa çizgi/yön**
     ve "şu an buradasın → sıradaki durak şurası" görseli net değil. Belki kullanıcı konumundan aktif durağa
     kesik çizgi + ETA eklenebilir.
2. **Foto marker "çeyrek" bug'ı** — react-native-maps + Android'de custom foto marker'lar dörtte bir kırpılıyor.
   `collapsable={false}` + `tracksViewChanges` denendi, **çözmedi**. Bu **Expo Go kısıtı**; gerçek çözüm
   **EAS dev build** (custom marker'lar düzgün render olur + kullanıcının Google key'i native aktifleşir).
   Şimdilik bırakıldı, sonra dev build ile.

### Notlar
- AI sunucusu (`npm run ai`) artık **arama için gerekli değil**; sadece `/plan-route` (Planla ekranı) ve
  `/enrich-route` + `/embed-route` (rota kaydı) için gerekli.
- `OSMMap.tsx` ismi tarihsel (artık OSM değil, Google). Refactor şart değil.

---

## 11. Bu oturum (2026-07-03) — bug taraması + tasarım profesyonelleştirme

Uygulama uçtan uca incelendi; bulunan bug'lar düzeltildi, görsel dil rafine edildi. **tsc + expo export temiz.**

### Düzeltilen bug'lar ✅
1. **`OSMMap.guideLine` prop'u tanımlıydı ama hiç çizilmiyordu** → implement edildi: yolculukta
   kullanıcı konumu → hedef durak **kesikli mavi rehber çizgi** (Bölüm 10 açık sorun #1'in "nereden nereye" kısmı).
2. **`tracksViewChanges` hep açıktı** → foto yüklenince kapanıyor (onLoad + 120ms). Pil/performans + Android
   kırpık foto-marker bug'ına katkısı azaltıldı (kesin çözüm hâlâ dev build).
3. **Yolculuk auto-advance "Vardın" ile aynı eşikteydi** → kullanıcı varışı hiç görmüyordu. Şimdi ~30m'de
   "✓ Vardın" 3.5 sn gösterilip sonra otomatik geçiyor; son durakta "🎉 Rota tamamlandı". Manuel "Sonraki"/"Bitir"
   zamanlayıcıyı temizler. Yolculukta harita 230→380px büyür; hero'daki buton "⏹ Yolculuğu Bitir"e dönüşür.
4. **Home/Map verisi bayatlıyordu** (tek useEffect fetch) → `useFocusEffect` ile sekmeye dönüşte sessiz yenileme;
   Home'a pull-to-refresh + boş durum + hata/tekrar dene eklendi. Yeni oluşturulan rota artık anında görünür.
5. **Akış en eski rotayı önce gösteriyordu** → `fetchRoutes` artık `created_at DESC` (en yeni önce).
6. **AI fetch'lerinde timeout yoktu** → `AbortController` ile plan 90s / enrich 60s / arama 12s / embed 20s;
   zaman aşımında Türkçe net mesaj.
7. **CreateRoute: kayıt başarılı olunca `busy` sıfırlanmıyordu** (Android'de Alert back ile kapatılırsa buton
   kilitleniyordu) → düzeltildi. Klavyeden aramada debounce ile çifte istek de giderildi.
8. **Plan başarısızlığında `result.reason` gösterilmiyordu** → artık gösteriliyor.

### Tasarım ✅
- **Tab bar:** emoji ikonlar → **Ionicons** vektör ikonlar (`@expo/vector-icons` direkt bağımlılık yapıldı,
  `npx expo install` ile). Sabit `height: 60` kaldırıldı → gesture-bar'lı cihazlarda safe-area düzgün.
- **Map ekranı:** kart karüseli ↔ harita **senkron** (kart kaydır → rota vurgulanır + kamera uçar;
  marker'a dokun → karüsel o karta kayar). Sayfa noktaları taşmaya karşı wrap.
- Başlıklar sadeleşti ("✨ AI ile Planla"→"AI ile Planla", "❤️ Kaydettiklerim"→"Kaydettiklerim").
- Hata rengi temaya taşındı (`colors.danger`); OSMMap'teki ölü stiller temizlendi.

### İkinci tur (aynı gün): görsel yenileme + çeyrek-marker fix ✅
- **Palet teal → indigo-violet:** `theme.ts`'e yeni renkler (`primary #4F46E5`, `primarySoft`, `gradients.brand`).
  Home'da **gradient marka başlığı** (yuvarlak alt köşe, beyaz ＋Rota pill'i; odaktayken status bar light),
  Auth logosu gradient, etiketler her ekranda **chip** oldu, tüm sabit teal tonları (`#CCFBF1/#ECFEFF`) palete bağlandı.
  `ROUTE_COLORS[0]` artık marka indigosu.
- **Çeyrek foto-marker fix (`OSMMap.MapPin`):** foto `Image.prefetch` ile cache'e iner (o sırada numaralı pin),
  hazır olunca Marker **`key` değişimiyle remount** (bitmap doğru boyutta yeniden oluşur), `fadeDuration={0}`
  (Android fade ortasında snapshot alınmasın), tüm varyantlar **sabit 66×66 kutuda**. tsc + export temiz;
  cihazda doğrulanacak — hâlâ takılırsa kesin çözüm EAS dev build.

### Hâlâ açık
- Bölüm 10 #1'in cihaz doğrulaması (konum takibi gerçek telefonda test edilmeli).
- Çeyrek-marker fix'i cihazda doğrula; Expo Go'da nüksederse → EAS dev build.
- ⚠️ Google Maps key `app.json`'da commit'li → repo public olmadan **rotate + Android app kısıtı** ekle.

---

## 12. Bu oturum (2026-07-03, 3. tur) — KOYU TEMA + Strava-vari sosyal katman

Kullanıcının "Kinetic Horizon" mockup'ı esas alındı. **tsc + expo export temiz.** Cihazda görsel doğrulama bekliyor.

### Koyu tema ✅
- `theme.ts`: koyu lacivert zemin (`#0B1022`) + **mercan** marka (`#F4503B`); `primaryDark` artık
  "koyu zeminde vurgu METNİ" (açık mercan `#FF9F8B`), `primarySoft` yarı saydam mercan chip zemini.
  `ROUTE_COLORS` koyu haritada parlayan tonlara güncellendi.
- **Koyu Google harita stili** — ve gizli bug: `MAP_STYLE` tanımlıydı ama `customMapStyle` MapView'a
  hiç verilmemişti; artık bağlı. Callout/recenter/emoji-marker/rehber çizgi koyu temaya uyarlandı.
- StatusBar global `light`; tüm ekranlardaki açık-tema sabit renkleri (handle, modal, social kutusu,
  rating, journeyBar...) koyu karşılıklarına geçirildi.
- **Home mockup uyarlaması:** "Rota Ekle" mercan pill, **"Yeni Rota Oluştur" hero kartı** (→ CreateRoute),
  "Popüler Rotalar" bölüm başlığı, kapakta vibe rozeti (İLK ETİKET upper), Ionicons'lu meta satırı
  (süre `4s 20dk` formatı), kart altı "Detayları Gör" butonu. Sekme "Planla" → **"AI Plan"**.

### Strava-vari sosyal katman ✅
1. **Yolculuk özeti + PAYLAŞIM KARTI** (`RouteFloodScreen`): "Bitir" → modal'da Instagram'lık koyu kart
   (SANA marka, ROTA TAMAMLANDI, başlık, tarih, durak/km/dk istatistik bloğu, durak listesi).
   **📤 Paylaş** = `react-native-view-shot` captureRef → `expo-sharing` (iki paket `expo install` ile eklendi).
   Yolculuk süresi gerçek ölçülüyor (`journeyStart` ref).
2. **Yorumlar:** `flood_comments` UI'ı — rota detayında liste (@kullanıcı + ★ + zaman) + yorum yazma
   + opsiyonel 1-5 yıldız. RLS zaten hazırdı (select all / insert own); `profiles(username)` FK join çalışıyor.
   `api.ts`: `fetchComments/addComment/countMyRoutes/countMyComments`.
3. **Profil sekmesi (5. tab):** istatistikler (yolculuk/km/durak/rota), **8 rozet** (İlk Adım, Gezgin,
   Şehir Ustası, 10K, Kaşif, Rota Yazarı, Koleksiyoncu, Sosyal), son yolculuklar listesi.
   Veri: `lib/journeyLog.ts` (AsyncStorage, MVP için yerel; V2'de Supabase'e taşınabilir).

### Cihazda test edilecek
- Koyu harita stili Expo Go'da render (customMapStyle Android'de çalışmalı).
- Paylaşım kartı: capture + paylaşım menüsü.
- Yorum gönderme (dev hesapla) ve rozet kilidi açılışı.

### Ek (aynı gün): KOYU MOD ARTIK TERCİH ✅
- **Tema sistemi context'e taşındı:** `lib/themeContext.tsx` (ThemeProvider + `useTheme()`),
  `theme.ts`'te `darkColors` + `lightColors` (ikisi de mercan marka; `routeColors` da tema başına).
  Tercih **AsyncStorage'da kalıcı** (`sana_theme_mode`), varsayılan koyu.
- **Toggle: Profil → "Koyu Mod" switch'i** (ay/güneş ikonu, anında geçiş, restart gerekmez).
- Tüm ekranlar `makeStyles(colors)` desenine geçti (statik `colors` export'u kasıtlı silindi —
  tsc kaçak kullanım bırakmadı). Harita stili de moda göre: `DARK_MAP_STYLE` / `LIGHT_MAP_STYLE`.
- Bilinçli sabitler: paylaşım kartı ve journey bar her iki modda da koyu (marka/kontrast).
- StatusBar moda göre light/dark. tsc + export temiz.

### Yol haritası 📋
- **`docs/ROADMAP.md`** — 5 fazlı premium plan (30 gün, 2 Ağu teslimine göre; AI = rubrikte 70 puan).
- **`docs/TODO.md`** — her maddenin komut/dosya düzeyinde uygulama adımları. Yeni oturumda **önce bunlara bak**.
