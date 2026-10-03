# Tendril v1: design spec

Oct 3, 2026 · implements the system architecture (`docs/tendril-arch.md`), the UX brief (`docs/ux/tendril-ux-doc.md`) and the Claude Design project (`design/claude-design/`, frames rendered in `design/screens/`). Research behind the versions and APIs: `docs/research/2026-10-03-stack-research.md`.

## 1. Outcome and success criteria

Tendril v1 is the whole product the two docs describe:
- an Expo app for iOS and Android
- a Supabase backend that is the only judge of quotas, points, streaks, leagues and entitlements
- a Next.js site for label QR pages, species pages, deep links and admin

It must be runnable and testable on this machine without any paid account. The services that need your accounts sit behind interfaces with working fakes, and switching to the real service is a config change.

v1 is done when all of these hold:
1. **Screens:** every one of the 88 design frames (2a–2g, 3a–3k, 4a–4bk, 6a–6g) has a matching screen and state. Each was checked side by side with its design render, and the 18 components in the component sheet exist with their states.
2. **Flows:** the eight journeys in the UX brief run end to end against the local Supabase stack with fake providers:
   - first run
   - scan to result
   - care check-in
   - pet safety
   - paywall and preview
   - label QR adoption
   - streaks and leagues
   - account deletion
3. **Server rules:** the server enforces every rule in the architecture doc, each with an automated test:
   - quotas are reserved in the same transaction as the call they pay for
   - points come only from the ledger
   - anti-cheat checks run server-side
   - precise locations are owner-only
   - sensitive taxa never get a public location
   - unknown toxicity is never shown as safe
4. **Ready for your keys:** swapping in real Plant.id, RevenueCat, WeatherKit, App Check, Apple and Google credentials needs only environment variables and dashboard setup, all listed in a runbook.

## 2. What's settled and what I assumed

**From you:**
- Name: Tendril.
- Markets: Ireland, the EU and the US, in English.
- Prices: $24.99 a year or $4.99 a month, with caps of 10 or 60 identifications and 1 or 10 diagnoses a month.
- Personal developer accounts.
- Launch: 15 March 2027.
- Scope: build the whole thing ("do the whole thing").

**My defaults (each can be changed later in one place):**

| Decision | Default | Where it lives |
| --- | --- | --- |
| App icon | Concept 7a "Spiral" | `apps/mobile/assets/icon/` |
| Bundle and package ID | `app.tendril` | `apps/mobile/app.config.ts` env `TENDRIL_APP_ID` |
| Web domain | `tendril.app` | env `TENDRIL_WEB_ORIGIN` |
| Confidence bands | Very likely ≥ 80%, likely 50–79%, not sure < 50% | `packages/core/src/confidence.ts` |
| Point values | See §8.3 (placeholders, as the UX brief says) | `packages/core/src/scoring/rules-v1.ts` |
| League week | Monday 00:00 UTC to Sunday 23:59 UTC | `packages/core/src/leagues.ts` |
| Winter mode | Explicit toggle, offered 1 Nov–28 Feb in the north (1 May–31 Aug in the south); while on, a week with no new species doesn't break the discovery streak | `packages/core/src/streaks.ts` |
| Email sign-in | Magic link with a 15-minute expiry, as the design shows | `supabase/config.toml` |
| Toxicity seed | ASPCA pages for 22 plants; 5 with no ASPCA page stay Unknown; every seed row is marked "pending vet review" | `supabase/seed/` |
| Poison line | US only (ASPCA); Ireland and the EU show the vet only until a line is confirmed | `packages/core/src/emergency.ts` |

**Deviations from the architecture doc, all forced by research:**
- H3 cells are computed with h3-js in Edge Functions, because Supabase has no H3 extension.
- The `jobs` table becomes pgmq queues.
- The public finds projection is deferred until find sharing has a UI, because v1 has no sharing control. The `public_cell_r5` column and its rules are still built and tested now.

## 3. Build phases

Each phase gets its own implementation plan, executed and verified before the next starts. Phases 2–7 need Docker for the local Supabase stack.

