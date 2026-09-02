import { parseScannedCode } from "./qr-payload";

/**
 * The scanner hands whatever the camera read straight to
 * parseScannedCode, so this is where the QR contract with
 * fleetly-admin is actually pinned down — the camera itself can't be
 * driven in a test, but every decision made about what it saw can.
 */
describe("parseScannedCode", () => {
  const VEHICLE_UUID = "5e808835-06a1-4938-8b99-cd77c5ab64c9";

  describe("badge codes", () => {
    it("unwraps a badge payload printed by the admin panel", () => {
      expect(parseScannedCode("fleetly:badge:MHOD_LL5XUMW", "badge")).toEqual({
        ok: true,
        value: "MHOD_LL5XUMW",
      });
    });

    it("accepts a bare token, so typing a code by hand still works", () => {
      expect(parseScannedCode("MHOD_LL5XUMW", "badge")).toEqual({
        ok: true,
        value: "MHOD_LL5XUMW",
      });
    });

    it("tells a driver who scanned the van sticker what they actually scanned", () => {
      const result = parseScannedCode(`fleetly:vehicle:${VEHICLE_UUID}`, "badge");
      expect(result.ok).toBe(false);
      // The specific wording matters less than that it names both
      // kinds — "invalid code" would leave the driver guessing.
      expect(result.ok === false && result.message).toMatch(/vehicle code/i);
      expect(result.ok === false && result.message).toMatch(/badge/i);
    });

    it("rejects some other app's QR rather than sending it to the API", () => {
      const result = parseScannedCode("https://example.com/promo", "badge");
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.message).toMatch(/Fleetly badge code/i);
    });

    it("rejects an empty scan", () => {
      expect(parseScannedCode("   ", "badge").ok).toBe(false);
    });

    it("rejects a badge payload with nothing after the prefix", () => {
      expect(parseScannedCode("fleetly:badge:", "badge").ok).toBe(false);
    });

    it("ignores whitespace around a scanned value", () => {
      expect(parseScannedCode("  fleetly:badge:ABC123  ", "badge")).toEqual({
        ok: true,
        value: "ABC123",
      });
    });
  });

  describe("vehicle codes", () => {
    it("unwraps a vehicle payload printed by the admin panel", () => {
      expect(parseScannedCode(`fleetly:vehicle:${VEHICLE_UUID}`, "vehicle")).toEqual({
        ok: true,
        value: VEHICLE_UUID,
      });
    });

    it("accepts a bare vehicle id, matching the pre-QR manual entry", () => {
      expect(parseScannedCode(VEHICLE_UUID, "vehicle")).toEqual({
        ok: true,
        value: VEHICLE_UUID,
      });
    });

    it("tells a driver who scanned their badge what they actually scanned", () => {
      const result = parseScannedCode("fleetly:badge:MHOD_LL5XUMW", "vehicle");
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.message).toMatch(/badge code/i);
      expect(result.ok === false && result.message).toMatch(/vehicle/i);
    });

    it("rejects a vehicle code that is not a uuid, before any API call", () => {
      // A badge-shaped token in the vehicle slot would otherwise become
      // a pointless request that comes back as a flat 404.
      expect(parseScannedCode("fleetly:vehicle:NOT-A-UUID", "vehicle").ok).toBe(false);
      expect(parseScannedCode("MHOD_LL5XUMW", "vehicle").ok).toBe(false);
    });

    it("accepts an uppercase uuid — QR encoders are free to normalise case", () => {
      const upper = VEHICLE_UUID.toUpperCase();
      expect(parseScannedCode(`fleetly:vehicle:${upper}`, "vehicle")).toEqual({
        ok: true,
        value: upper,
      });
    });
  });
});
