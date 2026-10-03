# Phase 6: Premium, Billing, Households and Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Load `supabase:supabase` and `supabase:supabase-postgres-best-practices` before writing SQL or function code.

**Goal:**
- **Server-side Premium:** the server alone decides who is Premium.
  - It grants the honest 7-day preview once per user, with no store subscription.
  - RevenueCat purchases reach the database through a signed, deduplicated webhook that checks RevenueCat's API before changing entitlements.
- **Premium features:** household sharing and holiday hand-over are gated to Premium.
- **Account deletion:** it removes every row and photo and revokes the Sign in with Apple token, as Apple requires.

**Architecture:**
- `me` gains the preview, Apple credential and account routes.
- A new `billing-webhook` function verifies the static authorization header and the HMAC signature on the raw body, dedupes on `event.id`, and calls the subscriber API (`BillingReconciler`) before writing the `store` entitlement.
- `AppleClient` exchanges and revokes tokens with a client-secret JWT. The refresh token is stored AES-GCM-encrypted in `private.apple_credentials`.
- On the app side, `PurchasesProvider` gets a RevenueCat implementation (`react-native-purchases`), with the user ID set to the Supabase user ID. After a purchase, the app polls our API until the entitlement appears.

**Tech Stack:** `npm:jose@5` (ES256 client secret), Web Crypto (HMAC-SHA256 and AES-GCM), `react-native-purchases` 10.x.

**Spec:** `docs/superpowers/specs/2026-10-03-tendril-v1-design.md` (§8.4 entitlements and quotas, §6.4 purchases, §12 idempotency). Architecture doc sections "Monetization and entitlements" and "Account deletion". Design frames 2g, 4be–4bg, 4bb, 4bc, 4bd, 4bj and 4bk.

## Global Constraints

- **Prices and plans:**
  - $24.99 a year or $4.99 a month, with no weekly plan.
  - The RevenueCat entitlement lookup ID is `premium`.
  - The products are configured in RevenueCat (see the runbook). The app shows the store's localized price strings from the offerings, never hard-coded prices, except in fixture mode.
- **Preview:**
  - 7 days, once per user (`profiles.preview_used_at`), stored as `entitlements(source='preview', active_until = now() + 7 days)`.
  - No store subscription is started and nothing renews.
  - A local reminder fires at 10:00 local the day before it ends: "Your Premium preview ends tomorrow. You'll go back to Free, and nothing is charged."
- **Webhook:**
  - `verify_jwt = false`.
  - Authentication: the `Authorization` header must exactly equal `RC_WEBHOOK_AUTH`. When `RC_HMAC_SECRET` is set, `X-RevenueCat-Webhook-Signature: t=<unix>,v1=<hex>` must equal the HMAC-SHA256 of `"<t>.<rawBody>"`, compared in constant time, with ±300 s tolerance.
  - Every event is deduplicated on `event.id` in `private.billing_events`.
  - It reconciles with `GET https://api.revenuecat.com/v1/subscribers/{app_user_id}` (`Authorization: Bearer RC_SECRET_KEY`). A grant is active when `entitlements.premium.expires_date` is null or later than now, or `grace_period_expires_date` is later than now.
  - `TRANSFER` events reconcile both `transferred_from` and `transferred_to`.
  - It answers 200 within 60 s. An unknown `app_user_id` (not a Tendril user) is recorded and answered with 200.
  - Environment variables: `BILLING_PROVIDER=fake|revenuecat`, `RC_WEBHOOK_AUTH`, `RC_HMAC_SECRET`, `RC_SECRET_KEY`.
- **Apple token revocation:**
  - The client secret is an ES256 JWT with `iss` the team ID, `aud` `https://appleid.apple.com`, `sub` the bundle ID, `kid` the key ID, and a 5-minute lifetime.
  - Exchange: `POST https://appleid.apple.com/auth/token` with `grant_type=authorization_code`.
  - Revoke: `POST https://appleid.apple.com/auth/revoke` with `token_type_hint=refresh_token`.
  - Environment variables: `APPLE_PROVIDER=fake|apple`, `APPLE_TEAM_ID`, `APPLE_CLIENT_ID` (the bundle ID), `APPLE_KEY_ID`, `APPLE_P8`, `APPLE_TOKEN_ENC_KEY` (32 bytes, base64).
- **Account deletion, in this order:**
  1. Revoke the Apple token, if there is one. A failure is logged and deletion continues.
  2. Delete every Storage object under `<uid>/`, page by page.
  3. Delete households where the user is the only member. Where others remain, transfer ownership to the earliest-joined remaining member.
  4. Call `auth.admin.deleteUser(uid)`, which cascades.
  5. Respond `204`.

  The client has already shown the subscription notice (4bk). Deletion never cancels a store subscription.
