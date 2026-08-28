import "@/lib/polyfills";

import { Slot } from "expo-router";
import { ActivityIndicator } from "react-native";
import { EnrollScreen } from "@/components/enroll-screen";
import { PendingApprovalScreen } from "@/components/pending-approval-screen";
import { ThemedView } from "@/components/themed-view";
import { AuthProvider, useAuth } from "@/lib/auth-context";

/**
 * The auth gate for the whole app. Not route-based (no (auth)/(app)
 * groups, no redirects) — deliberately simpler for this first slice:
 * every other route lives under <Slot/>, reached only once status is
 * 'authenticated'; everything before that renders directly here
 * instead of being a navigable route of its own, since "not yet
 * enrolled" and "waiting for approval" aren't places a driver should
 * be able to navigate back to once past them.
 */
function AppGate() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <ThemedView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </ThemedView>
    );
  }
  if (status === "needs-enroll") return <EnrollScreen />;
  if (status === "pending-approval") return <PendingApprovalScreen />;
  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}
