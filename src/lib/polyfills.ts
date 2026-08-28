// Must be imported before anything that touches Buffer or
// crypto.getRandomValues (src/lib/crypto.ts, ultimately @noble/curves) —
// neither exists natively in React Native's JS runtime (Hermes), unlike
// Node or a real browser. Imported first thing in the root layout so
// every screen gets it, not per-file.
import { Buffer } from "buffer";
import "react-native-get-random-values";

if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}