| # | Phase | Delivers | Gate |
| --- | --- | --- | --- |
| 0 | Foundations | pnpm monorepo, `packages/core` skeleton, tooling, Deno, Supabase CLI init, CI workflow | `pnpm test` and `pnpm typecheck` pass across the repo |
| 1 | Design system and every screen | Mobile theme, 18 components, all 88 frames as screens on fixture data, real navigation, dev catalog, visual comparison tool | Every frame compared side by side; component tests pass |
| 2 | Backend core and live scan | Schema, RLS and pgTAP tests; storage; auth; seeds; `me`, `identify`, `observations` and `care` (basic) functions; Plant.id and fake providers; quotas; app wired to Supabase for sign-in, onboarding, scan, result, add plant, check-in | RLS suite green; scan-to-plant flow passes end to end against the local stack |
| 3 | Care loop | Care engine v1 (free and premium), diagnoses and their plan effects, WeatherKit and fake, local notifications, offline check-in and scan queues | Engine unit tests; check-in and diagnosis flows end to end |
| 4 | Collection and scoring | Scoring worker on pgmq, ledger, integrity checks (App Check), rarity (GBIF seed), plausibility, Plantdex, sets, badges, finds map, sensitive taxa, home privacy zone | Cheating test suite (every row of the anti-cheat table) passes |
| 5 | Streaks, leagues, social | Streak evaluation in the user's timezone, freezes, winter mode, weekly leagues and results, friends, invites and referrals, Expo push | Week-close simulation test; streak edge cases |
| 6 | Money and account | Entitlements, 7-day preview, RevenueCat SDK, webhook and reconciliation, paywall states, limit sheets, premium gating, household sharing, holiday hand-over, account deletion with Apple revoke | Billing webhook tests; deletion removes every row and object |
| 7 | Web and admin | Next.js label and species pages, well-known files, admin (curation, labels and partners, moderation, held points, support lookup), QR attribution, deep links and the Android install referrer in the app | Playwright web suite; link files validate |
| 8 | Release readiness | EAS profiles, icons and splash, Sentry, PostHog, `RUNBOOK.md` (keys, dashboards, store checklist), final review | Full test run green; runbook complete |

## 4. Repository layout

```
tendril/
  package.json  pnpm-workspace.yaml  .npmrc (node-linker=hoisted, for Expo)
  tsconfig.base.json  .github/workflows/ci.yml
  apps/
    mobile/        Expo SDK 57, expo-router, TypeScript
    web/           Next.js 16, App Router
  packages/
    core/          @tendril/core: pure TypeScript domain logic, no runtime deps
  supabase/
    config.toml  migrations/  seed.sql  seed/  tests/database/
    functions/  _shared/  me/  identify/  observations/  care/  social/
                labels/  billing-webhook/  worker/  tests/
  tools/visual/    Playwright: catalog screenshots and side-by-side comparisons
  design/          claude-design/ (source) and screens/ (rendered frames)
  docs/
```

**`@tendril/core` is shared by all three runtimes:**
- Metro (mobile), Next.js (web) and Deno (Edge Functions) all import it.
- It has no npm dependencies.
- Relative imports use explicit `.ts` extensions, with `allowImportingTsExtensions` set.
- Edge Functions import it through each function's `deno.json` (`"@core/": "../../../packages/core/src/"`).
- Phase 0 smoke-tests that `supabase functions serve` and a deploy dry run both bundle it.
- Fallback if bundling fails: a build step copies `packages/core/src` into `supabase/functions/_shared/core/`, and CI checks the copy is current.

**Tooling:**
- pnpm 12 and Node 22.13 or later.
- vitest for core, web and tools.
- jest-expo with @testing-library/react-native for mobile.
- Deno 2.9.6 for function tests, pinned as a root dev dependency through npm's `deno` package (no sudo, no `unzip`). Function code stays within Deno 2.1, which is what the edge runtime supports.
- pgTAP for the database.
- ESLint and Prettier on defaults.
- Every package has `test`, `typecheck` and `lint` scripts; the root scripts run them all.

## 5. `@tendril/core`: the domain rules

Everything with a rule lives here as pure functions, written test first, so the app, the server and the web show and enforce the same thing.

| Module | Holds |
| --- | --- |
| `tokens.ts` | Colour tokens for both themes, verdict and rarity colours, the type scale, spacing, radii, motion durations, exactly as in the UX brief |
| `copy.ts` | Every user-facing line from the UX brief's Copy table, with parameters (pet name, plant name, dates) |
| `confidence.ts` | `bandFor(probability)`, `confidenceLabel()` ("Very likely, 94%") and the accessible version ("Very likely, 94 percent") |
| `toxicity.ts` | Severity enum, chip label ("Cats: Moderate"), accessible label ("Cats: moderate toxicity"), the one-line pet check, the likely-match note rule, "unknown is never safe" |
| `quota.ts` | Limits by plan, `periodKey(kind, now, timezone)`, `resetDate()`, and limit-reached copy (Free vs Premium at its cap) |
| `care/engine.ts` | Next-check calculation, check-in outcome, diagnosis effects, weather adjustments (§9) |
| `scoring/` | Integrity evaluation and the versioned rules (v1), producing ledger entries plus held or no-points reasons (§8) |
| `streaks.ts` | Daily care and weekly discovery evaluation, freezes, winter mode, "last day" state |
| `leagues.ts` | Week key, league assignment given candidate leagues and a neighbour function, ranks |
| `privacy.ts` | Home zone randomisation, inside-zone test (haversine), `publicCellAllowed()` |
| `rarity.ts` | Rarity tier from regional occurrence counts |
| `emergency.ts` | Poison line by country (US: ASPCA (888) 426-4435; others: none yet) |
| `api.ts` | Request and response types for every Edge Function route (§7), so app and server share one contract |
| `fixtures/` | The UX brief's sample data (@aoifegrows, Miso, Bran, Monty, Spidey, Lily, the league, the sets…) for app fixture mode, seeds and tests |

