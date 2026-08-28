import * as kvStore from "./kv-store";

/**
 * Everything here is per-device secret material — the device private
 * key never leaves the phone (that's the whole point of the badge/
 * device auth model), and the session tokens are exactly as sensitive
 * as any other bearer credential. kv-store.ts backs this onto Keychain
 * (iOS) / Keystore (Android) via expo-secure-store; kv-store.web.ts is
 * a plaintext localStorage fallback that only exists because this dev
 * machine has no physical device or simulator to test against — see
 * that file's own comment before assuming it's a real security
 * boundary anywhere.
 */

const DEVICE_KEY = "fleetly.device.privateKeyHex";
const BADGE_TOKEN_KEY = "fleetly.device.badgeToken";
const ACCESS_TOKEN_KEY = "fleetly.session.accessToken";
const REFRESH_TOKEN_KEY = "fleetly.session.refreshToken";

export interface StoredDevice {
  privateKeyHex: string;
  badgeToken: string;
}

export async function saveDeviceCredentials(device: StoredDevice): Promise<void> {
  await kvStore.setItem(DEVICE_KEY, device.privateKeyHex);
  await kvStore.setItem(BADGE_TOKEN_KEY, device.badgeToken);
}

export async function getDeviceCredentials(): Promise<StoredDevice | null> {
  const [privateKeyHex, badgeToken] = await Promise.all([
    kvStore.getItem(DEVICE_KEY),
    kvStore.getItem(BADGE_TOKEN_KEY),
  ]);
  if (!privateKeyHex || !badgeToken) return null;
  return { privateKeyHex, badgeToken };
}

/**
 * Wipes the device's enrollment entirely — used when a badge is
 * reported invalid (revoked/reissued to someone else), the one case
 * where this device's credentials can never work again and re-
 * enrollment is the only path forward.
 */
export async function clearDeviceCredentials(): Promise<void> {
  await kvStore.deleteItem(DEVICE_KEY);
  await kvStore.deleteItem(BADGE_TOKEN_KEY);
}

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
}

export async function saveSession(session: StoredSession): Promise<void> {
  await kvStore.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  await kvStore.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
}

export async function getSession(): Promise<StoredSession | null> {
  const [accessToken, refreshToken] = await Promise.all([
    kvStore.getItem(ACCESS_TOKEN_KEY),
    kvStore.getItem(REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function clearSession(): Promise<void> {
  await kvStore.deleteItem(ACCESS_TOKEN_KEY);
  await kvStore.deleteItem(REFRESH_TOKEN_KEY);
}
