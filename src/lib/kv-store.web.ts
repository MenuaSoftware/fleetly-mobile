/**
 * Web fallback — expo-secure-store's own web implementation is a bare
 * `export default {}` (confirmed by reading node_modules/expo-secure-
 * store/src/ExpoSecureStore.web.ts directly, not assumed from docs):
 * every method is simply undefined on web, so calling it there throws.
 * There is no built-in "weaker but working" web fallback to fall back
 * to — this is deliberately what a real product would need to replace
 * (localStorage is plaintext, readable by any script on the page) if
 * a web driver client were ever real. It exists only so `expo start
 * --web` — the only way to exercise this app on this dev machine, with
 * no physical device or simulator available — has something to run
 * against at all.
 */
export async function getItem(key: string): Promise<string | null> {
  return window.localStorage.getItem(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  window.localStorage.setItem(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  window.localStorage.removeItem(key);
}
