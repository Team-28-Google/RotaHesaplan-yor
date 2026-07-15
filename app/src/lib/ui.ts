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

// Vibe etiketleri (rota #tag'leri) sınırlı kelime dağarcığı — çevrilebilir (rota
// başlığından farklı). Bilinmeyen/serbest AI etiketi olduğu gibi gösterilir.
const VIBE_EN: Record<string, string> = {
  "sakin": "calm", "kafa-dinleme": "unwind", "kafa-dinlemelik": "unwind",
  "acik-hava": "outdoor", "kapali-mekan": "indoor", "acik": "open-air",
  "tarih": "history", "tarihi": "historic", "kultur": "culture", "kulturel": "cultural",
  "sanat": "art", "deniz": "sea", "sahil": "seaside", "manzara": "view", "manzarali": "scenic",
  "kahve": "coffee", "yesil": "green", "doga": "nature", "dogal": "natural",
  "yuruyus": "walk", "gece": "night", "fotograf": "photo", "fotografik": "photogenic",
  "ulasim": "transit", "toplu-tasima": "public transit", "vapur": "ferry", "yaya": "pedestrian",
  "gizemli": "mysterious", "romantik": "romantic", "huzurlu": "peaceful", "keyifli": "pleasant",
  "canli": "lively", "eglenceli": "fun", "macera": "adventure", "lezzet": "food",
  "lezzetli": "tasty", "yeme-icme": "food & drink", "aile": "family", "aileye-uygun": "family-friendly",
  "spor": "sport", "alisveris": "shopping", "butce-dostu": "budget-friendly", "ucuz": "cheap",
  "luks": "luxury", "populer": "popular", "sessiz": "quiet", "kalabalik": "crowded",
  "otantik": "authentic", "modern": "modern", "klasik": "classic", "bohem": "bohemian",
  "muze": "museum", "park": "park", "cami": "mosque", "kilise": "church",
};

/** Vibe etiketini aktif dile çevirir; TR'de aynen, EN'de bilinen slug çevrilir,
 *  bilinmeyen (serbest AI etiketi) olduğu gibi kalır. */
export function vibeLabel(tag: string, lang: string): string {
  if (lang === "tr") return tag;
  const key = tag.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, (c) => ({ "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u" }[c] ?? c)).replace(/\s+/g, "-");
  return VIBE_EN[key] ?? tag;
}

// Formatlama helper'ları context'e erişemez → aktif dili LocaleProvider senkronlar.
let _uiLang: "tr" | "en" = "tr";
export const setUiLang = (l: "tr" | "en") => { _uiLang = l; };

const TRANSPORT_LABEL: Record<"tr" | "en", Record<TransportMode, string>> = {
  tr: {
    start: "Başlangıç", walk: "Yürüyüş", ferry: "Vapur", metro: "Metro",
    tram: "Tramvay", marmaray: "Marmaray", bus: "Otobüs", metrobus: "Metrobüs",
    funicular: "Füniküler", teleferik: "Teleferik", minibus: "Minibüs",
    taxi: "Taksi", bike: "Bisiklet", other: "Ulaşım",
  },
  en: {
    start: "Start", walk: "Walk", ferry: "Ferry", metro: "Metro",
    tram: "Tram", marmaray: "Marmaray", bus: "Bus", metrobus: "Metrobus",
    funicular: "Funicular", teleferik: "Cable car", minibus: "Minibus",
    taxi: "Taxi", bike: "Bike", other: "Transit",
  },
};
export const transportLabel = (m: TransportMode) => TRANSPORT_LABEL[_uiLang][m] ?? TRANSPORT_LABEL[_uiLang].other;

/** Dakikayı okunur süreye çevirir (dile duyarlı): 45 → "45 dk"/"45 min", 287 → "4 sa 47 dk"/"4 h 47 min". */
export function fmtDuration(min: number | null | undefined): string {
  if (!min || min <= 0) return "—";
  const m = Math.round(min);
  const [hL, mL] = _uiLang === "tr" ? ["sa", "dk"] : ["h", "min"];
  if (m < 60) return `${m} ${mL}`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} ${hL} ${rest} ${mL}` : `${h} ${hL}`;
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
