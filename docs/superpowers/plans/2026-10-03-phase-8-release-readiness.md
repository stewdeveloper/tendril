# Phase 8: Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tendril is ready for the developer to connect real accounts and ship:
- real app icon and splash screen
- EAS build profiles
- crash reporting and privacy-safe analytics that switch on by environment variable
- draft Terms and Privacy pages, clearly marked for legal review
- full CI coverage
- a `RUNBOOK.md` that takes someone from an empty set of accounts to a store submission
- a final whole-branch review with every check green

**Architecture:**
- Icons are rendered from the chosen concept's SVG (7a, "Spiral") by a Playwright script, so they can be regenerated.
- Sentry and PostHog each sit behind a thin wrapper that does nothing when its key is missing, and analytics events are typed and allow-listed, so no location or free text can leak.
- The web app serves the draft legal pages.

**Tech Stack:** EAS CLI (config only; builds need the developer's Expo account), `@sentry/react-native` (SDK 57 pin), `posthog-react-native`, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-03-tendril-v1-design.md` (§3 phase 8, §12 logging, §14 what you'll need to provide). Architecture doc "Build plan", "Risks". UX brief "App icon" (concept 7a chosen in spec §2).

## Global Constraints

- **Icon:** concept 7a "Spiral" from `design/claude-design/Tendril 7 App Icons.dc.html`:
  - path `M30 84 C30 56 44 38 62 38 C76 38 82 50 79 59 C76 68 65 70 60 64 C56 59 59 52 66 53`
  - leaf `M30 84 C22 74 23 63 33 57 C38 66 37 77 30 84Z`
  - stroke `#2E6B4E` on `#FBFAF6`, viewBox 0 0 100 100
  - stroke widths: 7 at large sizes, 8.5 at 40 pt, 10 at 29 pt
  - tinted variant: `#FBFAF6` on `#2E6B4E`
- **Analytics:**
  - These events only:
    - `scan_started`, `identify_result` (`band`, `state`), `plant_added` (`source`), `find_logged` (`place_type`)
    - `checkin` (`soil_dry`), `diagnosis_result` (`state`)
    - `paywall_viewed` (`trigger`), `purchase_result` (`result`), `preview_started`
    - `invite_sent`, `league_viewed`
  - No location, handle, email, plant nickname, pet name or free text, ever.
  - Screen tracking uses route templates (`/plants/[id]`), never concrete IDs.
- **Sentry:** `sendDefaultPii: false`; breadcrumbs scrubbed of URLs with query strings; on only when `EXPO_PUBLIC_SENTRY_DSN` is set.
- **Legal pages:** every draft page carries a banner reading "Draft for legal review. Not yet in force." The app's Terms and Privacy links point to `<TENDRIL_WEB_ORIGIN>/terms` and `/privacy`.
- **No real secrets anywhere in the repo.** Every key is an environment variable documented in `RUNBOOK.md` and listed in the matching `*.env.example`.

## Review Focus

1. **An analytics call with an unexpected property**, such as `lat` or `nickname`, added by a future developer. The wrapper drops anything not on the allowlist, at compile time (types) and at run time (it strips unknown keys). Tested in Task 3.
2. **The app built with no optional keys** (no Sentry, PostHog, RevenueCat, Firebase or Google sign-in). It runs, and every feature that needs a key degrades gracefully. Tested in Task 3 and Task 6.
3. **The icon at 29 pt.** The curl must still read, so stroke widths scale up at small sizes. Checked visually in Task 1 against the design's size strip.
4. **The CI database job running on a clean runner.** `pnpm db:start`, `db:cron`, `db:test`, `e2e:functions` and the web e2e all pass in sequence, without depending on anything local. Covered in Task 5.
5. **A runbook step that no longer matches the code**, such as a renamed environment variable. The `scripts/check-env-docs.ts` checker cross-references every `env(` read and `process.env.` usage against `RUNBOOK.md`. Tested in Task 5.

---

### Task 1: App icon, adaptive icon, splash and favicon

**Files:**
- Create:
  - `tools/visual/src/render-icons.ts`
  - `apps/mobile/assets/icon/icon.svg` and `apps/mobile/assets/icon/icon-tinted.svg`
  - generated PNGs: `apps/mobile/assets/icon/icon-1024.png`, `adaptive-foreground.png` (1024, mark inside the 66% safe zone), `adaptive-monochrome.png`, `splash-icon.png` (512), `favicon.png` (48); `apps/web/src/app/icon.png` and `apps/web/src/app/apple-icon.png`
