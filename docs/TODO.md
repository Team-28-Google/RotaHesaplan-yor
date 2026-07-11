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

### ✅ 0.4 AI servisini buluta taşı — TAMAMLANDI (8 Tem; testçiler AI'ya erişemeyince öne alındı)
- [x] 👤 Render Blueprint kuruldu: **https://sana-ai-5ejj.onrender.com** (srv-d96jtmgjs32c73dplqbg).
- [x] 🤖 `config.ts` bulut URL'ine geçti; canlı doğrulama buluttan uçtan uca (Ankara planı ✓).
- [x] 🤖 EAS Update yayınlandı — testçilerde AI planlama/üretici aktif.
- **Not:** Free tier 15 dk boşta uyur → ilk istek ~30 sn (timeout'lar karşılıyor); demo öncesi
  bir istek atıp uyandır. `npm run ai` artık yalnız lokal debug için.
- [x] 🤖 `render.yaml` blueprint hazır (repo kökü): rootDir ai-service, health check, tüm env'ler sync:false.
- [x] 🤖 Kritik fix: `load_env()` artık `.env` dosyası olmayan ortamda os.environ'dan okuyor
  (bu olmadan Render'da TÜM anahtarlar boş kalırdı).
- [ ] 👤 Test: mobil veriyle (Wi-Fi kapalı) Planla + canlı navigasyon çalışıyor.
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

### ✅ 2.7 AI ROTA ÜRETİCİ — TAMAMLANDI (7 Tem) ★
> plan_route artık yalnız eşleştirici değil: LLM gerçek Places mekânlarından yepyeni rota kurabiliyor.
- [x] **Semt seçimi:** niyet vibe'ları → 7 İstanbul semti haritası (deniz→Moda/Ortaköy, tarih→Balat/
  Sultanahmet…); eşitlikte rastgele (çeşitlilik). Canlı: "sanat+kahve" → Balat ✓
- [x] Aday havuzu: `google_places_search` (Text Search, ≤4 sorgu × 6 sonuç, semt merkezine
  ≤4 km filtre — locationBias tek başına yetmiyor, Maltepe sızmıştı). ~22-24 gerçek aday.
- [x] **İki aşamalı LLM** (8B modelde tek prompt kalitesiz çıktı): üretici SADECE seçim+sıra
  (index listesi, uydurma imkânsız) → anlatı+kategori kanıtlanmış `enrich_route` ile.
  Fazla durak kırpılır (model 7 seçerse fail değil ilk 6); iki sıcaklıkta deneme.
- [x] Kalıcılık: routes+waypoints (foto photo_name'den direkt, rating→metadata) → route_geometry
  + embed_route; yazar = isteyen kullanıcı (yoksa seed hesabı).
- [x] Tetik: **force_generate** (app: sonuçta "🎲 Bana yeni rota üret" butonu) + **akıllı tetik**
  (havuz no_match kalırsa otomatik üret). Üretim başarısızsa normal akışa zarif düşüş.
- [x] app: 🎲 buton + "Az önce senin için ÜRETİLDİ" rozeti + üretim-modu bekleme adımları
  (📍 Mekânlar aranıyor → 🧩 Rota kuruluyor → 📸 Foto+geometri) + 150 sn timeout.
- **CANLI TEST ×2:** pipeline 15.7 sn (6 durak Kadıköy) + HTTP uçtan uca (5 durak Balat); testler silindi.
- [x] 👤 Cihazda denendi (7 Tem) — kullanıcı kendi rotasını üretti ("Sakin ve Butçe Dostu Kadıköy Gezisi").
- [x] **2.7b (7 Tem, kullanıcı istekleri):** mod seçici EN BAŞTA (📚 kayıtlılardan / 🎲 yepyeni üret);
  üretimde "Nereden başlayalım?" (✨ AI seçsin / 📍 konumum — izin o an istenir / 7 semt çipi;
  servis: gen_lat/lng/district, canlı test: Moda koordinatı → tüm duraklar Moda ✓); üretilen rotada
  **durak düzenleme**: ✕ ile çıkar (min 2) + "＋ Durak ekle" arama sheet'i (SerpApi) — değişince
  geometri+foto arka planda tazelenir. UX: tüm seçimler dolgulu mercan + ✓ (çip görsel birliği);
  agent adımlarında süreler gizlendi (premium his — s.ms API'de duruyor).

---

### ✅ BUG: beğeni sayacı 0 kalıyor — ÇÖZÜLDÜ (7 Tem; 0009 uygulandı, ❤️ canlı doğrulandı)
- Teşhis: beğeniler `route_favorites`'a YAZILIYOR (3 satır) ama `routes.like_count` hep 0 —
  `bump_like_count()` SECURITY DEFINER değildi → routes RLS'i (update yalnız sahibi) trigger'ın
  sayaç güncellemesini sessizce 0 satıra düşürüyordu.
- [x] 🤖 `0009_fix_like_count.sql` yazıldı: security definer + mevcut beğenilerden sayaç backfill.
- [x] 👤 SQL Editor'de çalıştırıldı → kalpler gerçek sayıyı gösteriyor.

## FAZ 3 — SOSYAL & VİRAL

### 🟡 3.0b TASARIM REVİZYONU: Ana sayfa + Paylaşım menüsü ★ KULLANICI İSTEĞİ (4 Tem)
- [x] **Yön netleşti (6 Tem, kullanıcı seçimi):** Home = "ikisinin karması" — üstte kompakt AI giriş
  kutusu + altta görsel ağırlıklı keşif akışı; paylaşım menüsü **3.1'e ertelendi** (kart v2 ile tek seferde).
- [x] 🤖 Home yeniden yazıldı: hero kart yerine AI prompt kartı ("Bugün ne yapmak istersin?" → Plan
  sekmesi); "Rota Ekle" header'da [+] butonuna dönüştü; **"Sana özel"** yatay şeridi (onboarding
  vibe'ları ↔ rota etiketleri eşanlam haritasıyla skorlanır, eşleşme yoksa gizlenir); **Popüler**
  kartlar tam-foto immersive (başlık+meta alt gradyan üzerinde), beğeniye göre sıralı. tsc temiz.
- [x] **Profil tasarımı elden geçirildi (7 Tem, kullanıcı isteği — beğenildi ✓):** kimlik + istatistikler +
  rozet ilerleme çubuğu tek "gezgin kartı"nda (koyu hero, paylaşım kartlarıyla aynı dil); ayarlar
  (koyu mod / tercihler / davet) ayraçlı tek kartta.
- [ ] 👤 Cihazda beğeni turu: AI kartı, şerit, immersive kartlar (koyu+açık tema) — geri bildirimle ince ayar.
- [ ] 🤖 **Geri bildirim (6 Tem):** "Rota oluştur" daha belirgin bir yere taşınsın — header'daki [+]
  yeterince görünür değil (seçenekler: AI kartının altına ikinci satır aksiyon, akış sonunda kart,
  ya da kalıcı FAB; kullanıcıyla netleştir).

### ✅ 3.0c ÇOK ŞEHİR DESTEĞİ — TAMAMLANDI (7 Tem) ★
> SANA artık 5 şehirde: İstanbul + Ankara, Gaziantep, İzmir, Bursa (kullanıcı pilot seçimi).

**A. Veri ✅** — 4 şehre 4'er tematik şablon (16 yeni, toplam 23 seed): Anıtkabir/Hamamönü/
CerModern/Tunalı · Zeugma/çarşı-lezzet/Bey Mah./100.Yıl · Kordon/Kemeraltı/Alsancak/Asansör ·
Koza Han/Yeşil/Kültürpark/Cumalıkızık. backfill + geometri: 25/25 rota. Cache repo'da (kota korunur).
**B. Servis ✅** — norm_city + şehir kuralı: cümledeki BİLİNEN şehir > app'in aktif şehri > Istanbul
(bilinmeyen ad = halüsinasyon, yok sayılır — canlı yakalandı: "çarşıda" şehir sanılmıştı);
hava koordinatları 5 şehir; 2.7 üretici semt haritası şehir-bazlı. Canlı test ×3 geçti.
**C. App ✅** — `cities.ts` (bölge+semtler+kalıcı seçim) + **CityPicker bottom-sheet**
(şehir ikonu + semt önizleme + canlı rota sayısı; ilk açılışta otomatik açılır — keşfedilebilirlik);
Home header'da çip; Home/Map şehre filtreli (harita fitAll ile şehre odaklanır); Plan semt çipleri
şehre göre; CreateRoute aktif şehre kaydeder.
**Bonus** — mekan araması Photon/SerpApi'den **Google Places'a** geçti (şehir-bias'lı; "Anıtkabir"
fix'i) + SerpApi çalışma zamanından söküldü (yalnız seed script'lerinde) + çeyrek-marker fix v2
(bitmap bekleyen canlı marker artık dondurulmuyor).
- [ ] (V2) Konumdan otomatik şehir tespiti (reverse geocode) — şimdilik elle seçim.

### ✅ 3.1 Paylaşım kartı v2 — TAMAMLANDI (7 Tem; +3.0b'nin paylaşım menüsü isteği)
- [x] Bottom-sheet paylaşım menüsü (ortalı modal yerine): tutamak + format çipleri + önizleme.
- [x] Story 9:16: 360×640 dp yerleşim (pixelRatio ile ~1080×1920 px çıktı); önizleme scale ile küçültülür.
- [x] Harita izi: stilize düz çizim (`RouteTrace` — duraklar nokta, aralar döndürülmüş View çizgiler;
  TODO'daki fallback tasarım bilinçli tercih edildi, MapView snapshot dev build'e kaldı).
- [ ] (Polish, dev build sonrası) MapView `takeSnapshot` arka planı + QR bandı.
- **Kontrol 👤:** Story Instagram'da tam ekran, kırpılmadan görünüyor mu?

### ✅ 3.1b PAYLAŞIM İZİ — Strava tarzı — TAMAMLANDI (11 Tem) ★
- [x] Story kartında iz kaynağı çipleri: "🗺️ Planlanan yol" / "👣 Yürüdüğüm iz" (iz varsa
  varsayılan yürünen — turkuaz; yoksa çip görünmez, planlanan mercan).
- [x] Planlanan yol artık gerçek sokak kıvrımları (leg_geometry → segmentsToPath, ~80 nokta);
  RouteTrace `points` üzerinden çizer, duraklar nokta olarak üstte.
- [ ] (Stretch, video sonrası) Strava tarzı animasyonlu replay — izin çizilerek aktığı video/GIF.
- [ ] 👤 Saha doğrulaması: gerçek yürüyüşte iz + kartta iki seçenek.

### ✅ 3.2a Places API zenginleştirme — TAMAMLANDI (6 Tem)
- [x] `google_place_lookup` (Text Search, koordinat bias, tek sonuç) + `google_photo_url`
  (Photo media redirect'i sunucuda çözülür → kalıcı googleusercontent URL; key DB'ye sızmaz).
- [x] `enrich_photos(route_id)` + `POST /enrich-photos`: fotosuz deneyim duraklarına
  `photo_urls[0]` + `metadata.rating` (RouteFlood ⭐ zaten okuyordu) + `place_id`; kapak boşsa atanır.
- [x] app `createRoute`: üçüncü fire-and-forget çağrı; idempotent (fotolu durak atlanır).
- [x] Backfill: `py add_geometry.py --photos` / `--photos-only`.
- [x] Bonus: main.py'de mükerrer `SearchRequest` tanımı temizlendi.
- **CANLI TEST:** geçici rota → Ayasofya foto+⭐4.8, Galata Kulesi foto+⭐4.6, kapak otomatik; rota silindi.

### ✅ 3.2 Foto yükleme — TAMAMLANDI (7 Tem; 0008 uygulandı, kamera seçeneği + profil fotoğrafı dahil)
- [x] Migration `0008_storage.sql` yazıldı: photos bucket + RLS (kendi uid/ klasörüne insert, public select).
- [x] `expo-image-picker` kuruldu; yorum formunda 📷 → önizleme/kaldır → `uploadPhoto`
  (ArrayBuffer, başarısızsa yorum fotosuz gider) → yorumda thumbnail.
- [x] **Kamera seçeneği (7 Tem, kullanıcı isteği):** 📷 butonu "Fotoğraf çek / Galeriden seç" soruyor;
  kamera izni akışı + app.json'a expo-image-picker plugin'i (izin metinleri).
- [x] 👤 `0008_storage.sql` SQL Editor'de çalıştırıldı (7 Tem) — photos bucket canlı doğrulandı (public=true).
- [ ] CreateRoute durak modalına opsiyonel foto — 3.2a Places fotoğrafı zaten dolduruyor; düşük öncelik.
- **Kontrol 👤:** Foto'lu yorum atılıyor ve görünüyor.

### ✅ 3.3 Rozet paylaşımı — TAMAMLANDI (7 Tem)
- [x] Rozet diff tespiti (AsyncStorage `sana_badges_seen_v1`); ilk kurulumda mevcutlar sessizce
  kaydedilir, yeni rozet bir kez kutlanır (spring animasyon + haptic success).
- [x] Kutlama modalı: konfeti satırı + büyük rozet + "Paylaş" (view-shot, koyu marka kartı).
- **Kontrol 👤:** Yeni rozet aç (örn. ilk yolculuk) → kutlama → paylaş.

### ✅ 3.4 Journey log → Supabase — KOD TAMAM (7 Tem); 👤 migration bekliyor
- [x] Migration `0007_journeys.sql` yazıldı: journeys + RLS (insert/select own) + weekly_leaderboard view.
- [x] `journeyLog.ts`: önce Supabase, başarısızsa AsyncStorage kuyruğu (sonraki okumada otomatik flush);
  yerel kopya offline önbellek. Arayüz değişmedi — RouteFlood/Profile dokunulmadı.
- [x] 👤 `0007_journeys.sql` SQL Editor'de çalıştırıldı (7 Tem) — tablo+view canlı doğrulandı;
  duman testi: test yolculuğu → view'da "sana_seed — 4200 m, 1 yolculuk" → silindi.
- **Kontrol 👤:** Yolculuk farklı cihazdan görünüyor.

### ✅ 3.5 Haftalık liderlik — KOD TAMAM (7 Tem; view 0007'nin içinde)
- [x] `weekly_leaderboard` view: son 7 gün, toplulaştırılmış ilk 10 (ham satır sızdırmaz).
- [x] Home footer: "🏆 Bu haftanın gezginleri" kartı (ilk 5; veri yoksa görünmez).
- **Kontrol 👤:** (0007 sonrası) iki test hesabıyla sıralama doğru.

### ✅ 3.6 Davet linki — TAMAMLANDI (7 Tem)
- [x] Profil'e "Arkadaşını Davet Et" → `Share.share` ile EAS Update preview linki (INVITE_URL,
  config.ts; app.json projectId ile doğrulandı).
- **Kontrol 👤:** Link Expo Go'da app'i açıyor (expo-go-test-sharing akışı).

---

## FAZ 4 — JOURNEY V2

### ✅ 3.7 ORTAK ROTA DÜZENLEME — TAMAMLANDI (11 Tem) ★
- [x] Migration `0012_collaborators.sql` (👤 uygulandı, tablolar canlı doğrulandı):
  `route_share_tokens` (routes'tan AYRI — select_all token sızdırmasın) + `route_collaborators`
  + `join_route(token)` RPC (security definer) + waypoints RLS "sahibi VEYA collaborator".
- [x] RouteFlood: sahibi "🤝 Birlikte düzenle" ile davet linki paylaşır (INVITE_URL&join=token);
  davetli "✏️ düzenleyebilirsin" rozeti + ✕ çıkar + "＋ Durak ekle" (AddStopSheet ortak bileşeni).
- [x] App.tsx: linkteki ?join= yakalanır (expo-linking) → RPC → rota detayına navigasyon
  (oturum yoksa girişten sonra işlenir; aynı token bir kez).
- [x] (V2 kabulü) Canlı eş-zamanlılık yok — son yazan kazanır.
- [ ] 👤 İki hesapla saha testi: A davet eder → B linkten düzenler → A görür.

### ✅ 3.8 GERÇEK HARCAMA BİLDİRİMİ — TAMAMLANDI (12 Tem) ★
- [x] Migration 0013 (👤 uygulandı): `journeys.spent_try` + update-own policy +
  `route_spend_stats` RPC (yalnız ortalama+adet döner, ham satır sızmaz).
- [x] Yolculuk bitiş sheet'i: "💸 Ne kadar harcadın?" çipleri (₺0/100/250/500/1000+, opsiyonel,
  toggle); seçim buluta anında işlenir — kayıt çevrimdışı kuyruktaysa girdiye iliştirilir.
- [x] Rota detayında sosyal kanıt: "💸 Gerçek harcama: ort. ₺X · N gezgin bildirdi" —
  başkasının rotasını yapmayı düşünen gerçek maliyeti görür.
- [x] ~~Paylaşım kartına harcama satırı~~ — İPTAL (kullanıcı kararı, 12 Tem: kart kişisel
  kalsın; harcama yalnız rota detayında).
- [x] Rota sahibi ayrı alan girmez — ilk yolculuk bildirimi sayılır (tasarım kararı).

### ⬜ 3.9 ÇOK BEĞENİLENLER BÖLÜMÜ ★ KULLANICI İSTEĞİ (11 Tem)
- [ ] Home'a ayrı "🔥 Çok Beğenilenler" yatay şeridi: aktif şehirde like_count'u en yüksek
  rotalar (eşik: ≥1 beğeni; boşsa bölüm gizli) — "Sana özel"in altında, Popüler'in üstünde.
- [ ] Kartlarda beğeni sayısı vurgulu (❤️ N rozeti büyük); dokununca rota detayı.
- [ ] (Değerlendir) "Popüler Rotalar" zaten beğeniye göre sıralı — bu şerit öne çıkan İLK 5'i
  ayrıca vurgular; isim/ayrım cihaz turunda kullanıcıyla netleşir.
- **Kabul:** Beğeni alan rotalar Home'da ayrı bölümde parlıyor.

### ⬜ 3.10 ORTAK KOLEKSİYONLAR — Instagram tarzı ★ KULLANICI İSTEĞİ (11 Tem)
> Arkadaşınla ortak rota koleksiyonu ("Gezilecekler 🇮🇹"); ikiniz de rota ekler/çıkarır,
> ikiniz de güncel halini görürsünüz. 3.7 altyapısının (token+RPC+deep link) üst katmanı.
- [ ] Migration: `collections(id, owner_id, title, emoji)` + `collection_members` +
  `collection_routes(collection_id, route_id, added_by)` + `join_collection(token)` RPC
  (0012 deseninin aynısı; token ayrı tabloda).
- [ ] Kayıtlı sekmesi: "Koleksiyonlar" bölümü (liste + yeni koleksiyon) → koleksiyon detay
  ekranı (rotalar + üye avatarları + 🤝 davet + rota çıkar).
- [ ] Rota detayına "📁 Koleksiyona ekle" (sheet: koleksiyon seç / yeni oluştur).
- [ ] Davet linki: `INVITE_URL&joinCollection=<token>` — App.tsx'teki yakalayıcı genişler.
- [ ] Güncellik: focus-refresh (app geneliyle aynı); (V2) Supabase Realtime ile anlık.
- **Kabul:** A koleksiyon açar, B linkle katılır, ikisi de rota ekler — iki cihazda da görünür.

### ⬜ 4.0a AÇILIR/KAPANIR DETAY PENCERESİ ★ KULLANICI İSTEĞİ (7 Tem)
- [ ] Haritalı ekranlarda alttaki detay penceresi **açılır/kapanır** olacak — gerektiğinde
  TAM harita görülebilsin: RouteFlood detay sheet'i (öncelik) + Map ekranı alt kartları.
- [ ] Davranış: tutamaktan sürükle ya da dokun → kapalı (sadece tutamak/mini bar) ↔ açık
  (mevcut görünüm); harita her durumda etkileşimli kalır. Basit `Animated` yüksekliği yeter,
  kütüphane gerekmez; kapalıyken marker'lara padding ayarı güncellenir.
- **Kabul:** Sheet kapatılınca rota tüm ekranda görünüyor, tek dokunuşla geri açılıyor.

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

### ✅ 4.2 Gerçek iz kaydı — TAMAMLANDI (11 Tem)
- [x] Journey'de konum 10 m filtreyle `track`e biriktirilir (başlangıçta sıfırlanır).
- [x] Haritada canlı yürünen iz: ince turkuaz polyline (OSMMap `trackLine` prop'u), planlananın üstünde.
- [x] Bitişte iz ≤200 noktaya örneklenip karta (summary.track) + DB'ye yazılır
  (migration 0011 `journeys.path` — 👤 uygulandı, kolon canlı doğrulandı).
- **Kontrol 👤:** Sahada: haritada planlanan vs yürünen ayrımı + kartta iki iz.

### ⬜ 4.3 Keep awake 🤖
- [ ] `npx expo install expo-keep-awake` → journey aktifken `useKeepAwake()` (koşullu bileşen olarak).

### ⬜ 4.4 Varış bildirimi 🤖 (dev build ister)
- [ ] `npx expo install expo-notifications`; varışta yerel bildirim ("✓ Ayasofya'ya vardın — sıradaki: …").
- [ ] İzin akışı: journey başlarken iste.

---

## FAZ 5 — YAYIN & TESLİM

### ✅ 5.1 Auth açılışı — TAMAMLANDI (11 Tem)
- [x] `AUTH_ENABLED = true`; testçilerde kalan ORTAK dev oturumu açılışta bir kez otomatik
  kapatılır (herkes kendi hesabına geçer); yeni profil aktif şehirle oluşur.
- [x] **AuthScreen premium redesign** (kullanıcı isteği): koyu marka hero + tema-uyumlu form
  kartı + Giriş/Kayıt segmenti + ikonlu inputlar + şifre göster/gizle.
- [x] **Kayıtta doğum tarihi + cinsiyet** (opsiyonel; kullanıcı isteği): otomatik GG.AA.YYYY
  maskesi + cinsiyet çipleri → migration 0010 (profiles.birth_date/gender) → saveProfileDetails.
- [x] 👤 0010 uygulandı + confirm email kapatıldı (canlı doğrulandı: kayıt direkt oturum döner).
- [x] 👤 Cihaz turu: kayıt → onboarding → içeri ("mustfkplaan_2608" profili canlı görüldü).

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
| 7 Tem | Harita [+] · Home avatar→Profil · profil fotoğrafı (kullanıcı istekleri) | Map'te sağ üst rota-oluştur FAB'ı; Home avatarı Profil'e gider + fotoğrafı gösterir; Profil avatarına dokun → kamera/galeri + kare kırpma → photos bucket → profiles.avatar_url |
| 7 Tem | **3.0c ÇOK ŞEHİR TAMAM** 🏙️ | 5 şehir: 23 seed + şehir-bilinçli plan/üretici/arama + CityPicker (ilk açılışta otomatik). Bonus: arama Google Places'a geçti, SerpApi runtime'dan söküldü, çeyrek-marker fix v2. Seed beğenileri sıfırlandı (yeniden yazım) |
| 7 Tem | **2.7 AI ROTA ÜRETİCİ TAMAMLANDI** 🎲 | Semt seçimi + Places aday havuzu (≤4km) + iki aşamalı LLM (seçim→enrich anlatısı) + kalıcılık zinciri; 🎲 buton + akıllı tetik (no_match). Canlı ×2: Kadıköy 6 durak (15.7sn) + Balat 5 durak (HTTP). NIM yoğunken yavaşlayabiliyor (150sn timeout) |
| 7 Tem | Profil redesign + kamera (kullanıcı isteği) | Gezgin kartı (koyu hero: kimlik+istatistik+rozet ilerleme) + ayarlar tek kartta; yorum fotoğrafına "📷 Fotoğraf çek / 🖼️ Galeriden seç" seçimi (kamera izni plugin'i app.json'a eklendi) |
| 7 Tem | **FAZ 3 KODU BİTTİ** 🎉 (3.1–3.6) | 3.2a canlı test geçti (Ayasofya ⭐4.8 foto+kapak); 3.1 bottom-sheet + Story 9:16 + RouteTrace; 3.3 rozet kutlama; 3.4/3.5 journeys+liderlik (kod); 3.6 davet linki. 👤 kalan: 0007+0008 migration'ları SQL Editor'de + cihaz turu. Açık: 3.0b Rota-oluştur yeri, 3.0c çok şehir (beklemede), 3.1 polish (map snapshot+QR), CreateRoute durak fotosu |
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
