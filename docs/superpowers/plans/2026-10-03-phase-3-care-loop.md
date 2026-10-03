# Phase 3: Care Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Load `supabase:supabase` and `supabase:supabase-postgres-best-practices` before writing SQL or function code.

**Goal:** Tendril's keep-it-alive coach works end to end:
- the Premium care engine adapts to answers, pot, light, season and outdoor weather
- diagnoses change the plan
- a cron-driven worker refreshes weather and recomputes plans nightly
- the app schedules local reminders that fire offline, and queues check-ins and scans made without a connection

**Architecture:**
- **Engine:** all rules are pure functions in `@tendril/core/care/engine.ts`, written test first.
- **Server state:** each plant's engine state lives in `plants.care_state` (JSON).
- **Server functions:**
  - `care` runs the engine after every event.
  - `identify/diagnose` produces diagnoses.
  - A new `worker` function (secret-key auth) runs `/weather` every 6 hours and `/nightly` once a day, called by pg_cron through pg_net with keys from Vault.
- **App:**
  - schedules expo-notifications DATE triggers from the server's task list
  - keeps a persisted outbox for offline check-ins and scans

**Tech Stack:** As Phases 2A/2B, plus pg_cron, pg_net, supabase_vault, `npm:jose@5` (WeatherKit ES256 JWT), and on the app side `expo-notifications` and `@react-native-community/netinfo`.

**Spec:** `docs/superpowers/specs/2026-10-03-tendril-v1-design.md` (§9 care engine, §6.4 notifications and offline, §7 worker, §8.4 quotas for diagnoses). Research: WeatherKit and cron/queue sections of `docs/research/2026-10-03-stack-research.md`.

## Global Constraints

- **Engine numbers (spec §9, starting values to tune):**
  - **Base interval:** average watering ≤ 1.3 → 10 days, ≤ 2.3 → 7, else 4, unless the species overrides it.
  - **Free plan:** a "No" answer moves the next check 2 days out. A "Yes" answer adds a water task today, and the next check comes one base interval after watering.
  - **Premium factors:**
    - pot material: terracotta 0.85, plastic 1.0, ceramic 1.05, unknown 1.0
    - pot size: ≤ 12 cm 0.8, 13–20 cm 1.0, > 20 cm 1.2
    - light: bright 0.85, medium 1.0, low 1.25, unknown 1.0
    - drainage "no": 1.2
    - season, northern hemisphere unless the latitude is negative: Jun–Aug 0.85, Dec–Feb 1.35, otherwise 1.0
    - learned multiplier: × 1.1 for each "No", × 0.95 for each "Yes" given on or after the due date, clamped to 0.6–1.8
    - the final interval is rounded and clamped to 2–21 days
  - **Outdoor weather (Premium):** ≥ 5 mm of rain in the next 48 hours adds 2 days; a maximum ≥ 28 °C in the next 48 hours takes 1 day off, with a minimum of 1 day.
  - **Diagnoses:**
    - overwatering pauses watering until two dry checks in a row; check-ins continue, and "Yes" answers create no water task while paused
    - underwatering applies a 0.8 factor for 2 cycles
    - anything else gives advice only
- **No celebrations:** nothing celebrates or rewards watering, and no points or streak credit come from a water task (check-ins count toward streaks in Phase 5).
- **Diagnosis quota:** each diagnosis uses one, from a monthly allowance of 1 on Free and 10 on Premium. Reserve it before the provider call and release it on failure or "not sure" (copy: "This didn't use your diagnosis.").
- **Worker and cron:**
  - The worker function has `verify_jwt = false` and accepts only requests whose `apikey` header equals the secret key.
  - Cron calls go through pg_net, with the URL and key read from Vault (`project_url`, `worker_key`). Locally the URL is `http://api.supabase.internal:8000`.
  - The worker responds immediately and does its work inside `EdgeRuntime.waitUntil`.
