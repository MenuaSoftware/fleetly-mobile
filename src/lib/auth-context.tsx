import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  apiFetch,
  ApiError,
  enrollDevice,
  loginWithBadge,
} from "./api";
import { generateDeviceKeypair } from "./crypto";
import {
  clearDeviceCredentials,
  clearSession,
  getDeviceCredentials,
  getSession,
  saveDeviceCredentials,
  saveSession,
} from "./storage";

export type AuthStatus =
  | "loading"
  | "needs-enroll"
  | "pending-approval"
  | "authenticated";

interface AuthContextValue {
  status: AuthStatus;
  errorMessage: string | null;
  /** Set once status becomes 'authenticated' — fetched from /auth/me, not decoded client-side from the token. */
  driverId: string | null;
  /** Generates a device keypair, enrolls it against this badge, and moves to pending-approval on success. */
  enroll: (badgeToken: string) => Promise<void>;
  /** Re-attempts login with the already-enrolled device — call from the pending-approval screen's retry button. */
  retryLogin: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * A rejected login's `reason` (see login.controller.ts) decides what
 * this app does next — stable and machine-readable, not the driver-
 * facing message text, which is free to change independently.
 * 'device_not_approved' means keep waiting; everything else that can
 * reject a *previously working* device (badge revoked/reissued,
 * driver deactivated) means this device's stored credentials can never
 * work again, so wipe them and send the driver back to enrollment.
 * 'signature_expired'/'signature_invalid' are treated as transient —
 * surfaced as an error but nothing is wiped, since a bad clock or a
 * one-off glitch doesn't mean re-enrollment is needed.
 */
function shouldReEnroll(reason: string | undefined): boolean {
  return reason === "badge_not_found" || reason === "driver_inactive";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);

  // useCallback (empty deps — each only closes over stable setState
  // setters and module-level imports, nothing that changes across
  // renders) so the mount effect below can list them as dependencies
  // instead of triggering react-hooks/exhaustive-deps.
  const loadDriverId = useCallback(async () => {
    try {
      const me = await apiFetch<{ driverId: string }>("/auth/me");
      setDriverId(me.driverId);
    } catch {
      // Non-fatal — the trip screens degrade to "loading" rather than
      // crash if this one call fails; apiFetch's own session-expiry
      // handling is what actually matters for staying signed in.
    }
  }, []);

  const attemptStoredLogin = useCallback(async () => {
    const device = await getDeviceCredentials();
    if (!device) {
      setStatus("needs-enroll");
      return;
    }
    try {
      const session = await loginWithBadge(device.badgeToken, device.privateKeyHex);
      await saveSession(session);
      setErrorMessage(null);
      setStatus("authenticated");
      await loadDriverId();
    } catch (err) {
      const reason = err instanceof ApiError ? err.reason : undefined;
      if (shouldReEnroll(reason)) {
        await clearDeviceCredentials();
        setErrorMessage(err instanceof Error ? err.message : "This badge is no longer valid.");
        setStatus("needs-enroll");
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : "Could not sign in.");
      setStatus("pending-approval");
    }
  }, [loadDriverId]);

  useEffect(() => {
    (async () => {
      // A stored session is trusted at face value here — apiFetch's own
      // refresh-or-SessionExpiredError handling is what actually proves
      // (or disproves) it's still good, the first time a real API call
      // is made. Re-verifying it here too would just be a second,
      // redundant round trip for the common case where it's fine.
      const session = await getSession();
      if (session) {
        setStatus("authenticated");
        await loadDriverId();
        return;
      }
      await attemptStoredLogin();
    })();
  }, [loadDriverId, attemptStoredLogin]);

  async function enroll(badgeToken: string): Promise<void> {
    setErrorMessage(null);
    const { privateKeyHex, publicKeyDerBase64 } = generateDeviceKeypair();
    try {
      await enrollDevice(badgeToken, publicKeyDerBase64);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not enroll this device.");
      return;
    }
    // Only persisted once enrollment itself succeeded — a failed
    // attempt (e.g. a mistyped/invalid badge token) shouldn't leave
    // stale credentials behind for a badge that was never actually
    // linked to this device.
    await saveDeviceCredentials({ privateKeyHex, badgeToken });
    setStatus("pending-approval");
  }

  async function retryLogin(): Promise<void> {
    setErrorMessage(null);
    await attemptStoredLogin();
  }

  async function signOut(): Promise<void> {
    await clearSession();
    await clearDeviceCredentials();
    setErrorMessage(null);
    setDriverId(null);
    setStatus("needs-enroll");
  }

  return (
    <AuthContext.Provider value={{ status, errorMessage, driverId, enroll, retryLogin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() must be used within AuthProvider");
  return ctx;
}
