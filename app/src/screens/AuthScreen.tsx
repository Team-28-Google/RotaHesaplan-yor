import { LinearGradient } from "expo-linear-gradient";
import { useMemo, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { signIn, signUp } from "../lib/auth";
import { font, gradients, radius, shadow, type ThemeColors } from "../lib/theme";
import { useTheme } from "../lib/themeContext";

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn(email.trim(), pw);
      } else {
        const { loggedIn } = await signUp(email.trim(), pw);
        if (!loggedIn) {
          setInfo("Hesap oluşturuldu! E-postanı onayla, sonra giriş yap. (Demo için Supabase'de e-posta onayını kapatabilirsin.)");
          setMode("login");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
          <Text style={styles.logoText}>SANA</Text>
        </LinearGradient>
        <Text style={styles.tagline}>Şehirde yalnız değilsin.</Text>
        <Text style={styles.h2}>{mode === "login" ? "Tekrar hoş geldin" : "Aramıza katıl"}</Text>

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
        <TextInput
          style={styles.input}
          value={pw}
          onChangeText={setPw}
          placeholder="Şifre (en az 6 karakter)"
          placeholderTextColor={colors.textFaint}
          secureTextEntry
        />

        {error && <Text style={styles.error}>⚠️ {error}</Text>}
        {info && <Text style={styles.info}>✅ {info}</Text>}

        <TouchableOpacity
          style={[styles.btn, (loading || !email || !pw) && styles.btnDisabled]}
          onPress={submit}
          disabled={loading || !email || !pw}
          activeOpacity={0.9}
        >
          {loading ? <ActivityIndicator color="#fff" /> : (
            <Text style={styles.btnText}>{mode === "login" ? "Giriş yap" : "Kayıt ol"}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setInfo(null); }}
          style={{ marginTop: 18 }}
        >
          <Text style={styles.toggle}>
            {mode === "login" ? "Hesabın yok mu? Kayıt ol" : "Zaten üye misin? Giriş yap"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  logo: {
    alignSelf: "center", width: 76, height: 76,
    borderRadius: 22, alignItems: "center", justifyContent: "center", ...shadow(10),
  },
  logoText: { color: "#fff", fontFamily: font.black, fontSize: 22, letterSpacing: 1 },
  tagline: { textAlign: "center", color: colors.textMuted, marginTop: 14, fontFamily: font.medium, fontSize: 15 },
  h2: { textAlign: "center", color: colors.text, marginTop: 28, marginBottom: 18, fontFamily: font.extra, fontSize: 20 },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: colors.text, fontFamily: font.regular, borderWidth: 1, borderColor: colors.border, marginBottom: 12,
  },
  error: { color: colors.danger, fontFamily: font.medium, marginBottom: 6 },
  info: { color: colors.primaryDark, fontFamily: font.medium, marginBottom: 6 },
  btn: {
    backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: 16,
    alignItems: "center", justifyContent: "center", marginTop: 8, ...shadow(6),
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontFamily: font.extra, fontSize: 16 },
  toggle: { textAlign: "center", color: colors.primary, fontFamily: font.semibold, fontSize: 14 },
});
