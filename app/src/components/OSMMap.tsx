import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import MapView, { Callout, Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

import type { ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";

export type LatLng = { lat: number; lng: number };
export type OSMMarker = {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label?: string;
  photo?: string;            // varsa fotoğraflı baloncuk
  emoji?: string;            // amenity (WC/çeşme)
  variant?: "start" | "end" | "stop";
  popup?: string;
};
export type OSMPolyline = {
  id: string;
  color: string;
  coords: LatLng[];
  modes?: string[];          // modes[i] = coords[i]'ye ulaşım türü (transit ise kırmızı)
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
  guideLine?: LatLng[] | null;      // konum → hedef durak kesikli rehber çizgisi (yolculuk)
  showRecenter?: boolean;
  padding?: number;
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

function MapPin({ m, onSelect, onOpen, styles }: { m: OSMMarker; onSelect: () => void; onOpen: () => void; styles: MapStyles }) {
  const ring = ringOf(m.variant);
  // "ÇEYREK MARKER" FIX (Android/Expo Go): foto ağdan gelirken marker bitmap'i erken/yanlış
  // boyutta çekiliyor. Strateji:
  //  1) Foto önce Image.prefetch ile cache'e indirilir; o sırada numaralı pin gösterilir.
  //  2) Hazır olunca Marker `key` değişimiyle YENİDEN MOUNT edilir → bitmap doğru boyutta oluşur.
  //  3) fadeDuration=0 → Android'in fade animasyonu ortasında snapshot alınmaz.
  //  4) Tüm varyantlar sabit boyutlu kutuda çizilir → snapshot boyutu hiç değişmez.
  const [photoReady, setPhotoReady] = useState(false);
  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    if (!m.photo) return;
    let alive = true;
    Image.prefetch(m.photo)
      .then(() => { if (alive) { setPhotoReady(true); setTracks(true); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [m.photo]);

  // Geçişten kısa süre sonra snapshot'ı dondur (pil/performans)
  useEffect(() => {
    if (!tracks) return;
    const t = setTimeout(() => setTracks(false), 700);
    return () => clearTimeout(t);
  }, [tracks]);

  const showPhoto = !!m.photo && photoReady;

  return (
    <Marker
      key={showPhoto ? "photo" : "plain"}
      coordinate={{ latitude: m.lat, longitude: m.lng }}
      onPress={onSelect}
      onCalloutPress={onOpen}
      anchor={{ x: 0.5, y: 0.5 }}
      calloutAnchor={{ x: 0.5, y: 0 }}
      tracksViewChanges={tracks}
    >
      <View style={styles.pinBox} collapsable={false}>
        {showPhoto ? (
          <View style={[styles.photoSquare, { borderColor: ring }]} collapsable={false}>
            <Image source={{ uri: m.photo }} style={styles.photoImg} resizeMode="cover" fadeDuration={0} />
          </View>
        ) : m.emoji ? (
          <View style={styles.emojiWrap} collapsable={false}><Text style={{ fontSize: 16 }}>{m.emoji}</Text></View>
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
  focusId, userLocation, followLocation, guideLine, showRecenter, padding = 40, style,
}: Props) {
  const ref = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const { colors, mode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Tek rota (detay) → her zaman çiz. Çok rota (overview) → sadece seçili (tıklanan) görünür.
  const visibleLines = useMemo(
    () => (polylines.length <= 1 ? polylines : focusId ? polylines.filter((p) => p.id === focusId) : []),
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
      ref.current?.fitToCoordinates(allCoords, { edgePadding: { top: padding, right: padding, bottom: padding, left: padding }, animated: true });
    } else if (allCoords.length === 1) {
      ref.current?.animateToRegion({ ...allCoords[0], latitudeDelta: 0.02, longitudeDelta: 0.02 }, 300);
    }
  };

  useEffect(() => { if (ready) fitAll(); /* eslint-disable-next-line */ }, [ready, markers.length]);

  useEffect(() => {
    if (!ready) return;
    const p = polylines.find((x) => x.id === focusId);
    if (p && p.coords.length) {
      ref.current?.fitToCoordinates(p.coords.map(ll), { edgePadding: { top: 60, right: 60, bottom: 60, left: 60 }, animated: true });
    }
  }, [focusId, ready]); // eslint-disable-line

  // Yolculuk modu: kamera canlı konumu takip eder
  useEffect(() => {
    if (!ready || !followLocation) return;
    ref.current?.animateCamera(
      { center: { latitude: followLocation.lat, longitude: followLocation.lng }, zoom: 16.5 },
      { duration: 600 },
    );
  }, [followLocation, ready]); // eslint-disable-line

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

        {/* Çizgiler: beyaz kenar (casing) + renkli üst; transit ayağı kırmızı */}
        {visibleLines.flatMap((line) => {
          const pts = line.coords.map(ll);
          if (pts.length < 2) return [];
          const out: ReactNode[] = [
            <Polyline key={`${line.id}-casing`} coordinates={pts} strokeColor="rgba(255,255,255,0.95)" strokeWidth={9} lineCap="round" lineJoin="round" />,
          ];
          if (line.modes && line.modes.length === pts.length) {
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
              <Polyline key={`${line.id}-line`} coordinates={pts} strokeColor={line.color} strokeWidth={5}
                lineCap="round" lineJoin="round" tappable onPress={() => onPressItem?.(line.id)} />,
            );
          }
          return out;
        })}

        {/* Yolculuk rehber çizgisi: kullanıcı konumu → hedef durak (kesikli mavi) */}
        {guideLine && guideLine.length >= 2 && (
          <Polyline
            coordinates={guideLine.map(ll)}
            strokeColor="#60A5FA"
            strokeWidth={4}
            lineDashPattern={[8, 8]}
            lineCap="round"
            zIndex={5}
          />
        )}

        {markers.map((m) => (
          <MapPin key={m.id} m={m} styles={styles} onSelect={() => onSelectItem?.(m.id)} onOpen={() => onPressItem?.(m.id)} />
        ))}

        {userLocation && (
          <Marker coordinate={{ latitude: userLocation.lat, longitude: userLocation.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.udotRing}><View style={styles.udot} /></View>
          </Marker>
        )}
      </MapView>

      {showRecenter && (
        <TouchableOpacity style={styles.recenter} activeOpacity={0.85} onPress={fitAll}>
          <Text style={styles.recenterIcon}>◎</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, overflow: "hidden", backgroundColor: colors.bg },

  // Sabit marker kutusu: hangi varyant çizilirse çizilsin snapshot boyutu değişmez
  pinBox: { width: 66, height: 66, alignItems: "center", justifyContent: "center" },
  photoSquare: {
    width: 66, height: 66, borderRadius: 16, borderWidth: 3, overflow: "hidden", backgroundColor: "#fff",
  },
  photoImg: { width: 60, height: 60 },

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

  udotRing: { width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(37,99,235,0.25)", alignItems: "center", justifyContent: "center" },
  udot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#2563EB", borderWidth: 2.5, borderColor: "#fff" },

  recenter: {
    position: "absolute", right: 12, bottom: 12, width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  recenterIcon: { fontSize: 22, color: colors.text },
});
