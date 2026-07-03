import AsyncStorage from "@react-native-async-storage/async-storage";

// Tamamlanan yolculukların yerel günlüğü (Profil istatistikleri + rozetler).
// MVP için cihazda tutulur; V2'de Supabase'e taşınabilir.

const KEY = "sana_journey_log_v1";

export interface JourneyEntry {
  routeId: string;
  title: string;
  city: string;
  distance_m: number;
  duration_min: number;
  stops: number;
  date: string; // ISO
}

export async function getJourneys(): Promise<JourneyEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as JourneyEntry[]) : [];
  } catch {
    return [];
  }
}

export async function addJourney(entry: JourneyEntry): Promise<void> {
  try {
    const all = await getJourneys();
    all.unshift(entry);
    await AsyncStorage.setItem(KEY, JSON.stringify(all.slice(0, 200)));
  } catch { /* yerel günlük — sessizce yoksay */ }
}
