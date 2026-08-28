// Buffer + crypto.getRandomValues polyfills load from src/lib/polyfills.ts,
// imported once in the root layout — not repeated here.
import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";

/**
 * P-256 SPKI DER header (fixed, RFC 5480 / SEC1): algorithm =
 * id-ecPublicKey, parameters = prime256v1. What follows is the raw
 * uncompressed point (0x04 || X(32) || Y(32)) noble's getPublicKey(sk,
 * false) returns. Verified against Node's own crypto.createPublicKey
 * (the exact function the backend uses) before this was ever load-
 * bearing, not just assumed from the ASN.1 spec.
 */
const P256_SPKI_DER_PREFIX = Buffer.from(
  "3059301306072a8648ce3d020106082a8648ce3d030107034200",
  "hex",
);

function toSpkiDerBase64(rawUncompressedPoint: Uint8Array): string {
  return Buffer.concat([P256_SPKI_DER_PREFIX, Buffer.from(rawUncompressedPoint)]).toString(
    "base64",
  );
}

export interface DeviceKeypair {
  /** Hex-encoded 32-byte secret key. Never leaves the device. */
  privateKeyHex: string;
  /** Base64 SPKI DER — exactly the shape EnrollDeviceDto.publicKey expects. */
  publicKeyDerBase64: string;
}

/**
 * Generated once per device, at enrollment. p256.keygen()'s own
 * publicKey comes back compressed with no way to ask for uncompressed —
 * confirmed by reading @noble/curves' own .d.ts — so the uncompressed
 * point SPKI DER needs is derived separately via getPublicKey(sk, false).
 */
export function generateDeviceKeypair(): DeviceKeypair {
  const { secretKey } = p256.keygen();
  const publicKeyRaw = p256.getPublicKey(secretKey, false);
  return {
    privateKeyHex: Buffer.from(secretKey).toString("hex"),
    publicKeyDerBase64: toSpkiDerBase64(publicKeyRaw),
  };
}

export interface SignedChallenge {
  signature: string;
  timestamp: string;
}

/**
 * Signs `${badgeToken}.${timestampIso}` — the exact payload shape
 * BadgeLoginService.verify() checks — and produces a DER-encoded
 * signature (not raw r‖s / IEEE P1363), matching Node's crypto.verify()
 * default mode the backend uses.
 *
 * This exact combination (noble's DER output, against Node's default
 * verify, round-tripped through the real running API) was verified end
 * to end before being relied on here — specifically because
 * BadgeLoginService's own doc comment flags the signature encoding as
 * unconfirmed for real device output ("check this against actual device
 * output before this is load-bearing, don't assume DER is correct").
 * That check happened; this is the result of it, not a guess.
 */
export function signLoginChallenge(privateKeyHex: string, badgeToken: string): SignedChallenge {
  const timestamp = new Date().toISOString();
  const payload = `${badgeToken}.${timestamp}`;
  const messageHash = sha256(new TextEncoder().encode(payload));
  const secretKey = Buffer.from(privateKeyHex, "hex");

  const derSignature = p256.sign(messageHash, secretKey, {
    lowS: true,
    prehash: false,
    format: "der",
  });

  return {
    signature: Buffer.from(derSignature).toString("base64"),
    timestamp,
  };
}
