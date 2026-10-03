# Phase 2B: Edge Functions and App Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Load `supabase:supabase` before writing Edge Function code.

**Goal:** The live core loop runs against the local Supabase stack with fake providers: sign in, bootstrap the account, set pets and a home area, take photos, identify, see the result with pet checks, add the plant with setup answers, and check in. The Expo app talks to it through a `SupabaseApi` that implements the same `TendrilApi` as the fixture.

**Architecture:**
- **Functions:** each Edge Function has a pure `createHandler(deps)` that takes injected dependencies (database client, user verifier, providers, clock), plus a thin `index.ts` that wires up the real ones.
  - Tests call handlers with fakes, using Deno's test runner and no stack.
  - One end-to-end test runs against `supabase functions serve`.
- **Shared code:** `supabase/functions/_shared/` holds routing, errors, auth, environment, H3, EXIF stripping and the provider interfaces.
- **Domain rules:** privacy maths, periods and the basic care schedule are added to `@tendril/core`, so the app and the server agree.
- **API contracts:** request and response types live in `packages/core/src/api.ts`.

**Tech Stack:** Deno (edge runtime 2.1), `npm:@supabase/supabase-js@2`, `npm:h3-js@4.5.0`, `npm:piexifjs@1.0.6`, `npm:exifr@7`, `npm:jose@5`, `jsr:@std/assert`; app side `@supabase/supabase-js`, `react-native-url-polyfill`, `expo-sqlite/localStorage`, `expo-apple-authentication`, `@react-native-google-signin/google-signin`, `expo-linking`.

**Spec:** `docs/superpowers/specs/2026-10-03-tendril-v1-design.md` (§6.4 services, §7 API, §8.2 privacy, §8.4 quotas, §9 care engine for the free basic schedule). Builds on Phase 2A (schema) and Phase 1A/1B (`TendrilApi`).

## Global Constraints

- **Function layout:** each Edge Function directory has `index.ts` (wiring only), `handler.ts` (exports `createHandler(deps: Deps): (req: Request) => Promise<Response>`) and route modules.
  - Import core through `@core/…` and shared code through `../_shared/…`.
  - Every relative import ends in `.ts`.
  - Every function is listed in `supabase/config.toml` with `import_map = "./functions/deno.json"`. `verify_jwt = true`, except `labels` and `billing-webhook`, which are false.
- **Error body:** `{ error: { code, message, details? } }`.
  - Codes and statuses: `invalid_input` 400, `unauthenticated` 401, `forbidden` 403, `not_found` 404, `conflict` 409, `quota_exceeded` 429, `provider_unavailable` 503, `internal` 500.
  - Messages are one plain sentence. Never return a stack trace.
- **Database access:** writes go through the service-role client after an explicit authorisation check, such as household membership or ownership. Never forward the user's JWT into the admin client.
- **Quotas:**
  - `private.reserve_usage` runs **before** any paid provider call, and `private.release_usage` runs when the provider fails or finds no plant.
  - Limits: free 10 identifications and 1 diagnosis; premium 60 and 10, from `QUOTA_LIMITS`.
  - The period is the calendar month in the user's timezone (`YYYY-MM`).
- **Photos:**
  - Paths must start with `<uid>/`, or the request is rejected with 403.
  - The server strips EXIF (piexifjs `remove`), asserts no GPS remains (exifr), and re-uploads the stripped bytes before sending them anywhere.
  - At most 5 photos, each a JPEG of at most 10 MB.
- **Exact versions:** the functions run with `"lock": false`, because the edge runtime is Deno 2.1 and can't read v5 lockfiles. So every `npm:` and `jsr:` import in `supabase/functions/deno.json` must be pinned to an exact version (e.g. `npm:h3-js@4.5.0`, `npm:@supabase/supabase-js@2.117.2`), never a range. Resolve the exact current versions with `npm view <pkg> version` at implementation time.
- **H3:** res-7 and res-5 cells are computed with h3-js and stored as `bigint` via `BigInt('0x' + cell)`. `public_cell_r5` is null when the point is inside the user's privacy zone or the species is sensitive.
- **Pet toxicity:** returned rows come only from `species_toxicity`. A missing row means Unknown, and the server never invents a verdict.
- **Providers are chosen by environment variable:**
  - `IDENTIFY_PROVIDER=fake|plantid` (default `fake` locally); `PLANT_ID_API_KEY`
  - `APP_CHECK_MODE=dev|firebase` (default `dev`); `FIREBASE_PROJECT_NUMBER`; `FIREBASE_APP_IDS`
  - Fakes are deterministic.
- **App side:**
  - `EXPO_PUBLIC_API_MODE=supabase` switches to `SupabaseApi`.
  - `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are read from `apps/mobile/.env`, which is git-ignored. Commit `apps/mobile/.env.example`.
  - Sign-in uses PKCE with `detectSessionInUrl: false`, and the session is stored through `expo-sqlite/localStorage`.

## Review Focus

1. **A photo path in another user's folder** (`otheruid/x.jpg`). `identify` must return 403 before downloading anything or using quota. Tested in Task 4.
2. **The provider times out or returns 5xx after the quota was reserved.** The reservation is released, the observation is marked `failed`, and the response is `provider_unavailable`, matching "It didn't use an identification". Tested in Task 4.
3. **Confirming the same observation twice, or confirming another user's observation.** The first is idempotent; the second returns 404 (no existence leak). Tested in Task 5.
4. **A check-in on a plant in a household the user has left.** It returns 403. Retrying with the same `clientId` returns the original result. Tested in Task 6.
5. **A home area whose randomised centre must still cover the real home, for any random draw.** Tested in Task 1 with seeded random values at the extremes.

---

### Task 1: Core privacy, periods, basic care schedule and API contracts

**Files:**
- Create in `packages/core/src/`: `privacy.ts`, `period.ts`, `care/basic.ts`, `api.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/privacy.test.ts`, `packages/core/src/period.test.ts`, `packages/core/src/care/basic.test.ts`

**Interfaces:**
- Produces:
  - `privacy.ts`:
    - `distanceM(a: LatLng, b: LatLng): number` (haversine, earth radius 6,371,008.8 m)
    - `randomizeZone(home: LatLng, radiusM: number, rand: () => number): { center: LatLng; radiusM: number }`: moves the centre to a uniformly random point within `radiusM / 2` of home, then returns the radius as `Math.round(radiusM * 1.5)`, so home stays inside
    - `isInsideZone(point: LatLng, zone: { center: LatLng; radiusM: number }): boolean`
    - `type LatLng = { lat: number; lng: number }`
  - `period.ts`:
    - `localDate(now: Date, timeZone: string): IsoDate`
    - `monthKey(now: Date, timeZone: string): string` (`YYYY-MM`)
    - `nextMonthStart(now: Date, timeZone: string): IsoDate`
    - `weekdayName(iso: IsoDate): string` (e.g. "Friday")
    - `addDays(iso: IsoDate, days: number): IsoDate`
    - These use `Intl.DateTimeFormat`. An unknown timezone falls back to UTC.
  - `care/basic.ts`:
    - `baseIntervalDays(watering: { min: number | null; max: number | null }, override: number | null): number`: the override if set; otherwise the average ≤ 1.3 gives 10, ≤ 2.3 gives 7, else 4; with no data, 7
    - `basicCheckIn(input: { today: IsoDate; soilDry: boolean; baseDays: number }): { waterTaskOn: IsoDate | null; nextCheckOn: IsoDate }`: dry gives a watering task today and the next check `today + baseDays`; not dry gives the next check `today + 2`
  - `api.ts`: the request and response types used by both functions and app:
    - `ApiErrorCode`, `ApiErrorBody`
    - `BootstrapRequest`/`BootstrapResponse`, `PetsRequest`, `VetRequest`, `HomeAreaRequest`, `PushTokenRequest`
    - `IdentifyRequest`/`IdentifyResponse`, `SuggestionDto`
    - `ConfirmRequest`/`ConfirmResponse`, `OutcomeResponse` (= `Outcome`)
    - `CreatePlantRequest`/`CreatePlantResponse`, `CheckInRequest`/`CheckInResponse`, `PlantStatusRequest`
    - `LabelResponse` (= `LabelInfo | null`)

```ts
// packages/core/src/api.ts
import type { Animal } from './toxicity.ts';
import type {
  CaptureSource, CareBasics, DiagnosisResult, IsoDate, LabelInfo, LeafState, Organ, Outcome, PlaceType,
  PlantSetup, PlantStatus, QuotaState, SpeciesRef, ToxicityEntry,
} from './domain.ts';

