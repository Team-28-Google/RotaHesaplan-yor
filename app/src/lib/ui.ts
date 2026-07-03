import type { TransportMode, Waypoint } from "./types";

// Rota başına renk (harita polyline + marker) — palet aktif temadan gelir (colors.routeColors)
export const routeColor = (i: number, palette: readonly string[]) =>
  palette[i % palette.length];

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