- Modify:
  - `apps/mobile/app.config.ts`:
    - `icon`
    - `android.adaptiveIcon: { foregroundImage, monochromeImage, backgroundColor: '#FBFAF6' }`
    - splash plugin: `backgroundColor '#FBFAF6'`, `dark.backgroundColor '#121714'`
  - root `package.json`: add `"icons": "tsx tools/visual/src/render-icons.ts"`

**Interfaces:**
- Produces: `pnpm icons`, which regenerates every icon asset from the SVGs.

- [ ] **Step 1: Write the SVGs** from the Global Constraints, then the script. It renders each SVG at each size with Playwright (`page.setContent(svg)` plus a screenshot with `omitBackground: false`), switching to the thicker stroke width for 40 pt and 29 pt previews.
- [ ] **Step 2: Run `pnpm icons`.** Read the 1024 icon and a 29 pt preview with the Read tool, and compare them with `design/claude-design/Tendril 7 App Icons.dc.html` concept 7a (render it with `pnpm visual:design`'s server if needed).
- [ ] **Step 3: Delete** the leftover Expo default `assets/images/icon.png` and `splash-icon.png`, now replaced. Run `npx expo-doctor` and `pnpm --filter @tendril/mobile export:web`; both must pass.
- [ ] **Step 4: Commit**

```bash
git add tools/visual apps/mobile/assets apps/mobile/app.config.ts apps/web/src/app package.json
git commit -m "feat: Tendril spiral app icon, adaptive icon, splash and favicons"
```

---

### Task 2: EAS build profiles

**Files:**
- Create: `apps/mobile/eas.json`
- Modify: `apps/mobile/app.config.ts`:
  - `extra.eas.projectId` from `EAS_PROJECT_ID`
  - `runtimeVersion: { policy: 'appVersion' }`
  - `updates.url` only when `EAS_PROJECT_ID` is set
  - `ios.buildNumber` and `android.versionCode` from env, defaulting to 1

`apps/mobile/eas.json`:
```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal", "env": { "EXPO_PUBLIC_API_MODE": "supabase", "EXPO_PUBLIC_APP_CHECK_DEV": "1" } },
    "preview": { "distribution": "internal", "env": { "EXPO_PUBLIC_API_MODE": "supabase" } },
    "production": { "autoIncrement": true, "env": { "EXPO_PUBLIC_API_MODE": "supabase" } }
  },
  "submit": { "production": {} }
}
```

- [ ] **Step 1: Write the file and the config changes.** `expo-dev-client` is needed for `development`: run `npx expo install expo-dev-client`.
- [ ] **Step 2: Verify:** `npx expo config --type public` prints the resolved config without errors, both with and without `EAS_PROJECT_ID` set. `npx expo-doctor` passes.
- [ ] **Step 3: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "chore(mobile): EAS development, preview and production build profiles"
```

---

### Task 3: Privacy-safe analytics and crash reporting

**Files:**
- Create:
  - `apps/mobile/src/services/analytics.ts`
  - `apps/mobile/src/services/crash.ts`
- Modify: `apps/mobile/src/app/_layout.tsx` (init both, plus screen tracking with route templates); the containers that emit the listed events
- Test: `apps/mobile/src/services/analytics.test.ts`

**Interfaces:**
- Produces:
```ts
export type AnalyticsEvent =
  | { name: 'scan_started' }
  | { name: 'identify_result'; band: ConfidenceBand | 'none'; state: ResultState }
  | { name: 'plant_added'; source: PlantSource }
  | { name: 'find_logged'; place_type: PlaceType }
  | { name: 'checkin'; soil_dry: boolean }
  | { name: 'diagnosis_result'; state: 'result' | 'not_sure' | 'used_up' }
  | { name: 'paywall_viewed'; trigger: 'limit' | 'diagnosis' | 'feature' | 'settings' }
  | { name: 'purchase_result'; result: 'purchased' | 'pending' | 'cancelled' | 'failed' }
  | { name: 'preview_started' } | { name: 'invite_sent' } | { name: 'league_viewed' };
export function track(e: AnalyticsEvent): void;      // no-op without EXPO_PUBLIC_POSTHOG_KEY; strips non-allowlisted keys
export function screen(routeTemplate: string): void; // e.g. '/plants/[id]'
export function initCrash(): void;                    // Sentry.init only with EXPO_PUBLIC_SENTRY_DSN; sendDefaultPii false; beforeBreadcrumb strips query strings
```

- [ ] **Step 1: Install the dependencies:** `npx expo install @sentry/react-native posthog-react-native expo-file-system expo-application expo-device expo-localization`. Add the Sentry Expo plugin only when `SENTRY_ORG` and `SENTRY_PROJECT` are set.
- [ ] **Step 2: Write the failing tests:**
  - with no key, `track` is a no-op and doesn't throw
  - with a mocked client, `track({ name: 'checkin', soil_dry: true, lat: 53 } as any)` sends `{ soil_dry: true }` only
  - `screen('/plants/abc-123')` is rejected in dev with an assertion: templates only
  - `initCrash` doesn't call `Sentry.init` without a DSN
- [ ] **Step 3: Run them to verify they fail**, then implement, wire the events into the containers, and run them to verify they pass

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck`
Expected: the tests fail before implementation and pass after.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): allow-listed analytics and opt-in crash reporting with no personal data"
```

---

### Task 4: Draft Terms and Privacy pages

**Files:**
- Create:
  - `apps/web/content/terms.md`, `apps/web/content/privacy.md`
  - `apps/web/src/app/terms/page.tsx`, `apps/web/src/app/privacy/page.tsx`
  - `apps/web/src/components/DraftBanner.tsx`
- Modify: the mobile paywall, sign-in and settings links, which open `<TENDRIL_WEB_ORIGIN>/terms` and `/privacy` with `expo-web-browser`
- Test: `apps/web/e2e/legal.spec.ts`

**Interfaces:**
- Produces: two static pages. `privacy.md` is drafted from the architecture doc and states:
  - what's collected: account, photos, observations, precise location (owner-only), pets, household
  - why
  - that public views show an area at most
  - that home-zone finds are never public and sensitive species never get a location
  - that the service is for 13 and over
  - in-app deletion and what it removes
  - the processors: Supabase, Plant.id/Kindwise, RevenueCat, Apple, Google, Firebase, Sentry, PostHog and Vercel, each with its purpose
  - EU/Ireland data rights, with contact placeholders marked `[TO CONFIRM]`

  `terms.md` covers:
  - the honest preview (no store subscription, ends on its own)
  - subscription terms through the stores
  - acceptable use: no trespassing, no picking for points
  - that pet safety information is no substitute for a vet

  Both carry the draft banner.

- [ ] **Step 1: Write the Playwright test:** both pages return 200, show the banner, and contain no "lorem" text. The privacy page mentions "13", "delete" and "area".
- [ ] **Step 2: Implement**, then run `pnpm --filter @tendril/web e2e`. Expected: it passes.
- [ ] **Step 3: Commit**

```bash
git add apps/web apps/mobile
git commit -m "docs(web): draft Terms and Privacy pages marked for legal review"
```

---

### Task 5: Full CI and the env-docs checker

**Files:**
- Create: `scripts/check-env-docs.ts`
- Modify: `.github/workflows/ci.yml`:
  - the `database` job runs `pnpm db:start && pnpm db:cron && pnpm db:test && pnpm e2e:functions`
  - a new `web-e2e` job runs after `database`, against its own `db:start`, then `pnpm --filter @tendril/web e2e` with `npx playwright install --with-deps chromium`
  - the `checks` job adds `pnpm env:check`
- Modify: root `package.json`: add `"env:check": "deno run --allow-read scripts/check-env-docs.ts"`

**Interfaces:**
- Produces: `pnpm env:check`. It collects every variable name read by:
  - `Deno.env.get('X')` and `env('X')` in `supabase/functions`
  - `process.env.X` in `apps/web` and `apps/mobile` (including `EXPO_PUBLIC_*`)

  It then fails with the list of names that are missing from `RUNBOOK.md`'s environment tables, ignoring Supabase-injected names (`SUPABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_SECRET_KEYS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_JWKS`) and `NODE_ENV`.

- [ ] **Step 1: Write the checker and a fixture test** (`scripts/check-env-docs.test.ts`): a temp tree with one documented and one undocumented variable gives exactly one failure.
- [ ] **Step 2: Run** `pnpm env:check`. It fails until Task 6 writes the runbook, which is expected. Commit the checker and CI now.
- [ ] **Step 3: Validate the workflow YAML:** `pnpm dlx js-yaml .github/workflows/ci.yml > /dev/null`
- [ ] **Step 4: Commit**

```bash
git add scripts .github package.json
git commit -m "ci: database, functions e2e and web e2e jobs; env documentation checker"
```

---

### Task 6: RUNBOOK.md

**Files:**
- Create: `RUNBOOK.md`
- Modify: `README.md` (link to the runbook)

**Interfaces:**
- Produces: `RUNBOOK.md`, with these sections:
  1. **Local development:** Docker, `db:start`, `db:cron`, the seed, `functions serve`, the mobile env file, fixture versus supabase mode, Mailpit, the visual tool.
  2. **Environment variables:** one table per runtime (mobile, Edge Functions, web), with name, purpose, example and where it's set. Every variable `pnpm env:check` finds.
  3. **Hosted Supabase:**
     - create the Pro project and link it
     - `supabase db push`
     - `supabase functions deploy` for each function
     - `supabase secrets set …`
     - Vault secrets for cron: `project_url` and `worker_key`
     - auth providers: Apple, Google, and email with custom SMTP; redirect URLs; OTP expiry 900
     - storage bucket check
     - turn on the spend cap
  4. **Plant.id:** buy small credit packs (purchases of 30,000 or more expire in 3 months), set `PLANT_ID_API_KEY` and `IDENTIFY_PROVIDER=plantid`, and track usage percentiles.
  5. **RevenueCat:**
     - products: $24.99 a year and $4.99 a month, with no weekly plan
     - entitlement `premium`, offering `default` with `annual` and `monthly` packages
     - webhook URL `/functions/v1/billing-webhook`, with the authorization header and HMAC secret
     - REST secret key
     - SDK keys per platform
  6. **Apple:**
     - bundle ID and team ID
     - Sign in with Apple, plus the key for token revocation
     - WeatherKit key and service ID
     - App Attest capability
     - Associated Domains
     - Small Business Program
     - App Store Connect privacy labels: the data types collected and whether each is linked to the user
     - age rating 13+
     - review notes explaining the server-granted preview (guideline 3.1.1), with the fallback plan of a store introductory offer
  7. **Google:**
     - OAuth clients (web, iOS, Android)
     - Play Console: Data safety form, closed test with at least 12 testers for 14 days, opened by 1 February 2027
     - app signing SHA-256 for `assetlinks.json`
     - account deletion URL
  8. **Firebase App Check:** project, Play Integrity and App Attest providers, config files, `FIREBASE_PROJECT_NUMBER`, `FIREBASE_APP_IDS`, `APP_CHECK_MODE=firebase`.
  9. **Expo/EAS:** project ID, credentials, push notification credentials, build commands, submission.
  10. **Vercel:** Pro plan, project root `apps/web`, Node 24, environment variables, domain with no apex redirect on `/.well-known`, `curl -I` checks.
  11. **Sentry and PostHog:** DSN, keys, privacy settings.
  12. **Before launch** (owner: you):
      - vet review of every `seed_pending_vet` verdict (admin page)
      - poison lines for Ireland and the EU
      - legal review of the Terms and Privacy pages
      - a real Welcome photo
      - App Review's view of the preview
      - Play closed test
  13. **Operations:** the cron jobs and what they do, queue dead-letter checks, the held-points review cadence, credit usage monitoring.
  14. **Deferred items:** the remaining parked or deferred findings from every phase's ledger, each with its owner and why it's safe to defer.

- [ ] **Step 1: Write `RUNBOOK.md`** from the spec, the research doc, the env-example files and the phase ledgers (collect `Ruling:` and `minor (deferred)` lines from `.superpowers/sdd/*/progress.md`).
- [ ] **Step 2: Run** `pnpm env:check`. Expected: it passes. Fix the runbook, not the checker, until it does.
- [ ] **Step 3: Commit**

```bash
git add RUNBOOK.md README.md
git commit -m "docs: runbook from empty accounts to store submission"
```

---

### Task 7: Final verification

**Files:** none new. This task runs every check and records the result.

- [ ] **Step 1: Run everything from a clean state**

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm db:reset && pnpm db:cron && pnpm db:test
pnpm e2e:functions
pnpm --filter @tendril/web build && pnpm --filter @tendril/web e2e
pnpm visual:app && pnpm visual:compare
pnpm env:check
```

Expected: everything passes. The visual sweep's table in `docs/design-notes/visual-sweep.md` is regenerated, with no frame regressed against Phase 1B's verdicts.

- [ ] **Step 2: Record the results** in `docs/design-notes/release-check.md`: each command, its pass or fail result, and the date.
- [ ] **Step 3: Commit**

```bash
git add docs/design-notes
git commit -m "docs: release verification record"
```
