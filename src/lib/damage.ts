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

/** damage.controller.ts's DamageSummary, the fields this app actually uses. */
export interface DamageSummary {
  id: string;
  vehicleId: string;
  tripId: string | null;
  reportedPhase: string | null;
  status: "reported" | "accepted" | "dismissed" | "repaired";
  view: DamageView;
  positionX: number;
  positionY: number;
  reportedAt: string;
}

/**
 * The vehicle's standing damage register. @Authenticated(), not
 * staff-only — a driver checking a vehicle out is exactly who needs to
 * see what is already recorded against it before they agree it is
 * complete.
 *
 * Dismissed and repaired rows come back too, and are filtered at the
 * call site rather than here: what counts as "still open" is a product
 * decision belonging to the screen, not to the transport.
 */
export function listDamage(vehicleId: string): Promise<DamageSummary[]> {
  return apiFetch<DamageSummary[]>(`/vehicles/${vehicleId}/damage`);
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
