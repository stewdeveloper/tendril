# Phase 5: Streaks, Leagues and Social Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Load `supabase:supabase` and `supabase:supabase-postgres-best-practices` before writing SQL or function code.

**Goal:** Daily care and weekly discovery streaks are evaluated in each user's timezone, with freezes and winter mode. Weekly leagues group nearby players by H3 cell, with boards computed from the ledger, and week results are pushed every Monday. Friends, invites and referral freezes work, and push notifications are delivered through Expo.

**Architecture:**
- **Rules:** pure functions in `@tendril/core/streaks.ts` and `@tendril/core/leagues.ts`.
- **Streak updates:**
  - Check-ins update the care streak right away in `care/checkins`.
  - New Plantdex species update the discovery streak in the scoring job.
  - An hourly worker route closes local days and weeks for users whose midnight has just passed.
- **Leagues:**
  - Rows exist per week and cell, and a user joins on their first awarded points of the week.
  - Boards are summed from the ledger when read, through a security-definer RPC that returns only handle, rank and points.
  - A Monday job writes `week_results` and queues pushes.
- **Social:** the `social` function handles exact-handle search, friend requests, invites and referral redemption.
- **Push:** the `push` pgmq queue is drained by `/tick` and sent through the Expo push API with a `PushSender` interface (real or fake).

**Tech Stack:** As before, plus `expo-notifications` push tokens on the app side (needs an EAS project ID).

**Spec:** `docs/superpowers/specs/2026-10-03-tendril-v1-design.md` (§10 streaks, leagues and social, §2 defaults for the league week and winter mode). Design frames 2e, 4f–4h and 4aq–4ax.

## Global Constraints

- **Daily care streak:**
  - A local day counts when it has at least one check-in event by the user. The first check-in of the day extends the streak at once.
  - At the end of a local day with no check-in:
    - a held freeze is spent automatically (event `freeze_used`, length unchanged)
    - otherwise the streak breaks (`last_broken_len = current`, `current = 0`, event `broken`)
- **Weekly discovery streak:**
  - An ISO week (Monday to Sunday, user timezone) counts when it has a species new to the user's Plantdex.
  - A missed week breaks the streak unless winter mode is on, in which case the week is skipped without breaking or extending it.
- **Freezes:**
  - Premium holds 2 at all times, refilled nightly.
  - Free users earn 1 per redeemed invite, holding at most 2.
- **Winter mode:**
  - It's an explicit toggle, offered only from 1 Nov to 28/29 Feb in the northern hemisphere, or 1 May to 31 Aug in the southern (latitude < 0, from the home zone).
  - It turns itself off automatically when the season ends.
- **League week:** Monday 00:00 UTC to Sunday 23:59:59 UTC. Days left = whole days until the next Monday 00:00 UTC, rounded up. The UI says "resets Monday".
- **League assignment:**
  - The league cell is the H3 res-5 cell of the home zone's centre, or of the first scoring find when there's no zone.
  - Search the week's leagues whose cell is in `gridDisk(cell, k)` for k = 0, 1, 2, 3, in that order. Pick the first with fewer than 30 members, preferring the most members within the same k. Otherwise create a new league for the cell.
- **Boards:**
  - The sum of `score_events.points` where `held = false`, `revoked_at is null` and `created_at` is within the week, for league members.
  - Ranks go by points descending, then by who reached that total first (earliest last-scoring event), then by handle.
  - Rows show the handle and points only. The user's own row reads "You · @handle".
- **Friends:**
  - Search is exact-handle only, case-insensitive, and returns a single result or nothing; there are no prefix matches.
  - A request becomes a friendship on acceptance.
  - The friends board is computed when read, for the user plus accepted friends.
- **Push:**
  - Only for social events: friend requests, acceptances and week results. No marketing.
  - The API takes at most 100 messages per request.
  - Delete tokens on `DeviceNotRegistered`.
  - `PUSH_PROVIDER=fake|expo`, `EXPO_ACCESS_TOKEN`.
- **Copy:**
  - "Your 12-day streak needs one check-in today."
  - "A freeze kept your 12-day streak going."
  - "Your last streak ran 16 days. Any check-in starts a new one."
  - "A quiet week" / "No points this week. A new board starts Monday."
  - No guilt, and nothing red for a broken streak.

## Review Focus