## 6. Mobile app

### 6.1 Structure

```
apps/mobile/src/
  app/            routes (thin containers: data hooks → screen props)
  screens/        presentational screens, one per design screen, props only
  components/     the 18 design-system components and primitives
  theme/          ThemeProvider (light/dark from the system), useTheme, AppText variants
  api/            TendrilApi interface + supabase/ and fixture/ implementations, TanStack Query hooks
  services/       camera, photos, location, notifications, integrity, purchases, auth, offline queue
  catalog/        dev-only registry: design frame id → screen + fixture props
```

- **Screens take props only.** Every design frame renders the same way in three places: the real route, the dev catalog and the jest tests.
- **The API mode is chosen by `EXPO_PUBLIC_API_MODE`:**
  - `fixture` runs fully offline on the sample data, so the app works with no backend.
  - `supabase` talks to the local stack or a hosted one.

### 6.2 Design system

- **Theme:**
  - Tokens come from `@tendril/core/tokens`, and both themes follow the device setting.
  - Chip and badge text is white in light mode and `#0E1A13` in dark mode.
  - No colours outside the tokens, and no gradients behind text.
- **Type:**
  - `AppText` variants map one-to-one to the type scale:
    - `moment`: Fraunces 600, 34
    - `title`: Fraunces 600, 28
    - `heading`: Inter 600, 20
    - `body`: Inter 400, 17
    - `bodyStrong`: Inter 600, 17
    - `sub`: Inter 400, 15
    - `sci`: Inter italic, 15
    - `caption`: Inter 500, 13
  - Fonts load through `@expo-google-fonts`.
  - Text scales with the system setting; only layout-critical labels cap `maxFontSizeMultiplier`.
  - Verdict words wrap and are never truncated.
- **Layout:** 4 pt grid, 16 pt screen margins, 16 pt card corners, fully rounded chips, controls at least 44 pt (48 dp on Android).
- **The 18 components** come from the component sheet (5a–5r), each with every listed state:
  - Confidence label
  - Pet check card (with "My pet ate this" and the likely-match note)
  - Pet verdict chip (icons: CircleQuestionMark, CircleCheck, TriangleAlert, Diamond with an exclamation, OctagonAlert)
  - Rarity badge (leaf count or a flower)
  - Plant card
  - Task row
  - Check-in sheet
  - Quota meter
  - Streak counter
  - League row
  - Plantdex tile
  - Find marker
  - Plan card
  - Permission primer
  - Button (primary, secondary, text, danger; pressed, disabled, loading)
  - Sheet (half or full height, grab handle, title, close)
  - Empty state (the tendril line drawing from the design)
  - Snackbar (with Undo)
- **Primitives the frames also need:**
  - Note banner (light and dark)
  - Segmented control
  - Option pills
  - Grouped rows card
  - Text input
  - Streak calendar
  - Hero photo header (with scrim and back button)
  - Screen header (title and avatar)
  - Back bar
  - Custom tab bar (5 tabs with a raised Scan button and labels always shown)
  - Photo slot (shows the design's placeholder look when there's no photo)
- **Sheets are our own component**, not router `formSheet`, so they look like the design on iOS, Android and web. They use a dimmed backdrop and a slide-up.
- **Motion:** fades and short slides of 200–300 ms. With Reduce Motion on (read live through `AccessibilityInfo`), movement becomes a fade and the new-species moment is a static card. A tap skips the moment, which lasts under 1.5 s.

### 6.3 Routes

Built with expo-router. Onboarding and the tabs are separated by `Stack.Protected` guards, and the splash screen stays up until the session and fonts have loaded.

