import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { darkColors, lightColors, type ThemeColors } from "./theme";

// Tema tercihi: varsayılan koyu; kullanıcı Profil'den değiştirir, AsyncStorage'da kalıcı.

export type ThemeMode = "dark" | "light";
const STORAGE_KEY = "sana_theme_mode";

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  colors: darkColors,
  setMode: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => { if (v === "light" || v === "dark") setModeState(v); })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const setMode = (m: ThemeMode) => {
      setModeState(m);
      AsyncStorage.setItem(STORAGE_KEY, m).catch(() => {});
    };
    return {
      mode,
      colors: mode === "dark" ? darkColors : lightColors,
      setMode,
      toggle: () => setMode(mode === "dark" ? "light" : "dark"),
    };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
