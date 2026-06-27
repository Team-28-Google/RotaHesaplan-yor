import { Platform, type ViewStyle } from "react-native";

export const colors = {
  bg: "#F4F6F9",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F5F9",
  text: "#0F172A",
  textMuted: "#64748B",
  textFaint: "#94A3B8",
  border: "#E8EDF3",
  primary: "#0EA5A4",
  primaryDark: "#0E7490",
  accent: "#F97316",
  utility: "#94A3B8",
  white: "#FFFFFF",
};

// Rota başına canlı, ayırt edici renkler
export const ROUTE_COLORS = [
  "#0EA5A4", "#6366F1", "#EC4899", "#F59E0B",
  "#10B981", "#EF4444", "#3B82F6", "#8B5CF6",
];

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
        shadowColor: "#0F172A",
        shadowOpacity: 0.14,
        shadowRadius: level,
        shadowOffset: { width: 0, height: Math.round(level / 2) },
      },
      android: { elevation: level },
      default: {},
    }) ?? {}
  );
}
