# Tendril stack research

Oct 3, 2026 · versions and APIs checked against official docs and registries on this date

This is the factual base for the spec and plans. Anything marked **unverified** has to be confirmed during implementation.

## Mobile: Expo SDK 57

- **Versions:** `expo@57.0.26`, React Native 0.86.3, React 19.2.3, TypeScript ~6.0.3. The New Architecture is mandatory. Node 22.13 or later, iOS 16.4 or later, Android 7 or later. SDK 58 is in beta, so stay on 57.
- **Always install with `npx expo install <pkg>`.** npm's latest often moves ahead of SDK 57's pins (Reanimated, react-native-maps, Sentry, AsyncStorage).
- **Starting template:** `npx create-expo-app@latest`, then `npm run reset-project`, gives TypeScript with expo-router, `src/app/`, typed routes and the React Compiler.
- **expo-router 57:** it forked React Navigation, so never import `@react-navigation/*`. Use `expo-router/react-navigation`, `expo-router/js-tabs` and `expo-router/js-stack`.
  - **Tab bar:** JS `Tabs` with a custom `tabBar` or `tabBarButton` gives the raised Scan button. NativeTabs can't do that.
  - **Sign-in guard:** `Stack.Protected guard={...}`. `redirectTo` is SDK 58 only.
  - **Modals:** `formSheet` and `modal` render as plain routes on web, so Tendril uses its own Sheet component to stay faithful to the design everywhere.
  - **Typed routes:** `experiments.typedRoutes`.
- **Camera:** `expo-camera` `CameraView` and `takePictureAsync`. Mount only one preview, and unmount it on blur. It works in Expo Go and on web.
- **Resizing:** expo-image-manipulator uses `ImageManipulator.manipulate(uri).resize({width}).renderAsync()` then `.saveAsync({format: SaveFormat.JPEG, compress, base64})`. Re-encoding strips EXIF, including GPS, according to GitHub issues; the docs don't say.
- **Other modules:**
  - expo-image-picker: `allowsMultipleSelection`, `selectionLimit: 5`.
  - expo-location: `getCurrentPositionAsync`. `mocked` is reported on Android only.
  - expo-notifications: local `DATE` triggers. On Android, create the channel before asking permission.
  - expo-crypto: `digest(SHA256, bytes)`.
  - expo-file-system: `new File(uri).bytes()`.
- **Maps:** react-native-maps 1.27.2 (`MapView`, `Marker`, `Circle`) works in Expo Go. There's no web support, so add a `.web.tsx` stub.
- **Fonts:** `@expo-google-fonts/fraunces` (`Fraunces_600SemiBold`) and `@expo-google-fonts/inter` (`Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_400Regular_Italic`), loaded with `useFonts`, which works on web.
- **Icons:** lucide-react-native 1.51 and react-native-svg 15.15. The canonical names are `CircleQuestionMark`, `CircleCheck`, `TriangleAlert`, `OctagonAlert`, `Ellipsis`, `ImageIcon`, plus Calendar, Sprout, Camera, LayoutGrid, Trophy, Flame, Leaf, Flower, ScanQrCode, Cat, Dog, PawPrint, Ban, Sun, Droplet, HeartPulse, Info, Diamond, Octagon, X, ChevronLeft, ChevronRight, Lock, Search, Snowflake, Check and Plus.
- **Animation and accessibility:**
  - Reanimated 4.5.1 with react-native-worklets 0.10.1.
  - `useReducedMotion()` only reads the setting at startup. Use `AccessibilityInfo.isReduceMotionEnabled()` plus the `reduceMotionChanged` listener for live changes.
  - Keep `allowFontScaling` on, and cap `maxFontSizeMultiplier` only where layout needs it, through an `AppText` wrapper.
- **Testing:**
  - jest-expo 57.0.5 and jest ~29.7.
  - @testing-library/react-native 14 has an async `render` and needs `test-renderer`. Pin 13.3.3 if you use expo-router's `renderRouter`.
  - Web export for screenshots: `npx expo export --platform web` with `web.output: "single"` (static output pre-renders in Node).
- **Supabase client:** supabase-js 2.117.2 with `react-native-url-polyfill`. Store the session with `expo-sqlite/localStorage/install`; SecureStore's size limit makes it unsuitable. Use `flowType: 'pkce'` and `detectSessionInUrl: false`, and start or stop auto-refresh as the app moves between foreground and background.
- **Sign-in:**
  - Apple: `expo-apple-authentication`, then `signInWithIdToken({provider:'apple'})`. iOS only, and the full name arrives on the first sign-in only.
  - Google: `@react-native-google-signin/google-signin` 16.1.5 (free API), then `signInWithIdToken({provider:'google'})`. Needs a dev build and possibly Supabase's skip-nonce setting.
  - Email link: PKCE, read the incoming link with `Linking.useLinkingURL()`, then `exchangeCodeForSession(code)`. The code is valid for 5 minutes and only on the same device.
