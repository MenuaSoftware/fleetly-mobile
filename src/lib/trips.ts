import { apiFetch } from "./api";
import { randomUUID } from "./uuid";

export interface VehicleInfo {
  id: string;
  plate: string;
  bodyType: "van" | "truck" | "car";
  status: "active" | "out_of_service";
}

export interface TripSummary {
  id: string;
  state: "active" | "completed" | "force_closed";
  driverId: string;
  vehicleId: string;
  vehiclePlate: string | null;
  startOdometer: number;
  endOdometer: number | null;
  startedAt: string;
  endedAt: string | null;
}

export interface TripPhotoSummary {
  id: string;
  photoType: "front" | "left" | "right" | "rear";
  status: string;
  uploadedAt: string | null;
}

/** vehicle.controller.ts's get() — @Authenticated(), not @StaffOnly(), so a driver can call it directly. */
export function getVehicle(vehicleId: string): Promise<VehicleInfo> {
  return apiFetch<VehicleInfo>(`/vehicles/${vehicleId}`);
}

/**
 * A driver's own open trip, if any — trip-query.controller.ts's list()
 * scoped by trip_visible() RLS, which for a driver means "my own trips"
 * (same reasoning as driver_visible()). Used on app launch/home to
 * decide "start a trip" vs "you have one open already".
 */
export async function getMyActiveTrip(driverId: string): Promise<TripSummary | null> {
  const trips = await apiFetch<TripSummary[]>("/trips?state=active");
  return trips.find((t) => t.driverId === driverId) ?? trips[0] ?? null;
}

export function startTrip(input: {
  vehicleId: string;
  startOdometer: number;
  acknowledgedDamageIds?: string[];
}): Promise<{ id: string; state: "active"; startedAt: string }> {
  return apiFetch(`/trips`, {
    method: "POST",
    body: {
      ...input,
      clientTime: new Date().toISOString(),
      idempotencyKey: randomUUID(),
    },
  });
}

export function endTrip(
  tripId: string,
  input: { vehicleId: string; endOdometer: number; acknowledgedDamageIds?: string[] },
): Promise<{ id: string; state: "completed"; endedAt: string; distance: number }> {
  return apiFetch(`/trips/${tripId}/end`, {
    method: "POST",
    body: {
      ...input,
      clientTime: new Date().toISOString(),
      idempotencyKey: randomUUID(),
    },
  });
}

export function listTripPhotos(tripId: string): Promise<TripPhotoSummary[]> {
  return apiFetch<TripPhotoSummary[]>(`/trips/${tripId}/photos`);
}
