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
import { font, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";
import type { RouteWithWaypoints } from "../lib/types";
import { routeColor, waypointIcon } from "../lib/ui";
import type { HomeScreenProps } from "../navigation";

// Kapaklar yüklenirken gösterilecek yumuşak bulanık yer tutucu
const BLURHASH = "L6Pj0^i_.AyE_3t7t7R**0o#DgR4";

const fmtDur = (min: number | null) => {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}s ${m}dk` : `${m}dk`;
};

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <Text style={{ fontSize: 12.5, color: colors.textMuted, fontFamily: font.semibold }}>{text}</Text>
    </View>
  );
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
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

  // Sekmeye her dönüşte sessiz yenile (yeni rota / beğeni sayısı güncel kalsın)
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

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
          <TouchableOpacity onPress={goCreate} style={styles.createBtn} activeOpacity={0.85}>
            <Text style={styles.createBtnText}>Rota Ekle</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={account} style={styles.avatar} activeOpacity={0.8}>
            <Ionicons name="person" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 16 }}>
          <Skeleton style={{ height: 108, borderRadius: radius.xl }} />
          <Skeleton style={{ height: 24, width: 170 }} />
          {[0, 1].map((i) => (
            <View key={i} style={{ gap: 0 }}>
              <Skeleton style={{ height: 160, borderRadius: radius.lg, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
              <View style={{ backgroundColor: colors.surface, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, padding: 14, gap: 10, borderWidth: 1, borderTopWidth: 0, borderColor: colors.border }}>
                <Skeleton style={{ height: 18, width: "62%" }} />
                <Skeleton style={{ height: 13, width: "90%" }} />
                <Skeleton style={{ height: 40, borderRadius: radius.md, marginTop: 2 }} />
              </View>
            </View>
          ))}
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
          data={routes}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
          ListHeaderComponent={
            <View style={{ gap: 16 }}>
              {/* Hero: yeni rota oluştur */}
              <TouchableOpacity style={styles.hero} activeOpacity={0.9} onPress={goCreate}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle}>Yeni Rota Oluştur</Text>
                  <Text style={styles.heroDesc}>
                    AI destekli planlama ile bir sonraki maceranı haritalandır.
                  </Text>
                  <Text style={styles.heroLink}>Başla  →</Text>
                </View>
                <View style={styles.heroIcon}>
                  <Ionicons name="map" size={26} color={colors.primaryDark} />
                </View>
              </TouchableOpacity>
              <Text style={styles.sectionTitle}>Popüler Rotalar</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyIcon}>🧭</Text>
              <Text style={styles.emptyTitle}>Henüz rota yok</Text>
              <Text style={styles.emptyText}>İlk rotayı sen oluştur — "Rota Ekle" ile başla.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const color = routeColor(index, colors.routeColors);
            const exp = item.waypoints.filter((w) => w.kind === "experience");
            const km = item.total_distance_m ? (item.total_distance_m / 1000).toFixed(1) : "—";
            const dur = fmtDur(item.total_duration_min);
            const icons = exp.slice(0, 5).map(waypointIcon);
            const vibe = item.vibe_tags?.[0];
            return (
              <PressableScale
                style={styles.card}
                onPress={() => navigation.navigate("RouteFlood", { routeId: item.id, title: item.title })}
              >
                {item.cover_photo_url ? (
                  <Image
                    source={{ uri: item.cover_photo_url }}
                    style={styles.cover}
                    placeholder={{ blurhash: BLURHASH }}
                    transition={220}
                    contentFit="cover"
                  />
                ) : (
                  <LinearGradient colors={[color, "rgba(11,16,34,0.85)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover}>
                    <Text style={styles.coverIcons}>{icons.join("   ")}</Text>
                  </LinearGradient>
                )}
                {!!vibe && (
                  <View style={styles.vibeBadge}><Text style={styles.vibeBadgeText}>{vibe.toUpperCase()}</Text></View>
                )}
                <View style={styles.likeBadge}>
                  <Ionicons name="heart" size={12} color="#FF6B54" />
                  <Text style={styles.likeText}> {item.like_count}</Text>
                </View>

                <View style={styles.body}>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  {!!item.description && <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>}
                  <View style={styles.metaRow}>
                    {!!dur && <Meta icon="time-outline" text={dur} />}
                    <Meta icon="location-outline" text={`${exp.length} durak`} />
                    <Meta icon="walk-outline" text={`${km} km`} />
                  </View>
                  <View style={styles.detailBtn}>
                    <Text style={styles.detailBtnText}>Detayları Gör</Text>
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
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  headerBtns: { flexDirection: "row", alignItems: "center", gap: 10 },
  createBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  createBtnText: { color: "#fff", fontFamily: font.extra, fontSize: 13.5 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  error: { color: colors.danger, fontFamily: font.medium, textAlign: "center" },
  retryBtn: { marginTop: 8, backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#fff", fontFamily: font.bold, fontSize: 14 },
  emptyIcon: { fontSize: 44 },
  emptyTitle: { fontFamily: font.extra, fontSize: 18, color: colors.text, marginTop: 6 },
  emptyText: { fontFamily: font.regular, fontSize: 14, color: colors.textMuted, textAlign: "center", lineHeight: 20 },

  hero: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: 18,
    borderWidth: 1, borderColor: colors.border,
  },
  heroTitle: { fontSize: 19, fontFamily: font.extra, color: colors.text },
  heroDesc: { fontSize: 13.5, color: colors.textMuted, marginTop: 6, lineHeight: 19, fontFamily: font.regular },
  heroLink: { marginTop: 12, color: colors.primaryDark, fontFamily: font.extra, fontSize: 14 },
  heroIcon: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 20, fontFamily: font.extra, color: colors.text },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: colors.border, ...shadow(8),
  },
  cover: { width: "100%", height: 160, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  coverIcons: { fontSize: 30 },
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
  body: { padding: 14 },
  title: { fontSize: 17.5, fontFamily: font.extra, color: colors.text },
  desc: { fontSize: 13.5, color: colors.textMuted, marginTop: 4, lineHeight: 19, fontFamily: font.regular },
  metaRow: { flexDirection: "row", gap: 14, marginTop: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  meta: { fontSize: 12.5, color: colors.textMuted, fontFamily: font.semibold },
  detailBtn: {
    marginTop: 12, backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    paddingVertical: 11, alignItems: "center",
  },
  detailBtnText: { color: colors.text, fontFamily: font.bold, fontSize: 13.5 },
});
