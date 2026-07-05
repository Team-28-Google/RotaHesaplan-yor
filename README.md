<div align="center">

# SANA

**Sosyal Rota & Yapay Zekâ Hafıza Platformu**

_Şehirde yalnız değilsin._


</div>

---

## Takım İsmi

**Team 28**

## Takım Rolleri

| Muhammet Mustafa KAPLAN | Product Owner |
| Eda ÇARKÇI              | Scrum Master |
| Betül SİRKECİ           | Developer |

## Ürün İsmi

**SANA**

## Ürün Açıklaması

SANA, şehirde yalnız hisseden insanlar için tasarlanmış bir **sosyal keşif ve rota planlama** uygulamasıdır. Klasik harita uygulamaları kullanıcıya en kısa yolu gösterir; SANA ise gerçek insanların yaşadığı günleri — kafe, sokak, kitapçı, sahil gibi durakları, her birinde fotoğraf ve kişisel notla birlikte — sıralı bir **harita hikâyesi** olarak keşfetmeyi sağlar.

Uygulamanın merkezinde **yapay zekâ hafızası** bulunur. Kullanıcı doğal dille "bugün kafa dinlemek istiyorum, bütçem az" gibi bir ifade girdiğinde; sistem kullanıcının tercihlerini, geçmiş davranışlarını ve o anki hava durumunu birlikte değerlendirerek kişiye özel bir gün planı üretir. Beğenilen rota, harita uygulamalarına benzer bir **canlı navigasyon** deneyimiyle adım adım takip edilir; tamamlandığında sosyal medyada paylaşılabilir bir özet kartına dönüştürülür.

> **Özet:** Doğal dilden kişiselleştirilmiş şehir rotası üreten, canlı navigasyonla yürüten ve sosyal olarak paylaştıran yapay zekâ destekli keşif uygulaması.

## Ürün Özellikleri

- **Seni Tanıyan Kişisel Öneriler** — Uygulama seni kullandıkça tanır. Beğendiğin rotalar, tamamladığın yolculuklar ve yaptığın yorumlar hatırlanır; böylece aynı cümleyi yazsan bile öneriler tam sana göre şekillenir.
- **İstediğini Kendi Cümlelerinle Anlat** — "Bugün kafa dinlemek istiyorum, bütçem az" gibi gündelik bir cümle yazman yeterli. Uygulama ne istediğini anlar ve sana özel bir gün planı hazırlar.
- **Planın Nasıl Hazırlandığını Gör** — Plan oluşturulurken uygulamanın hangi adımda olduğunu (isteğini anlama, tercihlerini hatırlama, havayı kontrol etme, sana uygun rotayı bulma, hikâyeni yazma) canlı olarak izlersin. Görünmez bir kutu değil; seninle birlikte düşünen bir yol arkadaşı hissi verir.
- **Gerçek Sokaklardan Geçen Rotalar** — Duraklar arası yollar harita üzerinde kuş uçuşu düz çizgiyle değil, gerçekten yürüyeceğin sokaklar ve tahmini yürüme süreleriyle gösterilir.
- **Adım Adım Canlı Yürüyüş** — Yolculuk sırasında bulunduğun yerden sıradaki durağa giden yol çizilir; sen ilerledikçe rota kendini günceller, harita yürüdüğün yöne döner ve varış süresi anlık değişir. Tıpkı bir navigasyon uygulaması gibi, ama şehri keşfetmek için.
- **Havaya Göre Uyum** — Yağmur varsa uygulama planını yeniden düşünür ve sana kapalı mekân alternatifleri önerir. Planın hava koşullarıyla uyumlu kalır.
- **Kendi Rotanı Oluştur** — Haritaya kendi duraklarını eklersin; uygulama rotana başlık, etiket ve akıcı bir hikâye yazarak sana yardımcı olur. Oluşturduğun rota kaydedilir ve başkalarıyla paylaşılabilir.
- **Topluluk Deneyimi ve Yorumlar** — Rotalara yorum yapabilir, puan verebilirsin. Yeterince yorum biriktiğinde, o rotayı gezenlerin ortak izlenimlerini özetleyen kısa bir topluluk değerlendirmesi görürsün.
- **Favoriler, İstatistikler ve Rozetler** — Beğendiğin rotaları kaydeder, tamamladığın yolculukların istatistiklerini ve kazandığın rozetleri profilinde bir arada görürsün.
- **Paylaşılabilir Yolculuk Kartı** — Bitirdiğin bir yolculuk, sosyal medyada paylaşabileceğin şık ve özet bir görsele dönüşür.
- **Koyu ve Açık Tema** — Harita dahil tüm arayüzü göz zevkine göre koyu ya da açık temaya alabilirsin; tercihin hatırlanır.

## Hedef Kitle

- Şehirde yeni olan veya yalnız vakit geçiren, ne yapacağına karar vermekte zorlanan bireyler
- Keşif ve deneyim odaklı gezginler
- Rutinden uzaklaşmak, spontane plan yapmak isteyen 15–40 yaş arası şehir sakinleri
- Gezdiği yerleri sosyal olarak paylaşmayı seven kullanıcılar
- Başlangıç şehri İstanbul; mimari çok şehirli kullanıma uygun tasarlanmıştır

## Product Backlog

| Doküman | Bağlantı |