export type ApiErrorCode =
  | 'invalid_input' | 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict'
  | 'quota_exceeded' | 'provider_unavailable' | 'internal';
export interface ApiErrorBody { error: { code: ApiErrorCode; message: string; details?: Record<string, unknown> } }

export interface BootstrapRequest { ageConfirmed13Plus: true; timezone: string; countryCode: string; handle?: string; displayName?: string }
export interface BootstrapResponse { userId: string; handle: string; householdId: string }
export interface PetsRequest { householdId?: string; pets: { animal: Animal; name: string | null }[] }
export interface VetRequest { householdId?: string; name: string; phone: string }
export interface HomeAreaRequest { lat: number; lng: number; radiusM: number }
export interface PushTokenRequest { token: string; platform: 'ios' | 'android' }

export interface IdentifyRequest {
  photos: { path: string; organ: Organ }[];
  captureSource: CaptureSource;
  location: { lat: number; lng: number; accuracyM: number; mocked: boolean } | null;
  deviceTime: string;
  healthCheck: boolean;
}
export interface SuggestionDto { species: SpeciesRef; probability: number; referenceImageUrl: string | null }
export interface IdentifyResponse {
  observationId: string;
  state: 'identified' | 'not_a_plant';
  suggestions: SuggestionDto[];
  care: CareBasics | null;
  toxicity: ToxicityEntry[];
  diagnosis: DiagnosisResult | null;
  quota: QuotaState;
}

export interface ConfirmRequest { speciesId: string; action: 'add_plant' | 'log_find'; placeType?: PlaceType; setup?: PlantSetup; householdId?: string }
export interface ConfirmResponse { plantId: string | null }
export type OutcomeResponse = Outcome;

export interface CreatePlantRequest { source: 'label_qr' | 'manual' | 'gift'; labelCode?: string; speciesId?: string; setup: PlantSetup; householdId?: string }
export interface CreatePlantResponse { plantId: string }
export interface PlantStatusRequest { status: PlantStatus; deathCause?: string }
export interface CheckInRequest { clientId: string; plantId: string; soilDry: boolean; leafStates: LeafState[]; occurredAt: string; photoPath?: string }
export interface CheckInResponse { nextCheckOn: IsoDate; nextCheckWeekday: string; waterTaskCreated: boolean; streakDays: number }
export type LabelResponse = LabelInfo | null;
```

- [ ] **Step 1: Write the failing tests**

`packages/core/src/privacy.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { distanceM, isInsideZone, randomizeZone } from './privacy.ts';

