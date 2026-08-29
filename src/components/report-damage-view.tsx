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
import { pickPhoto, uploadDamagePhoto } from "@/lib/photo-upload";

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
  phase = "mid_route",
  onDone,
  onCancel,
}: {
  tripId: string;
  vehicleId: string;
  /**
   * docs/trip-state-machine.md: damage reported mid-route stays
   * queueable and never blocks anything; damage reported at the closing
   * condition check is evidence for the trip's closing state and is
   * gated exactly like the four end photos — trip.controller.ts's
   * end() rejects ending the trip while any 'closing' damage still
   * lacks a confirmed photo. "closing" therefore requires a photo
   * before this view calls onDone(); "mid_route" (the default, and the
   * only mode this view supported before) does not.
   */
  phase?: "mid_route" | "closing";
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
  // Set once the damage row itself is created for the closing phase —
  // from that point on there's no more "cancel": the report is already
  // real server-side, only its required photo is still missing. This
  // view moves into a photo-only stage rather than staying on the form.
  const [createdDamageId, setCreatedDamageId] = useState<string | null>(null);
  const [photoStatus, setPhotoStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [photoError, setPhotoError] = useState<string | null>(null);

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
      const report = await reportDamage(vehicleId, {
        view,
        positionX: position.x,
        positionY: position.y,
        tripId,
        reportedPhase: phase,
        note: note.trim() || undefined,
      });
      if (phase === "closing") {
        // Move into the mandatory photo stage rather than finishing —
        // the report already exists server-side at this point.
        setCreatedDamageId(report.id);
      } else {
        onDone();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not report this damage.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddClosingPhoto() {
    if (!createdDamageId) return;
    setPhotoError(null);
    let photo;
    try {
      photo = await pickPhoto();
    } catch (err) {
      setPhotoStatus("error");
      setPhotoError(err instanceof Error ? err.message : "Could not open the photo picker.");
      return;
    }
    if (!photo) return; // driver cancelled the picker — still on the photo stage, can retry

    setPhotoStatus("uploading");
    try {
      await uploadDamagePhoto(vehicleId, createdDamageId, photo);
      onDone();
    } catch (err) {
      setPhotoStatus("error");
      setPhotoError(err instanceof ApiError ? err.message : "Could not upload this photo.");
    }
  }

  if (createdDamageId) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <ThemedText type="subtitle" style={styles.title}>
          Add a photo
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          Damage found at the closing check needs a photo before you can end the trip.
        </ThemedText>
        {photoError && (
          <ThemedText role="alert" themeColor="accent" style={styles.error}>
            {photoError}
          </ThemedText>
        )}
        <TouchableOpacity
          testID="closing-damage-photo-button"
          onPress={handleAddClosingPhoto}
          disabled={photoStatus === "uploading"}
          style={[
            styles.button,
            { backgroundColor: theme.accent },
            photoStatus === "uploading" && styles.buttonDisabled,
          ]}
        >
          {photoStatus === "uploading" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>
              {photoStatus === "error" ? "Retry photo" : "Take or choose a photo"}
            </ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        {phase === "closing" ? "Damage found at closing" : "Report damage"}
      </ThemedText>
      {phase === "closing" && (
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          This is evidence for how the vehicle was handed back — a photo will be required next.
        </ThemedText>
      )}

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
          <ThemedText style={styles.buttonText}>
            {phase === "closing" ? "Continue to photo" : "Report damage"}
          </ThemedText>
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
  hint: { textAlign: "center", marginBottom: Spacing.two },
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
