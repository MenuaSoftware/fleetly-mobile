import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { OrDivider } from "@/components/or-divider";
import { QrScanner } from "@/components/qr-scanner";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/lib/auth-context";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

/**
 * Scan or type. The badge QR is printed by fleetly-admin at the moment
 * the badge is issued (IssueBadgeButton) — the same raw token a
 * dispatcher sees exactly once, wrapped in the `fleetly:badge:` payload
 * lib/qr-payload.ts unwraps here.
 *
 * Manual entry stays as an equal path, not a deprecated one: there is
 * no camera under `expo start --web`, a driver can decline the
 * permission, and a printed badge can be damaged. enroll() itself is
 * untouched by either route — it only ever needed the raw token
 * string, however it was obtained.
 */
export function EnrollScreen() {
  const { enroll, errorMessage } = useAuth();
  const [badgeToken, setBadgeToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const theme = useTheme();

  async function submitToken(token: string) {
    setIsSubmitting(true);
    await enroll(token);
    setIsSubmitting(false);
  }

  async function handleSubmit() {
    if (!badgeToken.trim()) return;
    await submitToken(badgeToken.trim());
  }

  async function handleScanned(token: string) {
    setIsScanning(false);
    // Shown in the input as well as submitted, so a driver watching the
    // screen can see what was actually read off the badge — and still
    // has it there to correct by hand if enrolment is rejected.
    setBadgeToken(token);
    await submitToken(token);
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
          Scan the QR code on your badge, or enter the code your
          dispatcher gave you.
        </ThemedText>

        {isScanning ? (
          <QrScanner
            kind="badge"
            onScanned={handleScanned}
            onCancel={() => setIsScanning(false)}
          />
        ) : (
          <>
            <Pressable
              testID="scan-badge"
              accessibilityRole="button"
              onPress={() => setIsScanning(true)}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.accent },
                isSubmitting && styles.buttonDisabled,
                pressed && styles.pressed,
              ]}
            >
              <ThemedText style={styles.buttonText}>Scan badge</ThemedText>
            </Pressable>
            <OrDivider label="or enter it by hand" />
          </>
        )}

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

        {/*
          Outlined, not filled: scanning is the primary path now, and
          two identical accent buttons stacked would read as two equal
          choices rather than a fast path and its fallback.
        */}
        <Pressable
          testID="submit-badge"
          accessibilityRole="button"
          onPress={handleSubmit}
          disabled={isSubmitting || !badgeToken.trim()}
          style={({ pressed }) => [
            styles.button,
            styles.buttonSecondary,
            { borderColor: theme.backgroundSelected },
            (isSubmitting || !badgeToken.trim()) && styles.buttonDisabled,
            pressed && styles.pressed,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={theme.text} />
          ) : (
            <ThemedText style={styles.buttonTextSecondary}>Continue</ThemedText>
          )}
        </Pressable>
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
    minHeight: 48,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSecondary: { borderWidth: 1, backgroundColor: "transparent" },
  pressed: { opacity: 0.6 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  /** Inherits ThemedText's own foreground — the filled button's white would vanish on this one. */
  buttonTextSecondary: { fontWeight: "600", fontSize: 16 },
});
