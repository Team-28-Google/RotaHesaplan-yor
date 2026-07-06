// Genel yapılandırma.
// NOT: publishable key tasarımı gereği publictir; RLS politikaları korur. Client
// paketine gömülmesi normaldir (secret key ASLA burada olmaz).

export const SUPABASE_URL = "https://vwqeupcbmlqkbhmwqyuq.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_t3W_PR3kQGe-b_WfnATq6g_OqErHKGd";

// AI servisi (FastAPI). Telefon, PC'ye yerel ağ IP'si ile erişir.
// PC IP değişirse burayı güncelle (PowerShell: ipconfig → Wi-Fi IPv4).
export const AI_SERVICE_URL = "http://192.168.1.5:8000";

// Giriş ekranı aç/kapa. false = giriş ekranı GÖSTERME, dev hesabıyla otomatik gir.
// Demo/teslimde true yap → kullanıcılar kendi hesaplarıyla girer.
export const AUTH_ENABLED = false;
// Dev kimlik bilgileri app/.env'den gelir (EXPO_PUBLIC_*); repo'da tutulmaz.
export const DEV_EMAIL = process.env.EXPO_PUBLIC_DEV_EMAIL ?? "";
export const DEV_PASSWORD = process.env.EXPO_PUBLIC_DEV_PASSWORD ?? "";

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
