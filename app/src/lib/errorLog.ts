import * as Updates from "expo-updates";
import { Platform } from "react-native";

import { supabase } from "./supabase";

// Hafif hata kaydı (5.5-B, test aşaması): JS hataları Supabase client_errors'a düşer.
// Sentry DEĞİL — native modül Expo Go'da yok; tam Sentry store yayınında (6.1).
// İlkeler: logger ASLA app'i bozmaz (her şey yutulur), oturum başına kelepçe (spam
// döngüsü koruması), art arda aynı mesaj bir kez yazılır.

const MAX_PER_SESSION = 15;
let sent = 0;
let lastMsg = "";

/** Hata kaydet (fire-and-forget). context: ekran/akış adı ("plan", "journey"...). */
export function logError(e: unknown, context?: string, fatal = false): void {
  void (async () => {
    try {
      if (sent >= MAX_PER_SESSION) return;
      const err = e instanceof Error ? e : new Error(String(e));
      const message = `${context ? `[${context}] ` : ""}${err.message || "bilinmeyen hata"}`.slice(0, 500);
      if (message === lastMsg) return; // aynı hatayı arka arkaya basma
      lastMsg = message;
      sent++;
      let uid: string | null = null;
      try {
        uid = (await supabase.auth.getSession()).data.session?.user.id ?? null;
      } catch { /* oturum okunamadıysa anonim yaz */ }
      await supabase.from("client_errors").insert({
        user_id: uid,
        message,
        stack: (err.stack ?? "").slice(0, 4000) || null,
        screen: context ?? null,
        fatal,
        platform: `${Platform.OS} ${Platform.Version}`,
        app_version: Updates.updateId ?? "dev",
      });
    } catch { /* logger hatası sessizce yutulur */ }
  })();
}

type GlobalHandler = (e: Error, isFatal?: boolean) => void;
interface ErrorUtilsLike {
  getGlobalHandler?: () => GlobalHandler | undefined;
  setGlobalHandler?: (h: GlobalHandler) => void;
}

/** Uygulama açılışında BİR KEZ çağrılır: yakalanmamış JS hatalarını kayda bağlar.
 *  RN'in kendi handler'ı korunur (kırmızı ekran/davranış değişmez). */
export function initErrorLogging(): void {
  const eu = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!eu?.setGlobalHandler) return;
  const prev = eu.getGlobalHandler?.();
  eu.setGlobalHandler((e, isFatal) => {
    logError(e, "global", !!isFatal);
    prev?.(e, isFatal);
  });
}
