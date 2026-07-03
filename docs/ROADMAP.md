# SANA — Premium Yol Haritası

> 📋 **Uygulama katmanı:** her maddenin adım adım talimatı [TODO.md](TODO.md)'de.

> **Hedef:** SANA'yı "bootcamp projesi" görünümünden **premium, paylaşılası, jüri deviren** bir ürüne taşımak.
> **Deadline:** 2 Ağustos 2026 23:59 (public GitHub + 3 dk YouTube). Bugün: 3 Temmuz → **30 gün**.
> **Puan gerçeği:** Rubrik AI-ağırlıklı (agent+hafıza+orkestrasyon 15 + model 20 + final AI 35 = **70/100 AI**).
> Yani: Faz 2 (AI) not getirir, Faz 1-3 (premium his + viral) demo/jüri etkisi ve büyüme getirir. İkisi de lazım, sıra önemli.
>
> **İşaretler:** `👤` = kullanıcı hesabı/erişimi gerekir (Google Cloud, EAS, Render…) · `🤖` = Claude oturumda tek başına yapabilir
> · Efor: **S** ≤ yarım gün · **M** = 1 gün · **L** = 2-3 gün

---

## Zaman Çizelgesi (öneri)

| Hafta | Tarih | Odak |
|---|---|---|
| 1 | 3–9 Tem | **Faz 0** (temel sağlamlaştırma) + **Faz 1** başlangıç |
| 2 | 10–16 Tem | **Faz 1** bitiş + **Faz 2** (AI) başlangıç |
| 3 | 17–23 Tem | **Faz 2** bitiş + **Faz 3** (sosyal/viral) |
| 4 | 24–30 Tem | **Faz 4** (journey v2) + **Faz 5** (yayın) |
| Son | 31 Tem–2 Ağu | Tampon + video + teslim ✅ |

---

## FAZ 0 — Temel Sağlamlaştırma (her şeyin üstüne kurulacağı zemin)

### 0.1 Git düzeni 🤖 — S
- [x] Mevcut 4 turluk değişikliği anlamlı commit'lere böl ✅ (3 Tem — 7 tematik commit + GitHub push)
- **Neden:** Ekip 5 kişi; okunabilir geçmiş = Scrum kanıtı (rubrikte var).
- **Kabul:** `git log` hikâye anlatıyor; her commit tek konu.

