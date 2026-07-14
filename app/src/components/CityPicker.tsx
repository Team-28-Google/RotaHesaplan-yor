import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Animated, Dimensions, KeyboardAvoidingView, Modal, PanResponder,
  Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";

import { cityLatLng, detectCity, searchCities, type CityHit } from "../lib/api";
import { canonKey, CITIES, dynCities, registerCity, searchProvinces, unregisterCity } from "../lib/cities";
import { tap } from "../lib/haptics";
import { supabase } from "../lib/supabase";
import { font, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";

export default function CityPicker({ visible, current, onClose, onSelect }: {
  visible: boolean;
  current: string;
  onClose: () => void;
  onSelect: (cityKey: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [locating, setLocating] = useState(false);
  const [q, setQ] = useState(""); // 81 il araması — cümleye il yazmaya gerek kalmaz
  const results = useMemo(() => searchProvinces(q), [q]);
  useEffect(() => { if (!visible) setQ(""); }, [visible]);

  // DÜNYA şehirleri (Berlin, Münih...): ≥2 harfte Places Autocomplete — yazdıkça
  // ön-ek eşleştirmeli çoklu öneri; TR sonuçları çevrimdışı listeden anında görünür
  const [world, setWorld] = useState<CityHit[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setWorld([]); setSearching(false); return; }
    setSearching(true);
    const my = ++seq.current;
    const h = setTimeout(() => {
      searchCities(t).then((r) => {
        if (my !== seq.current) return; // eski sorgu geç geldiyse yok say
        setWorld(r.filter((w) => (w.country ?? "") !== "Türkiye"));
        setSearching(false);
      });
    }, 250);
    return () => clearTimeout(h);
  }, [q]);

  const pickProvince = async (p: { key: string; label: string; lat: number; lng: number }) => {
    tap();
    await registerCity(p.key, p.label, p.lat, p.lng); // pilot şehirse no-op
    setQ("");
    onSelect(p.key);
  };

  // Dünya şehri seçimi: autocomplete koordinat taşımaz → seçimde çözülür
  const [resolving, setResolving] = useState<string | null>(null);
  const pickWorld = async (w: CityHit) => {
    tap();
    setResolving(w.place_id ?? w.name);
    const loc = await cityLatLng(w);
    setResolving(null);
    if (!loc) { Alert.alert("Konum çözülemedi", "Tekrar dene ya da başka şehir seç."); return; }
    await pickProvince({ key: canonKey(w.name), label: w.name, lat: loc.lat, lng: loc.lng });
  };

  // Eklenen şehri sil (6 pilot silinemez; aktif olan silinmesin diye ikon gizlenir)
  const [, force] = useState(0);
  const removeDyn = async (key: string) => {
    tap();
    await unregisterCity(key);
    force((x) => x + 1);
  };

  // Geocoding: konumdan il algıla (tüm-Türkiye) — bilinmeyen il kalıcı kayda alınır,
  // AI o ilde de rota üretir; elle şehir eklemek gerekmez
  const findByLocation = async () => {
    tap();
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Konum izni gerekli", "Şehrini otomatik bulmak için konum izni vermelisin — ya da listeden seç.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const d = await detectCity(pos.coords.latitude, pos.coords.longitude);
      if (d) {
        await registerCity(d.key, d.label, pos.coords.latitude, pos.coords.longitude);
        onSelect(d.key);
      } else {
        Alert.alert("Şu an bulunamadı", "Konum servisine ulaşılamadı ya da il çözülemedi — tekrar dene ya da listeden seç.");
      }
    } catch {
      Alert.alert("Konum alınamadı", "Tekrar dene ya da listeden seç.");
    } finally {
      setLocating(false);
    }
  };

  // Aşağı kaydırınca kapat (tutamak/başlık bölgesinden sürükle)
  const dragY = useRef(new Animated.Value(0)).current;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6,
      onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 0.5) onClose();
        else Animated.spring(dragY, { toValue: 0, speed: 18, bounciness: 6, useNativeDriver: true }).start();
      },
    }),
  ).current;
  useEffect(() => { if (visible) dragY.setValue(0); }, [visible, dragY]);

  // Şehir başına rota sayısı — sunucuda gruplanır (0021); yalnız herkese açık rotalar
  useEffect(() => {
    if (!visible) return;
    supabase.rpc("city_route_counts").then(({ data }) => {
      const c: Record<string, number> = {};
      for (const r of (data ?? []) as { city: string; n: number }[]) c[r.city] = r.n;
      setCounts(c);
    });
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.bg} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: dragY }] }]}>
          <View {...pan.panHandlers}>
            <View style={styles.handle} />
            <View style={styles.headRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Hangi şehirdesin?</Text>
                <Text style={styles.sub}>Rotalar, harita ve AI planlama bu şehre göre çalışır.</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={19} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 81 il araması: yaz → seç; seçilen il kalıcı kaydolur, AI orada üretir */}
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={q}
              onChangeText={setQ}
              placeholder="Şehir ara — Türkiye + dünya (örn. Antalya, Berlin)"
              placeholderTextColor={colors.textFaint}
              autoCorrect={false}
            />
            {q.length > 0 && (
              <TouchableOpacity onPress={() => setQ("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.textFaint} />
              </TouchableOpacity>
            )}
          </View>

          {/* Liste sabit yükseklikte KAYDIRILIR — sheet büyüyüp ekranı itmez */}
          <ScrollView
            style={{ maxHeight: Math.min(400, Dimensions.get("window").height * 0.48) }}
            contentContainerStyle={{ gap: 10 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          {q.trim().length > 0 && results.map((p) => (
            <TouchableOpacity key={p.key} style={styles.row} activeOpacity={0.85} onPress={() => pickProvince(p)}>
              <View style={styles.iconWrap}>
                <Ionicons name="location-outline" size={20} color={colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.label}</Text>
                <Text style={styles.districts}>
                  {counts[p.key] != null ? `${counts[p.key]} rota` : "AI bu şehirde senin için üretir"}
                </Text>
              </View>
              {p.key === current
                ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                : <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />}
            </TouchableOpacity>
          ))}
          {q.trim().length > 0 && world.map((w, i) => {
            const busy = resolving === (w.place_id ?? w.name);
            return (
              <TouchableOpacity
                key={`w-${w.place_id ?? `${w.name}-${i}`}`}
                style={styles.row}
                activeOpacity={0.85}
                disabled={!!resolving}
                onPress={() => pickWorld(w)}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name="globe-outline" size={20} color={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{w.name}</Text>
                  <Text style={styles.districts} numberOfLines={1}>
                    {w.country ?? "Dünya"}
                  </Text>
                </View>
                {busy
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : canonKey(w.name) === current
                    ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    : <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />}
              </TouchableOpacity>
            );
          })}
          {q.trim().length >= 2 && searching && world.length === 0 && (
            <View style={styles.searchingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.noResult}>Dünya şehirleri aranıyor…</Text>
            </View>
          )}
          {q.trim().length > 0 && !searching && results.length === 0 && world.length === 0 && (
            <Text style={styles.noResult}>Şehir bulunamadı — yazımı kontrol et.</Text>
          )}

          {q.trim().length === 0 && (
          <TouchableOpacity style={[styles.row, styles.locRow]} onPress={findByLocation} disabled={locating} activeOpacity={0.85}>
            <View style={styles.iconWrap}><Ionicons name="locate-outline" size={20} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.primaryDark }]}>
                {locating ? "Konum alınıyor…" : "Konumumdan bul"}
              </Text>
              <Text style={styles.districts}>Türkiye'nin her ilinde çalışır — AI orada rota üretir</Text>
            </View>
            {locating
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Ionicons name="navigate" size={18} color={colors.primary} />}
          </TouchableOpacity>
          )}

          {/* Eklenen şehirler listenin SONUNDA kalıcı durur (kaydırma var) —
              sık kullanılan şehri her seferinde yazmak gerekmez; çöp ikonuyla silinir */}
          {q.trim().length === 0 && [...CITIES, ...dynCities()].map((c) => {
            const on = c.key === current;
            const isDyn = !CITIES.some((x) => x.key === c.key);
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.row, on && styles.rowOn]}
                activeOpacity={0.85}
                onPress={() => { tap(); onSelect(c.key); }}
              >
                <View style={[styles.iconWrap, on && styles.iconWrapOn]}>
                  <Ionicons name="location-outline" size={20} color={on ? colors.primary : colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, on && styles.nameOn]}>{c.label}</Text>
                  <Text style={styles.districts} numberOfLines={1}>
                    {c.districts.length ? c.districts.slice(0, 3).join(" · ") : "AI bu şehirde senin için üretir"}
                  </Text>
                </View>
                {counts[c.key] != null && (
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>{counts[c.key]} rota</Text>
                  </View>
                )}
                {on ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                ) : isDyn ? (
                  <TouchableOpacity onPress={() => removeDyn(c.key)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={18} color={colors.textFaint} />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                )}
              </TouchableOpacity>
            );
          })}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: 18, paddingTop: 10, paddingBottom: 30, gap: 10, ...shadow(14),
  },
  handle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 4 },
  headRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.lg,
    paddingHorizontal: 12, borderWidth: 1.5, borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 13.5, fontFamily: font.medium, color: colors.text },
  noResult: { fontSize: 12.5, fontFamily: font.medium, color: colors.textFaint, textAlign: "center", paddingVertical: 8 },
  searchingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 8 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceAlt,
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  title: { fontSize: 19, fontFamily: font.extra, color: colors.text },
  sub: { fontSize: 12.5, fontFamily: font.regular, color: colors.textMuted, marginBottom: 4 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.lg,
    paddingVertical: 12, paddingHorizontal: 12,
    borderWidth: 1.5, borderColor: colors.border,
  },
  rowOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  locRow: { borderStyle: "dashed", borderColor: colors.primary, backgroundColor: colors.primarySoft },
  iconWrap: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  iconWrapOn: { backgroundColor: colors.surface },
  icon: { fontSize: 20 },
  name: { fontSize: 15.5, fontFamily: font.extra, color: colors.text },
  nameOn: { color: colors.primaryDark },
  districts: { fontSize: 11.5, fontFamily: font.medium, color: colors.textFaint, marginTop: 2 },
  countPill: {
    backgroundColor: colors.surface, borderRadius: radius.pill,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  countText: { fontSize: 11, fontFamily: font.bold, color: colors.textMuted },
});
