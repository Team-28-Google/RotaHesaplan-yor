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

const PEEK = 58; // kapalıyken görünen kısım: tutamak + kompakt etiket (sistem tuşlarının üstünde durur)

/** Harita üstü panelleri AŞAĞI kaydırılıp kapatılabilir yapar (4.0a).
 *  Kapalıyken tutamak + etiket + yukarı ok görünür; sürükle ya da dokun. */
export default function CollapsibleSheet({ children, peekLabel, style, onToggle }: {
  children: React.ReactNode;
  peekLabel: string;
  style?: StyleProp<ViewStyle>;
  onToggle?: (collapsed: boolean) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [collapsed, setCollapsed] = useState(false);
  const y = useRef(new Animated.Value(0)).current;
  const hRef = useRef(0);
  const colRef = useRef(false);
  // Kapalı pozisyon SİSTEM TUŞLARININ ÜSTÜNDE kalsın (Android gezinme çubuğu çakışması)
  const insetRef = useRef(0);
  insetRef.current = insets.bottom;
  const maxY = () => Math.max(hRef.current - PEEK - insetRef.current, 0);

  const snap = (to: boolean) => {
    colRef.current = to;
    setCollapsed(to);
    onToggle?.(to);
    Animated.spring(y, {
      toValue: to ? maxY() : 0,
      speed: 16, bounciness: 5, useNativeDriver: true,
    }).start();
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => {
        const base = colRef.current ? maxY() : 0;
        y.setValue(Math.min(Math.max(base + g.dy, 0), maxY()));
      },
      onPanResponderRelease: (_, g) => {
        tap();
        if (colRef.current) snap(!(g.dy < -40 || g.vy < -0.3)); // yukarı it → aç
        else snap(g.dy > 60 || g.vy > 0.3);                     // aşağı it → kapat
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[style, { transform: [{ translateY: y }] }]}
      onLayout={(e) => {
        hRef.current = e.nativeEvent.layout.height;
        if (colRef.current) y.setValue(maxY()); // yükseklik değişse de hizada kal
      }}
    >
      <View {...pan.panHandlers}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => snap(!colRef.current)} style={styles.grab}>
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
  grab: { paddingTop: 9, paddingBottom: 4, alignItems: "center" },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.border },
  peekRow: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6,
    backgroundColor: colors.surface, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border, ...shadow(6),
  },
  peekText: { color: colors.text, fontFamily: font.semibold, fontSize: 11.5, maxWidth: 140 },
});