### ✅ 0.2 Anahtar güvenliği — TAMAMLANDI (3 Tem)
- [x] Google Maps key rotate + **4 API kısıtı** (Maps SDK/Weather/Routes/Places; Android+SHA-1 kısıtı store'a çıkarken).
- [x] NVIDIA rotate + eski revoke; Supabase **yeni nesil sb_ anahtarlara geçiş + legacy disable**
  (eski anon/service_role 401 — kanıtlı); dev şifresi değişti. SerpApi düşük öncelik (yalnız seed).
- [x] Maps key `app.config.js` + `app/.env`'e taşındı; **git geçmişi filter-repo ile kazındı** + force-push.
- **Kabul ✅:** Repo'da ve geçmişte çalışan gizli anahtar yok; her şey canlı testle doğrulandı.

### 0.3 EAS development build 👤 (build) + 🤖 (config) — M
- [ ] `eas build --profile development --platform android` → APK'yı telefona kur.
- **Neden:** İkon/splash ancak build'de görünür; Google Maps key native aktifleşir; bildirim/keep-awake açılır.
  (Not: çeyrek-marker bug'ı artık build gerektirmiyor — bitmap çözümüyle Expo Go'da bile çözüldü ✅)
- **Kabul:** Dev build'de markalı ikon/splash + harita + canlı reload çalışıyor.

### 0.4 AI servisini buluta taşı 👤 (hesap) + 🤖 (deploy dosyaları) — M
- [ ] FastAPI'yi Render/Railway/Fly ücretsiz tier'a deploy et (`Dockerfile` veya `render.yaml` hazırlanır).
- [ ] `AI_SERVICE_URL`'i sabit https adresine çevir; LAN IP bağımlılığı ölür.
- **Neden:** Şu an Planla ekranı sadece senin Wi-Fi'ında çalışıyor. Testçiler + jüri demo'su için kritik.
- **Kabul:** Telefon mobil veriyle `/plan-route` çağırabiliyor.

### ✅ 0.5 Hava anahtarı — GEREKSİZLEŞTİ (3 Tem)
- [x] Hava artık **Google Weather API**'den (canlı: İstanbul 25.3° ✅); OpenWeather sadece yedek yol.
  Faz 2.5'in ön koşulu hazır.

---

## ✅ FAZ 1 — Premium His — TAMAMLANDI (3 Tem)

### ✅ 1.1 Uygulama ikonu + splash
- [x] Koyu lacivert + mercan rota motifli ikon seti üretildi (GDI+; icon, adaptive set, monochrome, splash,
  favicon) + app.json bağlandı. *Görsel doğrulama dev build'de (0.3) — Expo Go ikon göstermez.*

### ✅ 1.2 `expo-image`'e geçiş
- [x] Home kapakları + arama thumb'ları expo-image (blurhash placeholder + transition + disk cache).
  Marker fotoları RN Image'da kaldı (bitmap üretim hattının parçası — bilinçli).

### ✅ 1.3 Skeleton loader'lar
- [x] Home (hero+kartlar), RouteFlood (hero+timeline), Saved — spinner'lar gitti.

### ✅ 1.4 Haptics
- [x] Favori, varış, yolculuk başlatma, paylaşım, onboarding seçimleri — `lib/haptics.ts` sarmalayıcı.

### ✅ 1.5 Mikro-animasyonlar
- [x] Kalp pop, PressableScale kartlar, journey bar slide-in, özet kartı scale-in (çekirdek Animated ile).
  Rozet konfetisi → Faz 3.3'e taşındı (rozet paylaşımıyla birlikte).

### ✅ 1.6 Onboarding akışı ★
- [x] 3 adım (tanıtım + vibe çoklu seçim + bütçe), AsyncStorage kalıcılık, ilk açılış kapısı,
  Profil → "Tercihlerimi Düzenle". **Faz 2.1 bunun üstüne kurulacak.**

### ✅ 1.7 Boş/hata durumları turu
- [x] Home boş/hata+retry, Map boş kartı+retry, Saved hata durumu. Plan/Profile mevcut durumları yeterli.

---

## FAZ 2 — AI Farklılaştırıcılar (rubrik puanının %70'i buradan)

### 2.1 Onboarding → AI hafıza 🤖 (app) + 🤖 (ai-service) — M ★★★
- [ ] Onboarding tercihlerini `/embed` üzerinden `ai_memory_embeddings`'e yaz (source_type=`onboarding`, owner_id=user).
- [ ] `/plan-route`'a `user_id` parametresi; pipeline kullanıcının onboarding hafızasını intent'e harmanlar.
- **Neden:** "Agent + memory" rubrik kaleminin kalbi. Demo cümlesi: *"SANA seni hatırlıyor."*
- **Kabul:** Aynı "kafa dinlemek istiyorum" cümlesi, farklı onboarding tercihli iki kullanıcıya farklı rota getiriyor.

### 2.2 Davranış hafızası 🤖 — M ★★
- [ ] Favori + tamamlanan yolculuk + yorumlar → `preference_update` embed'leri (arka planda).
- **Kabul:** 2-3 favori sonrası plan önerileri gözle görülür kayıyor.

### 2.3 Plan sonucunu kaydet/başlat 🤖 — S
- [ ] PlanResult'a "❤️ Kaydet" + "🧭 Yolculuğa Başla" (RouteFlood'a route_id ile git).
- **Neden:** AI planı şu an çıkmaz sokak; döngüyü kapat (plan → kaydet → yürü → paylaş).

