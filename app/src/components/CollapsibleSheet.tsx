import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, useRef, useState } from "react";
import {
  Animated, PanResponder, StyleSheet, Text, TouchableOpacity, View,
  type StyleProp, type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tap } from "../lib/haptics";
import { font, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";

const PEEK = 70; // kapalıyken görünen kısım: tutamak + etiket (büyük tut → yukarı çekmesi kolay)

export type SheetState = "full" | "mid" | "peek";

/** Harita üstü paneller (4.0a).
 *  2-konum (varsayılan): açık ↔ peek — sürükle/dokun.
 *  3-konum (midHeight + fullHeight verilirse): full ↔ mid ↔ peek —
 *    ortadan YUKARI çek → tam ekran, AŞAĞI çek → küçül. */
export default function CollapsibleSheet({
  children, peekLabel, style, onToggle, midHeight, fullHeight, onSnap,
}: {
  children: React.ReactNode;
  peekLabel: string;
  style?: StyleProp<ViewStyle>;
  onToggle?: (collapsed: boolean) => void;
  midHeight?: number;   // 3-konum: dinlenme (varsayılan) görünür yükseklik
  fullHeight?: number;  // 3-konum: tam açık yükseklik
  onSnap?: (state: SheetState) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const insetRef = useRef(0);
  insetRef.current = insets.bottom;

  const three = midHeight != null && fullHeight != null;
  const lastIdx = three ? 2 : 1;              // peek her zaman son index
  const [idx, setIdx] = useState(three ? 1 : 0); // 3-konum: mid'de başla; 2-konum: açık
  const idxRef = useRef(idx);
  // Başlangıç: 3-konumda MID (fullHeight-midHeight; inset gerekmez → tek-kare sıçrama yok)
  const y = useRef(new Animated.Value(three ? fullHeight! - midHeight! : 0)).current;
  const hRef = useRef(three ? fullHeight! : 0); // toplam sheet yüksekliği
  if (three) hRef.current = fullHeight!;

  // translateY hedefleri (index 0 = en açık): 3-konum [full, mid, peek] / 2-konum [açık, peek]
  const snapsY = (): number[] => {
    const H = hRef.current;
    const peekY = Math.max(H - PEEK - insetRef.current, 0);
    return three ? [0, H - midHeight!, peekY] : [0, peekY];
  };
  const stateName = (i: number): SheetState =>
    three ? (["full", "mid", "peek"] as const)[i] : (i === 0 ? "mid" : "peek");

  const snapTo = (i: number) => {
    idxRef.current = i;
    setIdx(i);
    onToggle?.(i === lastIdx);
    onSnap?.(stateName(i));
    Animated.spring(y, { toValue: snapsY()[i], speed: 16, bounciness: 5, useNativeDriver: true }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => {
        const arr = snapsY();
        const base = arr[idxRef.current];
        y.setValue(Math.min(Math.max(base + g.dy, 0), arr[arr.length - 1]));
      },
      onPanResponderRelease: (_, g) => {
        tap();
        const up = g.dy < -24 || g.vy < -0.2;     // yukarı çek → bir kademe aç (kolay eşik)
        const down = g.dy > 44 || g.vy > 0.25;    // aşağı çek → bir kademe kapat
        let ni = idxRef.current;
        if (up) ni = Math.max(0, idxRef.current - 1);
        else if (down) ni = Math.min(lastIdx, idxRef.current + 1);
        snapTo(ni);
      },
    }),
  ).current;

  // Dokun: peek'teyse aç (mid), değilse peek'e indir
  const onTap = () => snapTo(idxRef.current === lastIdx ? (three ? 1 : 0) : lastIdx);

  const collapsed = idx === lastIdx;

  // 3-konum + tam-açık DEĞİLKEN panelin HER YERİ sürüklenebilir (GMaps hissi) —
  // içerik scroll'u zaten yalnız tam-açıkken aktif, çakışma olmaz. Dokunuşlar
  // etkilenmez (responder yalnız |dy|>6 harekette devreye girer).
  const bodyPan = three && idx !== 0 ? pan.panHandlers : {};

  return (
    <Animated.View
      {...bodyPan}
      style={[style, three ? { height: fullHeight } : null, { transform: [{ translateY: y }] }]}
      onLayout={(e) => {
        if (!three) {
          hRef.current = e.nativeEvent.layout.height;
          if (idxRef.current === lastIdx) y.setValue(snapsY()[lastIdx]); // yükseklik değişse de hizada kal
        }
      }}
    >
      <View {...pan.panHandlers}>
        <TouchableOpacity activeOpacity={0.85} onPress={onTap} style={styles.grab}>
          <View style={styles.handle} />
          {collapsed && (
            <View style={styles.peekRow}>
              <Ionicons name="chevron-up" size={15} color={colors.primaryDark} />
              <Text style={styles.peekText} numberOfLines={1}>{peekLabel}</Text>
              <Ionicons name="chevron-up" size={15} color={colors.primaryDark} />
            </View>
          )}
        </TouchableOpacity>
      </View>
      {children}
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  grab: { paddingTop: 11, paddingBottom: 12, paddingHorizontal: 20, alignItems: "center" },
  handle: { width: 46, height: 5, borderRadius: 3, backgroundColor: colors.border },
  peekRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
    backgroundColor: colors.primarySoft, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1, borderColor: colors.border, ...shadow(6),
  },
  peekText: { color: colors.primaryDark, fontFamily: font.semibold, fontSize: 12, maxWidth: 180 },
});