const home = { lat: 53.35, lng: -6.26 };
describe('privacy', () => {
  it('measures distance', () => {
    expect(distanceM(home, home)).toBe(0);
    expect(distanceM({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111195, -2);
  });
  it('randomised zones always still cover home, for any random draw', () => {
    for (const r of [0, 0.000001, 0.25, 0.5, 0.75, 0.999999]) {
      for (const s of [0, 0.33, 0.999999]) {
        let i = 0;
        const draws = [r, s];
        const zone = randomizeZone(home, 2000, () => draws[i++ % 2]!);
        expect(zone.radiusM).toBe(3000);
        expect(isInsideZone(home, zone)).toBe(true);
        expect(distanceM(home, zone.center)).toBeLessThanOrEqual(1000.5);
      }
    }
  });
  it('moves the centre away from home for most draws', () => {
    const zone = randomizeZone(home, 2000, () => 0.9);
    expect(distanceM(home, zone.center)).toBeGreaterThan(100);
  });
  it('points outside the zone are outside', () => {
    const zone = { center: home, radiusM: 1000 };
    expect(isInsideZone({ lat: 53.4, lng: -6.26 }, zone)).toBe(false);
  });
});
```

`packages/core/src/period.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { addDays, localDate, monthKey, nextMonthStart, weekdayName } from './period.ts';

describe('period', () => {
  it('uses the user timezone for the calendar day and month', () => {
    const late = new Date('2026-10-31T23:30:00Z');
    expect(localDate(late, 'Europe/Dublin')).toBe('2026-11-01'); // UTC+0 in winter… Dublin is UTC+0 after Oct 25, so 23:30
    expect(localDate(late, 'America/New_York')).toBe('2026-10-31');
    expect(monthKey(new Date('2026-11-01T03:00:00Z'), 'America/Los_Angeles')).toBe('2026-10');
  });
  it('falls back to UTC for an unknown timezone', () => {
    expect(localDate(new Date('2026-10-03T12:00:00Z'), 'Not/AZone')).toBe('2026-10-03');
  });
  it('finds next month start and weekday names', () => {
    expect(nextMonthStart(new Date('2026-10-03T12:00:00Z'), 'UTC')).toBe('2026-11-01');
    expect(nextMonthStart(new Date('2026-12-15T12:00:00Z'), 'UTC')).toBe('2027-01-01');
    expect(weekdayName('2026-10-09')).toBe('Friday');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });
});
```

Fix the first assertion before you implement. Ireland leaves summer time on 25 October 2026, so at 2026-10-31T23:30Z the Dublin date is `2026-10-31`. Write the test with `toBe('2026-10-31')` for Dublin, and add a summer case: `localDate(new Date('2026-07-31T23:30:00Z'), 'Europe/Dublin')` is `'2026-08-01'`.

`packages/core/src/care/basic.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { baseIntervalDays, basicCheckIn } from './basic.ts';

describe('basic care schedule (free plan)', () => {
  it('derives the base interval from the Plant.id watering range', () => {
    expect(baseIntervalDays({ min: 1, max: 1 }, null)).toBe(10);
    expect(baseIntervalDays({ min: 2, max: 2 }, null)).toBe(7);
    expect(baseIntervalDays({ min: 2, max: 3 }, null)).toBe(4);
    expect(baseIntervalDays({ min: null, max: null }, null)).toBe(7);
    expect(baseIntervalDays({ min: 1, max: 1 }, 5)).toBe(5);
  });
  it('dry soil creates a watering task today; damp moves the check by 2 days', () => {
    expect(basicCheckIn({ today: '2026-10-03', soilDry: true, baseDays: 7 })).toEqual({ waterTaskOn: '2026-10-03', nextCheckOn: '2026-10-10' });
    expect(basicCheckIn({ today: '2026-10-03', soilDry: false, baseDays: 7 })).toEqual({ waterTaskOn: null, nextCheckOn: '2026-10-05' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/core test`
Expected: FAIL.

- [ ] **Step 3: Implement**

`privacy.ts`:
```ts
export interface LatLng { lat: number; lng: number }
const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Uniform random point within radius/2 of home; stored radius grows by half, so home stays covered. */
export function randomizeZone(home: LatLng, radiusM: number, rand: () => number): { center: LatLng; radiusM: number } {
  const maxOffset = radiusM / 2;
  const d = maxOffset * Math.sqrt(rand());
  const bearing = 2 * Math.PI * rand();
  const lat1 = rad(home.lat);
  const lng1 = rad(home.lng);
  const ang = d / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(bearing));
  const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(ang) * Math.cos(lat1), Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2));
  return { center: { lat: deg(lat2), lng: deg(lng2) }, radiusM: Math.round(radiusM * 1.5) };
}

export function isInsideZone(point: LatLng, zone: { center: LatLng; radiusM: number }): boolean {
  return distanceM(point, zone.center) <= zone.radiusM;
}
```

`period.ts` uses `Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })`, which gives `YYYY-MM-DD`. Wrap the call in try/catch, falling back to `'UTC'` for an unknown timezone. Date arithmetic on `IsoDate` strings uses `Date.UTC`. `weekdayName` uses `Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' })`.

`care/basic.ts`: implement exactly as the interfaces describe, using `addDays` from `../period.ts`.

Export all four modules from `index.ts`.

- [ ] **Step 4: Run the tests to verify they pass, including under Deno**

Run: `pnpm --filter @tendril/core test && pnpm --filter @tendril/core typecheck && pnpm test:functions`
Expected: everything passes. The Deno core import test still loads core.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): privacy zones, timezone periods, basic care schedule and API contracts"
```

---

### Task 2: Shared function infrastructure

**Files:**
- Create in `supabase/functions/_shared/`: `http.ts`, `errors.ts`, `env.ts`, `db.ts`, `auth.ts`, `h3.ts`, `exif.ts`, `log.ts`
- Modify: `supabase/functions/deno.json` (add `@supabase/supabase-js`, `h3-js`, `piexifjs`, `exifr` and `jose` imports)
- Test: `supabase/functions/tests/shared_test.ts`

**Interfaces:**
- Produces:
  - `errors.ts`:
    - `class ApiError extends Error { constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) }`
    - `statusFor(code): number`
    - `errorResponse(e: unknown, requestId: string): Response`: unknown errors become `internal` with "Something went wrong.", logged with the request ID
  - `http.ts`:
    - `type Route = { method: string; pattern: URLPattern; handle: (req: Request, params: Record<string, string>) => Promise<Response> }`
    - `router(prefix: string, routes: Route[]): (req: Request) => Promise<Response>`: matches the path after `/functions/v1/<name>` or `/<name>`; returns 404 `not_found` for an unknown route; answers OPTIONS with CORS headers; adds `x-request-id`
    - `readJson<T>(req, maxBytes = 64_000): Promise<T>`: rejects bodies that are too large or aren't JSON with `invalid_input`
    - `json(data, status = 200): Response`
  - `env.ts`:
    - `env(name: string, fallback?: string): string`
    - `secretKey(): string`: reads `SUPABASE_SECRET_KEYS` (JSON, `.default`), falling back to `SUPABASE_SERVICE_ROLE_KEY`
  - `db.ts`: `type Db = SupabaseClient<Database>` (from `@tendril/db`, imported by relative path `../../../packages/db/src/index.ts`); `adminClient(): Db`
  - `auth.ts`: `interface UserVerifier { verify(req: Request): Promise<{ userId: string } | null> }`; `supabaseUserVerifier(db: Db): UserVerifier` (Bearer token, then `db.auth.getUser(token)`); `requireUser(verifier, req): Promise<string>`, which throws `unauthenticated`
  - `h3.ts`: `cellsFor(lat: number, lng: number): { r7: bigint; r5: bigint; r5Hex: string }`; `toBigint(cell: string): bigint`
  - `exif.ts`: `stripExif(jpeg: Uint8Array): Uint8Array`, which removes APP1 Exif segments with piexifjs; `assertNoGps(jpeg): Promise<void>` throws `invalid_input` if exifr still finds GPS
  - `log.ts`: `log(level, message, fields)`, printing one structured JSON line per call

- [ ] **Step 1: Write the failing tests**

`supabase/functions/tests/shared_test.ts`:
```ts
import { assertEquals, assertRejects } from '@std/assert';
import { ApiError, errorResponse } from '../_shared/errors.ts';
import { json, readJson, router } from '../_shared/http.ts';
import { cellsFor } from '../_shared/h3.ts';
import { assertNoGps, stripExif } from '../_shared/exif.ts';

Deno.test('router matches routes under the function prefix and 404s others', async () => {
  const handle = router('me', [
    { method: 'GET', pattern: new URLPattern({ pathname: '/ping/:id' }), handle: (_r, p) => Promise.resolve(json({ id: p.id })) },
  ]);
  assertEquals(await (await handle(new Request('http://x/functions/v1/me/ping/7'))).json(), { id: '7' });
  const missing = await handle(new Request('http://x/functions/v1/me/nope'));
  assertEquals(missing.status, 404);
  assertEquals((await missing.json()).error.code, 'not_found');
});

Deno.test('readJson rejects oversized and malformed bodies with invalid_input', async () => {
  await assertRejects(() => readJson(new Request('http://x', { method: 'POST', body: '{bad' })), ApiError);
  await assertRejects(() => readJson(new Request('http://x', { method: 'POST', body: 'x'.repeat(70_000) })), ApiError);
});

Deno.test('errorResponse maps codes to statuses and hides unknown errors', async () => {
  assertEquals(errorResponse(new ApiError('quota_exceeded', 'Limit reached.'), 'r1').status, 429);
  const hidden = errorResponse(new Error('db password is hunter2'), 'r2');
  assertEquals(hidden.status, 500);
  assertEquals((await hidden.json()).error.message, 'Something went wrong.');
});

Deno.test('h3 cells are stable bigints', () => {
  const a = cellsFor(53.35, -6.26);
  const b = cellsFor(53.35, -6.26);
  assertEquals(a.r7, b.r7);
  assertEquals(typeof a.r5, 'bigint');
  assertEquals(a.r5 > 0n, true);
});

Deno.test('stripExif removes GPS from a JPEG', async () => {
  const withGps = await Deno.readFile(new URL('./fixtures/gps.jpg', import.meta.url));
  const stripped = stripExif(withGps);
  await assertNoGps(stripped);
  await assertRejects(() => assertNoGps(withGps), ApiError);
});
```

Create the test fixture `supabase/functions/tests/fixtures/gps.jpg`: a tiny JPEG (e.g. 8×8) with an EXIF GPS block. Generate it once with a short Deno script using `npm:piexifjs` (`piexif.insert(piexif.dump({ GPS: { [piexif.GPSIFD.GPSLatitude]: [[53,1],[21,1],[0,1]], [piexif.GPSIFD.GPSLatitudeRef]: 'N' } }), baseJpegDataUrl)`) over any 8×8 base JPEG. Commit the resulting file, and record the generator command in a comment at the top of `shared_test.ts`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:functions`
Expected: FAIL.

- [ ] **Step 3: Implement the shared modules.** `URLPattern` is a global in Deno. CORS: `Access-Control-Allow-Origin: *`, plus headers `authorization, x-client-info, apikey, content-type, x-firebase-appcheck`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:functions && pnpm check:functions`
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions
git commit -m "feat(functions): shared routing, errors, auth, H3 and EXIF stripping"
```

---

### Task 3: Identification provider and App Check verifier

**Files:**
- Create in `supabase/functions/_shared/providers/`:
  - `identification.ts` (the interface and normalised types)
  - `plantid.ts`, `plantid-map.ts`
  - `fake-identification.ts`
  - `fixtures/plantid-peace-lily.json`, `fixtures/plantid-not-a-plant.json`, `fixtures/plantid-health.json`
  - `appcheck.ts`
- Test: `supabase/functions/tests/providers_test.ts`

**Interfaces:**
- Produces:
```ts
// identification.ts
export interface ProviderSuggestion {
  providerEntityId: string; scientificName: string; commonNames: string[]; probability: number;
  gbifId: number | null; family: string | null; genus: string | null;
  watering: { min: number; max: number } | null; light: string | null; imageUrl: string | null; similarImageUrl: string | null;
}
export interface ProviderDiagnosis { name: string; probability: number; description: string | null; treatment: string[]; cause: string | null }
export interface IdentificationResult {
  accessToken: string; isPlant: boolean; isPlantProbability: number;
  suggestions: ProviderSuggestion[]; diagnosis: ProviderDiagnosis[]; raw: unknown;
}
export interface IdentifyInput { imagesBase64: string[]; lat: number | null; lng: number | null; datetime: string; health: boolean }
export interface IdentificationProvider {
  identify(input: IdentifyInput): Promise<IdentificationResult>;
  feedback(accessToken: string, comment: string): Promise<void>;
}
```
  - `mapPlantIdResponse(json: unknown): IdentificationResult`, in `plantid-map.ts`, which is pure and tested against the fixtures:
    - Keep the top 5 suggestions, sorted by probability.
    - Treat `treatment` fields as arrays of strings, or as strings that get wrapped.
    - `isPlant` comes from `result.is_plant.binary`.
  - `plantIdProvider(apiKey: string, fetchFn = fetch): IdentificationProvider`:
    - POSTs to `https://plant.id/api/v3/identification?details=common_names,taxonomy,rank,gbif_id,image,watering,best_light_condition&language=en`.
    - Body: `images` as `data:image/jpeg;base64,…` data URLs, plus `latitude`, `longitude`, `datetime`, `similar_images: true`, `classification_level: 'species'`, and `health: 'all'` only when requested.
    - 25 s timeout.
    - A 429 throws `ApiError('provider_unavailable', 'Identification is busy. Try again soon.')`; any 5xx, a timeout or a network error throws `provider_unavailable`.
    - `feedback` POSTs `{ comment }` to `/identification/{token}/feedback`.
  - `fakeIdentificationProvider(scenario?: 'very_likely' | 'likely' | 'not_sure' | 'not_a_plant' | 'error')`:
    - Chooses its scenario from the first image's base64: if it contains the ASCII marker `TENDRIL_FAKE:<scenario>` in a JPEG comment, that scenario; otherwise `very_likely`.
    - very likely: peace lily 0.94, flamingo flower 0.03
    - likely: 0.71 and 0.22
    - not sure: 0.41 and 0.32
  - `appCheckVerifier(mode: 'dev' | 'firebase', cfg)`, with `.verify(token: string | null): Promise<'valid' | 'missing' | 'invalid'>`:
    - **dev:** the literal `dev-ok` is valid, null is missing, anything else is invalid.
    - **firebase:** jose's `createRemoteJWKSet('https://firebaseappcheck.googleapis.com/v1/jwks')`, checking RS256, `issuer: https://firebaseappcheck.googleapis.com/<PROJECT_NUMBER>`, `audience: projects/<PROJECT_NUMBER>`, and `sub` in `FIREBASE_APP_IDS`.

- [ ] **Step 1: Create the fixtures** from the Plant.id v3 response shape in the research doc:
  - `plantid-peace-lily.json`: `is_plant.binary: true`, probability 0.98; suggestions Spathiphyllum 0.94 (common names `["peace lily"]`, watering `{min:2,max:3}`, gbif 2868323) and Anthurium andraeanum 0.03 (`["flamingo flower"]`).
  - `plantid-not-a-plant.json`: `is_plant.binary: false`, probability 0.04, and empty suggestions.
  - `plantid-health.json`: as peace lily, plus `is_healthy` false and the disease suggestion "overwatering", 0.72, with `treatment: { prevention: ["Water only when the top of the soil is dry"] }`.

- [ ] **Step 2: Write the failing tests**

`supabase/functions/tests/providers_test.ts`:
```ts
import { assertEquals, assertRejects } from '@std/assert';
import { mapPlantIdResponse } from '../_shared/providers/plantid-map.ts';
import { plantIdProvider } from '../_shared/providers/plantid.ts';
import { appCheckVerifier } from '../_shared/providers/appcheck.ts';
import { ApiError } from '../_shared/errors.ts';

const load = async (n: string) => JSON.parse(await Deno.readTextFile(new URL(`../_shared/providers/fixtures/${n}`, import.meta.url)));

Deno.test('maps a Plant.id identification', async () => {
  const r = mapPlantIdResponse(await load('plantid-peace-lily.json'));
  assertEquals(r.isPlant, true);
  assertEquals(r.suggestions[0]?.scientificName, 'Spathiphyllum');
  assertEquals(r.suggestions[0]?.commonNames[0], 'peace lily');
  assertEquals(r.suggestions[0]?.watering, { min: 2, max: 3 });
});
Deno.test('maps not-a-plant', async () => {
  assertEquals(mapPlantIdResponse(await load('plantid-not-a-plant.json')).isPlant, false);
});
Deno.test('maps health with array or string treatments', async () => {
  const r = mapPlantIdResponse(await load('plantid-health.json'));
  assertEquals(r.diagnosis[0]?.name, 'overwatering');
  assertEquals(r.diagnosis[0]?.treatment, ['Water only when the top of the soil is dry']);
});
Deno.test('provider 5xx and 429 become provider_unavailable', async () => {
  for (const status of [429, 500, 503]) {
    const p = plantIdProvider('k', () => Promise.resolve(new Response('{}', { status })));
    const err = await assertRejects(() => p.identify({ imagesBase64: ['x'], lat: null, lng: null, datetime: '2026-10-03', health: false }), ApiError);
    assertEquals(err.code, 'provider_unavailable');
  }
});
Deno.test('provider sends health only when asked and never sends the API key elsewhere', async () => {
  let body: Record<string, unknown> = {};
  let headers = new Headers();
  const p = plantIdProvider('secret-key', (_url, init) => {
    body = JSON.parse(String(init?.body));
    headers = new Headers(init?.headers);
    return load('plantid-peace-lily.json').then((j) => new Response(JSON.stringify(j), { status: 201 }));
  });
  await p.identify({ imagesBase64: ['QUJD'], lat: 53.3, lng: -6.2, datetime: '2026-10-03', health: false });
  assertEquals('health' in body, false);
  assertEquals((body.images as string[])[0], 'data:image/jpeg;base64,QUJD');
  assertEquals(headers.get('Api-Key'), 'secret-key');
});
Deno.test('dev app check accepts only dev-ok', async () => {
  const v = appCheckVerifier('dev', {});
  assertEquals(await v.verify('dev-ok'), 'valid');
  assertEquals(await v.verify(null), 'missing');
  assertEquals(await v.verify('forged'), 'invalid');
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test:functions`
Expected: FAIL.

- [ ] **Step 4: Implement.** Add `ApiError` code access as a public `code` property.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test:functions && pnpm check:functions`
Expected: everything passes.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions
git commit -m "feat(functions): Plant.id provider with fixtures, fake provider and App Check verifier"
```

---

### Task 4: `me` and `identify` functions

**Files:**
- Create:
  - `supabase/functions/me/index.ts`, `supabase/functions/me/handler.ts`
  - `supabase/functions/identify/index.ts`, `supabase/functions/identify/handler.ts`
  - `supabase/functions/_shared/species.ts` (`upsertSpeciesFromProvider` and `toSpeciesRef`)
  - `supabase/functions/_shared/testing/fake-db.ts`
- Modify: `supabase/config.toml` (adds `[functions.me]` and `[functions.identify]`)
- Test: `supabase/functions/tests/me_test.ts`, `supabase/functions/tests/identify_test.ts`

**Interfaces:**
- Consumes:
  - Task 2 shared modules
  - Task 3 providers
  - from core: `randomizeZone`, `monthKey`, `nextMonthStart`, `QUOTA_LIMITS`
  - the Phase 2A tables and `private.reserve_usage`/`release_usage`/`is_premium` (called through `db.rpc` on schema `private`; expose the three functions to PostgREST via `db.schema('private')`). The database helpers are reached by an `rpc` wrapper in `_shared/db.ts`: `callPrivate(db, fn, args)`, which uses a `SECURITY DEFINER` `public.srv_*` wrapper granted only to `service_role`. Add a migration `<ts>_server_rpcs.sql` with `public.srv_reserve_usage`, `public.srv_release_usage` and `public.srv_is_premium`, each delegating to `private.*`, with execute revoked from `anon` and `authenticated` and granted to `service_role`. Add a pgTAP test that `authenticated` cannot execute them.
- Produces:
  - **`me` routes:**
    - `POST /bootstrap` (`BootstrapRequest`) is idempotent. It creates the profile (handle = requested, or `plant` + 6 random digits until unique), a household "Home" with an owner membership, and returns `BootstrapResponse`. `ageConfirmed13Plus` must be `true`, otherwise 400.
    - `PATCH /profile`.
    - `PUT /pets` replaces the household's pets. The user must be a member.
    - `PUT /vet`.
    - `PUT /home-area` stores `randomizeZone(home, radiusM, crypto-random)` and never the original point. `DELETE /home-area`.
    - `POST /push-token` upserts.
  - **`identify` route:** `POST /` (`IdentifyRequest`, header `X-Firebase-AppCheck`) returns `IdentifyResponse`. In order:
    1. Require the user, and validate the photos: 1–5, each path starting with `<uid>/`.
    2. Load the profile's timezone and premium status.
    3. Reserve the identification quota (plus the diagnosis quota when `healthCheck`). On refusal, throw `quota_exceeded` with details `{ kind, limit, resetsOn, plan }`.
    4. Insert the observation (`pending`), the location (with the cells) and the photo rows.
    5. Download each photo, strip EXIF, assert there's no GPS, re-upload with upsert, and compute the SHA-256. The first photo's hash becomes `image_hash`.
    6. Call the provider.
       - Not a plant: status `not_a_plant`, release every reservation, return `state: 'not_a_plant'`.
       - Provider error: status `failed`, release every reservation, rethrow `provider_unavailable`.
    7. Upsert the suggested species, by `provider_entity_id`, then by scientific name. The slug is `kebab-case(common name)`, falling back to the scientific name, with `-2` and so on if taken.
    8. Store the suggestions JSON, the confidence and the provider token in `private.observation_provider` (through a `public.srv_store_provider` wrapper, as above).
    9. Read the toxicity rows for the top suggestion.
    10. Return the response, with `integrity.appCheck` stored on the observation.
  - **`fake-db.ts`:** a minimal in-memory implementation of the subset of the supabase-js query builder the handlers use (`from().select().eq().maybeSingle()`, `insert`, `upsert`, `update`, `rpc`, `storage.from().download/upload`), so handler unit tests run without the stack. Keep it small. The integration test in Task 7 covers the real database.

- [ ] **Step 1: Write the failing tests**

`supabase/functions/tests/identify_test.ts`:
```ts
import { assertEquals } from '@std/assert';
import { createHandler } from '../identify/handler.ts';
import { fakeDb } from '../_shared/testing/fake-db.ts';
import { fakeIdentificationProvider } from '../_shared/providers/fake-identification.ts';
import { appCheckVerifier } from '../_shared/providers/appcheck.ts';
import type { IdentificationProvider } from '../_shared/providers/identification.ts';

const UID = '11111111-1111-1111-1111-111111111111';
const verifier = { verify: () => Promise.resolve({ userId: UID }) };
const jpeg = await Deno.readFile(new URL('./fixtures/gps.jpg', import.meta.url));
const req = (body: unknown, appCheck = 'dev-ok') =>
  new Request('http://x/functions/v1/identify', { method: 'POST', headers: { 'content-type': 'application/json', 'x-firebase-appcheck': appCheck }, body: JSON.stringify(body) });
const body = (paths = [`${UID}/obs/1.jpg`]) => ({ photos: paths.map((path) => ({ path, organ: 'leaf' })), captureSource: 'camera', location: { lat: 53.35, lng: -6.26, accuracyM: 8, mocked: false }, deviceTime: '2026-10-03T10:00:00Z', healthCheck: false });

function setup(provider: IdentificationProvider = fakeIdentificationProvider()) {
  const db = fakeDb({ profiles: [{ id: UID, timezone: 'Europe/Dublin', country_code: 'IE' }], storage: { [`${UID}/obs/1.jpg`]: jpeg } });
  const handle = createHandler({ db, verifier, provider, appCheck: appCheckVerifier('dev', {}), now: () => new Date('2026-10-03T10:00:00Z') });
  return { db, handle };
}

Deno.test('identifies, strips EXIF and returns suggestions with quota', async () => {
  const { db, handle } = setup();
  const res = await handle(req(body()));
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.state, 'identified');
  assertEquals(json.suggestions[0].species.commonName, 'Peace lily');
  assertEquals(json.quota, { kind: 'identification', used: 1, limit: 10, resetsOn: '2026-11-01', plan: 'free' });
  assertEquals(db.storageWrites.length, 1);
});
Deno.test('rejects another user\'s photo before using quota', async () => {
  const { db, handle } = setup();
  const res = await handle(req(body(['22222222-2222-2222-2222-222222222222/x.jpg'])));
  assertEquals(res.status, 403);
  assertEquals(db.rpcCalls.filter((c) => c.fn === 'srv_reserve_usage').length, 0);
});
Deno.test('provider failure releases the reserved quota', async () => {
  const { db, handle } = setup(fakeIdentificationProvider('error'));
  const res = await handle(req(body()));
  assertEquals(res.status, 503);
  assertEquals(db.rpcCalls.filter((c) => c.fn === 'srv_release_usage').length, 1);
  assertEquals(db.tables.observations[0]?.status, 'failed');
});
Deno.test('not a plant releases quota and says so', async () => {
  const { db, handle } = setup(fakeIdentificationProvider('not_a_plant'));
  const json = await (await handle(req(body()))).json();
  assertEquals(json.state, 'not_a_plant');
  assertEquals(db.rpcCalls.filter((c) => c.fn === 'srv_release_usage').length, 1);
});
Deno.test('quota refusal returns 429 with reset details and makes no provider call', async () => {
  let called = false;
  const provider = { identify: () => { called = true; return Promise.reject(new Error('should not call')); }, feedback: () => Promise.resolve() };
  const { db, handle } = setup(provider);
  db.refuseReservations = true;
  const res = await handle(req(body()));
  assertEquals(res.status, 429);
  assertEquals((await res.json()).error.details, { kind: 'identification', limit: 10, resetsOn: '2026-11-01', plan: 'free' });
  assertEquals(called, false);
});
Deno.test('missing app check still identifies but records the verdict', async () => {
  const { db, handle } = setup();
  await handle(req(body(), ''));
  assertEquals(db.tables.observations[0]?.integrity, { appCheck: 'missing' });
});
```

`supabase/functions/tests/me_test.ts`:
```ts
import { assertEquals } from '@std/assert';
import { createHandler } from '../me/handler.ts';
import { fakeDb } from '../_shared/testing/fake-db.ts';
import { distanceM } from '@core/privacy.ts';

const UID = '11111111-1111-1111-1111-111111111111';
const verifier = { verify: () => Promise.resolve({ userId: UID }) };
const call = (h: (r: Request) => Promise<Response>, method: string, path: string, body?: unknown) =>
  h(new Request(`http://x/functions/v1/me${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }));

Deno.test('bootstrap is idempotent and requires the 13+ attestation', async () => {
  const db = fakeDb({});
  const h = createHandler({ db, verifier, random: () => 0.5 });
  assertEquals((await call(h, 'POST', '/bootstrap', { ageConfirmed13Plus: false, timezone: 'Europe/Dublin', countryCode: 'IE' })).status, 400);
  const a = await (await call(h, 'POST', '/bootstrap', { ageConfirmed13Plus: true, timezone: 'Europe/Dublin', countryCode: 'IE', handle: 'aoifegrows' })).json();
  const b = await (await call(h, 'POST', '/bootstrap', { ageConfirmed13Plus: true, timezone: 'Europe/Dublin', countryCode: 'IE', handle: 'aoifegrows' })).json();
  assertEquals(a, b);
  assertEquals(db.tables.households.length, 1);
});
Deno.test('home area never stores the real point', async () => {
  const db = fakeDb({ profiles: [{ id: UID }] });
  const h = createHandler({ db, verifier, random: () => 0.9 });
  await call(h, 'PUT', '/home-area', { lat: 53.35, lng: -6.26, radiusM: 2000 });
  const zone = db.tables.privacy_zones[0]!;
  assertEquals(zone.radius_m, 3000);
  assertEquals(distanceM({ lat: 53.35, lng: -6.26 }, zone.centerLatLng) > 100, true);
});
```

In `fakeDb`, `privacy_zones` rows carry `centerLatLng` for inspection, and the real handler writes `center` as WKT `SRID=4326;POINT(lng lat)`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:functions`
Expected: FAIL.

- [ ] **Step 3: Implement the migration with the server RPC wrappers (and its pgTAP test), both handlers, the `index.ts` wiring and the config entries.** Run `pnpm db:reset && pnpm db:test` for the new migration.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:functions && pnpm check:functions && pnpm db:test`
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat(functions): me (bootstrap, pets, vet, home area) and identify with quota, EXIF strip and App Check verdict"
```

---

### Task 5: `observations` and `labels` functions

**Files:**
- Create:
  - `supabase/functions/observations/index.ts`, `supabase/functions/observations/handler.ts`
  - `supabase/functions/labels/index.ts`, `supabase/functions/labels/handler.ts`
  - `supabase/functions/_shared/plants.ts` (`createPlant`, shared with `care`)
- Modify: `supabase/config.toml`
- Test: `supabase/functions/tests/observations_test.ts`, `supabase/functions/tests/labels_test.ts`

**Interfaces:**
- Produces:
  - **`observations` routes:**
    - `POST /:id/confirm` (`ConfirmRequest`) returns `ConfirmResponse`:
      - The observation must belong to the user. Otherwise return 404.
      - Confirming one that's already confirmed returns the stored result, so it's idempotent.
      - It sets `species_id`, `confidence` (the chosen suggestion's probability), `intent`, `place_type`, `status = 'confirmed'` and `confirmed_at`.
      - It computes `public_cell_r5`: null if the species is sensitive or the location is inside the privacy zone.
      - It upserts `plantdex_entries`: category `houseplant` when `action = 'add_plant'` or the species is a houseplant, otherwise `wild`; `finds_count + 1` on conflict.
      - `add_plant` calls `createPlant` with the setup (source `scan`) and links `plant_id`.
      - When the chosen species isn't the top suggestion, it sends free provider feedback (`comment: "user chose <entityId>"`), fire-and-forget through `EdgeRuntime.waitUntil` when it's available.
    - `GET /:id/outcome` returns `Outcome`. In this phase, points status is the observation's `points_status` (`none` until Phase 4). It also returns `newToPlantdex` (this observation is the entry's `first_observation_id`) and `plantdexCount`. `sets: []` until Phase 4.
    - `POST /:id/discard` sets `status = 'discarded'`.
  - `createPlant(db, { userId, householdId?, speciesId, setup, source, observationId?, labelCode?, today }): Promise<string>`:
    - It uses the user's first household if none is given, and checks membership.
    - It inserts the plant, then the first `check` task due `today + baseIntervalDays(...)`, then a `setup` care event.
  - **`labels` routes** (`verify_jwt = false`):
    - `GET /:code` returns `LabelResponse`, using the `public_label` RPC through the admin client (cache header `max-age=60`).
      - The RPC's JSON is not `LabelInfo`. Its keys are `code`, `growerName`, `cultivar`, `species {id, slug, commonName, scientificName, imageUrl, light, checkIntervalDays, warmth}` and `toxicity[] {animal, severity, summary, symptoms, sourceName, sourceUrl, reviewStatus}`, ordered by animal. Map it with a tested `labelFromRpc` in `labels/handler.ts`:
        - `species` becomes `SpeciesRef`.
        - `care` comes from `light`, `checkIntervalDays` and `warmth`.
        - `careLines` is the light line plus "Check the soil every N to M days", using the same copy the plant detail uses.
        - `toxicity` passes through, keeping `reviewStatus`.
      - Add an optional `reviewStatus?: 'seed_pending_vet' | 'reviewed'` to core's `ToxicityEntry`. Rows still at `seed_pending_vet` must never read as vet-reviewed.
      - `labels_test.ts` also checks that the mapped `GET /PL-0001` body equals the `aoife` fixture label's shape.
    - `POST /:code/events` (`{ event: 'app_open' | 'store_click' | 'adoption'; platform }`) inserts into `qr_scans`; unknown codes get 404.

- [ ] **Step 1: Write the failing tests**

`supabase/functions/tests/observations_test.ts`:
```ts
import { assertEquals } from '@std/assert';
import { createHandler } from '../observations/handler.ts';
import { fakeDb } from '../_shared/testing/fake-db.ts';

const UID = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const SP = '33333333-3333-3333-3333-333333333333';
const verifier = (id = UID) => ({ verify: () => Promise.resolve({ userId: id }) });
const seed = () => fakeDb({
  profiles: [{ id: UID, timezone: 'Europe/Dublin' }],
  households: [{ id: 'h1' }], household_members: [{ household_id: 'h1', user_id: UID }],
  species: [{ id: SP, common_name: 'Peace lily', is_houseplant: true, sensitive: false, watering_min: 2, watering_max: 3 }],
  observations: [{ id: 'o1', user_id: UID, status: 'identified', suggestions: [{ speciesId: SP, probability: 0.94, providerEntityId: 'e1' }] }],
});
const setup = { nickname: 'Lily', room: 'Bedroom', light: 'medium', potMaterial: 'plastic', potSizeCm: 14, drainage: 'yes', indoor: true };
const confirm = (h: (r: Request) => Promise<Response>, id = 'o1') =>
  h(new Request(`http://x/functions/v1/observations/${id}/confirm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ speciesId: SP, action: 'add_plant', setup }) }));

Deno.test('confirm add_plant creates the plant, the first check and a Plantdex entry', async () => {
  const db = seed();
  const h = createHandler({ db, verifier: verifier(), provider: { identify: () => Promise.reject(), feedback: () => Promise.resolve() }, now: () => new Date('2026-10-03T10:00:00Z') });
  const res = await (await confirm(h)).json();
  assertEquals(typeof res.plantId, 'string');
  assertEquals(db.tables.care_tasks[0]?.due_on, '2026-10-07');
  assertEquals(db.tables.plantdex_entries[0]?.category, 'houseplant');
});
Deno.test('confirming twice is idempotent', async () => {
  const db = seed();
  const h = createHandler({ db, verifier: verifier(), provider: { identify: () => Promise.reject(), feedback: () => Promise.resolve() }, now: () => new Date('2026-10-03T10:00:00Z') });
  const a = await (await confirm(h)).json();
  const b = await (await confirm(h)).json();
  assertEquals(a, b);
  assertEquals(db.tables.plants.length, 1);
});
Deno.test('another user gets 404, not 403', async () => {
  const db = seed();
  const h = createHandler({ db, verifier: verifier(OTHER), provider: { identify: () => Promise.reject(), feedback: () => Promise.resolve() }, now: () => new Date() });
  assertEquals((await confirm(h)).status, 404);
});
```

`supabase/functions/tests/labels_test.ts` covers three cases, in the same style:
- `GET /PL-0001` returns the label JSON from a fake RPC.
- `GET /NOPE` returns `null` with status 200.
- `POST /NOPE/events` returns 404.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test:functions`
Expected: FAIL.

- [ ] **Step 3: Implement the handlers, `createPlant`, the config entries and `index.ts`.**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test:functions && pnpm check:functions`
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat(functions): confirm observations into plants and Plantdex; public label lookup"
```

---

### Task 6: `care` function (basic schedule)

**Files:**
- Create: `supabase/functions/care/index.ts`, `supabase/functions/care/handler.ts`
- Modify: `supabase/config.toml`
- Test: `supabase/functions/tests/care_test.ts`

**Interfaces:**
- Consumes: `createPlant` (Task 5) and `basicCheckIn`, `baseIntervalDays`, `localDate` and `weekdayName` from core.
- Produces:
  - `POST /plants` (`CreatePlantRequest`) returns `CreatePlantResponse`. For `label_qr`, it resolves the species from an active code and records a `qr_scans` row with `event 'adoption'`. No identification quota is used.
  - `PATCH /plants/:id` changes the nickname, room or setup fields.
  - `POST /plants/:id/status` (`PlantStatusRequest`) closes open tasks as `superseded`.
  - `POST /checkins` (`CheckInRequest`) returns `CheckInResponse`:
    - The user must be a member of the plant's household (403 otherwise).
    - It's idempotent on `clientId`: a repeat returns the original response, computed from the stored event.
    - It inserts the `checkin` event, marks due `check` tasks `done`, and computes the outcome with `basicCheckIn`.
    - Dry: inserts a `water` task due today, plus the next `check` task.
    - `streakDays` is 0 until Phase 5.
  - `POST /tasks/:id/done` (`{ clientId, occurredAt }`): water tasks become done and a `water` event is recorded. There's no points or celebration payload.

- [ ] **Step 1: Write the failing tests**

`supabase/functions/tests/care_test.ts` covers:
- **No:** a "No" answer creates no water task and moves the next check to `2026-10-05`, with weekday "Monday".
- **Yes:** a "Yes" answer creates a water task today and a check in 4 days (peace lily, watering 2/3).
- **Retry:** the same `clientId` twice returns identical bodies and stores one event.
- **Left household:** a user who isn't a member gets 403.
- **Label adoption:** creates a plant with `source 'label_qr'` and a `qr_scans` adoption row, and makes no `srv_reserve_usage` call.

Write these as `Deno.test` cases in the same style as Task 5.

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm test:functions && pnpm check:functions`
Expected: everything passes after implementation.

- [ ] **Step 3: Commit**

```bash
git add supabase
git commit -m "feat(functions): care plants, idempotent check-ins and the basic free schedule"
```

---

### Task 7: End-to-end flow against the local stack

**Files:**
- Create:
  - `supabase/functions/tests/e2e/scan_flow_test.ts`
  - `supabase/functions/.env.example` (local function env)
  - `scripts/e2e-functions.sh`
- Modify: root `package.json` (add `"e2e:functions": "bash scripts/e2e-functions.sh"`)

**Interfaces:**
- Consumes: every function from Tasks 4–6, the Phase 2A schema and the seed.
- Produces: `pnpm e2e:functions`, which:
  1. Starts the stack if needed.
  2. Runs `supabase functions serve --env-file supabase/functions/.env` in the background, waiting for `GET /functions/v1/health` to return ok.
  3. Runs `deno test supabase/functions/tests/e2e/`.
  4. Stops the server.

`supabase/functions/.env.example`:
```
IDENTIFY_PROVIDER=fake
APP_CHECK_MODE=dev
```

The script copies it to `supabase/functions/.env` when that's missing.

- [ ] **Step 1: Write the end-to-end test**

`scan_flow_test.ts`:
1. Reads `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` from `pnpm exec supabase status -o env`, which the shell script exports.
2. Creates a confirmed user with the admin API (`auth.admin.createUser({ email: 'e2e+<rand>@example.com', password, email_confirm: true })`) and signs in to get a user JWT.
3. Calls `me/bootstrap`, then `me/pets` with Miso the cat.
4. Uploads `tests/fixtures/gps.jpg` to `plant-photos/<uid>/<uuid>.jpg` with the **user** client, proving the own-folder policy.
5. Calls `identify` with header `x-firebase-appcheck: dev-ok`, expecting peace lily very likely.
6. Downloads the stored object and asserts it has no GPS.
7. Calls `observations/<id>/confirm` with `add_plant`, then `care/checkins` with `soilDry: true`, expecting `waterTaskCreated`.
8. Reads `care_tasks` with the **user** client through RLS: a water task is due today.
9. Reads `observation_locations` with a **second** user, expecting it to be empty.
10. Deletes the users in a `finally` block.

- [ ] **Step 2: Run it**

Run: `pnpm e2e:functions`
Expected: every step passes. Fix any handler or migration bug the real stack exposes, using new migrations only, and re-run.

- [ ] **Step 3: Commit**

```bash
git add supabase scripts package.json
git commit -m "test(functions): end-to-end scan-to-check-in flow against the local stack"
```

---

### Task 8: App sign-in and session on Supabase

**Files:**
- Create:
  - `apps/mobile/src/services/supabase.ts` (the client)
  - `apps/mobile/src/services/auth.ts` (Apple, Google, email link)
  - `apps/mobile/.env.example`
- Modify:
  - `apps/mobile/src/session/SessionProvider.tsx` (a real session in supabase mode, with `bootstrap` after sign-in)
  - `apps/mobile/src/app/auth/callback.tsx` (PKCE exchange, then `link-expired` on failure)
  - `apps/mobile/app.config.ts` (`ios.usesAppleSignIn: true`; plugins `expo-apple-authentication` and `@react-native-google-signin/google-signin` with `iosUrlScheme` from `GOOGLE_IOS_URL_SCHEME`, when set)
- Test: `apps/mobile/src/services/auth.test.ts`

**Interfaces:**
- Consumes: `BootstrapRequest`; the `(onboarding)` routes from Phase 1B.
- Produces:
  - `supabase`: a client created with `{ auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, flowType: 'pkce' } }`, with AppState start and stop of auto-refresh.
  - `signInWithApple(): Promise<void>`: `AppleAuthentication.signInAsync`, then `signInWithIdToken({ provider: 'apple', token })`. It sends `authorizationCode` to `me/apple-credential` once Phase 6 adds it; until then it keeps the code in memory only.
  - `signInWithGoogle(): Promise<void>`: `GoogleSignin.configure({ webClientId: EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID })`, then `signIn()`, then `signInWithIdToken({ provider: 'google' })`.
  - `sendEmailLink(email): Promise<void>`: `signInWithOtp({ email, options: { emailRedirectTo: Linking.createURL('/auth/callback') } })`.
  - `completeEmailLink(url): Promise<'ok' | 'expired'>`: reads `code` from the URL and calls `exchangeCodeForSession`. Any error returns `'expired'`.
  - In supabase mode, `SessionProvider` derives `status` from `supabase.auth.onAuthStateChange` and the presence of a profile. After onboarding (age attestation, pets, home area), it calls `me/bootstrap` with the device timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) and the country from `expo-localization`.

- [ ] **Step 1: Install the dependencies**

Inside `apps/mobile`:
```bash
npx expo install @supabase/supabase-js react-native-url-polyfill expo-apple-authentication @react-native-google-signin/google-signin expo-linking expo-localization
```

- [ ] **Step 2: Write the failing tests**

`auth.test.ts` mocks `@supabase/supabase-js`, `expo-apple-authentication` and `expo-linking`, and covers:
- `completeEmailLink('tendril://auth/callback?code=abc')` calls `exchangeCodeForSession('abc')` and returns `'ok'`.
- A URL with no code returns `'expired'`.
- An exchange that rejects returns `'expired'`.
- `sendEmailLink` passes `emailRedirectTo` ending in `/auth/callback`.

- [ ] **Step 3: Run the tests to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm --filter @tendril/mobile test -- auth && pnpm --filter @tendril/mobile typecheck`
Expected: the tests fail before implementation and pass after.

