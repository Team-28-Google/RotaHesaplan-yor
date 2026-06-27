# SANA — Mobil Uygulama (Expo / React Native)

Harita odaklı sosyal rota uygulaması. Sprint 1: haritada 7 seed rotayı göster →
dokun → flood detayı (sıralı duraklar + ulaşım ikonları + utility WC pin'leri).

**Harita = OpenStreetMap** (WebView + Leaflet) → **kartsız, keysiz, ücretsiz.**
iPhone ve Android'de Expo Go'da doğrudan çalışır (internet gerekir: OSM tiles + Leaflet CDN).

## Çalıştırma

```bash
cd app
npm start          # = expo start  (npm run start de olur)
```
Çıkan **QR kodu Expo Go** ile tara (App Store / Play Store'dan ücretsiz). `a`=Android, `i`=iOS.

> Google Maps / billing / API key **gerekmez** — harita OSM ile geliyor. Maliyetli
> veri API'leri (Places/Directions) yerine de SerpApi kullanıyoruz.

## Yapı

```
App.tsx                      NavigationContainer + Stack (Map, RouteFlood)
index.ts                     Expo giriş
app.json                     name=SANA, expo-location izinleri
src/
  navigation.ts              RootStackParamList tipleri
  components/OSMMap.tsx       OpenStreetMap (WebView+Leaflet): marker/polyline/tıklama
  lib/
    config.ts                Supabase URL + anon key (public), İstanbul bölgesi
    supabase.ts              Supabase client (url-polyfill)
    types.ts                 Route / Waypoint tipleri (DB ile uyumlu)
    api.ts                   fetchRoutes(), fetchRoute(id) — Supabase public okuma
    ui.ts                    routeColor, transportIcon/Label, waypointIcon, budgetLabel
  screens/
    MapScreen.tsx            Tüm rotalar (polyline + başlangıç noktası); dokun → detay
    RouteFloodScreen.tsx     Rota haritası + sıralı durak zaman çizelgesi (flood)
```

## Veri akışı

App → Supabase (anon, RLS public select) → `routes` + `waypoints` (7 seed rotası).
AI servisi (`/plan-route`) Sprint 2'de eklenecek.

## Doğrulandı
`tsc --noEmit` 0 hata · `expo-doctor` 21/21 · `expo export` (iOS + Android) temiz.
