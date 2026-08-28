import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActiveTripView } from "@/components/active-trip-view";
import { StartTripView } from "@/components/start-trip-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { getMyActiveTrip, TripSummary } from "@/lib/trips";

/**
 * Reached only once status === 'authenticated' (see _layout.tsx's
 * AppGate) — a real Fleetly Auth session backs this. Inline
 * conditional rendering rather than separate routes for
 * loading/start/active, same reasoning as the auth gate itself: this
 * is really one state machine (no active trip -> starting -> active),
 * not distinct places a driver should navigate between freely.
 *
 * refreshKey (bumped from event handlers, i.e. onStarted/onEnded — not
 * from inside the effect) is what triggers a re-fetch; the effect
 * itself never calls setState synchronously as its first action, only
 * from the async fetch's resolution — react-hooks/set-state-in-effect
 * (React Compiler's linting) flags the more obvious "reset to loading,
 * then fetch" shape done directly in the effect body.
 */
export default function HomeScreen() {
  const { driverId, signOut } = useAuth();
  const [trip, setTrip] = useState<TripSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;
    getMyActiveTrip(driverId).then(
      (active) => {
        if (!cancelled) {
          setTrip(active);
          setIsLoading(false);
        }
      },
      () => {
        if (!cancelled) {
          setTrip(null);
          setIsLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [driverId, refreshKey]);

  function refresh() {
    setIsLoading(true);
    setRefreshKey((k) => k + 1);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {isLoading || !driverId ? (
          <ActivityIndicator style={styles.loading} />
        ) : trip ? (
          <ActiveTripView trip={trip} onEnded={refresh} />
        ) : (
          <StartTripView onStarted={refresh} />
        )}
        <TouchableOpacity onPress={signOut} style={styles.signOutButton}>
          <ThemedText themeColor="textSecondary" type="small">
            Sign out
          </ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loading: { flex: 1 },
  signOutButton: { alignItems: "center", paddingVertical: Spacing.three },
});
