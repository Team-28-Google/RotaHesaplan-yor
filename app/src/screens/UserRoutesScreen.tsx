import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PressableScale from "../components/PressableScale";
import Skeleton from "../components/Skeleton";
import { fetchUserRoutes } from "../lib/api";
import { font, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";
import type { RouteWithWaypoints } from "../lib/types";
import { budgetLabel, routeColor, waypointIcon } from "../lib/ui";
import type { UserRoutesScreenProps } from "../navigation";

/** Liderlik vitrini: kullanıcının HERKESE AÇIK rotaları (RLS özel olanları getirmez). */
export default function UserRoutesScreen({ route: nav, navigation }: UserRoutesScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { userId, username, avatarUrl } = nav.params;
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserRoutes(userId).then(setRoutes).finally(() => setLoading(false));
  }, [userId]);

  const totalLikes = routes.reduce((s, r) => s + (r.like_count ?? 0), 0);

  return (
    <View style={styles.screen}>
      <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{username}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Kimlik şeridi */}
      <View style={styles.head}>
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <Ionicons name="person" size={22} color={colors.textMuted} />
          )}
        </View>
        <View>
          <Text style={styles.name}>@{username}</Text>
          <Text style={styles.meta}>{routes.length} açık rota · {totalLikes} ❤️</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 96, borderRadius: radius.lg }} />)}
        </View>
      ) : routes.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40 }}>🗺️</Text>
          <Text style={styles.emptyTitle}>Henüz paylaşılmış rotası yok</Text>
          <Text style={styles.emptyText}>Rotalarını herkese açtığında burada görünecek.</Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 30 }}
          renderItem={({ item, index }) => {
            const color = routeColor(index, colors.routeColors);
            const exp = item.waypoints.filter((w) => w.kind === "experience");
            const km = item.total_distance_m ? (item.total_distance_m / 1000).toFixed(1) : "—";
            return (
              <PressableScale
                style={styles.card}
                onPress={() => navigation.navigate("RouteFlood", { routeId: item.id, title: item.title })}
              >
                <View style={[styles.stripe, { backgroundColor: color }]} />
                <View style={styles.cardBody}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[styles.cardTitle, { flex: 1 }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.like}>❤️ {item.like_count}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.cardMeta}>💰 {budgetLabel(item.budget_level)}</Text>
                    <Text style={styles.cardMeta}>📍 {exp.length} durak</Text>
                    <Text style={styles.cardMeta}>📏 {km} km</Text>
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
  back: { color: colors.text, fontSize: 30, fontFamily: font.bold, marginTop: -4 },
  headerTitle: { fontFamily: font.extra, fontSize: 17, color: colors.text },

  head: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 4 },
  avatar: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceAlt,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImg: { width: 52, height: 52, borderRadius: 26 },
  name: { fontSize: 17, fontFamily: font.extra, color: colors.text },
  meta: { fontSize: 12.5, fontFamily: font.medium, color: colors.textMuted, marginTop: 2 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  emptyTitle: { fontFamily: font.extra, fontSize: 16, color: colors.text },
  emptyText: { fontFamily: font.regular, fontSize: 13.5, color: colors.textMuted, textAlign: "center" },

  card: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden", ...shadow(6) },
  stripe: { width: 6 },
  cardBody: { flex: 1, padding: 14 },
  cardTitle: { fontSize: 16, fontFamily: font.extra, color: colors.text },
  like: { fontSize: 12.5, fontFamily: font.bold, color: colors.primaryDark },
  metaRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  cardMeta: { fontSize: 13, color: colors.textMuted, fontFamily: font.semibold },
  icons: { fontSize: 18, marginTop: 10 },
});
