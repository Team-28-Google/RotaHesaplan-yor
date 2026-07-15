import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { en, tr, type Dict } from "../locales";
import { setUiLang } from "./ui";

// Dil: cihaz dilinden başlar (tr değilse en), kullanıcı Profil'den değiştirir, kalıcı.
// Tema deseninin aynısı (themeContext) — sadece string sözlüğü.

export type Lang = "tr" | "en";
const STORAGE_KEY = "sana_lang";
const DICTS: Record<Lang, Dict | typeof en> = { tr, en };

/** Namespace'li anahtar → dizeye ("home.createRoute"); eksikse tr'ye düşer.
 *  Basit {{param}} enterpolasyonu destekler. */
function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const pick = (dict: unknown): string | undefined =>
    key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), dict) as string | undefined;
  let s = pick(DICTS[lang]);
  if (typeof s !== "string") s = pick(tr); // eksik çeviri → Türkçe yedek
  if (typeof s !== "string") return key;   // hiç yoksa anahtarı göster (fark edilir)
  if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{{${k}}}`, String(v));
  return s;
}

interface LocaleContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  lang: "tr",
  setLang: () => {},
  t: (k) => translate("tr", k),
});

function deviceLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === "tr" ? "tr" : "en";
  } catch {
    return "tr";
  }
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("tr");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => setLangState(v === "en" || v === "tr" ? v : deviceLang()))
      .catch(() => setLangState(deviceLang()));
  }, []);

  setUiLang(lang); // formatlama helper'larını (fmtDuration/transportLabel) senkronla

  const value = useMemo<LocaleContextValue>(() => {
    const setLang = (l: Lang) => {
      setLangState(l);
      AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
    };
    return { lang, setLang, t: (k, p) => translate(lang, k, p) };
  }, [lang]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
/** Kısa yol: sadece t gerekince. */
export const useT = () => useContext(LocaleContext).t;
