import { useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/lib/auth-context";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/**
 * Manual entry, not a camera/QR scan — the physical badge printing
 * flow doesn't exist yet either, so there's nothing real to scan
 * against right now. This is the same badge token
 * IssueBadgeButton (fleetly-admin) shows a dispatcher exactly once;
 * copying it in here is the interim path until QR badges exist. Swap
 * this input for a scanner later without touching enroll() itself —
 * it only needs the raw token string, however it was obtained.
 */
export function EnrollScreen() {
  const { enroll, errorMessage } = useAuth();
  const [badgeToken, setBadgeToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const theme = useTheme();

  async function handleSubmit() {
    if (!badgeToken.trim()) return;
    setIsSubmitting(true);
    await enroll(badgeToken.trim());
    setIsSubmitting(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Fleetly
        </ThemedText>
        <ThemedText type="subtitle" style={styles.subtitle}>
          Set up this phone
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Enter the badge code your dispatcher gave you.
        </ThemedText>

        <TextInput
          value={badgeToken}
          onChangeText={setBadgeToken}
          placeholder="Badge code"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSubmitting}
          style={[
            styles.input,
            { color: theme.text, borderColor: theme.backgroundSelected },
          ]}
        />

        {errorMessage && (
          <ThemedText themeColor="accent" style={styles.error}>
            {errorMessage}
          </ThemedText>
        )}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting || !badgeToken.trim()}
          style={[
            styles.button,
            { backgroundColor: theme.accent },
            (isSubmitting || !badgeToken.trim()) && styles.buttonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>Continue</ThemedText>
          )}
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
  title: { textAlign: "center", fontSize: 32, lineHeight: 38 },
  subtitle: { textAlign: "center", fontSize: 20, lineHeight: 26, marginTop: Spacing.four },
  hint: { textAlign: "center", marginBottom: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    marginBottom: Spacing.two,
  },
  error: { textAlign: "center", marginBottom: Spacing.two },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
