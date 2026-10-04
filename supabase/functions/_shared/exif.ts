/// <reference path="./piexifjs.d.ts" />
import piexif from 'piexifjs';
import exifr from 'exifr';
import { ApiError } from './errors.ts';

function toBinaryString(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return out;
}

function fromBinaryString(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Removes the Exif (APP1) segments from a JPEG. */
export function stripExif(jpeg: Uint8Array): Uint8Array {
  try {
    return fromBinaryString(piexif.remove(toBinaryString(jpeg)));
  } catch {
    throw new ApiError('invalid_input', 'Photo is not a valid JPEG.');
  }
}

/** Throws `invalid_input` if any GPS tag survives in the JPEG's metadata. */
export async function assertNoGps(jpeg: Uint8Array): Promise<void> {
  const parsed = (await exifr.parse(jpeg, { gps: true })) as Record<string, unknown> | undefined;
  const hasGps =
    parsed !== undefined &&
    Object.keys(parsed).some((k) => k.startsWith('GPS') || k === 'latitude' || k === 'longitude');
  if (hasGps) throw new ApiError('invalid_input', 'Photo still contains location data.');
}
