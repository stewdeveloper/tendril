import exifr from 'exifr';
import { ApiError } from './errors.ts';

const bad = (msg = 'Photo is not a valid JPEG.') => new ApiError('invalid_input', msg);

type Segment = { marker: number; start: number; end: number };

/**
 * Walks a JPEG up to and including SOS. Returns the header segments and the offset where
 * entropy-coded data begins. Throws `invalid_input` for anything malformed.
 */
function walk(jpeg: Uint8Array): { segments: Segment[]; dataStart: number } {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw bad();
  const segments: Segment[] = [];
  let i = 2;
  while (i < jpeg.length) {
    if (jpeg[i] !== 0xff) throw bad();
    while (i < jpeg.length && jpeg[i] === 0xff) i++; // fill bytes
    const marker = jpeg[i];
    const markerStart = i - 1;
    i++;
    if (marker === undefined || marker === 0x00 || marker === 0xd8) throw bad();
    if (marker === 0xd9) throw bad('Photo has no image data.');
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      segments.push({ marker, start: markerStart, end: i });
      continue;
    }
    if (i + 2 > jpeg.length) throw bad();
    const len = (jpeg[i] << 8) | jpeg[i + 1];
    if (len < 2 || i + len > jpeg.length) throw bad();
    const end = i + len;
    segments.push({ marker, start: markerStart, end });
    i = end;
    if (marker === 0xda) return { segments, dataStart: end };
  }
  throw bad('Photo has no image data.');
}

const isMetadata = (m: number) => (m >= 0xe1 && m <= 0xef) || m === 0xfe;

/**
 * Keeps SOI, APP0 (JFIF), the table/frame segments, SOS and the entropy-coded data through EOI.
 * Drops every APP1-APP15 segment (Exif, XMP, IPTC, ICC...) and every COM segment, plus anything after EOI.
 */
export function stripExif(jpeg: Uint8Array): Uint8Array {
  const { segments, dataStart } = walk(jpeg);
  let eoi = -1;
  for (let i = dataStart; i + 1 < jpeg.length; i++) {
    if (jpeg[i] === 0xff && jpeg[i + 1] === 0xd9) {
      eoi = i + 2;
      break;
    }
  }
  if (eoi < 0) throw bad('Photo is truncated.');
  const parts: Uint8Array[] = [new Uint8Array([0xff, 0xd8])];
  for (const s of segments) if (!isMetadata(s.marker)) parts.push(jpeg.subarray(s.start, s.end));
  parts.push(jpeg.subarray(dataStart, eoi));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const LOCATION_KEY = /gps|latitude|longitude|location|city|country|sublocation/i;

/** Throws `invalid_input` if any metadata segment or GPS/location tag survives in the JPEG. */
export async function assertNoGps(jpeg: Uint8Array): Promise<void> {
  const { segments } = walk(jpeg);
  if (segments.some((s) => isMetadata(s.marker))) {
    throw new ApiError('invalid_input', 'Photo still contains metadata.');
  }
  const parsed = (await exifr.parse(jpeg, { gps: true, xmp: true, iptc: true })) as
    Record<string, unknown> | undefined;
  if (parsed && Object.keys(parsed).some((k) => LOCATION_KEY.test(k))) {
    throw new ApiError('invalid_input', 'Photo still contains location data.');
  }
}
