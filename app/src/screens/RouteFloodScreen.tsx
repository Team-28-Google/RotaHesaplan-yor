import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Animated, Linking, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";

import OSMMap, { type OSMMarker, type OSMPolyline } from "../components/OSMMap";
import Skeleton from "../components/Skeleton";
import { pop, success, tap } from "../lib/haptics";
import {
  addComment, fetchComments, fetchCommentSummary, fetchRoute, fetchWalkRoute,
  getFavoriteIds, sendMemoryEvent, setFavorite,
  type CommentSummary, type FloodComment, type WalkLeg,
} from "../lib/api";
import { addJourney } from "../lib/journeyLog";
import { useUserLocation } from "../lib/useUserLocation";
import { font, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";
import type { RouteWithWaypoints } from "../lib/types";
import { budgetLabel, legSegments, segmentsToPath, transportIcon, transportLabel, waypointIcon } from "../lib/ui";
import type { RouteFloodScreenProps } from "../navigation";

// Telefonun harita uygulamasında yürüyüş yol tarifini açar (Google key gerekmez)
function openDirections(lat: number, lng: number) {
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`).catch(() => {});
}
function distMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function distText(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
function getRating(meta: unknown): number | undefined {
  const r = (meta as { rating?: unknown } | null)?.rating;
  return typeof r === "number" ? r : undefined;
}
function timeAgo(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} dk önce`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.round(h / 24)} gün önce`;
}

interface JourneySummary {
  title: string;
  stops: number;
  distM: number;
  durationMin: number;
  date: Date;
}

export default function RouteFloodScreen({ route: navRoute, navigation }: RouteFloodScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const userLoc = useUserLocation();
  const { routeId } = navRoute.params;
  const [route, setRoute] = useState<RouteWithWaypoints | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fav, setFav] = useState(false);
  const [journey, setJourney] = useState(false);
  const [target, setTarget] = useState(0);
  const [arrived, setArrived] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const journeyStart = useRef<number | null>(null);

  // Yorumlar
  const [comments, setComments] = useState<FloodComment[]>([]);
  const [cBody, setCBody] = useState("");
  const [cRating, setCRating] = useState<number | null>(null);
  const [cSending, setCSending] = useState(false);
  const [cError, setCError] = useState<string | null>(null);
  const [communitySummary, setCommunitySummary] = useState<CommentSummary | null>(null);

  // Yolculuk özeti + paylaşım kartı (3.1: iki format — Kart 4:5 / Story 9:16)
  const [summary, setSummary] = useState<JourneySummary | null>(null);
  const [cardFormat, setCardFormat] = useState<"card" | "story">("card");
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<View>(null);

  // Mikro-animasyonlar
  const heartScale = useRef(new Animated.Value(1)).current;
  const jBarY = useRef(new Animated.Value(90)).current;      // journey bar alttan kayar

  useEffect(() => {
    if (!journey) return;
    jBarY.setValue(90);
    Animated.spring(jBarY, { toValue: 0, speed: 16, bounciness: 7, useNativeDriver: true }).start();
  }, [journey, jBarY]);

  const clearAdvance = () => {
    if (advanceTimer.current) { clearTimeout(advanceTimer.current); advanceTimer.current = null; }
  };

  useEffect(() => {
    fetchRoute(routeId)
      .then(setRoute)
      .catch((e) => setError(e.message ?? "Rota yüklenemedi"));
    getFavoriteIds().then((s) => setFav(s.has(routeId))).catch(() => {});
    fetchComments(routeId).then(setComments).catch(() => {});
  }, [routeId]);

  const sendComment = async () => {
    const body = cBody.trim();
    if (!body || cSending) return;
    setCSending(true);
    setCError(null);
    try {
      await addComment(routeId, body, cRating);
      setCBody("");
      setCRating(null);
      setComments(await fetchComments(routeId));
      sendMemoryEvent("comment", routeId); // davranış hafızası (2.2)
    } catch (e) {
      setCError(e instanceof Error ? e.message : "Yorum gönderilemedi");
    } finally {
      setCSending(false);
    }
  };

  // Topluluk özeti (2.4): ≥3 yorum varsa AI'dan iki cümlelik özet çek
  useEffect(() => {
    if (comments.length < 3 || communitySummary) return;
    fetchCommentSummary(routeId).then((s) => { if (s?.ok) setCommunitySummary(s); });
  }, [comments.length, communitySummary, routeId]);

  const toggleFav = async () => {
    const next = !fav;
    setFav(next);
    pop();
    // Kalp "pop" animasyonu
    heartScale.setValue(1);
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.45, speed: 40, bounciness: 0, useNativeDriver: true }),
      Animated.spring(heartScale, { toValue: 1, speed: 24, bounciness: 12, useNativeDriver: true }),
    ]).start();
    try {
      await setFavorite(routeId, next);
      if (next) sendMemoryEvent("favorite", routeId); // davranış hafızası (2.2)
    } catch {
      setFav(!next); // geri al
    }
  };

  const exp = useMemo(() => route?.waypoints.filter((w) => w.kind === "experience") ?? [], [route]);
  const util = useMemo(() => route?.waypoints.filter((w) => w.kind === "utility") ?? [], [route]);
  const polylines = useMemo<OSMPolyline[]>(() => {
    if (!exp.length) return [];
    const segs = legSegments(exp); // gerçek sokak geometrisi varsa onu kullanır
    return [{ id: "route", color: colors.primary, coords: segmentsToPath(segs), segments: segs }];
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
    [exp, util, colors],
  );

  // Yolculuk: hedefe ~30m yaklaşınca "Vardın" göster, kısa bir duraklamadan sonra
  // otomatik olarak sıradaki durağa geç (anında atlarsa kullanıcı varışı hiç göremiyor).
  const ARRIVE_M = 30;
  useEffect(() => {
    if (!journey || !userLoc) return;
    const t = exp[target];
    if (!t) return;
    if (distMeters(userLoc, t) >= ARRIVE_M) {
      if (arrived && !advanceTimer.current) setArrived(false); // hedeften uzaklaşıldı
      return;
    }
    if (!arrived) success(); // varış anı — dokunsal kutlama
    setArrived(true);
    if (target < exp.length - 1 && !advanceTimer.current) {
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null;
        setArrived(false);
        setTarget((x) => x + 1);
      }, 3500);
    }
  }, [userLoc, journey, target, exp, arrived]);

  // Ekrandan çıkarken bekleyen zamanlayıcıyı temizle
  useEffect(() => clearAdvance, []);

  const startJourney = () => {
    tap();
    clearAdvance();
    journeyStart.current = Date.now();
    setJourney(true);
    setTarget(0);
    setArrived(false);
  };

  // Plan ekranından "Yolculuğa Başla" ile gelindiyse yolculuğu otomatik başlat (2.3 polish)
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!route || !navRoute.params.autoStart || autoStarted.current || !exp.length) return;
    autoStarted.current = true;
    startJourney();
  }, [route, exp]); // eslint-disable-line react-hooks/exhaustive-deps

  // CANLI NAVİGASYON (GMaps hissi): konum → sıradaki durak GERÇEK yürüme rotası.
  // Hedef değişince ya da hesaplanan noktadan ~40m uzaklaşınca yeniden çekilir.
  const [liveLeg, setLiveLeg] = useState<WalkLeg | null>(null);
  const legOrigin = useRef<{ lat: number; lng: number } | null>(null);
  const legBusy = useRef(false);

  useEffect(() => { setLiveLeg(null); legOrigin.current = null; }, [target, journey]);

  useEffect(() => {
    const t = exp[target];
    if (!journey || !userLoc || !t) return;
    const stale = !legOrigin.current || distMeters(userLoc, legOrigin.current) > 40;
    if (!stale || legBusy.current) return;
    legBusy.current = true;
    const origin = { lat: userLoc.lat, lng: userLoc.lng };
    fetchWalkRoute(origin, { lat: t.lat, lng: t.lng })
      .then((leg) => {
        if (leg) { setLiveLeg(leg); legOrigin.current = origin; }
        else { legOrigin.current = origin; } // servis yok → düz çizgi yedeği; sürekli deneme yapma
      })
      .finally(() => { legBusy.current = false; });
  }, [journey, userLoc, target, exp]);

  // Yolculuğu kapat → özet + paylaşım kartı göster, yerel günlüğe yaz (Profil istatistikleri)
  const finishJourney = () => {
    clearAdvance();
    setJourney(false);
    setArrived(false);
    setTarget(0);
    if (!route) return;
    const durationMin = journeyStart.current
      ? Math.max(1, Math.round((Date.now() - journeyStart.current) / 60000))
      : route.total_duration_min ?? 0;
    journeyStart.current = null;
    const s: JourneySummary = {
      title: route.title,
      stops: exp.length,
      distM: route.total_distance_m ?? 0,
      durationMin,
      date: new Date(),
    };
    setSummary(s);
    addJourney({
      routeId: route.id, title: route.title, city: route.city,
      distance_m: s.distM, duration_min: s.durationMin, stops: s.stops,
      date: s.date.toISOString(),
    });
    sendMemoryEvent("journey", route.id); // davranış hafızası (2.2)
  };

  const shareCard = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(shareCardRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri.startsWith("file://") ? uri : `file://${uri}`, {
          mimeType: "image/png",
          dialogTitle: "Rotanı paylaş",
        });
        success();
      }
    } catch { /* kullanıcı iptal etti / paylaşım yok — yoksay */ }
    finally { setSharing(false); }
  };

  if (error) return <View style={styles.center}><Text style={styles.error}>⚠️ {error}</Text></View>;
  if (!route) {
    return (
      <View style={styles.container}>
        <Skeleton style={{ height: 230, borderRadius: 0 }} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={{ padding: 20, gap: 14 }}>
            <Skeleton style={{ height: 26, width: "68%" }} />
            <Skeleton style={{ height: 15, width: "94%" }} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Skeleton style={{ height: 30, width: 74, borderRadius: 999 }} />
              <Skeleton style={{ height: 30, width: 90, borderRadius: 999 }} />
              <Skeleton style={{ height: 30, width: 70, borderRadius: 999 }} />
            </View>
            <Skeleton style={{ height: 50, borderRadius: 18, marginTop: 8 }} />
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                <Skeleton style={{ width: 30, height: 30, borderRadius: 15 }} />
                <Skeleton style={{ flex: 1, height: 76, borderRadius: 14 }} />
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  const km = route.total_distance_m ? (route.total_distance_m / 1000).toFixed(1) : "—";
  const last = exp.length - 1;

  const targetStop = exp[target];
  // Gerçek sokak rotası varsa onu, yoksa düz kesikli yedeği çiz
  const guideLine = journey && userLoc && targetStop
    ? (liveLeg?.coords ?? [{ lat: userLoc.lat, lng: userLoc.lng }, { lat: targetStop.lat, lng: targetStop.lng }])
    : null;

  return (
    <View style={styles.container}>
      <OSMMap
        polylines={polylines}
        markers={markers}
        padding={48}
        style={[styles.map, journey && styles.mapJourney]}
        userLocation={userLoc}
        followLocation={journey ? userLoc : null}
        followHeading={journey ? userLoc?.heading ?? null : null}
        guideLine={guideLine}
        showRecenter
      />
      <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => navigation.goBack()} hitSlop={12}>
        <Text style={styles.backIcon}>‹</Text>
      </TouchableOpacity>

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { flex: 1 }]}>{route.title}</Text>
              <TouchableOpacity onPress={toggleFav} hitSlop={12} style={styles.heart}>
                <Animated.Text style={[styles.heartText, { transform: [{ scale: heartScale }] }]}>
                  {fav ? "❤️" : "🤍"}
                </Animated.Text>
              </TouchableOpacity>
            </View>
            {!!route.description && <Text style={styles.desc}>{route.description}</Text>}
            <View style={styles.pills}>
              <Pill icon="💰" text={budgetLabel(route.budget_level)} />
              <Pill icon="📍" text={`${exp.length} durak`} />
              <Pill icon="📏" text={`${km} km`} />
              {!!route.total_duration_min && <Pill icon="⏱️" text={`~${route.total_duration_min} dk`} />}
            </View>
            <View style={styles.tagRow}>
              {(route.vibe_tags ?? []).map((t) => (
                <Text key={t} style={styles.tag}>#{t}</Text>
              ))}
            </View>

            {/* ✨ Topluluk ne diyor — AI yorum özeti (2.4) */}
            {communitySummary?.ok && (
              <View style={styles.community}>
                <Text style={styles.communityTitle}>✨ TOPLULUK NE DİYOR · {communitySummary.count} yorum</Text>
                <Text style={styles.communityText}>{communitySummary.summary}</Text>
                {!!communitySummary.tags?.length && (
                  <View style={styles.communityTags}>
                    {communitySummary.tags.map((t) => (
                      <Text key={t} style={styles.communityTag}>{t}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {journey ? (
              <TouchableOpacity style={[styles.startBtn, styles.stopBtn]} onPress={finishJourney} activeOpacity={0.9}>
                <Text style={styles.startBtnText}>⏹ Yolculuğu Bitir</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.startBtn} onPress={startJourney} activeOpacity={0.9}>
                <Text style={styles.startBtnText}>🧭 Yolculuğa Başla</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Zaman çizelgesi (gezilecek duraklar) */}
          <View style={styles.timeline}>
            {exp.map((w, i) => (
              <View key={w.id} style={styles.row}>
                <View style={styles.rail}>
                  <View style={[styles.line, { backgroundColor: i === 0 ? "transparent" : colors.border }]} />
                  <View style={[styles.node, { backgroundColor: colors.primary }]}>
                    <Text style={styles.nodeText}>{i + 1}</Text>
                  </View>
                  <View style={[styles.line, { backgroundColor: i === last ? "transparent" : colors.border }]} />
                </View>
                <View style={styles.card}>
                  {w.transport_mode !== "start" && (
                    <View style={styles.legPill}>
                      <Text style={styles.legText}>
                        {transportIcon(w.transport_mode)} {transportLabel(w.transport_mode)}
                        {w.leg_duration_min ? ` · ~${w.leg_duration_min} dk` : ""}
                        {w.transport_note ? ` · ${w.transport_note}` : ""}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.stopName}>{waypointIcon(w)} {w.name}</Text>
                  {!!w.note && <Text style={styles.note}>{w.note}</Text>}
                  <View style={styles.stopFoot}>
                    {getRating(w.metadata) !== undefined && <Text style={styles.rating}>⭐ {getRating(w.metadata)}</Text>}
                    <TouchableOpacity onPress={() => openDirections(w.lat, w.lng)} hitSlop={6}>
                      <Text style={styles.dirText}>🧭 Yol tarifi</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Yakındaki pratik noktalar (rota dışı) */}
          {util.length > 0 && (
            <View style={styles.nearby}>
              <Text style={styles.nearbyTitle}>Yakında pratik noktalar</Text>
              {util.map((w) => (
                <View key={w.id} style={styles.amenity}>
                  <Text style={styles.amenityIcon}>{waypointIcon(w)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.amenityName}>{w.name}</Text>
                    {!!w.note && <Text style={styles.amenityNote}>{w.note}</Text>}
                  </View>
                  <Text style={styles.amenityBadge}>ücretsiz</Text>
                </View>
              ))}
            </View>
          )}

          {/* Yorumlar (flood) */}
          <View style={styles.commentsWrap}>
            <Text style={styles.nearbyTitle}>Yorumlar ({comments.length})</Text>

            <View style={styles.commentForm}>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => setCRating(cRating === s ? null : s)} hitSlop={6}>
                    <Text style={[styles.star, cRating != null && s <= cRating && styles.starOn]}>★</Text>
                  </TouchableOpacity>
                ))}
                <Text style={styles.starHint}>{cRating ? `${cRating}/5` : "puan (opsiyonel)"}</Text>
              </View>
              <View style={styles.commentRow}>
                <TextInput
                  style={styles.commentInput}
                  value={cBody}
                  onChangeText={setCBody}
                  placeholder="Bu rota hakkında ne düşünüyorsun?"
                  placeholderTextColor={colors.textFaint}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.commentSend, (!cBody.trim() || cSending) && { opacity: 0.45 }]}
                  onPress={sendComment}
                  disabled={!cBody.trim() || cSending}
                >
                  {cSending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.commentSendText}>Gönder</Text>}
                </TouchableOpacity>
              </View>
              {!!cError && <Text style={styles.cError}>⚠️ {cError}</Text>}
            </View>

            {comments.map((c) => (
              <View key={c.id} style={styles.comment}>
                <View style={styles.commentHead}>
                  <Text style={styles.commentUser}>@{c.username}</Text>
                  {!!c.rating && <Text style={styles.commentRating}>{"★".repeat(c.rating)}</Text>}
                  <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                </View>
                {!!c.body && <Text style={styles.commentBody}>{c.body}</Text>}
              </View>
            ))}
            {comments.length === 0 && (
              <Text style={styles.commentEmpty}>İlk yorumu sen yaz — deneyimin başkasının rotası olur.</Text>
            )}
          </View>
        </ScrollView>
      </View>

      {journey && (
        <Animated.View style={[styles.journeyBar, { paddingBottom: insets.bottom + 10, transform: [{ translateY: jBarY }] }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.jLabel}>Durak {target + 1}/{exp.length}</Text>
            <Text style={styles.jStop} numberOfLines={1}>{targetStop?.name}</Text>
            {userLoc && targetStop ? (
              arrived ? (
                target < last ? (
                  <Text style={styles.jArrived}>✓ Vardın — sıradaki durağa geçiliyor…</Text>
                ) : (
                  <Text style={styles.jArrived}>🎉 Rota tamamlandı — keyfini çıkar</Text>
                )
              ) : liveLeg ? (
                <Text style={styles.jDist}>🚶 {distText(liveLeg.distance_m)} · ~{liveLeg.duration_min} dk · rotayı izle</Text>
              ) : (
                <Text style={styles.jDist}>📍 {distText(distMeters(userLoc, targetStop))} ileride · seni takip ediyorum</Text>
              )
            ) : (
              <Text style={styles.jLabel}>📍 Konum bekleniyor…</Text>
            )}
          </View>
          {target < last ? (
            <TouchableOpacity style={styles.jNext} onPress={() => { clearAdvance(); setArrived(false); setTarget(target + 1); }}>
              <Text style={styles.jNextText}>Sonraki ›</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.jNext} onPress={finishJourney}>
              <Text style={styles.jNextText}>Bitir</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Yolculuk özeti — bottom sheet + iki paylaşım formatı (3.1) */}
      <Modal visible={!!summary} transparent animationType="slide" onRequestClose={() => setSummary(null)}>
        <View style={styles.sumBg}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSummary(null)} />
          {summary && (
            <View style={styles.sumSheet}>
              <View style={styles.sumHandle} />
              <Text style={styles.sumTitle}>🎉 Rota tamamlandı</Text>

              {/* Format seçimi */}
              <View style={styles.fmtRow}>
                {([["card", "Kart · 4:5"], ["story", "Story · 9:16"]] as const).map(([f, label]) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.fmtChip, cardFormat === f && styles.fmtChipOn]}
                    onPress={() => { tap(); setCardFormat(f); }}
                  >
                    <Text style={[styles.fmtChipText, cardFormat === f && styles.fmtChipTextOn]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Önizleme — kart gerçek boyutta yerleşir, scale ile sığdırılır
                  (view-shot layout boyutunu yakalar; transform çıktıyı etkilemez) */}
              <View style={styles.previewBox}>
                {cardFormat === "card" ? (
                  <View style={{ transform: [{ scale: 0.72 }] }}>
                    <View ref={shareCardRef} collapsable={false} style={styles.shareCard}>
                      <LinearGradient colors={["#141B33", "#0B1022"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.shareInner}>
                        <View style={styles.shareBrandRow}>
                          <View style={styles.shareBrandDot} />
                          <Text style={styles.shareBrand}>SANA</Text>
                        </View>
                        <Text style={styles.shareDone}>ROTA TAMAMLANDI</Text>
                        <Text style={styles.shareTitle}>{summary.title}</Text>
                        <Text style={styles.shareDate}>
                          {summary.date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} · {route.city}
                        </Text>
                        <ShareStats stops={summary.stops} distM={summary.distM} durationMin={summary.durationMin} />
                        <View style={styles.shareStops}>
                          {exp.slice(0, 5).map((w, i) => (
                            <Text key={w.id} style={styles.shareStop} numberOfLines={1}>
                              {i + 1}. {waypointIcon(w)} {w.name}
                            </Text>
                          ))}
                          {exp.length > 5 && <Text style={styles.shareStop}>+{exp.length - 5} durak daha…</Text>}
                        </View>
                        <Text style={styles.shareFooter}>sana ile keşfedildi 🧭</Text>
                      </LinearGradient>
                    </View>
                  </View>
                ) : (
                  <View style={{ transform: [{ scale: 0.5 }] }}>
                    <View ref={shareCardRef} collapsable={false} style={styles.storyCard}>
                      <LinearGradient colors={["#1B2447", "#0B1022"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.storyInner}>
                        <View style={styles.shareBrandRow}>
                          <View style={styles.shareBrandDot} />
                          <Text style={styles.shareBrand}>SANA</Text>
                        </View>
                        <Text style={styles.shareDone}>ROTA TAMAMLANDI</Text>
                        <Text style={styles.storyTitle}>{summary.title}</Text>
                        <Text style={styles.shareDate}>
                          {summary.date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })} · {route.city}
                        </Text>
                        <RouteTrace stops={exp} />
                        <ShareStats stops={summary.stops} distM={summary.distM} durationMin={summary.durationMin} />
                        <View style={styles.shareStops}>
                          {exp.slice(0, 6).map((w, i) => (
                            <Text key={w.id} style={styles.storyStop} numberOfLines={1}>
                              {i + 1}. {waypointIcon(w)} {w.name}
                            </Text>
                          ))}
                          {exp.length > 6 && <Text style={styles.storyStop}>+{exp.length - 6} durak daha…</Text>}
                        </View>
                        <Text style={styles.shareFooter}>sana ile keşfedildi 🧭</Text>
                      </LinearGradient>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.sumBtns}>
                <TouchableOpacity style={styles.sumGhost} onPress={() => setSummary(null)}>
                  <Text style={styles.sumGhostText}>Kapat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sumShare, sharing && { opacity: 0.6 }]} onPress={shareCard} disabled={sharing}>
                  {sharing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.sumShareText}>📤 Paylaş</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

/** Paylaşım kartı istatistik satırı (durak · km · dk) — kart içi, tema-bağımsız koyu. */
function ShareStats({ stops, distM, durationMin }: { stops: number; distM: number; durationMin: number }) {
  const box = {
    flexDirection: "row" as const, alignItems: "center" as const, marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: radius.lg, paddingVertical: 14,
  };
  const cell = { flex: 1, alignItems: "center" as const };
  const val = { color: "#F2F4FC", fontFamily: font.black, fontSize: 22 };
  const lbl = { color: "#8A93B8", fontFamily: font.semibold, fontSize: 11.5, marginTop: 2 };
  const div = { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.12)" };
  return (
    <View style={box}>
      <View style={cell}><Text style={val}>{stops}</Text><Text style={lbl}>durak</Text></View>
      <View style={div} />
      <View style={cell}><Text style={val}>{(distM / 1000).toFixed(1)}</Text><Text style={lbl}>km</Text></View>
      <View style={div} />
      <View style={cell}><Text style={val}>{durationMin}</Text><Text style={lbl}>dk</Text></View>
    </View>
  );
}

/** Story kartındaki stilize rota izi: duraklar nokta, aralar düz çizgi (SVG'siz —
    çizgiler orta noktasından döndürülmüş ince View'lar; view-shot ile sorunsuz). */
function RouteTrace({ stops }: { stops: { lat: number; lng: number }[] }) {
  const W = 304, H = 150, PAD = 14, DOT = 10;
  if (stops.length < 2) return null;
  const lats = stops.map((s) => s.lat), lngs = stops.map((s) => s.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const spanLat = Math.max(maxLat - minLat, 1e-6), spanLng = Math.max(maxLng - minLng, 1e-6);
  const pts = stops.map((s) => ({
    x: PAD + ((s.lng - minLng) / spanLng) * (W - PAD * 2),
    y: PAD + ((maxLat - s.lat) / spanLat) * (H - PAD * 2), // kuzey yukarı
  }));
  return (
    <View style={{
      width: W, height: H, marginTop: 18, borderRadius: radius.lg,
      backgroundColor: "rgba(255,255,255,0.05)", overflow: "hidden",
    }}>
      {pts.slice(1).map((p, i) => {
        const a = pts[i];
        const len = Math.hypot(p.x - a.x, p.y - a.y);
        const deg = (Math.atan2(p.y - a.y, p.x - a.x) * 180) / Math.PI;
        return (
          <View
            key={`l${i}`}
            style={{
              position: "absolute", width: len, height: 3, borderRadius: 2,
              backgroundColor: "rgba(244,80,59,0.85)",
              left: (a.x + p.x) / 2 - len / 2, top: (a.y + p.y) / 2 - 1.5,
              transform: [{ rotate: `${deg}deg` }],
            }}
          />
        );
      })}
      {pts.map((p, i) => (
        <View
          key={`d${i}`}
          style={{
            position: "absolute", width: DOT, height: DOT, borderRadius: DOT / 2,
            left: p.x - DOT / 2, top: p.y - DOT / 2,
            backgroundColor: i === 0 ? "#34D399" : i === pts.length - 1 ? "#F4503B" : "#F2F4FC",
            borderWidth: 1.5, borderColor: "#0B1022",
          }}
        />
      ))}
    </View>
  );
}

function Pill({ icon, text }: { icon: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill }}>
      <Text style={{ fontSize: 13, color: colors.text, fontFamily: font.bold }}>{icon} {text}</Text>
    </View>
  );
}

const NODE = 30;
const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  error: { color: colors.danger, paddingHorizontal: 24, textAlign: "center", fontFamily: font.medium },
  map: { height: 230, width: "100%" },
  mapJourney: { height: 380 }, // yolculukta harita büyür: takip + rehber çizgi net görünsün
  backBtn: {
    position: "absolute", left: 14, width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", ...shadow(8),
  },
  backIcon: { fontSize: 26, color: colors.text, marginTop: -3, fontFamily: font.bold },

  sheet: {
    flex: 1, marginTop: -24, backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, overflow: "hidden",
  },
  handle: {
    width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border,
    alignSelf: "center", marginTop: 9, marginBottom: 2,
  },

  hero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heart: { padding: 4 },
  heartText: { fontSize: 26 },
  title: { fontSize: 24, fontFamily: font.black, color: colors.text },
  desc: { marginTop: 8, color: colors.textMuted, lineHeight: 21, fontSize: 14.5, fontFamily: font.regular },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  pill: { backgroundColor: colors.surfaceAlt, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill },
  pillText: { fontSize: 13, color: colors.text, fontFamily: font.bold },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  tag: {
    color: colors.primaryDark, fontSize: 12.5, fontFamily: font.bold,
    backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill, overflow: "hidden",
  },

  timeline: { paddingHorizontal: 16, paddingTop: 8 },
  row: { flexDirection: "row" },
  rail: { width: 40, alignItems: "center" },
  line: { width: 2, flex: 1 },
  node: {
    width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: "center",
    justifyContent: "center", borderWidth: 3, borderColor: colors.surface, ...shadow(3),
  },
  nodeText: { color: "#fff", fontFamily: font.extra, fontSize: 13 },

  card: {
    flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 14,
    marginBottom: 14, marginLeft: 6, borderWidth: 1, borderColor: colors.border,
  },
  legPill: {
    alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: radius.pill,
    paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8,
  },
  legText: { fontSize: 12, color: colors.primaryDark, fontFamily: font.bold },
  stopName: { fontSize: 16, fontFamily: font.extra, color: colors.text },
  note: { marginTop: 7, color: colors.textMuted, lineHeight: 20, fontSize: 14, fontFamily: font.regular },

  nearby: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  nearbyTitle: { fontSize: 13, color: colors.textFaint, fontFamily: font.bold, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 },
  amenity: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md, padding: 12, marginBottom: 8,
  },
  amenityIcon: { fontSize: 20 },
  amenityName: { fontSize: 14, color: colors.text, fontFamily: font.bold },
  amenityNote: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, fontFamily: font.regular },
  amenityBadge: {
    fontSize: 11, color: colors.primaryDark, fontFamily: font.bold, backgroundColor: colors.primarySoft,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden",
  },

  startBtn: { marginTop: 16, backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center", ...shadow(6) },
  stopBtn: { backgroundColor: "#2A3354" },
  startBtnText: { color: "#fff", fontFamily: font.extra, fontSize: 16 },
  stopFoot: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 },
  rating: { fontSize: 12.5, color: "#FBBF24", fontFamily: font.bold },
  dirText: { fontSize: 12.5, color: colors.primaryDark, fontFamily: font.bold },
  // Journey bar her iki temada da koyu kalır (harita üstü kontrast) → metinleri sabit açık
  journeyBar: {
    position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#10162C", paddingHorizontal: 16, paddingTop: 12,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    borderTopWidth: 1, borderTopColor: "#263052",
  },
  jLabel: { color: "#8A93B8", fontFamily: font.semibold, fontSize: 12 },
  jStop: { color: "#F2F4FC", fontFamily: font.extra, fontSize: 16, marginTop: 1 },
  jDist: { color: "#FFB4A5", fontFamily: font.semibold, fontSize: 12.5, marginTop: 2 },
  jArrived: { color: "#4ADE80", fontFamily: font.extra, fontSize: 12.5, marginTop: 2 },
  jNext: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 10 },
  jNextText: { color: "#fff", fontFamily: font.extra, fontSize: 13 },

  // ✨ Topluluk özeti (2.4)
  community: {
    marginTop: 14, backgroundColor: colors.surfaceAlt, borderRadius: radius.md,
    padding: 14, borderWidth: 1, borderColor: colors.border, gap: 8,
  },
  communityTitle: { color: colors.primaryDark, fontFamily: font.bold, fontSize: 10.5, letterSpacing: 1.1 },
  communityText: { color: colors.text, fontFamily: font.medium, fontSize: 13.5, lineHeight: 20 },
  communityTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  communityTag: {
    color: colors.primaryDark, fontFamily: font.semibold, fontSize: 11.5,
    backgroundColor: colors.primarySoft, paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: radius.pill, overflow: "hidden",
  },

  // Yorumlar
  commentsWrap: { paddingHorizontal: 20, paddingTop: 10 },
  commentForm: { marginBottom: 14 },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  star: { fontSize: 22, color: colors.border },
  starOn: { color: "#FBBF24" },
  starHint: { marginLeft: 6, fontSize: 12, color: colors.textFaint, fontFamily: font.medium },
  commentRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  commentInput: {
    flex: 1, minHeight: 44, maxHeight: 110, backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10,
    color: colors.text, fontFamily: font.regular, fontSize: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  commentSend: { backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  commentSendText: { color: "#fff", fontFamily: font.extra, fontSize: 13 },
  cError: { color: colors.danger, fontFamily: font.medium, fontSize: 12.5, marginTop: 6 },
  comment: { backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  commentHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentUser: { color: colors.primaryDark, fontFamily: font.bold, fontSize: 13 },
  commentRating: { color: "#FBBF24", fontSize: 12 },
  commentTime: { marginLeft: "auto", color: colors.textFaint, fontSize: 11.5, fontFamily: font.medium },
  commentBody: { color: colors.text, fontFamily: font.regular, fontSize: 13.5, lineHeight: 19, marginTop: 5 },
  commentEmpty: { color: colors.textFaint, fontFamily: font.regular, fontSize: 13, marginTop: 2 },

  // Yolculuk özeti — bottom sheet (3.1)
  sumBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sumSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, alignItems: "center",
  },
  sumHandle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 12 },
  sumTitle: { fontSize: 18, fontFamily: font.extra, color: colors.text },
  fmtRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  fmtChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  fmtChipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  fmtChipText: { fontSize: 13, fontFamily: font.bold, color: colors.textMuted },
  fmtChipTextOn: { color: colors.primaryDark },
  previewBox: { height: 340, alignItems: "center", justifyContent: "center", marginTop: 4 },

  shareCard: { width: 320, height: 400, borderRadius: radius.xl, overflow: "hidden", ...shadow(14) },
  shareInner: { padding: 24, flex: 1 },
  // Story (9:16) — 360×640 dp yerleşim; pixelRatio ile ~1080×1920 px yakalanır
  storyCard: { width: 360, height: 640, borderRadius: radius.xl, overflow: "hidden", ...shadow(14) },
  storyInner: { padding: 28, flex: 1 },
  storyTitle: { marginTop: 8, color: "#F2F4FC", fontFamily: font.black, fontSize: 30, lineHeight: 37 },
  storyStop: { color: "#C6CCE4", fontFamily: font.medium, fontSize: 14.5 },
  shareBrandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  shareBrandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#F4503B" },
  shareBrand: { color: "#F2F4FC", fontFamily: font.black, fontSize: 16, letterSpacing: 2 },
  shareDone: { marginTop: 18, color: "#FF9F8B", fontFamily: font.bold, fontSize: 11, letterSpacing: 2.5 },
  shareTitle: { marginTop: 6, color: "#F2F4FC", fontFamily: font.black, fontSize: 24, lineHeight: 30 },
  shareDate: { marginTop: 4, color: "#8A93B8", fontFamily: font.medium, fontSize: 12.5 },
  shareStops: { marginTop: 16, gap: 6 },
  shareStop: { color: "#C6CCE4", fontFamily: font.medium, fontSize: 13 },
  shareFooter: { marginTop: 18, color: "#FF9F8B", fontFamily: font.bold, fontSize: 12.5, textAlign: "center" },
  sumBtns: { flexDirection: "row", gap: 10, marginTop: 14, width: "100%" },
  sumGhost: { flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.12)" },
  sumGhostText: { color: "#F2F4FC", fontFamily: font.bold },
  sumShare: { flex: 1.4, paddingVertical: 14, alignItems: "center", borderRadius: radius.lg, backgroundColor: colors.primary },
  sumShareText: { color: "#fff", fontFamily: font.extra, fontSize: 15 },
});
