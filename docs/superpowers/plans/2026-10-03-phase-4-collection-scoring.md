# Phase 4: Collection, Scoring and Anti-cheat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Load `supabase:supabase` and `supabase:supabase-postgres-best-practices` before writing SQL or function code.

**Goal:** Every confirmed observation is scored on the server from an append-only ledger. Integrity and plausibility checks hold or deny points as the anti-cheat table specifies, and rarity comes from GBIF. The app shows the real Plantdex, sets, badges, species cards and the owner-only finds map.

**Architecture:**
- **Rules:** the integrity checks and versioned scoring rules are pure functions in `@tendril/core/scoring/`, written test first.
- **Queue:** confirming an observation enqueues a `scoring` message (pgmq) and kicks the worker immediately. The worker's `/tick` route also drains the queue every 30 s from cron.
- **Ledger:** `score_events` is append-only. A trigger blocks any change except `held` and `revoked_at`, and no role holds a delete grant.
- **Collection progress:** Plantdex, set progress and badges are derived and recomputed by the scoring job.
- **Regional presence:** GBIF counts per species per H3 res-3 cell are cached server-side.
- **Integrity tokens:** the app sends Firebase App Check tokens in dev and release builds.

**Tech Stack:** pgmq 1.5.1, `npm:h3-js` (`cellToParent`, `cellToBoundary`, `gridDisk`), GBIF REST, `@react-native-firebase/app` and `@react-native-firebase/app-check` (dev build only).

**Spec:** `docs/superpowers/specs/2026-10-03-tendril-v1-design.md` (§8.3 scoring and anti-cheat, §8.2 privacy, §10 for what scoring feeds into). Research: GBIF and App Check sections of `docs/research/2026-10-03-stack-research.md`.

## Global Constraints