### 2.4 "Topluluk ne diyor" — AI yorum özeti 🤖 — M ★
- [ ] ai-service'e `/summarize-comments`: rota yorumlarını 2 cümle + 3 etikete özetler; RouteFlood hero'da göster (cache'li).
- **Kabul:** ≥3 yorumlu rotada anlamlı özet kutusu.

### 2.5 Hava-duyarlı yeniden planlama 🤖 — M (0.5 OpenWeather'a bağlı)
- [ ] Plan sonucunda yağmur/sıcak uyarısı + "kapalı mekân alternatifi öner" butonu (weather_fit=indoor'a yeniden sorgu).
- **Demo değeri yüksek:** jüriye canlı "yağmur yağıyor → plan değişti" gösterilebilir.

### 2.6 Agent orkestrasyon görünürlüğü 🤖 — S ★ (video için)
- [ ] Plan yüklenirken adım adım durum: "Niyet çözümleniyor → Hafıza taranıyor → Hava kontrol → Rota kuruluyor…"
  (pipeline'daki gerçek adımlar; sahte progress değil — `/plan-route` streaming ya da adım logu döner).
- **Neden:** Rubrikteki "orkestrasyon"u jüri **gözüyle görür**; ayrıca premium bir bekleme deneyimi.

---

## FAZ 3 — Sosyal & Viral (patlama planı)

### 3.1 Paylaşım kartı v2 🤖 — M ★
- [ ] 9:16 **story formatı** (tam ekran dikey varyant) + gerçek **harita izi** (MapView `takeSnapshot` → kart arkaplanı).
- [ ] Kart altına "sana'yı dene" + QR (expo linki / ileride store linki).
- **Kabul:** Instagram story'ye atılan kart profesyonel görünüyor, izleyen "bu hangi app?" diye soruyor.

### 3.2 Foto yükleme (Supabase Storage) 🤖 — L
- [ ] Storage bucket + RLS; yorumlara foto ekleme; rota oluştururken durak fotoğrafı çekme.
- **Neden:** UGC foto = akışın canlanması + seed verinin ötesine geçiş. (Sprint 3'ün eski borcu.)

### 3.3 Rozet paylaşımı 🤖 — S
- [ ] Rozet açılınca mini kutlama + "Paylaş" (aynı view-shot altyapısı).
- **Neden:** Strava'nın ikinci viral döngüsü: başarı paylaşımı.

### 3.4 Journey log'u Supabase'e taşı 🤖 — M
- [ ] `journeys` tablosu + RLS + migration; AsyncStorage'dan senkron. Cross-device istatistik + 3.5'in zemini.

### 3.5 Haftalık liderlik tablosu 🤖 — M
- [ ] "Bu hafta İstanbul'da en çok yürüyenler" (journeys üzerinden basit sorgu; Profile ya da Home'da kart).
- **Neden:** Strava'nın rekabet kancası; ekip içi demo'da bile eğlenceli.

### 3.6 Davet/deep link 👤+🤖 — S
- [ ] `exp://` / `https://` paylaşım linki + "arkadaşını davet et" satırı (Profil). Store yokken expo update linkiyle.

---

## FAZ 4 — Journey v2 (saha kalitesi)

### 4.1 Cihazda konum doğrulama 👤 (saha testi) — M ⚠️ hâlâ açık (PROGRESS §10)
- [ ] Gerçek sokakta test: takip, auto-advance eşiği (30m doğru mu?), rehber çizgi. Bulguya göre ayar.

### 4.2 Gerçek iz kaydı 🤖 — M
- [ ] Yolculuk boyunca GPS noktalarını topla → yürünen gerçek iz; paylaşım kartında planlanan değil **yürünen** rota.

### 4.3 Ekran uyanık tutma 🤖 — S
- [ ] `expo-keep-awake` yolculuk modunda; bar'da pil dostu uyarı.

### 4.4 Varış bildirimi 🤖 — S (dev build ister)
- [ ] Durağa varınca yerel bildirim + haptic (ekran kapalıyken bile).

---

## FAZ 5 — Yayın & Teslim

### 5.1 Auth'u aç 🤖+👤 — S
- [ ] `AUTH_ENABLED=true`; Supabase'de e-posta onayı kararı (demo için kapalı öneririm); RLS son tur.

### 5.2 EAS preview APK + testçi dağıtımı 👤 — M
- [ ] `eas build --profile preview` → APK linki testçilere; EAS Update kanalı çalışır durumda (mevcut altyapı hazır).

### 5.3 Public repo hazırlığı 🤖 — M (0.2'ye bağlı ⚠️)
- [ ] README: mimari diyagram, kurulum, ekran görüntüleri, AI pipeline şeması; LICENSE; `.env.example` güncel.
- **Kabul:** Repo'yu ilk gören 5 dakikada projeyi anlıyor ve çalıştırabiliyor.

### 5.4 3 dk YouTube demo videosu 👤+🤖 (senaryo) — L
- [ ] Senaryo (AI ağırlıklı akış): onboarding → "bugün kafamı dinlemek istiyorum" → agent adımları görünür →
  kişisel plan → yolculuk + varış → paylaşım kartı → Instagram. Rubrik kalemleriyle birebir eşleşen anlatım metni.

### 5.5 Analytics + crash (opsiyonel premium) 🤖 — M
- [ ] Sentry (expo plugin) + basit event'ler (plan_created, journey_finished, card_shared). V2'ye devredilebilir.

---

## V2 / Bilinçli ertelenenler
- Gerçek sosyal graf (takip/feed) — PROGRESS'te zaten ertelendi.
- Store yayını (Google Play/App Store) — bootcamp sonrası.
- Monetizasyon ("SANA Pro": sınırsız AI plan, özel rozetler) — ürün tutarsa.
- Çoklu şehir (şu an İstanbul-sabit; şema hazır, `city` alanı var).

---

## İlerleme günlüğü
| Tarih | Yapılan | Not |
|---|---|---|
| 3 Tem | Yol haritası oluşturuldu | — |
| 3 Tem | **FAZ 0 büyük ölçüde bitti** | 0.1 git ✅ · 0.2 güvenlik ✅ (tam) · 0.5 hava ✅ (Google Weather). Kalan: 0.3 dev build, 0.4 Render deploy |
| 3 Tem | **FAZ 1 TAMAMLANDI** | 1.1–1.7 hepsi ✅; cihazda doğrulananlar: tema/animasyon/onboarding. İkon/splash dev build bekliyor |
| 3 Tem | Plansız bonuslar | Google Routes sokak geometrisi (cihazda ✅) + çeyrek-marker kesin çözümü (cihazda ✅) + Google Weather |
