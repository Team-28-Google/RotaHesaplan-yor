import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Skeleton from "../components/Skeleton";
import {
  fetchAuthorLeaderboard, fetchWeeklyLeaderboard, type AuthorLeaderRow,
} from "../lib/api";
import { tap } from "../lib/haptics";
import { font, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";
import type { LeaderRow } from "../lib/types";
import type { LeaderboardScreenProps } from "../navigation";

// 1-2-3'e madalya, gerisine sıra numarası
const RANK = ["🥇", "🥈", "🥉"];

export default function LeaderboardScreen({ navigation }: LeaderboardScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tab, setTab] = useState<"walk" | "likes">("walk");
  const [walkers, setWalkers] = useState<LeaderRow[]>([]);
  const [authors, setAuthors] = useState<AuthorLeaderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchWeeklyLeaderboard(), fetchAuthorLeaderboard()])
      .then(([w, a]) => { setWalkers(w); setAuthors(a); })
      .finally(() => setLoading(false));
  }, []);

  const rows = tab === "walk" ? walkers : authors;

  return (
    <View style={styles.screen}>
      <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liderlik</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* İki dünya: gezenler (doğrulanmış yolculuk) · rota yazarları (❤️) */}
      <View style={styles.segment}>
        {([["walk", "🏆 En Çok Gezen"], ["likes", "❤️ En Beğenilen"]] as const).map(([k, label]) => (
          <TouchableOpacity
            key={k}
            style={[styles.segmentBtn, tab === k && styles.segmentBtnOn]}
            onPress={() => { tap(); setTab(k); }}
            activeOpacity={0.85}
          >
            <Text style={[styles.segmentText, tab === k && styles.segmentTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>
        {tab === "walk"
          ? "Son 7 gün · yalnız doğrulanmış yolculuklar sayılır 📍"
          : "Paylaştığın rotaların topladığı toplam beğeni"}
      </Text>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} style={{ height: 64, borderRadius: radius.lg }} />)
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>{tab === "walk" ? "🥾" : "❤️"}</Text>
            <Text style={styles.emptyTitle}>
              {tab === "walk" ? "Bu hafta henüz doğrulanmış yolculuk yok" : "Henüz beğeni toplayan rota yok"}
            </Text>
            <Text style={styles.emptyText}>
              {tab === "walk"
                ? "Bir rotayı gerçekten yürüyüp bitiren ilk kişi sen ol!"
                : "Rota paylaş, beğeni topla — adın burada parlasın."}
            </Text>
          </View>
        ) : (
          rows.map((l, i) => (
            <TouchableOpacity
              key={l.user_id}
              style={[styles.row, i < 3 && styles.rowTop]}
              activeOpacity={0.85}
              onPress={() => {
                tap();
                // Kişiye dokun → herkese açık rotalarının vitrini
                navigation.navigate("UserRoutes", {
                  userId: l.user_id, username: l.username, avatarUrl: l.avatar_url,
                });
              }}
            >
              <Text style={styles.rank}>{RANK[i] ?? `${i + 1}`}</Text>
              <View style={styles.avatar}>
                {l.avatar_url ? (
                  <Image source={{ uri: l.avatar_url }} style={styles.avatarImg} contentFit="cover" />
                ) : (
                  <Ionicons name="person" size={16} color={colors.textMuted} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>@{l.username}</Text>
                <Text style={styles.meta}>
                  {tab === "walk"
                    ? `${(((l as LeaderRow).total_distance_m ?? 0) / 1000).toFixed(1)} km · ${(l as LeaderRow).journey_count} yolculuk`
                    : `${(l as AuthorLeaderRow).total_likes} ❤️ · ${(l as AuthorLeaderRow).route_count} rota`}
                </Text>
              </View>
              {i === 0 ? <Text style={{ fontSize: 20 }}>👑</Text>
                : <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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

  segment: {
    flexDirection: "row", margin: 16, marginBottom: 8, padding: 4,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
  },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: radius.pill },
  segmentBtnOn: { backgroundColor: colors.primary },
  segmentText: { fontFamily: font.bold, fontSize: 13.5, color: colors.textMuted },
  segmentTextOn: { color: "#fff" },
  hint: { textAlign: "center", color: colors.textFaint, fontFamily: font.medium, fontSize: 12 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  rowTop: { borderColor: colors.primary, ...shadow(6) },
  rank: { width: 30, textAlign: "center", fontSize: 16, fontFamily: font.extra, color: colors.textMuted },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  name: { fontSize: 14.5, fontFamily: font.bold, color: colors.text },
  meta: { fontSize: 12.5, fontFamily: font.medium, color: colors.textMuted, marginTop: 2 },

  empty: { alignItems: "center", padding: 30, gap: 8 },
  emptyTitle: { fontFamily: font.extra, fontSize: 16, color: colors.text, textAlign: "center" },
  emptyText: { fontFamily: font.regular, fontSize: 13.5, color: colors.textMuted, textAlign: "center", lineHeight: 19 },
});
