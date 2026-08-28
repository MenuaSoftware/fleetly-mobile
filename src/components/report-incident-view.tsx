import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api";
import { reportIncident, IncidentType } from "@/lib/incidents";

const TYPES: { value: IncidentType; label: string; hint: string }[] = [
  { value: "breakdown", label: "Breakdown", hint: "Vehicle can't continue the trip" },
  { value: "new_damage", label: "New damage", hint: "Something just happened to the vehicle" },
];

/**
 * incident.controller.ts's own doc comment: "No separate lifecycle, no
 * workflow, no states" — this really is the entire driver-facing
 * surface, no photo/position complexity like damage reports have.
 */
export function ReportIncidentView({
  tripId,
  vehicleId,
  onDone,
  onCancel,
}: {
  tripId: string;
  vehicleId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [type, setType] = useState<IncidentType>("breakdown");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!note.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await reportIncident({ type, vehicleId, tripId, note: note.trim() });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not report this incident.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        Report an incident
      </ThemedText>

      <ThemedText type="smallBold" style={styles.sectionLabel}>
        What happened?
      </ThemedText>
      <ThemedView style={styles.typeGrid}>
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t.value}
            onPress={() => setType(t.value)}
            style={[styles.typeButton, { borderColor: type === t.value ? theme.accent : theme.backgroundSelected }]}
          >
            <ThemedText type="small" themeColor={type === t.value ? "accent" : "text"}>
              {t.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t.hint}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ThemedView>

      <ThemedText type="smallBold" style={styles.sectionLabel}>
        Tell your dispatcher what&rsquo;s going on
      </ThemedText>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="What's happening?"
        placeholderTextColor={theme.textSecondary}
        multiline
        numberOfLines={4}
        editable={!isSubmitting}
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />

      {error && (
        <ThemedText role="alert" themeColor="accent" style={styles.error}>
          {error}
        </ThemedText>
      )}

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isSubmitting || !note.trim()}
        style={[
          styles.button,
          { backgroundColor: theme.accent },
          (isSubmitting || !note.trim()) && styles.buttonDisabled,
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Send to dispatcher</ThemedText>
        )}
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel} disabled={isSubmitting} style={styles.secondaryButton}>
        <ThemedText themeColor="textSecondary">Cancel</ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { flexGrow: 1, padding: Spacing.four, gap: Spacing.two },
  title: { textAlign: "center", marginBottom: Spacing.two },
  sectionLabel: { marginTop: Spacing.three, marginBottom: Spacing.one },
  typeGrid: { gap: Spacing.two },
  typeButton: {
    borderWidth: 2,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    textAlignVertical: "top",
    minHeight: 100,
  },
  error: { textAlign: "center", marginTop: Spacing.two },
  button: {
    marginTop: Spacing.three,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  secondaryButton: { alignItems: "center", paddingVertical: Spacing.three },
});
