import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { saveProfileDetails, signIn, signUp } from "../lib/auth";
import { tap } from "../lib/haptics";
import { font, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";

const GENDERS = [
  { key: "kadin", label: "Kadın" },
  { key: "erkek", label: "Erkek" },
  { key: "belirtmedi", label: "Belirtmek istemem" },
] as const;

/** "05121999" → "05.12.1999" (yazarken otomatik noktalar) */
const formatBirth = (t: string) => {
  const d = t.replace(/\D/g, "").slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join(".");
};

/** GG.AA.YYYY → ISO (geçersizse null) */
const birthToIso = (t: string): string | null => {
  const m = t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const [, g, a, y] = m;
  const gi = +g, ai = +a, yi = +y;
  if (gi < 1 || gi > 31 || ai < 1 || ai > 12 || yi < 1900 || yi > new Date().getFullYear()) return null;
  return `${y}-${a}-${g}`;
};

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [birth, setBirth] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (m: "login" | "signup") => {
    tap();
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const submit = async () => {
    setError(null);
    setInfo(null);
    // Doğum tarihi girildiyse geçerli olmalı (boş = sorun değil, opsiyonel)
    const birthIso = birth ? birthToIso(birth) : null;
    if (mode === "signup" && birth && !birthIso) {
      setError("Doğum tarihi GG.AA.YYYY biçiminde olmalı (örn. 05.12.1999).");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email.trim(), pw);
      } else {
        const { loggedIn } = await signUp(email.trim(), pw);
        if (loggedIn) {
          await saveProfileDetails({ birth_date: birthIso, gender });
        } else {
          setInfo("Hesap oluşturuldu! E-postana gelen onay linkine tıkla, sonra giriş yap.");
          setMode("login");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!email.trim() && pw.length >= 6 && !loading;

  return (
    <View style={styles.container}>
      {/* Marka hero — tema-bağımsız koyu (paylaşım kartlarıyla aynı dil) */}
      <LinearGradient colors={["#1B2447", "#0B1022"]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1, justifyContent: "center", padding: 22,
            paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brand}>SANA</Text>
          </View>
          <Text style={styles.tagline}>Şehirde yalnız değilsin.</Text>

          <View style={styles.card}>
            {/* Giriş / Kayıt segmenti */}
            <View style={styles.segment}>
              {(["login", "signup"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.segmentBtn, mode === m && styles.segmentBtnOn]}
                  onPress={() => switchMode(m)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentText, mode === m && styles.segmentTextOn]}>
                    {m === "login" ? "Giriş yap" : "Kayıt ol"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.h2}>{mode === "login" ? "Tekrar hoş geldin" : "Aramıza katıl"}</Text>

            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={colors.textFaint} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="E-posta"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textFaint} />
              <TextInput
                style={styles.input}
                value={pw}
                onChangeText={setPw}
                placeholder="Şifre (en az 6 karakter)"
                placeholderTextColor={colors.textFaint}
                secureTextEntry={!showPw}
              />
              <TouchableOpacity onPress={() => setShowPw(!showPw)} hitSlop={8}>
                <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textFaint} />
              </TouchableOpacity>
            </View>

            {mode === "signup" && (
              <>
                <View style={styles.inputRow}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textFaint} />
                  <TextInput
                    style={styles.input}
                    value={birth}
                    onChangeText={(t) => setBirth(formatBirth(t))}
                    placeholder="Doğum tarihi — GG.AA.YYYY (opsiyonel)"
                    placeholderTextColor={colors.textFaint}
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>

                <Text style={styles.fieldLabel}>Cinsiyet <Text style={styles.fieldOpt}>(opsiyonel)</Text></Text>
                <View style={styles.genderRow}>
                  {GENDERS.map((g) => {
                    const on = gender === g.key;
                    return (
                      <TouchableOpacity
                        key={g.key}
                        style={[styles.genderChip, on && styles.genderChipOn]}
                        onPress={() => { tap(); setGender(on ? null : g.key); }}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.genderText, on && styles.genderTextOn]}>
                          {g.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {error && <Text style={styles.error}>{error}</Text>}
            {info && <Text style={styles.info}>✓ {info}</Text>}

            <TouchableOpacity
              style={[styles.btn, !canSubmit && styles.btnDisabled]}
              onPress={submit}
              disabled={!canSubmit}
              activeOpacity={0.9}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.btnText}>
                  {mode === "login" ? "Giriş yap" : "Keşfe başla →"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>Kaydolarak rotalarını toplulukla paylaşabilirsin</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  brandDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#F4503B" },
  brand: { color: "#F2F4FC", fontFamily: font.black, fontSize: 34, letterSpacing: 3 },
  tagline: { textAlign: "center", color: "#8A93B8", marginTop: 6, marginBottom: 24, fontFamily: font.medium, fontSize: 14.5 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20,
    borderWidth: 1, borderColor: colors.border, ...shadow(14),
  },
  segment: {
    flexDirection: "row", backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
    padding: 4, marginBottom: 16,
  },
  segmentBtn: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: radius.pill },
  segmentBtnOn: { backgroundColor: colors.primary },
  segmentText: { fontFamily: font.bold, fontSize: 13.5, color: colors.textMuted },
  segmentTextOn: { color: "#fff" },

  h2: { color: colors.text, marginBottom: 14, fontFamily: font.extra, fontSize: 19 },
  inputRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.surfaceAlt, borderRadius: radius.lg,
    paddingHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: colors.text, fontFamily: font.regular },

  fieldLabel: { color: colors.textMuted, fontFamily: font.bold, fontSize: 13, marginTop: 4, marginBottom: 8 },
  fieldOpt: { color: colors.textFaint, fontFamily: font.medium, fontSize: 12 },
  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  genderChip: {
    backgroundColor: colors.surfaceAlt, borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border,
  },
  genderChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  genderText: { fontSize: 13, color: colors.textMuted, fontFamily: font.semibold },
  genderTextOn: { color: "#fff", fontFamily: font.bold },

  error: { color: colors.danger, fontFamily: font.medium, marginTop: 4, marginBottom: 2 },
  info: { color: colors.primaryDark, fontFamily: font.medium, marginTop: 4, marginBottom: 2 },

  btn: {
    backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 15,
    alignItems: "center", justifyContent: "center", marginTop: 12, ...shadow(8),
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: "#fff", fontFamily: font.extra, fontSize: 16 },

  footer: { textAlign: "center", color: "#6C7597", marginTop: 18, fontFamily: font.medium, fontSize: 12.5 },
});
