import type { TransportMode, Waypoint } from "./types";

// Rota başına renk (harita polyline + marker) — palet aktif temadan gelir (colors.routeColors)
export const routeColor = (i: number, palette: readonly string[]) =>
  palette[i % palette.length];

// --------------------------- Rota geometrisi ---------------------------
export interface LegSegment {
  coords: { lat: number; lng: number }[];
  mode: TransportMode;
}

/** Ardışık deneyim durakları → bacak segmentleri.
 *  Gerçek sokak geometrisi (leg_geometry) varsa onu, yoksa kuş uçuşu düz hattı kullanır. */
export function legSegments(exp: Waypoint[]): LegSegment[] {
  const out: LegSegment[] = [];
  for (let i = 1; i < exp.length; i++) {
    const prev = exp[i - 1];
    const cur = exp[i];
    const geo = cur.leg_geometry && cur.leg_geometry.length >= 2 ? cur.leg_geometry : null;
    out.push({
      mode: cur.transport_mode,
      coords: geo ?? [{ lat: prev.lat, lng: prev.lng }, { lat: cur.lat, lng: cur.lng }],
    });
  }
  return out;
}

/** Segmentleri tek kesintisiz yola birleştirir (fit/odak ve genel bakış çizgileri için). */
export const segmentsToPath = (segs: LegSegment[]) =>
  segs.flatMap((s, i) => (i === 0 ? s.coords : s.coords.slice(1)));

// Emoji değil Ionicons adı döner — emoji chrome'u kaldırıldı ("AI vibe" temizliği)
const TRANSPORT_ICON: Record<TransportMode, string> = {
  start: "location-outline", walk: "walk-outline", ferry: "boat-outline", metro: "subway-outline",
  tram: "train-outline", marmaray: "train-outline", bus: "bus-outline", metrobus: "bus-outline",
  funicular: "trail-sign-outline", teleferik: "trail-sign-outline", minibus: "bus-outline",
  taxi: "car-outline", bike: "bicycle-outline", other: "arrow-forward-outline",
};
export const transportIcon = (m: TransportMode) => TRANSPORT_ICON[m] ?? "arrow-forward-outline";

/** Servisin transit adımlarındaki araç emojisi → Ionicons adı (LineBadge vb.). */
const VEHICLE_ICON: Record<string, string> = {
  "🚌": "bus-outline", "🚇": "subway-outline", "🚊": "train-outline", "🚆": "train-outline",
  "⛴️": "boat-outline", "🚠": "trail-sign-outline", "🚡": "trail-sign-outline", "🚐": "bus-outline",
};
export const vehicleIcon = (v: string | null | undefined) => VEHICLE_ICON[v ?? ""] ?? "bus-outline";

const TRANSPORT_LABEL: Record<TransportMode, string> = {
  start: "Başlangıç", walk: "Yürüyüş", ferry: "Vapur", metro: "Metro",
  tram: "Tramvay", marmaray: "Marmaray", bus: "Otobüs", metrobus: "Metrobüs",
  funicular: "Füniküler", teleferik: "Teleferik", minibus: "Minibüs",
  taxi: "Taksi", bike: "Bisiklet", other: "Ulaşım",
};
export const transportLabel = (m: TransportMode) => TRANSPORT_LABEL[m] ?? "Ulaşım";

/** Dakikayı okunur süreye çevirir: 45 → "45 dk", 287 → "4 sa 47 dk", 120 → "2 sa". */
export function fmtDuration(min: number | null | undefined): string {
  if (!min || min <= 0) return "—";
  const m = Math.round(min);
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} sa ${rest} dk` : `${h} sa`;
}

// Waypoint kategori/kind → Ionicons adı (harita pini + listeler)
export function waypointIcon(w: Waypoint): string {
  if (w.kind === "utility") {
    if (w.category === "water_fountain") return "water-outline";
    if (w.category === "rest_area") return "pause-circle-outline";
    return "person-outline"; // public_toilet vb.
  }
  switch (w.category) {
    case "cafe": return "cafe-outline";
    case "restaurant": return "restaurant-outline";
    case "street_food": return "fast-food-outline";
    case "park": return "leaf-outline";
    case "historical_site": return "flag-outline";
    case "museum": return "business-outline";
    case "mosque": return "moon-outline";
    case "church": return "book-outline";
    case "bookstore": return "book-outline";
    case "gallery": return "color-palette-outline";
    case "bazaar": return "bag-handle-outline";
    case "viewpoint": return "camera-outline";
    case "waterfront": return "boat-outline";
    default: return "location-outline";
  }
}

export const budgetLabel = (lvl: number | null) =>
  lvl ? "₺".repeat(Math.max(1, Math.min(lvl, 4))) : "—";
