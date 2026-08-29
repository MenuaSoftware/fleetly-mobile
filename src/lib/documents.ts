import { apiFetch } from "./api";

export interface DocumentSummary {
  id: string;
  typeId: string;
  typeName: string;
  vehicleId: string | null;
  driverId: string | null;
  status: "valid" | "expiring_soon" | "expired";
  expiryDate: string;
  uploadStatus: "pending" | "confirmed";
  uploadedAt: string | null;
}

/**
 * document.controller.ts's list() is @Authenticated() — document_read's
 * RLS (own driver documents, any vehicle's documents — "digital copies
 * of vehicle registration and insurance... shown at a roadside check")
 * is what actually scopes this to documents the caller may see; passing
 * driverId here just narrows the *query* to this driver's own rows
 * rather than fetching the whole fleet's vehicle documents too and
 * filtering them out client-side. Two calls, not one broad
 * GET /documents with no filter at all — product-brief.md's "viewing
 * your own documents while a trip is open" is specifically about *this*
 * trip's vehicle, not the entire fleet's registration paperwork.
 */
export function listMyDriverDocuments(driverId: string): Promise<DocumentSummary[]> {
  return apiFetch<DocumentSummary[]>(`/documents?driverId=${driverId}`);
}

export function listVehicleDocuments(vehicleId: string): Promise<DocumentSummary[]> {
  return apiFetch<DocumentSummary[]>(`/documents?vehicleId=${vehicleId}`);
}

export function getDocumentViewUrl(id: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(`/documents/${id}/view-url`);
}
