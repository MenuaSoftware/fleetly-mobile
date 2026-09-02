import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from "react-native";
import { OrDivider } from "@/components/or-divider";
import { QrScanner } from "@/components/qr-scanner";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { ApiError } from "@/lib/api";
import { getVehicle, startTrip, VehicleInfo } from "@/lib/trips";

/**
 * Vehicle identified by scanning the QR sticker on the vehicle, or by
 * typing its id. The sticker is printed from fleetly-admin's vehicle
 * detail page, carrying the `fleetly:vehicle:` payload
 * lib/qr-payload.ts unwraps.
 *
 * Either route then looks the vehicle up via GET /vehicles/:id before
 * anything is started, so the driver confirms the actual plate/type
 * first rather than committing to an id blind — that confirmation step
 * matters more with scanning, not less, since a driver reading a
 * sticker never sees the id at all.
 *
 * Manual entry is kept for the same reasons as the enroll screen's:
 * no camera on web, permission can be declined, stickers get damaged.
 */
export function StartTripView({ onStarted }: { onStarted: () => void }) {
  const theme = useTheme();
  const [step, setStep] = useState<"vehicle" | "odometer">("vehicle");
  const [vehicleId, setVehicleId] = useState("");
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [odometer, setOdometer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Takes the id explicitly rather than reading state: the scan path
  // has the id in hand and must not depend on a setVehicleId render
  // having landed first.
  async function findVehicle(id: string) {
    const trimmed = id.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setError(null);
    try {
      const found = await getVehicle(trimmed);
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

  async function handleScanned(scannedId: string) {
    setIsScanning(false);
    setVehicleId(scannedId);
    await findVehicle(scannedId);
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
            Scan the QR code on the vehicle, or enter its id.
          </ThemedText>

          {isScanning ? (
            <QrScanner
              kind="vehicle"
              onScanned={handleScanned}
              onCancel={() => setIsScanning(false)}
            />
          ) : (
            <>
              <Pressable
                testID="scan-vehicle"
                accessibilityRole="button"
                onPress={() => setIsScanning(true)}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: theme.accent },
                  isLoading && styles.buttonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <ThemedText style={styles.buttonText}>Scan vehicle</ThemedText>
              </Pressable>
              <OrDivider label="or enter the id by hand" />
            </>
          )}

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
          {/* Outlined for the same reason as the enroll screen's: the fallback, not a second equal choice. */}
          <Pressable
            testID="find-vehicle"
            accessibilityRole="button"
            onPress={() => findVehicle(vehicleId)}
            disabled={isLoading || !vehicleId.trim()}
            style={({ pressed }) => [
              styles.button,
              styles.buttonSecondary,
              { borderColor: theme.backgroundSelected },
              (isLoading || !vehicleId.trim()) && styles.buttonDisabled,
              pressed && styles.pressed,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <ThemedText style={styles.buttonTextSecondary}>Find vehicle</ThemedText>
            )}
          </Pressable>
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
          <Pressable
            testID="start-trip"
            accessibilityRole="button"
            onPress={handleStart}
            disabled={isLoading || !odometer.trim()}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.accent },
              (isLoading || !odometer.trim()) && styles.buttonDisabled,
              pressed && styles.pressed,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Start trip</ThemedText>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setStep("vehicle");
              setVehicle(null);
              setError(null);
            }}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <ThemedText themeColor="textSecondary">Wrong vehicle</ThemedText>
          </Pressable>
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
  buttonSecondary: { borderWidth: 1, backgroundColor: "transparent" },
  pressed: { opacity: 0.6 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  /** Inherits ThemedText's own foreground — the filled button's white would vanish on this one. */
  buttonTextSecondary: { fontWeight: "600", fontSize: 16 },
  secondaryButton: {
    minHeight: 48, alignItems: "center", paddingVertical: Spacing.three },
});