- **WeatherKit:**
  - `GET https://weatherkit.apple.com/api/v1/weather/en/{lat}/{lon}?dataSets=forecastDaily&timezone=<tz>`
  - ES256 JWT with header `{alg, kid, id: TEAM.SERVICE}` and claims `{iss, iat, exp, sub}`
  - Cached per res-7 cell, refreshed every 6 hours
  - The app must show the Apple Weather attribution wherever weather affects advice
  - `WEATHER_PROVIDER=fake|weatherkit`, `WEATHERKIT_TEAM_ID`, `WEATHERKIT_SERVICE_ID`, `WEATHERKIT_KEY_ID`, `WEATHERKIT_P8`
- **Notifications:**
  - Local only, for care. Request permission after the first plant is added, behind the notifications primer with "Not now".
  - Fire at 09:00 local on the task's due date, on the Android channel `care`.
  - Rescheduled from the server task list after every sync, cancelling stale ones.
  - No marketing notifications.
- **Offline:**
  - The check-in outbox is persisted (expo-sqlite key-value storage). Each item keeps its `clientId`, so syncing it twice is harmless.
  - The UI shows `saved_offline` (frame 4e).
  - Scans made offline keep their photos in the app's document directory, are identified when the connection returns, and trigger a local notification when the result is ready.

## Review Focus

1. **A plant with no species watering data and every setup answer "Not sure".** The engine must still produce a 7-day interval, never NaN or 0. Tested in Task 1.
2. **DST transitions.** A check due "in 7 days" that crosses the last Sunday of October must land on the right local date, and the 09:00 reminder must fire at 09:00 local. Tested in Task 1 (date maths on `IsoDate`) and Task 5 (trigger construction).
3. **Applying an overwatering diagnosis twice, or applying a diagnosis to a dead plant.** The first is idempotent; the second returns `conflict`. Tested in Task 4.
4. **The worker endpoint called without the secret key, or with a user's JWT.** It returns 401 and does nothing. Tested in Task 3.
5. **The offline outbox replaying after the plant was deleted.** The item is dropped with a snackbar ("Couldn't sync a check-in for a plant that's no longer here."), the queue doesn't block, and other items still sync. Tested in Task 6.

---

### Task 1: Core care engine (adaptive plan, diagnoses, season)

**Files:**
- Create:
  - `packages/core/src/care/engine.ts`
  - `packages/core/src/care/state.ts`
  - `packages/core/src/care/diagnosis.ts`
- Modify: `packages/core/src/care/basic.ts` (keep the exports; the engine reuses `baseIntervalDays`), `packages/core/src/index.ts`
- Test: `packages/core/src/care/engine.test.ts`, `packages/core/src/care/diagnosis.test.ts`

**Interfaces:**
- Produces:
```ts
// state.ts
export interface CareState {
  learned: number;                       // 0.6..1.8, default 1
  pause: { reason: 'overwatering'; dryChecksNeeded: number } | null;
  boost: { factor: number; cyclesLeft: number } | null;
  lastCheckOn: IsoDate | null;
  lastWateredOn: IsoDate | null;
}
export const INITIAL_CARE_STATE: CareState;
export function parseCareState(json: unknown): CareState; // tolerant: unknown/malformed → INITIAL_CARE_STATE fields

// engine.ts
export interface PlantFactors {
  wateringMin: number | null; wateringMax: number | null; intervalOverride: number | null;
  potMaterial: PotMaterial; potSizeCm: number | null; light: LightLevel; drainage: Drainage; indoor: boolean;
}
export interface WeatherSummary { rainNext48hMm: number; maxTempNext48hC: number }
export interface EngineInput {
  plan: Plan; today: IsoDate; latitude: number | null; factors: PlantFactors; state: CareState;
  weather: WeatherSummary | null;  // outdoor + premium only; ignored otherwise
}
export interface CheckInDecision { waterTaskOn: IsoDate | null; nextCheckOn: IsoDate; state: CareState; intervalDays: number }
export function intervalDays(input: EngineInput): number;
export function decideAfterCheckIn(input: EngineInput & { soilDry: boolean; dueOn: IsoDate | null }): CheckInDecision;
export function decideAfterWatering(input: EngineInput): { nextCheckOn: IsoDate; state: CareState };
export function season(month: number, latitude: number | null): 'summer' | 'winter' | 'shoulder';

// diagnosis.ts
export type DiagnosisEffect =
  | { kind: 'pause_watering'; dryChecksNeeded: 2 }
  | { kind: 'boost'; factor: 0.8; cycles: 2 }
  | { kind: 'advice_only' };
export function diagnosisEffect(conditionName: string): DiagnosisEffect; // 'overwatering'|'root rot' → pause; 'underwatering'|'dehydration'|'water stress' → boost; else advice
export function applyEffect(state: CareState, effect: DiagnosisEffect): CareState; // idempotent for the same effect
export function planChangeCopy(effect: DiagnosisEffect): { title: string; detail: string } | null;
// pause → { title: 'Pause watering', detail: 'Until two dry checks in a row' }; boost → { title: 'Check sooner', detail: 'For the next two checks' }
```