- **Premium-only features:**
  - adaptive schedule and weather (already enforced in Phase 3)
  - household sharing: inviting members
  - holiday hand-over
  - the 10-a-month diagnosis limit and the 60-a-month identification limit

  On Free, these show the preview offer (4bd) or the paywall.

## Review Focus

1. **Webhook events that arrive out of order**, for example an EXPIRATION processed after a later RENEWAL. Because every event reconciles from the subscriber API, the final state is RevenueCat's current truth, whatever the order. Tested in Task 3.
2. **A replayed webhook with a valid signature but a timestamp more than 300 s old.** Rejected with 401, and nothing changes. Tested in Task 3.
3. **Deleting an account while a check-in or scan request is in flight.** Later requests with the old token get 401 (the user no longer exists), no orphaned rows remain, and the Storage folder is empty afterwards. Tested in Task 2.
4. **Starting the preview twice, including after it has expired.** The second attempt returns 409 `conflict` with "You've already had the Premium preview." and grants nothing. Tested in Task 2.
5. **A household member who is removed during a hand-over that names them as the recipient.** The hand-over ends at once, and reminders fall back to the owner. Tested in Task 4.

---

### Task 1: Billing, Apple credential, hand-over and household invite tables

**Files:**
- Create: `supabase/migrations/<ts>_money_account.sql`, `supabase/tests/database/100-money-account.test.sql`

**Interfaces:**
- Produces:
  - `private.billing_events(event_id text pk, type text, app_user_id text, environment text, payload jsonb, received_at timestamptz, processed_at timestamptz)`
  - `private.apple_credentials(user_id uuid pk references auth.users on delete cascade, refresh_token_enc text, iv text, created_at)`
  - `public.household_handovers(id, household_id, from_user, to_user, starts_on date, ends_on date, created_at, ended_at)`: household members can read it
  - `public.household_invites(code text pk, household_id, created_by, created_at, accepted_by, accepted_at, expires_at)`: the creator can read their own
  - `public.srv_set_store_entitlement(uid uuid, active_until timestamptz, store text, product_id text, environment text)`: service role only; upserts `source='store'`

- [ ] **Step 1: Write the failing test** (`100-money-account.test.sql`):
  - neither private table is readable by `authenticated`
  - household members see hand-overs and non-members don't
  - invites are visible to their creator only
  - `srv_set_store_entitlement` can't be executed by `authenticated` and works as the service role
  - `private.is_premium` is true after a future `active_until`

- [ ] **Step 2: Run it to verify it fails**, then write the migration, then run it to verify it passes

