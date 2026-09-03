import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { VehicleDiagram, VIEW_ASPECT, type BodyType } from "@/components/vehicle-diagram";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { listDamage, type DamageSummary, type DamageView } from "@/lib/damage";

/**
 * The opening condition check: everything already recorded against this
 * vehicle, shown before the driver takes it. This is the screen that
 * makes trip_confirmation.acknowledged_damage_ids mean something —
 * docs/product-brief.md §8 calls that record "the legally useful part of
 * the product", and until now the app started trips without sending a
 * single id, so it was being written empty.
 *
 * Two views of one list, deliberately: the diagram answers "where is it"
 * at a glance while walking round the vehicle, the list answers "what
 * exactly" and stays usable when several marks sit close enough together
 * to overlap. The numbers are shared between them, so a driver can go
 * from a bubble on the van to its row and back.
 *
 * Only open damage is shown — dismissed means a dispatcher decided it
 * was not real, repaired means it is gone. Asking a driver to agree that
 * either is present would be asking them to confirm something false.
 */

const DIAGRAM_VIEWS: { view: DamageView; label: string; full: boolean }[] = [
  { view: "front", label: "Front", full: false },
  { view: "rear", label: "Rear", full: false },
  { view: "left", label: "Left side", full: true },
  { view: "right", label: "Right side", full: true },
];

const VIEW_LABEL: Record<DamageView, string> = {
  front: "Front",
  rear: "Rear",
  left: "Left side",
  right: "Right side",
};

/** Open = still standing against the vehicle. Mirrors the admin panel's own definition. */
export function isOpen(damage: DamageSummary): boolean {
  return damage.status === "reported" || damage.status === "accepted";
}

/**
 * Stable, human-facing numbering: oldest first, so a mark keeps its
 * number for as long as it is open and the diagram and the list always
 * agree.
 */
export function orderDamage(damage: DamageSummary[]): DamageSummary[] {
  return damage
    .filter(isOpen)
    .slice()
    .sort((a, b) => a.reportedAt.localeCompare(b.reportedAt));
}