- [ ] **Step 1: Write the failing tests**

`packages/core/src/care/engine.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { decideAfterCheckIn, intervalDays, season } from './engine.ts';
import { INITIAL_CARE_STATE } from './state.ts';

const factors = { wateringMin: 2, wateringMax: 2, intervalOverride: null, potMaterial: 'plastic', potSizeCm: 15, light: 'medium', drainage: 'yes', indoor: true } as const;
const base = { plan: 'premium' as const, today: '2026-10-03', latitude: 53.3, factors, state: INITIAL_CARE_STATE, weather: null };

describe('intervalDays', () => {
  it('free plan ignores factors and uses the base interval', () => {
    expect(intervalDays({ ...base, plan: 'free', factors: { ...factors, potMaterial: 'terracotta', light: 'bright' } })).toBe(7);
  });
  it('premium multiplies factors and clamps to 2..21', () => {
    expect(intervalDays(base)).toBe(7); // shoulder season, all 1.0
    expect(intervalDays({ ...base, factors: { ...factors, potMaterial: 'terracotta', light: 'bright', potSizeCm: 10 } })).toBe(3); // 7*.85*.85*.8 = 4.05 → 4? see note
    expect(intervalDays({ ...base, today: '2027-01-10', factors: { ...factors, light: 'low', drainage: 'no', potSizeCm: 30, wateringMin: 1, wateringMax: 1 } })).toBe(21);
  });
  it('all-unknown setup and no watering data still gives a sane interval', () => {
    const unknown = { wateringMin: null, wateringMax: null, intervalOverride: null, potMaterial: 'unknown', potSizeCm: null, light: 'unknown', drainage: 'unknown', indoor: true } as const;
    const d = intervalDays({ ...base, factors: unknown });
    expect(d).toBe(7);
    expect(Number.isFinite(d)).toBe(true);
  });
  it('outdoor premium plants respond to rain and heat; indoor plants do not', () => {
    const outdoor = { ...factors, indoor: false };
    expect(intervalDays({ ...base, factors: outdoor, weather: { rainNext48hMm: 8, maxTempNext48hC: 15 } })).toBe(9);
    expect(intervalDays({ ...base, factors: outdoor, weather: { rainNext48hMm: 0, maxTempNext48hC: 30 } })).toBe(6);
    expect(intervalDays({ ...base, weather: { rainNext48hMm: 8, maxTempNext48hC: 30 } })).toBe(7);
  });
});

describe('decideAfterCheckIn', () => {
  it('free: No moves the check 2 days, Yes waters today', () => {
    expect(decideAfterCheckIn({ ...base, plan: 'free', soilDry: false, dueOn: '2026-10-03' })).toMatchObject({ waterTaskOn: null, nextCheckOn: '2026-10-05' });
    expect(decideAfterCheckIn({ ...base, plan: 'free', soilDry: true, dueOn: '2026-10-03' })).toMatchObject({ waterTaskOn: '2026-10-03', nextCheckOn: '2026-10-10' });
  });
  it('premium learns: No lengthens, on-time Yes shortens, clamped', () => {
    const no = decideAfterCheckIn({ ...base, soilDry: false, dueOn: '2026-10-03' });
    expect(no.state.learned).toBeCloseTo(1.1);
    const yes = decideAfterCheckIn({ ...base, soilDry: true, dueOn: '2026-10-03' });
    expect(yes.state.learned).toBeCloseTo(0.95);
    const early = decideAfterCheckIn({ ...base, soilDry: true, dueOn: '2026-10-06' });
    expect(early.state.learned).toBe(1);
    let s = INITIAL_CARE_STATE;
    for (let i = 0; i < 20; i++) s = decideAfterCheckIn({ ...base, state: s, soilDry: false, dueOn: '2026-10-03' }).state;
    expect(s.learned).toBe(1.8);
  });
  it('overwatering pause: dry answers create no water task until two dry checks in a row', () => {
    const paused = { ...INITIAL_CARE_STATE, pause: { reason: 'overwatering' as const, dryChecksNeeded: 2 } };
    const first = decideAfterCheckIn({ ...base, state: paused, soilDry: true, dueOn: '2026-10-03' });
    expect(first.waterTaskOn).toBeNull();
    expect(first.state.pause?.dryChecksNeeded).toBe(1);
    const damp = decideAfterCheckIn({ ...base, state: first.state, soilDry: false, dueOn: '2026-10-05' });
    expect(damp.state.pause?.dryChecksNeeded).toBe(2);
    const a = decideAfterCheckIn({ ...base, state: damp.state, soilDry: true, dueOn: '2026-10-07' });
    const b = decideAfterCheckIn({ ...base, state: a.state, soilDry: true, dueOn: '2026-10-09' });
    expect(b.state.pause).toBeNull();
    expect(b.waterTaskOn).toBe('2026-10-03');
  });
  it('dates cross the October clock change on the calendar, not by 24h steps', () => {
    expect(decideAfterCheckIn({ ...base, plan: 'free', today: '2026-10-22', soilDry: true, dueOn: '2026-10-22' }).nextCheckOn).toBe('2026-10-29');
  });
});

describe('season', () => {
  it('northern by default, southern when latitude is negative', () => {
    expect(season(7, 53)).toBe('summer');
    expect(season(1, null)).toBe('winter');
    expect(season(7, -33)).toBe('winter');
    expect(season(4, 10)).toBe('shoulder');
  });
});
```