Run: `pnpm db:reset && pnpm db:test && pnpm db:types`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add supabase packages/db
git commit -m "feat(db): billing events, encrypted Apple credentials, hand-overs and household invites"
```

---

### Task 2: Preview, Apple credential and account deletion routes

**Files:**
- Create:
  - `supabase/functions/_shared/providers/apple.ts`: the `AppleClient` interface, the Apple implementation and a fake
  - `supabase/functions/_shared/crypto.ts`: AES-GCM `seal` and `open`
  - `supabase/functions/me/account.ts`
- Modify: `supabase/functions/me/handler.ts` (adds `POST /preview`, `POST /apple-credential` and `DELETE /account`)
- Test: `supabase/functions/tests/account_test.ts`, `supabase/functions/tests/preview_test.ts`, `supabase/functions/tests/apple_test.ts`

**Interfaces:**
- Produces:
  - `interface AppleClient { exchange(code: string): Promise<{ refreshToken: string }>; revoke(refreshToken: string): Promise<void> }`
  - `seal(plain: string, keyB64: string): Promise<{ data: string; iv: string }>` and `open(sealed, keyB64): Promise<string>`
  - `POST /preview` returns `Entitlement`. A second attempt gets 409 `conflict` with "You've already had the Premium preview."
  - `POST /apple-credential { authorizationCode }` exchanges the code and stores the sealed refresh token. It's idempotent: repeating it replaces the stored token.
  - `DELETE /account` returns 204 after the deletion order in Global Constraints.

- [ ] **Step 1: Write the failing tests:**
  - `preview_test.ts`:
    - the first preview grants 7 days and sets `preview_used_at`
    - the second gets 409
    - an expired preview still gets 409
  - `apple_test.ts`:
    - the client-secret JWT has the right header and claims (verify with a generated P-256 key)
    - `seal` then `open` round-trips
    - a different key fails to open
  - `account_test.ts`, run against the fake database, which records Storage removals and admin calls:
    - Apple revoke is called with the decrypted token
    - Storage removes every object under `uid/`, including more than one page (simulate 250 objects with pages of 100)
    - a sole-member household is deleted
    - a shared household keeps the other member, who becomes owner
    - `auth.admin.deleteUser` is called last
    - a revoke failure still deletes the account

  Extend `e2e/scan_flow_test.ts`: after the flow, `DELETE /me/account` returns 204, and with the service role, `select count(*)` across the user-owned tables returns 0 and the Storage list under `uid/` is empty.

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm test:functions && pnpm check:functions && pnpm e2e:functions`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add supabase
git commit -m "feat(functions): one-time Premium preview, Apple token storage and full account deletion"
```

---

### Task 3: RevenueCat billing webhook

**Files:**
- Create:
  - `supabase/functions/billing-webhook/index.ts`, `supabase/functions/billing-webhook/handler.ts`
  - `supabase/functions/_shared/providers/revenuecat.ts`: the `BillingReconciler` interface, the REST implementation and a fake
  - `supabase/functions/_shared/providers/fixtures/rc-subscriber-active.json`, `rc-subscriber-expired.json`, `rc-event-renewal.json`, `rc-event-transfer.json`
- Modify: `supabase/config.toml` (`[functions.billing-webhook] verify_jwt = false`)
- Test: `supabase/functions/tests/billing_webhook_test.ts`

**Interfaces:**
- Produces:
  - `interface BillingReconciler { premiumUntil(appUserId: string): Promise<{ activeUntil: string | null; store: string | null; productId: string | null; environment: 'SANDBOX' | 'PRODUCTION' | null }> }`:
    - `activeUntil` is null when the user isn't entitled, and `'9999-12-31T00:00:00Z'` for a lifetime grant
    - the REST implementation parses the v1 subscriber JSON, taking the later of `expires_date` and `grace_period_expires_date`
  - **Handler flow:**
    1. Check the static authorization header.
    2. Verify the HMAC signature when it's configured.
    3. Parse the body, then insert into `billing_events` with `on conflict do nothing`. A duplicate returns 200 immediately.
    4. Work out the user IDs: `app_user_id`, or both sides of a `TRANSFER`.
    5. For each user that exists, reconcile and call `srv_set_store_entitlement` (an expired result writes `active_until = now()`).
    6. Mark the event processed and return 200.

- [ ] **Step 1: Write the failing tests** (`billing_webhook_test.ts`):
  - a wrong authorization header gives 401
  - a bad signature gives 401
  - a timestamp 301 s old gives 401
  - a valid renewal sets the store entitlement to the reconciled date
  - a duplicate `event.id` doesn't reconcile again
  - out-of-order events (EXPIRATION after RENEWAL, with the fake reconciler returning active) leave the user Premium
  - a TRANSFER reconciles both users
  - an unknown user gets 200 and is recorded
  - a reconciler failure gives 500 with the event stored but not processed, so RevenueCat retries

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm test:functions && pnpm check:functions`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add supabase
git commit -m "feat(functions): RevenueCat webhook with HMAC verification, dedupe and subscriber reconciliation"
```

---

### Task 4: Household sharing and holiday hand-over

**Files:**
- Modify:
  - `supabase/functions/me/handler.ts`: adds `POST /household/invites`, `POST /household/join/:code`, `DELETE /household/members/:userId`, `POST /household/handover` and `DELETE /household/handover/:id`
  - `packages/core/src/domain.ts`: `Household` gains `handover: { id: string; toName: string; startsOn: IsoDate; endsOn: IsoDate } | null`
- Test: `supabase/functions/tests/household_test.ts`

**Interfaces:**
- Produces:
  - **Inviting:** requires the caller to be Premium and a household member, otherwise 403 with `details.premiumRequired = true`. The code expires after 7 days. Returns `{ code, url: <TENDRIL_WEB_ORIGIN>/h/<code> }`.
  - **Joining:** works for any signed-in user, Free included. An expired or used code gets 409.
  - **Removing a member:** owner only. If the removed member is the recipient of an active hand-over, the hand-over ends (`ended_at = now()`).
  - **Hand-over:** requires Premium and that both people are members. Only one active hand-over per household at a time.
  - **The rule for reminders, exported from core:** `responsibleUserId(household, today): string | null`. The recipient during an active hand-over, otherwise null, meaning everyone.

- [ ] **Step 1: Write the failing tests** (`household_test.ts`):
  - a Free user inviting gets 403 with `premiumRequired`
  - a Premium user's invite can be joined by a Free user
  - joining twice gets 409
  - removing the hand-over recipient ends the hand-over
  - a second active hand-over gets 409

  Add a core test for `responsibleUserId`.

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm test:functions && pnpm --filter @tendril/core test`
Expected: everything passes.

- [ ] **Step 3: Commit**

```bash
git add supabase packages/core/src
git commit -m "feat: Premium household sharing and holiday hand-over"
```

---

### Task 5: Purchases, paywall and preview in the app

