import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Alert, Dimensions, FlatList, type NativeScrollEvent,
  type NativeSyntheticEvent, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OSMMap, { type OSMMarker, type OSMPolyline } from "../components/OSMMap";
import { fetchRoutes } from "../lib/api";
import { signOut } from "../lib/auth";
import { AUTH_ENABLED } from "../lib/config";
import { useUserLocation } from "../lib/useUserLocation";
import { colors, font, radius, shadow } from "../lib/theme";
import type { RouteWithWaypoints } from "../lib/types";
import { budgetLabel, routeColor, waypointIcon } from "../lib/ui";
import type { MapScreenProps } from "../navigation";

const { width } = Dimensions.get("window");
const CARD_W = Math.min(width * 0.82, 320);
const GAP = 12;
const SNAP = CARD_W + GAP;

export default function MapScreen({ navigation }: MapScreenProps) {
  const insets = useSafeAreaInsets();
  const userLoc = useUserLocation();
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchRoutes()
      .then(setRoutes)
      .catch((e) => setError(e.message ?? "Rotalar yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  const polylines = useMemo<OSMPolyline[]>(
    () => routes.map((r, i) => ({
      id: r.id, color: routeColor(i),
      coords: r.waypoints.filter((w) => w.kind === "experience").map((w) => ({ lat: w.lat, lng: w.lng })),
    })),
    [routes],
  );
  const markers = useMemo<OSMMarker[]>(
    () => routes.flatMap((r, i) => {
      const exp = r.waypoints.filter((w) => w.kind === "experience");
      return exp[0]
        ? [{ id: r.id, lat: exp[0].lat, lng: exp[0].lng, color: routeColor(i), popup: r.title, photo: r.cover_photo_url ?? exp[0].photo_urls?.[0] ?? undefined }]
        : [];
    }),
    [routes],
  );

  const open = (r: RouteWithWaypoints) => navigation.navigate("RouteFlood", { routeId: r.id, title: r.title });
  const openById = (id: string) => {
    const r = routes.find((x) => x.id === id);
    if (r) open(r);
  };
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.x / SNAP), routes.length - 1));
    setActive(idx);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>Rotalar yükleniyor…</Text></View>;
  }
  if (error) {
    return <View style={styles.center}><Text style={styles.error}>⚠️ {error}</Text></View>;
  }

  return (
    <View style={styles.container}>
      <OSMMap
        polylines={polylines}
        markers={markers}
        onPressItem={openById}
        onSelectItem={setSelectedId}
        onMapPress={() => setSelectedId(null)}
        focusId={selectedId}
        userLocation={userLoc}
        padding={64}
        style={StyleSheet.absoluteFill}
      />

      {/* Zarif kompakt başlık */}
      <TouchableOpacity
        style={[styles.header, { top: insets.top + 10 }]}
        activeOpacity={0.9}
        onPress={() => {
          if (!AUTH_ENABLED) return; // dev modunda çıkış yok
          Alert.alert("Hesap", "Çıkış yapmak istiyor musun?", [
            { text: "Vazgeç", style: "cancel" },
            { text: "Çıkış", style: "destructive", onPress: () => { signOut(); } },
          ]);
        }}
      >
        <View style={styles.brandDot} />
        <View>
          <Text style={styles.brand}>SANA</Text>
          <Text style={styles.brandSub}>İstanbul · {routes.length} rota keşfet</Text>
        </View>
      </TouchableOpacity>

      {/* Alt: sayfa noktaları + kart karüseli */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}>
        <View style={styles.dots}>
          {routes.map((r, i) => (
            <View key={r.id} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
        <FlatList
          data={routes}
          keyExtractor={(r) => r.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP}
          decelerationRate="fast"
          onMomentumScrollEnd={onScrollEnd}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item, index }) => {
            const color = routeColor(index);
            const km = item.total_distance_m ? (item.total_distance_m / 1000).toFixed(1) : "—";
            const expStops = item.waypoints.filter((w) => w.kind === "experience");
            const icons = expStops.slice(0, 4).map(waypointIcon);
            const isActive = index === active;
            return (
              <TouchableOpacity
                activeOpacity={0.92}
                style={[styles.card, { width: CARD_W }, isActive ? { borderColor: color, ...shadow(12) } : null]}
                onPress={() => open(item)}
              >
                <LinearGradient
                  colors={[color, "rgba(15,23,42,0.55)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cover}
                >
                  <Text style={styles.coverIcons}>{icons.join("   ")}</Text>
                  <Text style={styles.coverBudget}>{budgetLabel(item.budget_level)}</Text>
                </LinearGradient>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.tagRow}>
                    {(item.vibe_tags ?? []).slice(0, 3).map((t) => (
                      <Text key={t} style={styles.tag}>#{t}</Text>
                    ))}
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>📍 {expStops.length} durak</Text>
                    <Text style={styles.meta}>📏 {km} km</Text>
                    <Text style={styles.go}>Keşfet →</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.bg },
  muted: { color: colors.textMuted, fontFamily: font.medium },
  error: { color: "#b91c1c", paddingHorizontal: 24, textAlign: "center", fontFamily: font.medium },

  header: {
    position: "absolute", left: 16, flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.surface, borderRadius: radius.lg, paddingLeft: 12, paddingRight: 16,
    paddingVertical: 10, ...shadow(8),
  },
  brandDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  topRight: { position: "absolute", right: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    backgroundColor: colors.surface, borderRadius: radius.pill, width: 44, height: 44,
    alignItems: "center", justifyContent: "center", ...shadow(8),
  },
  iconBtnText: { fontSize: 18 },
  planFab: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingHorizontal: 16, paddingVertical: 12, ...shadow(8),
  },
  planFabText: { color: "#fff", fontFamily: font.extra, fontSize: 14 },
  brand: { fontSize: 18, fontFamily: font.black, color: colors.text, letterSpacing: 0.5 },
  brandSub: { fontSize: 12, color: colors.textMuted, marginTop: 1, fontFamily: font.medium },

  bottom: { position: "absolute", left: 0, right: 0, bottom: 0 },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, marginBottom: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(15,23,42,0.22)" },
  dotActive: { width: 20, backgroundColor: colors.primary },

  card: {
    width: CARD_W, backgroundColor: colors.surface, borderRadius: radius.lg, marginRight: GAP,
    overflow: "hidden", borderWidth: 2, borderColor: "transparent", ...shadow(8),
  },
  cover: { height: 60, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  coverIcons: { fontSize: 22 },
  coverBudget: { fontSize: 15, color: "#fff", fontFamily: font.extra },
  cardBody: { padding: 14 },
  cardTitle: { fontSize: 16, fontFamily: font.extra, color: colors.text },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag: { fontSize: 12, color: colors.primaryDark, fontFamily: font.semibold },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  meta: { fontSize: 13, color: colors.textMuted, fontFamily: font.semibold },
  go: { marginLeft: "auto", color: colors.primary, fontFamily: font.extra },
});
