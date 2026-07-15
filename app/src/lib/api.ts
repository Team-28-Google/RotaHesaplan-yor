import { AI_SERVICE_URL, APP_KEY } from "./config";
import { getActiveCity, registerCity } from "./cities";
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

/** Anonim maliyet uçlarına bot kalkanı header'ı (#3a); APP_KEY boşsa boş obje. */
const appKeyHeader: Record<string, string> = APP_KEY ? { "X-App-Key": APP_KEY } : {};

/** Aktif içerik dili — LocaleProvider setDataLang ile senkronlar (setUiLang deseni).
 *  Keşif akışı (feed + şehir sayaçları) ve yeni rota kaydı bu dili kullanır. */
let _dataLang: "tr" | "en" = "tr";
export function setDataLang(l: "tr" | "en") { _dataLang = l; }
export function getDataLang(): "tr" | "en" { return _dataLang; }

/** Servise kimlik (güvenlik): Supabase oturum token'ı — servis user_id'yi gövdeden
 *  değil BU token'dan doğrular. Oturum yoksa boş obje (anonim uçlar çalışmaya devam eder). */
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const t = data.session?.access_token;
    return t ? { Authorization: `Bearer ${t}` } : {};
  } catch {
    return {};
  }
}

/** Keşif akışı rotaları — sıralı waypoint'leriyle (en yeni önce), aktif dile göre.
 *  lang verilmezse modül seviyesi _dataLang kullanılır (Home/Map çağrıları değişmez). */
export async function fetchRoutes(city?: string, lang: "tr" | "en" = _dataLang): Promise<RouteWithWaypoints[]> {
  let q = supabase
    .from("routes")
    .select("*, waypoints(*)")
    .eq("lang", lang) // 4.x: EN modu → İngilizce havuz, TR modu → Türkçe havuz
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

// --------------------------- Fork & yayınlama (3.13) ---------------------------
/** Başkasının rotasını KOPYALAYARAK kendine kaydeder (orijinale dokunmaz);
 *  extra verilirse yeni durak kopyaya eklenir. Kopya ÖZEL başlar. */
export async function forkRoute(src: RouteWithWaypoints, extra?: PlaceResult): Promise<string> {
  const uid = await currentUserId();
  if (!uid) throw new Error("Giriş gerekli");
  const { data: r, error } = await supabase.from("routes").insert({
    author_id: uid, title: src.title, description: src.description,
    city: src.city, vibe_tags: src.vibe_tags, weather_fit: src.weather_fit,
    budget_level: src.budget_level, is_seed: false, is_public: false,
    cover_photo_url: src.cover_photo_url, lang: src.lang ?? "tr", // kopya kaynağın dilini korur
    total_distance_m: src.total_distance_m, total_duration_min: src.total_duration_min,
  }).select("id").single();
  if (error || !r) throw error ?? new Error("Kopya oluşturulamadı");
  const newId = r.id as string;

  const wps = (src.waypoints ?? []).slice().sort((a, b) => a.seq - b.seq).map((w) => ({
    route_id: newId, seq: w.seq, name: w.name, lat: w.lat, lng: w.lng,
    category: w.category, kind: w.kind, note: w.note, place_id: w.place_id,
    price_level: w.price_level, transport_mode: w.transport_mode, transport_note: w.transport_note,
    photo_urls: w.photo_urls ?? [], metadata: w.metadata ?? {},
    leg_geometry: w.leg_geometry ?? null, leg_distance_m: w.leg_distance_m ?? null,
    leg_duration_min: w.leg_duration_min ?? null,
  }));
  if (extra) {
    const maxSeq = wps.length ? Math.max(...wps.map((w) => w.seq)) : -1;
    wps.push({
      route_id: newId, seq: maxSeq + 1, name: extra.name, lat: extra.lat, lng: extra.lng,
      category: "other", kind: "experience", note: null, place_id: extra.place_id ?? null,
      price_level: null, transport_mode: "walk", transport_note: null,
      photo_urls: extra.thumbnail ? [extra.thumbnail] : [], metadata: {},
      leg_geometry: null, leg_distance_m: null, leg_duration_min: null,
    });
  }
  const { error: wErr } = await supabase.from("waypoints").insert(wps);
  if (wErr) throw wErr;
  refreshRouteExtras(newId); // yeni bacağın geometrisi + fotosu arka planda
  return newId;
}

/** "🌍 Rotanı paylaş": rota herkese açılır (yalnız sahibi — RLS). */
export async function publishRoute(routeId: string): Promise<boolean> {
  const { error } = await supabase.from("routes").update({ is_public: true }).eq("id", routeId);
  return !error;
}

/** Bir kullanıcının rotaları (liderlik vitrini) — RLS gereği yalnız HERKESE AÇIK olanlar gelir. */
export async function fetchUserRoutes(userId: string): Promise<RouteWithWaypoints[]> {
  const { data, error } = await supabase
    .from("routes").select("*, waypoints(*)")
    .eq("author_id", userId).eq("is_seed", false)
    .order("like_count", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => ({
    ...(r as RouteWithWaypoints),
    waypoints: ((r as RouteWithWaypoints).waypoints ?? []).slice().sort(bySeq),
  }));
}

/** Rotalarım: kendi oluşturduğun/kopyaladığın rotalar (özel + açık hepsi). */
export async function fetchMyRoutes(): Promise<RouteWithWaypoints[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from("routes").select("*, waypoints(*)")
    .eq("author_id", uid)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map((r) => ({
    ...(r as RouteWithWaypoints),
    waypoints: ((r as RouteWithWaypoints).waypoints ?? []).slice().sort(bySeq),
  }));
}

// --------------------------- Ortak koleksiyonlar (3.10) ---------------------------
export interface CollectionInfo {
  id: string;
  owner_id: string;
  title: string;
  emoji: string | null;
  route_count: number;
  member_count: number;
}
export interface CollectionMember {
  user_id: string;
  username: string;
  avatar_url: string | null;
}

/** Üyesi olduğum koleksiyonlar (rota/üye sayılarıyla). */
export async function fetchMyCollections(): Promise<CollectionInfo[]> {
  const { data, error } = await supabase
    .from("collections")
    .select("id, owner_id, title, emoji, collection_routes(count), collection_members(count)")
    .order("created_at", { ascending: false });
  if (error) return [];
  type Row = CollectionInfo & {
    collection_routes: { count: number }[];
    collection_members: { count: number }[];
  };
  return ((data ?? []) as unknown as Row[]).map((c) => ({
    id: c.id, owner_id: c.owner_id, title: c.title, emoji: c.emoji,
    route_count: c.collection_routes?.[0]?.count ?? 0,
    member_count: c.collection_members?.[0]?.count ?? 0,
  }));
}

/** Yeni koleksiyon: kaydı aç + kendini üye yaz. */
export async function createCollection(title: string, emoji: string): Promise<string | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from("collections").insert({ owner_id: uid, title, emoji }).select("id").single();
  if (error || !data) return null;
  await supabase.from("collection_members").insert({ collection_id: data.id, user_id: uid });
  return data.id as string;
}

