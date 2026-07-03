import { Platform, type ViewStyle } from "react-native";

// İki tema: koyu ("gece şehri") varsayılan, açık tema tercihle.
// Marka rengi her iki modda da mercan. `primaryDark` = vurgu METNİ rengi
// (koyu modda açık mercan, açık modda koyu mercan — zeminle kontrast için).

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  accent: string;
  danger: string;
  utility: string;
  white: string;
  /** Rota başına ayırt edici çizgi/marker renkleri (harita zeminine göre ton) */
  routeColors: string[];
}

export const darkColors: ThemeColors = {
  bg: "#0B1022",
  surface: "#141B33",
  surfaceAlt: "#1D2647",
  text: "#F2F4FC",
  textMuted: "#A7AECB",
  textFaint: "#6C7597",
  border: "#263052",
  primary: "#F4503B",
  primaryDark: "#FF9F8B",
  primarySoft: "rgba(244,80,59,0.16)",
  accent: "#F5B26B",
  danger: "#FF7A6B",
  utility: "#6C7597",
  white: "#FFFFFF",
  routeColors: [
    "#FF6B54", "#2DD4BF", "#F472B6", "#FBBF24",
    "#34D399", "#60A5FA", "#A78BFA", "#F87171",
  ],
};

export const lightColors: ThemeColors = {
  bg: "#F6F7FB",
  surface: "#FFFFFF",
  surfaceAlt: "#EEF0F7",
  text: "#191C33",
  textMuted: "#5B6072",
  textFaint: "#8E93AC",
  border: "#E5E7F0",
  primary: "#E8452F",
  primaryDark: "#B93A20",
  primarySoft: "rgba(232,69,47,0.10)",
  accent: "#D97706",
  danger: "#DC2626",
  utility: "#8E93AC",
  white: "#FFFFFF",
  routeColors: [
    "#E8452F", "#0D9488", "#DB2777", "#D97706",
    "#059669", "#2563EB", "#7C3AED", "#DC2626",
  ],
};

// Marka gradyanı (logo, vurgulu butonlar) — her iki modda aynı
export const gradients = {
  brand: ["#F4503B", "#FF7E3E"] as const,
};

export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extra: "Inter_800ExtraBold",
  black: "Inter_900Black",
};

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export function shadow(level = 6): ViewStyle {
  return (
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: "#000000",
        shadowOpacity: 0.14,
        shadowRadius: level,
        shadowOffset: { width: 0, height: Math.round(level / 2) },
      },
      android: { elevation: level },
      default: {},
    }) ?? {}
  );
}
