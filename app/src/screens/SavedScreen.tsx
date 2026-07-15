import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "../components/Icon";
import PressableScale from "../components/PressableScale";
import Skeleton from "../components/Skeleton";
import {
  createCollection, fetchFavoriteRoutes, fetchMyCollections, fetchMyRoutes,
  type CollectionInfo,
} from "../lib/api";
import { cityInfo, getActiveCity } from "../lib/cities";
import { tap } from "../lib/haptics";
import { font, radius, shadow, type ThemeColors } from "../lib/theme";
import { useLocale } from "../lib/localeContext";
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
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [favRoutes, setFavRoutes] = useState<RouteWithWaypoints[]>([]);
  const [myRoutes, setMyRoutes] = useState<RouteWithWaypoints[]>([]);
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [tab, setTab] = useState<"saved" | "mine" | "col">("saved"); // ❤️ | 🗺️ | 📁 (3.13/3.10)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const routes = tab === "saved" ? favRoutes : myRoutes;

  // Yeni koleksiyon sheet'i (3.10)
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newEmoji, setNewEmoji] = useState("📁");
  const [savingCol, setSavingCol] = useState(false);
  const EMOJIS = ["📁", "🇮🇹", "🏖️", "🍽️", "🌆", "💜", "🎒", "☕"];

  const doCreate = async () => {
    const t = newTitle.trim();
    if (!t || savingCol) return;
    setSavingCol(true);
    try {
      const id = await createCollection(t, newEmoji);
      if (id) {
        setCreating(false);
        setNewTitle("");
        fetchMyCollections().then(setCollections);
        navigation.navigate("Collection", { collectionId: id, title: t, emoji: newEmoji });
      }
    } finally { setSavingCol(false); }
  };
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
      Promise.all([fetchFavoriteRoutes(), fetchMyRoutes(), fetchMyCollections()])
        .then(([f, m, c]) => { if (active) { setFavRoutes(f); setMyRoutes(m); setCollections(c); setError(null); } })
        .catch((e) => { if (active) setError(e instanceof Error ? e.message : t("saved.loadFailed")); })
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
    key === "all" ? t("common.all") : key === "near" ? `${t("saved.near")}${filt === "near" && !myLoc ? t("saved.nearLoading") : ""}` : cityInfo(key).label;

  return (
    <View style={styles.screen}>
      <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>{t("saved.title")}</Text>
      </View>

      {/* ❤️ Kaydettiklerim | 🗺️ Rotalarım | 📁 Koleksiyonlar (3.13/3.10) */}
      <View style={styles.tabRow}>
        {([["saved", t("saved.tabSaved")], ["mine", t("saved.tabMine")], ["col", t("saved.tabCol")]] as const).map(([k, label]) => (
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
      {tab !== "col" && routes.length > 0 && (
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
                  {chipLabel(key)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {tab === "col" ? (
        /* 📁 Koleksiyonlar (3.10): ortak rota koleksiyonların */
        <FlatList
          data={collections}
          keyExtractor={(c) => c.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          ListHeaderComponent={
            <TouchableOpacity style={styles.newColBtn} onPress={() => { tap(); setCreating(true); }} activeOpacity={0.85}>
              <Text style={styles.newColText}>{t("saved.newCollection")}</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            loading ? (
              <View style={{ gap: 12 }}>
                {[0, 1].map((i) => <Skeleton key={i} style={{ height: 76, borderRadius: radius.lg }} />)}
              </View>
            ) : (
              <View style={styles.center}>
                <Icon name="folder-open-outline" size={40} color={colors.textFaint} />
                <Text style={styles.emptyTitle}>{t("saved.noCollections")}</Text>
                <Text style={styles.emptyText}>{t("saved.noCollectionsHint")}</Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <PressableScale
              style={styles.colCard}
              onPress={() => navigation.navigate("Collection", {
                collectionId: item.id, title: item.title, emoji: item.emoji,
              })}
            >
              {item.emoji ? <Text style={styles.colEmoji}>{item.emoji}</Text> : <Icon name="folder-outline" size={24} color={colors.textMuted} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.colTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.colMeta}>{t("saved.routeCount", { n: item.route_count })} · {t("saved.memberCount", { n: item.member_count })}</Text>
              </View>
              <Text style={styles.colChevron}>›</Text>
            </PressableScale>
          )}
        />
      ) : loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 96, borderRadius: radius.lg }} />)}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Icon name="alert-circle-outline" size={40} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>{t("saved.loadError")}</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : routes.length === 0 ? (
        <View style={styles.center}>
          <Icon name={tab === "saved" ? "heart-outline" : "map-outline"} size={40} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>
            {tab === "saved" ? t("saved.noSaved") : t("saved.noMine")}
          </Text>
          <Text style={styles.emptyText}>
            {tab === "saved" ? t("saved.noSavedHint") : t("saved.noMineHint")}
          </Text>
        </View>
      ) : shown.length === 0 ? (
        <View style={styles.center}>
          <Icon name="location-outline" size={40} color={colors.textFaint} />
          <Text style={styles.emptyTitle}>{t("saved.noneInFilter")}</Text>
          <Text style={styles.emptyText}>{t("saved.noneInFilterHint", { n: routes.length })}</Text>
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(r) => r.id}
          style={{ flex: 1 }}
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
                        {item.is_public === false ? "Özel" : "Açık"}
                      </Text>
                    )}
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>{budgetLabel(item.budget_level)}</Text>
                    <Text style={styles.meta}>{t("common.stopsCount", { n: exp.length })}</Text>
                    <Text style={styles.meta}>{km} km</Text>
                    {awayKm && <Text style={[styles.meta, { color: colors.primaryDark }]}>{awayKm} km uzakta</Text>}
                  </View>
                  <View style={styles.iconsRow}>
                    {exp.slice(0, 5).map((w) => <Icon key={w.id} name={waypointIcon(w)} size={13} color={colors.textFaint} />)}
                  </View>
                </View>
              </PressableScale>
            );
          }}
        />
      )}

      {/* Yeni koleksiyon (3.10): isim + emoji */}
      <Modal visible={creating} transparent animationType="slide" onRequestClose={() => setCreating(false)}>
        <View style={styles.colBg}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setCreating(false)} />
          <View style={styles.colSheet}>
            <View style={styles.colHandle} />
            <Text style={styles.colSheetTitle}>{t("saved.newColTitle")}</Text>
            <TextInput
              style={styles.colInput}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder={t("saved.newColPlaceholder")}
              placeholderTextColor={colors.textFaint}
              autoFocus
              maxLength={40}
            />
            <View style={styles.emojiRow}>
              {EMOJIS.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiChip, newEmoji === e && styles.emojiChipOn]}
                  onPress={() => { tap(); setNewEmoji(e); }}
                >
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.colCreate, (!newTitle.trim() || savingCol) && { opacity: 0.5 }]}
              onPress={doCreate}
              disabled={!newTitle.trim() || savingCol}
              activeOpacity={0.9}
            >
              <Text style={styles.colCreateText}>{savingCol ? t("saved.creating") : t("saved.createAndOpen")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  // 📁 koleksiyonlar (3.10)
  newColBtn: {
    paddingVertical: 13, alignItems: "center", borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", marginBottom: 4,
  },
  newColText: { color: colors.primaryDark, fontFamily: font.bold, fontSize: 14 },
  colCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14,
    borderWidth: 1, borderColor: colors.border, ...shadow(6),
  },
  colEmoji: { fontSize: 26 },
  colTitle: { fontSize: 15.5, fontFamily: font.extra, color: colors.text },
  colMeta: { fontSize: 12.5, fontFamily: font.medium, color: colors.textMuted, marginTop: 2 },
  colChevron: { fontSize: 22, color: colors.textFaint, fontFamily: font.bold },
  colBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  colSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: 20, paddingTop: 10,
  },
  colHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 10 },
  colSheetTitle: { fontSize: 17, fontFamily: font.extra, color: colors.text, marginBottom: 12 },
  colInput: {
    height: 46, backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    paddingHorizontal: 12, color: colors.text, fontFamily: font.regular, fontSize: 15,
    borderWidth: 1, borderColor: colors.border,
  },
  emojiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  emojiChip: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt,
    alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.border,
  },
  emojiChipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  colCreate: {
    marginTop: 16, paddingVertical: 14, alignItems: "center",
    borderRadius: radius.lg, backgroundColor: colors.primary, ...shadow(6),
  },
  colCreateText: { color: "#fff", fontFamily: font.extra, fontSize: 15 },
  // flexShrink: 0 ŞART — FlatList uzayınca yatay çubuk ezilip yarı yüksekliğe iniyordu
  filterBar: { flexGrow: 0, flexShrink: 0, backgroundColor: "transparent" },
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
  iconsRow: { flexDirection: "row", gap: 8, marginTop: 10 },
});
