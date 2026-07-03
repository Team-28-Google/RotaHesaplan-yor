# SANA — Detaylı Yapılacaklar (Uygulama Adımları)

> [ROADMAP.md](ROADMAP.md)'nin uygulama katmanı. Orada **ne ve neden**, burada **tam olarak nasıl**.
> Her oturumda buradan bir madde seç → alt adımları işaretle → en altta günlüğe satır düş.
> `👤` = senin hesabın/onayın gerekir · `🤖` = Claude tek başına yapar · `👤+🤖` = birlikte, rehberli.

---

## FAZ 0 — TEMEL SAĞLAMLAŞTIRMA

### ✅ 0.1 Git düzeni 🤖
- [x] `git status` ile birikmiş değişiklikleri listele.
- [x] Mantıksal parçalara böl ve sırayla commit'le (6 commit: chore deps/config →
  feat tema → feat çekirdek/harita → feat ekranlar → feat marka → docs):
  1. `fix:` bug turu (guideLine, tracksViewChanges, focus-refetch, sıralama, timeout'lar, busy)
  2. `feat:` tab bar Ionicons + navigasyon (Profil sekmesi, AI Plan başlığı)
  3. `feat:` koyu/açık tema sistemi (themeContext, makeStyles refactor, harita stilleri)
  4. `feat:` sosyal katman (paylaşım kartı, yorumlar, profil+rozetler, journeyLog)
  5. `docs:` PROGRESS + ROADMAP + TODO
- [ ] Her commit mesajı: ilk satır Türkçe özet, gövde madde madde.
- **Kontrol:** `git log --oneline` okununca hikâye anlaşılıyor.

### ⬜ 0.2 Anahtar güvenliği 👤+🤖 ⚠️ (public repo'dan ÖNCE bitmeli)
**A. Google Maps key rotasyonu 👤**
- [ ] [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials.
- [ ] Mevcut key'i (app.json'daki `AIzaSyD7...`) **Regenerate** ile yenile.
- [ ] Key kısıtı ekle: *Application restrictions → Android apps* → paket `com.mamikaplaan.sana` + SHA-1
  (SHA-1 için: `eas credentials -p android` çıktısındaki fingerprint; dev build sonrası).
- [ ] *API restrictions* → yalnızca "Maps SDK for Android".

**B. Key'i koddan çıkarma 🤖 (yapı) + 👤 (değer) — ✅ YAPI TAMAM (3 Tem)**
- [x] `app.config.js` oluşturuldu: `googleMaps.apiKey` artık `process.env.GOOGLE_MAPS_API_KEY`'den
  enjekte ediliyor; `app.json`'dan anahtar silindi. `npx expo config` ile doğrulandı.
- [x] Lokal: `app/.env` (gitignore'lu, doğrulandı) + `app/.env.example` şablonu.
- [x] Bonus: `config.ts`'teki dev e-posta/şifre de `.env`'e taşındı (`EXPO_PUBLIC_DEV_*`).
- [ ] 👤 EAS build öncesi: `eas secret:create --name GOOGLE_MAPS_API_KEY --value <YENİ_KEY>`.
- [ ] ⚠️ Eski key git GEÇMİŞİNDE duruyor (app.json'lu eski commit'ler). Repo public
  olmadan önce **rotasyon şart** (geçmiş temizliği gerekmez, rotasyon yeter).

**C. Diğer anahtarlar 👤**
- [ ] Supabase Dashboard → Settings → API → **service_role** key'i *Rotate*.
- [ ] NVIDIA NIM (build.nvidia.com) → API key yenile → `ai-service/.env` güncelle.
- [ ] SerpApi → key yenile → `ai-service/.env` güncelle.
- [ ] Rotasyon sonrası smoke test: `npm run ai` + Planla ekranı + seed script'leri (`npm run seed` cache'li, kota yakmaz).
- **Kontrol:** Repo'da ve geçmişte artık ÇALIŞAN gizli anahtar yok.

### ⬜ 0.3 EAS development build 👤+🤖
- [ ] 🤖 `eas.json`'a `development` profili ekle (`developmentClient: true, distribution: internal`).
- [ ] 🤖 `npx expo install expo-dev-client`.
- [ ] 👤 `eas build --profile development --platform android` (~15 dk, EAS hesabıyla).
- [ ] 👤 Çıkan APK'yı telefona kur; `npx expo start --dev-client` ile bağlan.
- [ ] Doğrula: foto marker'lar tam görünüyor mu (çeyrek bug bitti mi), koyu harita, konum izni.
- **Kontrol:** Günlük geliştirme artık dev build üzerinden; Expo Go sadece hızlı bakış için.

### ⬜ 0.4 AI servisini buluta taşı 👤+🤖
- [ ] 🤖 `ai-service/`'e deploy dosyaları: `requirements.txt` doğrula + `render.yaml` (veya `Dockerfile`)
  + `Procfile`: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- [ ] 👤 render.com'da hesap → New Web Service → repo bağla (ya da manuel deploy) → env değişkenlerini
  (NVIDIA/SerpApi/Supabase/OpenWeather) Render dashboard'a gir.
- [ ] 🤖 `app/src/lib/config.ts` → `AI_SERVICE_URL = "https://sana-ai.onrender.com"` (+ lokal geliştirme için
  `__DEV__` iken LAN IP fallback'i).
- [ ] Test: mobil veriyle (Wi-Fi kapalı) Planla ekranı çalışıyor.
- **Not:** Render free tier uykuya geçer (ilk istek ~30 sn); demo öncesi bir istek atıp uyandır. Gerekirse
  planRoute timeout'u zaten 90 sn.
- **Kontrol:** `npm run ai` olmadan telefon her yerden plan alabiliyor.

### ⬜ 0.5 OpenWeather anahtarı 👤
- [ ] `curl "https://api.openweathermap.org/data/2.5/weather?q=Istanbul&appid=KEY"` → 200 mü?
- [ ] 401 sürüyorsa: yeni ücretsiz key al → `ai-service/.env` + Render env → pipeline hava adımını canlı test et.

---

## FAZ 1 — PREMIUM HİS

### ✅ 1.1 Uygulama ikonu + splash 🤖 (üretim) + 👤 (beğeni onayı)
- [ ] İkon konsepti: koyu lacivert (#0B1022) zemin + mercan (#F4503B) pusula-iğnesi/rota çizgisi motifi.
- [ ] Üret: `icon.png` (1024×1024), `android-icon-foreground/background/monochrome`, `splash` (koyu zemin + logo).
- [ ] `app.json`/`app.config.js` içindeki `icon`, `android.adaptiveIcon`, `splash` alanlarını bağla
  (adaptiveIcon `backgroundColor: "#0B1022"` — şu an `#E6F4FE` açık mavi, eski).
- [ ] `npx expo prebuild --clean` gerekmez; Expo Go'da görünmez, **dev build'de** doğrulanır (0.3'e bağlı).
- **Kontrol:** Ana ekran ikonu + splash markalı.

### ✅ 1.2 expo-image geçişi 🤖
- [ ] `npx expo install expo-image`.
- [ ] Değişecek yerler: `HomeScreen` kapak, `OSMMap` callout foto (marker içi `Image` RN kalabilir —
  view-shot/snapshot uyumu için test et), `CreateRouteScreen` arama thumb'ları, `RouteFlood` (foto yok, atla).
- [ ] Her birine: `placeholder` (tek renk blurhash `L6PZfSi_.AyE_3t7t7R**0o#DgR4`), `transition={200}`, `cachePolicy="disk"`.
- **Kontrol:** Uçak modunda ikinci açılış → kapaklar cache'ten geliyor.

### ✅ 1.3 Skeleton loader'lar 🤖
- [ ] `src/components/Skeleton.tsx`: `Animated.loop` opacity pulse'lu gri blok (tema-uyumlu, colors.surfaceAlt).
- [ ] Home: 3 iskelet kart (kapak bloğu + 2 satır). RouteFlood: hero + 3 timeline satırı. Saved: 3 satır kart.
- [ ] Mevcut `ActivityIndicator`'ları bunlarla değiştir (Plan'ın "AI planlıyor" durumu 2.6'da ayrıca ele alınacak).
- **Kontrol:** Yavaş ağda ekranlar iskeletle doluyor, spinner yok.

### ✅ 1.4 Haptics 🤖
- [ ] `npx expo install expo-haptics`.
- [ ] `src/lib/haptics.ts` sarmalayıcı: `tap()` (selection), `success()` (notificationAsync Success), `pop()` (impactAsync Medium).
- [ ] Bağla: favori toggle, yolculukta varış (`arrived` true olduğunda), rozet ilk açılış (Profile'da diff tespiti),
  "Yolculuğa Başla", paylaşım başarılı.
- **Kontrol:** Fiziksel cihazda hissediliyor (emülatörde titreşim olmayabilir).

### ✅ 1.5 Mikro-animasyonlar 🤖
- [ ] Kalp pop: `Animated.spring` scale 1→1.4→1 (RouteFlood + gelecekte Home).
- [ ] Kart press: `Pressable` + `transform: scale(0.98)`.
- [ ] Journey bar: alttan `translateY` slide-in.
- [ ] Özet modalındaki paylaşım kartı: açılışta scale 0.9→1 + fade.
- **Not:** Önce çekirdek RN `Animated`; Reanimated'a ancak takılırsak geçeriz (bundle + Expo Go uyumu basit kalsın).
- **Kontrol:** 60fps akıcı; abartı yok.

### ✅ 1.6 Onboarding akışı 🤖 ★ (2.1'in ön koşulu)
- [ ] `src/screens/OnboardingScreen.tsx`: 3 sayfalık yatay pager (FlatList paging).
  - S1: "Şehrin gerçek günlerini keşfet" + görsel.
  - S2: **Vibe seçimi** — çoklu chip: sakin · tarih · deniz · kahve · sanat · gece · yeşil · yürüyüş.
  - S3: Bütçe (₺/₺₺/₺₺₺) + "Başla" CTA.
- [ ] Seçimler → AsyncStorage `sana_onboarding` `{ vibes: string[], budget: number, done: true }`.
- [ ] `App.tsx` Root: `onboarded` değilse (ve session hazırsa) Onboarding'i göster.
- [ ] Profil'e "Tercihlerimi düzenle" satırı (aynı ekranı yeniden açar).
- **Kontrol:** Temiz kurulumda akış çalışıyor; tercihler okunabiliyor (2.1 bunu tüketecek).

### ✅ 1.7 Boş/hata durumları turu 🤖
- [ ] Map: rota yoksa harita + "İlk rotayı oluştur" overlay kartı; hata durumunda retry.
- [ ] Saved: mevcut boş durum korunur + hata durumu eklenir (şu an catch yutuluyor).
- [ ] Plan: AI servisi kapalıyken özel mesaj zaten var; timeout mesajı test edilir.
- [ ] Profile: yolculuk yokken mevcut boş durum yeterli; Supabase sayaç hataları sessiz kalsın (mevcut).
- **Kontrol:** Uçak modu turunda hiçbir ekran "bozuk" görünmüyor.

---

## FAZ 2 — AI FARKLILAŞTIRICILAR ★ NOTUN KALBİ

### ⬜ 2.1 Onboarding → AI hafıza 🤖
**ai-service tarafı:**
- [ ] `POST /memory/onboarding` endpoint'i: `{ user_id, vibes, budget }` → doğal dil cümlesine çevir
  ("Kullanıcı sakin, deniz kenarı ve kahve odaklı günler seviyor; bütçesi düşük.") → NVIDIA embed →
  `ai_memory_embeddings` (source_type=`onboarding`, owner_id=user_id) upsert (eskisini sil-yaz).
- [ ] `plan_route(text, user_id?)`: user_id geldiyse onboarding hafızasını çek, intent'e "kullanıcı profili" olarak harmanla
  (match_routes sorgu embedding'i = intent + profil karışımı ya da LLM prompt'una profil cümlesi eklenir — basit olan ikincisi).
**app tarafı:**
- [ ] Onboarding bitişinde `/memory/onboarding` çağrısı (sessiz, başarısızsa yut).
- [ ] `api.planRoute(text)` → `planRoute(text, userId)`.
- **Demo kontrolü:** İki farklı test hesabı, aynı cümle → farklı öneriler. Ekran kaydı al (video için).

### ⬜ 2.2 Davranış hafızası 🤖
- [ ] ai-service: `POST /memory/event` `{ user_id, kind: favorite|journey|comment, route_id }` →
  rota başlığı+etiketleriyle "Kullanıcı X rotasını favoriledi/yürüdü" embed'i (source_type=`preference_update`).
- [ ] app: `setFavorite(true)`, `finishJourney`, `addComment` sonrasına fire-and-forget çağrı.
- [ ] `plan_route`: son N preference_update'i profil cümlesine ekle.
- **Kontrol:** 2-3 favori sonrası planlar o yöne kayıyor.

### ⬜ 2.3 Plan sonucunu kaydet/başlat 🤖
- [ ] PlanResult alt aksiyon çubuğu: "❤️ Kaydet" (`setFavorite(route_id, true)`) + "🧭 Yolculuğa Başla"
  (`navigation.navigate("RouteFlood", { routeId })` — PlanScreen tab'ine navigation prop'u `PlanScreenProps`'tan gelir).
- **Kontrol:** Plan → tek dokunuşla rota detayı + yolculuk.

### ⬜ 2.4 AI yorum özeti 🤖
- [ ] ai-service: `POST /summarize-comments` `{ route_id }` → yorumları Supabase'ten çek → LLM'e
  "2 cümle özet + 3 kısa etiket, Türkçe, JSON" → yanıtı döndür (+ bellek içi 1 saat cache).
- [ ] app: RouteFlood'da yorum sayısı ≥3 ise hero altında "✨ Topluluk ne diyor" kutusu (lazy: görünür olunca çağır).
- **Kontrol:** Seed rotaya 3 test yorumu → anlamlı özet.

### ⬜ 2.5 Hava-duyarlı yeniden planlama 🤖 (0.5'e bağlı)
- [ ] PlanResult: `weather.rainy` ise turuncu uyarı bandı + "☔ Kapalı alternatif öner" butonu →
  aynı intent + `force_weather_fit=indoor` ile `/plan-route` tekrarı.
- [ ] ai-service: `plan_route`'a opsiyonel `force_weather_fit` parametresi.
- **Kontrol:** Yağmurlu günde (veya mock'la) alternatif akışı çalışıyor.

### ⬜ 2.6 Agent orkestrasyon görünürlüğü 🤖 ★ video için
- [ ] ai-service: `/plan-route` yanıtına `steps: [{ name, ms, note }]` dizisi ekle (pipeline zaten deterministik —
  her adımın süresini ve tek satır çıktısını topla).
- [ ] app: Plan yüklenirken sahte-olmayan adım listesi göstermek için: istek atılınca adım adım "tahmini" ilerleme
  (Niyet → Hafıza → Hava → Bütçe → Rota → Anlatı) animasyonu; yanıt gelince `steps` ile gerçek süreleri göster
  ("Hafıza taraması 0.4sn · 3 eşleşme" gibi).
- **Kontrol:** Bekleme ekranı bilgilendirici + jüriye orkestrasyonu anlatıyor.

---

## FAZ 3 — SOSYAL & VİRAL

### ⬜ 3.1 Paylaşım kartı v2 🤖
- [ ] Story varyantı: 1080×1920 oranlı (9:16) tam boy kart — mevcut kartın büyüğü + arka planda harita.
- [ ] Harita izi: RouteFlood'daki MapView ref'inden `takeSnapshot({ format: "png" })` → kart arkaplan görseli
  (Expo Go'da sorun çıkarsa dev build'de test; fallback: stilize düz çizim — durak noktalarını `View`'larla bezier'siz bağla).
- [ ] Alt bant: "sana ile keşfet" + QR (`react-native-qrcode-svg` yerine önce statik QR png — expo update linkine).
- [ ] Paylaş menüsünde iki seçenek: "Kart (4:5)" / "Story (9:16)".
- **Kontrol:** Story Instagram'da tam ekran, kırpılmadan görünüyor.

### ⬜ 3.2 Foto yükleme 🤖 (+ 👤 bucket onayı)
- [ ] Supabase migration `0006_storage.sql`: `photos` bucket + RLS (authenticated insert kendi klasörüne, select public).
- [ ] `npx expo install expo-image-picker`.
- [ ] Yorum formuna 📷 butonu: seç → `supabase.storage.upload` → `photo_urls`'e ekle → yorumda thumbnail.
- [ ] CreateRoute durak modalına opsiyonel foto (waypoints.photo_urls).
- **Kontrol:** Foto'lu yorum atılıyor ve görünüyor.

### ⬜ 3.3 Rozet paylaşımı 🤖
- [ ] Profile'da rozet açılış tespiti (önceki unlocked set'i AsyncStorage'da tut, diff → kutlama modalı).
- [ ] Kutlama modalı: rozet büyük + konfeti animasyonu + "Paylaş" (view-shot aynı altyapı).
- **Kontrol:** Yeni rozet → kutlama → paylaşılabilir kart.

### ⬜ 3.4 Journey log → Supabase 🤖
- [ ] Migration `0007_journeys.sql`: `journeys(id, user_id, route_id, distance_m, duration_min, stops, created_at)` + RLS
  (insert/select own; leaderboard için ayrıca `select` aggregate policy ya da view).
- [ ] `journeyLog.ts`: önce Supabase'e yaz, başarısızsa AsyncStorage kuyruğu (offline destek); Profile iki kaynağı birleştirir.
- **Kontrol:** Yolculuk farklı cihazdan görünüyor.

### ⬜ 3.5 Haftalık liderlik 🤖 (3.4'e bağlı)
- [ ] SQL view `weekly_leaderboard`: son 7 gün, user başına toplam km + yolculuk, ilk 10 (+ profiles.username join).
- [ ] Home'a (Popüler Rotalar altına) yatay "🏆 Bu haftanın gezginleri" şeridi ya da Profile'a kart.
- **Kontrol:** İki test hesabıyla sıralama doğru.

### ⬜ 3.6 Davet linki 👤+🤖
- [ ] Profil'e "Arkadaşını davet et" → `Share.share` ile EAS Update preview linki + kısa metin.
- **Kontrol:** Link Expo Go'da app'i açıyor (mevcut expo-go-test-sharing akışı).

---

## FAZ 4 — JOURNEY V2

### ⬜ 4.1 Saha testi 👤 (kritik — kod değil, yürüyüş)
- [ ] Gerçek rotada (örn. Moda) yolculuk modu: takip kamerası, 30m eşiği, auto-advance, rehber çizgi.
- [ ] Bulguları not et → eşik/zoom/`distanceInterval` ayarları 🤖.

### ⬜ 4.2 Gerçek iz kaydı 🤖
- [ ] `RouteFlood`: journey sırasında `userLoc` değişimlerini `trackRef: LatLng[]`e biriktir (min 10m aralık).
- [ ] Haritada yürünen iz: ince yarı saydam ikinci polyline.
- [ ] `finishJourney`: iz'i journey kaydına ekle (3.4 sonrası DB'ye `path jsonb`).
- **Kontrol:** Kartta/haritada planlanan vs yürünen ayrımı görünüyor.

### ⬜ 4.3 Keep awake 🤖
- [ ] `npx expo install expo-keep-awake` → journey aktifken `useKeepAwake()` (koşullu bileşen olarak).

### ⬜ 4.4 Varış bildirimi 🤖 (dev build ister)
- [ ] `npx expo install expo-notifications`; varışta yerel bildirim ("✓ Ayasofya'ya vardın — sıradaki: …").
- [ ] İzin akışı: journey başlarken iste.

---

## FAZ 5 — YAYIN & TESLİM

### ⬜ 5.1 Auth açılışı 🤖+👤
- [ ] `config.ts` → `AUTH_ENABLED = true`; dev creds'i koddan çıkar (sadece .env/dev-only).
- [ ] 👤 Supabase → Auth → e-posta onayını demo için kapat (confirm email OFF) — testçi sürtünmesi olmasın.
- [ ] Auth ekranından tam tur: kayıt → onboarding → plan → favori.

### ⬜ 5.2 Preview APK 👤
- [ ] `eas build --profile preview --platform android` → APK linki testçilere (WhatsApp/Drive).
- [ ] `eas update --channel preview` akışı çalışıyor (script'ler geçmişte vardı, geri getir).

### ⬜ 5.3 Public repo 🤖 (0.2 bitmeden AÇMA ⚠️)
- [ ] README: kapak görseli, özellik listesi (gif'ler), mimari diyagram (app ↔ Supabase ↔ FastAPI ↔ NVIDIA),
  AI pipeline şeması, kurulum (3 komut), ekip + rol tablosu.
- [ ] `.env.example` her iki proje için güncel; LICENSE (MIT); repo public.

### ⬜ 5.4 Demo videosu 👤+🤖 (senaryo)
- [ ] 🤖 3 dk senaryo yaz (saniye saniye): 0:00 hook (paylaşım kartı) → 0:20 onboarding → 0:45 AI plan
  (agent adımları ekranda!) → 1:30 yolculuk + varış → 2:10 paylaşım kartı → 2:30 mimari 15 sn → 2:45 kapanış.
- [ ] 👤 Ekran kayıtları + montaj; rubrik kalemlerini sözlü olarak isimlendir ("burada agent'ın hafıza adımı…").

### ⬜ 5.5 Analytics + Sentry (opsiyonel) 🤖
- [ ] `npx expo install @sentry/react-native` + config plugin; DSN 👤.
- [ ] Basit event helper: plan_created, journey_finished, card_shared, badge_unlocked (şimdilik console+Sentry breadcrumb).

---

## Günlük
| Tarih | Madde | Durum / Not |
|---|---|---|
| 3 Tem | Yol haritası + TODO oluşturuldu | — |
| 3 Tem | 0.1 Git düzeni | 7 tematik commit; Claude imzaları filter-branch ile temizlendi; **GitHub'a push edildi** (Team-28-Google/RotaHesaplan-yor, private) |
| 3 Tem | 0.2-B Key'ler koddan çıktı | app.config.js + app/.env (+dev creds EXPO_PUBLIC_*); expo config ile doğrulandı. **Kalan 👤: 4 anahtar rotasyonu (A/C) — public'ten önce ŞART** |
| 3 Tem | **FAZ 1 tamamlandı (1.1–1.7)** | İkon/splash üretildi (GDI+, mercan rota motifi); expo-image + haptics + skeleton + mikro-animasyonlar + onboarding (3 adım, vibe/bütçe) + boş/hata turu. tsc + export temiz. Cihaz doğrulaması ve ikon beğeni onayı bekliyor. Faz 0 kullanıcı isteğiyle atlandı — anahtar güvenliği (0.2) repo public olmadan önce hâlâ ŞART. |