export function VehicleDamageRegister({
  vehicleId,
  plate,
  bodyType,
  onReportNew,
  onConfirm,
  onCancel,
}: {
  vehicleId: string;
  plate: string;
  bodyType?: BodyType;
  onReportNew: () => void;
  /** Receives the ids the driver is agreeing to — straight into startTrip. */
  onConfirm: (acknowledgedDamageIds: string[]) => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [tab, setTab] = useState<"vehicle" | "list">("vehicle");
  const [damage, setDamage] = useState<DamageSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setDamage(await listDamage(vehicleId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this vehicle's damage.");
    }
  }, [vehicleId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <ThemedView style={styles.centred}>
        <ThemedText themeColor="accent" style={styles.centerText}>
          {error}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={() => void load()}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.accent },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText style={styles.buttonText}>Try again</ThemedText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
        >
          <ThemedText themeColor="accent">Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (!damage) {
    return (
      <ThemedView style={styles.centred}>
        <ActivityIndicator color={theme.accent} />
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          Loading the damage register…
        </ThemedText>
      </ThemedView>
    );
  }

  const open = orderDamage(damage);
  const numberOf = new Map(open.map((d, i) => [d.id, i + 1]));

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="subtitle">
            {open.length === 0
              ? "No damage recorded"
              : `${open.length} damage recorded`}
          </ThemedText>
          <ThemedText themeColor="textSecondary" type="small">
            {plate}
          </ThemedText>
        </View>
        <Pressable
          testID="register-close"
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onCancel}
          hitSlop={12}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <ThemedText themeColor="textSecondary" style={styles.closeGlyph}>
            ✕
          </ThemedText>
        </Pressable>
      </View>

      {open.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.segmented}>
          {(["vehicle", "list"] as const).map((value) => {
            const active = tab === value;
            return (
              <Pressable
                key={value}
                testID={`register-tab-${value}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(value)}
                style={[
                  styles.segment,
                  active && { backgroundColor: theme.background },
                ]}
              >
                <ThemedText
                  type={active ? "smallBold" : "small"}
                  themeColor={active ? "text" : "textSecondary"}
                >
                  {value === "vehicle" ? "Vehicle" : "List"}
                </ThemedText>
              </Pressable>
            );
          })}
        </ThemedView>
      )}

      <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {open.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.emptyCard}>
            <ThemedText style={styles.centerText}>
              Nothing has been recorded against this vehicle.
            </ThemedText>
            <ThemedText themeColor="textSecondary" type="small" style={styles.centerText}>
              Check it over anyway — anything you find now is not yours to answer for later.
            </ThemedText>
          </ThemedView>
        ) : tab === "vehicle" ? (
          <View style={styles.diagramGrid}>
            {DIAGRAM_VIEWS.map(({ view, label, full }) => (
              <View
                key={view}
                style={[styles.diagramCell, full ? styles.cellFull : styles.cellHalf]}
              >
                <View style={[styles.diagramBox, { aspectRatio: VIEW_ASPECT[view] }]}>
                  <VehicleDiagram view={view} bodyType={bodyType} stroke={theme.text} />
                  {open
                    .filter((d) => d.view === view)
                    .map((d) => (
                      <View
                        key={d.id}
                        testID={`damage-marker-${numberOf.get(d.id)}`}
                        style={[
                          styles.marker,
                          {
                            backgroundColor: theme.accent,
                            left: `${d.positionX * 100}%`,
                            top: `${d.positionY * 100}%`,
                          },
                        ]}
                      >
                        <ThemedText style={styles.markerText}>{numberOf.get(d.id)}</ThemedText>
                      </View>
                    ))}
                </View>
                <ThemedText themeColor="textSecondary" type="small" style={styles.centerText}>
                  {label}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.list}>
            {open.map((d) => (
              <ThemedView
                key={d.id}
                type="backgroundElement"
                style={styles.listRow}
                testID={`damage-row-${numberOf.get(d.id)}`}
              >
                <View style={[styles.marker, styles.listMarker, { backgroundColor: theme.accent }]}>
                  <ThemedText style={styles.markerText}>{numberOf.get(d.id)}</ThemedText>
                </View>
                <View style={styles.listRowText}>
                  <ThemedText type="smallBold">{VIEW_LABEL[d.view]}</ThemedText>
                  <ThemedText themeColor="textSecondary" type="small">
                    {d.status === "accepted" ? "Confirmed by dispatch" : "Awaiting review"}
                    {" · "}
                    {new Date(d.reportedAt).toLocaleDateString()}
                  </ThemedText>
                </View>
              </ThemedView>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          testID="register-report-new"
          accessibilityRole="button"
          onPress={onReportNew}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.accent },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText style={styles.buttonText}>Report new damage</ThemedText>
        </Pressable>
        {/*
          Confirming sends the exact ids on screen, not a count and not a
          "yes" — trip.controller.ts checks every one belongs to this
          vehicle, and the record is only worth anything if it names what
          was actually shown.
        */}
        <Pressable
          testID="register-confirm"
          accessibilityRole="button"
          onPress={() => onConfirm(open.map((d) => d.id))}
          style={({ pressed }) => [
            styles.button,
            styles.buttonSecondary,
            { borderColor: theme.backgroundSelected },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText style={[styles.buttonTextSecondary, { color: theme.accent }]}>
            {open.length === 0 ? "Nothing to report" : "No new damage"}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const MARKER = 30;

const styles = StyleSheet.create({
  container: { flex: 1, gap: Spacing.two },
  centred: {
    flex: 1,
    justifyContent: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  centerText: { textAlign: "center" },

  header: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.two },
  headerText: { flex: 1, gap: 2 },
  close: { minHeight: 44, minWidth: 44, alignItems: "flex-end", justifyContent: "center" },
  closeGlyph: { fontSize: 20, lineHeight: 24 },

  segmented: { flexDirection: "row", borderRadius: 999, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },

  scrollBody: { gap: Spacing.three, paddingVertical: Spacing.two },
  diagramGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
    justifyContent: "space-between",
  },
  diagramCell: { gap: Spacing.one },
  cellHalf: { width: "47%" },
  cellFull: { width: "100%" },
  diagramBox: { width: "100%", position: "relative" },

  marker: {
    position: "absolute",
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    alignItems: "center",
    justifyContent: "center",
    // Centres the bubble on its coordinate: RN has no percentage
    // translate, so half the marker is taken back in margins.
    marginLeft: -MARKER / 2,
    marginTop: -MARKER / 2,
  },
  listMarker: { position: "relative", marginLeft: 0, marginTop: 0 },
  markerText: { color: "#fff", fontWeight: "700", fontSize: 13, lineHeight: 16 },

  list: { gap: Spacing.two },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  listRowText: { flex: 1, gap: 2 },

  emptyCard: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.two },

  actions: { gap: Spacing.two, paddingTop: Spacing.two },
  button: {
    minHeight: 48,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSecondary: { borderWidth: 1, backgroundColor: "transparent" },
  /** 48px tall so the error-state fallback is a real touch target. */
  linkButton: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  buttonTextSecondary: { fontWeight: "600", fontSize: 16 },
  pressed: { opacity: 0.6 },
});