/** Koleksiyon içeriği: rotalar (RLS erişilebilenler) + üyeler. */
export async function fetchCollection(collectionId: string): Promise<{
  routes: RouteWithWaypoints[]; members: CollectionMember[]; ownerId: string | null;
}> {
  const [routesRes, membersRes, colRes] = await Promise.all([
    supabase.from("collection_routes")
      .select("routes(*, waypoints(*))")
      .eq("collection_id", collectionId)
      .order("created_at", { ascending: false }),
    supabase.from("collection_members")
      .select("user_id, profiles(username, avatar_url)")
      .eq("collection_id", collectionId),
    supabase.from("collections").select("owner_id").eq("id", collectionId).maybeSingle(),
  ]);
  const routes = (routesRes.data ?? [])
    .map((r) => (r as unknown as { routes: RouteWithWaypoints }).routes)
    .filter(Boolean)
    .map((r) => ({ ...r, waypoints: (r.waypoints ?? []).slice().sort(bySeq) }));
  type MRow = { user_id: string; profiles: { username: string; avatar_url: string | null } | null };
  const members = ((membersRes.data ?? []) as unknown as MRow[]).map((m) => ({
    user_id: m.user_id,
    username: m.profiles?.username ?? "gezgin",
    avatar_url: m.profiles?.avatar_url ?? null,
  }));
  return { routes, members, ownerId: (colRes.data?.owner_id as string) ?? null };
}

export async function addRouteToCollection(collectionId: string, routeId: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { error } = await supabase.from("collection_routes")
    .insert({ collection_id: collectionId, route_id: routeId, added_by: uid });
  return !error || (error.code === "23505"); // zaten ekli = başarı say
}

export async function removeRouteFromCollection(collectionId: string, routeId: string): Promise<void> {
  await supabase.from("collection_routes")
    .delete().eq("collection_id", collectionId).eq("route_id", routeId);
}

