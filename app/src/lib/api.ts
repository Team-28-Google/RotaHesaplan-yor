import { AI_SERVICE_URL } from "./config";
import { getActiveCity } from "./cities";
import { supabase } from "./supabase";
import type { CreateStop, EnrichResult, LeaderRow, PlaceResult, PlanResponse, RouteWithWaypoints, Waypoint } from "./types";

const bySeq = (a: Waypoint, b: Waypoint) => a.seq - b.seq;

/** fetch + zaman aşımı — sunucu kapalıyken isteğin dakikalarca askıda kalmasını önler. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}
const isAbort = (e: unknown) => e instanceof Error && e.name === "AbortError";

/** Tüm rotaları sıralı waypoint'leriyle birlikte getirir (en yeni önce). */
export async function fetchRoutes(city?: string): Promise<RouteWithWaypoints[]> {
  let q = supabase
    .from("routes")
    .select("*, waypoints(*)")
    .order("created_at", { ascending: false });
  if (city) q = q.eq("city", city); // 3.0c: aktif şehre filtre
  const { data, error } = await q;

  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...(r as RouteWithWaypoints),
    waypoints: ((r as RouteWithWaypoints).waypoints ?? []).slice().sort(bySeq),
  }));
}

/** Tek bir rotayı sıralı waypoint'leriyle getirir (flood detayı için). */
export async function fetchRoute(routeId: string): Promise<RouteWithWaypoints> {
  const { data, error } = await supabase
    .from("routes")
    .select("*, waypoints(*)")
    .eq("id", routeId)
    .single();

  if (error) throw error;
  const route = data as RouteWithWaypoints;
  route.waypoints = (route.waypoints ?? []).slice().sort(bySeq);
  return route;
}

// --------------------------- Rota düzenleme (2.7b) ---------------------------
/** Rotadan durak çıkarır — yalnız rota sahibi yapabilir (RLS). */
export async function removeStop(waypointId: string): Promise<void> {
  const { error } = await supabase.from("waypoints").delete().eq("id", waypointId);
  if (error) throw error;
}

/** Rotanın sonuna arama sonucundan durak ekler — yalnız rota sahibi (RLS). */
export async function addStop(routeId: string, place: PlaceResult, seq: number): Promise<void> {
  const { error } = await supabase.from("waypoints").insert({
    route_id: routeId, seq, name: place.name, lat: place.lat, lng: place.lng,
    kind: "experience", transport_mode: "walk", category: "other",
    place_id: place.place_id ?? null,
    photo_urls: place.thumbnail ? [place.thumbnail] : [],
  });
  if (error) throw error;
}

// --------------------------- Ortak düzenleme (3.7) ---------------------------
/** Rota sahibi için davet token'ı getirir (yoksa üretir) — RLS: yalnız sahibi. */
export async function getOrCreateShareToken(routeId: string): Promise<string | null> {
  const { data } = await supabase
    .from("route_share_tokens").select("token").eq("route_id", routeId).maybeSingle();
  if (data?.token) return data.token as string;
  const { data: ins, error } = await supabase
    .from("route_share_tokens").insert({ route_id: routeId }).select("token").single();
  if (error) return null;
  return (ins?.token as string) ?? null;
}

/** Davet linkindeki token ile rotaya collaborator olarak katıl → route_id (geçersizse null). */
export async function joinRouteByToken(token: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("join_route", { p_token: token });
  if (error) return null;
  return (data as string) ?? null;
}

/** Bu rotayı düzenleyebilir miyim? (sahibi ya da collaborator) */
export async function canEditRoute(routeId: string, authorId: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  if (uid === authorId) return true;
  const { data } = await supabase
    .from("route_collaborators").select("route_id")
    .eq("route_id", routeId).eq("user_id", uid).maybeSingle();
  return !!data;
}

