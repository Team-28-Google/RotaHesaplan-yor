import {
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
  Inter_700Bold, Inter_800ExtraBold, Inter_900Black, useFonts,
} from "@expo-google-fonts/inter";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { Session } from "@supabase/supabase-js";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AUTH_ENABLED, DEV_EMAIL, DEV_PASSWORD } from "./src/lib/config";
import { ensureProfile, signIn } from "./src/lib/auth";
import { supabase } from "./src/lib/supabase";
import { colors, font } from "./src/lib/theme";
import type { RootStackParamList, TabParamList } from "./src/navigation";
import AuthScreen from "./src/screens/AuthScreen";
import CreateRouteScreen from "./src/screens/CreateRouteScreen";
import HomeScreen from "./src/screens/HomeScreen";
import MapScreen from "./src/screens/MapScreen";
import PlanScreen from "./src/screens/PlanScreen";
import RouteFloodScreen from "./src/screens/RouteFloodScreen";
import SavedScreen from "./src/screens/SavedScreen";

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function tabIcon(emoji: string) {
  return ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 60, paddingBottom: 8, paddingTop: 6 },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Akış", tabBarIcon: tabIcon("🏠") }} />
      <Tab.Screen name="Map" component={MapScreen} options={{ title: "Harita", tabBarIcon: tabIcon("🗺️") }} />
      <Tab.Screen name="Plan" component={PlanScreen} options={{ title: "Planla", tabBarIcon: tabIcon("✨") }} />
      <Tab.Screen name="Saved" component={SavedScreen} options={{ title: "Kayıtlı", tabBarIcon: tabIcon("❤️") }} />
    </Tab.Navigator>
  );
}

function Loader() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold,
    Inter_700Bold, Inter_800ExtraBold, Inter_900Black,
  });
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    (async () => {
      let { data } = await supabase.auth.getSession();
      if (!data.session && !AUTH_ENABLED) {
        try { await signIn(DEV_EMAIL, DEV_PASSWORD); } catch { /* yoksay */ }
        data = (await supabase.auth.getSession()).data;
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

  if (!fontsLoaded || !authReady) return <Loader />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!session && AUTH_ENABLED ? (
        <AuthScreen />
      ) : (
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="Tabs" component={Tabs} />
            <Stack.Screen name="RouteFlood" component={RouteFloodScreen} />
            <Stack.Screen name="CreateRoute" component={CreateRouteScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      )}
    </SafeAreaProvider>
  );
}