| Route | Screen | Design frames |
| --- | --- | --- |
| `(onboarding)/welcome` | Welcome | 3a |
| `(onboarding)/age`, `age-stop` | Age, under-13 stop (persists, no back) | 3b, 3c |
| `(onboarding)/sign-in`, `link-sent`, `link-expired` | Sign in | 3d, 3e, 3f |
| `(onboarding)/pets` | Pets | 3g, 3h |
| `(onboarding)/home-area` | Home area | 3i, 3j |
| `(onboarding)/first-scan` | Camera primer | 3k |
| `(tabs)/today` | Today | 2e, 4a, 4b, 4c–4e (check-in sheet) |
| `today/streaks` | Streaks | 4f, 4g, 4h |
| `(tabs)/plants` | My Plants | 4i, 4j |
| `plants/[id]` | Plant detail | 2d, 4k, 4l |
| `plants/setup` | Add plant setup | 4m, 4n |
| `plants/[id]/diagnosis` | Diagnosis | 4q, 4r, 4s |
| `l/[code]` | Label adoption (deep link target) | 4o, 4p |
| `(tabs)/scan` | Opens the camera; limit sheets | 4af, 4ag |
| `camera` | Camera, denied, gallery only | 2b, 4t, 4u |
| `scan/[id]` | Result | 2a, 2c, 4v, 4w, 4x, 4y, plus the log-a-find sheet 4z, 4aa |
| `scan/[id]/new-species` | New species | 4ab, 4ac, 4ad, 4ae |
| `(tabs)/collection` | Plantdex, Sets, Map, Badges (segmented) | 2f, 4ah, 4ak, 4am, 4an, 4ao, 4ap |
| `collection/species/[id]` | Species card | 4ai, 4aj |
| `collection/sets/[id]/complete` | Set completed | 4al |
| `(tabs)/leagues` | League and Friends (segmented) | 4aq, 4ar, 4as, 4at |
| `leagues/add-friends` | Add friends | 4au, 4av |
| `leagues/week-results` | Week results | 4aw, 4ax |
| `profile`, `profile/public` | Profile, your view and public view | 4ay, 4az |
| `settings`, `settings/household` | Settings, Household and pets | 4ba, 4bb, 4bc, 4bd |
| `settings/home-area`, `settings/notifications`, `settings/account` | Reuse the onboarding and settings components | — |
| `paywall` | Paywall | 2g, 4be, 4bf, 4bg |
| `pet-emergency` | Pet emergency | 4bh, 4bi |
| `settings/delete-account` | Delete account | 4bj, 4bk |
| `auth/callback` | Magic link landing (PKCE exchange) | — |
| `(dev)/catalog/[frame]` | Every frame on fixtures (dev builds only) | all |

- **Dark mode:** frames 6a–6g are 2a–2g in the dark theme, and the catalog renders both.
- **Precedence between design files:**
  - Where a 4-series frame and a hero or onboarding frame show the same screen, the hero frame sets the layout and the 4-series frame sets the state's content. For example, the paywall states use 2g's plan cards with 4be's preview note.
  - Where a 4-series frame uses a plain row list for something the component sheet defines (plant card, task row, league row, Plantdex tile, plan card), the component is used.

### 6.4 Services and permissions

- **Permissions** are asked in context, each after a primer with a "Not now" option:
  - camera at the first scan
  - location at the first logged find
  - notifications after the first plant is added
- **Camera:**
  - expo-camera with organ chips, a tray of 1 to 5 photos, the quota meter and the health toggle.
  - Photos are re-encoded with expo-image-manipulator to at most 2 MP JPEG, which drops EXIF.
  - Each photo is hashed with SHA-256 and uploaded to `plant-photos/{uid}/{obsId}/…` before the `identify` call.
  - Gallery picks are marked `capture_source: gallery`.
- **Location:** expo-location in the foreground only. The app sends accuracy and, on Android, the mocked flag.
- **Integrity:** an `IntegrityProvider` interface with two implementations:
  - Firebase App Check token, in dev and release builds.
  - None, in Expo Go and on web. The server then identifies but awards no points.
- **Notifications:**
  - The app schedules local care reminders from the server's task list after every sync, so they fire offline.
  - It registers an Expo push token for social events.
  - Notifications are no-ops on web.
- **Offline:**
  - A persisted queue (expo-sqlite key-value storage) holds check-ins (with a `clientId` for idempotency) and scans waiting for identification.
  - NetInfo drains the queue when the phone is back online, and a scan identified later sends a local notification.
- **Purchases:** a `PurchasesProvider` interface with two implementations:
  - RevenueCat in dev builds, with `logIn(supabaseUserId)`.
  - A fake for fixture mode and web.
  - The app reads entitlements only from our API.
- **Auth:** Sign in with Apple (iOS), Google, and an email magic link with PKCE (`tendril://auth/callback`). The session is stored with `expo-sqlite/localStorage`.

## 7. Backend: API

**Access rule:**
- Clients **read** their own and their household's rows through RLS, plus a few `rpc` functions for composite views.
- Every **write** that matters goes through an Edge Function running as the server.
- The only direct client write is uploading photos into the user's own Storage folder.

This keeps RLS mostly select-only and puts all business rules in tested function code.

**Function conventions:**
- One function per area, each with its own small router.
- JSON in and out.
- Errors look like `{error: {code, message, details?}}`, with these codes:
  - `invalid_input`
  - `unauthenticated`
  - `forbidden`
  - `not_found`
  - `quota_exceeded` (details: kind, limit, resets on, premium)
  - `provider_unavailable`
  - `conflict`
- User auth is checked with `@supabase/server` `withSupabase({auth:'user'})`.
- Service work goes through `ctx.supabaseAdmin` after explicit authorisation checks.