/** Durak değişince arka planda geometri + foto/puanı tazeler (hatalar yutulur). */
export async function refreshRouteExtras(routeId: string): Promise<void> {
  const post = (path: string) =>
    fetchWithTimeout(`${AI_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route_id: routeId }),
    }, 45_000).then(() => undefined, () => undefined);
  await Promise.all([post("/route-geometry"), post("/enrich-photos")]);
}

/** 💸 Rota harcama istatistiği (3.8): ortalama ₺ + bildiren sayısı (RPC yoksa null). */
export async function fetchSpendStats(routeId: string): Promise<{ avg: number; reports: number } | null> {
  try {
    const { data, error } = await supabase.rpc("route_spend_stats", { p_route: routeId });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.reports) return null;
    return { avg: row.avg_try as number, reports: row.reports as number };
  } catch {
    return null;
  }
}

/** Haftalık liderlik (3.5) — view yoksa/boşsa sessizce boş liste. */
export async function fetchWeeklyLeaderboard(): Promise<LeaderRow[]> {
  try {
    const { data, error } = await supabase.from("weekly_leaderboard").select("*");
    if (error) return [];
    return (data ?? []) as LeaderRow[];
  } catch {
    return [];
  }
}

// --------------------------- Favoriler ---------------------------
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Kullanıcının favori rota id'leri (hızlı kontrol için Set). */
export async function getFavoriteIds(): Promise<Set<string>> {
  const uid = await currentUserId();
  if (!uid) return new Set();
  const { data } = await supabase.from("route_favorites").select("route_id").eq("user_id", uid);
  return new Set((data ?? []).map((r) => r.route_id as string));
}

/** Favori ekle/çıkar (like_count trigger ile otomatik güncellenir). */
export async function setFavorite(routeId: string, fav: boolean): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Giriş gerekli");
  if (fav) {
    const { error } = await supabase.from("route_favorites").insert({ user_id: uid, route_id: routeId });
    if (error && !`${error.message}`.toLowerCase().includes("duplicate")) throw error;
  } else {
    const { error } = await supabase.from("route_favorites").delete().eq("user_id", uid).eq("route_id", routeId);
    if (error) throw error;
  }
}

/** Kullanıcının kaydettiği rotalar (waypoint'leriyle). */
export async function fetchFavoriteRoutes(): Promise<RouteWithWaypoints[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("route_favorites")
    .select("routes(*, waypoints(*))")
    .eq("user_id", uid);
  if (error) throw error;
  const routes = (data ?? [])
    .map((row) => (row as unknown as { routes: RouteWithWaypoints }).routes)
    .filter(Boolean);
  return routes.map((r) => ({ ...r, waypoints: (r.waypoints ?? []).slice().sort(bySeq) }));
}

// --------------------------- Yorumlar (flood) ---------------------------
export interface FloodComment {
  id: string;
  route_id: string;
  author_id: string;
  body: string | null;
  rating: number | null;
  photo_urls: string[] | null;
  created_at: string;
  username: string;
}

/** Rotanın yorumları (en yeni önce), yazar kullanıcı adıyla birlikte. */
export async function fetchComments(routeId: string): Promise<FloodComment[]> {
  const { data, error } = await supabase
    .from("flood_comments")
    .select("id, route_id, author_id, body, rating, photo_urls, created_at, profiles(username)")
    .eq("route_id", routeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = Omit<FloodComment, "username"> & { profiles: { username: string } | { username: string }[] | null };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return { ...r, username: p?.username ?? "gezgin" };
  });
}

/** Rotaya yorum + opsiyonel 1-5 puan + opsiyonel foto ekler. */
export async function addComment(
  routeId: string, body: string, rating: number | null, photoUrls: string[] = [],
): Promise<void> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Giriş gerekli");
  const { error } = await supabase
    .from("flood_comments")
    .insert({ route_id: routeId, author_id: uid, body, rating, photo_urls: photoUrls });
  if (error) throw error;
}

/** Yerel fotoğrafı 'photos' bucket'ına (uid/klasörüne) yükler → public URL (3.2).
    Migration 0008 uygulanmamışsa/başarısızsa null döner — yorum fotosuz gider. */
export async function uploadPhoto(localUri: string): Promise<string | null> {
  try {
    const uid = await currentUserId();
    if (!uid) return null;
    const ext = (localUri.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${uid}/${Date.now()}.${ext}`;
    // RN'de blob upload güvenilmez — ArrayBuffer ile yükle
    const buf = await (await fetch(localUri)).arrayBuffer();
    const { error } = await supabase.storage.from("photos").upload(path, buf, {
      contentType: ext === "png" ? "image/png" : "image/jpeg",
    });
    if (error) return null;
    return supabase.storage.from("photos").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}

// --------------------------- Profil ---------------------------
/** Kendi profil satırım (avatar için) — giriş yoksa null. */
export async function getMyProfile(): Promise<{ avatar_url: string | null } | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data } = await supabase.from("profiles").select("avatar_url").eq("id", uid).single();
  return (data as { avatar_url: string | null } | null) ?? null;
}

/** Profil fotoğrafını günceller (URL 'photos' bucket'ından gelir). */
export async function setMyAvatar(url: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", uid);
  return !error;
}