1. **A user who changes timezone mid-streak**, for example flying from Dublin to New York. A day is evaluated once, in the timezone stored when the day closes, and changing timezone must never double-break or double-extend a day. Tested in Task 1 by evaluating with an `evaluatedThrough` date marker.
2. **The hourly evaluator running twice in the same hour, or missing an hour.** Evaluation is idempotent (`evaluatedThrough`), and a missed hour is caught up on the next run, covering all days since `evaluatedThrough`. Tested in Task 1 and Task 3.
3. **A league reaching 30 members while two users join at the same moment.** A row lock (`select … for update` on the league) prevents a 31st member. Tested in Task 2 (pgTAP, one session simulating sequential joins at the cap).
4. **A held point that's later released.** Its points move onto the board for the week of the original event, and the board updates. Tested in Task 3.
5. **An invite redeemed by the inviter themselves, or twice, or by an existing account.** None of these grant a freeze; only a new account's first redemption does. Tested in Task 4.

---

### Task 1: Core streak and league rules

**Files:**
- Create: `packages/core/src/streaks.ts`, `packages/core/src/leagues.ts`
- Test: `packages/core/src/streaks.test.ts`, `packages/core/src/leagues.test.ts`

**Interfaces:**
- Produces:
```ts
// streaks.ts
export interface CareStreak { current: number; longest: number; lastDay: IsoDate | null; evaluatedThrough: IsoDate | null; freezes: number; lastBrokenLen: number | null }
export interface DiscoveryStreak { current: number; longest: number; lastWeek: string | null; evaluatedThrough: string | null; winterMode: boolean }
export type StreakEvent = { kind: 'extended' | 'freeze_used' | 'broken'; on: IsoDate; length: number };
export function onCheckIn(s: CareStreak, today: IsoDate): CareStreak;                       // first check-in of a day extends
export function closeDays(s: CareStreak, today: IsoDate): { state: CareStreak; events: StreakEvent[] }; // evaluates every day from evaluatedThrough+1 to yesterday
export function onNewSpecies(s: DiscoveryStreak, isoWeek: string): DiscoveryStreak;
export function closeWeeks(s: DiscoveryStreak, currentIsoWeek: string): DiscoveryStreak;
export function isoWeek(date: IsoDate): string;                                              // "2026-W40"
export function winterModeAvailable(today: IsoDate, latitude: number | null): boolean;
export function careStreakState(s: CareStreak, today: IsoDate, lastEvent: StreakEvent | null): StreakSummary['careState'];
export function calendarMarks(today: IsoDate, checkInDays: Set<IsoDate>, freezeDays: Set<IsoDate>, brokenOn: IsoDate | null): DayMark[]; // 28, oldest first
export const MAX_FREE_FREEZES = 2; export const PREMIUM_FREEZES = 2;

// leagues.ts
export function weekStartUtc(now: Date): IsoDate;    // Monday
export function daysLeftInWeek(now: Date): number;
export interface LeagueCandidate { id: string; cell: string; members: number }
export function chooseLeague(cell: string, candidates: LeagueCandidate[], ring: (cell: string, k: number) => string[]): LeagueCandidate | null; // null → create
export const LEAGUE_CAP = 30;
export interface BoardInput { userId: string; handle: string; points: number; lastScoredAt: string; pending: boolean }
export function rankBoard(rows: BoardInput[], youId: string): BoardRow[];
```

- [ ] **Step 1: Write the failing tests**

`streaks.test.ts` covers:
- the first check-in of a day extends the streak, and a second check-in the same day doesn't
- a missed day with a freeze spends it and keeps the length
- a missed day without a freeze breaks it and records `lastBrokenLen`
- three missed days with one freeze: the freeze covers the first, and the second breaks the streak
- `closeDays` run twice for the same `today` produces no extra events (idempotent)
- a skipped hour: `closeDays` with `today` two days after `evaluatedThrough` evaluates both days
- discovery: a week with a new species extends; a missed week breaks; a missed week with `winterMode` neither breaks nor extends
- `isoWeek('2026-12-31') === '2026-W53'`; `isoWeek('2027-01-04') === '2027-W01'`
- `winterModeAvailable` is true on 2026-11-01 and 2027-02-28 and false on 2026-10-31 in the north, and true on 2026-07-01 at latitude −33
- `calendarMarks` gives the last 28 days with the freeze day marked

`leagues.test.ts` covers:
- `weekStartUtc` for a Sunday 23:00 UTC is the previous Monday
- `daysLeftInWeek` on Friday 12:00 UTC is 3
- `chooseLeague` prefers k = 0, then fuller leagues within the same k, skips full leagues (30), and returns null when nothing within k ≤ 3 has room
- `rankBoard` uses points descending and breaks ties by earliest `lastScoredAt`, then handle; marks `isYou`; and passes `pending` through

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm --filter @tendril/core test && pnpm --filter @tendril/core typecheck && pnpm test:functions`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): timezone-safe streaks with freezes and winter mode; league assignment and ranking"
```

---

### Task 2: Streak, league, social and push tables

**Files:**
- Create:
  - `supabase/migrations/<ts>_social.sql`
  - `supabase/tests/database/090-streaks-leagues.test.sql`
  - `supabase/tests/database/091-social.test.sql`

