import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Dimensions, FlatList, StyleSheet, Text,
  TouchableOpacity, View, type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CollapsibleSheet from "../components/CollapsibleSheet";
import OSMMap, { type OSMMarker, type OSMPolyline } from "../components/OSMMap";
import PressableScale from "../components/PressableScale";
import { fetchRoutes } from "../lib/api";
import { signOut } from "../lib/auth";
import { cityInfo, getActiveCity } from "../lib/cities";
import { AUTH_ENABLED } from "../lib/config";
import { useUserLocation } from "../lib/useUserLocation";
import { font, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";
import type { RouteWithWaypoints } from "../lib/types";
import { budgetLabel, legSegments, routeColor, segmentsToPath, waypointIcon } from "../lib/ui";
import type { MapScreenProps } from "../navigation";

const { width } = Dimensions.get("window");
const CARD_W = Math.min(width * 0.82, 320);
const GAP = 12;
const SNAP = CARD_W + GAP;

export default function MapScreen({ navigation }: MapScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const userLoc = useUserLocation();
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [city, setCity] = useState("Istanbul"); // 3.0c: aktif şehir (Home'dan seçilir)
  const listRef = useRef<FlatList<RouteWithWaypoints>>(null);

  const load = useCallback(() => {
    getActiveCity()
      .then((c) => { setCity(c); return fetchRoutes(c); })
      .then((r) => { setRoutes(r); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Rotalar yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  // Sekmeye her dönüşte sessiz yenile (yeni oluşturulan rota haritada görünsün)
  useFocusEffect(load);

  const polylines = useMemo<OSMPolyline[]>(
    () => routes.map((r, i) => {
      const exp = r.waypoints.filter((w) => w.kind === "experience");
      const segs = legSegments(exp);
      return {
        id: r.id, color: routeColor(i, colors.routeColors),
        coords: segmentsToPath(segs), segments: segs,
      };
    }),
    [routes, colors],
  );
  const markers = useMemo<OSMMarker[]>(() => {
    // Rota başına tekil marker (genel bakış). Seçili rotanınki yerine DURAK marker'ları gelir:
    // odaktayken durakların fotoğrafları görünür, odak değişince sadece onlar kaybolur.
    const base = routes.flatMap((r, i) => {
      if (r.id === selectedId) return [];
      const exp = r.waypoints.filter((w) => w.kind === "experience");
      return exp[0]
        ? [{ id: r.id, lat: exp[0].lat, lng: exp[0].lng, color: routeColor(i, colors.routeColors), popup: r.title, photo: r.cover_photo_url ?? exp[0].photo_urls?.[0] ?? undefined }]
        : [];
    });
    const sel = routes.find((r) => r.id === selectedId);
    if (sel) {
      const exp = sel.waypoints.filter((w) => w.kind === "experience");
      base.push(...exp.map((w, i) => ({
        id: `stop-${w.id}`, lat: w.lat, lng: w.lng,
        color: colors.primary, label: String(i + 1),
        photo: w.photo_urls?.[0], popup: w.name,
        variant: (i === 0 ? "start" : i === exp.length - 1 ? "end" : "stop") as "start" | "end" | "stop",
      })));
    }
    return base;
  }, [routes, selectedId, colors]);

  const open = (r: RouteWithWaypoints) => navigation.navigate("RouteFlood", { routeId: r.id, title: r.title });
  const openById = (id: string) => {
    // Durak marker'ının callout'u → ait olduğu (seçili) rotanın detayına git
    const r = id.startsWith("stop-")
      ? routes.find((x) => x.id === selectedId)
      : routes.find((x) => x.id === id);
    if (r) open(r);
  };
  // Kart kaydırılınca → o rota haritada vurgulanır ve kamera rotaya uçar.
  // onViewableItemsChanged kullanıyoruz: onMomentumScrollEnd yavaş sürüklemede ateşlenmiyordu (bug).
  const routesRef = useRef<RouteWithWaypoints[]>([]);
  useEffect(() => { routesRef.current = routes; }, [routes]);
  const didInitView = useRef(false);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef((info: { viewableItems: ViewToken[] }) => {
    const v = info.viewableItems.find((t) => t.isViewable && t.index != null);
    if (!v || v.index == null) return;
    if (!didInitView.current) { didInitView.current = true; return; } // açılışta genel bakış korunur
    setActive(v.index);
    const r = routesRef.current[v.index];
    if (r) setSelectedId(r.id);
  }).current;
  // Marker'a dokununca → karüsel o rotanın kartına kayar (durak marker'ları seçimi değiştirmez)
  const selectOnMap = (id: string) => {
    if (id.startsWith("stop-")) return; // durak pini: sadece callout açılır
    setSelectedId(id);
    const idx = routes.findIndex((r) => r.id === id);
    if (idx >= 0) {
      setActive(idx);
      listRef.current?.scrollToOffset({ offset: idx * SNAP, animated: true });
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>Rotalar yükleniyor…</Text></View>;
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>⚠️ {error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }} activeOpacity={0.85}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OSMMap
        polylines={polylines}
        markers={markers}
        onPressItem={openById}
        onSelectItem={selectOnMap}
        onMapPress={() => setSelectedId(null)}
        focusId={selectedId}
        userLocation={userLoc}
        padding={64}
        overlayInsetBottom={225 + insets.bottom}
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
          <Text style={styles.brandSub}>{cityInfo(city).label} · {routes.length} rota keşfet</Text>
        </View>
      </TouchableOpacity>

      {/* Rota oluştur — sağ üst buton (kullanıcı isteği: haritadan da oluşturulabilsin) */}
      <TouchableOpacity
        style={[styles.createFab, { top: insets.top + 10 }]}
        onPress={() => navigation.navigate("CreateRoute")}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Rota yoksa: davet kartı */}
      {routes.length === 0 && (
        <View style={[styles.emptyCard, { bottom: insets.bottom + 24 }]}>
          <Text style={styles.emptyTitle}>Haritada henüz rota yok</Text>
          <Text style={styles.emptyText}>İlk rotayı sen çiz — durakları ekle, AI gerisini yazsın.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => navigation.navigate("CreateRoute")} activeOpacity={0.9}>
            <Text style={styles.retryText}>＋ Rota Oluştur</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Alt: sayfa noktaları + kart karüseli — aşağı kaydırılıp kapanabilir (4.0a) */}
      <CollapsibleSheet
        style={[styles.bottom, { paddingBottom: insets.bottom + 14 }]}
        peekLabel={`${routes.length} rota`}
      >
        <View style={styles.dots}>
          {routes.map((r, i) => (
            <View key={r.id} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
        <FlatList
          ref={listRef}
          data={routes}
          keyExtractor={(r) => r.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP}
          decelerationRate="fast"
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item, index }) => {
            const color = routeColor(index, colors.routeColors);
            const km = item.total_distance_m ? (item.total_distance_m / 1000).toFixed(1) : "—";
            const expStops = item.waypoints.filter((w) => w.kind === "experience");
            const icons = expStops.slice(0, 4).map(waypointIcon);
            const isActive = index === active;
            return (
              <PressableScale
                style={[styles.card, { width: CARD_W }, isActive ? { borderColor: color, ...shadow(12) } : null]}
                onPress={() => open(item)}
              >
                <LinearGradient
                  colors={[color, "rgba(11,16,34,0.85)"]}
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
              </PressableScale>
            );
          }}
        />
      </CollapsibleSheet>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.bg },
  muted: { color: colors.textMuted, fontFamily: font.medium },
  error: { color: colors.danger, paddingHorizontal: 24, textAlign: "center", fontFamily: font.medium },
  retryBtn: { marginTop: 10, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#fff", fontFamily: font.bold, fontSize: 14 },
  emptyCard: {
    position: "absolute", left: 20, right: 20, alignItems: "center",
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20,
    borderWidth: 1, borderColor: colors.border, ...shadow(10),
  },
  emptyTitle: { color: colors.text, fontFamily: font.extra, fontSize: 16 },
  emptyText: { color: colors.textMuted, fontFamily: font.regular, fontSize: 13.5, textAlign: "center", marginTop: 6, lineHeight: 19 },

  header: {
    position: "absolute", left: 16, flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.surface, borderRadius: radius.lg, paddingLeft: 12, paddingRight: 16,
    paddingVertical: 10, ...shadow(8),
  },
  brandDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  topRight: { position: "absolute", right: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  createFab: {
    position: "absolute", right: 16, width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", ...shadow(10),
  },
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
  dots: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6, marginBottom: 10, paddingHorizontal: 24 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textFaint, opacity: 0.55 },
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
  tag: {
    fontSize: 11.5, color: colors.primaryDark, fontFamily: font.semibold,
    backgroundColor: colors.primarySoft, paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: radius.pill, overflow: "hidden",
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  meta: { fontSize: 13, color: colors.textMuted, fontFamily: font.semibold },
  go: { marginLeft: "auto", color: colors.primary, fontFamily: font.extra },
});
