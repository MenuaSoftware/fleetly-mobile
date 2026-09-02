/**
 * The QR payload format shared with fleetly-admin, which prints these
 * codes (see its own src/lib/qr-payload.ts — the same two prefixes,
 * hand-mirrored the way this project mirrors API types across repos
 * rather than sharing a package).
 *
 *   fleetly:badge:<raw badge token>
 *   fleetly:vehicle:<vehicle uuid>
 *
 * Namespaced rather than bare so a driver who scans the wrong sticker
 * gets told what happened ("that's a vehicle code, not a badge")
 * instead of a confusing failure two screens later — a vehicle id
 * submitted as a badge token would otherwise just come back as a flat
 * "badge is no longer valid" from the API.
 *
 * A bare value with no prefix is still accepted, deliberately: manual
 * entry is kept as a fallback everywhere the scanner is offered (no
 * camera on web, no camera permission, a damaged sticker), and typing
 * a plain code must keep working exactly as it did before scanning
 * existed.
 */

export type ScanKind = "badge" | "vehicle";

export type ParsedScan =
  | { ok: true; value: string }
  | { ok: false; message: string };

const PREFIX: Record<ScanKind, string> = {
  badge: "fleetly:badge:",
  vehicle: "fleetly:vehicle:",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What to call each kind in a message the driver actually reads. */
const LABEL: Record<ScanKind, string> = {
  badge: "badge",
  vehicle: "vehicle",
};

/**
 * Parses a scanned (or typed) code, checking it's the kind the current
 * screen asked for. `expected` is what the screen wants, not what the
 * code claims to be.
 */
export function parseScannedCode(raw: string, expected: ScanKind): ParsedScan {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "That code was empty. Try again." };
  }

  const wrongKind = (Object.keys(PREFIX) as ScanKind[]).find(
    (kind) => kind !== expected && trimmed.startsWith(PREFIX[kind]),
  );
  if (wrongKind) {
    return {
      ok: false,
      message: `That's a ${LABEL[wrongKind]} code. Scan the ${LABEL[expected]} code instead.`,
    };
  }

  const prefix = PREFIX[expected];
  const value = trimmed.startsWith(prefix)
    ? trimmed.slice(prefix.length).trim()
    : trimmed;

  if (!value) {
    return { ok: false, message: `That ${LABEL[expected]} code is empty.` };
  }

  // Another app's QR (a URL, a wifi payload) is far more likely than a
  // corrupt Fleetly one — say so plainly rather than passing it to the
  // API and surfacing whatever that rejects it with.
  if (!trimmed.startsWith(prefix) && value.includes(":")) {
    return {
      ok: false,
      message: `That doesn't look like a Fleetly ${LABEL[expected]} code.`,
    };
  }

  if (expected === "vehicle" && !UUID_RE.test(value)) {
    return {
      ok: false,
      message: "That doesn't look like a Fleetly vehicle code.",
    };
  }

  return { ok: true, value };
}
