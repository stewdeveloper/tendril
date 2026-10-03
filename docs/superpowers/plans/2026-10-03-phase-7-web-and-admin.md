# Phase 7: Web, Admin and Deep Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Load `supabase:supabase` before writing Supabase SSR code.

**Goal:**
- **Label QR page:** a fast, install-free page per grower code showing care basics and pet toxicity, linking into the app or the store.
- **Public species pages.**
- **Invite pages.**
- **Link verification files:** Universal Links and App Links.
- **Admin site:** species and toxicity curation, sensitive taxa, partners and codes, moderation, held-points review and support lookup.
- **App side:** handles these links, scans label QR codes in-app, and reads the Android install referrer.

**Architecture:**
- **Web app:** `apps/web` is Next.js 16 (App Router, Turbopack, CSS Modules using `@tendril/core` tokens, no Tailwind).
- **Public pages:** ISR pages read through a **cookie-less** supabase-js client with the publishable key and the public RPCs, so they stay static on the CDN.
- **Admin:**
  - Sits behind `proxy.ts` (matcher `/admin/:path*`) and `@supabase/ssr` with `getClaims()`.
  - `requireAdmin()` runs in the admin layout and in **every** Server Action.
  - Writes use a server-only service-role client after `requireAdmin()`.
- **App:**
  - `ios.associatedDomains` and `android.intentFilters` cover `/l/*`, `/s/*`, `/i/*` and `/h/*`.
  - expo-camera barcode scanning powers "Scan your plant label".
  - `expo-application` provides `getInstallReferrerAsync()` on Android first launch.

**Tech Stack:** Next.js 16.3.x, React 19.2+, `@supabase/supabase-js`, `@supabase/ssr` 0.12.x, vitest 5, Playwright 1.63; Expo `expo-camera` (barcodes) and `expo-application`.

**Spec:** `docs/superpowers/specs/2026-10-03-tendril-v1-design.md` (§11 web, §8.1 partners and codes, `reports`). Research: the "Web: Next.js 16" section of `docs/research/2026-10-03-stack-research.md`. Architecture doc "Label QR to adoption".

## Global Constraints

