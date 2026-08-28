import { StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/lib/auth-context";
import { Spacing } from "@/constants/theme";

/**
 * Reached only once status === 'authenticated' (see _layout.tsx's
 * AppGate) — a real Fleetly Auth session backs this, not a client-side
 * flag. Trip start/end, damage/incident reporting, and document upload
 * all land here as real routes once they exist; this is deliberately
 * just a "you're signed in" placeholder for now, same role
 * fleetly-admin's own home page played before Staff/Drivers/Vehicles
 * existed.
 */
export default function HomeScreen() {
  const { signOut } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Fleetly
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Signed in. Trip start/end lands here next.
        </ThemedText>
        <TouchableOpacity onPress={signOut} style={styles.button}>
          <ThemedText themeColor="textSecondary">Sign out</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  title: { fontSize: 32, lineHeight: 38 },
  hint: { textAlign: "center" },
  button: { marginTop: Spacing.four, paddingVertical: Spacing.three },
});