| Function | Routes |
| --- | --- |
| `me` | `POST /bootstrap` (age attestation 13+, timezone, country; creates profile, default household, streak rows; idempotent) · `PATCH /profile` · `PUT /pets` · `PUT /vet` · `PUT /home-area` and `DELETE /home-area` · `POST /push-token` · `POST /preview` · `POST /apple-credential` · `POST /report` · `DELETE /account` |
| `identify` | `POST /` (photo paths, organs, capture source, location, device time, health flag; header `X-Firebase-AppCheck`) · `POST /diagnose` (plant ID and photos; uses the diagnosis quota) |
| `observations` | `POST /:id/confirm` (species ID; action `add_plant` with the setup answers, or `log_find` with the place type) · `GET /:id/outcome` (points status, points, reasons, new to Plantdex, rarity, set progress, badges) · `POST /:id/discard` |
| `care` | `POST /plants` (from a scan, a label code or a species) · `PATCH /plants/:id` · `POST /plants/:id/status` · `POST /checkins` (idempotent on `clientId`) · `POST /tasks/:id/done` · `POST /diagnoses/:id/apply` |
| `social` | `GET /users?handle=` (exact match only) · `POST /friends` · `POST /friends/:id/accept` · `DELETE /friends/:id` · `POST /invites` · `POST /invites/:code/redeem` · `GET /profiles/:handle` (public view) |
| `labels` | `GET /:code` (public) · `POST /:code/events` (public; page view, app open, store click) |
| `billing-webhook` | RevenueCat events (static auth header plus HMAC, deduped on event ID, then reconciled through `GET /v1/subscribers`) |
| `worker` | Secret-key auth, triggered by pg_cron through pg_net: `/tick` (drain queues every 30 s), `/hourly` (streak evaluation for users whose local day just ended), `/weather` (every 6 h), `/nightly` (care recompute, premium freeze refill, purge old cron logs), `/weekly` (league close and week results, Monday 00:10 UTC), `/rarity` (GBIF refresh, weekly) |

**Read RPCs:**
- `today_summary()`
- `plantdex(filter)`
- `species_card(species_id)`
- `league_board()`
- `friends_board()`
- `public_label(code)`
- `public_species(slug)`

Each RPC is security invoker where RLS suffices. Where it must aggregate across users, it is security definer with explicit filters, returning only public fields.

**Pluggable outside services**, all behind interfaces in `supabase/functions/_shared/providers/` and selected by env var, each with a fake used in tests and local dev:

| Interface | Real implementation | Fake | Env var |
| --- | --- | --- | --- |
| `IdentificationProvider` | Plant.id v3 | Fixture scenarios (very likely, likely, not sure, not a plant, error) chosen by a debug marker, with peace lily 94% as the default | `IDENTIFY_PROVIDER` |
| `WeatherProvider` | WeatherKit | Fake | — |
| `AppCheckVerifier` | jose against the Firebase JWKS | Accepts the token `dev-ok` only when `APP_CHECK_MODE=dev` | `APP_CHECK_MODE` |
| `BillingReconciler` | RevenueCat REST | Fake | — |
| `AppleRevoker` | Apple token exchange and revoke | Fake | — |
| `PushSender` | Expo push API | Fake | — |
| GBIF | GBIF REST | Fake | — |

## 8. Backend: data, privacy and scoring

### 8.1 Schema

Conventions:
- UUID primary keys.
- Times are `timestamptz` in UTC, with the user's timezone kept on the profile.
- Every user foreign key is `references auth.users on delete cascade`.
- Every table in `public` has explicit grants (required from 30 Oct 2026) and RLS enabled.
- Server-only data lives in a `private` schema with no grants to `anon` or `authenticated`.
- Migrations are hand-written; `supabase:supabase-postgres-best-practices` is applied when writing them.

