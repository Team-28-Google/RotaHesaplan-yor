import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchFavoriteRoutes } from "../lib/api";
import { colors, font, radius, shadow } from "../lib/theme";
import type { RouteWithWaypoints } from "../lib/types";
import { budgetLabel, routeColor, waypointIcon } from "../lib/ui";
import type { SavedScreenProps } from "../navigation";

export default function SavedScreen({ navigation }: SavedScreenProps) {
  const insets = useSafeAreaInsets();
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      fetchFavoriteRoutes()
        .then((r) => { if (active) setRoutes(r); })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, []),
  );

  return (
    <View style={styles.screen}>
      <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.headerTitle}>❤️ Kaydettiklerim</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : routes.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🤍</Text>
          <Text style={styles.emptyTitle}>Henüz rota kaydetmedin</Text>
          <Text style={styles.emptyText}>Bir rotayı açıp kalbe dokunarak buraya ekleyebilirsin.</Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item, index }) => {
            const color = routeColor(index);
            const exp = item.waypoints.filter((w) => w.kind === "experience");
            const km = item.total_distance_m ? (item.total_distance_m / 1000).toFixed(1) : "—";
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => navigation.navigate("RouteFlood", { routeId: item.id, title: item.title })}
              >
                <View style={[styles.stripe, { backgroundColor: color }]} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>💰 {budgetLabel(item.budget_level)}</Text>
                    <Text style={styles.meta}>📍 {exp.length} durak</Text>
                    <Text style={styles.meta}>📏 {km} km</Text>
                  </View>
                  <Text style={styles.icons}>{exp.slice(0, 5).map(waypointIcon).join("   ")}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingBottom: 12, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { color: colors.primary, fontFamily: font.bold, fontSize: 16 },
  headerTitle: { fontFamily: font.extra, fontSize: 17, color: colors.text },

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
