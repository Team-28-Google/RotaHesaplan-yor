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

### ✅ 0.2 Anahtar güvenliği — TAMAMLANDI (3 Tem; tek kalan: NVIDIA eski key revoke 👤)
**A. Google Maps key koruması 👤**
- [x] **Regenerate YAPILDI (3 Tem)** → yeni key `app/.env`'de; `expo config` ile enjeksiyon doğrulandı.
- [x] **Tek-anahtar kararı (3 Tem):** app yayınlanmayacağı için sana-server ayrımı İPTAL;
  tek anahtar + *API restrictions* = yalnız Maps SDK for Android + Weather + Routes + Places (New).
- [x] **API restrictions doğrulandı (3 Tem):** konsolda "4 APIs" — Maps SDK for Android +
  Weather + Routes + Places (New). İzinli API'ler canlı 200, Time Zone reddediliyor.
- [ ] (Store'a çıkarken) Android app kısıtı + SHA-1 + ayrı sunucu anahtarı — V2 rafı.

**B. Key'i koddan çıkarma 🤖 (yapı) + 👤 (değer) — ✅ YAPI TAMAM (3 Tem)**
- [x] `app.config.js` oluşturuldu: `googleMaps.apiKey` artık `process.env.GOOGLE_MAPS_API_KEY`'den
  enjekte ediliyor; `app.json`'dan anahtar silindi. `npx expo config` ile doğrulandı.
- [x] Lokal: `app/.env` (gitignore'lu, doğrulandı) + `app/.env.example` şablonu.
- [x] Bonus: `config.ts`'teki dev e-posta/şifre de `.env`'e taşındı (`EXPO_PUBLIC_DEV_*`).
- [ ] 👤 EAS build öncesi (0.3'te): `eas secret:create --name GOOGLE_MAPS_API_KEY --value <KEY>`.
- [x] ~~Eski key git geçmişinde~~ → filter-repo ile kazındı + rotasyon yapıldı (0.2-D). Konu kapandı.

**C. Diğer anahtarlar 👤 (bunlar repo'da HİÇ olmadı; sohbette paylaşıldıkları için önerilir)**
- [x] **NVIDIA yenilendi (3 Tem)** → `ai-service/.env`; canlı `/embed` testi geçti (1024 dim).
  - [x] 👤 Eski key Revoke edildi (3 Tem).
- [x] **Supabase TAMAM (3 Tem):** yeni nesil `sb_publishable_` (app config.ts) + `sb_secret_`
  (ai-service/.env) anahtarlarına geçildi; canlı testler geçti (RLS bypass/engel + GoTrue giriş);
  **Legacy JWT-based API keys DISABLE edildi** — eski anon + service_role 401 dönüyor (kanıtlandı).
- [x] **Dev şifresi değişti (3 Tem):** admin API ile güncellendi → `app/.env`; eski şifre 400,
  yeni şifre 200 (kanıtlandı).
- [ ] SerpApi → düşük öncelik (yalnızca seed script'leri kullanıyor, cache mevcut).
- [x] 👤 NVIDIA eski anahtarı Revoke edildi (3 Tem) — **0.2 GÜVENLİK %100 TAMAM.**

**D. Git geçmişi temizliği 🤖 — ✅ YAPILDI (3 Tem)**
- [x] `git filter-repo --replace-text` ile Maps key + dev şifresi TÜM geçmişten kazındı
  (14 commit korundu, değerler `***REMOVED***`); GitHub'a **force-push** edildi.
- [x] Öncesinde tam yedek: scratchpad `sana-backup-pre-scrub.bundle`.
- [ ] (Opsiyonel 👤, tam garanti) GitHub eski commit objelerini bir süre önbellekte tutabilir;
  kesin temizlik istersen: GitHub'da repoyu sil → aynı adla yeniden oluştur → ben tekrar push'larım (1 dk).
- **Not:** Ekipten biri bugün clone almışsa **yeniden clone** almalı (geçmiş değişti).

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

### ✅ 0.5 Hava anahtarı — GEREKSİZLEŞTİ (3 Tem)
- Hava artık **Google Weather API**'den geliyor (canlı test: İstanbul 25.3° ✅); OpenWeather yalnızca
  yedek yol olarak kodda duruyor, anahtarı çalışmasa da sorun değil.

---

## FAZ 1 — PREMIUM HİS

### ✅ 1.1 Uygulama ikonu + splash 🤖 (üretim) + 👤 (beğeni onayı)
- [x] İkon konsepti: koyu lacivert (#0B1022) zemin + mercan (#F4503B) pusula-iğnesi/rota çizgisi motifi.
- [x] Üret: `icon.png` (1024×1024), `android-icon-foreground/background/monochrome`, `splash` (koyu zemin + logo).
- [x] `app.json`/`app.config.js` içindeki `icon`, `android.adaptiveIcon`, `splash` alanlarını bağla
  (adaptiveIcon `backgroundColor: "#0B1022"` — şu an `#E6F4FE` açık mavi, eski).
- [x] `npx expo prebuild --clean` gerekmez; Expo Go'da görünmez, **dev build'de** doğrulanır (0.3'e bağlı).
- **Kontrol:** Ana ekran ikonu + splash markalı.

### ✅ 1.2 expo-image geçişi 🤖
- [x] `npx expo install expo-image`.
- [x] Değişecek yerler: `HomeScreen` kapak, `OSMMap` callout foto (marker içi `Image` RN kalabilir —
  view-shot/snapshot uyumu için test et), `CreateRouteScreen` arama thumb'ları, `RouteFlood` (foto yok, atla).
- [x] Her birine: `placeholder` (tek renk blurhash `L6PZfSi_.AyE_3t7t7R**0o#DgR4`), `transition={200}`, `cachePolicy="disk"`.
- **Kontrol:** Uçak modunda ikinci açılış → kapaklar cache'ten geliyor.

### ✅ 1.3 Skeleton loader'lar 🤖
- [x] `src/components/Skeleton.tsx`: `Animated.loop` opacity pulse'lu gri blok (tema-uyumlu, colors.surfaceAlt).
- [x] Home: 3 iskelet kart (kapak bloğu + 2 satır). RouteFlood: hero + 3 timeline satırı. Saved: 3 satır kart.
- [x] Mevcut `ActivityIndicator`'ları bunlarla değiştir (Plan'ın "AI planlıyor" durumu 2.6'da ayrıca ele alınacak).
- **Kontrol:** Yavaş ağda ekranlar iskeletle doluyor, spinner yok.

### ✅ 1.4 Haptics 🤖
- [x] `npx expo install expo-haptics`.
- [x] `src/lib/haptics.ts` sarmalayıcı: `tap()` (selection), `success()` (notificationAsync Success), `pop()` (impactAsync Medium).
- [x] Bağla: favori toggle, yolculukta varış (`arrived` true olduğunda), rozet ilk açılış (Profile'da diff tespiti),
  "Yolculuğa Başla", paylaşım başarılı.
- **Kontrol:** Fiziksel cihazda hissediliyor (emülatörde titreşim olmayabilir).

### ✅ 1.5 Mikro-animasyonlar 🤖
- [x] Kalp pop: `Animated.spring` scale 1→1.4→1 (RouteFlood + gelecekte Home).
- [x] Kart press: `Pressable` + `transform: scale(0.98)`.
- [x] Journey bar: alttan `translateY` slide-in.
- [x] Özet modalındaki paylaşım kartı: açılışta scale 0.9→1 + fade.
- **Not:** Önce çekirdek RN `Animated`; Reanimated'a ancak takılırsak geçeriz (bundle + Expo Go uyumu basit kalsın).
- **Kontrol:** 60fps akıcı; abartı yok.

### ✅ 1.6 Onboarding akışı 🤖 ★ (2.1'in ön koşulu)
- [x] `src/screens/OnboardingScreen.tsx`: 3 sayfalık yatay pager (FlatList paging).
  - S1: "Şehrin gerçek günlerini keşfet" + görsel.
  - S2: **Vibe seçimi** — çoklu chip: sakin · tarih · deniz · kahve · sanat · gece · yeşil · yürüyüş.
  - S3: Bütçe (₺/₺₺/₺₺₺) + "Başla" CTA.
- [x] Seçimler → AsyncStorage `sana_onboarding` `{ vibes: string[], budget: number, done: true }`.
- [x] `App.tsx` Root: `onboarded` değilse (ve session hazırsa) Onboarding'i göster.
- [x] Profil'e "Tercihlerimi düzenle" satırı (aynı ekranı yeniden açar).
- **Kontrol:** Temiz kurulumda akış çalışıyor; tercihler okunabiliyor (2.1 bunu tüketecek).

### ✅ 1.7 Boş/hata durumları turu 🤖
- [x] Map: rota yoksa harita + "İlk rotayı oluştur" overlay kartı; hata durumunda retry.
- [x] Saved: mevcut boş durum korunur + hata durumu eklenir (şu an catch yutuluyor).
- [x] Plan: AI servisi kapalıyken özel mesaj zaten var; timeout mesajı test edilir.
- [x] Profile: yolculuk yokken mevcut boş durum yeterli; Supabase sayaç hataları sessiz kalsın (mevcut).
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

### ⬜ 3.2a Places API zenginleştirme — kullanıcı rotalarına foto + puan 🤖 ★
- [ ] ai-service: `places_lookup(name, lat, lng)` — Places (New) Text Search (koordinat bias'lı, tek sonuç)
  → `place_id`, `rating`, foto adı; foto adından **Photo media** redirect'i sunucuda çözülüp
  KALICI googleusercontent URL'si alınır (API anahtarı asla DB'ye yazılmaz).
- [ ] `route_geometry` akışına eklenir (ya da ayrı `/enrich-photos`): her deneyim durağına
  `photo_urls[0]` + `metadata.rating`; rotaya `cover_photo_url` (ilk durağın fotosu).
- [ ] Seed rotalarda zaten SerpApi fotoları var — sadece fotosuz duraklara uygula (idempotent).
- [ ] Backfill script'ine bayrak: `py add_geometry.py --photos`.
- **Neden:** Kullanıcının oluşturduğu rotalar şu an fotosuz → akışta sönük. Bununla her rota
  seed kalitesinde görünür; harita marker'ları da fotolu olur. Kota: durak başına 1-2 çağrı, yazım anında.
- **Kabul:** Yeni oluşturulan rota akışta kapak fotoğraflı + duraklarında puan görünüyor.

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
| 3 Tem | 0.2-B Key'ler koddan çıktı | app.config.js + app/.env (+dev creds EXPO_PUBLIC_*); expo config ile doğrulandı |
| 3 Tem | 0.2-D Git geçmişi temizlendi | filter-repo ile Maps key + dev şifresi tüm geçmişten kazındı, force-push |
| 3 Tem | 0.2 rotasyonlar | Maps ✅ NVIDIA ✅ (canlı test) Supabase ✅ (sb_ anahtarlara geçiş + legacy disable, eski anahtarlar 401). Kalan 👤: dev şifresi, sana-server key, NVIDIA eski revoke, Maps Android kısıtı |
| 3 Tem | **Google Routes entegrasyonu** | Sokak geometrisi: clients.py (decoder+walk_leg) + pipeline.route_geometry + /route-geometry + migration 0006 + add_geometry.py (7/7 seed OK) + app segment çizimi. Hava: Google Weather API (25.3° canlı test) + OpenWeather yedek. **CİHAZDA DOĞRULANDI** (sokak çizgileri ✅) |
| 3 Tem | **ÇEYREK-MARKER BUG'I ÇÖZÜLDÜ** 🎉 | Kökten çözüm: Android'de foto marker'lar canlı View değil, ekran dışında view-shot ile üretilen NATIVE BİTMAP (`Marker image` prop). **Cihazda doğrulandı** — Expo Go'da bile tam kare. PROGRESS §10 açık sorun #2 kapandı |
| 3 Tem | **FAZ 1 tamamlandı (1.1–1.7)** | İkon/splash üretildi (GDI+, mercan rota motifi); expo-image + haptics + skeleton + mikro-animasyonlar + onboarding (3 adım, vibe/bütçe) + boş/hata turu. tsc + export temiz. Cihaz doğrulaması ve ikon beğeni onayı bekliyor. Faz 0 kullanıcı isteğiyle atlandı — anahtar güvenliği (0.2) repo public olmadan önce hâlâ ŞART. |
