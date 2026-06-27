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
}

// Harita için: rota + sıralı waypoint'leri bir arada
export interface RouteWithWaypoints extends Route {
  waypoints: Waypoint[];
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
  stops?: { seq: number; name: string; narrative: string }[];
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
  stops: { category: string; narrative: string }[];
}

export interface PlanResponse {
  ok: boolean;
  reason?: string;
  intent?: Record<string, unknown>;
  weather?: PlanWeather;
  route_id?: string;
  route?: RouteWithWaypoints;
  ai?: PlanAI;
}
