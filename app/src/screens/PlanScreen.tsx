import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator, Dimensions, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CollapsibleSheet from "../components/CollapsibleSheet";
import OSMMap, { type OSMMarker, type OSMPolyline } from "../components/OSMMap";
import {
  addStop, fetchRoute, planRoute, refreshRouteExtras, removeStop, searchPlaces, setFavorite,
  type GenOptions,
} from "../lib/api";
import { cityInfo, getActiveCity } from "../lib/cities";
import { pop, tap } from "../lib/haptics";
import { font, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";
import type { PlaceResult, PlanResponse, Waypoint } from "../lib/types";
import { budgetLabel, legSegments, segmentsToPath, transportIcon, transportLabel, waypointIcon } from "../lib/ui";
import type { PlanScreenProps } from "../navigation";

// 4.0a: sonuç paneli tam ekran haritanın üstünde (aşağı kaydırılıp kapanır)
const SHEET_H = Math.round(Dimensions.get("window").height * 0.58);

const SUGGESTIONS = [
  "Kafa dinlemek istiyorum, bütçem az",
  "Tarihi ve kültürel yerler gezmek",
  "Açık havada uzun bir yürüyüş",
  "Müze ve kapalı mekanlar, bütçe orta",
];

// Pipeline'ın GERÇEK aşamaları (servis bunları aynı sırayla yürütür; bekleme ekranı akışı)
const AGENT_STEPS = [
  { icon: "🧠", label: "Niyet çözümleniyor" },
  { icon: "💾", label: "Hafızan taranıyor" },
  { icon: "🌤️", label: "Hava kontrol ediliyor" },
  { icon: "🗺️", label: "Rotalar eşleştiriliyor" },
  { icon: "✍️", label: "Anlatı yazılıyor" },
];

// 🎲 Üretim modunun aşamaları (2.7) — daha uzun sürer, adımlar farklı akar
const GEN_STEPS = [
  { icon: "🧠", label: "Niyet çözümleniyor" },
  { icon: "🌤️", label: "Hava kontrol ediliyor" },
  { icon: "📍", label: "Gerçek mekânlar aranıyor" },
  { icon: "🧩", label: "Yepyeni rota kuruluyor" },
  { icon: "📸", label: "Foto + sokak geometrisi ekleniyor" },
];

/** Plan beklerken agent adımlarını akıtan gösterge — orkestrasyonu görünür kılar (2.6). */
function AgentProgress({ generating }: { generating?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [idx, setIdx] = useState(0);
  const STEPS = generating ? GEN_STEPS : AGENT_STEPS;

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => Math.min(i + 1, STEPS.length - 1)), generating ? 3200 : 1800);
    return () => clearInterval(t);
  }, [generating, STEPS.length]);

  return (
    <View style={styles.agentBox}>
      {STEPS.map((s, i) => (
        <View key={s.label} style={styles.agentRow}>
          {i < idx ? (
            <Text style={styles.agentDone}>✓</Text>
          ) : i === idx ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ width: 18 }} />
          ) : (
            <Text style={styles.agentPending}>○</Text>
          )}
          <Text style={[
            styles.agentLabel,
            i < idx && styles.agentLabelDone,
            i > idx && styles.agentLabelPending,
          ]}>
            {s.icon} {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function PlanScreen({ navigation }: PlanScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);

  const [genMode, setGenMode] = useState(false); // 🎲 bekleme adımları üretim varyantında aksın
  // 2.7b: mod en başta seçilir; üretimde başlangıç konumu sorulur
  const [mode, setMode] = useState<"match" | "generate">("match");
  const [loc, setLoc] = useState<string>("ai"); // "ai" | "me" | semt adı
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [activeCity, setActiveCityState] = useState("Istanbul"); // 3.0c: semtler şehre göre
  const districts = cityInfo(activeCity).districts;

  // Home'da şehir değişmiş olabilir — sekmeye dönüşte tazele; eski semt seçimi geçersizse sıfırla
  useFocusEffect(
    useCallback(() => {
      getActiveCity().then((c) => {
        setActiveCityState(c);
        setLoc((prev) =>
          prev !== "ai" && prev !== "me" && !cityInfo(c).districts.includes(prev) ? "ai" : prev);
      });
    }, []),
  );

  // "📍 Konumum": izni ancak kullanıcı isteyince sor (Plan'a girer girmez prompt açılmasın)
  const pickMyLocation = async () => {
    tap();
    setLoc("me");
    if (myLoc) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLoc("ai"); return; }
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMyLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
    } catch { setLoc("ai"); }
  };

  const submit = async (force?: "indoor", generateOverride?: boolean) => {
    if (!text.trim()) return;
    const generate = generateOverride ?? mode === "generate";
    let gen: GenOptions | undefined;
    if (generate) {
      if (loc === "me" && myLoc) gen = myLoc;
      else if (loc !== "ai" && loc !== "me") gen = { district: loc };
    }
    setGenMode(generate);
    setLoading(true);
    setError(null);
    try {
      const res = await planRoute(text.trim(), force, generate, gen);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  // ☔ Yağmurlu günde kapalı-mekân alternatifi iste (2.5): aynı niyet, indoor zorlamalı
  const retryIndoor = () => {
    setResult(null);
    submit("indoor");
  };

  // 🎲 AI Rota Üretici (2.7): havuzdan değil, gerçek mekânlardan yepyeni rota kur
  const retryGenerate = () => {
    setResult(null);
    submit(undefined, true);
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.topbarTitle}>AI ile Planla</Text>
      </View>
      {result ? (
        <PlanResult
          result={result}
          onReset={reset}
          onIndoor={retryIndoor}
          onGenerate={retryGenerate}
          onOpenRoute={(id, title) => navigation.navigate("RouteFlood", { routeId: id, title, autoStart: true })}
        />
      ) : (
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Nasıl bir gün istiyorsun?</Text>
        <Text style={styles.h2}>
          {mode === "generate"
            ? "Ruh halini yaz; SANA gerçek mekânlardan sıfırdan rota kursun."
            : "Ruh halini yaz; SANA hafızasından sana göre bir rota kursun."}
        </Text>

        {/* 2.7b: kaynak seçimi en başta */}
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeChip, mode === "match" && styles.modeChipOn]}
            onPress={() => { tap(); setMode("match"); }}
          >
            <Text style={[styles.modeText, mode === "match" && styles.modeTextOn]}>
              {mode === "match" ? "✓ " : ""}📚 Kayıtlı rotalardan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeChip, mode === "generate" && styles.modeChipOn]}
            onPress={() => { tap(); setMode("generate"); }}
          >
            <Text style={[styles.modeText, mode === "generate" && styles.modeTextOn]}>
              {mode === "generate" ? "✓ " : ""}🎲 Yepyeni üret
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2.7b: üretimde başlangıç konumu sor */}
        {mode === "generate" && (
          <View style={{ gap: 8 }}>
            <Text style={styles.locLabel}>Nereden başlayalım?</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                style={[styles.locChip, loc === "ai" && styles.locChipOn]}
                onPress={() => { tap(); setLoc("ai"); }}
              >
                <Text style={[styles.locChipText, loc === "ai" && styles.locChipTextOn]}>
                  {loc === "ai" ? "✓ " : ""}✨ AI seçsin
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.locChip, loc === "me" && styles.locChipOn]}
                onPress={pickMyLocation}
              >
                <Text style={[styles.locChipText, loc === "me" && styles.locChipTextOn]}>
                  {loc === "me" ? "✓ " : ""}📍 Konumum{loc === "me" && !myLoc ? " (alınıyor…)" : ""}
                </Text>
              </TouchableOpacity>
              {districts.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.locChip, loc === d && styles.locChipOn]}
                  onPress={() => { tap(); setLoc(d); }}
                >
                  <Text style={[styles.locChipText, loc === d && styles.locChipTextOn]}>
                    {loc === d ? "✓ " : ""}{d}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="örn. Bugün yalnızım, kafa dinlemek istiyorum, bütçem az"
          placeholderTextColor={colors.textFaint}
          multiline
        />

        <View style={styles.chips}>
          {SUGGESTIONS.map((s) => {
            const on = text === s;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.locChip, on && styles.locChipOn]}
                onPress={() => { tap(); setText(on ? "" : s); }}
              >
                <Text style={[styles.locChipText, on && styles.locChipTextOn]}>{on ? "✓ " : ""}{s}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error && <Text style={styles.error}>⚠️ {error}</Text>}

        <TouchableOpacity
          style={[styles.btn, (!text.trim() || loading) && styles.btnDisabled]}
          onPress={() => submit()}
          disabled={!text.trim() || loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{mode === "generate" ? "🎲 Rota Üret" : "✨ Planla"}</Text>
          )}
        </TouchableOpacity>
            {loading && <AgentProgress generating={genMode} />}
            {loading && genMode && (
              <Text style={styles.genHint}>🎲 Yepyeni bir rota kuruluyor — bu, hazır eşleştirmeden biraz uzun sürer.</Text>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function PlanResult({ result, onReset, onIndoor, onGenerate, onOpenRoute }: {
  result: PlanResponse; onReset: () => void; onIndoor: () => void; onGenerate: () => void;
  onOpenRoute: (id: string, title: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [saved, setSaved] = useState(false);
  // 2.7b: üretilen rota düzenlenebilir → route yerel state'te yaşar
  const [route, setRoute] = useState(result.route);
  useEffect(() => { setRoute(result.route); }, [result.route]);
  const ai = result.ai ?? {};
  const editable = !!result.generated; // yalnız üretilen (sahibi = kullanıcı) rotalar

  const [editBusy, setEditBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);

  const refreshRoute = async () => {
    if (!route) return;
    try { setRoute(await fetchRoute(route.id)); } catch { /* sessiz */ }
  };

  const onRemoveStop = async (w: Waypoint) => {
    if (!route || editBusy) return;
    tap();
    setEditBusy(true);
    try {
      await removeStop(w.id);
      await refreshRoute(); // liste anında güncellenir
      refreshRouteExtras(route.id).then(refreshRoute); // geometri/süre arka planda tazelenir
    } catch { /* RLS reddi vb. — sessiz */ }
    finally { setEditBusy(false); }
  };

  const doSearch = async () => {
    if (!q.trim() || searching) return;
    setSearching(true);
    try { setPlaces(await searchPlaces(q.trim())); } catch { setPlaces([]); }
    finally { setSearching(false); }
  };

  const onAddStop = async (p: PlaceResult) => {
    if (!route || editBusy) return;
    tap();
    setAdding(false);
    setQ("");
    setPlaces([]);
    setEditBusy(true);
    try {
      const maxSeq = Math.max(-1, ...route.waypoints.map((w) => w.seq));
      await addStop(route.id, p, maxSeq + 1);
      await refreshRoute();
      refreshRouteExtras(route.id).then(refreshRoute);
    } catch { /* sessiz */ }
    finally { setEditBusy(false); }
  };

  const savePlan = async () => {
    if (!route || saved) return;
    pop();
    setSaved(true);
    try { await setFavorite(route.id, true); } catch { setSaved(false); }
  };
  const exp = useMemo(() => (route?.waypoints ?? []).filter((w) => w.kind === "experience"), [route]);
  const util = useMemo(() => (route?.waypoints ?? []).filter((w) => w.kind === "utility"), [route]);

  const polylines = useMemo<OSMPolyline[]>(() => {
    if (!exp.length) return [];
    const segs = legSegments(exp);
    return [{ id: "r", color: colors.primary, coords: segmentsToPath(segs), segments: segs }];
  }, [exp, colors]);
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
        {!!result.reason && <Text style={styles.reason}>{result.reason}</Text>}
        <TouchableOpacity style={styles.btn} onPress={onReset}><Text style={styles.btnText}>← Yeni plan</Text></TouchableOpacity>
      </View>
    );
  }

  // Üretilen rotada anlatı waypoint.note'ta yaşar (düzenlemede index kayar → ai.stops eşleşmez)
  const narrative = (i: number) =>
    result.generated
      ? exp[i]?.note ?? ""
      : ai.stops?.find((s) => s.seq === i)?.narrative ?? exp[i]?.note ?? "";

  return (
    <View style={styles.container}>
      <OSMMap
        polylines={polylines} markers={markers} padding={48}
        style={styles.map} overlayInsetBottom={SHEET_H - 60} showRecenter
      />
      {/* 4.0a: plan sonucu paneli de aşağı kaydırılıp kapanır — tam harita görünür */}
      <CollapsibleSheet style={styles.sheet} peekLabel="Plan detayı">
        <ScrollView contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.aiTag}>
              {result.generated
                ? "🎲 Az önce senin için ÜRETİLDİ — yepyeni rota"
                : result.personalized ? "🧠 Sana özel · hafızandan" : "✨ Sana özel"}
            </Text>
            <Text style={styles.title}>{ai.title ?? route.title}</Text>
            {!!ai.summary && <Text style={styles.summary}>{ai.summary}</Text>}
            {!!result.profile && (
              <Text style={styles.profileNote} numberOfLines={2}>
                Hafızadaki profilin: {result.profile.replace("Kullanıcı profili: ", "")}
              </Text>
            )}
            {!!result.steps?.length && (
              <View style={styles.stepsBox}>
                <Text style={styles.stepsTitle}>⚙️ AGENT ADIMLARI</Text>
                {/* Süreler bilinçli gizli (premium his) — s.ms API'de duruyor, gerekirse geri açılır */}
                {result.steps.map((s) => (
                  <Text key={s.name} style={styles.stepLine}>
                    ✓ {s.name}{s.note ? ` · ${s.note}` : ""}
                  </Text>
                ))}
              </View>
            )}
            <View style={styles.pills}>
              <Text style={styles.pill}>💰 {budgetLabel(route.budget_level)}</Text>
              <Text style={styles.pill}>📍 {exp.length} durak</Text>
              {result.weather?.temp != null && (
                <Text style={styles.pill}>🌤️ {result.weather.temp}° {result.weather.desc}</Text>
              )}
            </View>
            {!!ai.weather_note && <Text style={styles.note}>🌦️ {ai.weather_note}</Text>}
            {!!ai.budget_note && <Text style={styles.note}>💸 {ai.budget_note}</Text>}

            {/* ☔ Yağmur uyarısı + kapalı alternatif (2.5) */}
            {result.weather?.rainy && route.weather_fit !== "indoor" && !result.forced_fit && (
              <View style={styles.rainBand}>
                <Text style={styles.rainText}>
                  ☔ Bugün hava yağışlı{result.weather.desc ? ` (${result.weather.desc})` : ""} — bu rota açık hava ağırlıklı.
                </Text>
                <TouchableOpacity style={styles.rainBtn} onPress={onIndoor} activeOpacity={0.85}>
                  <Text style={styles.rainBtnText}>Kapalı mekân alternatifi öner</Text>
                </TouchableOpacity>
              </View>
            )}
            {!!result.forced_fit && (
              <Text style={styles.note}>☂️ Kapalı mekân tercihinle yeniden planlandı.</Text>
            )}
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
                  <View style={styles.stopHead}>
                    <Text style={[styles.stopName, { flex: 1 }]}>{waypointIcon(w)} {w.name}</Text>
                    {editable && exp.length > 2 && (
                      <TouchableOpacity onPress={() => onRemoveStop(w)} hitSlop={10} disabled={editBusy}>
                        <Text style={[styles.stopRemove, editBusy && { opacity: 0.4 }]}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {!!narrative(i) && <Text style={styles.stopNote}>{narrative(i)}</Text>}
                </View>
              </View>
            ))}
          </View>

          {/* 2.7b: üretilen rotaya durak ekle */}
          {editable && (
            <TouchableOpacity
              style={[styles.addStopBtn, editBusy && { opacity: 0.5 }]}
              onPress={() => { tap(); setAdding(true); }}
              disabled={editBusy}
              activeOpacity={0.85}
            >
              <Text style={styles.addStopText}>{editBusy ? "Güncelleniyor…" : "＋ Durak ekle"}</Text>
            </TouchableOpacity>
          )}

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

          {/* Plan aksiyonları: döngüyü kapat (planla → kaydet → yürü) */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.saveBtn, saved && styles.saveBtnDone]}
              onPress={savePlan}
              disabled={saved}
              activeOpacity={0.85}
            >
              <Text style={[styles.saveBtnText, saved && { color: colors.primaryDark }]}>
                {saved ? "✓ Kaydedildi" : "🤍 Kaydet"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.goBtn}
              onPress={() => { tap(); onOpenRoute(route.id, ai.title ?? route.title); }}
              activeOpacity={0.9}
            >
              <Text style={styles.goBtnText}>🧭 Yolculuğa Başla</Text>
            </TouchableOpacity>
          </View>

          {/* 🎲 Beğenmediysen: havuz yerine gerçek mekânlardan yepyeni rota (2.7) */}
          <TouchableOpacity style={styles.genBtn} onPress={() => { tap(); onGenerate(); }} activeOpacity={0.85}>
            <Text style={styles.genBtnText}>🎲 Bana yeni rota üret</Text>
            <Text style={styles.genBtnSub}>Kayıtlılardan değil — gerçek mekânlardan sıfırdan kurar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.btn, styles.resetBtn]} onPress={onReset}>
            <Text style={styles.btnText}>← Yeni plan</Text>
          </TouchableOpacity>
        </ScrollView>
      </CollapsibleSheet>

      {/* 2.7b: durak ekleme — mekan arama (SerpApi, CreateRoute ile aynı kaynak) */}
      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <View style={styles.addBg}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setAdding(false)} />
          <View style={styles.addSheet}>
            <View style={styles.addHandle} />
            <Text style={styles.addTitle}>Durak ekle</Text>
            <View style={styles.addRow}>
              <TextInput
                style={styles.addInput}
                value={q}
                onChangeText={setQ}
                placeholder="Mekan ara (örn. Moda Sahili)"
                placeholderTextColor={colors.textFaint}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={doSearch}
              />
              <TouchableOpacity style={styles.addSearchBtn} onPress={doSearch} disabled={searching}>
                {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addSearchText}>Ara</Text>}
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }} keyboardShouldPersistTaps="handled">
              {places.map((p) => (
                <TouchableOpacity key={`${p.place_id ?? p.name}-${p.lat}`} style={styles.addResult} onPress={() => onAddStop(p)}>
                  <Text style={styles.addResultName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.addResultMeta} numberOfLines={1}>
                    {[p.type, p.address, p.rating ? `★${p.rating}` : null].filter(Boolean).join(" · ")}
                  </Text>
                </TouchableOpacity>
              ))}
              {places.length === 0 && !searching && (
                <Text style={styles.addEmpty}>Arama yap — sonuçtan seçtiğin durak rotanın sonuna eklenir.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const NODE = 30;
const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
  error: { color: colors.danger, fontFamily: font.medium },
  reason: { color: colors.textFaint, fontFamily: font.regular, fontSize: 13, textAlign: "center" },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 16,
    alignItems: "center", justifyContent: "center", ...shadow(6),
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontFamily: font.extra, fontSize: 16 },

  // Agent bekleme göstergesi (2.6)
  agentBox: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 10,
    borderWidth: 1, borderColor: colors.border, marginTop: 4,
  },
  agentRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  agentDone: { width: 18, textAlign: "center", color: "#4ADE80", fontFamily: font.extra, fontSize: 14 },
  agentPending: { width: 18, textAlign: "center", color: colors.textFaint, fontSize: 13 },
  agentLabel: { color: colors.text, fontFamily: font.semibold, fontSize: 14 },
  agentLabelDone: { color: colors.textMuted },
  agentLabelPending: { color: colors.textFaint },

  // Sonuçtaki gerçek adım dökümü (2.6)
  stepsBox: {
    marginTop: 12, backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    padding: 12, gap: 5, borderWidth: 1, borderColor: colors.border,
  },
  stepsTitle: { color: colors.textFaint, fontFamily: font.bold, fontSize: 10.5, letterSpacing: 1.2, marginBottom: 2 },
  stepLine: { color: colors.textMuted, fontFamily: font.medium, fontSize: 12 },

  map: { ...StyleSheet.absoluteFillObject }, // 4.0a: tam ekran harita
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: SHEET_H,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    overflow: "hidden", ...shadow(12),
  },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border, alignSelf: "center", marginTop: 9, marginBottom: 2 },
  hero: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  aiTag: { alignSelf: "flex-start", color: colors.primaryDark, fontFamily: font.bold, fontSize: 12, backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, overflow: "hidden", marginBottom: 8 },
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
  card: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 14, marginBottom: 14, marginLeft: 6, borderWidth: 1, borderColor: colors.border },
  legPill: { alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  legText: { fontSize: 12, color: colors.primaryDark, fontFamily: font.bold },
  stopName: { fontSize: 16, fontFamily: font.extra, color: colors.text },
  stopNote: { marginTop: 7, color: colors.textMuted, lineHeight: 20, fontSize: 14, fontFamily: font.regular },

  nearby: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  nearbyTitle: { fontSize: 13, color: colors.textFaint, fontFamily: font.bold, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  amenity: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  amenityName: { flex: 1, fontSize: 14, color: colors.text, fontFamily: font.bold },
  amenityBadge: { fontSize: 11, color: colors.primaryDark, fontFamily: font.bold, backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden" },

  social: { marginHorizontal: 20, marginTop: 8, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.border },
  socialText: { color: colors.accent, fontFamily: font.semibold, fontSize: 13.5, lineHeight: 19 },

  profileNote: { marginTop: 8, color: colors.textFaint, fontFamily: font.medium, fontSize: 12.5, fontStyle: "italic" },
  rainBand: {
    marginTop: 12, backgroundColor: "rgba(59,130,246,0.12)", borderRadius: radius.md,
    padding: 12, borderWidth: 1, borderColor: "rgba(59,130,246,0.35)", gap: 10,
  },
  rainText: { color: colors.text, fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  rainBtn: { alignSelf: "flex-start", backgroundColor: "#3B82F6", borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  rainBtnText: { color: "#fff", fontFamily: font.bold, fontSize: 13 },
  actionRow: { flexDirection: "row", gap: 10, marginHorizontal: 20, marginTop: 16 },
  saveBtn: {
    flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  saveBtnDone: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  saveBtnText: { color: colors.text, fontFamily: font.bold, fontSize: 14.5 },
  goBtn: {
    flex: 1.4, paddingVertical: 14, alignItems: "center", borderRadius: radius.lg,
    backgroundColor: colors.primary, ...shadow(6),
  },
  goBtnText: { color: "#fff", fontFamily: font.extra, fontSize: 14.5 },

  resetBtn: { marginHorizontal: 20, marginTop: 12 },

  // 🎲 AI Rota Üretici (2.7 + 2.7b)
  genHint: { marginTop: 10, color: colors.textMuted, fontFamily: font.medium, fontSize: 12.5, textAlign: "center" },
  modeRow: { flexDirection: "row", gap: 8 },
  modeChip: {
    flex: 1, paddingVertical: 11, alignItems: "center", borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  modeChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeText: { fontSize: 13.5, fontFamily: font.bold, color: colors.textMuted },
  modeTextOn: { color: "#fff" },
  locLabel: { fontSize: 13, fontFamily: font.bold, color: colors.textMuted },
  // Konum çipleri: nötr zemin, SEÇİLİ = dolgulu mercan + beyaz (öneri çiplerinden farklı —
  // onlar primarySoft olduğu için seçim durumu orada görünmüyordu)
  locChip: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border,
  },
  locChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  locChipText: { fontSize: 13, color: colors.textMuted, fontFamily: font.semibold },
  locChipTextOn: { color: "#fff", fontFamily: font.bold },
  stopHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  stopRemove: { color: colors.danger, fontFamily: font.black, fontSize: 15, paddingHorizontal: 4 },
  addStopBtn: {
    marginHorizontal: 20, marginTop: 4, paddingVertical: 12, alignItems: "center",
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed",
  },
  addStopText: { color: colors.primaryDark, fontFamily: font.bold, fontSize: 14 },
  addBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  addSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24,
  },
  addHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 10 },
  addTitle: { fontSize: 17, fontFamily: font.extra, color: colors.text, marginBottom: 10 },
  addRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  addInput: {
    flex: 1, height: 44, backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    paddingHorizontal: 12, color: colors.text, fontFamily: font.regular, fontSize: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  addSearchBtn: {
    paddingHorizontal: 18, height: 44, borderRadius: radius.md, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  addSearchText: { color: "#fff", fontFamily: font.bold, fontSize: 14 },
  addResult: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  addResultName: { color: colors.text, fontFamily: font.bold, fontSize: 14.5 },
  addResultMeta: { color: colors.textFaint, fontFamily: font.medium, fontSize: 12, marginTop: 2 },
  addEmpty: { color: colors.textFaint, fontFamily: font.medium, fontSize: 12.5, paddingVertical: 14, textAlign: "center" },
  genBtn: {
    marginHorizontal: 20, marginTop: 14, paddingVertical: 13, alignItems: "center",
    borderRadius: radius.lg, backgroundColor: colors.primarySoft,
    borderWidth: 1, borderColor: colors.primary,
  },
  genBtnText: { color: colors.primaryDark, fontFamily: font.extra, fontSize: 15 },
  genBtnSub: { color: colors.textMuted, fontFamily: font.medium, fontSize: 11.5, marginTop: 3 },
});