// --------------------------- Profil sayaçları ---------------------------
export async function countMyRoutes(): Promise<number> {
  const uid = await currentUserId();
  if (!uid) return 0;
  const { count } = await supabase
    .from("routes")
    .select("id", { count: "exact", head: true })
    .eq("author_id", uid);
  return count ?? 0;
}

export async function countMyComments(): Promise<number> {
  const uid = await currentUserId();
  if (!uid) return 0;
  const { count } = await supabase
    .from("flood_comments")
    .select("id", { count: "exact", head: true })
    .eq("author_id", uid);
  return count ?? 0;
}

/** 🎲 Üretim merkezi (2.7b): kullanıcı konumu YA DA semt adı; ikisi de yoksa AI semt seçer. */
export interface GenOptions {
  lat?: number;
  lng?: number;
  district?: string;
}

/** AI servisine doğal dil niyeti gönderir → kişiselleştirilmiş rota + flood anlatısı.
 *  Giriş yapılmışsa user_id eklenir (2.1); forceWeatherFit="indoor" → ☔ kapalı alternatif (2.5);
 *  forceGenerate → 🎲 yepyeni rota üretilir (2.7, daha uzun sürer). */
export async function planRoute(
  text: string, forceWeatherFit?: "indoor", forceGenerate?: boolean, gen?: GenOptions,
): Promise<PlanResponse> {
  const uid = await currentUserId();
  let res: Response;
  try {
    res = await fetchWithTimeout(`${AI_SERVICE_URL}/plan-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        user_id: uid ?? undefined,
        force_weather_fit: forceWeatherFit,
        force_generate: forceGenerate || undefined,
        gen_lat: gen?.lat,
        gen_lng: gen?.lng,
        gen_district: gen?.district,
        city: await getActiveCity(), // 3.0c: cümlede şehir yoksa bu kullanılır
      }),
    }, forceGenerate ? 150_000 : 90_000);
  } catch (e) {
    if (isAbort(e)) throw new Error("AI servisi yanıt vermedi (zaman aşımı). Sunucu meşgul olabilir, tekrar dene.");
    throw new Error("AI servisine ulaşılamadı. PC'de sunucu açık ve aynı Wi-Fi'de mi? (npm run ai)");
  }
  if (!res.ok) throw new Error(`AI servisi hatası (${res.status})`);
  const data = (await res.json()) as PlanResponse;
  if (data.route) {
    data.route.waypoints = (data.route.waypoints ?? []).slice().sort(bySeq);
  }
  return data;
}

// --------------------------- Canlı navigasyon (journey) ---------------------------
export interface WalkLeg {
  coords: { lat: number; lng: number }[];
  distance_m: number;
  duration_min: number;
}

/** Kullanıcı konumu → hedef durak GERÇEK yürüme rotası (Google Maps hissi).
 *  Servis kapalıysa null döner → harita düz kesikli çizgiye düşer. */
export async function fetchWalkRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<WalkLeg | null> {
  try {
    const res = await fetchWithTimeout(`${AI_SERVICE_URL}/walk-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_lat: from.lat, from_lng: from.lng, to_lat: to.lat, to_lng: to.lng }),
    }, 12_000);
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok && Array.isArray(data.coords) && data.coords.length >= 2 ? (data as WalkLeg) : null;
  } catch {
    return null;
  }
}

// --------------------------- AI hafıza (onboarding) ---------------------------
/** Onboarding tercihlerini AI hafızasına yazar (kişiselleştirilmiş plan için).
 *  Başarısızsa sessizce false döner — app akışını asla bloklamaz; sonraki açılışta tekrar denenir. */
export async function syncOnboardingMemory(vibes: string[], budget: number): Promise<boolean> {
  try {
    const uid = await currentUserId();
    if (!uid) return false;
    const res = await fetchWithTimeout(`${AI_SERVICE_URL}/memory/onboarding`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, vibes, budget }),
    }, 20_000);
    return res.ok;
  } catch {
    return false;
  }
}

/** Davranış hafızası (2.2): favori/yolculuk/yorum olayını AI hafızasına işler.
 *  Fire-and-forget — başarısızlık app akışını etkilemez. */
export function sendMemoryEvent(kind: "favorite" | "journey" | "comment", routeId: string): void {
  currentUserId().then((uid) => {
    if (!uid) return;
    fetchWithTimeout(`${AI_SERVICE_URL}/memory/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: uid, kind, route_id: routeId }),
    }, 15_000).catch(() => {});
  }).catch(() => {});
}

// --------------------------- Topluluk yorum özeti (2.4) ---------------------------
export interface CommentSummary {
  ok: boolean;
  summary?: string;
  tags?: string[];
  count?: number;
}

/** Rota yorumlarının AI özeti (≥3 yorum gerekir; servis 1 saat cache'ler). */
export async function fetchCommentSummary(routeId: string): Promise<CommentSummary | null> {
  try {
    const res = await fetchWithTimeout(`${AI_SERVICE_URL}/summarize-comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route_id: routeId }),
    }, 30_000);
    if (!res.ok) return null;
    return (await res.json()) as CommentSummary;
  } catch {
    return null;
  }
}

