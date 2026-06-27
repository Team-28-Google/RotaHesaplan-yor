// Genel yapılandırma.
// NOT: anon key tasarımı gereği publictir; RLS politikaları korur. Client paketine
// gömülmesi normaldir (service_role ASLA burada olmaz).

export const SUPABASE_URL = "https://vwqeupcbmlqkbhmwqyuq.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cWV1cGNibWxxa2JobXdxeXVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNTU4MjcsImV4cCI6MjA5NzczMTgyN30.-1eH5R0WjP8ow2QrDd0xC8ycuqKHaaOFs4IMSuJPwto";

// AI servisi (FastAPI). Telefon, PC'ye yerel ağ IP'si ile erişir.
// PC IP değişirse burayı güncelle (PowerShell: ipconfig → Wi-Fi IPv4).
export const AI_SERVICE_URL = "http://192.168.1.5:8000";

// Giriş ekranı aç/kapa. false = giriş ekranı GÖSTERME, dev hesabıyla otomatik gir.
// Demo/teslimde true yap → kullanıcılar kendi hesaplarıyla girer.
export const AUTH_ENABLED = false;
export const DEV_EMAIL = "dev@sana.app";
export const DEV_PASSWORD = "***REMOVED***";

// İstanbul merkez (harita başlangıç bölgesi)
export const ISTANBUL_REGION = {
  latitude: 41.02,
  longitude: 28.99,
  latitudeDelta: 0.32,
  longitudeDelta: 0.32,
};
