import * as ImagePicker from "expo-image-picker";
import { sha256 } from "@noble/hashes/sha2.js";
import { apiFetch, ApiError } from "./api";

export type PhotoType = "front" | "left" | "right" | "rear";

export interface PickedPhoto {
  uri: string;
  base64: string;
  mimeType: string;
  byteSize: number;
  fileName: string;
}

/**
 * The library picker, not the live camera — maps to a real
 * `<input type="file">` on web (the only target testable on this dev
 * machine, no physical device), and is a perfectly legitimate primary
 * path on native too, not just a testing compromise: plenty of real
 * fleet apps let a driver pick an existing photo, not just shoot one
 * live. A dedicated camera capture button can be added later without
 * touching anything downstream of this function — uploadPhoto() only
 * needs the same {uri, base64, mimeType, byteSize} shape however it
 * was obtained.
 */
export async function pickPhoto(): Promise<PickedPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Photo library access is needed to add photos.");
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    base64: true,
  });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  if (!asset.base64) {
    throw new Error("Could not read this photo. Try a different one.");
  }
  const mimeType = asset.mimeType ?? "image/jpeg";
  return {
    uri: asset.uri,
    base64: asset.base64,
    mimeType,
    byteSize: asset.fileSize ?? Math.ceil((asset.base64.length * 3) / 4),
    fileName: asset.fileName ?? `${photoTypeFallbackName(mimeType)}`,
  };
}

function photoTypeFallbackName(mimeType: string): string {
  const extension = mimeType.split("/")[1] ?? "jpg";
  return `photo-${Date.now()}.${extension}`;
}

/** Node's Buffer (polyfilled — see src/lib/polyfills.ts) decodes base64 identically on native and web. */
function base64ToBytes(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, "base64"));
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export interface UploadPhotoResult {
  photoId: string;
}

/**
 * The full round trip CreatePhotoIntentDto/trip-photo.controller.ts
 * expects: ask the API for a signed upload slot, PUT the actual bytes
 * straight to Supabase Storage (not through our own API — the signed
 * URL is exactly for bypassing that), then confirm so the server
 * re-checks the uploaded object's real size against what was declared.
 * checksum is client-computed and recorded as declared, not re-verified
 * server-side — see CreatePhotoIntentDto's own comment on why.
 */
export async function uploadPhoto(
  tripId: string,
  photoType: PhotoType,
  photo: PickedPhoto,
): Promise<UploadPhotoResult> {
  const bytes = base64ToBytes(photo.base64);
  const checksum = bytesToHex(sha256(bytes));

  const intent = await apiFetch<{ photoId: string; uploadUrl: string }>(
    `/trips/${tripId}/photos`,
    {
      method: "POST",
      body: {
        photoType,
        mimeType: photo.mimeType,
        byteSize: bytes.byteLength,
        checksum,
        originalFilename: photo.fileName,
        capturedAt: new Date().toISOString(),
      },
    },
  );

  // A Uint8Array is a genuinely valid fetch body at runtime everywhere
  // (Node, browsers, RN's fetch) — this cast works around a TypeScript/
  // DOM-lib version friction (recent TS's typed-array generics vs the
  // DOM lib's BodyInit union rejecting ArrayBufferLike's
  // SharedArrayBuffer arm), not a real type error.
  const uploadRes = await fetch(intent.uploadUrl, {
    method: "PUT",
    headers: { "content-type": photo.mimeType },
    body: bytes as BodyInit,
  });
  if (!uploadRes.ok) {
    throw new ApiError(`Could not upload the photo (${uploadRes.status}).`, uploadRes.status);
  }

  await apiFetch(`/trips/${tripId}/photos/${intent.photoId}/confirm`, { method: "POST" });
  return { photoId: intent.photoId };
}

/**
 * damage-photo.controller.ts's intent/confirm shape — same signed-URL
 * round trip as uploadPhoto() above (ask for a slot, PUT the bytes
 * straight to Storage, confirm), just against
 * /vehicles/:vehicleId/damage/:damageId/photos instead of a trip's own
 * photos. Used for damage reported at the closing condition check,
 * which report-damage-view.tsx's own comment explains is gated exactly
 * like the four end photos — this is that gate's photo half.
 */
export async function uploadDamagePhoto(
  vehicleId: string,
  damageId: string,
  photo: PickedPhoto,
): Promise<UploadPhotoResult> {
  const bytes = base64ToBytes(photo.base64);
  const checksum = bytesToHex(sha256(bytes));

  const intent = await apiFetch<{ photoId: string; uploadUrl: string }>(
    `/vehicles/${vehicleId}/damage/${damageId}/photos`,
    {
      method: "POST",
      body: {
        mimeType: photo.mimeType,
        byteSize: bytes.byteLength,
        checksum,
        originalFilename: photo.fileName,
        capturedAt: new Date().toISOString(),
      },
    },
  );

  const uploadRes = await fetch(intent.uploadUrl, {
    method: "PUT",
    headers: { "content-type": photo.mimeType },
    body: bytes as BodyInit,
  });
  if (!uploadRes.ok) {
    throw new ApiError(`Could not upload the photo (${uploadRes.status}).`, uploadRes.status);
  }

  await apiFetch(`/vehicles/${vehicleId}/damage/${damageId}/photos/${intent.photoId}/confirm`, {
    method: "POST",
  });
  return { photoId: intent.photoId };
}
