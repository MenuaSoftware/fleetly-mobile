/**
 * `crypto.randomUUID()` is a real WebCrypto method but not one
 * react-native-get-random-values polyfills — that package only patches
 * `crypto.getRandomValues`, confirmed by reading its own README rather
 * than assumed. Building a v4 UUID from getRandomValues directly (the
 * standard, well-documented construction) avoids depending on an API
 * this app's actual RN runtime may not have, rather than gambling that
 * `crypto.randomUUID` happens to exist too.
 */
export function randomUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