- [ ] **Step 4: Manual check against the local stack (web)**

With the stack running, set `apps/mobile/.env` from `supabase status` and `EXPO_PUBLIC_API_MODE=supabase`. Then:
1. Run `pnpm --filter @tendril/mobile web`.
2. Use Playwright (the visual tool's Chromium) to enter an email.
3. Open Mailpit at `http://127.0.0.1:54324`, follow the link, and confirm that the app lands on Pets.

Record the steps and the screenshots in the report.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): Supabase session with Apple, Google and email-link sign-in"
```

---

### Task 9: `SupabaseApi` for the live core loop

**Files:**
- Create:
  - `apps/mobile/src/api/supabase/SupabaseApi.ts`
  - `apps/mobile/src/api/supabase/mappers.ts`
  - `apps/mobile/src/api/supabase/functions.ts` (a typed `callFunction`)
  - `apps/mobile/src/services/upload.ts`
  - `apps/mobile/src/services/integrity.ts`
- Modify: `apps/mobile/src/app/_layout.tsx` (choose `SupabaseApi` when `EXPO_PUBLIC_API_MODE === 'supabase'`)
- Test: `apps/mobile/src/api/supabase/mappers.test.ts`, `apps/mobile/src/api/supabase/SupabaseApi.test.ts`

**Interfaces:**
- Consumes: `TendrilApi` (Phase 1A), the core API contracts (Task 1), `@tendril/db` `Database` types and `preparePhoto` (Phase 1B Task 5).
- Produces:
  - `SupabaseApi implements TendrilApi`.
  - **Methods this phase implements fully:** `getToday` (tasks and quota; streak and league default to empty until Phase 5), `checkIn`, `getHouseholds`, `getPlants`, `getPlant`, `addPlant`, `setPlantStatus`, `getLabel`, `getQuota`, `identify`, `getScanResult`, `confirmScan`, `getOutcome`, `getHousehold`, `savePets`, `getProfile`, `getEmergency`, `getEntitlement`.
  - **Methods that wait for later phases** throw `new Error('Not available yet')`:
    - Phase 3: diagnose, applyDiagnosis
    - Phase 4: plantdex, species card, sets, finds, badges
    - Phase 5: league, friends, findHandle, sendFriendRequest, createInvite, getWeekResult, getStreaks
    - Phase 6: startPreview, deleteAccount

    Each throwing method carries a `// Phase N` comment, and the method list in the report states which phase completes it.
  - `uploadPhotos(userId, observationTempId, photos)`: uploads to `plant-photos/<uid>/<tempId>/<n>.jpg` with the user client and returns the paths.
  - `IntegrityProvider` in `services/integrity.ts`: `{ getToken(): Promise<string | null> }`. It returns `'dev-ok'` when `EXPO_PUBLIC_APP_CHECK_DEV === '1'`, otherwise `null`. Firebase arrives in Phase 4.
  - Mappers convert DB rows into the domain types:
    - `plants` row plus species, to `PlantSummary`
    - tasks, to `CareTask`, with `overdue` when `due_on < today`
    - toxicity rows, to `ToxicityEntry`
    - `IdentifyResponse`, to `ScanResult`
    - a `quota_exceeded` error body, to a typed `QuotaExceededError` carrying a `QuotaState`, which the camera container catches to open the Limit sheet

