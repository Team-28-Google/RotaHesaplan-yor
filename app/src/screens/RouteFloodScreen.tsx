import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OSMMap, { type OSMMarker, type OSMPolyline } from "../components/OSMMap";
import { fetchRoute, getFavoriteIds, setFavorite } from "../lib/api";
import { useUserLocation } from "../lib/useUserLocation";
import { colors, font, radius, shadow } from "../lib/theme";
import type { RouteWithWaypoints } from "../lib/types";
import { budgetLabel, transportIcon, transportLabel, waypointIcon } from "../lib/ui";
import type { RouteFloodScreenProps } from "../navigation";

// Telefonun harita uygulamasında yürüyüş yol tarifini açar (Google key gerekmez)
function openDirections(lat: number, lng: number) {
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`).catch(() => {});
}
function distMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function distText(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
function getRating(meta: unknown): number | undefined {
  const r = (meta as { rating?: unknown } | null)?.rating;
  return typeof r === "number" ? r : undefined;
}

export default function RouteFloodScreen({ route: navRoute, navigation }: RouteFloodScreenProps) {
  const insets = useSafeAreaInsets();
  const userLoc = useUserLocation();
  const { routeId } = navRoute.params;
  const [route, setRoute] = useState<RouteWithWaypoints | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fav, setFav] = useState(false);
  const [journey, setJourney] = useState(false);
  const [target, setTarget] = useState(0);

  useEffect(() => {
    fetchRoute(routeId)
      .then(setRoute)
      .catch((e) => setError(e.message ?? "Rota yüklenemedi"));
    getFavoriteIds().then((s) => setFav(s.has(routeId))).catch(() => {});
  }, [routeId]);

  const toggleFav = async () => {
    const next = !fav;
    setFav(next);
    try {
      await setFavorite(routeId, next);
    } catch {
      setFav(!next); // geri al
    }
  };

  const exp = useMemo(() => route?.waypoints.filter((w) => w.kind === "experience") ?? [], [route]);
  const util = useMemo(() => route?.waypoints.filter((w) => w.kind === "utility") ?? [], [route]);
  const polylines = useMemo<OSMPolyline[]>(
    () => (exp.length
      ? [{ id: "route", color: colors.primary, coords: exp.map((w) => ({ lat: w.lat, lng: w.lng })), modes: exp.map((w) => w.transport_mode) }]
      : []),
    [exp],
  );
  const markers = useMemo<OSMMarker[]>(
    () => [
      ...exp.map((w, i) => ({
        id: w.id, lat: w.lat, lng: w.lng, color: colors.primary, label: String(i + 1),
        photo: w.photo_urls?.[0], popup: w.name,
        variant: (i === 0 ? "start" : i === exp.length - 1 ? "end" : "stop") as "start" | "end" | "stop",
      })),
      ...util.map((w) => ({ id: w.id, lat: w.lat, lng: w.lng, color: colors.utility, emoji: waypointIcon(w) })),
    ],
    [exp, util],
  );

  // Yolculuk: hedefe ~25m yaklaşınca otomatik sonraki durağa geç
  useEffect(() => {
    if (!journey || !userLoc) return;
    const t = exp[target];
    if (t && target < exp.length - 1 && distMeters(userLoc, t) < 25) {
      setTarget((x) => x + 1);
    }
  }, [userLoc, journey, target, exp]);

  if (error) return <View style={styles.center}><Text style={styles.error}>⚠️ {error}</Text></View>;
  if (!route) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  const km = route.total_distance_m ? (route.total_distance_m / 1000).toFixed(1) : "—";
  const last = exp.length - 1;

  return (
    <View style={styles.container}>
      <OSMMap polylines={polylines} markers={markers} padding={48} style={styles.map} userLocation={userLoc} followLocation={journey ? userLoc : null} showRecenter />
      <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => navigation.goBack()} hitSlop={12}>
        <Text style={styles.backIcon}>‹</Text>
      </TouchableOpacity>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { flex: 1 }]}>{route.title}</Text>
              <TouchableOpacity onPress={toggleFav} hitSlop={12} style={styles.heart}>
                <Text style={styles.heartText}>{fav ? "❤️" : "🤍"}</Text>
              </TouchableOpacity>
            </View>
            {!!route.description && <Text style={styles.desc}>{route.description}</Text>}
            <View style={styles.pills}>
              <Pill icon="💰" text={budgetLabel(route.budget_level)} />
              <Pill icon="📍" text={`${exp.length} durak`} />
              <Pill icon="📏" text={`${km} km`} />
              {!!route.total_duration_min && <Pill icon="⏱️" text={`~${route.total_duration_min} dk`} />}
            </View>
            <View style={styles.tagRow}>
              {(route.vibe_tags ?? []).map((t) => (
                <Text key={t} style={styles.tag}>#{t}</Text>
              ))}
            </View>
            <TouchableOpacity style={styles.startBtn} onPress={() => { setJourney(true); setTarget(0); }} activeOpacity={0.9}>
              <Text style={styles.startBtnText}>🧭 Yolculuğa Başla</Text>
            </TouchableOpacity>
          </View>

          {/* Zaman çizelgesi (gezilecek duraklar) */}
          <View style={styles.timeline}>
            {exp.map((w, i) => (
              <View key={w.id} style={styles.row}>
                <View style={styles.rail}>
                  <View style={[styles.line, { backgroundColor: i === 0 ? "transparent" : colors.border }]} />
                  <View style={[styles.node, { backgroundColor: colors.primary }]}>
                    <Text style={styles.nodeText}>{i + 1}</Text>
                  </View>
                  <View style={[styles.line, { backgroundColor: i === last ? "transparent" : colors.border }]} />
                </View>
                <View style={styles.card}>
                  {w.transport_mode !== "start" && (
                    <View style={styles.legPill}>
                      <Text style={styles.legText}>
                        {transportIcon(w.transport_mode)} {transportLabel(w.transport_mode)}
                        {w.transport_note ? ` · ${w.transport_note}` : ""}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.stopName}>{waypointIcon(w)} {w.name}</Text>
                  {!!w.note && <Text style={styles.note}>{w.note}</Text>}
                  <View style={styles.stopFoot}>
                    {getRating(w.metadata) !== undefined && <Text style={styles.rating}>⭐ {getRating(w.metadata)}</Text>}
                    <TouchableOpacity onPress={() => openDirections(w.lat, w.lng)} hitSlop={6}>
                      <Text style={styles.dirText}>🧭 Yol tarifi</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Yakındaki pratik noktalar (rota dışı) */}
          {util.length > 0 && (
            <View style={styles.nearby}>
              <Text style={styles.nearbyTitle}>Yakında pratik noktalar</Text>
              {util.map((w) => (
                <View key={w.id} style={styles.amenity}>
                  <Text style={styles.amenityIcon}>{waypointIcon(w)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.amenityName}>{w.name}</Text>
                    {!!w.note && <Text style={styles.amenityNote}>{w.note}</Text>}
                  </View>
                  <Text style={styles.amenityBadge}>ücretsiz</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      {journey && (
        <View style={[styles.journeyBar, { paddingBottom: insets.bottom + 10 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.jLabel}>Durak {target + 1}/{exp.length}</Text>
            <Text style={styles.jStop} numberOfLines={1}>{exp[target]?.name}</Text>
            {userLoc && exp[target] ? (
              distMeters(userLoc, exp[target]) < 25 ? (
                <Text style={styles.jArrived}>✓ Vardın — keyfini çıkar</Text>
              ) : (
                <Text style={styles.jDist}>📍 {distText(distMeters(userLoc, exp[target]))} ileride · seni takip ediyorum</Text>
              )
            ) : (
              <Text style={styles.jLabel}>📍 Konum bekleniyor…</Text>
            )}
          </View>
          {target < exp.length - 1 ? (
            <TouchableOpacity style={styles.jNext} onPress={() => setTarget(target + 1)}>
              <Text style={styles.jNextText}>Sonraki ›</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.jNext} onPress={() => setJourney(false)}>
              <Text style={styles.jNextText}>Bitir</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function Pill({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{icon} {text}</Text>
    </View>
  );
}

const NODE = 30;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  error: { color: "#b91c1c", paddingHorizontal: 24, textAlign: "center" },
  map: { height: 230, width: "100%" },
  backBtn: {
    position: "absolute", left: 14, width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadow(8),
  },
  backIcon: { fontSize: 26, color: colors.text, marginTop: -3, fontFamily: font.bold },

  sheet: {
    flex: 1, marginTop: -24, backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: "hidden",
  },
  handle: {
    width: 42, height: 5, borderRadius: 3, backgroundColor: "#CBD5E1",
    alignSelf: "center", marginTop: 9, marginBottom: 2,
  },

  hero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heart: { padding: 4 },
  heartText: { fontSize: 26 },
  title: { fontSize: 24, fontFamily: font.black, color: colors.text },
  desc: { marginTop: 8, color: colors.textMuted, lineHeight: 21, fontSize: 14.5, fontFamily: font.regular },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  pill: { backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  pillText: { fontSize: 13, color: colors.text, fontFamily: font.bold },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  tag: { color: colors.primaryDark, fontSize: 13, fontFamily: font.bold },

  timeline: { paddingHorizontal: 16, paddingTop: 8 },
  row: { flexDirection: "row" },
  rail: { width: 40, alignItems: "center" },
  line: { width: 2, flex: 1 },
  node: {
    width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: "center",
    justifyContent: "center", borderWidth: 3, borderColor: colors.surface, ...shadow(3),
  },
  nodeText: { color: "#fff", fontFamily: font.extra, fontSize: 13 },

  card: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14,
    marginBottom: 14, marginLeft: 6, borderWidth: 1, borderColor: colors.border,
  },
  cardUtility: { backgroundColor: colors.bg, borderStyle: "dashed", borderColor: "#CBD5E1" },
  legPill: {
    alignSelf: "flex-start", backgroundColor: "#ECFEFF", borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
  },
  legText: { fontSize: 12, color: colors.primaryDark, fontFamily: font.bold },
  stopName: { fontSize: 16, fontFamily: font.extra, color: colors.text },
  stopNameUtility: { fontFamily: font.bold, color: colors.textMuted },
  utilityTag: {
    alignSelf: "flex-start", marginTop: 5, fontSize: 11, color: colors.textMuted, fontFamily: font.semibold,
    backgroundColor: colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: "hidden",
  },
  note: { marginTop: 7, color: colors.textMuted, lineHeight: 20, fontSize: 14, fontFamily: font.regular },

  nearby: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  nearbyTitle: { fontSize: 13, color: colors.textFaint, fontFamily: font.bold, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  amenity: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md, padding: 12, marginBottom: 8,
  },
  amenityIcon: { fontSize: 20 },
  amenityName: { fontSize: 14, color: colors.text, fontFamily: font.bold },
  amenityNote: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, fontFamily: font.regular },
  amenityBadge: {
    fontSize: 11, color: colors.primaryDark, fontFamily: font.bold, backgroundColor: "#CCFBF1",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden",
  },

  startBtn: { marginTop: 16, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center", ...shadow(6) },
  startBtnText: { color: "#fff", fontFamily: font.extra, fontSize: 16 },
  stopFoot: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 },
  rating: { fontSize: 12.5, color: "#B45309", fontFamily: font.bold },
  dirText: { fontSize: 12.5, color: colors.primary, fontFamily: font.bold },
  journeyBar: {
    position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.text, paddingHorizontal: 16, paddingTop: 12,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
  },
  jLabel: { color: "#94A3B8", fontFamily: font.semibold, fontSize: 12 },
  jStop: { color: "#fff", fontFamily: font.extra, fontSize: 16, marginTop: 1 },
  jDist: { color: "#5EEAD4", fontFamily: font.semibold, fontSize: 12.5, marginTop: 2 },
  jArrived: { color: "#86EFAC", fontFamily: font.extra, fontSize: 12.5, marginTop: 2 },
  jNext: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
  jNextText: { color: "#fff", fontFamily: font.extra, fontSize: 13 },
});