- **Toolchain:** Node 24 on Vercel (`"engines": { "node": ">=22.13" }` locally). The package is `@tendril/web`. Pin `next@16.3.x`.
- **Environment variables:**
  - public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_STORE_ID`, `NEXT_PUBLIC_PLAY_PACKAGE` (default `app.tendril`)
  - server only: `SUPABASE_SECRET_KEY`, `APPLE_TEAM_ID`, `TENDRIL_APP_ID`, `ANDROID_CERT_SHA256` (comma-separated)
  - **Never** prefix the secret with `NEXT_PUBLIC_`.
- **Public pages:**
  - `revalidate = 3600` for labels and `86400` for species
  - `generateStaticParams` returns `[]`
  - `notFound()` for unknown codes, which renders a friendly page with "We don't know this label. The code may be retired." and links to the app
- **Pet toxicity on the web:**
  - verdict chips use the same words, icons and colours as the app (`verdictChipLabel` from core)
  - every verdict has its plain line (`petCheckLine`, with `petName: null`) and source link
  - unknown reads "Not reviewed yet…"
  - every page carries "If your pet ate this, call your vet. In the US, ASPCA Animal Poison Control: (888) 426-4435."
- **Link files:**
  - `apple-app-site-association` uses `applinks.details[0].appIDs = ["<TEAM>.<APP_ID>"]` with `components` for `/l/*`, `/s/*`, `/i/*` and `/h/*`.
  - `assetlinks.json` uses `delegate_permission/common.handle_all_urls` with every SHA-256 in `ANDROID_CERT_SHA256`.
  - Both are served by route handlers as `application/json` with no redirect.
- **"Open in Tendril" links:**
  - iOS: `tendril://l/<code>`, because a same-domain universal link wouldn't fire.
  - Android: `intent://<host>/l/<code>#Intent;scheme=https;package=<pkg>;S.browser_fallback_url=<encoded Play URL with referrer=label%3D<code>>;end`
  - The page also has the Smart App Banner meta (`itunes: { appId, appArgument }`).
- **Admin:**
  - Only users with `app_metadata.role === 'admin'` may use it.
  - Every Server Action starts with `await requireAdmin()` and uses `adminDb()` (service role, server only).
  - Saving a species or its toxicity calls `revalidatePath('/s/<slug>')` and revalidates every `/l/<code>` page for that species.
  - Marking a verdict reviewed sets `review_status = 'reviewed'`, `reviewed_by` to the admin's email and `reviewed_at = now()`.
  - Admins can never see precise locations. Held-points review shows species, capture source, integrity verdict, `public_cell_r5` or the res-7 cell, and timestamps, but never a point.

## Review Focus

1. **A non-admin signed-in user calling an admin Server Action directly**, bypassing the UI and the proxy. `requireAdmin()` inside the action rejects it, and nothing is written. Tested in Task 4.
2. **A label code in a different case or with stray whitespace in the URL** (`/l/pl-0001 `). It resolves to the same label, because `public_label` upper-cases and trims. Tested in Task 2.
3. **Link files behind a redirect or with the wrong content type.** Tests assert a 200 with no redirect and `content-type: application/json`. Tested in Task 3.
4. **An admin marking "No known toxicity" without a source URL.** The form blocks it (the database check also does), with "Add the source page before saving No known toxicity." Tested in Task 4.
5. **A QR code that isn't a Tendril label** (any other URL or text) scanned in the app. The app shows "That's not a Tendril label. Try the plant itself." and keeps scanning, without opening the URL. Tested in Task 6.

---

### Task 1: Next.js app scaffold with core tokens

**Files:**
- Create:
  - `apps/web/` via `create-next-app`, then trimmed
  - `apps/web/src/lib/tokens.css.ts`: CSS variables generated from core tokens, light and dark
  - `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`
  - `apps/web/src/components/VerdictChip.tsx`, `apps/web/src/components/PetToxicity.tsx`, `apps/web/src/components/StoreButtons.tsx`
  - `apps/web/vitest.config.mts`
- Test: `apps/web/src/components/PetToxicity.test.tsx`

**Interfaces:**
- Produces:
  - `@tendril/web` with scripts `dev`, `build`, `start`, `test` (vitest), `typecheck`, `lint` and `e2e` (Playwright)
  - `<VerdictChip animal severity />`, which reads "Cats: Moderate"
  - `<PetToxicity toxicity={ToxicityEntry[]} />`, with one row per animal (cat and dog) and Unknown when a row is missing
  - `<StoreButtons code? />`
  - fonts: Fraunces and Inter through `next/font/google` (weights 400, 500, 600, plus the Inter italic)

- [ ] **Step 1: Scaffold**

```bash
pnpm dlx create-next-app@latest apps/web --ts --app --src-dir --eslint --no-tailwind --turbopack --import-alias "@/*" --use-pnpm --skip-install
```

If a flag isn't accepted, answer the interactive prompts to match these choices. Then:
1. Set `"name": "@tendril/web"` and add `"@tendril/core": "workspace:*"`.
2. Add `transpilePackages: ['@tendril/core']` to `next.config.ts`. Add `"allowImportingTsExtensions": true` to `apps/web/tsconfig.json`, because core uses `.ts` import suffixes (TS5097 otherwise, as in mobile).
3. Delete the starter content.
4. Install vitest: `pnpm --filter @tendril/web add -D vitest@^5 @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`.

- [ ] **Step 2: Write the failing test** (`PetToxicity.test.tsx`):
  - Peace lily shows "Cats: Moderate" and the line ending "Source: ASPCA."
  - A missing dog row shows "Dogs: Unknown" with "Not reviewed yet. Keep it away from your dog until we know more."
  - "safe" never appears anywhere in the output.

- [ ] **Step 3: Run it to verify it fails**, then implement, then run it to verify it passes

Run: `pnpm --filter @tendril/web test && pnpm --filter @tendril/web typecheck && pnpm --filter @tendril/web build`
Expected: the test passes and the build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): Next.js 16 app with core tokens and pet toxicity components"
```

---

### Task 2: Label, species and invite pages

**Files:**
- Create:
  - `supabase/migrations/<ts>_public_species.sql`: `public.public_species(p_slug text) returns jsonb`, granted to anon and authenticated, returning species and toxicity with no location data. Add a pgTAP test, and confirm the coordinate-leak guard still passes.
  - `apps/web/src/lib/publicDb.ts`: a cookie-less client
  - `apps/web/src/app/l/[code]/page.tsx`, `apps/web/src/app/s/[slug]/page.tsx`, `apps/web/src/app/i/[code]/page.tsx`, `apps/web/src/app/h/[code]/page.tsx`
  - `apps/web/src/app/not-found.tsx`
  - `apps/web/src/components/LabelBeacon.tsx`: a client component that POSTs `page_view` to the `labels` function once
- Test: `apps/web/src/app/l/label.test.ts`; `apps/web/e2e/label.spec.ts` (Playwright)

**Interfaces:**
- Consumes: `public_label` (Phase 2A), the `labels` function's events route (Phase 2B).
- Produces: the pages above. The label page's `generateMetadata` gives the title "<Common name> care and pet safety · Tendril" plus the Smart App Banner.

- [ ] **Step 1: Write the failing tests:**
  - **Label page helpers** (`label.test.ts`):
    - `androidIntentUrl('PL-0001', host, pkg)` builds the exact intent string, with the encoded fallback and referrer
    - `normalizeCode(' pl-0001 ')` returns `'PL-0001'`
  - **Playwright**, against `next build && next start` with the local stack seeded:
    - `/l/PL-0001` shows "Peace lily", the grower name, "Cats: Moderate" and the vet and poison line
    - `/l/pl-0001` works too
    - `/l/NOPE` shows the not-found copy with status 404
    - `/s/peace-lily` shows the toxicity with its source link

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm db:reset && pnpm db:test && pnpm --filter @tendril/web test && pnpm --filter @tendril/web e2e`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add supabase apps/web
git commit -m "feat(web): label QR, species and invite pages with ISR and app/store links"
```

---

### Task 3: Universal Links and App Links files

**Files:**
- Create:
  - `apps/web/src/app/.well-known/apple-app-site-association/route.ts`
  - `apps/web/src/app/.well-known/assetlinks.json/route.ts`
  - `apps/web/src/lib/linkFiles.ts`: pure builders
- Test: `apps/web/src/lib/linkFiles.test.ts`; `apps/web/e2e/well-known.spec.ts`

**Interfaces:**
- Produces:
  - `buildAasa(teamId, appId)`
  - `buildAssetLinks(pkg, sha256s: string[])`
  - both routes use `export const dynamic = 'force-static'` and `Response.json(...)`

- [ ] **Step 1: Write the failing tests:**
  - the builders produce the exact JSON from the Global Constraints
  - an empty SHA list throws in development
  - Playwright requests each file with `maxRedirects: 0` and gets a 200, `content-type` containing `application/json`, and JSON that parses
  - if the dot-folder routing doesn't work, as the research flagged was unverified, fall back to `public/.well-known/` plus a `headers()` rule in `next.config.ts`, and keep the same tests

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm --filter @tendril/web test && pnpm --filter @tendril/web e2e`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web
git commit -m "feat(web): apple-app-site-association and assetlinks.json served as JSON without redirects"
```

---

### Task 4: Admin site

**Files:**
- Create:
  - `supabase/migrations/<ts>_reports.sql`: `public.reports(id, reporter_id, target_type check in ('profile'), target_id uuid, reason text, status check in ('open','actioned','dismissed'), created_at, resolved_by, resolved_at)` with no client grants, plus a pgTAP test
  - `apps/web/src/proxy.ts`
  - `apps/web/src/lib/supabase/server.ts`
  - `apps/web/src/lib/supabase/proxy.ts`
  - `apps/web/src/lib/admin.ts` (`requireAdmin` and `adminDb`)
  - `apps/web/src/app/admin/layout.tsx`, `apps/web/src/app/admin/login/page.tsx`
  - `apps/web/src/app/admin/species/page.tsx`, `apps/web/src/app/admin/species/[id]/page.tsx`, `apps/web/src/app/admin/species/actions.ts`
  - `apps/web/src/app/admin/sensitive/page.tsx` and its actions
  - `apps/web/src/app/admin/partners/page.tsx` and its actions
  - `apps/web/src/app/admin/reports/page.tsx` and its actions
  - `apps/web/src/app/admin/held/page.tsx` and its actions
  - `apps/web/src/app/admin/support/page.tsx`
- Modify: `supabase/functions/me/handler.ts` (adds `POST /report`, inserting with the service role and rate-limited to 10 a day per user)
- Test:
  - `apps/web/src/lib/admin.test.ts`
  - `apps/web/src/app/admin/species/actions.test.ts`
  - `apps/web/e2e/admin.spec.ts`
  - `supabase/functions/tests/report_test.ts`

**Interfaces:**
- Produces:
  - `requireAdmin(): Promise<{ userId: string; email: string }>`: reads claims with `getClaims()` and throws `notFound()` (as if the page doesn't exist) when the role isn't admin
  - `adminDb()`: a service-role client created per request and imported only in server files, starting with `import 'server-only'`
  - **Server Actions:**
    - `saveSpecies(formData)`, `saveToxicity(formData)`, `markReviewed(speciesId, animal)`
    - `addSensitiveTaxon`, `removeSensitiveTaxon`
    - `createPartner`, `createCodes(partnerId, speciesId, count)` (codes `PL-` followed by 4 to 6 base32 characters, avoiding collisions)
    - `retireCode`
    - `resolveReport(id, action: 'reset_handle' | 'dismiss')`: `reset_handle` sets the handle to `plant` followed by random digits
    - `releaseHeld(eventId)`, `revokeHeld(eventId)`
  - **Support lookup:** by handle or email, read-only: profile, entitlements and usage this month.

- [ ] **Step 1: Write the failing tests:**
  - `admin.test.ts`, with `next/headers` and the Supabase client mocked: a user without the admin role makes `requireAdmin` throw; an admin returns their ID and email
  - `actions.test.ts`:
    - `saveToxicity` called as a non-admin throws before any database call
    - severity `none` without a source URL returns the form error "Add the source page before saving No known toxicity."
    - a successful save calls `revalidatePath('/s/peace-lily')` and the label paths
  - `admin.spec.ts`, against a seeded admin user created with `app_metadata.role = 'admin'` through the admin API in global setup:
    - signed out, `/admin` redirects to `/admin/login`
    - a non-admin sees the 404
    - an admin can mark peace lily's cat verdict reviewed, and `/s/peace-lily` then shows it
  - `report_test.ts`: reporting a profile creates a row; the 11th report in a day returns 429

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm db:reset && pnpm db:test && pnpm test:functions && pnpm --filter @tendril/web test && pnpm --filter @tendril/web e2e`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add supabase apps/web
git commit -m "feat(web): admin for curation, sensitive taxa, partners and codes, moderation, held points and support"
```

---

### Task 5: Deep links and Android install referrer in the app

**Files:**
- Modify: `apps/mobile/app.config.ts`:
  - `ios.associatedDomains: ['applinks:' + host]`
  - `android.intentFilters`, with `autoVerify` and `pathPrefix` values `/l`, `/s`, `/i` and `/h`
  - `host` comes from `TENDRIL_WEB_ORIGIN`
- Create:
  - `apps/mobile/src/app/+native-intent.tsx`: rewrites `/s/<slug>` to `/collection/species/by-slug/<slug>`; passes other paths through; never throws
  - `apps/mobile/src/app/collection/species/by-slug/[slug].tsx`: resolves to the species ID, then replaces the route
  - `apps/mobile/src/services/installReferrer.ts`
- Test: `apps/mobile/src/services/installReferrer.test.ts`, `apps/mobile/src/__tests__/routes/nativeIntent.test.ts`

**Interfaces:**
- Produces:
  - `readLabelFromReferrer(): Promise<string | null>`:
    - Android only, on the first launch only (guarded by a persisted flag)
    - parses `label=<code>` from `getInstallReferrerAsync()`
    - returns the normalised code
  - The first-run Welcome screen's "Scan your plant label" shows the prefilled code ("We found label PL-0001 from your download. Continue?") when one is present, and after sign-in it goes to `/l/<code>`.

- [ ] **Step 1: Write the failing tests:**
  - the referrer `utm_source=google-play&label=PL-0001` gives `'PL-0001'`
  - a second launch gives `null`
  - iOS gives `null`
  - `redirectSystemPath` maps `/s/peace-lily` to the by-slug route and leaves `/l/PL-0001` unchanged
  - garbage input returns the input unchanged

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck`
Expected: the tests fail before implementation and pass after.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): universal and app links, slug routing and Android install referrer"
```

---

### Task 6: In-app label QR scanning

**Files:**
- Create:
  - `apps/mobile/src/screens/scan/LabelScanScreen.tsx`
  - `apps/mobile/src/app/scan-label.tsx`
  - `packages/core/src/labels.ts`
- Modify: the Today empty state, the My Plants empty state and Welcome, so that "Scan your plant label" pushes `/scan-label`
- Test: `packages/core/src/labels.test.ts`, `apps/mobile/src/screens/scan/labelScan.test.tsx`

**Interfaces:**
- Produces:
  - `parseLabelUrl(text: string, webHost: string): string | null`: accepts `https://<webHost>/l/<code>`, `tendril://l/<code>` and a bare code matching `^[A-Z0-9-]{4,32}$`, case-insensitively; returns the normalised code, otherwise null
  - `LabelScanScreen({ preview; message: string | null; onClose })`:
    - dark camera UI in the 2b style, with the title "Scan the label" and the hint "Point at the QR code on the plant's label."
    - `message` shows the not-a-label copy
  - The container uses `CameraView` with `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}` and debounces scans (one result per 1.5 s). A valid code navigates to `/l/<code>`; anything else shows "That's not a Tendril label. Try the plant itself." without opening the URL.

- [ ] **Step 1: Write the failing tests:**
  - `parseLabelUrl` accepts the three forms and normalises case and whitespace
  - it rejects `https://evil.example/l/PL-0001`, `javascript:alert(1)` and random text
  - the screen shows the not-a-label message, and the container never calls `Linking.openURL`

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm --filter @tendril/core test && pnpm --filter @tendril/mobile test && pnpm verify`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src apps/mobile
git commit -m "feat(mobile): in-app label QR scanning that only opens Tendril labels"
```
