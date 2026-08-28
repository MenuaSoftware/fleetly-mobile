import { signLoginChallenge } from "./crypto";
import { getSession, saveSession, clearSession, type StoredSession } from "./storage";

// Only works from `expo start --web` on this dev machine — a real
// phone's "localhost" is the phone itself, not this machine. Override
// via EXPO_PUBLIC_API_URL/EXPO_PUBLIC_SUPABASE_AUTH_URL for device
// testing (Expo inlines EXPO_PUBLIC_* at build time, same convention as
// fleetly-admin's NEXT_PUBLIC_*).
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
const SUPABASE_AUTH_URL =
  process.env.EXPO_PUBLIC_SUPABASE_AUTH_URL ?? "http://127.0.0.1:54321/auth/v1";
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** login.controller.ts's stable, machine-readable BadgeLoginError reason — undefined for every other kind of error. */
    public readonly reason?: string,
  ) {
    super(message);
  }
}

/** Thrown when the stored session is gone and can't be refreshed — the UI's signal to send the driver back to login. */
export class SessionExpiredError extends Error {}

async function parseErrorBody(res: Response): Promise<{ message: string; reason?: string }> {
  const body: unknown = await res.json().catch(() => null);
  const rawMessage =
    body && typeof body === "object" && "message" in body
      ? (body as { message: unknown }).message
      : undefined;
  const reason =
    body && typeof body === "object" && "reason" in body
      ? String((body as { reason: unknown }).reason)
      : undefined;
  const message = Array.isArray(rawMessage)
    ? rawMessage.join(" ")
    : rawMessage
      ? String(rawMessage)
      : `Request failed (${res.status}).`;
  return { message, reason };
}

/**
 * Exchanges the stored refresh token for a new session directly against
 * Supabase Auth's own token endpoint — this is GoTrue's standard REST
 * API, not something the backend needs to mediate (SessionService only
 * mints the *first* session; refreshing an existing one is the client's
 * job everywhere Supabase Auth is used this way).
 */
async function refreshSession(refreshToken: string): Promise<StoredSession> {
  const res = await fetch(`${SUPABASE_AUTH_URL}/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    throw new SessionExpiredError("Could not refresh the session.");
  }
  const body = (await res.json()) as { access_token: string; refresh_token: string };
  return { accessToken: body.access_token, refreshToken: body.refresh_token };
}

/**
 * Authenticated calls against the fleet API. On a 401, tries exactly
 * one refresh-and-retry before giving up — a driver's shift can run
 * for hours, well past Supabase's 1-hour access token lifetime
 * (jwt_expiry in supabase/config.toml), so refreshing transparently
 * here (rather than forcing a re-login) is the actual requirement, not
 * a nicety.
 */
export async function apiFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  let session = await getSession();
  if (!session) throw new SessionExpiredError("Not signed in.");

  const doFetch = (accessToken: string) =>
    fetch(`${API_URL}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });

  let res = await doFetch(session.accessToken);
  if (res.status === 401) {
    try {
      session = await refreshSession(session.refreshToken);
    } catch {
      await clearSession();
      throw new SessionExpiredError("Session expired. Please sign in again.");
    }
    await saveSession(session);
    res = await doFetch(session.accessToken);
  }

  if (!res.ok) {
    const { message, reason } = await parseErrorBody(res);
    throw new ApiError(message, res.status, reason);
  }
  return (await res.json()) as T;
}

export interface EnrollDeviceResult {
  deviceId: string;
  status: string;
}

/** No auth — a driver has no session yet at this point. See device.controller.ts's own comment: badge possession is the proof. */
export async function enrollDevice(
  badgeToken: string,
  publicKeyDerBase64: string,
): Promise<EnrollDeviceResult> {
  const res = await fetch(`${API_URL}/devices/enroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ badgeToken, publicKey: publicKeyDerBase64 }),
  });
  if (!res.ok) {
    const { message, reason } = await parseErrorBody(res);
    throw new ApiError(message, res.status, reason);
  }
  return (await res.json()) as EnrollDeviceResult;
}

/**
 * Signs a fresh challenge with the device's stored private key and
 * exchanges it for a real session — device.status must already be
 * 'approved' server-side, or this comes back 401 with a message telling
 * the driver their dispatcher hasn't approved them yet (BadgeLoginService's
 * own driver-facing text, passed straight through).
 */
export async function loginWithBadge(
  badgeToken: string,
  privateKeyHex: string,
): Promise<StoredSession> {
  const { signature, timestamp } = signLoginChallenge(privateKeyHex, badgeToken);
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ badgeToken, signature, timestamp }),
  });
  if (!res.ok) {
    const { message, reason } = await parseErrorBody(res);
    throw new ApiError(message, res.status, reason);
  }
  const body = (await res.json()) as { accessToken: string; refreshToken: string };
  return { accessToken: body.accessToken, refreshToken: body.refreshToken };
}
