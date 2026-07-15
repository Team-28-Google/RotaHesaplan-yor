import { Image } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Icon from "../components/Icon";
import OSMMap, { type OSMMarker, type OSMPolyline } from "../components/OSMMap";
import { createRoute, enrichRoute, searchPlaces } from "../lib/api";
import { vibeLabel } from "../lib/ui";
import { font, radius, shadow, type ThemeColors } from "../lib/theme";
import { useLocale } from "../lib/localeContext";
import { useTheme } from "../lib/themeContext";
import type { CreateStop, EnrichResult, PlaceResult } from "../lib/types";
import type { CreateRouteScreenProps } from "../navigation";

// OSM kategori → Ionicons adı (arama sonuçlarına görsel kimlik verir)
function placeIcon(type?: string): string {
  const t = (type ?? "").toLowerCase();
  if (/cafe|coffee/.test(t)) return "cafe-outline";
  if (/restaurant|food|fast_food/.test(t)) return "restaurant-outline";
  if (/bar|pub|nightclub/.test(t)) return "wine-outline";
  if (/museum|gallery|arts/.test(t)) return "color-palette-outline";
  if (/book|library/.test(t)) return "book-outline";
  if (/park|garden|forest|tree/.test(t)) return "leaf-outline";
  if (/beach|water|bay|sea|river/.test(t)) return "boat-outline";
  if (/hotel|hostel|guest/.test(t)) return "bed-outline";
  if (/mosque|place_of_worship|church/.test(t)) return "moon-outline";
  if (/shop|mall|supermarket|store|market/.test(t)) return "bag-handle-outline";
  if (/viewpoint|attraction|monument|castle|palace|tourism/.test(t)) return "camera-outline";
  if (/station|subway|bus|tram|ferry/.test(t)) return "train-outline";
  return "location-outline";
}