- **Integrity checks run in this order**, and the first match decides the outcome:
  1. App Check token missing or invalid → `no_points` (`integrity`)
  2. Gallery capture → `no_points` (`gallery`)
  3. Device time more than 10 minutes from server time → `no_points` (`time_skew`)
  4. No location → Plantdex only, `no_points` (`location_off`)
  5. Mocked location, accuracy worse than 100 m, or implied speed from the previous scan above 300 km/h → `held`
  6. Duplicate: image hash seen before for this user, or the same species within 30 m of an earlier find → `no_points` (`duplicate`)
  7. More than 20 scoring scans today (user's timezone) → `no_points` (`daily_cap`)
  8. No GBIF or Tendril presence for the species in its res-3 cell and the cell's ring-1 neighbours → `held`, released automatically by a second independent find
- **Rules v1** (placeholders; every ledger row stores `rule_id` and `rule_version = 1`):
  - `new_species`:
    - wild or garden/park finds score by rarity: common 10, uncommon 40, rare 80, legendary 150
    - shop or home finds score 10
  - `repeat_find`: 2 points for the same species at least 1 km and 7 days from the user's earlier finds
  - `set_complete`: 50 points
- **What never scores:** watering, check-ins, picking and foraging.
- **Ledger:**
  - **Held rows** have `held = true`, and boards exclude them.
  - **Revoked rows** have `revoked_at` set.
  - **Idempotency key:** `"<rule_id>:v1:<observation_id>"` (`set_complete` uses `"set_complete:v1:<user>:<set_id>"`), with a unique index on the key.
- **Rarity tiers** come from the GBIF count of CC0 and CC BY 4.0 occurrences in Europe (lat 34–72, lng −25–45) plus North America (lat 15–72, lng −170 to −50): ≥ 5,000 is common, 500–4,999 uncommon, 50–499 rare, < 50 legendary. Starting values.
- **Sensitive species** score normally, but never get a `public_cell_r5`, never show a pin outside the owner's own map, and never appear on any public rarity listing.
- **Copy:**
  - Held points read "Points pending review. We check unusual finds before they count." (never an accusation).
  - Gallery finds read `copy.galleryNote`.

## Review Focus

1. **Two confirmations of the same observation racing**, for example a retried request. The unique idempotency key means only one ledger row per rule, and Plantdex `finds_count` goes up once. Tested in Task 3.
2. **The first find of a species for which GBIF has no data at all** (`gbif_id` null). The plausibility check treats a missing GBIF id as "unknown presence": the points are held, not denied, and released by a second find. Tested in Task 1.
3. **A user hopping between two distant places**, such as a scan in Dublin and then one in New York 30 minutes later. The second scan is held (speed above 300 km/h) without blaming anyone; scans more than 24 hours apart are never speed-checked. Tested in Task 1.
4. **Someone trying to change a ledger row**, by updating `points` or deleting rows, even with the service role. The trigger and the grants reject it, and only `held` and `revoked_at` can change. Tested in Task 2.
5. **A sensitive species' finds on the finds map.** Even the owner's map shows them in the list as "Location private" rather than as a pin, matching the species card note. Tested in Task 6.

---

### Task 1: Core integrity, rules, rarity, sets and badges

**Files:**
- Create:
  - `packages/core/src/scoring/integrity.ts`
  - `packages/core/src/scoring/rules-v1.ts`
  - `packages/core/src/scoring/index.ts`
  - `packages/core/src/rarity.ts`
  - `packages/core/src/collection.ts` (set progress and badge criteria)
- Test: `packages/core/src/scoring/integrity.test.ts`, `packages/core/src/scoring/rules-v1.test.ts`, `packages/core/src/rarity.test.ts`, `packages/core/src/collection.test.ts`

**Interfaces:**
- Produces:
```ts
// integrity.ts
export interface ScanFacts {
  appCheck: 'valid' | 'missing' | 'invalid';
  captureSource: CaptureSource;
  deviceTime: string; serverTime: string;
  location: { lat: number; lng: number; accuracyM: number; mocked: boolean } | null;
  previousScan: { lat: number; lng: number; at: string } | null;   // user's most recent located scan before this one
  imageHashSeen: boolean;
  sameSpeciesWithin30m: boolean;
  scoringScansToday: number;                                         // before this one
  presence: { gbifCount: number | null; tendrilCount: number };      // res-3 cell + ring-1; gbifCount null = unknown
}
export type IntegrityOutcome =
  | { outcome: 'ok' }
  | { outcome: 'no_points'; reason: NoPointsReason }
  | { outcome: 'held'; reason: 'location_quality' | 'plausibility' };
export function evaluateIntegrity(f: ScanFacts): IntegrityOutcome;
export const DAILY_SCORING_CAP = 20;

// rules-v1.ts
export interface ScoringContext {
  userId: string; observationId: string; speciesId: string; rarity: RarityTier;
  placeType: PlaceType | 'home'; isNewToPlantdex: boolean;
  repeatEligible: boolean;           // ≥1 km and ≥7 days from user's earlier finds of this species
  completedSets: { setId: string }[]; // sets this observation completes
  integrity: IntegrityOutcome;
}
export interface LedgerEntry { ruleId: 'new_species' | 'repeat_find' | 'set_complete'; ruleVersion: 1; points: number; reason: string; idempotencyKey: string; held: boolean }
export function scoreV1(ctx: ScoringContext): LedgerEntry[]; // no_points → []; held → entries with held=true
export const RARITY_POINTS: Record<RarityTier, number>; // { common:10, uncommon:40, rare:80, legendary:150 }

// rarity.ts
export function tierFromCount(count: number | null): RarityTier; // null → 'common' (unknown never inflates rarity)

// collection.ts
export interface SetDef { id: string; name: string; speciesIds: string[] }
export function setProgress(def: SetDef, found: Set<string>): { found: number; total: number; complete: boolean };
export function newlyCompletedSets(defs: SetDef[], before: Set<string>, after: Set<string>): string[];
export interface BadgeFacts { wildFinds: number; hedgerowFound: number; careStreakMax: number; bluebellPlaces: number }
export function badgeProgress(facts: BadgeFacts): { id: string; earned: boolean; current: number; target: number }[];
// first_find: wildFinds ≥ 1; hedgerow_half: hedgerowFound ≥ 4; month_of_care: careStreakMax ≥ 30; bluebell_wood: bluebellPlaces ≥ 3
```

- [ ] **Step 1: Write the failing tests**

`integrity.test.ts` has one test per row of the order in the Global Constraints, and checks the precedence: a gallery scan with a mocked location returns `no_points/gallery`, not `held`. It also covers:
- the 10-minute boundary: 10:00 apart is okay, 10:01 apart is `time_skew`
- accuracy of exactly 100 m is okay, 101 m is held
- the Dublin to New York case: Dublin at 10:00, New York at 10:30, held
- scans more than 24 hours apart are never speed-checked
- the daily cap: the 20th scan is okay, the 21st is `daily_cap`
- presence: `{gbifCount: null, tendrilCount: 0}` is `held/plausibility`; `{gbifCount: 0, tendrilCount: 1}` is ok

`rules-v1.test.ts` covers:
- a wild uncommon new species scores +40
- a shop new species scores +10
- a repeat find scores 2
- a held outcome gives the same entries with `held: true`
- `no_points` gives `[]`
- set completion adds `set_complete` 50, keyed per user and set
- the idempotency keys match the format exactly

`rarity.test.ts` covers the threshold boundaries (4999 is uncommon, 5000 is common, 49 is legendary, 50 is rare) and `null` → common.

`collection.test.ts` covers:
- the hedgerow set at 4 of 8
- `newlyCompletedSets` only reports sets that cross to complete
- each badge's thresholds

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm --filter @tendril/core test && pnpm --filter @tendril/core typecheck && pnpm test:functions`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): integrity checks, scoring rules v1, rarity tiers, sets and badges"
```

---

### Task 2: Ledger, collection tables, regional presence and the scoring queue

**Files:**
- Create:
  - `supabase/migrations/<ts>_scoring.sql`
  - `supabase/tests/database/080-ledger.test.sql`
  - `supabase/tests/database/081-collection.test.sql`
- Modify:
  - `supabase/seed/catalogue.ts` (export sets and badges)
  - `supabase/seed/build.ts` (emit set and badge rows)
  - `supabase/seed.sql` (regenerated)

**Interfaces:**
- Produces:
  - `public.score_events(id, user_id, observation_id, rule_id, rule_version, points, reason, idempotency_key unique, held, revoked_at, created_at)`:
    - owner select only; the service role can insert, plus update `held` and `revoked_at`; no one can delete
    - trigger `score_events_guard`: `before update` raises unless only `held` or `revoked_at` changed
  - `public.sets(id text pk, name, description, sort)` and `public.set_species(set_id, species_id, sort)`: public read
  - `public.user_set_progress(user_id, set_id, found, total, completed_at)`: owner read
  - `public.badges(id text pk, name, description, target, sort)`: public read
  - `public.user_badges(user_id, badge_id, current, earned_at)`: owner read; earned badges also show in the public profile RPC (Phase 5)
  - `private.regional_presence(species_id, cell_r3 bigint, gbif_count int null, tendril_count int, fetched_at, pk(species_id, cell_r3))`
  - pgmq queues `scoring` and `scoring_dlq`
  - service-role wrappers:
    - `public.srv_enqueue_scoring(observation_id uuid)`
    - `public.srv_read_scoring(qty int, vt int) returns table(msg_id bigint, read_ct int, message jsonb)`
    - `public.srv_ack_scoring(msg_id bigint)`
    - `public.srv_deadletter_scoring(msg_id bigint, message jsonb)`
  - cron job `tendril-tick`: `30 seconds`, `private.call_worker('/tick')`

- [ ] **Step 1: Write the failing tests**

`080-ledger.test.sql`:
- the service role can insert a row
- an update of `points` raises
- an update of `held` and `revoked_at` succeeds
- `delete` as the service role raises `42501`
- a duplicate `idempotency_key` raises `23505`
- the owner sees their own rows and another user sees none
- `authenticated` can't insert (`42501`)
- deleting the user still cascades their rows away (FK cascade runs as the table owner)

`081-collection.test.sql`:
- sets and badges are readable by `anon`
- the seeded "Irish hedgerow" has 8 species and "Easy-care houseplants" has 6
- `user_set_progress` is owner-only
- `private.regional_presence` is not readable by `authenticated`
- the pgmq wrappers can't be executed by `authenticated`
- a round trip through `srv_enqueue_scoring`, `srv_read_scoring` and `srv_ack_scoring` works as the service role

- [ ] **Step 2: Run them to verify they fail**, then write the migration and regenerate the seed, then run them to verify they pass

Run: `pnpm db:seed && pnpm db:reset && pnpm db:cron && pnpm db:test && pnpm db:types`
Expected: everything passes, and the types are regenerated.

- [ ] **Step 3: Commit**

```bash
git add supabase packages/db
git commit -m "feat(db): append-only score ledger, sets, badges, regional presence and scoring queue"
```

---

### Task 3: Scoring job in the worker

**Files:**
- Create:
  - `supabase/functions/_shared/scoring-job.ts`
  - `supabase/functions/_shared/providers/gbif.ts` (interface, REST implementation and fake)
  - `supabase/functions/_shared/providers/fixtures/gbif-count.json`
- Modify:
  - `supabase/functions/worker/handler.ts` (adds the `/tick` and `/rarity` routes)
  - `supabase/functions/observations/handler.ts` (confirm enqueues scoring, then `waitUntil(processOne(...))`; outcome reads the ledger)
- Test: `supabase/functions/tests/scoring_job_test.ts`, `supabase/functions/tests/gbif_test.ts`, `supabase/functions/tests/cheating_test.ts`

**Interfaces:**
- Produces:
  - `processScoring(db, deps, observationId): Promise<{ status: PointsStatus; entries: LedgerEntry[] }>`:
    1. Build `ScanFacts` from the observation, its location, the user's previous located scan, earlier hashes and finds, today's scoring-scan count and regional presence. On a cache miss for presence, fetch GBIF for the res-3 cell's bounding box (`cellToBoundary` → min/max lat and lng) plus the `tendril_count` of confirmed observations in the cell and ring 1.
    2. Run `evaluateIntegrity`.
    3. Update the Plantdex and work out which sets this completes.
    4. Run `scoreV1` and insert the entries with `on conflict (idempotency_key) do nothing`.
    5. Reserve a `scoring_scan` quota only when the outcome isn't `no_points`. Period is the day, `YYYY-MM-DD`, limit 20.
    6. Set the observation's `points_status` and `no_points_reason`.
    7. Upsert `user_set_progress` and `user_badges` from `badgeProgress`.
    8. Auto-release plausibility holds: when this find is accepted and someone else's held `new_species` entry exists for the same species in the same res-3 cell or ring 1, set `held = false` on that entry and its observation becomes `awarded`.
    9. Return.
  - `/tick` reads up to 20 messages (vt 60) and calls `processScoring` for each. On success it acks. On error it logs and lets the message become visible again. After 5 reads (`read_ct ≥ 5`) the message moves to the dead-letter queue.
  - `/rarity` (weekly cron `37 5 * * 1`) updates `species.rarity_tier` from `tierFromCount(gbifEuropeCount + gbifNorthAmericaCount)`, for at most 200 species per run, oldest-updated first.
  - `GET /observations/:id/outcome` returns `Outcome`, computed from the observation and its ledger rows. `points` is the sum of unrevoked entries, held included; `pointsStatus` is `held` when any entry is held. It also returns the Plantdex count and the sets touched.

- [ ] **Step 1: Write the failing tests**

`cheating_test.ts` is **the Phase 4 gate**. It runs against the fake database. For each anti-cheat row it builds an observation and asserts the stored `points_status`, `no_points_reason` and ledger rows:
- app check missing
- gallery
- time skew
- location off
- mocked
- low accuracy
- teleport
- duplicate hash
- same species within 30 m
- the 21st scan of the day
- implausible species

It also checks:
- a second, independent nearby find auto-releases the earlier plausibility hold
- confirming the same observation twice leaves exactly one ledger row (idempotency)

`scoring_job_test.ts` covers the happy path: a new uncommon wild find gives +40, Plantdex count +1, and the hedgerow set going from 4 to 5 of 8. Completing a set adds `set_complete` +50.

`gbif_test.ts` checks:
- the query string contains `license=CC0_1_0&license=CC_BY_4_0`, `limit=0`, `hasCoordinate=true` and `occurrenceStatus=PRESENT`
- `count` is parsed
- an HTTP 429 yields `null` (unknown), never 0

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm test:functions && pnpm check:functions && pnpm db:reset && pnpm db:cron && pnpm e2e:functions`
Expected: everything passes. Extend `scan_flow_test.ts` to assert that a confirmed `log_find` with `dev-ok` App Check reaches `points_status` `awarded` or `held` within 5 seconds.

- [ ] **Step 3: Commit**

```bash
git add supabase
git commit -m "feat(functions): server-side scoring job with anti-cheat suite, GBIF presence and rarity refresh"
```

---

### Task 4: Firebase App Check in the app

**Files:**
- Create:
  - `apps/mobile/src/services/integrity.firebase.ts`
- Modify:
  - `apps/mobile/src/services/integrity.ts` (choose a provider by environment)
  - `apps/mobile/app.config.ts` (when `FIREBASE_ENABLED=1`: plugins `@react-native-firebase/app` and `@react-native-firebase/app-check`; `expo-build-properties` with `ios.useFrameworks: 'static'`; `googleServicesFile` paths from `GOOGLE_SERVICES_PLIST` and `GOOGLE_SERVICES_JSON`; the App Attest entitlement)
- Test: `apps/mobile/src/services/integrity.test.ts`

**Interfaces:**
- Produces:
  - `firebaseIntegrity(): IntegrityProvider`:
    - configures `ReactNativeFirebaseAppCheckProvider` with Play Integrity on Android and App Attest (falling back to DeviceCheck) on Apple
    - `getToken()` calls `getToken(appCheck, false)` and returns `token`
    - errors return `null`, so the server identifies the plant but awards no points
  - The provider is chosen in this order:
    - Firebase when `EXPO_PUBLIC_FIREBASE_ENABLED === '1'` and the native module is present
    - otherwise the dev token when `EXPO_PUBLIC_APP_CHECK_DEV === '1'`
    - otherwise none
  - `RUNBOOK.md` entries, added in Phase 8: Firebase project, the App Check providers, `FIREBASE_PROJECT_NUMBER` and `FIREBASE_APP_IDS` on the server, and switching `APP_CHECK_MODE=firebase`.

- [ ] **Step 1: Install the dependencies:** `npx expo install @react-native-firebase/app @react-native-firebase/app-check expo-build-properties`

- [ ] **Step 2: Write the failing tests** in `integrity.test.ts`, mocking the native module:
  - selection order: Firebase, then dev, then none
  - `getToken` rejecting returns `null`
  - the module missing in Expo Go falls back without crashing

- [ ] **Step 3: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm --filter @tendril/mobile test -- integrity && pnpm --filter @tendril/mobile typecheck`
Expected: the tests fail before implementation and pass after.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): Firebase App Check integrity tokens in dev and release builds"
```

---

### Task 5: Collection reads in `SupabaseApi`

**Files:**
- Create: `supabase/migrations/<ts>_collection_rpcs.sql`, `supabase/tests/database/082-collection-rpcs.test.sql`
- Modify: `apps/mobile/src/api/supabase/SupabaseApi.ts`, `apps/mobile/src/api/supabase/mappers.ts`
- Test: `apps/mobile/src/api/supabase/collection.test.ts`

**Interfaces:**
- Produces these RPCs (security invoker, so RLS applies):
  - `public.my_plantdex(p_filter text) returns jsonb`: entries with species, category, finds count and first photo path, plus `{ counts: { all, houseplants, wild } }`
  - `public.species_card(p_species_id uuid) returns jsonb`: species, my finds count, sets containing it with my progress, toxicity
  - `public.my_sets() returns jsonb`: each set with tiles (`found` and species, or null for missing)
  - `public.my_finds() returns jsonb`:
    - my confirmed `log_find` observations with species, place type and date
    - `lat`/`lng` from my own `observation_locations` (my rows only, through RLS)
    - **null coordinates for sensitive species**
  - `public.my_badges() returns jsonb`

  `SupabaseApi` implements `getPlantdex`, `getSpeciesCard`, `getSets`, `getFinds`, `getBadges` and `getOutcome` (ledger-backed) with them.

- [ ] **Step 1: Write the failing tests**

`082-collection-rpcs.test.sql`:
- `my_finds()` as the owner returns coordinates for normal finds and null for a sensitive species' find
- another user calling `my_finds()` gets an empty array
- the Phase 2A leak guard (`051-no-coordinates-leak`) still passes. Extend its allowlist to `my_finds` only if you can show that `my_finds` reads `observation_locations` under RLS for `auth.uid()` alone, and add a comment explaining why.

`collection.test.ts`: the mappers produce `PlantdexEntry`, `CollectionSet` tiles and `FindListItem`, with `lat` null for sensitive species.

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm db:reset && pnpm db:test && pnpm --filter @tendril/mobile test -- collection`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add supabase apps/mobile
git commit -m "feat: collection RPCs and SupabaseApi Plantdex, sets, finds and badges"
```

---

### Task 6: Owner-only finds map and live new-species outcome

**Files:**
- Modify:
  - `apps/mobile/src/components/FindsMap.tsx` (native: exact pins for finds with coordinates; sensitive finds appear only in the list, as "Location private")
  - `apps/mobile/src/app/scan/[id]/new-species.tsx` (polls `getOutcome` every 1 s for up to 8 s while `processing`, showing the photo with a subtle progress indicator; on timeout shows "Points are on their way." and continues)
- Test: `apps/mobile/src/components/FindsMap.test.tsx`, `apps/mobile/src/__tests__/routes/newSpeciesPolling.test.tsx`

**Interfaces:**
- Consumes: `my_finds`, `getOutcome`.
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests:**
  - `FindsMap` renders one marker per find with coordinates, none for sensitive finds, and lists the sensitive find with "Location private"
  - the polling container shows +40 once the outcome flips from `processing` to `awarded`, and the timeout copy after 8 s (use jest fake timers)

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm --filter @tendril/mobile test && pnpm verify`
Expected: everything passes.

- [ ] **Step 3: Check by hand against the local stack (web)**

1. Log a wild find of foxglove with the dev App Check token. Expect "+40", "38 species" and "Irish hedgerow 5 of 8".
2. Log a gallery find. Expect the gallery note.
3. Open the Collection map. On web the list fallback is fine.

Record the steps and screenshots in the report.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): owner-only finds map and live new-species outcome"
```
