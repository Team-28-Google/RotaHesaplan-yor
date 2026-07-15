import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CityPicker from "../components/CityPicker";
import PressableScale from "../components/PressableScale";
import Skeleton from "../components/Skeleton";
import { fetchAuthorLeaderboard, fetchRoutes, fetchWeeklyLeaderboard, type AuthorLeaderRow } from "../lib/api";
import { cityInfo, getActiveCity, getChosenCity, setActiveCity } from "../lib/cities";
import { tap } from "../lib/haptics";
import { getOnboarding } from "../lib/onboarding";
import { font, gradients, radius, shadow, type ThemeColors } from "../lib/theme";
import { useLocale } from "../lib/localeContext";
import { useTheme } from "../lib/themeContext";
import type { LeaderRow, RouteWithWaypoints } from "../lib/types";
import Icon from "../components/Icon";
import { fmtDuration, routeColor, vibeLabel, waypointIcon } from "../lib/ui";
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

const fmtDur = (min: number | null) => (min ? fmtDuration(min) : null);

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
  const { t, lang } = useLocale();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [authorLeaders, setAuthorLeaders] = useState<AuthorLeaderRow[]>([]);
  const [vibes, setVibes] = useState<string[]>([]);
  const [city, setCity] = useState("Istanbul"); // 3.0c: aktif şehir
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cityKey?: string) => {
    try {
      const c = cityKey ?? (await getActiveCity());
      setCity(c);
      setRoutes(await fetchRoutes(c));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    }
  }, []);

  // İlk açılışta şehir hiç seçilmemişse seçiciyi kendiliğinden aç (keşfedilebilirlik);
  // kullanıcı kapatırsa bu oturumda bir daha zorlamayız.
  const cityAsked = useRef(false);

  // Sekmeye her dönüşte sessiz yenile (yeni rota / beğeni / tercih / şehir güncel kalsın)
  useFocusEffect(
    useCallback(() => {
      getOnboarding().then((p) => setVibes(p?.vibes ?? []));
      fetchWeeklyLeaderboard().then(setLeaders); // boş/erişilemezse şerit görünmez
      fetchAuthorLeaderboard().then(setAuthorLeaders); // ❤️ yazar liderliği (3.12)
      getChosenCity().then((c) => {
        if (c === null && !cityAsked.current) {
          cityAsked.current = true;
          setCityPickerOpen(true);
        }
      });
      load().finally(() => setLoading(false));
    }, [load]),
  );

  // 3.0c: şehir seçici — seçim kalıcıdır (AsyncStorage), tüm ekranlar buna uyar
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const onSelectCity = async (key: string) => {
    setCityPickerOpen(false);
    if (key === city) return;
    await setActiveCity(key);
    setLoading(true);
    load(key).finally(() => setLoading(false));
  };

  // Popüler: beğeniye göre. Sana özel: vibe eşleşme skoru > 0 olanlar, skor sırasıyla.
  const popular = useMemo(
    () => [...routes].sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0)),
    [routes],
  );
  // 🔥 Çok Beğenilenler (3.9): aktif şehirde beğeni almış rotalar, çoktan aza (boşsa şerit gizli)
  const mostLiked = useMemo(
    () => routes
      .filter((r) => (r.like_count ?? 0) >= 1)
      .sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0))
      .slice(0, 8),
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

  const goCreate = () => { tap(); navigation.navigate("CreateRoute"); };
  const goLeaderboard = () => { tap(); navigation.navigate("Leaderboard"); };
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
        <View style={{ flexDirection: "row", gap: 10 }}>
          {icons.map((ic, j) => <Icon key={j} name={ic} size={17} color="rgba(255,255,255,0.9)" />)}
        </View>
      </LinearGradient>
    );
  };

  return (
    <View style={styles.container}>
      <CityPicker
        visible={cityPickerOpen}
        current={city}
        onClose={() => setCityPickerOpen(false)}
        onSelect={onSelectCity}
      />
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <View>
            <Text style={styles.brand}>SANA</Text>
            <TouchableOpacity
              onPress={() => { tap(); setCityPickerOpen(true); }}
              hitSlop={8}
              style={styles.cityChip}
              activeOpacity={0.8}
            >
              <Ionicons name="location" size={12} color={colors.primaryDark} />
              <Text style={styles.cityChipText}>{cityInfo(city).label}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.headerBtns}>
          {/* 🏆 Liderlik — rota oluşturun solunda (profil simgesi kalktı; Profil alt barda) */}
          <TouchableOpacity onPress={goLeaderboard} style={styles.trophyBtn} activeOpacity={0.85}>
            <Ionicons name="trophy" size={17} color={colors.primaryDark} />
          </TouchableOpacity>
          <TouchableOpacity onPress={goCreate} style={styles.createBtn} activeOpacity={0.85}>
            <Ionicons name="add" size={17} color="#fff" />
            <Text style={styles.createBtnText}>{t("home.createRoute")}</Text>
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
            <Text style={styles.retryText}>{t("common.retry")}</Text>
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
                  <Text style={styles.aiTitle}>{t("home.todayPrompt")}</Text>
                  <Text style={styles.aiSub}>{t("home.aiSub")}</Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color={colors.primaryDark} />
              </TouchableOpacity>

              {/* Sana özel: onboarding vibe'larıyla eşleşen rotalar (yatay şerit) */}
              {forYou.length > 0 && (
                <View style={{ gap: 12 }}>
                  <View style={styles.sectionRow}>
                    <Text style={styles.sectionTitle}>{t("home.forYou")}</Text>
                    <Text style={styles.sectionHint}>{t("home.forYouHint")}</Text>
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
                              {[dur, t("common.stopsCount", { n: exp.length })].filter(Boolean).join(" · ")}
                            </Text>
                          </View>
                        </PressableScale>
                      );
                    }}
                  />
                </View>
              )}

              {/* 🔥 Çok Beğenilenler (3.9): topluluğun kalp verdikleri, beğeni rozeti vurgulu */}
              {mostLiked.length > 0 && (
                <View style={{ gap: 12 }}>
                  <View style={styles.sectionRow}>
                    <Text style={styles.sectionTitle}>{t("home.mostLiked")}</Text>
                    <Text style={styles.sectionHint}>{t("home.mostLikedHint")}</Text>
                  </View>
                  <FlatList
                    data={mostLiked}
                    horizontal
                    keyExtractor={(r) => `ml-${r.id}`}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 12 }}
                    renderItem={({ item, index }) => {
                      const exp = item.waypoints.filter((w) => w.kind === "experience");
                      const dur = fmtDur(item.total_duration_min);
                      return (
                        <PressableScale style={styles.miniCard} onPress={() => openRoute(item)}>
                          {renderCover(item, index, styles.miniCover)}
                          <View style={styles.miniLike}>
                            <Ionicons name="heart" size={12} color="#FF6B54" />
                            <Text style={styles.miniLikeText}> {item.like_count}</Text>
                          </View>
                          <View style={styles.miniBody}>
                            <Text style={styles.miniTitle} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.miniMeta}>
                              {[dur, t("common.stopsCount", { n: exp.length })].filter(Boolean).join(" · ")}
                            </Text>
                          </View>
                        </PressableScale>
                      );
                    }}
                  />
                </View>
              )}

              <Text style={styles.sectionTitle}>{t("home.popularRoutes")}</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Icon name="compass-outline" size={40} color={colors.textFaint} />
              <Text style={styles.emptyTitle}>{t("home.empty")}</Text>
              <Text style={styles.emptyText}>{t("home.emptyHint")}</Text>
            </View>
          }
          ListFooterComponent={
            leaders.length > 0 || authorLeaders.length > 0 ? (
              <View style={{ gap: 14 }}>
                {leaders.length > 0 && (
                  <TouchableOpacity
                    style={styles.leaderCard}
                    activeOpacity={0.85}
                    onPress={() => { tap(); navigation.navigate("Leaderboard"); }}
                  >
                    <View style={styles.leaderHead}>
                      <Text style={styles.leaderTitle}>{t("home.weeklyTravelers")}</Text>
                      <Text style={styles.leaderMore}>{t("home.seeAll")}</Text>
                    </View>
                    <Text style={styles.leaderSub}>{t("home.verifiedOnly")}</Text>
                    {leaders.slice(0, 5).map((l, i) => (
                      <View key={l.user_id} style={styles.leaderRow}>
                        <Text style={styles.leaderRank}>{i + 1}</Text>
                        <Text style={styles.leaderName} numberOfLines={1}>{l.username}</Text>
                        <Text style={styles.leaderMeta}>
                          {t("home.leaderStatWalk", { km: (l.total_distance_m / 1000).toFixed(1), n: l.journey_count })}
                        </Text>
                      </View>
                    ))}
                  </TouchableOpacity>
                )}
                {/* ❤️ Rota yazarı liderliği (3.12): rotaları en çok beğenilenler */}
                {authorLeaders.length > 0 && (
                  <TouchableOpacity
                    style={styles.leaderCard}
                    activeOpacity={0.85}
                    onPress={() => { tap(); navigation.navigate("Leaderboard"); }}
                  >
                    <View style={styles.leaderHead}>
                      <Text style={styles.leaderTitle}>{t("home.topAuthors")}</Text>
                      <Text style={styles.leaderMore}>{t("home.seeAll")}</Text>
                    </View>
                    {authorLeaders.slice(0, 5).map((l, i) => (
                      <View key={l.user_id} style={styles.leaderRow}>
                        <Text style={styles.leaderRank}>{i + 1}</Text>
                        <Text style={styles.leaderName} numberOfLines={1}>{l.username}</Text>
                        <Text style={styles.leaderMeta}>
                          {t("home.leaderStatLikes", { likes: l.total_likes, n: l.route_count })}
                        </Text>
                      </View>
                    ))}
                  </TouchableOpacity>
                )}
              </View>
            ) : null
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
                  colors={["transparent", "rgba(7,10,22,0.55)", "rgba(7,10,22,1)"]}
                  style={styles.bigShade}
                />
                {!!vibe && (
                  <View style={styles.vibeBadge}><Text style={styles.vibeBadgeText}>{vibeLabel(vibe, lang).toLocaleUpperCase(lang === "tr" ? "tr" : "en")}</Text></View>
                )}
                <View style={styles.likeBadge}>
                  <Ionicons name="heart" size={12} color="#FF6B54" />
                  <Text style={styles.likeText}> {item.like_count}</Text>
                </View>
                <View style={styles.bigBody}>
                  <Text style={styles.bigTitle} numberOfLines={2}>{item.title}</Text>
                  <View style={styles.bigMetaRow}>
                    {!!dur && <MetaLight icon="time-outline" text={dur} />}
                    <MetaLight icon="location-outline" text={t("common.stopsCount", { n: exp.length })} />
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
  cityChip: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start",
    marginTop: 3, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 4,
  },
  cityChipText: { fontSize: 12, color: colors.text, fontFamily: font.bold },
  headerBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  trophyBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft,
    borderWidth: 1, borderColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  createBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingLeft: 10, paddingRight: 14, paddingVertical: 9,
  },
  createBtnText: { color: "#fff", fontFamily: font.extra, fontSize: 13 },

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
  miniLike: {
    position: "absolute", top: 8, right: 8, flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(11,16,34,0.72)", borderRadius: radius.pill,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  miniLikeText: { color: "#fff", fontFamily: font.bold, fontSize: 11.5 },
  miniCover: { width: "100%", height: 108, backgroundColor: colors.surfaceAlt },
  miniBody: { padding: 11, gap: 3 },
  miniTitle: { fontSize: 14, fontFamily: font.bold, color: colors.text },
  miniMeta: { fontSize: 12, fontFamily: font.medium, color: colors.textMuted },

  leaderCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  leaderTitle: { fontSize: 15.5, fontFamily: font.extra, color: colors.text, marginBottom: 2 },
  leaderSub: { fontSize: 11.5, fontFamily: font.medium, color: colors.textFaint, marginTop: -6 },
  leaderHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  leaderMore: { fontSize: 12.5, fontFamily: font.bold, color: colors.primaryDark },
  leaderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  leaderRank: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primarySoft,
    color: colors.primaryDark, fontFamily: font.extra, fontSize: 12,
    textAlign: "center", lineHeight: 22, overflow: "hidden",
  },
  leaderName: { flex: 1, fontSize: 14, fontFamily: font.bold, color: colors.text },
  leaderMeta: { fontSize: 12.5, fontFamily: font.medium, color: colors.textMuted },

  bigCard: { height: 220, borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.surfaceAlt, ...shadow(10) },
  bigCover: { ...StyleSheet.absoluteFillObject, borderRadius: radius.xl },
  bigShade: { position: "absolute", left: 0, right: 0, bottom: -1, height: 132 },
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