- [ ] **Step 1: Write the failing tests**

`mappers.test.ts` covers:
- a plant row whose last check is past due maps to `careState 'overdue'`
- a toxicity row with severity `none` keeps its source
- missing toxicity rows map to `[]`, which the UI shows as Unknown
- `IdentifyResponse` with `state 'not_a_plant'` maps to a `ScanResult` with `state 'not_a_plant'`

`SupabaseApi.test.ts`, with a mocked supabase client, covers:
- `identify` uploads first, then calls the function with the uploaded paths and the integrity header
- a 429 body becomes `QuotaExceededError` with `used === limit`
- `checkIn` posts `clientId` unchanged

- [ ] **Step 2: Run the tests to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm --filter @tendril/mobile test -- supabase && pnpm --filter @tendril/mobile typecheck`
Expected: the tests fail before implementation and pass after.

- [ ] **Step 3: Check the live loop by hand (web, local stack)**

With `EXPO_PUBLIC_API_MODE=supabase` and `EXPO_PUBLIC_APP_CHECK_DEV=1`, use Playwright on the web build to:
1. Sign in through Mailpit, then set pets and skip the home area.
2. Upload a photo through the gallery picker, using `page.setInputFiles` on the web file input.
3. See the very-likely peace lily result with Miso's verdict.
4. Add the plant with setup answers, open Today, check in "Yes, dry", and see the water task.

Save screenshots of each step in `design/compare/live/`, which is ignored, and describe them in the report.

- [ ] **Step 4: Run the full verification**

Run: `pnpm verify && pnpm db:test && pnpm e2e:functions`
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): SupabaseApi drives the live scan, add-plant and check-in loop"
```
