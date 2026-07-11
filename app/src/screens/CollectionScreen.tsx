import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PressableScale from "../components/PressableScale";
import Skeleton from "../components/Skeleton";
import {
  currentUserId, fetchCollection, getOrCreateCollectionToken, removeRouteFromCollection,
  type CollectionMember,
} from "../lib/api";
import { INVITE_URL } from "../lib/config";
import { tap } from "../lib/haptics";
import { font, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";
import type { RouteWithWaypoints } from "../lib/types";
import { budgetLabel, routeColor, waypointIcon } from "../lib/ui";
import type { CollectionScreenProps } from "../navigation";

/** Ortak koleksiyon (3.10): üyeler rota ekler/çıkarır, davet linkiyle büyür. */
export default function CollectionScreen({ route: nav, navigation }: CollectionScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { collectionId, title, emoji } = nav.params;
  const [routes, setRoutes] = useState<RouteWithWaypoints[]>([]);
  const [members, setMembers] = useState<CollectionMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      currentUserId().then((u) => { if (active) setUid(u); });
      fetchCollection(collectionId)
        .then(({ routes: r, members: m }) => { if (active) { setRoutes(r); setMembers(m); } })
        .finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }, [collectionId]),
  );

  const invite = async () => {
    tap();
    const token = await getOrCreateCollectionToken(collectionId);
    if (!token) {
      Alert.alert("Davet edilemedi", "Yalnız koleksiyonun sahibi davet linki üretebilir.");
      return;
    }
    try {
      await Share.share({
        message:
          `SANA'da "${emoji ?? "📁"} ${title}" koleksiyonuna katıl! 🤝\n` +
          `Birlikte rota toplayalım — linke tıkla:\n${INVITE_URL}&joinc=${token}`,
      });
    } catch { /* iptal */ }
  };

  const removeRoute = (r: RouteWithWaypoints) => {
    Alert.alert("Koleksiyondan çıkar", `"${r.title}" bu koleksiyondan çıkarılsın mı? (Rota silinmez.)`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Çıkar", style: "destructive",
        onPress: async () => {
          tap();
          await removeRouteFromCollection(collectionId, r.id);
          setRoutes((prev) => prev.filter((x) => x.id !== r.id));
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{emoji ?? "📁"} {title}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Üyeler + davet */}
      <View style={styles.memberRow}>
        <View style={styles.avatars}>
          {members.slice(0, 5).map((m, i) => (
            <View key={m.user_id} style={[styles.avatar, { marginLeft: i === 0 ? 0 : -10 }]}>
              {m.avatar_url ? (
                <Image source={{ uri: m.avatar_url }} style={styles.avatarImg} contentFit="cover" />
              ) : (
                <Ionicons name="person" size={13} color={colors.textMuted} />
              )}
            </View>
          ))}
          <Text style={styles.memberText}>
            {members.length} üye{uid && members.some((m) => m.user_id === uid) ? " · sen de içindesin" : ""}
          </Text>
        </View>
        <TouchableOpacity style={styles.inviteBtn} onPress={invite} activeOpacity={0.85}>
          <Text style={styles.inviteText}>🤝 Davet et</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 96, borderRadius: radius.lg }} />)}
        </View>
      ) : routes.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 40 }}>{emoji ?? "📁"}</Text>
          <Text style={styles.emptyTitle}>Koleksiyon henüz boş</Text>
          <Text style={styles.emptyText}>
            Bir rotayı açıp "📁 Koleksiyona ekle" ile buraya at — davet ettiklerin de ekleyebilir.
          </Text>
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
                    <TouchableOpacity onPress={() => removeRoute(item)} hitSlop={10}>
                      <Text style={styles.remove}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>💰 {budgetLabel(item.budget_level)}</Text>
                    <Text style={styles.meta}>📍 {exp.length} durak</Text>
                    <Text style={styles.meta}>📏 {km} km</Text>
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
  headerTitle: { flex: 1, textAlign: "center", fontFamily: font.extra, fontSize: 16.5, color: colors.text },

  memberRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  avatars: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceAlt,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
    borderWidth: 2, borderColor: colors.bg,
  },
  avatarImg: { width: 30, height: 30, borderRadius: 15 },
  memberText: { marginLeft: 8, fontSize: 12.5, fontFamily: font.medium, color: colors.textMuted },
  inviteBtn: {
    backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 7,
  },
  inviteText: { color: colors.primaryDark, fontFamily: font.bold, fontSize: 12.5 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  emptyTitle: { fontFamily: font.extra, fontSize: 16, color: colors.text },
  emptyText: { fontFamily: font.regular, fontSize: 13.5, color: colors.textMuted, textAlign: "center", lineHeight: 19 },

  card: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.lg, overflow: "hidden", ...shadow(6) },
  stripe: { width: 6 },
  cardBody: { flex: 1, padding: 14 },
  cardTitle: { fontSize: 16, fontFamily: font.extra, color: colors.text },
  remove: { color: colors.danger, fontFamily: font.black, fontSize: 14, paddingHorizontal: 4 },
  metaRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  meta: { fontSize: 13, color: colors.textMuted, fontFamily: font.semibold },
  icons: { fontSize: 18, marginTop: 10 },
});
