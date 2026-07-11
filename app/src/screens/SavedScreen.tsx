import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { useCallback, useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PressableScale from "../components/PressableScale";
import Skeleton from "../components/Skeleton";
import { fetchFavoriteRoutes, fetchMyRoutes } from "../lib/api";
import { cityInfo, getActiveCity } from "../lib/cities";
import { tap } from "../lib/haptics";
import { font, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";
import type { RouteWithWaypoints } from "../lib/types";
import { budgetLabel, routeColor, waypointIcon } from "../lib/ui";
import type { SavedScreenProps } from "../navigation";

// Kuş uçuşu mesafe (m) — "Yakınımda" sıralaması ve kart etiketi için
function distM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function SavedScreen({ navigation }: SavedScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [favRoutes, setFavRoutes] = useState<RouteWithWaypoints[]>([]);
  const [myRoutes, setMyRoutes] = useState<RouteWithWaypoints[]>([]);
  const [tab, setTab] = useState<"saved" | "mine">("saved"); // ❤️ Kaydettiklerim | 🗺️ Rotalarım (3.13)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const routes = tab === "saved" ? favRoutes : myRoutes;
  // Detaylı filtre (3.0c v2): Tümü / 📍 Yakınımda / şehir çipleri — varsayılan aktif şehir
  const [filt, setFilt] = useState<string>("__active__"); // "all" | "near" | cityKey
  const [activeCity, setActiveCityState] = useState("Istanbul");
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      getActiveCity().then((c) => {
        if (!active) return;
        setActiveCityState(c);
        setFilt((f) => (f === "__active__" ? c : f)); // ilk açılışta aktif şehir seçili
      });
      Promise.all([fetchFavoriteRoutes(), fetchMyRoutes()])
        .then(([f, m]) => { if (active) { setFavRoutes(f); setMyRoutes(m); setError(null); } })
        .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Yüklenemedi"); })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  // "📍 Yakınımda": izin o an istenir, konum bir kez alınır → mesafeye göre sıralanır
  const pickNear = async () => {
    tap();
    setFilt("near");
    if (myLoc) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setFilt(activeCity); return; }
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMyLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
    } catch { setFilt(activeCity); }
  };

  // Kayıtlardaki şehirler (çoktan aza) — yalnız var olan şehirlerin çipi gösterilir
  const cityKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of routes) counts.set(r.city, (counts.get(r.city) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [routes]);

  const routeLoc = (r: RouteWithWaypoints) => {
    const w = r.waypoints.find((x) => x.kind === "experience") ?? r.waypoints[0];
    return w ? { lat: w.lat, lng: w.lng } : null;
  };

  const shown = useMemo(() => {
    if (filt === "all" || filt === "__active__") return routes;
    if (filt === "near") {
      if (!myLoc) return routes;
      return [...routes].sort((a, b) => {
        const la = routeLoc(a), lb = routeLoc(b);
        return (la ? distM(myLoc, la) : 1e12) - (lb ? distM(myLoc, lb) : 1e12);
      });
    }
    return routes.filter((r) => r.city === filt);
  }, [routes, filt, myLoc]);

  const chipLabel = (key: string) =>
    key === "all" ? "Tümü" : key === "near" ? `📍 Yakınımda${filt === "near" && !myLoc ? " (alınıyor…)" : ""}` : cityInfo(key).label;

  return (
    <View style={styles.screen}>
      <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>Kayıtlı</Text>
      </View>

      {/* ❤️ Kaydettiklerim | 🗺️ Rotalarım (3.13 — kendi/kopyaladığın rotalar) */}
      <View style={styles.tabRow}>
        {([["saved", "❤️ Kaydettiklerim"], ["mine", "🗺️ Rotalarım"]] as const).map(([k, label]) => (
          <TouchableOpacity
            key={k}
            style={[styles.tabBtn, tab === k && styles.tabBtnOn]}
            onPress={() => { tap(); setTab(k); }}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtre çubuğu: Tümü / Yakınımda / kayıtlı şehirler */}
      {routes.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}
        >
          {["all", "near", ...cityKeys].map((key) => {
            const on = filt === key || (key === "all" && filt === "__active__");
            return (
              <TouchableOpacity
                key={key}
                style={[styles.cityFilter, on && styles.cityFilterOn]}
                onPress={() => (key === "near" ? pickNear() : (tap(), setFilt(key)))}
                activeOpacity={0.85}
              >
                <Text style={[styles.cityFilterText, on && styles.cityFilterTextOn]}>
                  {on && key !== "near" ? "✓ " : ""}{chipLabel(key)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 96, borderRadius: radius.lg }} />)}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>⚠️</Text>
          <Text style={styles.emptyTitle}>Kaydettiklerin yüklenemedi</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : routes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>{tab === "saved" ? "🤍" : "🗺️"}</Text>
          <Text style={styles.emptyTitle}>
            {tab === "saved" ? "Henüz rota kaydetmedin" : "Henüz kendi rotan yok"}
          </Text>
          <Text style={styles.emptyText}>
            {tab === "saved"
              ? "Bir rotayı açıp kalbe dokunarak buraya ekleyebilirsin."
              : "Rota oluştur, 🎲 ürettir ya da beğendiğin bir rotaya durak ekleyip kendi kopyanı yarat."}
          </Text>
        </View>
      ) : shown.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyTitle}>Bu filtrede kayıt yok</Text>
          <Text style={styles.emptyText}>
            Toplam {routes.length} kaydın var — üstteki çiplerden "Tümü"ne geçebilirsin.
          </Text>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item, index }) => {
            const color = routeColor(index, colors.routeColors);
            const exp = item.waypoints.filter((w) => w.kind === "experience");
            const km = item.total_distance_m ? (item.total_distance_m / 1000).toFixed(1) : "—";
            // "Yakınımda" modunda: rotanın sana uzaklığı
            const loc = filt === "near" && myLoc ? routeLoc(item) : null;
            const awayKm = loc ? (distM(myLoc!, loc) / 1000).toFixed(1) : null;
            return (
              <PressableScale
                style={styles.card}
                onPress={() => navigation.navigate("RouteFlood", { routeId: item.id, title: item.title })}
              >
                <View style={[styles.stripe, { backgroundColor: color }]} />
                <View style={styles.cardBody}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[styles.cardTitle, { flex: 1 }]} numberOfLines={1}>{item.title}</Text>
                    {tab === "mine" && (
                      <Text style={styles.visBadge}>
                        {item.is_public === false ? "🔒 Özel" : "🌍 Açık"}
                      </Text>
                    )}
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>💰 {budgetLabel(item.budget_level)}</Text>
                    <Text style={styles.meta}>📍 {exp.length} durak</Text>
                    <Text style={styles.meta}>📏 {km} km</Text>
                    {awayKm && <Text style={[styles.meta, { color: colors.primaryDark }]}>🧭 {awayKm} km uzakta</Text>}
                  </View>
                  <Text style={styles.icons}>{exp.slice(0, 5).map(waypointIcon).join("   ")}</Text>
                </View>
              </PressableScale>
            );
          }}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingBottom: 12, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { color: colors.primary, fontFamily: font.bold, fontSize: 16 },
  headerTitle: { fontFamily: font.extra, fontSize: 17, color: colors.text },
  tabRow: {
    flexDirection: "row", margin: 16, marginBottom: 0, padding: 4,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
  },
  tabBtn: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: radius.pill },
  tabBtnOn: { backgroundColor: colors.primary },
  tabText: { fontFamily: font.bold, fontSize: 13, color: colors.textMuted },
  tabTextOn: { color: "#fff" },
  visBadge: { fontSize: 11, fontFamily: font.bold, color: colors.textMuted },
  filterBar: { flexGrow: 0, backgroundColor: "transparent" },
  cityFilter: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  cityFilterOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  cityFilterText: { fontSize: 12.5, fontFamily: font.bold, color: colors.textMuted },
  cityFilterTextOn: { color: "#fff" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontFamily: font.extra, fontSize: 18, color: colors.text, marginTop: 8 },
  emptyText: { fontFamily: font.regular, fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },

  card: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden", ...shadow(6) },
  stripe: { width: 6 },
  cardBody: { flex: 1, padding: 14 },
  cardTitle: { fontSize: 16, fontFamily: font.extra, color: colors.text },
  metaRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  meta: { fontSize: 13, color: colors.textMuted, fontFamily: font.semibold },
  icons: { fontSize: 18, marginTop: 10 },
});
