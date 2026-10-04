import type {
  BootstrapRequest,
  CheckInRequest,
  ConfirmRequest,
  CreatePlantRequest,
  HomeAreaRequest,
  IdentifyRequest,
  PetsRequest,
  PlantStatusRequest,
  PushTokenRequest,
  VetRequest,
} from '@core/api.ts';
import type { LeafState, PlantSetup } from '@core/domain.ts';
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUuid(v: unknown, field: string): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw bad(`${field} must be an id.`);
  return v.toLowerCase();
}

function oneOf<T extends string>(v: unknown, field: string, allowed: readonly T[]): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    throw bad(`${field} must be one of ${allowed.join(', ')}.`);
  }
  return v as T;
}

/** plants.nickname 1..40, room <= 40, pot_size_cm 4..200, and the light / pot_material / drainage enums. */
export function parseSetup(v: unknown): PlantSetup {
  const o = obj(v, 'setup');
  if (typeof o.indoor !== 'boolean') throw bad('setup.indoor must be true or false.');
  let potSizeCm: number | null = null;
  if (o.potSizeCm !== null && o.potSizeCm !== undefined) {
    potSizeCm = num(o.potSizeCm, 'setup.potSizeCm', 4, 200);
    if (!Number.isInteger(potSizeCm)) throw bad('setup.potSizeCm must be a whole number.');
  }
  return {
    nickname: str(o.nickname, 'setup.nickname', 1, 40),
    room: optStr(o.room, 'setup.room', 40),
    light: oneOf(o.light, 'setup.light', ['bright', 'medium', 'low', 'unknown']),
    potMaterial: oneOf(o.potMaterial, 'setup.potMaterial', [
      'plastic',
      'terracotta',
      'ceramic',
      'unknown',
    ]),
    potSizeCm,
    drainage: oneOf(o.drainage, 'setup.drainage', ['yes', 'no', 'unknown']),
    indoor: o.indoor,
  };
}

/**
 * observations.intent and place_type checks. A plant you add lives at home, so add_plant takes a setup and no place;
 * a find must say where it was (that decides whether its area may be shared), so log_find requires one.
 */
export function parseConfirm(body: unknown): ConfirmRequest {
  const o = obj(body);
  const action = oneOf(o.action, 'action', ['add_plant', 'log_find'] as const);
  const out: ConfirmRequest = { speciesId: assertUuid(o.speciesId, 'speciesId'), action };
  const hasPlace = o.placeType !== undefined && o.placeType !== null;
  if (action === 'add_plant') {
    if (hasPlace) throw bad('placeType is only for finds.');
    out.setup = parseSetup(o.setup);
    if (o.householdId !== undefined && o.householdId !== null) {
      out.householdId = assertUuid(o.householdId, 'householdId');
    }
  } else {
    if (!hasPlace) throw bad('placeType is required for a find.');
    out.placeType = oneOf(o.placeType, 'placeType', ['shop', 'garden_park', 'wild'] as const);
  }
  return out;
}

export type LabelEvent = { event: 'app_open' | 'store_click'; platform: 'ios' | 'android' | 'web' };
/** Public beacon: only the two events a stranger may report (adoption is written by care). */
export function parseLabelEvent(body: unknown): LabelEvent {
  const o = obj(body);
  return {
    event: oneOf(o.event, 'event', ['app_open', 'store_click'] as const),
    platform: oneOf(o.platform, 'platform', ['ios', 'android', 'web'] as const),
  };
}

const TIME_SKEW_MS = 2 * 24 * 60 * 60 * 1000;
/** A date-time within two days of now (a queued offline action may be a little old, never far from the clock). */
function instant(v: unknown, field: string, now: Date): string {
  const ms = typeof v === 'string' ? Date.parse(v) : NaN;
  if (Number.isNaN(ms) || Math.abs(ms - now.getTime()) > TIME_SKEW_MS) {
    throw bad(`${field} must be a date-time within two days of now.`);
  }
  return new Date(ms).toISOString();
}

const LABEL_CODE = /^[A-Z0-9-]{4,32}$/; // qr_codes.code check
const LEAF_STATES: readonly LeafState[] = [
  'healthy',
  'yellowing',
  'drooping',
  'brown_tips',
  'spots',
];

