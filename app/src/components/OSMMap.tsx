import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from "react-native";
import MapView, { Callout, Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

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
  showRecenter?: boolean;
  padding?: number;
  style?: StyleProp<ViewStyle>;
};

const ISTANBUL = { latitude: 41.02, longitude: 28.99, latitudeDelta: 0.3, longitudeDelta: 0.3 };
const TRANSIT = new Set(["ferry", "metro", "tram", "marmaray", "bus", "metrobus", "funicular", "teleferik", "minibus"]);
const ll = (c: LatLng) => ({ latitude: c.lat, longitude: c.lng });
const ringOf = (v?: string) => (v === "start" ? "#16A34A" : v === "end" ? "#F97316" : "#0EA5A4");

// Temiz, premium harita stili (POI kalabalığı kapalı, yumuşak renkler)
const MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#e6f3ea" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe7f3" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f5f6f8" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#ffe8c7" }] },
];

function MapPin({ m, onSelect, onOpen }: { m: OSMMarker; onSelect: () => void; onOpen: () => void }) {
  const ring = ringOf(m.variant);

  return (
    <Marker
      coordinate={{ latitude: m.lat, longitude: m.lng }}
      onPress={onSelect}
      onCalloutPress={onOpen}
      anchor={{ x: 0.5, y: 0.5 }}
      calloutAnchor={{ x: 0.5, y: 0 }}
      tracksViewChanges
    >
      <View collapsable={false}>
        {m.photo ? (
          <View style={[styles.photoSquare, { borderColor: ring }]} collapsable={false}>
            <Image source={{ uri: m.photo }} style={styles.photoImg} resizeMode="cover" />
          </View>
        ) : m.emoji ? (
          <View style={styles.emojiWrap} collapsable={false}><Text style={{ fontSize: 16 }}>{m.emoji}</Text></View>
        ) : (
          <View style={[styles.numWrap, { backgroundColor: ring }]} collapsable={false}><Text style={styles.numText}>{m.label ?? ""}</Text></View>
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
  focusId, userLocation, followLocation, showRecenter, padding = 40, style,
}: Props) {
  const ref = useRef<MapView>(null);
  const [ready, setReady] = useState(false);

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

        {markers.map((m) => (
          <MapPin key={m.id} m={m} onSelect={() => onSelectItem?.(m.id)} onOpen={() => onPressItem?.(m.id)} />
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

const PHOTO = 56;
const styles = StyleSheet.create({
  container: { flex: 1, overflow: "hidden", backgroundColor: "#E8EDF2" },

  balloon: { width: 46, height: 56, alignItems: "center", paddingTop: 3 },
  photoWrap: {
    width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2, borderWidth: 3, overflow: "hidden", backgroundColor: "#fff",
  },
  photo: { width: PHOTO - 6, height: PHOTO - 6 },
  photoSquare: {
    width: 66, height: 66, borderRadius: 16, borderWidth: 3, overflow: "hidden", backgroundColor: "#fff",
  },
  photoImg: { width: 60, height: 60 },
  badge: {
    position: "absolute", top: 0, right: 6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 11 },

  callout: { flexDirection: "row", alignItems: "center", gap: 10, width: 210, padding: 8, backgroundColor: "#fff", borderRadius: 12 },
  calloutPhoto: { width: 46, height: 46, borderRadius: 9, backgroundColor: "#eee" },
  calloutTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  calloutHint: { fontSize: 12, fontWeight: "600", color: "#0EA5A4", marginTop: 2 },
  pointer: {
    width: 0, height: 0, marginTop: -2,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 9,
    borderLeftColor: "transparent", borderRightColor: "transparent",
  },
  emojiWrap: {
    width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
    backgroundColor: "#fff", borderWidth: 2, borderColor: "#CBD5E1",
  },
  numWrap: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff",
  },
  numText: { color: "#fff", fontWeight: "800", fontSize: 14 },

  udotRing: { width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(37,99,235,0.25)", alignItems: "center", justifyContent: "center" },
  udot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#2563EB", borderWidth: 2.5, borderColor: "#fff" },

  recenter: {
    position: "absolute", right: 12, bottom: 12, width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    shadowColor: "#0F172A", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  recenterIcon: { fontSize: 22, color: "#0F172A" },
});
