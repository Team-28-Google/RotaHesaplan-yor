import { useMemo, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OSMMap, { type OSMMarker, type OSMPolyline } from "../components/OSMMap";
import { planRoute } from "../lib/api";
import { colors, font, radius, shadow } from "../lib/theme";
import type { PlanResponse } from "../lib/types";
import { budgetLabel, transportIcon, transportLabel, waypointIcon } from "../lib/ui";

const SUGGESTIONS = [
  "Kafa dinlemek istiyorum, bütçem az",
  "Tarihi ve kültürel yerler gezmek",
  "Boğazda açık havada yürüyüş",
  "Müze ve kapalı mekanlar, bütçe orta",
];

export default function PlanScreen() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await planRoute(text.trim());
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.topbarTitle}>✨ AI ile Planla</Text>
      </View>
      {result ? (
        <PlanResult result={result} onReset={reset} />
      ) : (
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Nasıl bir gün istiyorsun?</Text>
        <Text style={styles.h2}>Ruh halini yaz; SANA hafızasından sana göre bir rota kursun.</Text>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="örn. Bugün yalnızım, kafa dinlemek istiyorum, bütçem az"
          placeholderTextColor={colors.textFaint}
          multiline
        />

        <View style={styles.chips}>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity key={s} style={styles.chip} onPress={() => setText(s)}>
              <Text style={styles.chipText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && <Text style={styles.error}>⚠️ {error}</Text>}

        <TouchableOpacity
          style={[styles.btn, (!text.trim() || loading) && styles.btnDisabled]}
          onPress={submit}
          disabled={!text.trim() || loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>✨ Planla</Text>
          )}
        </TouchableOpacity>
            {loading && <Text style={styles.loadingNote}>AI senin için planlıyor…</Text>}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function PlanResult({ result, onReset }: { result: PlanResponse; onReset: () => void }) {
  const route = result.route;
  const ai = result.ai ?? {};
  const exp = useMemo(() => (route?.waypoints ?? []).filter((w) => w.kind === "experience"), [route]);
  const util = useMemo(() => (route?.waypoints ?? []).filter((w) => w.kind === "utility"), [route]);

  const polylines = useMemo<OSMPolyline[]>(
    () => (exp.length
      ? [{ id: "r", color: colors.primary, coords: exp.map((w) => ({ lat: w.lat, lng: w.lng })), modes: exp.map((w) => w.transport_mode) }]
      : []),
    [exp],
  );
  const markers = useMemo<OSMMarker[]>(
    () => [
      ...exp.map((w, i) => ({
        id: w.id, lat: w.lat, lng: w.lng, color: colors.primary, label: String(i + 1),
        photo: w.photo_urls?.[0], popup: w.name,
        variant: (i === 0 ? "start" : i === exp.length - 1 ? "end" : "stop") as "start" | "end" | "stop",
      })),
      ...util.map((w) => ({ id: w.id, lat: w.lat, lng: w.lng, color: colors.utility, emoji: waypointIcon(w) })),
    ],
    [exp, util],
  );

  if (!result.ok || !route) {
    return (
      <View style={styles.center}>
        <Text style={styles.h1}>Uygun rota bulamadım 😔</Text>
        <Text style={styles.h2}>Farklı bir ifadeyle tekrar dener misin?</Text>
        <TouchableOpacity style={styles.btn} onPress={onReset}><Text style={styles.btnText}>← Yeni plan</Text></TouchableOpacity>
      </View>
    );
  }

  const narrative = (i: number) => ai.stops?.find((s) => s.seq === i)?.narrative ?? exp[i]?.note ?? "";

  return (
    <View style={styles.container}>
      <OSMMap polylines={polylines} markers={markers} padding={48} style={styles.map} showRecenter />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.aiTag}>✨ Sana özel</Text>
            <Text style={styles.title}>{ai.title ?? route.title}</Text>
            {!!ai.summary && <Text style={styles.summary}>{ai.summary}</Text>}
            <View style={styles.pills}>
              <Text style={styles.pill}>💰 {budgetLabel(route.budget_level)}</Text>
              <Text style={styles.pill}>📍 {exp.length} durak</Text>
              {result.weather?.temp != null && (
                <Text style={styles.pill}>🌤️ {result.weather.temp}° {result.weather.desc}</Text>
              )}
            </View>
            {!!ai.weather_note && <Text style={styles.note}>🌦️ {ai.weather_note}</Text>}
            {!!ai.budget_note && <Text style={styles.note}>💸 {ai.budget_note}</Text>}
          </View>

          <View style={styles.timeline}>
            {exp.map((w, i) => (
              <View key={w.id} style={styles.row}>
                <View style={styles.rail}>
                  <View style={[styles.line, { backgroundColor: i === 0 ? "transparent" : colors.border }]} />
                  <View style={styles.node}><Text style={styles.nodeText}>{i + 1}</Text></View>
                  <View style={[styles.line, { backgroundColor: i === exp.length - 1 ? "transparent" : colors.border }]} />
                </View>
                <View style={styles.card}>
                  {w.transport_mode !== "start" && (
                    <View style={styles.legPill}>
                      <Text style={styles.legText}>
                        {transportIcon(w.transport_mode)} {transportLabel(w.transport_mode)}
                        {w.transport_note ? ` · ${w.transport_note}` : ""}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.stopName}>{waypointIcon(w)} {w.name}</Text>
                  {!!narrative(i) && <Text style={styles.stopNote}>{narrative(i)}</Text>}
                </View>
              </View>
            ))}
          </View>

          {util.length > 0 && (
            <View style={styles.nearby}>
              <Text style={styles.nearbyTitle}>Yakında pratik noktalar</Text>
              {util.map((w) => (
                <View key={w.id} style={styles.amenity}>
                  <Text style={{ fontSize: 20 }}>{waypointIcon(w)}</Text>
                  <Text style={styles.amenityName}>{w.name}</Text>
                  <Text style={styles.amenityBadge}>ücretsiz</Text>
                </View>
              ))}
            </View>
          )}

          {!!ai.social_signal && (
            <View style={styles.social}>
              <Text style={styles.socialText}>👋 {ai.social_signal}</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.btn, styles.resetBtn]} onPress={onReset}>
            <Text style={styles.btnText}>← Yeni plan</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const NODE = 30;
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingBottom: 12, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  back: { color: colors.primary, fontFamily: font.bold, fontSize: 16 },
  topbarTitle: { fontFamily: font.extra, fontSize: 17, color: colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },

  form: { padding: 20, gap: 14 },
  h1: { fontSize: 22, fontFamily: font.black, color: colors.text },
  h2: { fontSize: 14, color: colors.textMuted, fontFamily: font.regular, lineHeight: 20 },
  input: {
    minHeight: 96, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16,
    fontSize: 16, color: colors.text, fontFamily: font.regular, textAlignVertical: "top",
    borderWidth: 1, borderColor: colors.border,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 13, color: colors.primaryDark, fontFamily: font.semibold },
  error: { color: "#b91c1c", fontFamily: font.medium },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 16,
    alignItems: "center", justifyContent: "center", ...shadow(6),
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontFamily: font.extra, fontSize: 16 },
  loadingNote: { textAlign: "center", color: colors.textMuted, fontFamily: font.medium },

  map: { height: 220, width: "100%" },
  sheet: {
    flex: 1, marginTop: -24, backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: "hidden",
  },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: "#CBD5E1", alignSelf: "center", marginTop: 9, marginBottom: 2 },
  hero: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  aiTag: { alignSelf: "flex-start", color: colors.primaryDark, fontFamily: font.bold, fontSize: 12, backgroundColor: "#CCFBF1", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: "hidden", marginBottom: 8 },
  title: { fontSize: 22, fontFamily: font.black, color: colors.text },
  summary: { marginTop: 8, color: colors.textMuted, lineHeight: 21, fontSize: 14.5, fontFamily: font.regular },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  pill: { backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, fontSize: 13, color: colors.text, fontFamily: font.bold, overflow: "hidden" },
  note: { marginTop: 10, color: colors.text, fontFamily: font.medium, fontSize: 13.5, lineHeight: 19 },

  timeline: { paddingHorizontal: 16, paddingTop: 12 },
  row: { flexDirection: "row" },
  rail: { width: 40, alignItems: "center" },
  line: { width: 2, flex: 1 },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.surface, ...shadow(3) },
  nodeText: { color: "#fff", fontFamily: font.extra, fontSize: 13 },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, marginBottom: 14, marginLeft: 6, borderWidth: 1, borderColor: colors.border },
  legPill: { alignSelf: "flex-start", backgroundColor: "#ECFEFF", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  legText: { fontSize: 12, color: colors.primaryDark, fontFamily: font.bold },
  stopName: { fontSize: 16, fontFamily: font.extra, color: colors.text },
  stopNote: { marginTop: 7, color: colors.textMuted, lineHeight: 20, fontSize: 14, fontFamily: font.regular },

  nearby: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  nearbyTitle: { fontSize: 13, color: colors.textFaint, fontFamily: font.bold, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  amenity: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  amenityName: { flex: 1, fontSize: 14, color: colors.text, fontFamily: font.bold },
  amenityBadge: { fontSize: 11, color: colors.primaryDark, fontFamily: font.bold, backgroundColor: "#CCFBF1", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden" },

  social: { marginHorizontal: 20, marginTop: 8, backgroundColor: "#FFF7ED", borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: "#FED7AA" },
  socialText: { color: "#9A3412", fontFamily: font.semibold, fontSize: 13.5, lineHeight: 19 },

  resetBtn: { marginHorizontal: 20, marginTop: 18 },
});
