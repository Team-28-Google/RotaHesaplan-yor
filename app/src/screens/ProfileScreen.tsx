import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { countMyComments, countMyRoutes, getFavoriteIds } from "../lib/api";
import { signOut } from "../lib/auth";
import { AUTH_ENABLED } from "../lib/config";
import { getJourneys, type JourneyEntry } from "../lib/journeyLog";
import { supabase } from "../lib/supabase";
import { font, gradients, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";
import type { ProfileScreenProps } from "../navigation";

interface Badge {
  icon: string;
  name: string;
  desc: string;
  unlocked: boolean;
}

function buildBadges(j: JourneyEntry[], myRoutes: number, favs: number, myComments: number): Badge[] {
  const totalKm = j.reduce((s, x) => s + x.distance_m, 0) / 1000;
  const totalStops = j.reduce((s, x) => s + x.stops, 0);
  return [
    { icon: "🥾", name: "İlk Adım", desc: "İlk yolculuğunu tamamla", unlocked: j.length >= 1 },
    { icon: "🧭", name: "Gezgin", desc: "3 yolculuk tamamla", unlocked: j.length >= 3 },
    { icon: "🏙️", name: "Şehir Ustası", desc: "5 yolculuk tamamla", unlocked: j.length >= 5 },
    { icon: "📏", name: "10K", desc: "Toplam 10 km yürü", unlocked: totalKm >= 10 },
    { icon: "📍", name: "Kaşif", desc: "20 durak ziyaret et", unlocked: totalStops >= 20 },
    { icon: "✍️", name: "Rota Yazarı", desc: "İlk rotanı paylaş", unlocked: myRoutes >= 1 },
    { icon: "❤️", name: "Koleksiyoncu", desc: "3 rota kaydet", unlocked: favs >= 3 },
    { icon: "💬", name: "Sosyal", desc: "İlk yorumunu yaz", unlocked: myComments >= 1 },
  ];
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState<string>("");
  const [journeys, setJourneys] = useState<JourneyEntry[]>([]);
  const [badges, setBadges] = useState<Badge[]>(buildBadges([], 0, 0, 0));
  const [myRoutes, setMyRoutes] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [j, routes, favs, comments, user] = await Promise.all([
          getJourneys(),
          countMyRoutes().catch(() => 0),
          getFavoriteIds().catch(() => new Set<string>()),
          countMyComments().catch(() => 0),
          supabase.auth.getUser().then((r) => r.data.user).catch(() => null),
        ]);
        if (!active) return;
        setJourneys(j);
        setMyRoutes(routes);
        setBadges(buildBadges(j, routes, favs.size, comments));
        setEmail(user?.email ?? "");
      })();
      return () => { active = false; };
    }, []),
  );

  const totalKm = journeys.reduce((s, x) => s + x.distance_m, 0) / 1000;
  const totalStops = journeys.reduce((s, x) => s + x.stops, 0);
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const username = email ? email.split("@")[0] : "gezgin";

  const doSignOut = () => {
    Alert.alert("Çıkış", "Hesabından çıkmak istiyor musun?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Çıkış yap", style: "destructive", onPress: () => { signOut(); } },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 32, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Kimlik */}
      <View style={styles.head}>
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
          <Text style={styles.avatarText}>{username.slice(0, 1).toUpperCase()}</Text>
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>@{username}</Text>
          <Text style={styles.city}>
            <Ionicons name="location-outline" size={12} color={colors.textFaint} /> İstanbul
          </Text>
        </View>
        {AUTH_ENABLED && (
          <TouchableOpacity onPress={doSignOut} style={styles.signOut} hitSlop={8}>
            <Ionicons name="log-out-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Görünüm tercihi */}
      <View style={styles.settingRow}>
        <View style={styles.settingIcon}>
          <Ionicons name={mode === "dark" ? "moon" : "sunny"} size={16} color={colors.primaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingTitle}>Koyu Mod</Text>
          <Text style={styles.settingDesc}>{mode === "dark" ? "Gece şehri teması açık" : "Aydınlık tema açık"}</Text>
        </View>
        <Switch
          value={mode === "dark"}
          onValueChange={(v) => setMode(v ? "dark" : "light")}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* Tercihler (onboarding'i yeniden aç) */}
      <TouchableOpacity style={styles.settingRow} activeOpacity={0.8} onPress={() => navigation.navigate("Onboarding")}>
        <View style={styles.settingIcon}>
          <Ionicons name="options" size={16} color={colors.primaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.settingTitle}>Tercihlerimi Düzenle</Text>
          <Text style={styles.settingDesc}>Vibe ve bütçe seçimlerin — önerileri kişiselleştirir</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>

      {/* İstatistikler */}
      <View style={styles.statsCard}>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{journeys.length}</Text>
          <Text style={styles.statLabel}>yolculuk</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statVal}>{totalKm.toFixed(1)}</Text>
          <Text style={styles.statLabel}>km</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statVal}>{totalStops}</Text>
          <Text style={styles.statLabel}>durak</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statVal}>{myRoutes}</Text>
          <Text style={styles.statLabel}>rota</Text>
        </View>
      </View>

      {/* Rozetler */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Rozetler</Text>
        <Text style={styles.sectionMeta}>{unlockedCount}/{badges.length}</Text>
      </View>
      <View style={styles.badgeGrid}>
        {badges.map((b) => (
          <View key={b.name} style={[styles.badge, !b.unlocked && styles.badgeLocked]}>
            <Text style={[styles.badgeIcon, !b.unlocked && { opacity: 0.35 }]}>{b.icon}</Text>
            <Text style={[styles.badgeName, !b.unlocked && { color: colors.textFaint }]}>{b.name}</Text>
            <Text style={styles.badgeDesc}>{b.desc}</Text>
          </View>
        ))}
      </View>

      {/* Son yolculuklar */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Son Yolculuklar</Text>
      </View>
      {journeys.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🧭</Text>
          <Text style={styles.emptyText}>
            Henüz yolculuk yok. Bir rota aç, "Yolculuğa Başla" de — bitirdiğinde burada görünecek.
          </Text>
        </View>
      ) : (
        journeys.slice(0, 6).map((j, i) => (
          <View key={`${j.routeId}-${j.date}-${i}`} style={styles.journey}>
            <View style={styles.journeyIcon}>
              <Ionicons name="checkmark-done" size={16} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.journeyTitle} numberOfLines={1}>{j.title}</Text>
              <Text style={styles.journeyMeta}>
                {new Date(j.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} · {(j.distance_m / 1000).toFixed(1)} km · {j.stops} durak · {j.duration_min} dk
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  settingRow: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 14,
  },
  settingIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  settingTitle: { color: colors.text, fontFamily: font.bold, fontSize: 14.5 },
  settingDesc: { color: colors.textFaint, fontFamily: font.medium, fontSize: 12, marginTop: 2 },

  head: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", ...shadow(8) },
  avatarText: { color: "#fff", fontFamily: font.black, fontSize: 24 },
  name: { color: colors.text, fontFamily: font.extra, fontSize: 20 },
  city: { color: colors.textFaint, fontFamily: font.medium, fontSize: 13, marginTop: 3 },
  signOut: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },

  statsCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    borderRadius: radius.lg, paddingVertical: 16, borderWidth: 1, borderColor: colors.border,
    marginBottom: 22, ...shadow(6),
  },
  stat: { flex: 1, alignItems: "center" },
  statVal: { color: colors.text, fontFamily: font.black, fontSize: 20 },
  statLabel: { color: colors.textFaint, fontFamily: font.semibold, fontSize: 11.5, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },

  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: colors.text, fontFamily: font.extra, fontSize: 17 },
  sectionMeta: { color: colors.primaryDark, fontFamily: font.bold, fontSize: 13 },

  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22 },
  badge: {
    width: "31%", flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 8,
    alignItems: "center",
  },
  badgeLocked: { backgroundColor: "transparent" },
  badgeIcon: { fontSize: 24 },
  badgeName: { color: colors.text, fontFamily: font.bold, fontSize: 12.5, marginTop: 6 },
  badgeDesc: { color: colors.textFaint, fontFamily: font.regular, fontSize: 10.5, marginTop: 2, textAlign: "center" },

  empty: { alignItems: "center", padding: 20, gap: 8 },
  emptyIcon: { fontSize: 34 },
  emptyText: { color: colors.textMuted, fontFamily: font.regular, fontSize: 13.5, textAlign: "center", lineHeight: 19 },

  journey: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface,
    borderRadius: radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  journeyIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  journeyTitle: { color: colors.text, fontFamily: font.bold, fontSize: 14.5 },
  journeyMeta: { color: colors.textFaint, fontFamily: font.medium, fontSize: 12, marginTop: 2 },
});
