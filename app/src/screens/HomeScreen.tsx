import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchRoutes } from "../lib/api";
import { signOut } from "../lib/auth";
import { AUTH_ENABLED } from "../lib/config";
import { colors, font, radius, shadow } from "../lib/theme";
import type { RouteWithWaypoints } from "../lib/types";
import { budgetLabel, routeColor, waypointIcon } from "../lib/ui";
import type { HomeScreenProps } from "../navigation";

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoutes()
      .then(setRoutes)
      .catch((e) => setError(e.message ?? "Yüklenemedi"))
      .finally(() => setLoading(false));
  }, []);

  const account = () => {
    if (!AUTH_ENABLED) return;
    Alert.alert("Hesap", "Çıkış yapmak istiyor musun?", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Çıkış", style: "destructive", onPress: () => { signOut(); } },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.brand}>SANA</Text>
          <Text style={styles.brandSub}>Şehrin gerçek günlerini keşfet</Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity onPress={() => navigation.navigate("CreateRoute")} style={styles.createBtn} activeOpacity={0.85}>
            <Text style={styles.createBtnText}>＋ Rota</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={account} style={styles.avatar} activeOpacity={0.8}>
            <Text style={styles.avatarText}>👤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.error}>⚠️ {error}</Text></View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const color = routeColor(index);
            const exp = item.waypoints.filter((w) => w.kind === "experience");
            const km = item.total_distance_m ? (item.total_distance_m / 1000).toFixed(1) : "—";
            const icons = exp.slice(0, 5).map(waypointIcon);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.92}
                onPress={() => navigation.navigate("RouteFlood", { routeId: item.id, title: item.title })}
              >
                {item.cover_photo_url ? (
                  <Image source={{ uri: item.cover_photo_url }} style={styles.cover} />
                ) : (
                  <LinearGradient colors={[color, "rgba(15,23,42,0.6)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover}>
                    <Text style={styles.coverIcons}>{icons.join("   ")}</Text>
                  </LinearGradient>
                )}
                <View style={styles.likeBadge}><Text style={styles.likeText}>❤️ {item.like_count}</Text></View>

                <View style={styles.body}>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  {!!item.description && <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>}
                  <View style={styles.tagRow}>
                    {(item.vibe_tags ?? []).slice(0, 3).map((t) => (
                      <Text key={t} style={styles.tag}>#{t}</Text>
                    ))}
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>💰 {budgetLabel(item.budget_level)}</Text>
                    <Text style={styles.meta}>📍 {exp.length} durak</Text>
                    <Text style={styles.meta}>📏 {km} km</Text>
                  </View>
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
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    paddingHorizontal: 18, paddingBottom: 14, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  brand: { fontSize: 24, fontFamily: font.black, color: colors.text, letterSpacing: 0.5 },
  brandSub: { fontSize: 13, color: colors.textMuted, marginTop: 2, fontFamily: font.medium },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18 },
  headerBtns: { flexDirection: "row", alignItems: "center", gap: 10 },
  createBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  createBtnText: { color: "#fff", fontFamily: font.extra, fontSize: 14 },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  error: { color: "#b91c1c", fontFamily: font.medium },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden", ...shadow(8) },
  cover: { width: "100%", height: 160, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  coverIcons: { fontSize: 30 },
  likeBadge: {
    position: "absolute", top: 12, right: 12, backgroundColor: "rgba(15,23,42,0.6)",
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  likeText: { color: "#fff", fontFamily: font.bold, fontSize: 12 },
  body: { padding: 14 },
  title: { fontSize: 18, fontFamily: font.extra, color: colors.text },
  desc: { fontSize: 13.5, color: colors.textMuted, marginTop: 4, lineHeight: 19, fontFamily: font.regular },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tag: { fontSize: 12.5, color: colors.primaryDark, fontFamily: font.semibold },
  metaRow: { flexDirection: "row", gap: 14, marginTop: 12 },
  meta: { fontSize: 13, color: colors.textMuted, fontFamily: font.semibold },
});
