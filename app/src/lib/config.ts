// Genel yapılandırma.
// NOT: publishable key tasarımı gereği publictir; RLS politikaları korur. Client
// paketine gömülmesi normaldir (secret key ASLA burada olmaz).

export const SUPABASE_URL = "https://vwqeupcbmlqkbhmwqyuq.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_t3W_PR3kQGe-b_WfnATq6g_OqErHKGd";

// AI servisi (FastAPI) — Render bulutunda (0.4, 8 Tem): her yerden erişilir,
// testçiler dahil. Free tier 15 dk boşta uyur → ilk istek ~30 sn (timeout'lar karşılar).
// Lokal geliştirme/debug gerekirse: "http://<PC-IP>:8000" + npm run ai.
export const AI_SERVICE_URL = "https://sana-ai-5ejj.onrender.com";

// Giriş ekranı aç/kapa. true = herkes kendi hesabıyla girer (5.1, 11 Tem —
// testçiler ortak dev hesabında çakışıyordu). Lokal geliştirmede hızlı girmek
// istersen geçici false yap (dev hesabı app/.env'den okunur), commit'leme.
export const AUTH_ENABLED = true;
// Dev kimlik bilgileri app/.env'den gelir (EXPO_PUBLIC_*); repo'da tutulmaz.
export const DEV_EMAIL = process.env.EXPO_PUBLIC_DEV_EMAIL ?? "";
export const DEV_PASSWORD = process.env.EXPO_PUBLIC_DEV_PASSWORD ?? "";

// Servis bot kalkanı (güvenlik #3a): anonim maliyet uçlarına gönderilen paylaşımlı
// sır. Gerçek sır değil (derlemeye gömülür) — amaç rastgele botları elemek.
// app/.env → EXPO_PUBLIC_APP_KEY; servis → SANA_APP_SECRET (aynı değer). Boşsa kontrol yok.
export const APP_KEY = process.env.EXPO_PUBLIC_APP_KEY ?? "";

// Davet linki (3.6) — EAS Update preview kanalı; Expo Go'da açılır, APK gerekmez.
// projectId app.json extra.eas.projectId ile aynı olmalı. Güncel link: npm run share:link
export const INVITE_URL = "exp://u.expo.dev/56ef00aa-02fe-4a2f-89c6-fc8ac4ae31cf?channel-name=preview";

// İstanbul merkez (harita başlangıç bölgesi)
export const ISTANBUL_REGION = {
  latitude: 41.02,
  longitude: 28.99,
  latitudeDelta: 0.32,
  longitudeDelta: 0.32,
};
