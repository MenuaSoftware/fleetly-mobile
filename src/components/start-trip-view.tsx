import { useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api";
import { getVehicle, startTrip, VehicleInfo } from "@/lib/trips";

/**
 * Vehicle id entered manually, not scanned — the same stand-in as the
 * enroll screen's badge code entry: no physical NFC/QR tag on a real
 * vehicle exists yet to scan against. Looked up via GET /vehicles/:id
 * first so the driver confirms the actual plate/type before starting,
 * rather than typing an id blind and finding out what it was from the
 * error if it's wrong.
 */
export function StartTripView({ onStarted }: { onStarted: () => void }) {
  const theme = useTheme();
  const [step, setStep] = useState<"vehicle" | "odometer">("vehicle");
  const [vehicleId, setVehicleId] = useState("");
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [odometer, setOdometer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFindVehicle() {
    if (!vehicleId.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const found = await getVehicle(vehicleId.trim());
      if (found.status === "out_of_service") {
        setError("This vehicle is marked out of service. Contact your dispatcher.");
        return;
      }
      setVehicle(found);
      setStep("odometer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not find that vehicle.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStart() {
    const startOdometer = Number(odometer);
    if (!vehicle || !Number.isFinite(startOdometer) || startOdometer < 0) return;
    setIsLoading(true);
    setError(null);
    try {
      await startTrip({ vehicleId: vehicle.id, startOdometer });
      onStarted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the trip.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        Start a trip
      </ThemedText>

      {step === "vehicle" && (
        <>
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            Enter the vehicle&rsquo;s id.
          </ThemedText>
          <TextInput
            value={vehicleId}
            onChangeText={setVehicleId}
            placeholder="Vehicle id"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
          {error && (
            <ThemedText themeColor="accent" style={styles.error}>
              {error}
            </ThemedText>
          )}
          <TouchableOpacity
            onPress={handleFindVehicle}
            disabled={isLoading || !vehicleId.trim()}
            style={[
              styles.button,
              { backgroundColor: theme.accent },
              (isLoading || !vehicleId.trim()) && styles.buttonDisabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Find vehicle</ThemedText>
            )}
          </TouchableOpacity>
        </>
      )}

      {step === "odometer" && vehicle && (
        <>
          <ThemedView type="backgroundElement" style={styles.vehicleCard}>
            <ThemedText type="smallBold">{vehicle.plate}</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
              {vehicle.bodyType}
            </ThemedText>
          </ThemedView>
          <ThemedText themeColor="textSecondary" style={styles.hint}>
            What&rsquo;s the odometer reading?
          </ThemedText>
          <TextInput
            value={odometer}
            onChangeText={setOdometer}
            placeholder="Odometer (km)"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
            editable={!isLoading}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
          {error && (
            <ThemedText themeColor="accent" style={styles.error}>
              {error}
            </ThemedText>
          )}
          <TouchableOpacity
            onPress={handleStart}
            disabled={isLoading || !odometer.trim()}
            style={[
              styles.button,
              { backgroundColor: theme.accent },
              (isLoading || !odometer.trim()) && styles.buttonDisabled,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Start trip</ThemedText>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setStep("vehicle");
              setVehicle(null);
              setError(null);
            }}
            style={styles.secondaryButton}
          >
            <ThemedText themeColor="textSecondary">Wrong vehicle</ThemedText>
          </TouchableOpacity>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", paddingHorizontal: Spacing.four, gap: Spacing.two },
  title: { textAlign: "center", marginBottom: Spacing.two },
  hint: { textAlign: "center", marginBottom: Spacing.two },
  vehicleCard: { borderRadius: Spacing.three, padding: Spacing.three, alignItems: "center", marginBottom: Spacing.three, gap: 2 },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    marginBottom: Spacing.two,
  },
  error: { textAlign: "center", marginBottom: Spacing.two },
  button: { borderRadius: Spacing.three, paddingVertical: Spacing.three, alignItems: "center", justifyContent: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  secondaryButton: { alignItems: "center", paddingVertical: Spacing.three },
});