The second `intervalDays` assertion works out as `7 × 0.85 × 0.85 × 0.8 = 4.046`, which rounds to **4**, so write `toBe(4)` and delete the "see note" comment. Before running, recompute every expected number in this file from the Global Constraints formula (round, then clamp), and fix any assertion that disagrees. The constraints are the authority.

`packages/core/src/care/diagnosis.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyEffect, diagnosisEffect, planChangeCopy } from './diagnosis.ts';
import { INITIAL_CARE_STATE } from './state.ts';

describe('diagnosis effects', () => {
  it('maps conditions to effects, case-insensitively', () => {
    expect(diagnosisEffect('Overwatering')).toEqual({ kind: 'pause_watering', dryChecksNeeded: 2 });
    expect(diagnosisEffect('underwatering')).toEqual({ kind: 'boost', factor: 0.8, cycles: 2 });
    expect(diagnosisEffect('Powdery mildew')).toEqual({ kind: 'advice_only' });
  });
  it('applying the same effect twice is idempotent', () => {
    const e = diagnosisEffect('overwatering');
    expect(applyEffect(applyEffect(INITIAL_CARE_STATE, e), e)).toEqual(applyEffect(INITIAL_CARE_STATE, e));
  });
  it('plan change copy matches the design', () => {
    expect(planChangeCopy(diagnosisEffect('overwatering'))).toEqual({ title: 'Pause watering', detail: 'Until two dry checks in a row' });
    expect(planChangeCopy({ kind: 'advice_only' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/core test -- care`
Expected: FAIL.

- [ ] **Step 3: Implement**

`intervalDays`:
1. Take `baseIntervalDays`.
2. Free: return the base.
3. Premium:
   - multiply by the pot, size, light, drainage, season and learned factors, and by `boost.factor` when `boost` is set
   - round, then clamp to 2–21
   - if outdoor and `weather` is set, apply the rain (+2) and heat (−1) adjustments, then clamp again to a minimum of 1

`decideAfterCheckIn`:
- **Learning (Premium only):** update `learned` (×1.1 on No; ×0.95 on Yes when `today >= dueOn`; clamp 0.6–1.8).
- **Overwatering pause:**
  - Dry: decrement `dryChecksNeeded`. When it reaches 0, clear the pause and water today.
  - Damp: reset the count to 2.