export default function CreateRouteScreen({ navigation }: CreateRouteScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t, lang } = useLocale();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [stops, setStops] = useState<CreateStop[]>([]);
  const [pending, setPending] = useState<{ lat: number; lng: number } | null>(null);
  const [mName, setMName] = useState("");
  const [mNote, setMNote] = useState("");
  const [enriched, setEnriched] = useState<EnrichResult | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const reqId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = async (q: string) => {
    if (!q) return;
    if (timer.current) clearTimeout(timer.current); // bekleyen debounce ile çifte istek atma
    const id = ++reqId.current;
    setSearching(true);
    setError(null);
    try {
      const r = await searchPlaces(q);
      if (id !== reqId.current) return; // eskimiş yanıtı yoksay
      setResults(r);
      if (r.length === 0) setError(t("create.noResults"));
    } catch (e) {
      if (id !== reqId.current) return;
      setError(e instanceof Error ? e.message : t("create.searchFailed"));
    } finally {
      if (id === reqId.current) setSearching(false);
    }
  };

  // Yazdıkça canlı arama (debounce 350ms)
  useEffect(() => {
    const q = query.trim();
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 2) {
      reqId.current++; // bekleyen aramayı iptal et
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(() => runSearch(q), 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearSearch = () => { setQuery(""); setResults([]); setError(null); };
  const addFromResult = (p: PlaceResult) => {
    setStops((prev) => [...prev, { name: p.name, lat: p.lat, lng: p.lng }]);
    clearSearch();
  };

  const markers: OSMMarker[] = stops.map((s, i) => ({
    id: String(i), lat: s.lat, lng: s.lng, color: colors.primary, label: String(i + 1), popup: s.name,
    variant: (i === 0 ? "start" : i === stops.length - 1 ? "end" : "stop") as "start" | "end" | "stop",
  }));
  const polylines: OSMPolyline[] = stops.length > 1
    ? [{ id: "new", color: colors.primary, coords: stops.map((s) => ({ lat: s.lat, lng: s.lng })) }]
    : [];

  const addStop = () => {
    if (!pending || !mName.trim()) return;
    setStops([...stops, { name: mName.trim(), note: mNote.trim() || undefined, lat: pending.lat, lng: pending.lng }]);
    setPending(null);
    setMName("");
    setMNote("");
  };
  const removeStop = (i: number) => setStops(stops.filter((_, idx) => idx !== i));

  const goEnrich = async () => {
    setBusy(true); setError(null);
    try {
      const e = await enrichRoute(stops);
      setEnriched(e);
      setTitle(e.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("create.error"));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!enriched) return;
    setBusy(true); setError(null);
    try {
      const routeId = await createRoute({
        title: title.trim() || enriched.title,
        description: enriched.description,
        vibe_tags: enriched.vibe_tags,
        weather_fit: enriched.weather_fit,
        stops: stops.map((s, i) => ({
          ...s,
          category: enriched.stops[i]?.category ?? "other",
          narrative: enriched.stops[i]?.narrative ?? s.note ?? "",
        })),
      });
      setBusy(false); // Alert geri tuşuyla kapatılırsa buton spinner'da kalmasın
      Alert.alert(t("create.published"), t("create.publishedBody"), [
        { text: t("create.goToRoute"), onPress: () => navigation.replace("RouteFlood", { routeId, title: title.trim() || enriched.title }) },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("create.saveFailed"));
      setBusy(false);
    }
  };

  // ----- REVIEW EKRANI -----
  if (enriched) {
    return (
      <View style={styles.screen}>
        <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => setEnriched(null)} hitSlop={12}><Text style={styles.back}>‹ {t("common.edit")}</Text></TouchableOpacity>
          <Text style={styles.topTitle}>{t("create.confirmTitle")}</Text>
          <View style={{ width: 64 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110 }}>
          <Text style={styles.label}>{t("create.label")}</Text>
          <TextInput style={styles.titleInput} value={title} onChangeText={setTitle} placeholder={t("create.titlePlaceholder")} placeholderTextColor={colors.textFaint} />
          <View style={styles.tagRow}>
            {enriched.vibe_tags.map((tag) => <Text key={tag} style={styles.tag}>#{vibeLabel(tag, lang)}</Text>)}
          </View>
          <Text style={[styles.label, { marginTop: 18 }]}>{t("create.stopsLabel")}</Text>
          {stops.map((s, i) => (
            <View key={i} style={styles.reviewStop}>
              <View style={styles.num}><Text style={styles.numText}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stopName}>{s.name}</Text>
                <Text style={styles.stopNarr}>{enriched.stops[i]?.narrative || s.note}</Text>
              </View>
            </View>
          ))}
          {error && <Text style={styles.error}>⚠️ {error}</Text>}
        </ScrollView>
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
          <TouchableOpacity style={[styles.cta, busy && styles.ctaOff]} onPress={save} disabled={busy} activeOpacity={0.9}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{t("create.saveShare")}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ----- DÜZENLEME EKRANI -----
  return (
    <View style={styles.screen}>
      <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}><Text style={styles.back}>{t("onb.back")}</Text></TouchableOpacity>
        <Text style={styles.topTitle}>{t("create.title")}</Text>
        <View style={{ width: 64 }} />
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Icon name="search-outline" size={15} color={colors.textMuted} />
          <TextInput
            style={styles.searchField}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => runSearch(query.trim())}
            placeholder={t("create.searchPlaceholder")}
            placeholderTextColor={colors.textFaint}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searching ? (
            <ActivityIndicator color={colors.primary} size="small" style={{ marginLeft: 6 }} />
          ) : query.length > 0 ? (
            <TouchableOpacity onPress={clearSearch} hitSlop={10}>
              <Text style={styles.searchClear}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.mapWrap}>
        <OSMMap markers={markers} polylines={polylines} onMapPress={(lat, lng) => setPending({ lat, lng })} padding={40} />
        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>{t("create.hint")}</Text>
        </View>
      </View>

      <View style={styles.panel}>
        {results.length > 0 ? (
          <>
            <View style={styles.resultsHead}>
              <Text style={styles.panelTitle}>{t("create.results")}</Text>
              <TouchableOpacity onPress={clearSearch} hitSlop={10}><Text style={styles.back}>{t("common.close")}</Text></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {results.map((p, i) => (
                <TouchableOpacity key={i} style={styles.resultRow} onPress={() => addFromResult(p)} activeOpacity={0.85}>
                  {p.thumbnail ? (
                    <Image source={{ uri: p.thumbnail }} style={styles.resultThumb} transition={150} contentFit="cover" />
                  ) : (
                    <View style={styles.resultIcon}><Icon name={placeIcon(p.type)} size={18} color={colors.textMuted} /></View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName} numberOfLines={1}>{p.name}</Text>
                    {!!p.address && <Text style={styles.resultAddr} numberOfLines={1}>{p.address}</Text>}
                  </View>
                  <View style={styles.resultAddBtn}><Text style={styles.resultAddText}>＋</Text></View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : (
          <>
            <Text style={styles.panelTitle}>{t("create.stopsCount", { n: stops.length })}</Text>
            <ScrollView style={{ flex: 1 }}>
              {stops.length === 0 && <Text style={styles.empty}>{t("create.noStops")}</Text>}
              {stops.map((s, i) => (
                <View key={i} style={styles.stopRow}>
                  <View style={styles.num}><Text style={styles.numText}>{i + 1}</Text></View>
                  <Text style={styles.stopRowName} numberOfLines={1}>{s.name}</Text>
                  <TouchableOpacity onPress={() => removeStop(i)} hitSlop={10}><Text style={styles.remove}>✕</Text></TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            {error && <Text style={styles.error}>⚠️ {error}</Text>}
            <TouchableOpacity
              style={[styles.cta, (stops.length < 2 || busy) && styles.ctaOff]}
              onPress={goEnrich}
              disabled={stops.length < 2 || busy}
              activeOpacity={0.9}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{t("create.aiComplete", { n: stops.length })}</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Durak ekleme modalı */}
      <Modal visible={!!pending} transparent animationType="fade" onRequestClose={() => setPending(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("create.addStop")}</Text>
            <TextInput style={styles.input} value={mName} onChangeText={setMName} placeholder={t("create.stopNamePlaceholder")} placeholderTextColor={colors.textFaint} autoFocus />
            <TextInput style={styles.input} value={mNote} onChangeText={setMNote} placeholder={t("create.stopNotePlaceholder")} placeholderTextColor={colors.textFaint} />
            <View style={styles.modalRow}>
              <TouchableOpacity onPress={() => setPending(null)} style={styles.modalBtnGhost}><Text style={styles.modalGhostText}>{t("common.cancel")}</Text></TouchableOpacity>
              <TouchableOpacity onPress={addStop} style={[styles.modalBtn, !mName.trim() && styles.ctaOff]} disabled={!mName.trim()}>
                <Text style={styles.modalBtnText}>{t("create.add")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  back: { color: colors.primary, fontFamily: font.bold, fontSize: 16 },
  topTitle: { fontFamily: font.extra, fontSize: 17, color: colors.text },

  mapWrap: { height: "46%" },
  hint: { position: "absolute", top: 12, alignSelf: "center", backgroundColor: "rgba(15,23,42,0.8)", paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill },
  hintText: { color: "#fff", fontFamily: font.semibold, fontSize: 13 },

  searchWrap: { backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.bg,
    borderRadius: radius.pill, paddingLeft: 14, paddingRight: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: colors.border,
  },
  searchIcon: { fontSize: 15, opacity: 0.7 },
  searchField: { flex: 1, fontSize: 15, fontFamily: font.regular, color: colors.text, padding: 0 },
  searchClear: { fontSize: 15, color: colors.textMuted, fontFamily: font.bold, paddingHorizontal: 2 },
  resultsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultThumb: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.surfaceAlt },
  resultIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" },
  resultName: { fontFamily: font.bold, fontSize: 14.5, color: colors.text },
  resultAddr: { fontFamily: font.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  resultAddBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  resultAddText: { fontSize: 18, color: colors.primaryDark, fontFamily: font.extra, marginTop: -1 },

  panel: { flex: 1, padding: 16 },
  panelTitle: { fontFamily: font.extra, fontSize: 16, color: colors.text, marginBottom: 8 },
  empty: { color: colors.textMuted, fontFamily: font.regular, marginTop: 8 },
  stopRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  num: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  numText: { color: "#fff", fontFamily: font.extra, fontSize: 13 },
  stopRowName: { flex: 1, fontFamily: font.semibold, color: colors.text, fontSize: 15 },
  remove: { color: colors.danger, fontSize: 16, fontFamily: font.bold },

  error: { color: colors.danger, fontFamily: font.medium, marginVertical: 6 },
  cta: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 15, alignItems: "center", justifyContent: "center", marginTop: 10, ...shadow(6) },
  ctaOff: { opacity: 0.45 },
  ctaText: { color: "#fff", fontFamily: font.extra, fontSize: 16 },

  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },

  label: { fontFamily: font.bold, fontSize: 13, color: colors.textFaint, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  titleInput: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, fontSize: 18, fontFamily: font.extra, color: colors.text, borderWidth: 1, borderColor: colors.border },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12, alignItems: "center" },
  tag: {
    color: colors.primaryDark, fontFamily: font.bold, fontSize: 12.5,
    backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, overflow: "hidden",
    includeFontPadding: false, textAlignVertical: "center", // Türkçe karakter (ü/ğ/ı) arka plan bozulması fix'i
  },
  reviewStop: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 12 },
  stopName: { fontFamily: font.extra, fontSize: 15, color: colors.text },
  stopNarr: { fontFamily: font.regular, fontSize: 13.5, color: colors.textMuted, marginTop: 3, lineHeight: 19 },

  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", padding: 28 },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20, ...shadow(12) },
  modalTitle: { fontFamily: font.extra, fontSize: 18, color: colors.text, marginBottom: 14 },
  input: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 13, fontSize: 15, fontFamily: font.regular, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  modalRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtnGhost: { flex: 1, paddingVertical: 13, alignItems: "center", borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  modalGhostText: { color: colors.textMuted, fontFamily: font.bold },
  modalBtn: { flex: 1, paddingVertical: 13, alignItems: "center", borderRadius: radius.md, backgroundColor: colors.primary },
  modalBtnText: { color: "#fff", fontFamily: font.extra },
});
