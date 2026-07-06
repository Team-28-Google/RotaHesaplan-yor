import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useMemo, useState } from "react";
import {
  Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PressableScale from "../components/PressableScale";
import Skeleton from "../components/Skeleton";
import { fetchRoutes } from "../lib/api";
import { signOut } from "../lib/auth";
import { AUTH_ENABLED } from "../lib/config";
import { tap } from "../lib/haptics";
import { getOnboarding } from "../lib/onboarding";
import { font, gradients, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";
import type { RouteWithWaypoints } from "../lib/types";
import { routeColor, waypointIcon } from "../lib/ui";
import type { HomeScreenProps } from "../navigation";

// Kapaklar yüklenirken gösterilecek yumuşak bulanık yer tutucu
const BLURHASH = "L6Pj0^i_.AyE_3t7t7R**0o#DgR4";

// Onboarding vibe'ı → rota etiketleri eşlemesi ("Sana özel" şeridi).
// Seed etiket kümesi vibe id'leriyle birebir örtüşmüyor; yakın anlamlılar eklendi.
const VIBE_MATCH: Record<string, string[]> = {
  sakin: ["sakin", "kafa-dinleme"],
  tarih: ["tarih", "kultur"],
  deniz: ["manzara", "acik-hava"],
  kahve: ["sosyal", "butce-dostu"],
  sanat: ["sanat", "kultur", "fotograf"],
  gece: ["sosyal", "kalabalik"],
  yesil: ["doga", "sakin"],
  yuruyus: ["acik-hava", "kesif"],
};

const fmtDur = (min: number | null) => {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}s ${m}dk` : `${m}dk`;
};

/** Foto üzerinde okunacak açık renkli meta (koyu gradyan şeridin üstünde durur). */
function MetaLight({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={13} color="rgba(255,255,255,0.85)" />
      <Text style={{ fontSize: 12.5, color: "rgba(255,255,255,0.9)", fontFamily: font.semibold }}>{text}</Text>
    </View>
  );
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
  const [vibes, setVibes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRoutes(await fetchRoutes());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    }
  }, []);

  // Sekmeye her dönüşte sessiz yenile (yeni rota / beğeni / tercih güncel kalsın)
  useFocusEffect(
    useCallback(() => {
      getOnboarding().then((p) => setVibes(p?.vibes ?? []));
      load().finally(() => setLoading(false));
    }, [load]),
  );

  // Popüler: beğeniye göre. Sana özel: vibe eşleşme skoru > 0 olanlar, skor sırasıyla.
  const popular = useMemo(
    () => [...routes].sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0)),
    [routes],
  );
  const forYou = useMemo(() => {
    if (!vibes.length) return [];
    const wanted = new Set(vibes.flatMap((v) => VIBE_MATCH[v] ?? [v]));
    return routes
      .map((r) => ({ r, score: (r.vibe_tags ?? []).filter((t) => wanted.has(t)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (b.r.like_count ?? 0) - (a.r.like_count ?? 0))
      .slice(0, 8)
      .map((x) => x.r);
  }, [routes, vibes]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  const account = () => {
    if (!AUTH_ENABLED) return;
    Alert.alert("Hesap", "Çıkış yapmak istiyor musun?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Çıkış", style: "destructive", onPress: () => { signOut(); } },
    ]);
  };

  const goCreate = () => { tap(); navigation.navigate("CreateRoute"); };
  const goPlan = () => { tap(); navigation.navigate("Plan"); };
  const openRoute = (r: RouteWithWaypoints) =>
    navigation.navigate("RouteFlood", { routeId: r.id, title: r.title });

  const renderCover = (r: RouteWithWaypoints, index: number, style: object) => {
    if (r.cover_photo_url) {
      return (
        <Image
          source={{ uri: r.cover_photo_url }}
          style={style}
          placeholder={{ blurhash: BLURHASH }}
          transition={220}
          contentFit="cover"
        />
      );
    }
    const color = routeColor(index, colors.routeColors);
    const icons = r.waypoints.filter((w) => w.kind === "experience").slice(0, 5).map(waypointIcon);
    return (
      <LinearGradient colors={[color, "rgba(11,16,34,0.85)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[style, styles.coverCenter]}>
        <Text style={styles.coverIcons}>{icons.join("   ")}</Text>
      </LinearGradient>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <View>
            <Text style={styles.brand}>SANA</Text>
            <Text style={styles.brandSub}>Şehrin gerçek günlerini keşfet</Text>
          </View>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity onPress={goCreate} style={styles.addBtn} activeOpacity={0.85}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={account} style={styles.avatar} activeOpacity={0.8}>
            <Ionicons name="person" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 16 }}>
          <Skeleton style={{ height: 78, borderRadius: radius.xl }} />
          <Skeleton style={{ height: 22, width: 130 }} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Skeleton style={{ width: 190, height: 170, borderRadius: radius.lg }} />
            <Skeleton style={{ width: 190, height: 170, borderRadius: radius.lg }} />
          </View>
          <Skeleton style={{ height: 22, width: 170 }} />
          <Skeleton style={{ height: 220, borderRadius: radius.xl }} />
        </View>
      ) : error && routes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.error}>⚠️ {error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh} activeOpacity={0.85}>
            <Text style={styles.retryText}>Tekrar dene</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={popular}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          ListHeaderComponent={
            <View style={{ gap: 16 }}>
              {/* AI plan girişi: yaz → Plan sekmesi (uygulamanın kalbi burada başlar) */}
              <TouchableOpacity style={styles.aiCard} activeOpacity={0.9} onPress={goPlan}>
                <LinearGradient colors={gradients.brand} style={styles.aiIcon}>
                  <Ionicons name="sparkles" size={19} color="#fff" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiTitle}>Bugün ne yapmak istersin?</Text>
                  <Text style={styles.aiSub}>Yaz, AI senin için planlasın</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={colors.primaryDark} />
              </TouchableOpacity>

              {/* Sana özel: onboarding vibe'larıyla eşleşen rotalar (yatay şerit) */}
              {forYou.length > 0 && (
                <View style={{ gap: 12 }}>
                  <View style={styles.sectionRow}>
                    <Text style={styles.sectionTitle}>Sana özel</Text>
                    <Text style={styles.sectionHint}>tercihlerine göre</Text>
                  </View>
                  <FlatList
                    data={forYou}
                    horizontal
                    keyExtractor={(r) => `fy-${r.id}`}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12 }}
                    renderItem={({ item, index }) => {
                      const exp = item.waypoints.filter((w) => w.kind === "experience");
                      const dur = fmtDur(item.total_duration_min);
                      return (
                        <PressableScale style={styles.miniCard} onPress={() => openRoute(item)}>
                          {renderCover(item, index, styles.miniCover)}
                          <View style={styles.miniBody}>
                            <Text style={styles.miniTitle} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.miniMeta}>
                              {[dur, `${exp.length} durak`].filter(Boolean).join(" · ")}
                            </Text>
                          </View>
                        </PressableScale>
                      );
                    }}
                  />
                </View>
              )}

              <Text style={styles.sectionTitle}>Popüler Rotalar</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>🧭</Text>
              <Text style={styles.emptyTitle}>Henüz rota yok</Text>
              <Text style={styles.emptyText}>İlk rotayı sen oluştur — "+" ile başla.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const exp = item.waypoints.filter((w) => w.kind === "experience");
            const km = item.total_distance_m ? (item.total_distance_m / 1000).toFixed(1) : "—";
            const dur = fmtDur(item.total_duration_min);
            const vibe = item.vibe_tags?.[0];
            return (
              <PressableScale style={styles.bigCard} onPress={() => openRoute(item)}>
                {renderCover(item, index, styles.bigCover)}
                {/* Alt gradyan: fotoğraf ne olursa olsun başlık/meta okunur kalır */}
                <LinearGradient
                  colors={["transparent", "rgba(7,10,22,0.55)", "rgba(7,10,22,0.94)"]}
                  style={styles.bigShade}
                />
                {!!vibe && (
                  <View style={styles.vibeBadge}><Text style={styles.vibeBadgeText}>{vibe.toUpperCase()}</Text></View>
                )}
                <View style={styles.likeBadge}>
                  <Ionicons name="heart" size={12} color="#FF6B54" />
                  <Text style={styles.likeText}> {item.like_count}</Text>
                </View>
                <View style={styles.bigBody}>
                  <Text style={styles.bigTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.bigMetaRow}>
                    {!!dur && <MetaLight icon="time-outline" text={dur} />}
                    <MetaLight icon="location-outline" text={`${exp.length} durak`} />
                    <MetaLight icon="walk-outline" text={`${km} km`} />
                  </View>
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
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingBottom: 12,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  brand: { fontSize: 22, fontFamily: font.black, color: colors.text, letterSpacing: 1 },
  brandSub: { fontSize: 11.5, color: colors.textFaint, marginTop: 1, fontFamily: font.medium },
  headerBtns: { flexDirection: "row", alignItems: "center", gap: 10 },
  addBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  error: { color: colors.danger, fontFamily: font.medium, textAlign: "center" },
  retryBtn: { marginTop: 8, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#fff", fontFamily: font.bold, fontSize: 14 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontFamily: font.extra, fontSize: 18, color: colors.text, marginTop: 6 },
  emptyText: { fontFamily: font.regular, fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },

  aiCard: {
    flexDirection: "row", alignItems: "center", gap: 13,
    backgroundColor: colors.surface, borderRadius: radius.xl,
    paddingHorizontal: 16, paddingVertical: 15,
    borderWidth: 1, borderColor: colors.border, ...shadow(6),
  },
  aiIcon: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
  },
  aiTitle: { fontSize: 16, fontFamily: font.extra, color: colors.text },
  aiSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, fontFamily: font.regular },

  sectionRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  sectionTitle: { fontSize: 20, fontFamily: font.extra, color: colors.text },
  sectionHint: { fontSize: 12, fontFamily: font.medium, color: colors.textFaint },

  coverCenter: { alignItems: "center", justifyContent: "center" },
  coverIcons: { fontSize: 26 },

  miniCard: {
    width: 190, backgroundColor: colors.surface, borderRadius: radius.lg,
    overflow: "hidden", borderWidth: 1, borderColor: colors.border, ...shadow(6),
  },
  miniCover: { width: "100%", height: 108, backgroundColor: colors.surfaceAlt },
  miniBody: { padding: 11, gap: 3 },
  miniTitle: { fontSize: 14, fontFamily: font.bold, color: colors.text },
  miniMeta: { fontSize: 12, fontFamily: font.medium, color: colors.textMuted },

  bigCard: { height: 220, borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.surfaceAlt, ...shadow(10) },
  bigCover: { ...StyleSheet.absoluteFillObject },
  bigShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 130 },
  bigBody: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, gap: 8 },
  bigTitle: { fontSize: 20, fontFamily: font.extra, color: "#FFFFFF", lineHeight: 25 },
  bigMetaRow: { flexDirection: "row", gap: 14 },
  vibeBadge: {
    position: "absolute", top: 12, left: 12, backgroundColor: "rgba(11,16,34,0.7)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  vibeBadgeText: { color: "#F5E9DC", fontFamily: font.bold, fontSize: 10, letterSpacing: 1.2 },
  likeBadge: {
    position: "absolute", top: 12, right: 12, backgroundColor: "rgba(11,16,34,0.7)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
    flexDirection: "row", alignItems: "center",
  },
  likeText: { color: "#fff", fontFamily: font.bold, fontSize: 12 },
});