// --------------------------- Rota oluşturma ---------------------------
/**
 * Mekan ara — AI servisi üzerinden Google Places (New), AKTİF ŞEHİR merkezine bias'lı.
 * (Eski hali doğrudan Photon/OSM + sabit İstanbul bias'ıydı — Ankara'da "Anıtkabir"
 * araması saçmalıyordu; foto/puan da gelmiyordu.)
 */
export async function searchPlaces(q: string): Promise<PlaceResult[]> {
  let res: Response;
  try {
    res = await fetchWithTimeout(`${AI_SERVICE_URL}/search-place`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, city: await getActiveCity() }),
    }, 20_000);
  } catch (e) {
    if (isAbort(e)) throw new Error("Arama zaman aşımına uğradı. Tekrar dene.");
    throw new Error("AI servisine ulaşılamadı (npm run ai açık mı, aynı Wi-Fi mi?)");
  }
  if (!res.ok) throw new Error(`Arama hatası (${res.status})`);
  const data = (await res.json()) as { results?: PlaceResult[] };
  return data.results ?? [];
}

/** Eklenen durakları AI ile zenginleştir (başlık/etiket/kategori/anlatı). */
export async function enrichRoute(stops: CreateStop[]): Promise<EnrichResult> {
  let res: Response;
  try {
    res = await fetchWithTimeout(`${AI_SERVICE_URL}/enrich-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stops }),
    }, 60_000);
  } catch (e) {
    if (isAbort(e)) throw new Error("AI yanıt vermedi (zaman aşımı). Tekrar dene.");
    throw new Error("AI servisine ulaşılamadı (npm run ai açık mı, aynı Wi-Fi mi?)");
  }
  if (!res.ok) throw new Error(`AI zenginleştirme hatası (${res.status})`);
  return res.json();
}

function haversineM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export interface CreateRouteInput {
  title: string;
  description: string;
  vibe_tags: string[];
  weather_fit: string;
  stops: (CreateStop & { category: string; narrative: string })[];
}

/** Rotayı + waypoint'leri kaydeder, sonra hafızaya embedler. Yeni route_id döner. */
export async function createRoute(input: CreateRouteInput): Promise<string> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Giriş gerekli");

  let dist = 0;
  for (let i = 1; i < input.stops.length; i++) dist += haversineM(input.stops[i - 1], input.stops[i]);

  const { data: routeRow, error } = await supabase
    .from("routes")
    .insert({
      author_id: uid, title: input.title, description: input.description,
      city: await getActiveCity(),
      vibe_tags: input.vibe_tags, weather_fit: input.weather_fit, budget_level: 2,
      is_seed: false, total_distance_m: dist, total_duration_min: Math.round(dist / 80),
    })
    .select("id")
    .single();
  if (error || !routeRow) throw error ?? new Error("Rota kaydedilemedi");
  const routeId = routeRow.id as string;

  const waypoints = input.stops.map((s, i) => ({
    route_id: routeId, seq: i, name: s.name, lat: s.lat, lng: s.lng,
    category: s.category, kind: "experience", note: s.narrative || s.note || null,
    transport_mode: i === 0 ? "start" : "walk",
  }));
  const { error: wErr } = await supabase.from("waypoints").insert(waypoints);
  if (wErr) throw wErr;

  // hafızaya embedle (başkalarının AI aramasında çıksın) — başarısız olsa da rota kayıtlı
  try {
    await fetchWithTimeout(`${AI_SERVICE_URL}/embed-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route_id: routeId }),
    }, 20_000);
  } catch { /* yoksay */ }

  // sokak geometrisi (Google Routes) — başarısız olursa harita kuş uçuşu çizer, sorun değil
  try {
    await fetchWithTimeout(`${AI_SERVICE_URL}/route-geometry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route_id: routeId }),
    }, 45_000);
  } catch { /* yoksay */ }

  // durak fotoğrafları + puan (Places) — rota seed kalitesinde görünsün (3.2a)
  try {
    await fetchWithTimeout(`${AI_SERVICE_URL}/enrich-photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route_id: routeId }),
    }, 45_000);
  } catch { /* yoksay */ }

  return routeId;
}