| Product Backlog ve Sprint Dokümanı (Google Docs) |

 [Bağlantı](https://docs.google.com/document/d/1V6ZFwyk_IGDACvW2ceZccBPBLeglqC88d44AO_4shRs/edit?usp=sharing) |
| Backlog ve Sprint Tablosu (Google Sheets) |

 [Bağlantı](https://docs.google.com/spreadsheets/d/1AVFdYQgp5Mha5J03qgG6b1DjximQ1Ydr351EOIji-Qg/edit?usp=sharing) |

> **Not:** Google Docs birden fazla sekme içerir (Sprint 1/2/3, Daily Scrum(konuşma kayıtları)) ve ekran görüntülerinin bulunduğu ayrı bir **Ürün Görselleri** sekmesi barındırır. İnceleme sırasında sekmelerin kontrol edilmesi önerilir.

Repo içi başlangıç backlog'u için: [`docs/PRODUCT_BACKLOG.md`](docs/PRODUCT_BACKLOG.md)

---

## Genel Mimari

SANA, yapay zekâ öncelikli üç katmanlı bir mimariye sahiptir. Kimlik doğrulama, veri ve depolama işlemleri doğrudan Supabase üzerinden yürütülür; ince bir FastAPI servisi yalnızca yapay zekâ orkestrasyonundan sorumludur.

```
┌──────────────────────────────┐
│      Mobil Uygulama          │   React Native + Expo (SDK 54)
│  Harita · Akış · Navigasyon  │   react-native-maps · expo-location
└──────────────┬───────────────┘
               │
      ┌────────┴────────────────────────────┐
      │                                      │
      ▼ (RLS ile doğrudan)                   ▼ (yapay zekâ istekleri)
┌──────────────────────┐          ┌───────────────────────────┐
│      Supabase        │          │   AI Servis (FastAPI)     │
│  Postgres + pgvector │◄─────────┤   Deterministik pipeline  │
│  Auth · Storage · RLS│          │   /plan-route /memory ... │
└──────────────────────┘          └────────────┬──────────────┘
                                               │
              ┌────────────────────────────────┼───────────────────────┐
              ▼                                ▼                        ▼
    Gemini 2.5-flash-lite          NVIDIA nv-embedqa-e5-v5      Google API'ler
       (sohbet: niyet + anlatı)      (embedding, 1024 boyut)      Routes · Weather
                                                                  + Photon/OSM (arama)
```

### Yapay Zekâ Pipeline'ı

Plan üretimi, her aşaması ölçülen ve kullanıcıya gösterilen altı adımlı deterministik bir akıştır:

```
1. Niyet Çözümleme   Serbest metin, yapılandırılmış JSON'a çevrilir (ruh hali, bütçe, tercih)
2. Hafıza Tarama     Kullanıcının onboarding profili ve son davranışları okunur
3. Hava Kontrolü     Google Weather API (yağış durumunda kapalı mekân eğilimi)
4. Rota Eşleştirme   NVIDIA embedding, pgvector kosinüs benzerliği (match_routes)
5. Rota Seçimi       Bütçe, hava ve tercih filtreleri uygulanır
6. Anlatı Yazımı     Seçilen rota için sıcak, kişiselleştirilmiş günlük anlatısı üretilir
```

> **Model stratejisi:** Sohbet çağrıları Gemini, embedding işlemleri NVIDIA ile yürütülür (vektör boyutu veritabanı şemasında 1024 olarak sabittir). Sağlayıcı, `LLM_PROVIDER` ortam değişkeniyle değiştirilebilir.

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Mobil | React Native, Expo SDK 54, TypeScript, React Navigation, expo-image, expo-haptics |
| Harita | react-native-maps (Google), Routes API (geometri ve navigasyon), Weather API |
| Backend | Supabase — PostgreSQL, pgvector (HNSW), Row Level Security, Auth, Storage |
| AI Servis | Python, FastAPI, deterministik pipeline |
| Dil Modelleri | Gemini 2.5-flash-lite (sohbet), NVIDIA nv-embedqa-e5-v5 (embedding) |
| Arama | Photon / OpenStreetMap (sunucusuz, anahtarsız) |
| Dağıtım | EAS Update (Expo Go önizleme linki), Render (AI servis) |

## Monorepo Yapısı

| Dizin | İçerik |
|---|---|
| `app/` | React Native + Expo mobil uygulama (ekranlar, harita, navigasyon, tema) |
| `ai-service/` | Python / FastAPI — yapay zekâ orkestrasyonu, hafıza, rota geometrisi, hava |
| `supabase/` | SQL migration dosyaları (şema, RLS, pgvector) ve seed verisi |
| `docs/` | Yol haritası, yapılacaklar listesi, ürün backlog'u ve Scrum çıktıları |

## Kurulum

```bash
# 1) Ortam değişkenleri
cp app/.env.example app/.env
cp ai-service/.env.example ai-service/.env

# 2) Veritabanı — Supabase SQL editöründe sırayla çalıştırın
#    supabase/migrations/0001 ... 0006

# 3) AI servis
cd ai-service && python -m venv .venv
.venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 4) Mobil uygulama
cd app && npm install && npx expo start
```

> Güncel geliştirme durumu ve teknik kararlar için [`PROGRESS.md`](PROGRESS.md), yol haritası için [`docs/ROADMAP.md`](docs/ROADMAP.md) dosyalarına bakınız.

---

<div align="center">

Team 28 · Google AI Academy 2026

</div>
