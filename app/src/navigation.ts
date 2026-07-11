import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type TabParamList = {
  Home: undefined;
  Map: undefined;
  Plan: undefined;
  Saved: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  RouteFlood: { routeId: string; title: string; autoStart?: boolean };
  CreateRoute: undefined;
  Onboarding: undefined;
  Leaderboard: undefined;
  UserRoutes: { userId: string; username: string; avatarUrl?: string | null };
};

// Sekme ekranları hem sekmeler arası hem de kök stack'e (RouteFlood) gidebilir.
type TabProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type HomeScreenProps = TabProps<"Home">;
export type MapScreenProps = TabProps<"Map">;
export type PlanScreenProps = TabProps<"Plan">;
export type SavedScreenProps = TabProps<"Saved">;
export type ProfileScreenProps = TabProps<"Profile">;
export type RouteFloodScreenProps = NativeStackScreenProps<RootStackParamList, "RouteFlood">;
export type CreateRouteScreenProps = NativeStackScreenProps<RootStackParamList, "CreateRoute">;
export type OnboardingScreenProps = NativeStackScreenProps<RootStackParamList, "Onboarding">;
export type LeaderboardScreenProps = NativeStackScreenProps<RootStackParamList, "Leaderboard">;
export type UserRoutesScreenProps = NativeStackScreenProps<RootStackParamList, "UserRoutes">;
