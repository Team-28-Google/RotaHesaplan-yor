import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Image, PixelRatio, Platform, StyleSheet, Text, TouchableOpacity, View,
  type StyleProp, type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MapView, { Callout, Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { captureRef } from "react-native-view-shot";

import type { ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";

// Android'de foto marker'lar canlı View yerine ÖNCEDEN ÜRETİLMİŞ BİTMAP olarak çizilir.
// (react-native-maps'in "çeyrek render" bug'ı View-tabanlı marker'larda oluşur;
// native bitmap ikonlar bu yola hiç girmez → kesin çözüm.)
const BITMAP_MARKERS = Platform.OS === "android";
const PIN = 66; // foto marker kutusu (dp)

export type LatLng = { lat: number; lng: number };
export type OSMMarker = {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label?: string;
  photo?: string;            // varsa fotoğraflı baloncuk
  icon?: string;             // amenity (WC/çeşme) — Ionicons adı
  variant?: "start" | "end" | "stop";
  popup?: string;
};
export type OSMPolyline = {
  id: string;
  color: string;
  coords: LatLng[];          // tam yol (fit/odak için; segments varsa birleştirilmiş hali)
  modes?: string[];          // modes[i] = coords[i]'ye ulaşım türü (transit ise kırmızı)
  segments?: { coords: LatLng[]; mode?: string; approx?: boolean }[]; // bacak bazlı geometri; approx = kuş uçuşu tahmin
};
type TransitLineData = { name: string; color: string; dashed?: boolean; coords: LatLng[] };

type Props = {
  markers?: OSMMarker[];
  polylines?: OSMPolyline[];
  transitLines?: TransitLineData[];
  onPressItem?: (id: string) => void;
  onSelectItem?: (id: string) => void;
  onMapPress?: (lat: number, lng: number) => void;
  focusId?: string | null;
  userLocation?: LatLng | null;
  followLocation?: LatLng | null;   // verilirse kamera bu konumu takip eder (yolculuk modu)
  followHeading?: number | null;    // hareket yönü (derece) — harita yürüdüğün yöne döner
  guideLine?: LatLng[] | null;      // konum → hedef durak rotası (2 nokta = düz kesikli; >2 = gerçek sokak rotası)
  trackLine?: LatLng[] | null;      // yürünen GERÇEK iz (4.2) — ince turkuaz, planlanan rotanın üstünde
  /** 4.0b GMaps paritesi: transit navigasyonu — yürüme NOKTALI, hatlar KENDİ RENGİNDE çizilir */
  navSegments?: { kind: "walk" | "transit"; color?: string | null; coords: LatLng[] }[] | null;
  showRecenter?: boolean;
  /** Aktif şehrin bölgesi: hiç marker yoksa harita buraya odaklanır (Berlin'i seçince
      rota olmasa da harita Berlin'e gider); şehir değişince yeniden sığdırılır */
  homeRegion?: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null;
  padding?: number;
  /** Haritanın altını kaplayan overlay yüksekliği (px) — fit hesapları rotayı bunun ÜSTÜNE sığdırır */
  overlayInsetBottom?: number;
  style?: StyleProp<ViewStyle>;
};

const ISTANBUL = { latitude: 41.02, longitude: 28.99, latitudeDelta: 0.3, longitudeDelta: 0.3 };
const TRANSIT = new Set(["ferry", "metro", "tram", "marmaray", "bus", "metrobus", "funicular", "teleferik", "minibus"]);
const ll = (c: LatLng) => ({ latitude: c.lat, longitude: c.lng });
const ringOf = (v?: string) => (v === "start" ? "#22C55E" : v === "end" ? "#F97316" : "#FF6B54");

// Harita stilleri — app temasıyla bütünleşik (POI kalabalığı iki modda da kapalı)
const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#141B33" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8A93B8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0B1022" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#13291F" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#232C4E" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2E3960" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0E1B33" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#101731" }] },
];
const LIGHT_MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#E3F1E7" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#FFE9CF" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#CFE3F0" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#F4F5F8" }] },
];

