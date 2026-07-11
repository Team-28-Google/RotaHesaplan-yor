import { useMemo, useState } from "react";
import {
  ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";

import { searchPlaces } from "../lib/api";
import { font, radius, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";
import type { PlaceResult } from "../lib/types";

/** Durak ekleme arama sheet'i (2.7b/3.7 ortak) — Google Places, aktif şehir bias'lı. */
export default function AddStopSheet({ visible, onClose, onPick }: {
  visible: boolean;
  onClose: () => void;
  onPick: (p: PlaceResult) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = async () => {
    if (!q.trim() || searching) return;
    setSearching(true);
    try { setPlaces(await searchPlaces(q.trim())); } catch { setPlaces([]); }
    finally { setSearching(false); }
  };

  const pick = (p: PlaceResult) => {
    setQ("");
    setPlaces([]);
    onPick(p);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Durak ekle</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              value={q}
              onChangeText={setQ}
              placeholder="Mekan ara (örn. Moda Sahili)"
              placeholderTextColor={colors.textFaint}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={doSearch}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={doSearch} disabled={searching}>
              {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchText}>Ara</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
            {places.map((p) => (
              <TouchableOpacity key={`${p.place_id ?? p.name}-${p.lat}`} style={styles.result} onPress={() => pick(p)}>
                <Text style={styles.resultName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.resultMeta} numberOfLines={1}>
                  {[p.type, p.address, p.rating ? `★${p.rating}` : null].filter(Boolean).join(" · ")}
                </Text>
              </TouchableOpacity>
            ))}
            {places.length === 0 && !searching && (
              <Text style={styles.empty}>Arama yap — seçtiğin durak rotanın sonuna eklenir.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  bg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24,
  },
  handle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 10 },
  title: { fontSize: 17, fontFamily: font.extra, color: colors.text, marginBottom: 10 },
  row: { flexDirection: "row", gap: 8, marginBottom: 10 },
  input: {
    flex: 1, height: 44, backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    paddingHorizontal: 12, color: colors.text, fontFamily: font.regular, fontSize: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  searchBtn: {
    paddingHorizontal: 18, height: 44, borderRadius: radius.md, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  searchText: { color: "#fff", fontFamily: font.bold, fontSize: 14 },
  result: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultName: { color: colors.text, fontFamily: font.bold, fontSize: 14.5 },
  resultMeta: { color: colors.textFaint, fontFamily: font.medium, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textFaint, fontFamily: font.medium, fontSize: 12.5, paddingVertical: 14, textAlign: "center" },
});