| Table (schema) | Purpose and key fields | Client read access |
| --- | --- | --- |
| `profiles` | handle (citext, unique), display name, timezone, country, age_confirmed_13_plus, preview_used_at, referral_code | Owner; handle and counts via the public profile RPC |
| `privacy_zones` | randomised centre (geography), radius | Owner |
| `households`, `household_members`, `household_pets`, `household_vets`, `household_handovers` | Shared homes, pets (cat, dog, other; optional name), vet, holiday hand-over (premium) | Household members |
| `species` | provider entity ID, GBIF ID, scientific and common name, family, slug, image and credit, watering min/max (1–3), light, base check interval, `sensitive`, rarity tier, houseplant flag | Everyone (sensitive species never expose locations, which live elsewhere anyway) |
| `species_toxicity` | species and animal (cat, dog); severity (unknown, none, mild, moderate, severe); summary, symptoms, source name and URL, review status, reviewer, review date | Everyone |
| `private.sensitive_taxa` | rank, taxon, reason, source | Server only |
| `observations` | user, server and device time, capture source, organs, status, intent, place type, species (confirmed), confidence, suggestions (JSON), image hash, health requested, integrity verdict (JSON), `public_cell_r5` (null when not allowed), points status (none, processing, awarded, held, no_points), linked plant | Owner |
| `observation_locations` | precise point (geography), accuracy, mocked flag, `cell_r7` | **Owner only** |
| `observation_photos` | storage path, organ, size, sha256 | Owner |
| `private.observation_provider` | provider access token and raw response | Server only |
| `plants` | household, species, nickname, room, indoor, pot size and material, drainage, light, status and cause, parent plant, source (scan, label QR, gift, manual), label code, photo, `care_state` (JSON engine state) | Household members |
| `care_tasks`, `care_events`, `diagnoses` | Tasks (check or water; due; status), events (check-in answers, leaf states, photo, `client_id` unique), diagnoses (condition, probability, effect, applied) | Household members |
| `plantdex_entries` | user, species, category (houseplant or wild), first observation, first found, finds count; derived and rebuildable | Owner; counts public |
| `sets`, `set_species`, `user_set_progress`, `badges`, `user_badges` | Collection definitions and progress | Definitions: everyone; progress: owner; earned badges: public |
| `score_events` | **Append-only ledger:** rule ID and version, points, reason, idempotency key (unique), held, revoked_at. No client writes; the service role can only set held and revoked_at | Owner |
| `streaks`, `streak_events` | Per user and kind (care_daily, discovery_weekly): current, longest, last period, freezes held, winter mode, last broken length; events (freeze used, broken, extended) | Owner |
| `leagues`, `league_memberships`, `leaderboard_entries`, `week_results` | Weekly leagues by H3 res-5 cell, derived boards, final results | League members (handle, rank and points only) |
| `friendships`, `invites` | Canonical pair with requester and status; referral codes and redemptions | Participants |
| `entitlements` | user, source (preview or store), active until, store, product, environment | Owner |
| `usage_counters` | user, kind (identification, diagnosis, scoring_scan), period key, used | Owner |
| `private.billing_events` | RevenueCat event ID (primary key), payload, processed at | Server only |
| `private.apple_credentials` | encrypted Apple refresh token | Server only |
| `partners`, `qr_codes`, `qr_scans` | Grower programme: codes (active or retired) map to a species and cultivar; scan, app open, store click and adoption events | Public label RPC; admin |
| `reports` | Moderation queue | Admin |
| `push_tokens` | Expo tokens | Owner |
| `private.weather_cache`, `private.regional_presence` | WeatherKit per res-7 cell; GBIF and Tendril counts per species per res-3 cell | Server only |

**Storage:** a private bucket `plant-photos` with own-folder RLS. JPEG only, up to 10 MB.

**Queues (pgmq):** `scoring`, `care_recompute`, `push`. The worker reads and deletes messages through service-role-only wrapper RPCs, and messages read 5 times go to a dead-letter queue.

### 8.2 Privacy rules (all enforced and tested)

- **Precise points** exist only in `observation_locations`. The owner can read them through RLS, and no RPC, view, export or push payload contains them. A pgTAP test checks every RPC's output columns.
- **Home zone:**
  - The server moves the chosen centre to a uniformly random point within half the radius, then stores the radius enlarged by half, so the home is still covered.
  - The original point is never stored.
  - Finds inside the zone get `public_cell_r5 = null`.
- **Sensitive taxa:**
  - When a species is inserted or updated, a match against `private.sensitive_taxa` (species, genus, or the family Orchidaceae) sets `species.sensitive`.
  - Sensitive finds never get a public cell and stay off any public rarity listing.
  - The species card shows the privacy note.
- **Public cells:** `public_cell_r5` is computed but unused in v1, because find sharing has no UI yet. Leagues use the user's cell for grouping and show only handles and points.
- **Photos:**
  - EXIF is stripped on the client by re-encoding.
  - The server strips it again (piexifjs) and asserts no GPS remains (exifr).

### 8.3 Scoring and anti-cheat

Every confirmed observation enqueues a `scoring` job. The worker runs it at once, and `GET /outcome` returns `processing` until it finishes.

**Integrity checks** run in this order; the first match sets the outcome:

| Check | Signal | Outcome |
| --- | --- | --- |
| App integrity | App Check token missing or invalid | no_points |
| Capture source | gallery | no_points |
| Time | device time differs from server time by more than 10 minutes | no_points |
| Location missing | location off | Plantdex entry, no points |
| Location quality | mocked, accuracy worse than 100 m, or implied speed from the previous scan above 300 km/h | held |
| Duplicate | image hash seen before for this user, or same species within 30 m | counts once: no points |
| Volume | more than 20 scoring scans today (user's timezone) | no_points |
| Plausibility | species has no GBIF or Tendril presence in the res-3 cell or its neighbours | held, released automatically by a second independent find |

**Rules v1.** Point values are placeholders; every ledger row stores the rule ID and version.

| Rule | Points |
| --- | --- |
| `new_species` (first confirmed find of the species for this user) | Wild, garden or park finds score by rarity: common 10, uncommon 40, rare 80, legendary 150. Shop or home finds score a flat 10 |
| `repeat_find` (same species, at least 1 km and 7 days from that user's earlier finds) | 2 |
| `set_complete` | 50 |

**Anti-cheat behaviour:**
- Nothing scores for watering, check-ins, picking or foraging.
- Held points are ledger rows with `held = true`. They don't count on boards, and the app shows them as "Points pending review".
- In the admin queue, release clears `held` and revoke sets `revoked_at`.
- Boards are always rebuilt from the ledger.

**Rarity tier:** a species' tier comes from its GBIF occurrence count (CC0 and CC BY records only) in its region, with thresholds in `rarity.ts`. The tiers are refreshed weekly by `/rarity`.

### 8.4 Quotas and entitlements

- **Limits:**
  - Free: 10 identifications and 1 diagnosis per calendar month in the user's timezone.
  - Premium: 60 and 10.
  - Scoring scans: 20 a day for everyone.
- **Quota reservation:** `private.reserve_usage(uid, kind, period, limit)` atomically increments only when `used < limit`, in the same statement that authorises the call. If the provider fails or finds no plant, `private.release_usage` gives the credit back, matching the copy "This didn't use an identification".
- **Premium check:** `private.is_premium(uid)` is true when an entitlement is active (`active_until > now()`).
- **Preview:**
  - `POST /me/preview` creates a 7-day `preview` entitlement, once per user.
  - No store subscription starts.
  - The app schedules a local reminder the day before it ends.
- **Subscriptions:**
  - The app buys through RevenueCat with `app_user_id` set to the Supabase user ID.
  - The webhook reconciles from RevenueCat's subscriber API and upserts the `store` entitlement.
- **Limit screens:**
  - At the cap, `identify` returns `quota_exceeded`, makes no paid call, and the app shows Limit reached (4af).
  - Premium users at their cap see only the reset date (4ag).

## 9. Care engine v1

The engine is pure functions in core. The server runs it after every care event and every night, and stores the result in `plants.care_state` and `care_tasks`. Every number below is a starting value to tune.

- **Base interval** comes from the species' Plant.id watering range, averaging min and max:
  - average ≤ 1.3: 10 days
  - ≤ 2.3: 7 days
  - otherwise: 4 days
  - Curated species can override this.
- **Free plan:**
  - Next check = last check + base interval.
  - Answer "No" (still damp): the next check is in 2 days, and the sheet says which day.
  - Answer "Yes" (dry): a watering task appears for today, and the next check is one base interval after watering.
- **Premium plan:** the base interval is multiplied by these factors, then clamped to 2–21 days:

| Factor | Values |
| --- | --- |
| Pot material | terracotta 0.85, plastic 1.0, ceramic 1.05, not sure 1.0 |
| Pot size | ≤ 12 cm 0.8, 13–20 cm 1.0, > 20 cm 1.2 |
| Light | bright 0.85, medium 1.0, low 1.25 |
| No drainage | 1.2 |
| Season, by hemisphere and month | summer 0.85, spring and autumn 1.0, winter 1.35 |
| Learned multiplier | each "No" × 1.1, each on-time "Yes" × 0.95, clamped to 0.6–1.8 |
| Outdoor weather (WeatherKit, cached per res-7 cell) | ≥ 5 mm of rain in the next 48 h: +2 days; maximum ≥ 28 °C in the next 48 h: −1 day |

- **Diagnoses:**
  - **Overwatering** pauses watering tasks until two dry checks in a row. Check-ins continue, and the plant card shows "Paused by a diagnosis".
  - **Underwatering** applies a 0.8 factor for two cycles.
  - **Anything else** shows the advice and leaves the schedule alone.
- **Plant status:** marking a plant dead (with a cause) or given away closes its tasks and keeps its history. These outcomes are the labelled data for a future care model.

## 10. Streaks, leagues and social

- **Daily care streak:**
  - A local day counts if it has at least one check-in.
  - At the end of a local day with no check-in, the worker spends a held freeze ("A freeze kept your 12-day streak going"). If there isn't one, the streak breaks: the count turns grey and the streak screen offers to start again, without blame.
  - "Last day" state: there's a streak but no check-in yet today.
- **Weekly discovery streak:**
  - An ISO week in the user's timezone counts if it has a species new to their Plantdex.
  - A missed week breaks the streak unless winter mode is on.
- **Freezes:** Premium holds 2 at all times (refilled nightly). Free users earn 1 per redeemed invite, up to 2 held.
- **Leagues:**
  - The user joins on their first awarded points of the week.
  - The league cell is the res-5 cell of the home zone, or of that first scoring find if there's no zone.
  - Assignment fills the nearest league with room (at most 30) within H3 rings k = 0–3, and otherwise opens a new league.
  - Boards sum the week's unheld, unrevoked ledger points.
  - Monday's job writes week results and pushes them.
- **Friends:**
  - Search by exact handle only, so handles can't be enumerated.
  - Requests and acceptance.
  - The friends board is computed when it's read.
  - The public profile shows the handle, Plantdex count and badges, never locations, pets or plants.
- **Push:** sent through the `push` queue in batches of up to 100. Tokens are dropped on `DeviceNotRegistered`.

## 11. Web: Next.js 16

| Route | What it does |
| --- | --- |
| `/l/[code]` | Label QR page: plant, grower, care basics and pet toxicity, with "Open in Tendril" (`tendril://` scheme) and the store links (Android intent URL carrying the `referrer=label=<code>` fallback). ISR, using a cookie-less Supabase client and the `public_label` RPC. `notFound()` for unknown or retired codes, with a friendly page |
| `/s/[slug]` | Species page: care basics and toxicity per animal with sources. ISR |
| `/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json` | Route handlers returning JSON |
| `/admin` | Behind `proxy.ts` and checked again in the layout and every Server Action (`app_metadata.role = 'admin'`); RLS `private.is_admin()` underneath. Pages: species and toxicity curation (calls `revalidatePath` on save), sensitive taxa, partners and label codes (create, retire, aggregate scans), reports, held points (release or revoke), support lookup (entitlements and usage, read-only) |

The app side:
- Universal Links and App Links for `/l/*` and `/s/*`.
- On Android, `getInstallReferrerAsync()` on first run pre-fills the label code.
- On iOS, first run offers "Scan your plant label".

## 12. Error handling

- **Every error state the design shows is real and reachable:**
  - not a plant
  - offline
  - provider error (quota released)
  - limit reached
  - camera denied
  - location off
  - link expired
  - handle not found
  - unknown label code
  - purchase pending or failed
  - no vet saved
  - a country with no poison line
- **Every outcome is idempotent:**
  - Check-ins use a client UUID.
  - Webhooks use the RevenueCat event ID.
  - Ledger rows use an idempotency key per rule, observation and version.
  - Quota reservation is a single atomic statement.
- **Retries and failures:**
  - Provider calls time out at 25 s.
  - Worker jobs retry through pgmq visibility timeouts, and dead-letter after 5 tries.
  - The app shows one plain sentence, never a stack trace.
- **Logging and monitoring:**
  - Function logs are structured JSON with a request ID.
  - Sentry (app) and PostHog (funnels) are wired in phase 8, behind env vars.

## 13. Testing and verification

| Layer | Tool | What's covered |
| --- | --- | --- |
| Core rules | vitest, test first | Confidence bands, toxicity labels, quotas and reset dates, care engine, every scoring rule and integrity check, streak edge cases (timezones, DST, freezes, winter mode), league assignment, privacy maths, rarity |
| Database | pgTAP (`supabase test db`) | RLS for every table as owner, household member, another user and anon; grants (no client write on the ledger, entitlements or counters); quota atomicity; `on delete cascade` coverage; no RPC returns precise coordinates |
| Edge Functions | `deno test` with fake providers, plus integration tests against the local stack | Every route's success and error codes; webhook signature and dedupe; App Check verification; the cheating suite |
| Mobile | jest-expo and RNTL | Every component's states and accessible labels; containers in fixture mode; the offline queue |
| Visual | `tools/visual` (Playwright on the web export) | Each catalog frame at 393×852 is paired with its design render as a side-by-side image, with a pixel-difference score as a regression guard. I review every pair. Differences are expected only where the design shows placeholder image slots or device chrome |
| Web | vitest and Playwright | Well-known files (status, JSON, no redirect); label page states; admin guard |

Each phase ends with `superpowers:verification-before-completion` (commands run, output read), a code-review agent pass, and a commit on `feat/tendril-v1`.

## 14. Outside v1, and what you'll need to provide

**Not in v1:**
- on-device identification
- care model v2
- public find sharing
- IUCN data (needs a commercial licence)
- additional languages

**Needed from you before launch; the runbook lists where each goes:**
- **Developer accounts:** Apple Developer (team ID, Sign in with Apple, WeatherKit key, App Attest), Google Play and Google Cloud (OAuth clients, Play Integrity), Firebase project, Expo/EAS account.
- **Service accounts and keys:** Plant.id key and credits, RevenueCat project and products, hosted Supabase project, Vercel Pro and the domain, Sentry, PostHog.
- **Content and policy:**
  - a vet review of the toxicity table
  - poison lines for Ireland and the EU
  - Terms of Use and Privacy Policy text
  - a real photo for the Welcome screen
  - App Review's view on the server-granted preview
  - the Play closed test with 12 or more testers
