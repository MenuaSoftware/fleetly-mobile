import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { DocumentSummary, getDocumentViewUrl, listMyDriverDocuments, listVehicleDocuments } from "@/lib/documents";

const STATUS_LABEL: Record<DocumentSummary["status"], string> = {
  valid: "Valid",
  expiring_soon: "Expiring soon",
  expired: "Expired",
};

/**
 * product-brief.md: "viewing your own documents while a trip is open" —
 * read-only (document.controller.ts's writes are all @StaffOnly(); "both
 * uploaded by the dispatcher and read-only to the driver" is that
 * controller's own framing). Shows this driver's own documents plus the
 * *current trip's vehicle's* documents specifically, not the whole
 * fleet's — document_read's RLS would technically let a driver read any
 * vehicle's documents (the "roadside check" breadth), but this screen
 * only has reason to show the one vehicle actually being driven right
 * now.
 */
export function MyDocumentsView({
  driverId,
  vehicleId,
  onCancel,
}: {
  driverId: string;
  vehicleId: string;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listMyDriverDocuments(driverId), listVehicleDocuments(vehicleId)])
      .then(([mine, vehicles]) => setDocuments([...mine, ...vehicles]))
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load documents."));
  }, [driverId, vehicleId]);

  async function handleOpen(doc: DocumentSummary) {
    setOpenError(null);
    setOpeningId(doc.id);
    try {
      const { url } = await getDocumentViewUrl(doc.id);
      await Linking.openURL(url);
    } catch (err) {
      setOpenError(err instanceof Error ? err.message : "Could not open this document.");
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        My documents
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.hint}>
        Your own documents and this vehicle&rsquo;s.
      </ThemedText>

      {documents === null && !loadError && <ActivityIndicator style={{ marginVertical: Spacing.four }} />}
      {loadError && (
        <ThemedText role="alert" themeColor="accent" style={styles.error}>
          {loadError}
        </ThemedText>
      )}
      {documents?.length === 0 && (
        <ThemedText themeColor="textSecondary" style={styles.hint}>
          No documents on file.
        </ThemedText>
      )}

      {documents?.map((d) => (
        <TouchableOpacity
          key={d.id}
          onPress={() => (d.uploadStatus === "confirmed" ? handleOpen(d) : undefined)}
          disabled={d.uploadStatus !== "confirmed" || openingId === d.id}
          style={[styles.row, { borderColor: theme.backgroundSelected }]}
        >
          <ThemedView style={styles.rowText}>
            <ThemedText type="smallBold">{d.typeName}</ThemedText>
            <ThemedText themeColor="textSecondary" type="small">
              expires {d.expiryDate}
              {d.uploadStatus === "pending" ? " · not yet on file" : ""}
            </ThemedText>
          </ThemedView>
          {openingId === d.id ? (
            <ActivityIndicator color={theme.accent} />
          ) : (
            <ThemedText themeColor={d.status === "valid" ? "textSecondary" : "accent"} type="small">
              {STATUS_LABEL[d.status]}
            </ThemedText>
          )}
        </TouchableOpacity>
      ))}

      {openError && (
        <ThemedText role="alert" themeColor="accent" style={styles.error}>
          {openError}
        </ThemedText>
      )}

      <TouchableOpacity onPress={onCancel} style={styles.secondaryButton}>
        <ThemedText themeColor="textSecondary">Close</ThemedText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { flexGrow: 1, padding: Spacing.four, gap: Spacing.two },
  title: { textAlign: "center" },
  hint: { textAlign: "center", marginBottom: Spacing.two },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  rowText: { flex: 1, gap: 2 },
  error: { textAlign: "center", marginTop: Spacing.two },
  secondaryButton: { alignItems: "center", paddingVertical: Spacing.three, marginTop: Spacing.two },
});
