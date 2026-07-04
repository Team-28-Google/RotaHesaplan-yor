import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { syncOnboardingMemory } from "../lib/api";
import { tap, success } from "../lib/haptics";
import { getOnboarding, markOnboardingSynced, saveOnboarding } from "../lib/onboarding";
import { font, gradients, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";
import type { OnboardingScreenProps } from "../navigation";

const VIBES = [
  { id: "sakin", label: "Sakin", emoji: "🌿" },
  { id: "tarih", label: "Tarih", emoji: "🏛️" },
  { id: "deniz", label: "Deniz", emoji: "🌊" },
  { id: "kahve", label: "Kahve", emoji: "☕" },
  { id: "sanat", label: "Sanat", emoji: "🖼️" },
  { id: "gece", label: "Gece", emoji: "🌙" },
  { id: "yesil", label: "Yeşil", emoji: "🌳" },
  { id: "yuruyus", label: "Yürüyüş", emoji: "🚶" },
];
const BUDGETS = [
  { level: 1, label: "₺", desc: "Cüzdan dostu" },
  { level: 2, label: "₺₺", desc: "Orta" },
  { level: 3, label: "₺₺₺", desc: "Keyfe keder" },
];

/** Onboarding gövdesi — ilk açılışta Root'tan, sonra Profil → "Tercihlerimi düzenle" ile stack'ten açılır. */
export function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [step, setStep] = useState(0);
  const [vibes, setVibes] = useState<string[]>([]);
  const [budget, setBudget] = useState(2);

  // Tercih düzenleme modunda mevcut seçimleri yükle
  useEffect(() => {
    getOnboarding().then((p) => {
      if (p) { setVibes(p.vibes); setBudget(p.budget); }
    });
  }, []);

  const toggleVibe = (id: string) => {
    tap();
    setVibes((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  };

  const finish = async () => {
    success();
    await saveOnboarding({ vibes, budget, done: true, synced: false });
    onDone();
    // AI hafızasına arka planda yaz — başarısızsa açılışta tekrar denenir (App.tsx)
    syncOnboardingMemory(vibes, budget).then((ok) => { if (ok) markOnboardingSynced(); });
  };

  const next = () => { tap(); setStep((s) => s + 1); };
  const back = () => { tap(); setStep((s) => s - 1); };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      {/* Üst bar: adım noktaları + atla */}
      <View style={styles.topRow}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        {step < 2 && (
          <TouchableOpacity onPress={finish} hitSlop={10}>
            <Text style={styles.skip}>Atla</Text>
          </TouchableOpacity>
        )}
      </View>

      {step === 0 && (
        <View style={styles.body}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
            <Text style={styles.logoText}>SANA</Text>
          </LinearGradient>
          <Text style={styles.h1}>Şehirde yalnız değilsin</Text>
          <Text style={styles.p}>
            SANA, İstanbul'un gerçek günlerini keşfetmen için var: insanların yaşadığı rotalar,
            sana göre planlanan günler.
          </Text>
          <View style={styles.features}>
            <Feature icon="map" title="Gerçek rotalar" desc="Şehri yaşayanların adım adım günleri" colors={colors} />
            <Feature icon="sparkles" title="AI ile planla" desc="Ruh halini yaz, günün kurulsun" colors={colors} />
            <Feature icon="share-social" title="Paylaş" desc="Tamamladığın rotayı tek dokunuşla hikâyene at" colors={colors} />
          </View>
        </View>
      )}

      {step === 1 && (
        <View style={styles.body}>
          <Text style={styles.h1}>Nasıl günler seversin?</Text>
          <Text style={styles.p}>Seçimlerin önerileri kişiselleştirir. Birden fazla seçebilirsin.</Text>
          <View style={styles.vibeGrid}>
            {VIBES.map((v) => {
              const on = vibes.includes(v.id);
              return (
                <TouchableOpacity
                  key={v.id}
                  style={[styles.vibe, on && styles.vibeOn]}
                  onPress={() => toggleVibe(v.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.vibeEmoji}>{v.emoji}</Text>
                  <Text style={[styles.vibeLabel, on && styles.vibeLabelOn]}>{v.label}</Text>
                  {on && <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={styles.vibeCheck} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={styles.body}>
          <Text style={styles.h1}>Bütçen nasıl?</Text>
          <Text style={styles.p}>Rota önerileri ve AI planları buna göre şekillenir.</Text>
          <View style={{ gap: 10, marginTop: 18 }}>
            {BUDGETS.map((b) => {
              const on = budget === b.level;
              return (
                <TouchableOpacity
                  key={b.level}
                  style={[styles.budget, on && styles.budgetOn]}
                  onPress={() => { tap(); setBudget(b.level); }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.budgetLabel, on && { color: colors.primaryDark }]}>{b.label}</Text>
                  <Text style={[styles.budgetDesc, on && { color: colors.text }]}>{b.desc}</Text>
                  {on && <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={{ marginLeft: "auto" }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Alt bar */}
      <View style={styles.bottomRow}>
        {step > 0 ? (
          <TouchableOpacity style={styles.ghostBtn} onPress={back}>
            <Text style={styles.ghostText}>‹ Geri</Text>
          </TouchableOpacity>
        ) : <View style={{ flex: 1 }} />}
        {step < 2 ? (
          <TouchableOpacity style={styles.nextBtn} onPress={next} activeOpacity={0.9}>
            <Text style={styles.nextText}>Devam →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={finish} activeOpacity={0.9}>
            <Text style={styles.nextText}>🧭 Keşfe Başla</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function Feature({ icon, title, desc, colors }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; desc: string; colors: ThemeColors;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
      <View style={{
        width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft,
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name={icon} size={19} color={colors.primaryDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontFamily: font.bold, fontSize: 15 }}>{title}</Text>
        <Text style={{ color: colors.textMuted, fontFamily: font.regular, fontSize: 13, marginTop: 2 }}>{desc}</Text>
      </View>
    </View>
  );
}

/** Stack üzerinden açılan varyant (Profil → Tercihlerimi düzenle). */
export default function OnboardingScreen({ navigation }: OnboardingScreenProps) {
  return <OnboardingFlow onDone={() => navigation.goBack()} />;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 24 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 22, backgroundColor: colors.primary },
  skip: { color: colors.textFaint, fontFamily: font.semibold, fontSize: 14 },

  body: { flex: 1, justifyContent: "center" },
  logo: {
    alignSelf: "flex-start", width: 68, height: 68, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginBottom: 22, ...shadow(10),
  },
  logoText: { color: "#fff", fontFamily: font.black, fontSize: 19, letterSpacing: 1 },
  h1: { color: colors.text, fontFamily: font.black, fontSize: 28, lineHeight: 34 },
  p: { color: colors.textMuted, fontFamily: font.regular, fontSize: 15, lineHeight: 22, marginTop: 10 },
  features: { gap: 18, marginTop: 28 },

  vibeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 },
  vibe: {
    width: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.surface, borderRadius: radius.md, padding: 14,
    borderWidth: 1.5, borderColor: colors.border,
  },
  vibeOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  vibeEmoji: { fontSize: 20 },
  vibeLabel: { color: colors.textMuted, fontFamily: font.bold, fontSize: 14.5 },
  vibeLabelOn: { color: colors.text },
  vibeCheck: { marginLeft: "auto" },

  budget: {
    flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surface,
    borderRadius: radius.md, padding: 16, borderWidth: 1.5, borderColor: colors.border,
  },
  budgetOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  budgetLabel: { color: colors.textMuted, fontFamily: font.black, fontSize: 18, width: 52 },
  budgetDesc: { color: colors.textMuted, fontFamily: font.medium, fontSize: 14.5 },

  bottomRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  ghostBtn: { flex: 1, paddingVertical: 15, alignItems: "center", borderRadius: radius.lg, backgroundColor: colors.surfaceAlt },
  ghostText: { color: colors.textMuted, fontFamily: font.bold, fontSize: 15 },
  nextBtn: { flex: 2, paddingVertical: 15, alignItems: "center", borderRadius: radius.lg, backgroundColor: colors.primary, ...shadow(6) },
  nextText: { color: "#fff", fontFamily: font.extra, fontSize: 16 },
});
