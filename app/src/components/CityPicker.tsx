import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { CITIES } from "../lib/cities";
import { tap } from "../lib/haptics";
import { supabase } from "../lib/supabase";
import { font, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";

// Şehir kimliği: küçük bir simge + semt önizlemesi (3.0c şehir seçici)
const CITY_EMOJI: Record<string, string> = {
  Istanbul: "🌉", Ankara: "🏛️", Gaziantep: "🏺", Izmir: "🌊", Bursa: "🌳",
};

export default function CityPicker({ visible, current, onClose, onSelect }: {
  visible: boolean;
  current: string;
  onClose: () => void;
  onSelect: (cityKey: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Şehir başına rota sayısı — sheet açılınca tek hafif sorgu (yalnızca city kolonu)
  useEffect(() => {
    if (!visible) return;
    supabase.from("routes").select("city").then(({ data }) => {
      const c: Record<string, number> = {};
      for (const r of data ?? []) c[r.city as string] = (c[r.city as string] ?? 0) + 1;
      setCounts(c);
    });
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Hangi şehirdesin?</Text>
          <Text style={styles.sub}>Rotalar, harita ve AI planlama bu şehre göre çalışır.</Text>

          {CITIES.map((c) => {
            const on = c.key === current;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.row, on && styles.rowOn]}
                activeOpacity={0.85}
                onPress={() => { tap(); onSelect(c.key); }}
              >
                <View style={[styles.iconWrap, on && styles.iconWrapOn]}>
                  <Text style={styles.icon}>{CITY_EMOJI[c.key] ?? "📍"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, on && styles.nameOn]}>{c.label}</Text>
                  <Text style={styles.districts} numberOfLines={1}>
                    {c.districts.slice(0, 3).join(" · ")}
                  </Text>
                </View>
                {counts[c.key] != null && (
                  <View style={styles.countPill}>
                    <Text style={styles.countText}>{counts[c.key]} rota</Text>
                  </View>
                )}
                {on ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
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
  title: { fontSize: 19, fontFamily: font.extra, color: colors.text },
  sub: { fontSize: 12.5, fontFamily: font.regular, color: colors.textMuted, marginBottom: 4 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.lg,
    paddingVertical: 12, paddingHorizontal: 12,
    borderWidth: 1.5, borderColor: colors.border,
  },
  rowOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
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