/** A new plant from a label (the code decides the species), or by hand or as a gift (the species is named). */
export function parseCreatePlant(body: unknown): CreatePlantRequest {
  const o = obj(body);
  const source = oneOf(o.source, 'source', ['label_qr', 'manual', 'gift'] as const);
  const out: CreatePlantRequest = { source, setup: parseSetup(o.setup) };
  if (source === 'label_qr') {
    const code = str(o.labelCode, 'labelCode', 4, 32).toUpperCase();
    if (!LABEL_CODE.test(code)) throw bad('labelCode is not a valid label code.');
    out.labelCode = code;
  } else {
    out.speciesId = assertUuid(o.speciesId, 'speciesId');
  }
  if (o.householdId !== undefined && o.householdId !== null) {
    out.householdId = assertUuid(o.householdId, 'householdId');
  }
  return out;
}

export type PlantPatch = Partial<
  Pick<
    PlantSetup,
    'nickname' | 'room' | 'light' | 'potMaterial' | 'potSizeCm' | 'drainage' | 'indoor'
  >
>;
const PATCH_FIELDS = [
  'nickname',
  'room',
  'light',
  'potMaterial',
  'potSizeCm',
  'drainage',
  'indoor',
];

/** Only the setup fields may change; the species, household and status have their own routes (or none). */
export function parsePlantPatch(body: unknown): PlantPatch {
  const o = obj(body);
  for (const k of Object.keys(o))
    if (!PATCH_FIELDS.includes(k)) throw bad(`${k} cannot be changed.`);
  const out: PlantPatch = {};
  // Same rule as core's isValidNickname: 1 to 40 characters once trimmed.
  if (o.nickname !== undefined) out.nickname = str(o.nickname, 'nickname', 1, 40);
  if (o.room !== undefined) out.room = optStr(o.room, 'room', 40);
  if (o.light !== undefined) {
    out.light = oneOf(o.light, 'light', ['bright', 'medium', 'low', 'unknown'] as const);
  }
  if (o.potMaterial !== undefined) {
    out.potMaterial = oneOf(o.potMaterial, 'potMaterial', [
      'plastic',
      'terracotta',
      'ceramic',
      'unknown',
    ] as const);
  }
  if (o.potSizeCm !== undefined) {
    if (o.potSizeCm === null) out.potSizeCm = null;
    else {
      out.potSizeCm = num(o.potSizeCm, 'potSizeCm', 4, 200);
      if (!Number.isInteger(out.potSizeCm)) throw bad('potSizeCm must be a whole number.');
    }
  }
  if (o.drainage !== undefined) {
    out.drainage = oneOf(o.drainage, 'drainage', ['yes', 'no', 'unknown'] as const);
  }
  if (o.indoor !== undefined) {
    if (typeof o.indoor !== 'boolean') throw bad('indoor must be true or false.');
    out.indoor = o.indoor;
  }
  if (Object.keys(out).length === 0) throw bad('Nothing to update.');
  return out;
}

/** plants.death_cause <= 80. */
export function parsePlantStatus(body: unknown): PlantStatusRequest {
  const o = obj(body);
  const out: PlantStatusRequest = {
    status: oneOf(o.status, 'status', ['alive', 'dead', 'given_away'] as const),
  };
  const cause = optStr(o.deathCause, 'deathCause', 80);
  if (cause !== null) out.deathCause = cause;
  return out;
}

export function parseCheckIn(body: unknown, uid: string, now: Date): CheckInRequest {
  const o = obj(body);
  if (typeof o.soilDry !== 'boolean') throw bad('soilDry must be true or false.');
  if (!Array.isArray(o.leafStates) || o.leafStates.length > LEAF_STATES.length) {
    throw bad('leafStates must be a list.');
  }
  const leafStates = [...new Set(o.leafStates.map((l) => oneOf(l, 'leafStates', LEAF_STATES)))];
  const out: CheckInRequest = {
    clientId: assertUuid(o.clientId, 'clientId'),
    plantId: assertUuid(o.plantId, 'plantId'),
    soilDry: o.soilDry,
    leafStates,
    occurredAt: instant(o.occurredAt, 'occurredAt', now),
  };
  if (o.photoPath !== undefined && o.photoPath !== null)
    out.photoPath = assertPhotoPath(o.photoPath, uid);
  return out;
}

export function parseTaskDone(body: unknown, now: Date): { clientId: string; occurredAt: string } {
  const o = obj(body);
  return {
    clientId: assertUuid(o.clientId, 'clientId'),
    occurredAt: instant(o.occurredAt, 'occurredAt', now),
  };
}