- **Purchases:** react-native-purchases 10.11.0 has no config plugin. Expo Go and web get mocks; real purchases need a dev build. For a custom paywall, use `getOfferings()` then `purchasePackage()`.
- **App integrity:** `@react-native-firebase/app` and `app-check` 26.4 (dev build only) produce a JWT that is easy to verify on our server. `@expo/app-integrity` 57.0.2 is alpha and would mean verifying App Attest and Play Integrity ourselves, so use Firebase as the architecture doc says.
- **Sentry and PostHog:** `@sentry/react-native` (Expo pins ~7.11) with the `@sentry/react-native/expo` plugin. For `posthog-react-native`, call `posthog.screen(pathname)` by hand.
- **Needs a dev build, not Expo Go:** Google sign-in, Firebase, real purchases, Android remote push, Sentry native crash reports, the expo-font config plugin.

## Backend: Supabase

- **CLI and local stack:**
  - CLI 2.119.0. Install as a dev dependency and run with `npx supabase …`.
  - The local stack needs Docker; in this WSL distro Docker Desktop's WSL integration must be switched on.
  - Postgres **17**.
  - Start without unused containers: `supabase start -x studio,postgres-meta,logflare,vector,imgproxy,supavisor`. Keep Mailpit (http://127.0.0.1:54324) for auth emails.
- **Breaking change from 30 Oct 2026:** new tables are no longer exposed to the Data API automatically. **Every migration grants explicitly:**

  ```sql
  grant select, insert, update, delete on public.x to authenticated, service_role;
  ```

  Grant only what each role needs.
- **Write migrations by hand.** Declarative schema diffs miss grants, `security_invoker`, `alter policy` and column privileges, which is exactly where Tendril's security lives.
- **Extensions on PG17:** postgis 3.3.7 (`with schema extensions`; inside security definer functions, schema-qualify it as `extensions.st_*`), pgtap, pg_cron, pg_net, pgmq 1.5.1, pg_jsonschema, supabase_vault.
- **No H3 extension exists, hosted or local.** Use `npm:h3-js@4.5.0` in Edge Functions (verified under Deno). Store cells as `bigint` via `BigInt('0x'+cell)`.
- **Edge Functions:**
  - Runtime is Deno 2.1-compatible (edge-runtime 1.77).
  - Each function gets its own `deno.json` with `npm:` imports.
  - Shared code goes in `supabase/functions/_shared`.
  - Imports from elsewhere in the git root (`packages/core`) do get bundled, but only CLI source confirms this, so smoke-test serve and deploy early. Relative imports need explicit `.ts` extensions.
  - Caller auth: `npm:@supabase/server@1` `withSupabase({auth:'user'|'secret'|'none'})` gives `ctx.userClaims`, `ctx.supabase` (RLS) and `ctx.supabaseAdmin`.
  - Env vars: `SUPABASE_URL`, `SUPABASE_DB_URL`, and `SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS` (JSON; read `.default`).
  - Never forward a user's JWT into the admin client: a secret key bypasses RLS only when no user token is attached.
  - Limits: 2 s CPU, 150 s (Free) or 400 s (paid) wall clock, 256 MB memory. The request body limit isn't documented, so **upload photos to Storage and pass paths**.
  - Unit tests: `deno test` with `globalThis.fetch` mocked.
- **Cron and queues:**
  - Cron: pg_cron plus pg_net calling a worker function. Keep the URL and secret key in Vault. Locally the URL is `http://api.supabase.internal:8000`.
  - pg_net's default timeout is 2 s, so the worker should reply fast and finish the work in `EdgeRuntime.waitUntil`.
  - Purge `cron.job_run_details` on a schedule.
  - Queues: pgmq, read by the worker over `SUPABASE_DB_URL` (`npm:postgres`, `prepare:false`) or through wrapper RPCs granted to service_role only. Don't expose `pgmq_public`.
- **Storage:**
  - Create the private bucket in a migration.
  - Each user's folder policy matches `(storage.foldername(name))[1] = (select auth.uid())::text`.
  - Strip EXIF on the client by re-encoding. As a server backstop, `npm:piexifjs` `remove()` then `npm:exifr` `gps()` to assert nothing is left (JPEG only).
  - A user who still owns Storage objects can't be deleted, so delete the objects first.
- **Auth:**
  - Apple, Google and email sign-in.
  - `config.toml`: `site_url = "tendril://"` and `additional_redirect_urls = ["tendril://**", "exp://**"]`.
  - Set the email link lifetime to 15 minutes to match the design (`otp_expiry = 900`).
  - **Supabase does not revoke Apple tokens.** We exchange the native authorizationCode at Apple's `/auth/token`, store the refresh token server-side, and call `/auth/revoke` when an account is deleted.
- **RLS rules:**
  - Write `(select auth.uid())`, and give every policy `to authenticated`.
  - Index every column a policy filters on.
  - Security definer helpers go in a `private` schema with `set search_path=''`.
  - Membership policies use a helper to avoid recursion.
  - Server-only tables get no grants and no policies.
  - Column-restricted public projections are security definer functions or derived tables. Invoker views don't work for this.
- **Testing:**
  - pgTAP in `supabase/tests/database`.
  - Vendor basejump `supabase_test_helpers` 0.0.6 into `000-setup.sql` (gives `tests.create_supabase_user` and `tests.authenticate_as`).
  - Generate types with `npx supabase gen types --local`.
- **Pricing:** Pro is still $25 a month and includes 100k MAU, 8 GB of database disk, 100 GB of file storage and 2 million function calls.

## Outside services

- **Plant.id v3:**
  - Endpoint and auth: `POST https://plant.id/api/v3/identification` with an `Api-Key` header. Query: `details=common_names,taxonomy,rank,gbif_id,image,synonyms,watering,toxicity,best_light_condition,best_watering` and `language=en`.
  - Request body: `images` (data URLs, up to 5), `latitude`, `longitude`, `datetime`, `similar_images: true`, `classification_level: "species"`, `health: "all"` (only when the user asked for a diagnosis; costs 2 credits).
  - Response:
    - `access_token`
    - `result.is_plant {probability, threshold 0.5, binary}`
    - `result.classification.suggestions[] {id, name, probability, similar_images[], details{common_names, taxonomy, gbif_id, watering {min,max} on a 1-3 scale, toxicity (LLM free text, not a verdict)}}`
    - with health: `result.is_healthy` and `result.disease.suggestions[] {name, probability, details {local_name, description, treatment {chemical[], biological[], prevention[]}, cause}}`
  - **Feedback:** `POST /identification/{token}/feedback {rating, comment}` is free. There's no structured "correct suggestion" field, so put the chosen id in `comment` and keep our own correction table.
  - Usage: `GET /usage_info`. HTTP 429 means out of credits.
  - There is no sandbox key, so tests run against fixture JSON.
  - Images: 1 to 2 megapixels.
- **RevenueCat:**
  - The webhook body is `{api_version, event}`.
    - `event.id` is the idempotency key; retries reuse it.
    - Fields: `type`, `app_user_id`, `aliases`, `entitlement_ids`, `expiration_at_ms`, `environment`, `store`, `product_id`.
    - TRANSFER events carry only `transferred_from` and `transferred_to`.
  - Verify with the static `Authorization` header plus HMAC `X-RevenueCat-Webhook-Signature: t=..,v1=hex(HMAC-SHA256("t.rawBody"))`, allowing 5 minutes of clock tolerance.
  - Reconcile with `GET https://api.revenuecat.com/v1/subscribers/{id}` and a Bearer secret key. Check `expires_date` yourself. This call creates the customer if missing.
  - Reply 200 within 60 s. RevenueCat retries 5 times.
  - Pricing: free up to $2.5k of monthly tracked revenue, then 1%.
- **WeatherKit:**
  - `GET https://weatherkit.apple.com/api/v1/weather/{lang}/{lat}/{lon}?dataSets=forecastDaily,forecastHourly&timezone=…` (timezone is required).
  - Auth: an ES256 JWT with header `{alg, kid, id: TEAM.SERVICE}` and claims `iss`, `iat`, `exp`, `sub`.
  - Daily fields: `temperatureMax`, `temperatureMin`, `precipitationAmount` (mm), `precipitationChance`, `maxUvIndex`, `daytimeForecast.humidity`.
  - The app must show the Apple Weather attribution.
- **Firebase App Check:**
  - The client sends `X-Firebase-AppCheck`.
  - Verify with jose's `createRemoteJWKSet('https://firebaseappcheck.googleapis.com/v1/jwks')` and RS256, with `iss` = `https://firebaseappcheck.googleapis.com/<PROJECT_NUMBER>`, `aud` including `projects/<PROJECT_NUMBER>`, and `sub` in our allowed app IDs.
  - Play Integrity allows 10,000 calls a day by default.
- **Expo push:** `POST https://exp.host/--/api/v2/push/send` takes up to 100 messages per request. Collect receipts later with `POST /push/getReceipts`. A `DeviceNotRegistered` error means delete that token.
- **GBIF:**
  - Occurrence counts: `GET https://api.gbif.org/v1/occurrence/search?taxonKey=…&decimalLatitude=a,b&decimalLongitude=c,d&license=CC0_1_0&license=CC_BY_4_0&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&limit=0`, then read `count`.
  - Name matching: `/v1/species/match?name=…&kingdom=Plantae`.
  - Data that is used should be registered as a derived dataset (via `facet=datasetKey`).
- **ASPCA:**
  - There's no API or dataset, and the content is "all rights reserved". Curate by hand, paraphrase, and link to each page.
  - Page URLs: `https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/{slug}`.
  - Results for the plants checked on 2026-10-03:

    | Group | Plants |
    | --- | --- |
    | Non-toxic to cats and dogs | Spider plant, Boston fern, African violet, parlor palm, calathea, Christmas cactus, Phalaenopsis orchid, hawthorn |
    | Toxic to both: insoluble calcium oxalates (mouth irritation, drooling, vomiting, trouble swallowing) | Peace lily, Monstera, golden pothos, heartleaf philodendron, dieffenbachia |
    | Toxic to both: saponins | Snake plant, aloe, English ivy |
    | Toxic to both: other | Jade plant (vomiting, depression, incoordination), poinsettia (mild irritation, "over-rated"), primrose (mild vomiting) |
    | Toxic to both: severe | Sago palm (liver failure), foxglove (cardiac glycosides) |
    | Toxic to cats only | Easter lily (kidney failure; non-toxic to dogs) |
    | No ASPCA page, so shipped as **unknown** | ZZ plant, *Ficus elastica*, *Ficus lyrata*, bluebell, gorse |
  - Check synonyms when matching names: *Crassula argentea* = *C. ovata*, *Sansevieria* = *Dracaena trifasciata*, and *Calathea* is now often *Goeppertia*.

## Web: Next.js 16

- **Versions:** Next.js **16.3.8** (Active LTS), React 19.2+, Turbopack is the default. `@supabase/supabase-js` needs Node 22 or later, and Vercel defaults to Node 24.
- **Auth middleware:** `middleware.ts` is now **`proxy.ts`**. Use `@supabase/ssr` 0.12.7 with `createServerClient` and `getAll`/`setAll` cookies, and call `getClaims()` (never `getSession()` on the server). Limit the proxy matcher to `/admin`.
- **Admin role:** `app_metadata.role = 'admin'`, checked in three places: the proxy, `app/admin/layout.tsx`, and inside every Server Action. RLS uses `private.is_admin()` as a backstop.
- **Universal Links and App Links:**
  - Serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` from route handlers with `dynamic = 'force-static'` and `Response.json(...)`.
  - The apple-app-site-association file uses `components` with `/l/*` and `/s/*`, and must be served with no redirects.
  - `assetlinks.json` lists the Play app-signing SHA-256 and the EAS key SHA-256.
- **Expo app config:** `ios.associatedDomains: ["applinks:<domain>"]`, plus `android.intentFilters` with `autoVerify` and `pathPrefix` `/l` and `/s`. Rewrite incoming URLs in `app/+native-intent.tsx` if needed.
- **Universal link gotcha:** a link on the same domain doesn't trigger it. The "Open in app" button on a label page must point at the `tendril://` scheme or a second subdomain.
- **Android "open, else install":** use a Chrome `intent://` URL with `S.browser_fallback_url` pointing at the Play listing with `&referrer=label%3D<code>`. Read it on first launch with `expo-application` `getInstallReferrerAsync()`.
- **Deferred deep linking:** there's no free way to do it on iOS, so first run offers "Scan your plant label" (confirmed as the right approach).
- **Caching:**
  - Species and label pages use ISR (`revalidate`, with `generateStaticParams` returning `[]`).
  - Data comes from a **cookie-less** supabase-js client, so the pages stay static.
  - Call `revalidatePath` after admin edits.
- **Vercel:** Hobby is for non-commercial use only. Pro is $20 a month per deploying seat.
- **Testing:** Playwright 1.63 runs against `next build && next start`. Vitest 5 covers route handlers in the node environment.
