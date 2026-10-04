import type {
  BootstrapRequest,
  HomeAreaRequest,
  IdentifyRequest,
  PetsRequest,
  PushTokenRequest,
  VetRequest,
} from '@core/api.ts';
import { isValidTimeZone } from '@core/period.ts';
import { ApiError } from './errors.ts';

/**
 * Request validation. Every rule mirrors a database check constraint (named in the comments), so an
 * invalid request is a 400 before any write and a 23514 never surfaces as a 500.
 */

const bad = (msg: string) => new ApiError('invalid_input', msg);

type Obj = Record<string, unknown>;
function obj(v: unknown, what = 'Request body'): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    throw bad(`${what} must be an object.`);
  return v as Obj;
}
function str(v: unknown, field: string, min: number, max: number): string {
  if (typeof v !== 'string') throw bad(`${field} must be a string.`);
  const s = v.trim();
  if (s.length < min || s.length > max) throw bad(`${field} must be ${min} to ${max} characters.`);
  return s;
}
function optStr(v: unknown, field: string, max: number): string | null {
  if (v === undefined || v === null) return null;
  const s = str(v, field, 0, max);
  return s === '' ? null : s;
}
function num(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
    throw bad(`${field} must be a number from ${min} to ${max}.`);
  }
  return v;
}

const HANDLE = /^[a-z0-9_]{3,20}$/; // profiles.handle check
const COUNTRY = /^[A-Z]{2}$/; // profiles.country_code check
const PHONE = /^[0-9 +()-]{5,25}$/; // household_vets.phone check

function handle(v: unknown): string {
  const h = str(v, 'handle', 1, 40).toLowerCase();
  if (!HANDLE.test(h)) throw bad('Handle must be 3 to 20 letters, digits or underscores.');
  return h;
}
const IANA_ZONE = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$/;

/** IANA names only (no offsets such as +05:00 or UTC+5), stored in the canonical spelling. */
function timezone(v: unknown): string {
  const tz = str(v, 'timezone', 1, 64);
  if ((tz !== 'UTC' && !IANA_ZONE.test(tz)) || !isValidTimeZone(tz)) throw bad('Unknown timezone.');
  return new Intl.DateTimeFormat(undefined, { timeZone: tz }).resolvedOptions().timeZone;
}
function country(v: unknown): string {
  const c = str(v, 'countryCode', 2, 2);
  if (!COUNTRY.test(c)) throw bad('countryCode must be two upper-case letters.');
  return c;
}
function displayName(v: unknown): string | null {
  return optStr(v, 'displayName', 60); // profiles.display_name <= 60
}

export function parseBootstrap(body: unknown): BootstrapRequest {
  const o = obj(body);
  if (o.ageConfirmed13Plus !== true) throw bad('You must confirm you are 13 or older.');
  const out: BootstrapRequest = {
    ageConfirmed13Plus: true,
    timezone: timezone(o.timezone),
    countryCode: country(o.countryCode),
  };
  if (o.handle !== undefined && o.handle !== null) out.handle = handle(o.handle);
  const name = displayName(o.displayName);
  if (name !== null) out.displayName = name;
  return out;
}

export type ProfilePatch = {
  handle?: string;
  displayName?: string | null;
  timezone?: string;
  countryCode?: string;
};
export function parseProfilePatch(body: unknown): ProfilePatch {
  const o = obj(body);
  const out: ProfilePatch = {};
  if (o.handle !== undefined) out.handle = handle(o.handle);
  if (o.displayName !== undefined) out.displayName = displayName(o.displayName);
  if (o.timezone !== undefined) out.timezone = timezone(o.timezone);
  if (o.countryCode !== undefined) out.countryCode = country(o.countryCode);
  if (Object.keys(out).length === 0) throw bad('Nothing to update.');
  return out;
}

export function parsePets(body: unknown): PetsRequest {
  const o = obj(body);
  if (!Array.isArray(o.pets) || o.pets.length > 20) throw bad('pets must be a list of up to 20.');
  const pets = o.pets.map((p, i): PetsRequest['pets'][number] => {
    const po = obj(p, `pets[${i}]`);
    const animal = po.animal;
    if (animal !== 'cat' && animal !== 'dog' && animal !== 'other') {
      throw bad('Pet animal must be cat, dog or other.'); // household_pets.animal check
    }
    return { animal, name: optStr(po.name, 'Pet name', 30) }; // name <= 30
  });
  return { householdId: optStr(o.householdId, 'householdId', 64) ?? undefined, pets };
}

