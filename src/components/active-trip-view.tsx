import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api";
import { endTrip, listTripPhotos, TripPhotoSummary, TripSummary } from "@/lib/trips";
import { pickPhoto, uploadPhoto, PhotoType } from "@/lib/photo-upload";
import { ReportDamageView } from "@/components/report-damage-view";
import { ReportIncidentView } from "@/components/report-incident-view";

const PHOTO_TYPES: { type: PhotoType; label: string }[] = [
  { type: "front", label: "Front" },
  { type: "left", label: "Left side" },
  { type: "right", label: "Right side" },
  { type: "rear", label: "Rear" },
];

type PhotoSlotState = "missing" | "uploading" | "confirmed" | "error";

export function ActiveTripView({ trip, onEnded }: { trip: TripSummary; onEnded: () => void }) {
  const theme = useTheme();
  const [reportingDamage, setReportingDamage] = useState(false);
  const [damageJustReported, setDamageJustReported] = useState(false);
  const [reportingIncident, setReportingIncident] = useState(false);
  const [incidentJustReported, setIncidentJustReported] = useState(false);
  // Damage reported at the closing check, unlike the mid-route button
  // above: docs/trip-state-machine.md gates it exactly like the four end
  // photos, and report-damage-view.tsx's "closing" phase only calls
  // onDone() once that damage's own photo is genuinely confirmed — so
  // this counter only ever grows for reports that are already fully
  // gate-satisfied, never a pending/unconfirmed one.
  const [reportingClosingDamage, setReportingClosingDamage] = useState(false);
  const [closingDamageCount, setClosingDamageCount] = useState(0);
  const [slots, setSlots] = useState<Record<PhotoType, PhotoSlotState>>({
    front: "missing",
    left: "missing",
    right: "missing",
    rear: "missing",
  });
  const [slotErrors, setSlotErrors] = useState<Partial<Record<PhotoType, string>>>({});
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [odometer, setOdometer] = useState("");
  const [isEnding, setIsEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  useEffect(() => {
    listTripPhotos(trip.id)
      .then((photos: TripPhotoSummary[]) => {
        setSlots((prev) => {
          const next = { ...prev };
          for (const photo of photos) {
            if (photo.status === "confirmed") next[photo.photoType] = "confirmed";
          }
          return next;
        });
      })
      .catch(() => {
        // Non-fatal — slots just start as "missing", the driver re-adds
        // any that were actually already confirmed; the backend's own
        // gate on end() is the real source of truth either way.
      })
      .finally(() => setLoadingPhotos(false));
  }, [trip.id]);

  const allConfirmed = PHOTO_TYPES.every(({ type }) => slots[type] === "confirmed");

  async function handleAddPhoto(type: PhotoType) {
    setSlotErrors((s) => ({ ...s, [type]: undefined }));
    let photo;
    try {
      photo = await pickPhoto();
    } catch (err) {
      setSlotErrors((s) => ({ ...s, [type]: err instanceof Error ? err.message : "Could not open the photo picker." }));
      return;
    }
    if (!photo) return; // driver cancelled

    setSlots((s) => ({ ...s, [type]: "uploading" }));
    try {
      await uploadPhoto(trip.id, type, photo);
      setSlots((s) => ({ ...s, [type]: "confirmed" }));
    } catch (err) {
      setSlots((s) => ({ ...s, [type]: "error" }));
      setSlotErrors((s) => ({
        ...s,
        [type]: err instanceof ApiError ? err.message : "Could not upload this photo.",
      }));
    }
  }

  async function handleEndTrip() {
    const endOdometer = Number(odometer);
    if (!Number.isFinite(endOdometer) || endOdometer < 0) return;
    setIsEnding(true);
    setEndError(null);
    try {
      await endTrip(trip.id, { vehicleId: trip.vehicleId, endOdometer });
      onEnded();
    } catch (err) {
      setEndError(err instanceof ApiError ? err.message : "Could not end the trip.");
    } finally {
      setIsEnding(false);
    }
  }

  if (reportingDamage) {
    return (
      <ReportDamageView
        tripId={trip.id}
        vehicleId={trip.vehicleId}
        onDone={() => {
          setReportingDamage(false);
          setDamageJustReported(true);
        }}
        onCancel={() => setReportingDamage(false)}
      />
    );
  }

  if (reportingIncident) {
    return (
      <ReportIncidentView
        tripId={trip.id}
        vehicleId={trip.vehicleId}
        onDone={() => {
          setReportingIncident(false);
          setIncidentJustReported(true);
        }}
        onCancel={() => setReportingIncident(false)}
      />
    );
  }

  if (reportingClosingDamage) {
    return (
      <ReportDamageView
        tripId={trip.id}
        vehicleId={trip.vehicleId}
        phase="closing"
        onDone={() => {
          setReportingClosingDamage(false);
          setClosingDamageCount((n) => n + 1);
        }}
        onCancel={() => setReportingClosingDamage(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        {trip.vehiclePlate ?? "Active trip"}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.hint}>
        Started at {trip.startOdometer} km
      </ThemedText>

      <ThemedView style={styles.reportRow}>
        <TouchableOpacity onPress={() => setReportingDamage(true)} style={styles.reportButton}>
          <ThemedText themeColor="accent" type="small">
            Report damage
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setReportingIncident(true)} style={styles.reportButton}>
          <ThemedText themeColor="accent" type="small">
            Report incident
          </ThemedText>
        </TouchableOpacity>
      </ThemedView>
      {damageJustReported && (
        <ThemedText themeColor="textSecondary" type="small" style={styles.hint}>
          Damage reported — your dispatcher can see it.
        </ThemedText>
      )}
      {incidentJustReported && (
        <ThemedText themeColor="textSecondary" type="small" style={styles.hint}>
          Incident sent to your dispatcher.
        </ThemedText>
      )}

      <ThemedText type="smallBold" style={styles.sectionLabel}>
        Closing photos
      </ThemedText>
      {loadingPhotos ? (
        <ActivityIndicator style={{ marginVertical: Spacing.three }} />
      ) : (
        <ThemedView style={styles.photoGrid}>
          {PHOTO_TYPES.map(({ type, label }) => {
            const state = slots[type];
            return (
              <TouchableOpacity
                key={type}
                testID={`photo-slot-${type}`}
                onPress={() => handleAddPhoto(type)}
                disabled={state === "uploading"}
                style={[
                  styles.photoSlot,
                  {
                    borderColor:
                      state === "confirmed"
                        ? theme.accent
                        : state === "error"
                          ? theme.accent
                          : theme.backgroundSelected,
                  },
                ]}
              >
                {state === "uploading" ? (
                  <ActivityIndicator color={theme.accent} />
                ) : (
                  <ThemedText type="small" themeColor={state === "confirmed" ? "accent" : "textSecondary"}>
                    {state === "confirmed" ? `✓ ${label}` : state === "error" ? `${label} — retry` : label}
                  </ThemedText>
                )}
              </TouchableOpacity>
            );
          })}
        </ThemedView>
      )}
      {Object.entries(slotErrors).map(([type, message]) =>
        message ? (
          <ThemedText key={type} role="alert" themeColor="accent" type="small" style={styles.slotError}>
            {message}
          </ThemedText>
        ) : null,
      )}

      <ThemedText type="smallBold" style={styles.sectionLabel}>
        Damage found at closing
      </ThemedText>
      <ThemedText themeColor="textSecondary" type="small" style={styles.hint}>
        Anything new since you started — this needs a photo, unlike damage reported mid-route.
      </ThemedText>
      {closingDamageCount > 0 && (
        <ThemedText themeColor="accent" type="small" style={styles.hint}>
          {closingDamageCount} closing damage report{closingDamageCount === 1 ? "" : "s"} added, with{" "}
          {closingDamageCount === 1 ? "its" : "their"} photo confirmed.
        </ThemedText>
      )}
      <TouchableOpacity
        onPress={() => setReportingClosingDamage(true)}
        style={[styles.closingDamageButton, { borderColor: theme.backgroundSelected }]}
      >
        <ThemedText themeColor="accent" type="small">
          + Report damage found at closing
        </ThemedText>
      </TouchableOpacity>

      <ThemedText type="smallBold" style={styles.sectionLabel}>
        End trip
      </ThemedText>
      {!allConfirmed && (
        <ThemedText themeColor="textSecondary" type="small" style={styles.hint}>
          All four photos are needed before you can end the trip.
        </ThemedText>
      )}
      <TextInput
        value={odometer}
        onChangeText={setOdometer}
        placeholder="Closing odometer (km)"
        placeholderTextColor={theme.textSecondary}
        keyboardType="number-pad"
        editable={!isEnding}
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
      />
      {endError && (
        <ThemedText themeColor="accent" style={styles.error}>
          {endError}
        </ThemedText>
      )}
      <TouchableOpacity
        onPress={handleEndTrip}
        disabled={isEnding || !allConfirmed || !odometer.trim()}
        style={[
          styles.button,
          { backgroundColor: theme.accent },
          (isEnding || !allConfirmed || !odometer.trim()) && styles.buttonDisabled,
        ]}
      >
        {isEnding ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>End trip</ThemedText>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { flexGrow: 1, padding: Spacing.four, gap: Spacing.two },
  title: { textAlign: "center" },
  hint: { textAlign: "center", marginBottom: Spacing.two },
  reportRow: { flexDirection: "row", justifyContent: "center", gap: Spacing.four },
  reportButton: { alignItems: "center", paddingVertical: Spacing.two },
  sectionLabel: { marginTop: Spacing.three, marginBottom: Spacing.one },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  photoSlot: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 2,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.four,
    alignItems: "center",
    justifyContent: "center",
  },
  slotError: { marginTop: Spacing.one },
  closingDamageButton: {
    borderWidth: 2,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  error: { textAlign: "center", marginBottom: Spacing.two },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: "center", justifyContent: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