**Interfaces:**
- Produces:
  - `public.streaks(user_id pk, care jsonb, discovery jsonb, updated_at)`: owner read; `care` and `discovery` hold the `CareStreak` and `DiscoveryStreak` JSON
  - `public.streak_events(id, user_id, kind, on_date, length, created_at)`: owner read
  - `public.leagues(id, week_start date, cell_r5 text, created_at)`, unique on (week_start, cell_r5, id)
  - `public.league_memberships(league_id, user_id, week_start, joined_at)`, unique on (user_id, week_start)
  - `public.week_results(user_id, week_start, league_id, rank, of, points, best_species_id, created_at)`: owner read
  - `private.join_league(uid uuid, week date, cell text, candidates jsonb) returns uuid`: locks candidate leagues `for update` and inserts the membership if there's still room, otherwise creates a league
  - `public.league_board() returns jsonb`: security definer; the caller's league this week, with `{handle, points, lastScoredAt, pending, isYou}` per member, and `joined: false` when the caller has no membership
  - `public.friends_board() returns jsonb`: security definer; the caller plus accepted friends, the same shape
  - `public.friendships(user_a, user_b, requested_by, status, created_at, accepted_at)`, with `check (user_a < user_b)`, primary key (user_a, user_b); participants can read
  - `public.invites(code pk, inviter_id, created_at, redeemed_by unique null, redeemed_at)`: the inviter can read their own
  - `public.public_profile(p_handle text) returns jsonb`: security definer; handle, display name, Plantdex count and earned badge names only
  - pgmq queue `push`, with wrappers `srv_enqueue_push(user_id uuid, title text, body text, data jsonb)`, `srv_read_push` and `srv_ack_push`
  - cron jobs `tendril-hourly` (`3 * * * *`, `/hourly`) and `tendril-weekly` (`10 0 * * 1`, `/weekly`)

- [ ] **Step 1: Write the failing tests**

`090-streaks-leagues.test.sql`:
- streaks and streak events are owner-only
- `league_board()` returns members' handles and points, with no `user_id` and no cell
- a user outside the league gets `joined: false`
- held points are excluded and revoked points are excluded
- `private.join_league` stops at 30: insert 30 memberships, then a 31st call creates a new league
- `authenticated` can't execute `private.join_league`

`091-social.test.sql`:
- friendship rows are readable only by participants
- `friends_board()` includes accepted friends only, not pending ones
- `public_profile('aoifegrows')` returns no pets, plants or locations (check the JSON keys exactly)
- invites are readable by the inviter only
- the `user_a < user_b` check rejects reversed pairs

- [ ] **Step 2: Run them to verify they fail**, then write the migration, then run them to verify they pass

