import { supabase } from "./supabase";

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(cevir(error.message));
}

/** Kayıt ol. E-posta onayı kapalıysa oturum döner (loggedIn=true). */
export async function signUp(email: string, password: string): Promise<{ loggedIn: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(cevir(error.message));
  return { loggedIn: !!data.session };
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** Oturum açılınca profilin var olduğundan emin ol (yoksa oluştur). */
export async function ensureProfile(userId: string, email: string) {
  const { data } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (data) return;
  const base = (email.split("@")[0] || "kullanici").replace(/[^a-z0-9_]/gi, "").toLowerCase() || "kullanici";
  const username = `${base}_${Math.floor(Math.random() * 9000 + 1000)}`;
  await supabase.from("profiles").insert({ id: userId, username, home_city: "Istanbul" });
}

function cevir(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-posta veya şifre hatalı.";
  if (m.includes("already registered")) return "Bu e-posta zaten kayıtlı. Giriş yap.";
  if (m.includes("password") && m.includes("6")) return "Şifre en az 6 karakter olmalı.";
  if (m.includes("email") && m.includes("valid")) return "Geçerli bir e-posta gir.";
  return msg;
}