- **Otherwise:**
  - Dry: water today, and the next check comes one interval after today.
  - Damp: Free moves the next check 2 days out; Premium uses `max(2, round(interval / 2))`.
- **Boost:** decrement `boost.cyclesLeft` after each completed watering cycle, clearing it at 0.
- **Recorded dates:** set `lastCheckOn`, and set `lastWateredOn` when watering.

Use `addDays` from `../period.ts` for all date maths.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @tendril/core test && pnpm --filter @tendril/core typecheck && pnpm test:functions`
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): adaptive care engine with diagnosis effects, season and weather"
```

---

### Task 2: Plant weather cells, weather cache and cron plumbing

**Files:**
- Create:
  - `supabase/migrations/<ts>_care_loop.sql`
  - `supabase/tests/database/070-care-loop.test.sql`
  - `scripts/setup-local-cron.sh`
- Modify: root `package.json` (add `"db:cron": "bash scripts/setup-local-cron.sh"`)

**Interfaces:**
- Produces:
  - `plants.cell_r7 bigint` and `plants.latitude real`: both nullable, set from the household home zone at creation; used for weather and season
  - `private.weather_cache(cell_r7 bigint primary key, lat real, lng real, fetched_at timestamptz, summary jsonb)`: `summary` is a `WeatherSummary` plus `days`
  - extensions `pg_cron` and `pg_net`
  - `private.call_worker(path text)`, which reads Vault and calls `net.http_post` with `timeout_milliseconds := 5000`
  - cron jobs:
    - `tendril-weather`: `7 */6 * * *`, path `/weather`
    - `tendril-nightly`: `17 3 * * *`, path `/nightly`
    - `tendril-purge-cron-log`: `27 4 * * *`, deletes `cron.job_run_details` older than 7 days
  - `scripts/setup-local-cron.sh` writes the Vault secrets `project_url` (`http://api.supabase.internal:8000`) and `worker_key` (the local secret key from `supabase status -o env`), using `vault.create_secret` or `vault.update_secret`

- [ ] **Step 1: Write the failing test**

`070-care-loop.test.sql` covers:
- `has_column('public','plants','cell_r7')`
- `private.weather_cache` can't be read by `authenticated` (`throws_ok … '42501'`)
- `cron.job` contains the three job names
- `private.call_worker` can't be executed by `authenticated`

- [ ] **Step 2: Run it to verify it fails**, then write the migration:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

alter table public.plants add column cell_r7 bigint, add column latitude real;

create table private.weather_cache (
  cell_r7 bigint primary key,
  lat real not null,
  lng real not null,
  fetched_at timestamptz not null,
  summary jsonb not null
);
revoke all on private.weather_cache from public, anon, authenticated;
grant all on private.weather_cache to service_role;