export function parseVet(body: unknown): VetRequest {
  const o = obj(body);
  const phone = str(o.phone, 'phone', 5, 25);
  if (!PHONE.test(phone)) throw bad('Phone number has characters we cannot use.');
  return {
    householdId: optStr(o.householdId, 'householdId', 64) ?? undefined,
    name: str(o.name, 'name', 1, 80), // household_vets.name 1..80
    phone,
  };
}

/** The stored radius is 1.5x the requested one and privacy_zones.radius_m is 200..30000, so 200..20000 here. */
export function parseHomeArea(body: unknown): HomeAreaRequest {
  const o = obj(body);
  return {
    lat: num(o.lat, 'lat', -90, 90),
    lng: num(o.lng, 'lng', -180, 180),
    radiusM: num(o.radiusM, 'radiusM', 200, 20000),
  };
}

export function parsePushToken(body: unknown): PushTokenRequest {
  const o = obj(body);
  if (o.platform !== 'ios' && o.platform !== 'android')
    throw bad('platform must be ios or android.');
  return { token: str(o.token, 'token', 1, 4096), platform: o.platform };
}

const SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * A storage path is `<uid>/<...>`: every segment is non-empty and plain, with no `..`. A path inside
 * another user's folder is `forbidden`; a malformed one is `invalid_input`.
 */
export function assertPhotoPath(path: unknown, uid: string): string {
  if (typeof path !== 'string' || path.length > 200) throw bad('Photo path is not valid.');
  const segments = path.split('/');
  if (
    segments.length < 2 ||
    segments.some((s) => !SEGMENT.test(s) || s === '.' || s.includes('..'))
  ) {
    throw bad('Photo path is not valid.');
  }
  if (segments[0] !== uid) throw new ApiError('forbidden', 'That photo is not yours.');
  return path;
}

const DEVICE_TIME_SKEW_MS = 2 * 24 * 60 * 60 * 1000;

export function parseIdentify(body: unknown, uid: string, now: Date): IdentifyRequest {
  const o = obj(body);
  if (!Array.isArray(o.photos) || o.photos.length < 1 || o.photos.length > 5) {
    throw bad('Send 1 to 5 photos.');
  }
  const seen = new Set<string>();
  const photos = o.photos.map((p, i): IdentifyRequest['photos'][number] => {
    const po = obj(p, `photos[${i}]`);
    const path = assertPhotoPath(po.path, uid);
    if (seen.has(path)) throw bad('Each photo must be a different file.');
    seen.add(path);
    const organ = po.organ;
    if (organ !== 'leaf' && organ !== 'flower' && organ !== 'whole') {
      throw bad('organ must be leaf, flower or whole.'); // observation_photos.organ check
    }
    return { path, organ };
  });
  if (o.captureSource !== 'camera' && o.captureSource !== 'gallery') {
    throw bad('captureSource must be camera or gallery.'); // observations.capture_source check
  }
  let location: IdentifyRequest['location'] = null;
  if (o.location !== null && o.location !== undefined) {
    const l = obj(o.location, 'location');
    if (typeof l.mocked !== 'boolean') throw bad('location.mocked must be true or false.');
    location = {
      lat: num(l.lat, 'location.lat', -90, 90),
      lng: num(l.lng, 'location.lng', -180, 180),
      accuracyM: num(l.accuracyM, 'location.accuracyM', 0, 1_000_000), // accuracy_m >= 0
      mocked: l.mocked,
    };
  }
  const deviceMs = typeof o.deviceTime === 'string' ? Date.parse(o.deviceTime) : NaN;
  if (Number.isNaN(deviceMs) || Math.abs(deviceMs - now.getTime()) > DEVICE_TIME_SKEW_MS) {
    throw bad('deviceTime must be a date-time within two days of now.');
  }
  if (typeof o.healthCheck !== 'boolean') throw bad('healthCheck must be true or false.');
  return {
    photos,
    captureSource: o.captureSource,
    location,
    deviceTime: new Date(deviceMs).toISOString(),
    healthCheck: o.healthCheck,
  };
}

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // the bucket's file_size_limit

/** JPEG SOI marker (FF D8 FF) and the bucket size limit, checked before any parsing. */
export function assertJpegUpload(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_PHOTO_BYTES) throw bad('Photo is larger than 10 MB.');
  if (bytes.byteLength < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw bad('Photo is not a valid JPEG.');
  }
}
