import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Modal, ScrollView, Share, StyleSheet,
  Switch, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import Icon from "../components/Icon";
import { countMyComments, countMyRoutes, getFavoriteIds, getMyProfile, setMyAvatar, uploadPhoto } from "../lib/api";
import { signOut } from "../lib/auth";
import { AUTH_ENABLED, INVITE_URL } from "../lib/config";
import { success, tap } from "../lib/haptics";
import { getJourneys, type JourneyEntry } from "../lib/journeyLog";
import { supabase } from "../lib/supabase";
import { font, gradients, radius, shadow, type ThemeColors } from "../lib/theme";
import { fmtDuration } from "../lib/ui";
import { useLocale } from "../lib/localeContext";
import { useTheme } from "../lib/themeContext";
import type { ProfileScreenProps } from "../navigation";

// Kutlanan rozetler (3.3): ilk kurulumda mevcutlar sessizce kaydedilir, sonra her
// yeni açılan rozet bir kez kutlama modalıyla gösterilir.
const BADGES_SEEN_KEY = "sana_badges_seen_v1";

interface Badge {
  icon: string;
  nameKey: string;
  descKey: string;
  unlocked: boolean;
}

function buildBadges(j: JourneyEntry[], myRoutes: number, favs: number, myComments: number): Badge[] {
  const totalKm = j.reduce((s, x) => s + x.distance_m, 0) / 1000;
  const totalStops = j.reduce((s, x) => s + x.stops, 0);
  return [
    { icon: "footsteps-outline", nameKey: "profile.bStepName", descKey: "profile.bStepDesc", unlocked: j.length >= 1 },
    { icon: "compass-outline", nameKey: "profile.bTravName", descKey: "profile.bTravDesc", unlocked: j.length >= 3 },
    { icon: "business-outline", nameKey: "profile.bCityName", descKey: "profile.bCityDesc", unlocked: j.length >= 5 },
    { icon: "speedometer-outline", nameKey: "profile.b10kName", descKey: "profile.b10kDesc", unlocked: totalKm >= 10 },
    { icon: "location-outline", nameKey: "profile.bExpName", descKey: "profile.bExpDesc", unlocked: totalStops >= 20 },
    { icon: "create-outline", nameKey: "profile.bAuthName", descKey: "profile.bAuthDesc", unlocked: myRoutes >= 1 },
    { icon: "heart-outline", nameKey: "profile.bCollName", descKey: "profile.bCollDesc", unlocked: favs >= 3 },
    { icon: "chatbubble-outline", nameKey: "profile.bSocName", descKey: "profile.bSocDesc", unlocked: myComments >= 1 },
  ];
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors, mode, setMode } = useTheme();
  const { t, lang, setLang } = useLocale();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState<string>("");
  const [journeys, setJourneys] = useState<JourneyEntry[]>([]);
  const [badges, setBadges] = useState<Badge[]>(buildBadges([], 0, 0, 0));
  const [myRoutes, setMyRoutes] = useState(0);

  // Profil görseli (kullanıcı isteği): kamera/galeri → photos bucket → profiles.avatar_url
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const launchAvatar = async (src: "camera" | "library") => {
    try {
      if (src === "camera") {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1],
      };
      const res = src === "camera"
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
      const uri = !res.canceled ? res.assets[0]?.uri : null;
      if (!uri) return;
      setAvatarBusy(true);
      const url = await uploadPhoto(uri);
      if (url && (await setMyAvatar(url))) {
        setAvatarUrl(url);
        success();
      }
    } catch { /* izin reddi vb. — sessiz */ }
    finally { setAvatarBusy(false); }
  };

  const changeAvatar = () => {
    tap();
    Alert.alert(t("profile.photoTitle"), undefined, [
      { text: t("profile.photoTake"), onPress: () => launchAvatar("camera") },
      { text: t("profile.photoLibrary"), onPress: () => launchAvatar("library") },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  // Rozet kutlaması (3.3)
  const [celebrate, setCelebrate] = useState<Badge | null>(null);
  const [celebSharing, setCelebSharing] = useState(false);
  const celebCardRef = useRef<View>(null);
  const celebScale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!celebrate) return;
    celebScale.setValue(0.6);
    Animated.spring(celebScale, { toValue: 1, speed: 14, bounciness: 12, useNativeDriver: true }).start();
  }, [celebrate, celebScale]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [j, routes, favs, comments, user] = await Promise.all([
          getJourneys(),
          countMyRoutes().catch(() => 0),
          getFavoriteIds().catch(() => new Set<string>()),
          countMyComments().catch(() => 0),
          supabase.auth.getUser().then((r) => r.data.user).catch(() => null),
        ]);
        if (!active) return;
        const b = buildBadges(j, routes, favs.size, comments);
        setJourneys(j);
        setMyRoutes(routes);
        setBadges(b);
        setEmail(user?.email ?? "");
        getMyProfile().then((p) => { if (active) setAvatarUrl(p?.avatar_url ?? null); });

        // Yeni açılan rozet var mı? (diff → kutlama; ilk kurulumda sessiz kayıt)
        try {
          const unlocked = b.filter((x) => x.unlocked).map((x) => x.nameKey);
          const raw = await AsyncStorage.getItem(BADGES_SEEN_KEY);
          if (raw === null) {
            await AsyncStorage.setItem(BADGES_SEEN_KEY, JSON.stringify(unlocked));
          } else {
            const seen: string[] = JSON.parse(raw);
            const fresh = unlocked.filter((n) => !seen.includes(n));
            if (fresh.length && active) {
              setCelebrate(b.find((x) => x.nameKey === fresh[0]) ?? null);
              success();
            }
            await AsyncStorage.setItem(BADGES_SEEN_KEY, JSON.stringify(unlocked));
          }
        } catch { /* kutlama kritik değil */ }
      })();
      return () => { active = false; };
    }, []),
  );

  const shareBadge = async () => {
    if (celebSharing) return;
    setCelebSharing(true);
    try {
      const uri = await captureRef(celebCardRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri.startsWith("file://") ? uri : `file://${uri}`, {
          mimeType: "image/png",
          dialogTitle: t("profile.shareBadgeDialog"),
        });
      }
    } catch { /* iptal — yoksay */ }
    finally { setCelebSharing(false); }
  };

  const invite = async () => {
    tap();
    try {
      await Share.share({ message: t("profile.inviteMsg", { url: INVITE_URL }) });
    } catch { /* iptal — yoksay */ }
  };

  const totalKm = journeys.reduce((s, x) => s + x.distance_m, 0) / 1000;
  const totalStops = journeys.reduce((s, x) => s + x.stops, 0);
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const username = email ? email.split("@")[0] : "gezgin";

  const doSignOut = () => {
    Alert.alert(t("profile.logoutTitle"), t("profile.logoutBody"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("profile.logoutBtn"), style: "destructive", onPress: () => { signOut(); } },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: 32, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Gezgin kartı: kimlik + istatistikler + rozet ilerlemesi (tema-bağımsız koyu) */}
      <LinearGradient colors={["#1B2447", "#0B1022"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.heroCard}>
        <View style={styles.heroTop}>
          <TouchableOpacity onPress={changeAvatar} activeOpacity={0.85} disabled={avatarBusy}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarPhoto} contentFit="cover" transition={180} />
            ) : (
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                <Text style={styles.avatarText}>{username.slice(0, 1).toUpperCase()}</Text>
              </LinearGradient>
            )}
            <View style={styles.avatarBadge}>
              {avatarBusy
                ? <ActivityIndicator size={10} color="#fff" />
                : <Ionicons name="camera" size={11} color="#fff" />}
            </View>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>@{username}</Text>
            <Text style={styles.heroCity}>
              <Ionicons name="location" size={11} color="#FF9F8B" /> İstanbul · {t("profile.sanaTraveler")}
            </Text>
          </View>
          {AUTH_ENABLED && (
            <TouchableOpacity onPress={doSignOut} style={styles.heroSignOut} hitSlop={8}>
              <Ionicons name="log-out-outline" size={19} color="rgba(255,255,255,0.75)" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.heroStats}>
          {([
            [String(journeys.length), t("profile.statJourney")],
            [totalKm.toFixed(1), t("profile.statKm")],
            [String(totalStops), t("profile.statStop")],
            [String(myRoutes), t("profile.statRoute")],
          ] as const).map(([val, label], i) => (
            <View key={label} style={[styles.heroStat, i > 0 && styles.heroStatBorder]}>
              <Text style={styles.heroStatVal}>{val}</Text>
              <Text style={styles.heroStatLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.heroProgressRow}>
          <Text style={styles.heroProgressLabel}>{t("profile.badgeProgress", { u: unlockedCount, total: badges.length })}</Text>
          <View style={styles.heroBarBg}>
            <View style={[styles.heroBarFill, { width: `${Math.round((unlockedCount / badges.length) * 100)}%` }]} />
          </View>
        </View>
      </LinearGradient>

      {/* Ayarlar — tek kart, ayraçlı satırlar */}
      <View style={styles.settingsCard}>
        {/* Dil seçici (i18n) */}
        <View style={styles.settingRow}>
          <View style={styles.settingIcon}>
            <Ionicons name="language" size={16} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>{t("settings.language")}</Text>
            <Text style={styles.settingDesc}>{lang === "tr" ? t("settings.langTr") : t("settings.langEn")}</Text>
          </View>
          <View style={styles.langToggle}>
            {(["tr", "en"] as const).map((l) => (
              <TouchableOpacity
                key={l}
                style={[styles.langChip, lang === l && styles.langChipOn]}
                onPress={() => { tap(); setLang(l); }}
                activeOpacity={0.85}
              >
                <Text style={[styles.langChipText, lang === l && styles.langChipTextOn]}>{l.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.settingDivider} />
        <View style={styles.settingRow}>
          <View style={styles.settingIcon}>
            <Ionicons name={mode === "dark" ? "moon" : "sunny"} size={16} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>{t("profile.darkMode")}</Text>
            <Text style={styles.settingDesc}>{mode === "dark" ? t("profile.darkOn") : t("profile.lightOn")}</Text>
          </View>
          <Switch
            value={mode === "dark"}
            onValueChange={(v) => setMode(v ? "dark" : "light")}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
        <View style={styles.settingDivider} />
        <TouchableOpacity style={styles.settingRow} activeOpacity={0.8} onPress={() => navigation.navigate("Onboarding")}>
          <View style={styles.settingIcon}>
            <Ionicons name="options" size={16} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>{t("profile.editPrefs")}</Text>
            <Text style={styles.settingDesc}>{t("profile.editPrefsDesc")}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </TouchableOpacity>
        <View style={styles.settingDivider} />
        <TouchableOpacity style={styles.settingRow} activeOpacity={0.8} onPress={invite}>
          <View style={styles.settingIcon}>
            <Ionicons name="gift" size={16} color={colors.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.settingTitle}>{t("profile.inviteFriend")}</Text>
            <Text style={styles.settingDesc}>{t("profile.inviteFriendDesc")}</Text>
          </View>
          <Ionicons name="share-social-outline" size={18} color={colors.textFaint} />
        </TouchableOpacity>
      </View>

      {/* Rozetler */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t("profile.badgesTitle")}</Text>
        <Text style={styles.sectionMeta}>{unlockedCount}/{badges.length}</Text>
      </View>
      <View style={styles.badgeGrid}>
        {badges.map((b) => (
          <View key={b.nameKey} style={[styles.badge, !b.unlocked && styles.badgeLocked]}>
            <View style={!b.unlocked && { opacity: 0.35 }}>
              <Icon name={b.icon} size={24} color={b.unlocked ? colors.primary : colors.textFaint} />
            </View>
            <Text style={[styles.badgeName, !b.unlocked && { color: colors.textFaint }]}>{t(b.nameKey)}</Text>
            <Text style={styles.badgeDesc}>{t(b.descKey)}</Text>
          </View>
        ))}
      </View>

      {/* Son yolculuklar */}
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{t("profile.recentJourneys")}</Text>
      </View>
      {journeys.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="compass-outline" size={34} color={colors.textFaint} />
          <Text style={styles.emptyText}>{t("profile.noJourneys")}</Text>
        </View>
      ) : (
        journeys.slice(0, 6).map((j, i) => (
          <View key={`${j.routeId}-${j.date}-${i}`} style={styles.journey}>
            <View style={styles.journeyIcon}>
              <Ionicons name="checkmark-done" size={16} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.journeyTitle} numberOfLines={1}>{j.title}</Text>
              <Text style={styles.journeyMeta}>
                {t("profile.journeyMeta", {
                  date: new Date(j.date).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-US", { day: "numeric", month: "short" }),
                  km: (j.distance_m / 1000).toFixed(1), stops: j.stops, dur: fmtDuration(j.duration_min),
                })}
              </Text>
            </View>
          </View>
        ))
      )}

      {/* Rozet kutlaması (3.3): yeni rozet ilk kez açıldığında bir kez gösterilir */}
      <Modal visible={!!celebrate} transparent animationType="fade" onRequestClose={() => setCelebrate(null)}>
        <View style={styles.celebBg}>
          {celebrate && (
            <Animated.View style={{ transform: [{ scale: celebScale }], alignItems: "center" }}>
              <View ref={celebCardRef} collapsable={false} style={styles.celebCard}>
                <LinearGradient colors={["#1B2447", "#0B1022"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.celebInner}>
                  <Icon name={celebrate.icon} size={64} color="#FF9F8B" />
                  <Text style={styles.celebLabel}>{t("profile.newBadge")}</Text>
                  <Text style={styles.celebName}>{t(celebrate.nameKey)}</Text>
                  <Text style={styles.celebDesc}>{t(celebrate.descKey)}</Text>
                  <View style={styles.celebBrandRow}>
                    <View style={styles.celebBrandDot} />
                    <Text style={styles.celebBrand}>SANA</Text>
                  </View>
                </LinearGradient>
              </View>
              <View style={styles.celebBtns}>
                <TouchableOpacity style={styles.celebGhost} onPress={() => setCelebrate(null)}>
                  <Text style={styles.celebGhostText}>{t("common.close")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.celebShare, celebSharing && { opacity: 0.6 }]} onPress={shareBadge} disabled={celebSharing}>
                  {celebSharing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.celebShareText}>{t("common.share")}</Text>}
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  // Gezgin kartı — tema-bağımsız koyu (paylaşım kartlarıyla aynı dil)
  heroCard: { borderRadius: radius.xl, padding: 18, marginBottom: 16, ...shadow(10) },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", ...shadow(8) },
  avatarText: { color: "#fff", fontFamily: font.black, fontSize: 25 },
  avatarPhoto: { width: 62, height: 62, borderRadius: 31, backgroundColor: "rgba(255,255,255,0.1)" },
  avatarBadge: {
    position: "absolute", bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#F4503B", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#141B33",
  },
  heroName: { color: "#F2F4FC", fontFamily: font.extra, fontSize: 20 },
  heroCity: { color: "#8A93B8", fontFamily: font.medium, fontSize: 12.5, marginTop: 3 },
  heroSignOut: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  heroStats: {
    flexDirection: "row", marginTop: 16, backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radius.lg, paddingVertical: 12,
  },
  heroStat: { flex: 1, alignItems: "center" },
  heroStatBorder: { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.1)" },
  heroStatVal: { color: "#F2F4FC", fontFamily: font.black, fontSize: 19 },
  heroStatLabel: { color: "#8A93B8", fontFamily: font.semibold, fontSize: 11, marginTop: 2 },
  heroProgressRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  heroProgressLabel: { color: "#F2F4FC", fontFamily: font.bold, fontSize: 12.5 },
  heroBarBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  heroBarFill: { height: 6, borderRadius: 3, backgroundColor: "#F4503B" },

  // Ayarlar — tek kart, ayraçlı satırlar
  settingsCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: 22,
  },
  settingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  settingDivider: { height: 1, backgroundColor: colors.border, marginLeft: 60 },
  settingIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  settingTitle: { color: colors.text, fontFamily: font.bold, fontSize: 14.5 },
  settingDesc: { color: colors.textFaint, fontFamily: font.medium, fontSize: 12, marginTop: 2 },
  langToggle: { flexDirection: "row", gap: 6 },
  langChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  langChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  langChipText: { fontSize: 12, fontFamily: font.bold, color: colors.textMuted },
  langChipTextOn: { color: "#fff" },

  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: colors.text, fontFamily: font.extra, fontSize: 17 },
  sectionMeta: { color: colors.primaryDark, fontFamily: font.bold, fontSize: 13 },

  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 22 },
  badge: {
    width: "31%", flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingVertical: 12, paddingHorizontal: 8,
    alignItems: "center",
  },
  badgeLocked: { backgroundColor: "transparent" },
  badgeIcon: { fontSize: 24 },
  badgeName: { color: colors.text, fontFamily: font.bold, fontSize: 12.5, marginTop: 6 },
  badgeDesc: { color: colors.textFaint, fontFamily: font.regular, fontSize: 10.5, marginTop: 2, textAlign: "center" },

  empty: { alignItems: "center", padding: 20, gap: 8 },
  emptyIcon: { fontSize: 34 },
  emptyText: { color: colors.textMuted, fontFamily: font.regular, fontSize: 13.5, textAlign: "center", lineHeight: 19 },

  journey: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface,
    borderRadius: radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  journeyIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  journeyTitle: { color: colors.text, fontFamily: font.bold, fontSize: 14.5 },
  journeyMeta: { color: colors.textFaint, fontFamily: font.medium, fontSize: 12, marginTop: 2 },

  // Rozet kutlaması (3.3) — kart tema-bağımsız koyu (paylaşılabilir görsel)
  celebBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: 24 },
  celebCard: { width: 280, borderRadius: radius.xl, overflow: "hidden", ...shadow(14) },
  celebInner: { padding: 26, alignItems: "center" },
  celebConfetti: { fontSize: 18, letterSpacing: 4 },
  celebIcon: { fontSize: 64, marginTop: 14 },
  celebLabel: { marginTop: 14, color: "#FF9F8B", fontFamily: font.bold, fontSize: 11, letterSpacing: 2.5 },
  celebName: { marginTop: 6, color: "#F2F4FC", fontFamily: font.black, fontSize: 24, textAlign: "center" },
  celebDesc: { marginTop: 6, color: "#8A93B8", fontFamily: font.medium, fontSize: 13.5, textAlign: "center" },
  celebBrandRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 20 },
  celebBrandDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: "#F4503B" },
  celebBrand: { color: "#F2F4FC", fontFamily: font.black, fontSize: 14, letterSpacing: 2 },
  celebBtns: { flexDirection: "row", gap: 10, marginTop: 16, width: 280 },
  celebGhost: { flex: 1, paddingVertical: 13, alignItems: "center", borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.12)" },
  celebGhostText: { color: "#F2F4FC", fontFamily: font.bold },
  celebShare: { flex: 1.4, paddingVertical: 13, alignItems: "center", borderRadius: radius.lg, backgroundColor: colors.primary },
  celebShareText: { color: "#fff", fontFamily: font.extra, fontSize: 15 },
});
