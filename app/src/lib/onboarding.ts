import AsyncStorage from "@react-native-async-storage/async-storage";

// Onboarding tercihleri — kişiselleştirmenin tohumu.
// Faz 2.1'de bu tercihler AI hafızasına (ai_memory_embeddings) da yazılacak.

const KEY = "sana_onboarding_v1";

export interface OnboardingPrefs {
  vibes: string[];
  budget: number; // 1-3
  done: boolean;
  /** Tercihler AI hafızasına yazıldı mı (2.1) — false ise sonraki açılışta tekrar denenir */
  synced?: boolean;
}

export async function getOnboarding(): Promise<OnboardingPrefs | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingPrefs) : null;
  } catch {
    return null;
  }
}

export async function saveOnboarding(prefs: OnboardingPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
  } catch { /* yoksay */ }
}

export async function markOnboardingSynced(): Promise<void> {
  const p = await getOnboarding();
  if (p) await saveOnboarding({ ...p, synced: true });
}