/** Koleksiyondan ayrıl (0020): üye kendini çıkarır → RLS izin verir. */
export async function leaveCollection(collectionId: string): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const { error } = await supabase.from("collection_members")
    .delete().eq("collection_id", collectionId).eq("user_id", uid);
  return !error;
}

/** Koleksiyonu yeniden adlandır (0020): yalnız sahibi — RLS. */
export async function renameCollection(collectionId: string, title: string, emoji?: string): Promise<boolean> {
  const patch: Record<string, string> = { title: title.trim() };
  if (emoji) patch.emoji = emoji;
  const { error } = await supabase.from("collections").update(patch).eq("id", collectionId);
  return !error;
}

/** Koleksiyon davet token'ı (yalnız sahibi — RLS). Yarış düzeltmesi (upsert). */
export async function getOrCreateCollectionToken(collectionId: string): Promise<string | null> {
  const { data } = await supabase
    .from("collection_share_tokens").select("token").eq("collection_id", collectionId).maybeSingle();
  if (data?.token) return data.token as string;
  const { data: ins, error } = await supabase
    .from("collection_share_tokens")
    .upsert({ collection_id: collectionId }, { onConflict: "collection_id" })
    .select("token").single();
  if (error) return null;
  return (ins?.token as string) ?? null;
}

/** Davet linkindeki token ile koleksiyona katıl → collection_id (geçersizse null). */
export async function joinCollectionByToken(token: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("join_collection", { p_token: token });
  if (error) return null;
  return (data as string) ?? null;
}

// --------------------------- Ortak düzenleme (3.7) ---------------------------
/** Rota sahibi için davet token'ı getirir (yoksa üretir) — RLS: yalnız sahibi.
 *  Yarış düzeltmesi (upsert): eşzamanlı çift dokunuşta çakışmaz. */
export async function getOrCreateShareToken(routeId: string): Promise<string | null> {
  const { data } = await supabase
    .from("route_share_tokens").select("token").eq("route_id", routeId).maybeSingle();
  if (data?.token) return data.token as string;
  const { data: ins, error } = await supabase
    .from("route_share_tokens")
    .upsert({ route_id: routeId }, { onConflict: "route_id" })
    .select("token").single();
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
  const auth = await authHeaders(); // servis artık sahiplik doğruluyor
  const post = (path: string) =>
    fetchWithTimeout(`${AI_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
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

/** Haftalık liderlik (3.5) — 0018: view yerine kontrollü RPC (Security Advisor fix'i). */
export async function fetchWeeklyLeaderboard(): Promise<LeaderRow[]> {
  try {
    const { data, error } = await supabase.rpc("weekly_leaderboard");
    if (error) return [];
    return (data ?? []) as LeaderRow[];
  } catch {
    return [];
  }
}

/** ❤️ En beğenilen rota yazarları (3.12) — view yoksa/boşsa sessizce boş liste. */
export interface AuthorLeaderRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  total_likes: number;
  route_count: number;
}
export async function fetchAuthorLeaderboard(): Promise<AuthorLeaderRow[]> {
  try {
    const { data, error } = await supabase.rpc("author_likes_leaderboard");
    if (error) return [];
    return (data ?? []) as AuthorLeaderRow[];
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
      headers: { "Content-Type": "application/json", ...appKeyHeader, ...(await authHeaders()) },
      body: JSON.stringify({
        text,
        user_id: uid ?? undefined,
        force_weather_fit: forceWeatherFit,
        force_generate: forceGenerate || undefined,
        gen_lat: gen?.lat,
        gen_lng: gen?.lng,
        gen_district: gen?.district,
        city: await getActiveCity(), // 3.0c: cümlede şehir yoksa bu kullanılır
        lang: _dataLang, // 4.x: EN modda üretim anlatısı İngilizce + rota EN havuzuna
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
export type NavMode = "walk" | "transit" | "drive";
export interface WalkLeg {
  coords: { lat: number; lng: number }[];
  distance_m: number;
  duration_min: number;
  /** TRANSIT modunda ilk hat bilgisi (4.0): araç emojisi (🚇🚊🚆⛴️🚌), hat, biniş, yön, aktarma */
  transit?: {
    line: string; board?: string | null; headsign?: string | null;
    vehicle?: string | null; transfers?: number | null;
  } | null;
  /** Adım adım talimatlar (4.0b): yürüme adımı ya da hat rozetli transit adımı */
  steps?: {
    kind: "walk" | "transit";
    text?: string; dist_m?: number;                       // walk
    line?: string; vehicle?: string;                       // transit
    color?: string | null; text_color?: string | null;     // hat rengi (rozet+çizgi)
    board?: string | null; alight?: string | null;
    stop_count?: number | null; dep?: string | null; arr?: string | null;
    headsign?: string | null;
  }[];
  /** Harita çizimi (4.0b): yürüme=noktalı, transit=hat renginde segmentler */
  segments?: { kind: "walk" | "transit"; color?: string | null; coords: { lat: number; lng: number }[] }[];
  /** Hat özeti ("⛴️ Vapur → 🚶") — alternatif karşılaştırması için */
  summary?: string;
  /** Toplam kalkış → varış saati (ilk biniş / son iniş) */
  dep?: string | null;
  arr?: string | null;
  /** TRANSIT: en fazla 3 alternatif rota (kendi geometri+adımlarıyla) */
  alternatives?: WalkLeg[];
}

/** Kullanıcı konumu → hedef durak GERÇEK rota, seçilen ULAŞIM MODUNDA (4.0: 🚶🚌🚗).
 *  Servis kapalıysa null döner → harita düz kesikli çizgiye düşer. */
export async function fetchNavRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  mode: NavMode = "walk",
): Promise<WalkLeg | null> {
  try {
    const res = await fetchWithTimeout(`${AI_SERVICE_URL}/nav-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...appKeyHeader },
      body: JSON.stringify({ from_lat: from.lat, from_lng: from.lng, to_lat: to.lat, to_lng: to.lng, mode, lang: _dataLang }),
    }, 15_000);
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.coords) && data.coords.length >= 2) return data as WalkLeg;
      return null;
    }
    // Eski servis (nav-route'suz) — yürüme modunda /walk-route'a düş, mod desteği deploy'la gelir
    if (mode === "walk" && res.status === 404) {
      const legacy = await fetchWithTimeout(`${AI_SERVICE_URL}/walk-route`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...appKeyHeader },
        body: JSON.stringify({ from_lat: from.lat, from_lng: from.lng, to_lat: to.lat, to_lng: to.lng, lang: _dataLang }),
      }, 12_000);
      if (!legacy.ok) return null;
      const d = await legacy.json();
      return d.ok && Array.isArray(d.coords) && d.coords.length >= 2 ? (d as WalkLeg) : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Geriye uyumluluk: eski çağıranlar için yürüme modu kısayolu. */
