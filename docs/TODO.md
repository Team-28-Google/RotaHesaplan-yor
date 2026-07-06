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

### ⏸️ 0.4 AI servisini buluta taşı — YAYIN ANINA ERTELENDİ (kullanıcı kararı, 6 Tem)
> **Karar:** Dışarıda/sokakta test yapılmayacak; demo hep aynı Wi-Fi'da (LAN IP yeterli).
> **Gerçekten yayınlanacağı zaman yapılacak** — FAZ 5'te preview APK testçilere dağıtılmadan
> önce (5.2'nin ön koşulu sayılır); hazırlık (render.yaml + load_env fix) repo'da hazır bekliyor.
> **Etkisi:** o zamana dek 4.0 navigasyon LAN'da test edilir; testçiler AI özelliklerini kullanamaz.
- [x] 🤖 `render.yaml` blueprint hazır (repo kökü): rootDir ai-service, health check, tüm env'ler sync:false.
- [x] 🤖 Kritik fix: `load_env()` artık `.env` dosyası olmayan ortamda os.environ'dan okuyor
  (bu olmadan Render'da TÜM anahtarlar boş kalırdı).
- [ ] 👤 render.com → New → **Blueprint** → repo'yu seç → env değerlerini gir (ai-service/.env'deki değerler).
- [ ] 🤖 Deploy sonrası: `config.ts` → `AI_SERVICE_URL = "https://sana-ai.onrender.com"` (+ dev'de LAN fallback).
- [ ] Test: mobil veriyle (Wi-Fi kapalı) Planla + canlı navigasyon çalışıyor.
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

### ✅ 2.1 Onboarding → AI hafıza — TAMAMLANDI (4 Tem)
**ai-service:**
- [x] `POST /memory/onboarding`: tercihler doğal dil profiline çevrilir → NVIDIA embed →
  `ai_memory_embeddings` upsert (sil-yaz). `sb_select/sb_delete` yardımcıları eklendi.
- [x] `plan_route(text, user_id?)`: profil hem eşleştirme embedding'ine hem composer'a harmanlanır;
  cümlede bütçe yoksa profil bütçesi uygulanır. Yanıt: `personalized` + `profile`.
- [x] **Bonus bug fix:** LLM "İstanbul" (Türkçe İ) döndürünce şehir filtresi boş dönüyordu → normalize.
**app:**
- [x] Onboarding bitişinde sessiz sync + `synced` bayrağı (başarısızsa App açılışında otomatik tekrar).
- [x] `planRoute` user_id gönderir; Plan ekranında "🧠 Sana özel · hafızandan" + profil satırı.
- **Demo KANITLANDI:** Aynı cümle ("dışarı çıkıp güzel vakit geçirmek istiyorum") →
  profil sakin+deniz+kahve = **Kadıköy Sakin Gün**; profil tarih+sanat = **Sultanahmet Tarih Yürüyüşü**.

### ✅ 2.2 Davranış hafızası — TAMAMLANDI (4 Tem)
- [x] `POST /memory/event`: rota başlığı+etiketleriyle davranış embed'i. Canlı test:
  "Kullanıcı 'Ortaköy Boğaz Esintisi' rotasını favorilerine ekledi (açik-hava, manzara, sosyal)".
- [x] app tetikleri: favori / yolculuk bitirme / yorum → fire-and-forget.
- [x] `plan_route`: son 3 davranış profil cümlesine harmanlanır; adım notu "profil + N davranış".

### ✅ 2.3 Plan sonucunu kaydet/başlat — TAMAMLANDI (4 Tem)
- [x] PlanResult aksiyon çubuğu: "🤍 Kaydet" (→ ✓ Kaydedildi, favorilere ekler) +
  "🧭 Yolculuğa Başla" (RouteFlood'a gider). Döngü kapandı: planla → kaydet → yürü → paylaş.

### ✅ 2.4 AI yorum özeti — TAMAMLANDI (4 Tem)
- [x] `POST /summarize-comments`: ≥3 yorum → LLM 2 cümle + 3 etiket (1 saat cache);
  az yorumda `not_enough_comments` (canlı doğrulandı).
- [x] app: RouteFlood hero'da "✨ TOPLULUK NE DİYOR · N yorum" kutusu (≥3 yorumda kendiliğinden gelir).
- [ ] 👤 Demo hazırlığı: bir seed rotaya 3 test yorumu at → özeti gör.

### ✅ 2.5 Hava-duyarlı yeniden planlama — TAMAMLANDI (4 Tem)
- [x] PlanResult: yağmurda mavi uyarı bandı + "Kapalı mekân alternatifi öner" → `force_weather_fit=indoor`
  ile yeniden plan; sonuçta "☂️ Kapalı mekân tercihinle yeniden planlandı" notu.
- [x] servis: iki geçişli zorlamalı seçim (önce indoor, sonra any; outdoor elenir). Canlı test:
  forced=indoor → fit=any rota seçildi (seed'de saf indoor rota yok — beklenen davranış).

### ✅ 2.6 Agent orkestrasyon görünürlüğü — TAMAMLANDI (4 Tem) ★ video için
- [x] ai-service: `steps: [{name, ms, note}]` — 6 gerçek adım, canlı test:
  "Niyet 0.9s · Hafıza 0.7s (profil bulundu) · Hava 0.9s (26.4°) · Eşleştirme 0.6s (5 aday) · Anlatı 2.6s".
- [x] app: bekleme ekranında adım adım akan AgentProgress (✓/spinner/○); sonuç hero'sunda
  "⚙️ AGENT ADIMLARI" kutusu gerçek süre+notlarla.
- [x] **2.3 polish:** Plan'dan "Yolculuğa Başla" artık rota detayında yolculuğu OTOMATİK başlatır.

---

## FAZ 3 — SOSYAL & VİRAL

### 🟡 3.0b TASARIM REVİZYONU: Ana sayfa + Paylaşım menüsü ★ KULLANICI İSTEĞİ (4 Tem)
- [x] **Yön netleşti (6 Tem, kullanıcı seçimi):** Home = "ikisinin karması" — üstte kompakt AI giriş
  kutusu + altta görsel ağırlıklı keşif akışı; paylaşım menüsü **3.1'e ertelendi** (kart v2 ile tek seferde).
- [x] 🤖 Home yeniden yazıldı: hero kart yerine AI prompt kartı ("Bugün ne yapmak istersin?" → Plan
  sekmesi); "Rota Ekle" header'da [+] butonuna dönüştü; **"Sana özel"** yatay şeridi (onboarding
  vibe'ları ↔ rota etiketleri eşanlam haritasıyla skorlanır, eşleşme yoksa gizlenir); **Popüler**
  kartlar tam-foto immersive (başlık+meta alt gradyan üzerinde), beğeniye göre sıralı. tsc temiz.
- [ ] 👤 Cihazda beğeni turu: AI kartı, şerit, immersive kartlar (koyu+açık tema) — geri bildirimle ince ayar.
- [ ] 🤖 **Geri bildirim (6 Tem):** "Rota oluştur" daha belirgin bir yere taşınsın — header'daki [+]
  yeterince görünür değil (seçenekler: AI kartının altına ikinci satır aksiyon, akış sonunda kart,
  ya da kalıcı FAB; kullanıcıyla netleştir).

### ⬜ 3.0c ÇOK ŞEHİR DESTEĞİ ★ KULLANICI İSTEĞİ (6 Tem)
> **Vizyon:** Sadece İstanbul değil — Ankara'daki da Gaziantep'teki de kullanacak;
> hedef tüm Türkiye (ileride dünya). Home'da daha çok ve şehre uygun rota görünmeli.
> **Pilot şehirler (6 Tem, kullanıcı seçimi): Ankara, Gaziantep, İzmir, Bursa** — 4 şehir
> ~130-160 SerpApi araması, aylık kotaya sığar. Başlama zamanı: şimdilik beklemede (kullanıcı kararı).

**A. Veri — pilot şehirlere seed rotalar 🤖**
- [ ] `build_seed.py`'yi şehir-parametreli yap: şehir + semt listesi + kategori config'i
  (İstanbul mantığı aynen: experience+utility karışık, 4-7 durak, vibe/bütçe çeşitliliği).
- [ ] Pilot şehirler için 5-7'şer rota üret (SerpApi cache'li; kota ~30-40 arama/şehir, 250/ay içinde).
- [ ] `add_geometry.py` (sokak geometrisi) + `backfill.py` (DB + embed) şehir bazlı koş.
**B. Servis 🤖**
- [ ] `plan_route`'a `city` parametresi: app konumdan gönderir; cümlede şehir geçiyorsa o kazanır,
  yoksa app'inki, en son Istanbul fallback (şehir normalize mevcut).
**C. App 🤖**
- [ ] Konumdan şehir tespiti (expo-location reverse geocode) → aktif şehir; Home header'da
  şehir chip'i ("📍 Ankara ▾") ile elle değiştirilebilir.
- [ ] Home akışı + Map ekranı aktif şehre göre filtrelenir; harita başlangıcı `ISTANBUL_REGION`
  sabiti yerine şehir merkezine göre (`cityRegion(city)`).
- [ ] Plan isteği `city` gönderir; "Sana özel" şeridi şehir içinde skorlar.
- **Kabul:** Ankara'da açan kullanıcı Ankara rotaları görüyor, plan atınca Ankara rotası geliyor.

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

### ⬜ 4.0 ÇOK MODLU NAVİGASYON — "GMaps paritesi" (harita elden geçirme) 🤖 ★ KULLANICI İSTEĞİ (4 Tem)
- [ ] **"Yolculuğa Başla" = GMaps tarzı TAM EKRAN navigasyon modu** (kullanıcı isteği, 4 Tem):
  sheet/timeline gizlenir, harita tam ekrana geçer; ÜSTTE sıradaki durak kartı (foto + isim +
  kalan mesafe), ALTTA navigasyon barı (ETA · kalan süre/mesafe · durak X/N · Çıkış butonu);
  kamera follow+heading (mevcut) + recenter; yolculuktan çıkınca normal detay görünümüne dön.
- [ ] **Mod seçici** (navigasyon barında): 🚶 Yürü · 🚌 Toplu taşıma · 🚗 Araba — Routes API zaten
  destekliyor (`travelMode: WALK | TRANSIT | DRIVE`); `/walk-route` genelleştirilir → `/nav-route {mode}`.
- [ ] **Mod karşılaştırması**: hedef durak için üç modun süre/mesafesi yan yana
  ("🚶 25 dk · 🚌 12 dk · 🚗 8 dk") — tek Routes çağrısı/mod, hedef değişince hesaplanır.
- [ ] **TRANSIT modunda**: hat bilgisi (otobüs no/metro hattı, biniş durağı, aktarma) — Routes API
  TRANSIT yanıtındaki `transitDetails`'ten; journey bar'da "🚌 15A · Kadıköy İskele'den bin".
- [ ] Rota detayındaki bacaklarda (durak arası) da mod bazlı gerçek süre alternatifi göster.
- [ ] (Araştır) DRIVE modunda trafik-duyarlı süre Essentials'a girer mi, kota etkisi ne?
- ~~Ön koşul: 0.4 Render deploy~~ → 0.4 rafa kalktı (6 Tem); test LAN'da (ev Wi-Fi) yapılır,
  4.1 saha testi de buna göre ev çevresi/aynı ağ senaryosuna daralır.
- **Kabul:** Yolculukta mod değiştirince çizgi + süre + talimat o moda göre güncelleniyor.

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
- [ ] **ÖNCE 0.4 Render deploy** (6 Tem kararı: yayın anına ertelendi — testçi telefonları LAN'daki
  AI servisine erişemez; APK dağıtmadan önce servis buluta alınıp `config.ts` URL'i güncellenir).
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
| 6 Tem | 0.4 Render RAFA | Kullanıcı kararı: dışarıda test yok, LAN yeterli; render.yaml hazırlık olarak repo'da kalıyor |
| 6 Tem | 3.0b Home redesign (karma) | AI prompt kartı + "Sana özel" vibe şeridi + immersive Popüler kartlar; paylaşım 3.1'e ertelendi. Cihaz beğeni turu bekliyor |
| 6 Tem | Public repo ön-tarama | Key taraması temiz (kod+geçmiş+render.yaml); public öncesi kalan: README+LICENSE (5.3) |
| 3 Tem | Yol haritası + TODO oluşturuldu | — |
| 3 Tem | 0.1 Git düzeni | 7 tematik commit; Claude imzaları filter-branch ile temizlendi; **GitHub'a push edildi** (Team-28-Google/RotaHesaplan-yor, private) |
| 3 Tem | 0.2-B Key'ler koddan çıktı | app.config.js + app/.env (+dev creds EXPO_PUBLIC_*); expo config ile doğrulandı |
| 3 Tem | 0.2-D Git geçmişi temizlendi | filter-repo ile Maps key + dev şifresi tüm geçmişten kazındı, force-push |
| 3 Tem | 0.2 rotasyonlar | Maps ✅ NVIDIA ✅ (canlı test) Supabase ✅ (sb_ anahtarlara geçiş + legacy disable, eski anahtarlar 401). Kalan 👤: dev şifresi, sana-server key, NVIDIA eski revoke, Maps Android kısıtı |
| 3 Tem | **Google Routes entegrasyonu** | Sokak geometrisi: clients.py (decoder+walk_leg) + pipeline.route_geometry + /route-geometry + migration 0006 + add_geometry.py (7/7 seed OK) + app segment çizimi. Hava: Google Weather API (25.3° canlı test) + OpenWeather yedek. **CİHAZDA DOĞRULANDI** (sokak çizgileri ✅) |
| 4 Tem | **FAZ 2 TAMAMLANDI (6/6)** 🎉 | 2.2 davranış hafızası (canlı: Ortaköy favorisi embed'lendi) + 2.4 yorum özeti (cache'li, not_enough doğrulandı) + 2.5 hava-duyarlı (forced=indoor canlı test). 0.4 hazırlık: render.yaml + load_env bulut fix'i |
| 4 Tem | **CANLI NAVİGASYON (GMaps hissi)** | Journey modunda konum→durak GERÇEK yürüme rotası (`/walk-route`, ~40m sapınca yeniden hesap), GMaps mavisi dolgun çizgi, navigasyon kamerası (zoom 17 + yöne dönme), bar'da "🚶 550m · ~7dk". Servis yoksa düz kesikli yedek. Canlı test: 662m/9dk/18 nokta ✅ |
| 4 Tem | **2.6 TAMAMLANDI + harita senkron fix** | Agent adımları canlı (6 adım, gerçek süre+not); bekleme animasyonu + sonuç dökümü. Harita: viewability tabanlı kart senkronu + overlay padding + odaklı rotanın durak marker'ları (fotolu) |
| 4 Tem | **FAZ 2.1 + 2.3 TAMAMLANDI** | AI hafıza canlı kanıtlandı: aynı cümle, farklı profil → farklı rota (Kadıköy vs Sultanahmet). Plan aksiyonları eklendi. Şehir-normalize bug fix. tsc + import temiz |
| 3 Tem | **ÇEYREK-MARKER BUG'I ÇÖZÜLDÜ** 🎉 | Kökten çözüm: Android'de foto marker'lar canlı View değil, ekran dışında view-shot ile üretilen NATIVE BİTMAP (`Marker image` prop). **Cihazda doğrulandı** — Expo Go'da bile tam kare. PROGRESS §10 açık sorun #2 kapandı |
| 3 Tem | **FAZ 1 tamamlandı (1.1–1.7)** | İkon/splash üretildi (GDI+, mercan rota motifi); expo-image + haptics + skeleton + mikro-animasyonlar + onboarding (3 adım, vibe/bütçe) + boş/hata turu. tsc + export temiz. Cihaz doğrulaması ve ikon beğeni onayı bekliyor. Faz 0 kullanıcı isteğiyle atlandı — anahtar güvenliği (0.2) repo public olmadan önce hâlâ ŞART. |