type MapStyles = ReturnType<typeof makeStyles>;

/** Marker içeriğinin imzası — içerik/tema değişirse bitmap yeniden üretilir. */
const iconSig = (m: OSMMarker, mode: string) =>
  `${m.id}|${mode}|${m.photo ?? ""}|${m.icon ?? ""}|${m.label ?? ""}|${m.variant ?? ""}`;

/** Ekran DIŞINDA marker'ı (foto/numara/ikon) çizip bir kez PNG'ye çevirir (Android bitmap yolu). */
function MarkerIconRenderer({ m, styles, sig, onDone }: {
  m: OSMMarker; styles: MapStyles; sig: string; onDone: (sig: string, uri: string) => void;
}) {
  const ref = useRef<View>(null);
  const [loaded, setLoaded] = useState(!m.photo); // fotosuz varyantlar anında hazır

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => {
      try {
        const px = Math.round(PIN * PixelRatio.get()); // cihaz yoğunluğunda keskin bitmap
        const uri = await captureRef(ref, { format: "png", quality: 1, result: "tmpfile", width: px, height: px });
        onDone(sig, uri.startsWith("file://") ? uri : `file://${uri}`);
      } catch {
        onDone(sig, ""); // başarısız → canlı View'a düş
      }
    }, m.photo ? 60 : 120); // fotosuzda ilk layout'un oturması için küçük pay
    return () => clearTimeout(t);
  }, [loaded, sig, onDone, m.photo]);

  const ring = ringOf(m.variant);
  return (
    <View ref={ref} collapsable={false} style={styles.pinBox}>
      {m.photo ? (
        <View style={[styles.photoSquare, { borderColor: ring }]} collapsable={false}>
          <Image
            source={{ uri: m.photo }}
            style={styles.photoImg}
            resizeMode="cover"
            fadeDuration={0}
            onLoad={() => setLoaded(true)}
            onError={() => onDone(sig, "")}
          />
        </View>
      ) : m.icon ? (
        <View style={styles.emojiWrap} collapsable={false}>
          <Ionicons name={m.icon as keyof typeof Ionicons.glyphMap} size={16} color={m.color} />
        </View>
      ) : (
        <View style={[styles.numWrap, { backgroundColor: ring }]} collapsable={false}>
          <Text style={styles.numText}>{m.label ?? "•"}</Text>
        </View>
      )}
    </View>
  );
}