create or replace function private.call_worker(path text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  base text;
  key text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into key from vault.decrypted_secrets where name = 'worker_key';
  if base is null or key is null then
    raise notice 'worker secrets missing; skipping %', path;
    return null;
  end if;
  return net.http_post(
    url := base || '/functions/v1/worker' || path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', key),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end $$;
revoke all on function private.call_worker(text) from public, anon, authenticated;

select cron.schedule('tendril-weather', '7 */6 * * *', $$select private.call_worker('/weather')$$);
select cron.schedule('tendril-nightly', '17 3 * * *', $$select private.call_worker('/nightly')$$);
select cron.schedule('tendril-purge-cron-log', '27 4 * * *', $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);
```

- [ ] **Step 3: Write `setup-local-cron.sh`**. It sources `pnpm exec supabase status -o env`, then runs `psql "$DB_URL"`, which upserts the two Vault secrets (`select vault.create_secret(...)` when missing, otherwise `vault.update_secret(id, ...)`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm db:reset && pnpm db:cron && pnpm db:test`
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add supabase scripts package.json
git commit -m "feat(db): plant weather cells, weather cache and cron-driven worker plumbing"
```

---

### Task 3: Weather provider and the worker function

**Files:**
- Create:
  - `supabase/functions/_shared/providers/weather.ts` (interface and fake)
  - `supabase/functions/_shared/providers/weatherkit.ts`
  - `supabase/functions/_shared/providers/fixtures/weatherkit-daily.json`
  - `supabase/functions/worker/index.ts`, `supabase/functions/worker/handler.ts`
  - `supabase/functions/_shared/care-recompute.ts` (shared with `care`)
- Modify: `supabase/config.toml` (`[functions.worker] verify_jwt = false`)
- Test: `supabase/functions/tests/weather_test.ts`, `supabase/functions/tests/worker_test.ts`

**Interfaces:**
- Produces:
  - `interface WeatherProvider { daily(lat: number, lng: number, timeZone: string): Promise<WeatherSummary & { days: { date: string; maxC: number; minC: number; rainMm: number }[] }> }`
  - `weatherKitProvider(cfg, fetchFn = fetch)`: signs a 30-minute ES256 JWT with jose `importPKCS8` and `SignJWT`, calls `forecastDaily`, and sums `precipitationAmount` and takes the maximum `temperatureMax` over the first 2 days.
  - `fakeWeatherProvider(summary?)`: defaults to a dry, mild 48 hours.
  - **Worker routes**, each requiring `apikey === secretKey()` (otherwise 401) and responding `202` immediately while the work runs in `EdgeRuntime.waitUntil`, or inline when `waitUntil` is unavailable, as in tests:
    - `POST /weather` collects distinct `cell_r7` values (with lat and lng) of alive outdoor plants in households with a premium member, refreshes cache entries older than 6 hours, caps the run at 500 cells, and logs the count.
    - `POST /nightly` runs `recomputeOpenChecks(db, today)` for every alive plant: it ensures exactly one open `check` task and recomputes Premium plants' next check with the latest weather.
  - `recomputeOpenChecks(db, plantId | 'all', today)`: in `care-recompute.ts`.

- [ ] **Step 1: Write the failing tests**

`weather_test.ts`:
- maps `fixtures/weatherkit-daily.json` (two days: rain 3.2 and 4.1 mm; maxima 18 and 21 °C) to `{ rainNext48hMm: 7.3, maxTempNext48hC: 21 }`
- the JWT header has `alg ES256`, the right `kid` and `id`, using a generated P-256 key in the test

`worker_test.ts`:
- no `apikey` returns 401
- a user JWT in `Authorization` with no `apikey` returns 401
- the correct key returns 202 and writes cache rows for the fake cells
- `/nightly` leaves exactly one open check per alive plant

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm test:functions && pnpm check:functions`
Expected: everything passes after implementation.

- [ ] **Step 3: Commit**

```bash
git add supabase
git commit -m "feat(functions): WeatherKit provider and cron worker for weather refresh and nightly recompute"
```

---

### Task 4: Plan-aware check-ins and diagnoses on the server

**Files:**
- Create: `supabase/functions/identify/diagnose.ts`
- Modify:
  - `supabase/functions/identify/handler.ts` (adds the `POST /diagnose` route)
  - `supabase/functions/care/handler.ts` (uses the engine; adds `POST /diagnoses/:id/apply`)
  - `supabase/functions/_shared/plants.ts` (sets `cell_r7` and `latitude` from the home zone)
- Test: `supabase/functions/tests/diagnose_test.ts`, `supabase/functions/tests/care_engine_test.ts`

**Interfaces:**
- Consumes: Task 1 engine and diagnosis effects; Task 3 `recomputeOpenChecks`; `srv_reserve_usage` and `srv_release_usage` (Phase 2B).
- Produces:
  - **`POST /identify/diagnose`** (`{ plantId, photos: {path, organ}[] }`) returns `DiagnosisResult & { state: 'result' | 'not_sure'; quota: QuotaState }`:
    - The user must be a member of the plant's household.
    - It reserves the diagnosis quota (429 `quota_exceeded` with details when used up) and calls the provider with `health: true`.
    - The top disease with probability ≥ 0.5 is stored in `diagnoses` with `effect = diagnosisEffect(name)`, and the response is `result` with `planChange = planChangeCopy(effect)`.
    - Otherwise it releases the quota and responds `not_sure`.
  - **`POST /care/diagnoses/:id/apply`:**
    - It applies the effect to `plants.care_state` and sets `applied_at`. Applying again is idempotent and returns 200 with no change.
    - A dead or given-away plant returns 409 `conflict`.
    - It records a `diagnosis_applied` care event and recomputes the plant's open check.
  - **`care/checkins`** now loads the plan (`srv_is_premium`), the plant's factors and state, and the weather (when outdoor and premium) from `private.weather_cache` through an `srv_weather_for_cell(cell_r7)` wrapper (migration plus pgTAP test). It then calls `decideAfterCheckIn` and persists the state.

- [ ] **Step 1: Write the failing tests**
  - `diagnose_test.ts`:
    - overwatering 0.72 → `state 'result'`, `planChange.title 'Pause watering'`, diagnosis quota used once
    - a top disease below 0.5 → `not_sure` with the quota released
    - a free user's second diagnosis in the month → 429
    - a non-member → 403
  - `care_engine_test.ts`:
    - a premium user's "No" stores `learned 1.1`
    - check-ins while paused create no water task
    - applying a diagnosis twice is idempotent
    - applying to a dead plant returns 409

- [ ] **Step 2: Run them to verify they fail**, then implement (including the `srv_weather_for_cell` migration and its pgTAP test), then run them to verify they pass

Run: `pnpm test:functions && pnpm check:functions && pnpm db:reset && pnpm db:test && pnpm e2e:functions`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add supabase
git commit -m "feat(functions): diagnoses with quota and plan effects; engine-driven check-ins"
```

---

### Task 5: Local care reminders in the app

**Files:**
- Create:
  - `apps/mobile/src/services/notifications.ts`
  - `apps/mobile/src/services/notifications.web.ts` (no-op)
  - `apps/mobile/src/hooks/useCareReminders.ts`
- Modify:
  - `apps/mobile/src/app/plants/setup.tsx` (after the first plant is saved, show the notifications `PermissionPrimer` once)
  - `apps/mobile/src/app/_layout.tsx` (mount `useCareReminders`)
  - `app.config.ts` (the `expo-notifications` plugin)
- Test: `apps/mobile/src/services/notifications.test.ts`

**Interfaces:**
- Produces:
  - `reminderTrigger(dueOn: IsoDate): { type: 'date'; date: Date; channelId: 'care' }`: 09:00 in the device's local time on `dueOn`, built with `new Date(y, m - 1, d, 9, 0, 0)` so DST is handled by the device.
  - `syncReminders(tasks: CareTask[], scheduler = Notifications)`:
    - cancels every notification with `data.kind === 'care'` that isn't in the current due or overdue set
    - schedules one per task that isn't done, due today or later, with the body `checkInQuestion(nickname)` and the title "Tendril"
    - overdue tasks get a single reminder today at 09:00, or 5 minutes from now if that's already past
    - never schedules more than 60, the iOS pending limit
  - `useCareReminders()`: after any `useToday` data change, calls `syncReminders` when permission is granted.
  - On Android, creates the `care` channel before the first permission request.
  - Tapping a reminder opens Today with that plant's check-in sheet (deep link `tendril://today?checkin=<taskId>`).

- [ ] **Step 1: Install the dependencies:** `npx expo install expo-notifications`

- [ ] **Step 2: Write the failing tests:**
  - `reminderTrigger('2026-10-25')` returns a date whose local hours are 9 on the 25th (run with `TZ=Europe/Dublin` in the jest config's `testEnvironmentOptions`, or assert `getHours() === 9 && getDate() === 25`)
  - `syncReminders` cancels stale ones, schedules the new ones, skips done tasks, and caps at 60 (use a fake scheduler that records calls)

- [ ] **Step 3: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm --filter @tendril/mobile test -- notifications && pnpm --filter @tendril/mobile typecheck`
Expected: the tests fail before implementation and pass after.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): local care reminders scheduled from the server task list"
```

---

### Task 6: Offline outbox for check-ins and scans

**Files:**
- Create:
  - `apps/mobile/src/services/outbox.ts`
  - `apps/mobile/src/services/connectivity.ts`
- Modify:
  - `apps/mobile/src/api/hooks.ts` (`useCheckIn` goes through the outbox when offline)
  - the camera and result containers (offline scans are queued and show frame 4x)
- Test: `apps/mobile/src/services/outbox.test.ts`

**Interfaces:**
- Produces:
  - `Outbox`, stored under the key `tendril.outbox.v1`:
    - `enqueue(item: OutboxItem)`
    - `drain(api: TendrilApi): Promise<{ sent: number; dropped: { item: OutboxItem; reason: string }[] }>`
    - `size()`
  - `OutboxItem = { kind: 'checkin'; input: CheckInInput; queuedAt: string } | { kind: 'scan'; input: IdentifyInput; localPhotoUris: string[]; queuedAt: string }`
  - **Drain rules:**
    - items are sent in order
    - a `not_found` or `forbidden` error drops the item with a reason and continues
    - a network error stops the drain and keeps the remaining items
    - scans that succeed fire a local notification ("Your plant is identified.") that opens the result
  - `useIsOnline()` comes from NetInfo, and the outbox drains automatically on the transition to online.

- [ ] **Step 1: Install the dependencies:** `npx expo install @react-native-community/netinfo`

- [ ] **Step 2: Write the failing tests** for `outbox.test.ts`, with a fake storage and a fake api:
  - three check-ins drain in order, using the same `clientId`s
  - a `not_found` item is dropped with its reason while the later ones still send
  - a network failure keeps the queue intact
  - draining twice never sends an item twice

- [ ] **Step 3: Run them to verify they fail**, then implement, wire the containers (showing `saved_offline` and frame 4x), and run them to verify they pass

Run: `pnpm --filter @tendril/mobile test -- outbox && pnpm --filter @tendril/mobile typecheck`
Expected: the tests fail before implementation and pass after.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): offline outbox for check-ins and scans"
```

---

### Task 7: Live diagnosis and the adaptive care plan in the app

**Files:**
- Modify:
  - `apps/mobile/src/api/supabase/SupabaseApi.ts` (`diagnose` and `applyDiagnosis`; `getPlant` care plan lines from the engine)
  - `apps/mobile/src/app/plants/[id]/diagnosis.tsx`
  - `apps/mobile/src/screens/plants/PlantDetailScreen.tsx` (Premium line "Adapts to your answers, pot, light and season"; outdoor Premium plants show "Uses Apple Weather" with the attribution link)
  - `packages/core/src/care/engine.ts` (export `carePlanLines(input): CarePlanLine[]`)
- Test: `packages/core/src/care/plan-lines.test.ts`, `apps/mobile/src/api/supabase/SupabaseApi.diagnose.test.ts`

**Interfaces:**
- Produces: `carePlanLines(input: EngineInput): CarePlanLine[]`
  - Free: "Check the soil every N days" / "Basic schedule for this species"
  - Premium: "Check the soil every N days" / "Adapts to your answers, pot, light and season"
  - plus the light line ("Bright, indirect light" / "From your setup answers")
  - plus the pot line ("24 cm plastic pot, drains" / "Water only when the top is dry"), which says "Pot not set" when unknown
  - plus, when paused, "Watering paused" / "Until two dry checks in a row (1 of 2)"

- [ ] **Step 1: Write the failing tests:**
  - `carePlanLines` for Monty on Free matches frame 2d's lines exactly
  - the paused state shows the paused line with its count
  - `SupabaseApi.diagnose` maps the 429 to `QuotaExceededError` and the result to `DiagnosisResult`

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm --filter @tendril/core test && pnpm --filter @tendril/mobile test && pnpm verify`
Expected: everything passes.

- [ ] **Step 3: Verify the flow by hand against the local stack (web)**

1. Sign in.
2. Add a plant.
3. From Plant detail, run a diagnosis. With `health: true`, the fake provider returns overwatering at 0.72; extend `fakeIdentificationProvider` in Task 4 if it doesn't already do this.
4. Apply it.
5. Check in "Yes, dry" and see that no water task is created while watering is paused.

Record screenshots in the report.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src apps/mobile
git commit -m "feat: live diagnoses and adaptive care plan lines in the app"
```
