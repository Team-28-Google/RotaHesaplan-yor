// DB tablolarına karşılık gelen tipler (bkz. supabase/migrations).

export type WaypointKind = "experience" | "utility";

export type TransportMode =
  | "start" | "walk" | "ferry" | "metro" | "tram" | "marmaray"
  | "bus" | "metrobus" | "funicular" | "teleferik" | "minibus" | "taxi" | "bike" | "other";

export interface Waypoint {
  id: string;
  route_id: string;
  seq: number;
  name: string;
  place_id: string | null;
  lat: number;
  lng: number;
  category: string | null;
  price_level: number | null;
  note: string | null;
  photo_urls: string[] | null;
  kind: WaypointKind;
  transport_mode: TransportMode;
  transport_note: string | null;
  metadata: Record<string, unknown> | null;
  // Önceki duraktan bu durağa YÜRÜME bacağı (Google Routes, yazım anında hesaplanır).
  // null/eksik = kuş uçuşu çizilir (migration 0006 öncesi satırlar / transit bacaklar).
  leg_geometry?: { lat: number; lng: number }[] | null;
  leg_distance_m?: number | null;
  leg_duration_min?: number | null;
}

export interface Route {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  city: string;
  vibe_tags: string[] | null;
  budget_level: number | null;
  weather_fit: "indoor" | "outdoor" | "any" | null;
  cover_photo_url: string | null;
  total_distance_m: number | null;
  total_duration_min: number | null;
  is_seed: boolean;
  like_count: number;
  /** false = yalnız sahibi/collaborator görür; "🌍 Rotanı paylaş" ile herkese açılır (3.13) */
  is_public?: boolean;
  /** İçerik dili — keşif akışı aktif arayüz diline göre filtrelenir (0024). */
  lang?: "tr" | "en";
}

// Harita için: rota + sıralı waypoint'leri bir arada
export interface RouteWithWaypoints extends Route {
  waypoints: Waypoint[];
}

/** weekly_leaderboard view satırı (3.5) — son 7 gün, toplulaştırılmış ilk 10 */
export interface LeaderRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  journey_count: number;
  total_distance_m: number;
}

// AI /plan-route yanıtı
export interface PlanWeather {
  temp: number | null;
  desc: string;
  rainy: boolean;
  bias: string;
}
export interface PlanAI {
  title?: string;
  summary?: string;
  weather_note?: string;
  budget_note?: string;
  stops?: { seq: number; name: string; narrative: string; photo_tip?: string }[];
  social_signal?: string;
}
// Mekan arama sonucu (SerpApi)
export interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
  place_id?: string;
  address?: string;
  rating?: number;
  thumbnail?: string;
  price?: string;
  type?: string;
}

// Rota oluşturma
export interface CreateStop {
  name: string;
  note?: string;
  lat: number;
  lng: number;
}
export interface EnrichResult {
  ok: boolean;
  title: string;
  description: string;
  vibe_tags: string[];
  weather_fit: "indoor" | "outdoor" | "any";
  stops: { category: string; narrative: string; photo_tip?: string }[];
}

export interface PlanResponse {
  ok: boolean;
  reason?: string;
  intent?: Record<string, unknown>;
  weather?: PlanWeather;
  route_id?: string;
  route?: RouteWithWaypoints;
  ai?: PlanAI;
  /** Kullanıcı hafızasıyla kişiselleştirildi mi (2.1) */
  personalized?: boolean;
  /** Kullanılan profil cümlesi (örn. "sakin, deniz kenarı ... seven bir gezgin") */
  profile?: string | null;
  /** Agent pipeline adımları: gerçek süre + tek satır özet (2.6) */
  steps?: { name: string; ms: number; note?: string }[];
  /** ☔ Kapalı alternatif istendiyse hangi fit zorlandı (2.5) */
  forced_fit?: string | null;
  /** 🎲 AI Rota Üretici (2.7): rota havuzdan değil, az önce gerçek mekânlardan kuruldu */
  generated?: boolean;
}
