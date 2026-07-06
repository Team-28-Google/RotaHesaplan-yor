import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./supabase";

// Tamamlanan yolculukların günlüğü (Profil istatistikleri + rozetler + liderlik).
// Önce Supabase'e yazılır (çok cihazda görünsün); ulaşılamazsa yerel kuyruğa
// girer ve sonraki okumada tekrar gönderilir. Yerel kopya offline okuma önbelleğidir.

const KEY = "sana_journey_log_v1";        // okuma önbelleği (offline)
const QUEUE_KEY = "sana_journey_queue_v1"; // henüz buluta gönderilememiş kayıtlar

export interface JourneyEntry {
  routeId: string;
  title: string;
  city: string;
  distance_m: number;
  duration_min: number;
  stops: number;
  date: string; // ISO
}

async function readLocal(key: string): Promise<JourneyEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as JourneyEntry[]) : [];
  } catch {
    return [];
  }
}

async function writeLocal(key: string, list: JourneyEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch { /* yerel önbellek — sessizce yoksay */ }
}

async function insertRemote(entry: JourneyEntry): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await supabase.from("journeys").insert({
      user_id: user.id,
      route_id: entry.routeId,
      title: entry.title,
      city: entry.city,
      distance_m: Math.round(entry.distance_m),
      duration_min: Math.round(entry.duration_min),
      stops: entry.stops,
      created_at: entry.date, // kuyruktan geç gönderilse de yolculuk zamanı korunur
    });
    return !error;
  } catch {
    return false;
  }
}

/** Kuyruktaki gönderilememiş yolculukları buluta taşımayı dener (idempotent). */
export async function flushJourneyQueue(): Promise<void> {
  const q = await readLocal(QUEUE_KEY);
  if (!q.length) return;
  const remaining: JourneyEntry[] = [];
  for (const e of q) {
    if (!(await insertRemote(e))) remaining.push(e);
  }
  await writeLocal(QUEUE_KEY, remaining);
}

export async function addJourney(entry: JourneyEntry): Promise<void> {
  // Yerel önbellek her durumda güncellenir (offline'da Profil doğru kalsın)
  const all = await readLocal(KEY);
  all.unshift(entry);
  await writeLocal(KEY, all.slice(0, 200));

  if (!(await insertRemote(entry))) {
    const q = await readLocal(QUEUE_KEY);
    q.push(entry);
    await writeLocal(QUEUE_KEY, q);
  }
}

export async function getJourneys(): Promise<JourneyEntry[]> {
  await flushJourneyQueue(); // fırsat varken bekleyenleri gönder
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from("journeys")
        .select("route_id,title,city,distance_m,duration_min,stops,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error && data) {
        const remote: JourneyEntry[] = data.map((r) => ({
          routeId: (r.route_id as string) ?? "",
          title: r.title as string,
          city: (r.city as string) ?? "",
          distance_m: (r.distance_m as number) ?? 0,
          duration_min: (r.duration_min as number) ?? 0,
          stops: (r.stops as number) ?? 0,
          date: r.created_at as string,
        }));
        // hâlâ kuyrukta bekleyenler (bulutta yok) listeye karışır
        const pending = await readLocal(QUEUE_KEY);
        const merged = [...pending, ...remote]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 200);
        await writeLocal(KEY, merged);
        return merged;
      }
    }
  } catch { /* offline → önbellek */ }
  return readLocal(KEY);
}
