import { apiFetch } from "./api";
import { randomUUID } from "./uuid";

export type DamageView = "front" | "left" | "right" | "rear";

export interface ReportDamageInput {
  view: DamageView;
  positionX: number;
  positionY: number;
  tripId?: string;
  reportedPhase?: "opening" | "mid_route" | "closing";
  note?: string;
}

export interface DamageReport {
  id: string;
  status: string;
}

/**
 * damage.controller.ts's report() is @Authenticated() (any of driver/
 * dispatcher/general_admin), not @DriverOnly() — "Report damage | yes |
 * yes | yes" per docs/architecture.md's roles matrix — but this is the
 * driver-facing call site, reporting from mid-trip.
 */
export function reportDamage(vehicleId: string, input: ReportDamageInput): Promise<DamageReport> {
  return apiFetch<DamageReport>(`/vehicles/${vehicleId}/damage`, {
    method: "POST",
    body: { ...input, idempotencyKey: randomUUID() },
  });
}
