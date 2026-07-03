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

const TRANSPORT_ICON: Record<TransportMode, string> = {
  start: "📍", walk: "🚶", ferry: "⛴️", metro: "🚇", tram: "🚊",
  marmaray: "🚆", bus: "🚌", metrobus: "🚌", funicular: "🚡",
  teleferik: "🚡", minibus: "🚐", taxi: "🚕", bike: "🚲", other: "➡️",
};
export const transportIcon = (m: TransportMode) => TRANSPORT_ICON[m] ?? "➡️";

const TRANSPORT_LABEL: Record<TransportMode, string> = {
  start: "Başlangıç", walk: "Yürüyüş", ferry: "Vapur", metro: "Metro",
  tram: "Tramvay", marmaray: "Marmaray", bus: "Otobüs", metrobus: "Metrobüs",
  funicular: "Füniküler", teleferik: "Teleferik", minibus: "Minibüs",
  taxi: "Taksi", bike: "Bisiklet", other: "Ulaşım",
};
export const transportLabel = (m: TransportMode) => TRANSPORT_LABEL[m] ?? "Ulaşım";

// Waypoint kategori/kind → ikon
export function waypointIcon(w: Waypoint): string {
  if (w.kind === "utility") {
    if (w.category === "water_fountain") return "⛲";
    if (w.category === "rest_area") return "🪑";
    return "🚻"; // public_toilet vb.
  }
  switch (w.category) {
    case "cafe": return "☕";
    case "restaurant": return "🍽️";
    case "street_food": return "🥙";
    case "park": return "🌳";
    case "historical_site": return "🏛️";
    case "museum": return "🏛️";
    case "mosque": return "🕌";
    case "church": return "⛪";
    case "bookstore": return "📚";
    case "gallery": return "🖼️";
    case "bazaar": return "🛍️";
    case "viewpoint": return "🌅";
    case "waterfront": return "🌊";
    default: return "📌";
  }
}

export const budgetLabel = (lvl: number | null) =>
  lvl ? "₺".repeat(Math.max(1, Math.min(lvl, 4))) : "—";