**Files:**
- Create: `apps/mobile/src/services/purchases.revenuecat.ts`
- Modify:
  - `apps/mobile/src/services/purchases.ts`: choose the provider (RevenueCat when `EXPO_PUBLIC_REVENUECAT_IOS_KEY` or `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` is set and the native module is present, otherwise the fake)
  - `apps/mobile/src/app/paywall.tsx`: purchases, polling, pending and failed states
  - `apps/mobile/src/api/supabase/SupabaseApi.ts`: `startPreview` and `getEntitlement` (the preview's days left)
  - the camera, diagnosis and household containers: a quota or Premium refusal opens the Limit sheet, then the paywall or the preview offer
  - `apps/mobile/src/services/notifications.ts`: `schedulePreviewEndingReminder(activeUntil)`
- Test: `apps/mobile/src/services/purchases.test.ts`, `apps/mobile/src/app/paywallFlow.test.tsx`

**Interfaces:**
- Produces:
  - `revenueCatPurchases(userId)`:
    - configures with the platform key, then `Purchases.logIn(userId)`
    - `getPlans()` maps the current offering's `annual` and `monthly` packages to `{ id, title, price: pkg.product.priceString, per, subtitle }`. The yearly subtitle shows the per-month figure from `pkg.product.pricePerMonthString` when it's available.
    - `purchase(id)` returns `'purchased'`, `'cancelled'` (when `userCancelled`), `'pending'` (`PAYMENT_PENDING_ERROR`) or `'failed'`
    - `restore()` calls `Purchases.restorePurchases()`
  - **Paywall container:**
    - After `'purchased'` or a restore, it polls `getEntitlement()` every 2 s for up to 20 s until the plan is `premium`, then closes with a snackbar "Premium is on."
    - If polling times out, it shows "We're confirming your purchase. Premium will turn on shortly."
    - `'pending'` shows frame 4bf and `'failed'` shows frame 4bg.
  - After `startPreview`, it schedules the preview-ending reminder.

- [ ] **Step 1: Install the dependency:** `npx expo install react-native-purchases`

- [ ] **Step 2: Write the failing tests** (mock `react-native-purchases`):
  - `PAYMENT_PENDING_ERROR` maps to pending
  - `userCancelled` maps to cancelled, and the paywall stays open with no error copy
  - after a purchase, the paywall polls until Premium, then closes
  - a polling timeout shows the confirming copy
  - starting the preview schedules a reminder for 10:00 on the day before it ends

- [ ] **Step 3: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck`
Expected: the tests fail before implementation and pass after.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): RevenueCat purchases, server-confirmed Premium and the honest preview"
```

---

### Task 6: Account deletion, Apple credential and households in the app

**Files:**
- Modify:
  - `apps/mobile/src/services/auth.ts`: after Apple sign-in, POST `authorizationCode` to `me/apple-credential`, retrying once in the background
  - `apps/mobile/src/api/supabase/SupabaseApi.ts`: `deleteAccount`, plus new methods `inviteMember`, `joinHousehold`, `startHandover` and `endHandover`, added to `TendrilApi` and the fixture API
  - the `settings/delete-account` container: an active `store` entitlement shows 4bk; "Manage subscription" opens `Linking.openURL` to the store's subscription page (`https://apps.apple.com/account/subscriptions` or `https://play.google.com/store/account/subscriptions`); after deletion, sign out and go to Welcome
  - `apps/mobile/src/screens/profile/HouseholdScreen.tsx`: an invite share sheet, and a hand-over sheet (choose a member, start and end dates)
  - `apps/mobile/src/hooks/useCareReminders.ts`: skip a household's tasks when `responsibleUserId` names someone else
  - `apps/mobile/src/app/h/[code].tsx`: household invite deep link; join after sign-in
- Test: `apps/mobile/src/app/deleteAccountFlow.test.tsx`, `apps/mobile/src/hooks/useCareReminders.handover.test.ts`

**Interfaces:**
- Produces: the new `TendrilApi` methods `inviteMember(): Promise<{ url: string }>`, `joinHousehold(code): Promise<void>`, `startHandover(input: { toUserId: string; startsOn: IsoDate; endsOn: IsoDate }): Promise<void>` and `endHandover(id): Promise<void>`.

- [ ] **Step 1: Write the failing tests:**
  - the delete flow shows 4bk when a store entitlement is active
  - confirming calls `deleteAccount` once, then `signOut`
  - during a hand-over to someone else, reminders for that household aren't scheduled on the owner's device

- [ ] **Step 2: Run them to verify they fail**, then implement, then run them to verify they pass

Run: `pnpm --filter @tendril/mobile test && pnpm verify`
Expected: everything passes.

- [ ] **Step 3: Check by hand against the local stack (web)**

1. Start the preview; Settings shows "Premium preview: 7 days left".
2. Invite a second user to the household; they join.
3. Delete the second account; the first user's household remains, and Storage has nothing left under the second user's ID.

Record the steps in the report.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): account deletion, Apple token hand-off, household invites and hand-over"
```