function MapPin({ m, onSelect, onOpen, styles, iconUri }: {
  m: OSMMarker; onSelect: () => void; onOpen: () => void; styles: MapStyles; iconUri?: string;
}) {
  const ring = ringOf(m.variant);
  // iOS yolu: canlı View marker (orada sorunsuz). Android foto yolu: hazır bitmap (iconUri).
  const [photoReady, setPhotoReady] = useState(false);
  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    if (!m.photo || BITMAP_MARKERS) return;
    let alive = true;
    Image.prefetch(m.photo)
      .then(() => { if (alive) { setPhotoReady(true); setTracks(true); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [m.photo]);

  // Android'de bitmap BEKLENİYOR/başarısız → canlı View'ı asla DONDURMA:
  // çeyrek-render bug'ı tam yarım çizilmiş anda donan snapshot'tan çıkıyor.
  // Bitmap gelince zaten native image yoluna geçilir (dondurma derdi kalmaz).
  const keepTracking = BITMAP_MARKERS && !iconUri;

  // Geçişten kısa süre sonra snapshot'ı dondur (pil/performans — yalnız iOS/bitmapli değilken)
  useEffect(() => {
    if (!tracks || keepTracking) return;
    const t = setTimeout(() => setTracks(false), 700);
    return () => clearTimeout(t);
  }, [tracks, keepTracking]);

  // Android + bitmap hazır → native ikonlu marker (çeyrek bug'ı imkânsız; TÜM varyantlar)
  if (BITMAP_MARKERS && iconUri) {
    return (
      <Marker
        coordinate={{ latitude: m.lat, longitude: m.lng }}
        onPress={onSelect}
        onCalloutPress={onOpen}
        anchor={{ x: 0.5, y: 0.5 }}
        calloutAnchor={{ x: 0.5, y: 0 }}
        image={{ uri: iconUri }}
        tracksViewChanges={false}
      >
        {!!m.popup && (
          <Callout tooltip onPress={onOpen}>
            <View style={styles.callout}>
              {!!m.photo && <Image source={{ uri: m.photo }} style={styles.calloutPhoto} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.calloutTitle} numberOfLines={2}>{m.popup}</Text>
                <Text style={styles.calloutHint}>Detayı gör ›</Text>
              </View>
            </View>
          </Callout>
        )}
      </Marker>
    );
  }

  const showPhoto = !!m.photo && !BITMAP_MARKERS && photoReady;

  return (
    <Marker
      key={showPhoto ? "photo" : "plain"}
      coordinate={{ latitude: m.lat, longitude: m.lng }}
      onPress={onSelect}
      onCalloutPress={onOpen}
      anchor={{ x: 0.5, y: 0.5 }}
      calloutAnchor={{ x: 0.5, y: 0 }}
      tracksViewChanges={keepTracking || tracks}
    >
      <View style={styles.pinBox} collapsable={false}>
        {showPhoto ? (
          <View style={[styles.photoSquare, { borderColor: ring }]} collapsable={false}>
            <Image source={{ uri: m.photo }} style={styles.photoImg} resizeMode="cover" fadeDuration={0} />
          </View>
        ) : m.icon ? (
          <View style={styles.emojiWrap} collapsable={false}>
            <Ionicons name={m.icon as keyof typeof Ionicons.glyphMap} size={16} color={m.color} />
          </View>
        ) : (
          <View style={[styles.numWrap, { backgroundColor: ring }]} collapsable={false}>
            <Text style={styles.numText}>{m.label ?? "•"}</Text>
          </View>
        )}
      </View>

      {!!m.popup && (
        <Callout tooltip onPress={onOpen}>
          <View style={styles.callout}>
            {!!m.photo && <Image source={{ uri: m.photo }} style={styles.calloutPhoto} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.calloutTitle} numberOfLines={2}>{m.popup}</Text>
              <Text style={styles.calloutHint}>Detayı gör ›</Text>
            </View>
          </View>
        </Callout>
      )}
    </Marker>
  );
}

export default function OSMMap({
  markers = [], polylines = [], transitLines = [], onPressItem, onSelectItem, onMapPress,
  focusId, userLocation, followLocation, followHeading, guideLine, trackLine, navSegments, showRecenter, homeRegion, padding = 40,
  overlayInsetBottom = 0, style,
}: Props) {
  const ref = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const { colors, mode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Android'de TÜM marker'lar için üretilen bitmap ikonlar (imza → file uri; "" = üretilemedi)
  const [iconUris, setIconUris] = useState<Record<string, string>>({});
  const saveIcon = useCallback((sig: string, uri: string) => {
    setIconUris((prev) => ({ ...prev, [sig]: uri }));
  }, []);
  const pendingIcons = BITMAP_MARKERS
    ? markers.filter((m) => iconUris[iconSig(m, mode)] === undefined)
    : [];

  // Tek rota (detay) → her zaman tam kalite. Çok rota (genel bakış) → YALNIZ seçili
  // rotanın çizgisi çizilir; diğerleri sadece pin/küme olarak görünür.
  // (K1'de denenen "tüm rotalara soluk bağlam çizgisi" cihazda görsel kirlilik yaptı
  // — 13 çizgi haritayı karalamaya çeviriyor; geri alındı, kümeleme yeterli bağlam.)
  const visibleLines = useMemo(
    () => (polylines.length <= 1 ? polylines : polylines.filter((p) => p.id === focusId)),
    [polylines, focusId],
  );

  const allCoords = useMemo(() => {
    const c: { latitude: number; longitude: number }[] = [];
    visibleLines.forEach((p) => p.coords.forEach((x) => c.push(ll(x))));
    markers.forEach((m) => c.push({ latitude: m.lat, longitude: m.lng }));
    return c;
  }, [visibleLines, markers]);

  const fitAll = () => {
    if (allCoords.length >= 2) {
      ref.current?.fitToCoordinates(allCoords, {
        edgePadding: { top: padding, right: padding, bottom: padding + overlayInsetBottom, left: padding },
        animated: true,
      });
    } else if (allCoords.length === 1) {
      ref.current?.animateToRegion({ ...allCoords[0], latitudeDelta: 0.02, longitudeDelta: 0.02 }, 300);
    } else if (homeRegion) {
      // Şehirde hiç rota yok → şehir merkezine git (Berlin seçildi ama havuz boş vakası)
      ref.current?.animateToRegion(homeRegion, 400);
    }
  };

  // Marker sayısı YA DA şehir bölgesi değişince genel bakışa sığdır — ama bir rota
  // ODAKTAYKEN karışma (odaklı rotanın durakları eklenince kamera kaçmasın)
  useEffect(() => { if (ready && !focusId) fitAll(); /* eslint-disable-next-line */ },
    [ready, markers.length, homeRegion?.latitude, homeRegion?.longitude]);

  // Odak değişimi: seçili rotaya uç (alt overlay'in ÜSTÜNE sığdır); seçim kalkınca genel bakışa dön
  const prevFocus = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!ready) return;
    const p = polylines.find((x) => x.id === focusId);
    if (p && p.coords.length) {
      ref.current?.fitToCoordinates(p.coords.map(ll), {
        edgePadding: { top: 70, right: 60, bottom: 70 + overlayInsetBottom, left: 60 },
        animated: true,
      });
    } else if (!focusId && prevFocus.current) {
      fitAll(); // seçim temizlendi → tüm rotalara genel bakış
    }
    prevFocus.current = focusId;
  }, [focusId, ready]); // eslint-disable-line

  // Yolculuk modu: navigasyon kamerası — konumu takip eder, hareket yönüne döner (GMaps hissi)
  useEffect(() => {
    if (!ready || !followLocation) return;
    ref.current?.animateCamera(
      {
        center: { latitude: followLocation.lat, longitude: followLocation.lng },
        zoom: 17,
        ...(followHeading != null && followHeading >= 0 ? { heading: followHeading } : {}),
      },
      { duration: 600 },
    );
  }, [followLocation, followHeading, ready]); // eslint-disable-line

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        customMapStyle={mode === "dark" ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
        initialRegion={ISTANBUL}
        onMapReady={() => setReady(true)}
        onPress={(e) => { const c = e.nativeEvent.coordinate; onMapPress?.(c.latitude, c.longitude); }}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
      >
        {transitLines.map((t, i) => (
          <Polyline key={`t${i}`} coordinates={t.coords.map(ll)} strokeColor={t.color} strokeWidth={3} lineDashPattern={t.dashed ? [4, 8] : undefined} />
        ))}

        {/* Çizgiler: beyaz kenar (casing) YALNIZ gerçek sokak geometrisinde; kuş uçuşu
            tahmin (approx) ince+kesikli+soluk çizilir — asla gerçek yol gibi görünmez */}
        {visibleLines.flatMap((line) => {
          const pts = line.coords.map(ll);
          if (pts.length < 2) return [];
          const out: ReactNode[] = [];
          if (line.segments && line.segments.length) {
            // Bacak bazlı geometri: gerçek yürüme = casing + rota rengi; transit = kesikli
            // kırmızı; approx (geometri yok) = ince kesikli soluk tahmin çizgisi
            line.segments.forEach((seg, idx) => {
              if (seg.coords.length < 2) return;
              const segPts = seg.coords.map(ll);
              const transit = TRANSIT.has((seg.mode ?? "").toLowerCase());
              if (seg.approx && !transit) {
                out.push(
                  <Polyline key={`${line.id}-seg${idx}`} coordinates={segPts}
                    strokeColor={line.color} strokeWidth={2.5} lineDashPattern={[6, 8]}
                    lineCap="round" lineJoin="round" tappable onPress={() => onPressItem?.(line.id)} />,
                );
                return;
              }
              if (!transit) {
                out.push(
                  <Polyline key={`${line.id}-seg${idx}c`} coordinates={segPts}
                    strokeColor="rgba(255,255,255,0.95)" strokeWidth={9} lineCap="round" lineJoin="round" />,
                );
              }
              out.push(
                <Polyline key={`${line.id}-seg${idx}`} coordinates={segPts}
                  strokeColor={transit ? "#F87171" : line.color} strokeWidth={transit ? 6 : 5}
                  lineDashPattern={transit ? [10, 10] : undefined}
                  lineCap="round" lineJoin="round" tappable onPress={() => onPressItem?.(line.id)} />,
              );
            });
          } else if (line.modes && line.modes.length === pts.length) {
            out.push(
              <Polyline key={`${line.id}-casing`} coordinates={pts} strokeColor="rgba(255,255,255,0.95)" strokeWidth={9} lineCap="round" lineJoin="round" />,
            );
            pts.slice(1).forEach((_, idx) => {
              const i = idx + 1;
              const transit = TRANSIT.has(line.modes![i]);
              out.push(
                <Polyline key={`${line.id}-${i}`} coordinates={[pts[i - 1], pts[i]]}
                  strokeColor={transit ? "#DC2626" : line.color} strokeWidth={transit ? 6 : 5}
                  lineCap="round" lineJoin="round" tappable onPress={() => onPressItem?.(line.id)} />,
              );
            });
          } else {
            out.push(
              <Polyline key={`${line.id}-casing2`} coordinates={pts} strokeColor="rgba(255,255,255,0.95)" strokeWidth={9} lineCap="round" lineJoin="round" />,
              <Polyline key={`${line.id}-line`} coordinates={pts} strokeColor={line.color} strokeWidth={5}
                lineCap="round" lineJoin="round" tappable onPress={() => onPressItem?.(line.id)} />,
            );
          }
          return out;
        })}

        {/* Yolculuk rehber çizgisi: >2 nokta = gerçek sokak rotası (GMaps mavisi, dolgun);
            2 nokta = servis yoksa düz kesikli yedek */}
        {guideLine && guideLine.length > 2 && (
          <>
            <Polyline coordinates={guideLine.map(ll)} strokeColor="rgba(255,255,255,0.9)"
              strokeWidth={9} lineCap="round" lineJoin="round" zIndex={4} />
            <Polyline coordinates={guideLine.map(ll)} strokeColor="#2E86FF"
              strokeWidth={6} lineCap="round" lineJoin="round" zIndex={5} />
          </>
        )}
        {guideLine && guideLine.length === 2 && (
          <Polyline
            coordinates={guideLine.map(ll)}
            strokeColor="#60A5FA"
            strokeWidth={4}
            lineDashPattern={[8, 8]}
            lineCap="round"
            zIndex={5}
          />
        )}

        {/* 4.0b transit navigasyonu: yürüme noktalı mavi, hatlar kendi renginde (beyaz zarflı) */}
        {navSegments?.map((s, i) => {
          if (s.coords.length < 2) return null;
          const pts = s.coords.map(ll);
          if (s.kind === "walk") {
            return (
              <Polyline
                key={`ns${i}`} coordinates={pts} strokeColor="#8AB4F8" strokeWidth={5}
                lineDashPattern={[1, 12]} lineCap="round" zIndex={5}
              />
            );
          }
          return (
            <Fragment key={`ns${i}`}>
              <Polyline coordinates={pts} strokeColor="rgba(255,255,255,0.95)" strokeWidth={9} lineCap="round" lineJoin="round" zIndex={4} />
              <Polyline coordinates={pts} strokeColor={s.color || "#1A73E8"} strokeWidth={6} lineCap="round" lineJoin="round" zIndex={5} />
              {/* Biniş/iniş durakları: hat renginde halkalı beyaz nokta (GMaps stili).
                  tracksViewChanges AÇIK — kapalıyken çeyrek-render bug'ı bunları da yarım dondurur */}
              <Marker coordinate={pts[0]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges zIndex={7}>
                <View style={[styles.stopDot, { borderColor: s.color || "#1A73E8" }]} />
              </Marker>
              <Marker coordinate={pts[pts.length - 1]} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges zIndex={7}>
                <View style={[styles.stopDot, { borderColor: s.color || "#1A73E8" }]} />
              </Marker>
            </Fragment>
          );
        })}

        {/* Yürünen gerçek iz (4.2) — planlanan çizginin üstünde ince turkuaz */}
        {trackLine && trackLine.length >= 2 && (
          <Polyline
            coordinates={trackLine.map(ll)}
            strokeColor="rgba(45,212,191,0.9)"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
            zIndex={6}
          />
        )}

        {markers.map((m) => (
          <MapPin
            key={m.id} m={m} styles={styles} iconUri={iconUris[iconSig(m, mode)]}
            onSelect={() => onSelectItem?.(m.id)} onOpen={() => onPressItem?.(m.id)}
          />
        ))}

        {/* CANLI konum: tracksViewChanges AÇIK — kapalıyken Android çeyrek-render bug'ı
            mavi noktayı boş/yarım donduruyordu ("haritada konumum yok" vakası) */}
        {userLocation && (
          <Marker
            coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges
            zIndex={10}
          >
            <View style={styles.udotRing}><View style={styles.udot} /></View>
          </Marker>
        )}
      </MapView>

      {showRecenter && (
        <TouchableOpacity style={styles.recenter} activeOpacity={0.85} onPress={fitAll}>
          <Text style={styles.recenterIcon}>◎</Text>
        </TouchableOpacity>
      )}

      {/* Ekran dışı ikon fabrikası: marker'ları bir kez bitmap'e çevirir (Android — tüm varyantlar) */}
      {pendingIcons.length > 0 && (
        <View style={styles.iconFactory} pointerEvents="none">
          {pendingIcons.map((m) => {
            const sig = iconSig(m, mode);
            return <MarkerIconRenderer key={sig} m={m} styles={styles} sig={sig} onDone={saveIcon} />;
          })}
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, overflow: "hidden", backgroundColor: colors.bg },

  // Sabit marker kutusu: hangi varyant çizilirse çizilsin snapshot boyutu değişmez
  pinBox: { width: PIN, height: PIN, alignItems: "center", justifyContent: "center" },
  photoSquare: {
    width: PIN, height: PIN, borderRadius: 16, borderWidth: 3, overflow: "hidden", backgroundColor: "#fff",
  },
  photoImg: { width: PIN - 6, height: PIN - 6 },
  // Bitmap üretimi için ekran dışı alan (görünmez ama LAYOUT ALIR — view-shot şartı)
  iconFactory: { position: "absolute", left: -1000, top: 0 },

  callout: { flexDirection: "row", alignItems: "center", gap: 10, width: 210, padding: 8, backgroundColor: colors.surface, borderRadius: 12 },
  calloutPhoto: { width: 46, height: 46, borderRadius: 9, backgroundColor: colors.surfaceAlt },
  calloutTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  calloutHint: { fontSize: 12, fontWeight: "600", color: colors.primaryDark, marginTop: 2 },
  emojiWrap: {
    width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border,
  },
  numWrap: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff",
  },
  numText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  udotRing: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(37,99,235,0.22)", alignItems: "center", justifyContent: "center" },
  udot: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#1A73E8", borderWidth: 3, borderColor: "#fff" },
  stopDot: { width: 15, height: 15, borderRadius: 7.5, backgroundColor: "#fff", borderWidth: 3.5 },

  recenter: {
    position: "absolute", right: 12, bottom: 12, width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  recenterIcon: { fontSize: 22, color: colors.text },
});