Run: `pnpm db:reset && pnpm db:cron && pnpm db:test && pnpm db:types`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add supabase packages/db
git commit -m "feat(db): streaks, leagues with capped joins, boards from the ledger, friendships, invites and push queue"
```

---

### Task 3: Streak and league logic in the server functions

**Files:**
- Create: `supabase/functions/_shared/streaks-job.ts`, `supabase/functions/_shared/leagues-job.ts`, `supabase/functions/_shared/push.ts`
- Modify:
  - `supabase/functions/care/handler.ts` (`onCheckIn` and `streakDays` in the response)
  - `supabase/functions/_shared/scoring-job.ts` (`onNewSpecies`; league join on first awarded points)
  - `supabase/functions/worker/handler.ts` (adds `/hourly` and `/weekly`; `/tick` also drains the `push` queue; `/nightly` refills Premium freezes to 2)
- Test: `supabase/functions/tests/streaks_job_test.ts`, `supabase/functions/tests/leagues_job_test.ts`, `supabase/functions/tests/push_test.ts`

**Interfaces:**
- Produces:
  - **`/hourly`:** for users whose local time is between 00:00 and 00:59, runs `closeDays` and `closeWeeks` (on Mondays), persists the results, and records events. It catches up on any days since `evaluatedThrough`.
  - **`/weekly`:** for last week's leagues, ranks every member, writes `week_results` (rank, of, points and best find by rarity, then points), and queues a push: "Week results: 4th of 20" or "A quiet week". Idempotent on (user, week).
  - **`PushSender`** with `send(messages: { to: string; title: string; body: string; data: object }[]): Promise<{ ok: string[]; invalidTokens: string[] }>`. Implementations: `expoPushSender(accessToken?)`, batching 100 per request, and `fakePushSender`.
  - **`/tick`'s push drain** resolves each user's tokens, sends the messages, and deletes invalid tokens.
  - **Released holds:** releasing a held entry (from Phase 4's auto-release or the admin action in Phase 7) needs no board recomputation, because boards are computed when read.

- [ ] **Step 1: Write the failing tests:**
  - `streaks_job_test.ts`:
    - a check-in extends the streak and the response carries `streakDays`
    - `/hourly` breaks the streak for a user whose local midnight just passed, but not for a user in another timezone where it's still evening
    - running `/hourly` twice gives the same result
    - `/nightly` refills a Premium user's freezes to 2 and leaves a Free user's unchanged
  - `leagues_job_test.ts`:
    - a first awarded find joins a league
    - a held-only find doesn't join
    - `/weekly` writes the results and queues pushes, and running it twice adds nothing
  - `push_test.ts`:
    - 250 messages make 3 requests
    - a `DeviceNotRegistered` ticket is returned as an invalid token and that token is deleted

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm test:functions && pnpm check:functions && pnpm e2e:functions`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add supabase
git commit -m "feat(functions): streak evaluation per timezone, weekly leagues and results, Expo push delivery"
```

---

### Task 4: `social` function

**Files:**
- Create: `supabase/functions/social/index.ts`, `supabase/functions/social/handler.ts`
- Modify: `supabase/config.toml`
- Test: `supabase/functions/tests/social_test.ts`

**Interfaces:**
- Produces:
  - `GET /users?handle=<h>`: exact, case-insensitive match. Returns `{ handle, plantdexCount } | null`. Rate-limited to 30 requests per minute per user with an in-memory counter, falling back to 429 `conflict`.
  - `POST /friends { handle }`: creates a pending friendship and pushes "@x wants to compare finds with you".
  - `POST /friends/:userId/accept`: pushes "@x accepted your friend request".
  - `DELETE /friends/:userId`.
  - `POST /invites`: returns `{ code, url: <TENDRIL_WEB_ORIGIN>/i/<code> }`.
  - `POST /invites/:code/redeem`:
    - Valid only when the caller's account was created after the invite, the caller isn't the inviter, and the invite hasn't been redeemed.
    - It grants the inviter +1 freeze, up to 2, but only when the inviter is on Free.
    - Otherwise it returns 409 `conflict`, with nothing granted.
  - `GET /profiles/:handle`: wraps `public_profile`.

- [ ] **Step 1: Write the failing tests:**
  - an exact search finds the user, and a prefix finds nothing
  - a friend request queues a push
  - redeeming your own invite returns 409
  - a second redemption returns 409
  - a redemption by an account older than the invite returns 409
  - a valid redemption gives a Free inviter +1, capped at 2

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm test:functions && pnpm check:functions`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add supabase
git commit -m "feat(functions): social search, friends, invites and referral freezes"
```

---

### Task 5: Streaks, leagues and friends live in the app

**Files:**
- Create:
  - `apps/mobile/src/app/i/[code].tsx`: invite deep link; stores the code, which is redeemed after bootstrap
  - `apps/mobile/src/services/push.ts`
- Modify:
  - `apps/mobile/src/api/supabase/SupabaseApi.ts`: `getStreaks`, `getToday` (streak, freezes and league standing), `getLeague`, `getFriends`, `findHandle`, `sendFriendRequest`, `createInvite`, `getWeekResult`, `getProfile` (real streak numbers); plus `setWinterMode(on)`, added to `TendrilApi` with a fixture implementation
  - `apps/mobile/src/session/SessionProvider.tsx`: redeems a stored invite code after bootstrap
  - `apps/mobile/src/screens/today/StreaksScreen.tsx`: the winter mode row is a toggle when `winterModeAvailable`
- Test: `apps/mobile/src/api/supabase/social.test.ts`, `apps/mobile/src/services/push.test.ts`

**Interfaces:**
- Produces:
  - `registerPushToken(api)`: after the notifications permission is granted, `getExpoPushTokenAsync({ projectId: Constants.expoConfig.extra.eas.projectId })`, then `me/push-token`. It does nothing when no project ID is configured, or on web.
  - `TendrilApi.setWinterMode(on: boolean): Promise<StreakSummary>`.

- [ ] **Step 1: Write the failing tests:**
  - the board JSON maps to `LeagueBoard`, with the user's own row first marked `isYou`
  - `findHandle` returns null for a not-found result
  - `registerPushToken` skips when there's no project ID
  - the invite code is redeemed exactly once after bootstrap

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm --filter @tendril/mobile test && pnpm verify`
Expected: everything passes.

- [ ] **Step 3: Check by hand against the local stack (web)**

1. With two test users, user A invites user B; user B signs up through `/i/<code>`, and user A's freezes become 1.
2. User B logs a find.
3. Both users appear on the same league board, with "You" marked for each in their own view.
4. User A sends user B a friend request and user B accepts; the friends board shows both.

Record screenshots in the report.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): live streaks, winter mode, league and friends boards, invites and push tokens"
```