export async function fetchWalkRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<WalkLeg | null> {
  return fetchNavRoute(from, to, "walk");
}

export interface CityHit {
  name: string;
  country: string | null;
  place_id?: string;   // Autocomplete sonucu — koordinat seçimde çözülür
  lat?: number;        // Geocoding yedeği doğrudan koordinat verir
  lng?: number;
}

/** DÜNYA şehir OTOMATİK-TAMAMLAMA (şehir seçicideki kutu): yazdıkça ön-ek eşleştirmeli
 *  çoklu şehir önerisi. Servise ulaşılamazsa boş — TR listesi çevrimdışı çalışır. */
export async function searchCities(q: string, lang: "tr" | "en" = "tr"): Promise<CityHit[]> {
  if (q.trim().length < 2) return [];
  try {
    const res = await fetchWithTimeout(`${AI_SERVICE_URL}/search-city`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...appKeyHeader },
      body: JSON.stringify({ q: q.trim(), lang }),
    }, 10_000);
    if (!res.ok) return [];
    const j = await res.json();
    return Array.isArray(j.results) ? j.results : [];
  } catch {
    return [];
  }
}

/** Seçilen dünya şehrinin koordinatı (placeId ya da ad). Autocomplete sonucu koordinat
 *  taşımadığı için seçimde çağrılır; doğrudan koordinat varsa (Geocoding yedeği) o kullanılır. */
export async function cityLatLng(hit: CityHit): Promise<{ lat: number; lng: number } | null> {
  if (hit.lat != null && hit.lng != null) return { lat: hit.lat, lng: hit.lng };
  try {
    const res = await fetchWithTimeout(`${AI_SERVICE_URL}/city-latlng`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...appKeyHeader },
      body: JSON.stringify({ place_id: hit.place_id, name: hit.name }),
    }, 10_000);
    if (!res.ok) return null;
    const j = await res.json();
    return j.ok ? { lat: j.lat, lng: j.lng } : null;
  } catch {
    return null;
  }
}

/** Paylaşım kartı için rota izli KOYU harita PNG URL'i (4.0c Static Maps — servis
 *  proxy'si, anahtar sunucuda). Görsel yüklenemezse çağıran stilize çizime düşer. */
