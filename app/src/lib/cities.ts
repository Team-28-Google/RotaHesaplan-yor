import AsyncStorage from "@react-native-async-storage/async-storage";

// Çok şehir desteği (3.0c) — servisteki _DISTRICTS/_CITY_COORDS ile uyumlu.
// key: DB'deki ASCII kanonik ad · label: ekranda görünen Türkçe ad.

export interface CityInfo {
  key: string;
  label: string;
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  /** 🎲 üretim semtleri — servisteki _DISTRICTS adlarıyla birebir aynı */
  districts: string[];
}

export const CITIES: CityInfo[] = [
  {
    key: "Istanbul", label: "İstanbul",
    region: { latitude: 41.02, longitude: 28.99, latitudeDelta: 0.32, longitudeDelta: 0.32 },
    districts: ["Kadıköy · Moda", "Balat", "Karaköy · Galata", "Üsküdar", "Ortaköy", "Sultanahmet", "Bebek · Arnavutköy"],
  },
  {
    key: "Ankara", label: "Ankara",
    region: { latitude: 39.92, longitude: 32.85, latitudeDelta: 0.18, longitudeDelta: 0.18 },
    districts: ["Kızılay · Tunalı", "Ulus · Hamamönü", "Çankaya · Seğmenler"],
  },
  {
    key: "Gaziantep", label: "Gaziantep",
    region: { latitude: 37.066, longitude: 37.383, latitudeDelta: 0.12, longitudeDelta: 0.12 },
    districts: ["Kale · Çarşı", "Bey Mahallesi", "100. Yıl"],
  },
  {
    key: "Izmir", label: "İzmir",
    region: { latitude: 38.425, longitude: 27.13, latitudeDelta: 0.14, longitudeDelta: 0.14 },
    districts: ["Alsancak · Kordon", "Konak · Kemeraltı", "Karataş"],
  },
  {
    key: "Bursa", label: "Bursa",
    region: { latitude: 40.186, longitude: 29.065, latitudeDelta: 0.14, longitudeDelta: 0.14 },
    districts: ["Hanlar Bölgesi", "Yeşil · Irgandı", "Kültürpark"],
  },
  {
    key: "Mugla", label: "Muğla",
    // İl geniş (Bodrum→Fethiye ~150 km) — bölge tüm sahili kapsar
    region: { latitude: 36.9, longitude: 28.2, latitudeDelta: 1.3, longitudeDelta: 2.0 },
    districts: ["Bodrum", "Marmaris", "Datça", "Fethiye", "Akyaka"],
  },
];

// Tüm-Türkiye: "Konumumdan bul" ile gelen iller sabit listede yoktur — burada
// kalıcı kayda alınır (harita bölgesi = algılanan konum çevresi). AI o ilde üretir.
const DYN_KEY = "sana_city_dyn_v1";
let DYN: Record<string, CityInfo> = {};
AsyncStorage.getItem(DYN_KEY).then((s) => {
  if (s) DYN = { ...JSON.parse(s), ...DYN };
}).catch(() => { /* yoksay */ });

export async function registerCity(key: string, label: string, lat: number, lng: number): Promise<void> {
  if (CITIES.some((c) => c.key === key)) return;
  DYN[key] = {
    key, label,
    region: { latitude: lat, longitude: lng, latitudeDelta: 0.18, longitudeDelta: 0.18 },
    districts: [],
  };
  try { await AsyncStorage.setItem(DYN_KEY, JSON.stringify(DYN)); } catch { /* yoksay */ }
}

export function dynCities(): CityInfo[] {
  return Object.values(DYN);
}

export function cityInfo(key: string): CityInfo {
  return CITIES.find((c) => c.key === key) ?? DYN[key] ?? CITIES[0];
}

const KEY = "sana_city_v1";

export async function getActiveCity(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(KEY)) ?? "Istanbul";
  } catch {
    return "Istanbul";
  }
}

/** Kullanıcı hiç şehir seçti mi? null = hiç seçmedi (ilk açılışta seçici otomatik açılır). */
export async function getChosenCity(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function setActiveCity(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, key);
  } catch { /* yoksay */ }
}
