import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
} from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api";
import { reportDamage, DamageView } from "@/lib/damage";

const VIEWS: { value: DamageView; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "left", label: "Left side" },
  { value: "right", label: "Right side" },
  { value: "rear", label: "Rear" },
];

/**
 * No real vehicle diagram artwork exists (no image generation available,
 * and this is deliberately deferred past the "core screens exist" point
 * — see fleetly-mobile-progress memory's design-pass note) — a plain
 * bordered rectangle stands in for it. positionX/positionY are still
 * genuinely meaningful fractional coordinates within whatever `view`
 * was selected, the same shape report-damage.dto.ts expects; swapping
 * in a real diagram image later only touches this component's
 * rendering, not the data it produces.
 */
export function ReportDamageView({
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
  const padRef = useRef<View>(null);
  const [view, setView] = useState<DamageView>("front");
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * event.nativeEvent.locationX/locationY — the "obvious" way to get a
   * tap position relative to the touched element — comes back undefined
   * on react-native-web (confirmed live: positionX/positionY silently
   * resolved to NaN, and the CSS `left: NaN%`/`top: NaN%` this produced
   * was simply ignored by the browser, falling back to the pad's own
   * flexbox centering — so the marker still *looked* plausible, dead
   * center, regardless of where it was actually tapped, which is what
   * let this pass a first glance). pageX/pageY (always populated) plus
   * View.measure()'s own pageX/pageY of the pad itself is the reliable,
   * cross-platform way to get a position relative to one element.
   */
  function handlePadPress(event: GestureResponderEvent) {
    const { pageX, pageY } = event.nativeEvent;
    padRef.current?.measure((_x, _y, width, height, padPageX, padPageY) => {
      setPosition({
        x: Math.min(1, Math.max(0, (pageX - padPageX) / width)),
        y: Math.min(1, Math.max(0, (pageY - padPageY) / height)),
      });
    });
  }

  async function handleSubmit() {
    if (!position) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await reportDamage(vehicleId, {
        view,
        positionX: position.x,
        positionY: position.y,
        tripId,
        reportedPhase: "mid_route",
        note: note.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not report this damage.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        Report damage
      </ThemedText>

      <ThemedText type="smallBold" style={styles.sectionLabel}>
        Which side?
      </ThemedText>
      <ThemedView style={styles.viewGrid}>
        {VIEWS.map((v) => (
          <TouchableOpacity
            key={v.value}
            onPress={() => {
              setView(v.value);
              setPosition(null);
            }}
            style={[
              styles.viewButton,
              { borderColor: view === v.value ? theme.accent : theme.backgroundSelected },
            ]}
          >
            <ThemedText type="small" themeColor={view === v.value ? "accent" : "textSecondary"}>
              {v.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </ThemedView>

      <ThemedText type="smallBold" style={styles.sectionLabel}>
        Tap where the damage is
      </ThemedText>
      <Pressable
        ref={padRef}
        onPress={handlePadPress}
        style={[styles.pad, { borderColor: theme.backgroundSelected }]}
      >
        {position && (
          <View
            style={[
              styles.marker,
              { backgroundColor: theme.accent, left: `${position.x * 100}%`, top: `${position.y * 100}%` },
            ]}
          />
        )}
        {!position && (
          <ThemedText themeColor="textSecondary" type="small" style={styles.padHint}>
            Tap to mark the spot
          </ThemedText>
        )}
      </Pressable>

      <ThemedText type="smallBold" style={styles.sectionLabel}>
        Note (optional)
      </ThemedText>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="What happened?"
        placeholderTextColor={theme.textSecondary}
        multiline
        numberOfLines={2}
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
        disabled={isSubmitting || !position}
        style={[
          styles.button,
          { backgroundColor: theme.accent },
          (isSubmitting || !position) && styles.buttonDisabled,
        ]}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Report damage</ThemedText>
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
  viewGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  viewButton: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 2,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
  },
  pad: {
    height: 220,
    borderWidth: 2,
    borderRadius: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
  },
  padHint: { textAlign: "center" },
  marker: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    marginTop: -8,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    textAlignVertical: "top",
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
