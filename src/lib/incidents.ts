import { apiFetch } from "./api";
import { randomUUID } from "./uuid";

export type IncidentType = "new_damage" | "breakdown";

export interface ReportIncidentInput {
  type: IncidentType;
  vehicleId: string;
  tripId?: string;
  note: string;
}

export interface IncidentReport {
  id: string;
}

/**
 * incident.controller.ts: "No separate lifecycle, no workflow, no
 * states" — report and list are the entire surface, unlike damage's
 * reported/accepted/dismissed/repaired state machine. @DriverOnly() on
 * the backend, so this is only ever called from the driver side.
 */
export function reportIncident(input: ReportIncidentInput): Promise<IncidentReport> {
  return apiFetch<IncidentReport>("/incidents", {
    method: "POST",
    body: { ...input, idempotencyKey: randomUUID() },
  });
}
