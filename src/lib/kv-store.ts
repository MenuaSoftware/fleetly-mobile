import * as SecureStore from "expo-secure-store";

/**
 * Native (iOS/Android) implementation — backs onto Keychain/Keystore
 * via expo-secure-store. Metro resolves kv-store.web.ts instead of this
 * file when bundling for web (same platform-extension convention the
 * scaffold's own use-color-scheme.web.ts already uses).
 */
export async function getItem(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