export function staticMapUrl(
  points: { lat: number; lng: number }[],
  line: "coral" | "teal" = "coral",
  w = 608, h = 300,
): string {
  const step = Math.max(1, Math.ceil(points.length / 60)); // URL makul kalsın
  const pts = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const path = pts.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
  // Image kaynağı header taşıyamaz → app-key ?k= ile gider (#3a)
  const kq = APP_KEY ? `&k=${encodeURIComponent(APP_KEY)}` : "";
  return `${AI_SERVICE_URL}/static-map?path=${encodeURIComponent(path)}&w=${w}&h=${h}&line=${line}${kq}`;
}

/** Yürünen GPS izini yola oturtur (4.0c Roads API). Servis/anahtar hazır değilse
 *  ya da sonuç anlamsızsa null — çağıran ham izi kullanmaya devam eder. */
export async function snapTrack(
  points: { lat: number; lng: number }[],
): Promise<{ lat: number; lng: number }[] | null> {
  if (points.length < 2) return null;
  try {
    const res = await fetchWithTimeout(`${AI_SERVICE_URL}/snap-track`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...appKeyHeader },
      body: JSON.stringify({ points }),
    }, 8_000);
    if (!res.ok) return null;
    const j = await res.json();
    return j.ok && Array.isArray(j.points) && j.points.length >= 2 ? j.points : null;
  } catch {
    return null;
  }
}

/** Konumdan ili algılar (Geocoding, tüm-Türkiye): kanonik anahtar + Türkçe etiket
 *  (ör. Datça → {key:"Mugla", label:"Muğla"}). Servise ulaşılamazsa/il çözülemezse null. */
export async function detectCity(lat: number, lng: number): Promise<{ key: string; label: string } | null> {
  try {
    const res = await fetchWithTimeout(`${AI_SERVICE_URL}/detect-city`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...appKeyHeader },
      body: JSON.stringify({ lat, lng }),
    }, 35_000); // Render soğuk başlangıcı ~30 sn — kısa timeout "bulunamadı" verdiriyordu
    if (!res.ok) return null;
    const j = await res.json();
    return j.city ? { key: j.city, label: j.province ?? j.city } : null;
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
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
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
  Promise.all([currentUserId(), authHeaders()]).then(([uid, auth]) => {
    if (!uid) return;
    fetchWithTimeout(`${AI_SERVICE_URL}/memory/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
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
      headers: { "Content-Type": "application/json", ...appKeyHeader },
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
      body: JSON.stringify({ stops, lang: _dataLang }), // 4.x: EN modda anlatı İngilizce
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

  // Şehir AKTİF SEÇİMDEN DEĞİL, durakların GERÇEK konumundan türetilir — Antalya'da
  // oluşturulan rota app İstanbul'da kalsa bile İstanbul akışına düşmez. Servis
  // kapalıysa/il çözülemezse aktif şehre düşülür (eski davranış).
  const first = input.stops[0];
  const detected = first ? await detectCity(first.lat, first.lng) : null;
  if (detected) await registerCity(detected.key, detected.label, first!.lat, first!.lng);
  const city = detected?.key ?? await getActiveCity();

  const { data: routeRow, error } = await supabase
    .from("routes")
    .insert({
      author_id: uid, title: input.title, description: input.description,
      city,
      vibe_tags: input.vibe_tags, weather_fit: input.weather_fit, budget_level: 2,
      is_seed: false, is_public: false, // 3.13: özel başlar; "🌍 Rotanı paylaş" ile açılır
      lang: _dataLang, // 4.x: oluşturulduğu arayüz dilinin havuzuna girer
      total_distance_m: dist, total_duration_min: Math.round(dist / 80),
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
  const auth = await authHeaders(); // servis artık kimlik/sahiplik doğruluyor
  try {
    await fetchWithTimeout(`${AI_SERVICE_URL}/embed-route`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ route_id: routeId }),
    }, 20_000);
  } catch { /* yoksay */ }

  // sokak geometrisi (Google Routes) — başarısız olursa harita kuş uçuşu çizer, sorun değil
  try {
    await fetchWithTimeout(`${AI_SERVICE_URL}/route-geometry`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ route_id: routeId }),
    }, 45_000);
  } catch { /* yoksay */ }

  // durak fotoğrafları + puan (Places) — rota seed kalitesinde görünsün (3.2a)
  try {
    await fetchWithTimeout(`${AI_SERVICE_URL}/enrich-photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ route_id: routeId }),
    }, 45_000);
  } catch { /* yoksay */ }

  return routeId;
}
