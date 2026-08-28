import { useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/lib/auth-context";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/**
 * Reached right after a successful enroll() — the device is now
 * registered but a dispatcher still has to approve it
 * (device.controller.ts's approve endpoint; no admin panel UI for that
 * yet either, so this really does mean asking someone to run it by
 * hand today). Also reached on every cold start of an enrolled-but-
 * never-approved device, since attemptStoredLogin() in auth-context.tsx
 * re-tries the same login on launch.
 */
export function PendingApprovalScreen() {
  const { retryLogin, errorMessage, signOut } = useAuth();
  const [isRetrying, setIsRetrying] = useState(false);
  const theme = useTheme();

  async function handleRetry() {
    setIsRetrying(true);
    await retryLogin();
    setIsRetrying(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Waiting for approval
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Your dispatcher needs to approve this phone before you can sign in.
        </ThemedText>

        {errorMessage && (
          <ThemedText themeColor="textSecondary" style={styles.error}>
            {errorMessage}
          </ThemedText>
        )}

        <TouchableOpacity
          onPress={handleRetry}
          disabled={isRetrying}
          style={[styles.button, { backgroundColor: theme.accent }, isRetrying && styles.buttonDisabled]}
        >
          {isRetrying ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>I&rsquo;ve been approved</ThemedText>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={signOut} style={styles.secondaryButton}>
          <ThemedText themeColor="textSecondary">Use a different badge</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  title: { textAlign: "center", fontSize: 28, lineHeight: 34 },
  hint: { textAlign: "center", marginBottom: Spacing.four },
  error: { textAlign: "center", marginBottom: Spacing.two },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: Spacing.three,
  },
});
