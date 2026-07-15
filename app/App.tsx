import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  Inter_700Bold, Inter_800ExtraBold, Inter_900Black, useFonts,
} from "@expo-google-fonts/inter";
import Ionicons from "@expo/vector-icons/Ionicons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNavigationContainerRef, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Session } from "@supabase/supabase-js";
import * as ExpoLinking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { joinCollectionByToken, joinRouteByToken, syncOnboardingMemory } from "./src/lib/api";
import { AUTH_ENABLED, DEV_EMAIL, DEV_PASSWORD } from "./src/lib/config";
import { ensureProfile, signIn } from "./src/lib/auth";
import { getOnboarding, markOnboardingSynced } from "./src/lib/onboarding";
import { supabase } from "./src/lib/supabase";
import { font } from "./src/lib/theme";
import { LocaleProvider, useLocale } from "./src/lib/localeContext";
import { ThemeProvider, useTheme } from "./src/lib/themeContext";
import type { RootStackParamList, TabParamList } from "./src/navigation";
import AuthScreen from "./src/screens/AuthScreen";
import CreateRouteScreen from "./src/screens/CreateRouteScreen";
import HomeScreen from "./src/screens/HomeScreen";
import LeaderboardScreen from "./src/screens/LeaderboardScreen";
import UserRoutesScreen from "./src/screens/UserRoutesScreen";
import CollectionScreen from "./src/screens/CollectionScreen";
import MapScreen from "./src/screens/MapScreen";
import OnboardingScreen, { OnboardingFlow } from "./src/screens/OnboardingScreen";
import PlanScreen from "./src/screens/PlanScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import RouteFloodScreen from "./src/screens/RouteFloodScreen";
import SavedScreen from "./src/screens/SavedScreen";

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(outline: IconName, filled: IconName) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <Ionicons name={focused ? filled : outline} size={22} color={color} />
  );
}

function Tabs() {
  const { colors } = useTheme();
  const { t } = useLocale();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t("tabs.home"), tabBarIcon: tabIcon("home-outline", "home") }} />
      <Tab.Screen name="Map" component={MapScreen} options={{ title: t("tabs.map"), tabBarIcon: tabIcon("map-outline", "map") }} />
      <Tab.Screen name="Plan" component={PlanScreen} options={{ title: t("tabs.plan"), tabBarIcon: tabIcon("sparkles-outline", "sparkles") }} />
      <Tab.Screen name="Saved" component={SavedScreen} options={{ title: t("tabs.saved"), tabBarIcon: tabIcon("heart-outline", "heart") }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t("tabs.profile"), tabBarIcon: tabIcon("person-outline", "person") }} />
    </Tab.Navigator>
  );
}

function Loader() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

function Root() {
  const { colors, mode } = useTheme();
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
    Inter_700Bold, Inter_800ExtraBold, Inter_900Black,
  });
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    getOnboarding().then((p) => setOnboarded(!!p?.done));
  }, []);

  // Davet linkleri (3.7 rota / 3.10 koleksiyon): ?join= ya da ?joinc= yakalanır →
  // RPC ile üye ol → ilgili ekrana git. Oturum yoksa girişten sonra işlenir; token bir kez.
  const url = ExpoLinking.useURL();
  const handledJoin = useRef<string | null>(null);
  useEffect(() => {
    if (!url || !session) return;
    const q = ExpoLinking.parse(url).queryParams ?? {};
    const routeToken = typeof q.join === "string" ? q.join : null;
    const colToken = typeof q.joinc === "string" ? q.joinc : null;
    const token = routeToken ?? colToken;
    if (!token || handledJoin.current === token) return;
    handledJoin.current = token;

    const go = (nav: () => void, deneme = 0) => {
      if (navigationRef.isReady()) nav();
      else if (deneme < 5) setTimeout(() => go(nav, deneme + 1), 600);
    };
    if (routeToken) {
      joinRouteByToken(routeToken).then((routeId) => {
        if (routeId) go(() => navigationRef.navigate("RouteFlood", { routeId, title: "Ortak Rota" }));
      });
    } else if (colToken) {
      joinCollectionByToken(colToken).then((collectionId) => {
        if (collectionId) go(() => navigationRef.navigate("Collection", { collectionId, title: "Ortak Koleksiyon" }));
      });
    }
  }, [url, session]);

  // Tercihler AI hafızasına yazılamamışsa (servis kapalıydı vb.) açılışta tekrar dene
  useEffect(() => {
    if (!authReady) return;
    getOnboarding().then((p) => {
      if (p?.done && !p.synced) {
        syncOnboardingMemory(p.vibes, p.budget).then((ok) => { if (ok) markOnboardingSynced(); });
      }
    });
  }, [authReady]);

  useEffect(() => {
    (async () => {
      let { data } = await supabase.auth.getSession();
      if (!data.session && !AUTH_ENABLED) {
        try { await signIn(DEV_EMAIL, DEV_PASSWORD); } catch { /* yoksay */ }
        data = (await supabase.auth.getSession()).data;
      }
      // 5.1: auth açıldı — testçilerde kalan ORTAK dev oturumunu bir kez kapat ki
      // herkes kendi hesabını açsın (yoksa update sonrası da dev hesabında kalırlar)
      if (AUTH_ENABLED && DEV_EMAIL && data.session?.user?.email === DEV_EMAIL) {
        await supabase.auth.signOut();
        data = { session: null };
      }
      setSession(data.session);
      setAuthReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) ensureProfile(s.user.id, s.user.email ?? "").catch(() => {});
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!fontsLoaded || !authReady || onboarded === null) return <Loader />;

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      {!session && AUTH_ENABLED ? (
        <AuthScreen />
      ) : !onboarded ? (
        <OnboardingFlow onDone={() => setOnboarded(true)} />
      ) : (
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="RouteFlood" component={RouteFloodScreen} />
            <Stack.Screen name="CreateRoute" component={CreateRouteScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
            <Stack.Screen name="UserRoutes" component={UserRoutesScreen} />
            <Stack.Screen name="Collection" component={CollectionScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <ThemeProvider>
          <Root />
        </ThemeProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
