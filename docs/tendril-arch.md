# Plant app: system architecture

Oct 3, 2026

## Summary

The app is one Expo (React Native) codebase on a Supabase backend, with Plant.id doing identification through our own server and RevenueCat handling subscriptions. Everything competitive runs server-side: quotas, scoring, streaks and leaderboards are computed from an append-only observation log the client cannot edit.

Five principles carry the product decisions into the system:

- **Honest:** every identification shows confidence and alternatives; quotas and trials are enforced and explained server-side.
- **Pet-safe:** every plant is checked against the household's pets, and the answer carries the identification's confidence.
- **Keep-it-alive:** care plans react to check-ins and diagnoses; nothing rewards watering.
- **Collector:** every scan is an observation with species, photos, time and place; points come from a ledger, never from client counters.
- **Private by default:** precise GPS is visible only to its owner, public views use coarse cells, and threatened species are hidden.

| Decision | Choice | Why |
| --- | --- | --- |
| Mobile app | Expo (React Native, TypeScript) | One codebase for iOS and Android, with mature camera, location, notification and purchase libraries |
| Backend | Supabase: Postgres with PostGIS, Auth, Storage, Edge Functions | One managed vendor; row-level security keeps private rows private |
| Identification | Plant.id called from our backend, behind a provider interface | Keys, quotas and costs stay server-side; an on-device model can slot in later |
| Scoring | A worker writes an append-only points ledger; leaderboards derive from it | The client is never trusted, and points can be recomputed or clawed back |
| Location | Precise point in an owner-only table; a coarse hexagon cell for anything public | Privacy by default without losing local leagues |
| Subscriptions | RevenueCat over App Store and Google Play billing | Cross-platform receipts and entitlements without building validation |
| Care engine | Rules engine first; models trained on outcome data later | Transparent and testable now, better with data |
| Web | Next.js site for species pages, grower QR pages and deep links | A label QR works before anyone installs the app |

## System diagram

The app and the web pages call only our Edge Functions; paid and privileged services are reached only from the backend.

&#91;embedded content: system architecture · clients, Supabase backend, external services\]

Purchases run from the app to RevenueCat and back through our billing webhook; scoring, weather and push run in the jobs worker, never on the phone. Analytics, crash reporting and Firebase's attestation services are left out of the picture.

## Technology choices

One managed backend and one client codebase keep this buildable by one developer; every external service sits behind our own API so it can be swapped.

| Layer | Choice | Why |
| --- | --- | --- |
| Mobile app | Expo (React Native, TypeScript) with development builds | One codebase; native modules for camera, location, purchases and app attestation |
| Backend platform | Supabase Pro: Postgres, Auth, Storage, Edge Functions, Cron | $25 a month includes 8 GB of database disk, 100 GB of file storage, 250 GB of egress and 100,000 monthly active users, with a spend cap on by default ([Supabase](https://supabase.com/pricing)) |
| Geodata | PostGIS points plus H3 hexagon cells | PostGIS is a Supabase extension ([Supabase](https://supabase.com/docs/guides/database/extensions/postgis)); an H3 resolution-5 cell averages 253 km2 and resolution 7 about 5 km2 ([H3](https://h3geo.org/docs/core-library/restable/)) |
| Identification | Plant.id v3, called only from our backend | One credit per identification at €0.01 to €0.05; up to 5 photos per call; GPS and time improve accuracy; up to 10 suggestions with confidence ([Kindwise](https://www.kindwise.com/faq)) |
| Diagnosis | plant.health in the same request | One extra credit ([Kindwise](https://www.kindwise.com/faq)) |
| Care and toxicity data | Our own species table, seeded from Plant.id details and curated | Plant.id returns a watering range and a toxicity paragraph ([Kindwise client docs](https://deepwiki.com/flowerchecker/kindwise-api-client/5.3-knowledge-base-queries)), not a per-pet verdict |
| Subscriptions | RevenueCat over App Store and Google Play billing | Free up to $2,500 of monthly tracked revenue, then 1% ([RevenueCat](https://www.revenuecat.com/pricing)) |
| App integrity | Firebase App Check (App Attest, Play Integrity), verified by our backend | App Check can protect custom backends; Play Integrity's standard tier allows 10,000 calls a day ([Firebase](https://firebase.google.com/docs/app-check)) |
| Weather | WeatherKit REST API, called from the backend | 500,000 calls a month included with the Apple Developer Program, and REST works for Android users too ([Apple](https://developer.apple.com/weatherkit/get-started/)) |
| Notifications | Local notifications for care; Expo push for social events | Care reminders fire offline; friend and league events need the server |
| Web and deep links | Next.js on Vercel Pro; Universal Links and App Links | Vercel Hobby is non-commercial only ([Vercel](https://vercel.com/docs/plans/hobby)); Firebase Dynamic Links shut down on 25 August 2025 ([Firebase](https://firebase.google.com/support/dynamic-links-faq/)) |
| Sign-in | Sign in with Apple, Google, email link | Offering Google login requires an equivalent option such as Sign in with Apple ([Apple forums](https://developer.apple.com/forums/thread/765145)); apps with accounts must offer in-app deletion ([Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app)) |
| Analytics and errors | PostHog, Sentry | Funnels, feature flags and paywall tests; crash reports |
| Admin | Supabase Studio plus a small internal admin page | Species curation, moderation queue, refunds and support |

Two rules for the client: it never computes points, quotas or entitlements, and it resizes photos to at most 2 megapixels before upload, the ceiling Kindwise recommends ([Kindwise](https://www.kindwise.com/faq)).

## Data model

The observation is the core record: every scan writes one, and points, streaks, badges, rarity and leaderboards are all derived from observations, so any of them can be rebuilt. Precise coordinates live in their own owner-only table, so a bug in a public query cannot leak them.

| Table | Holds | Key fields | Who can read |
| --- | --- | --- | --- |
| profiles | One row per user | handle, timezone, age confirmed 13+, home privacy zone (randomised centre, radius) | Owner; handle is public |
| households, household\_members, household\_pets | Shared homes and their animals | pet kind (cat, dog, other), children flag | Household members |
| species | Our species catalogue | Plant.id class id, GBIF id, scientific name, family, care parameters, sensitive flag | Everyone |
| species\_toxicity | Curated per-animal verdicts | animal, severity (default unknown, never safe without review), symptoms, source link, reviewer, review date | Everyone |
| sensitive\_taxa | Taxa whose locations are never public | rank, taxon, reason, source | Server only |
| observations | Every scan | user, server time, device time, capture source (camera or gallery), species, confidence, suggestions, place type, wild or cultivated, public H3 cell, visibility, integrity verdict, image hash, linked plant | Owner; public fields only through views |
| observation\_locations | Precise point for each observation | PostGIS point, accuracy, mock-location flag | Owner only (row-level security) |
| observation\_photos | Photos for each observation | storage path, size, organ (leaf, flower, whole), metadata stripped | Owner; public copies only when shared |
| plants | "My Plants" in a household | species, nickname, room, indoor, pot size and material, drainage, light, status (alive, dead, given away), death cause, parent plant (cutting lineage), source (scan, label QR, gift) | Household members |
| care\_tasks, care\_events, diagnoses | The care loop | task type and due time, check-in answers (soil dry, leaf state), diagnosis and its effect (for example, pause watering) | Household members |
| score\_events | Append-only points ledger | rule id and version, points, reason, idempotency key, revoked time | Owner |
| leaderboard\_entries | Derived board totals | board key (for example local cell plus category), period, user, score | Per board visibility |
| streaks, badges, user\_badges, sets, user\_set\_progress | Collection state | streak length, freezes held, badge criteria, set completion | Owner; badges public on profile |
| friendships, league\_memberships | Social graph and weekly leagues | status; week, league, cell | Participants |
| entitlements, usage\_counters | Premium state and quotas | product, active until (from RevenueCat); identifications, health checks and scoring scans per period | Owner; written by server only |
| partners, qr\_codes, qr\_scans | Grower and garden centre program | partner type, species or cultivar per code, scan, install and adoption attribution | Partner sees own aggregates |
| reports, jobs | Moderation and async work | target, reason, status; job type, payload, attempts | Server and admin |

Three conventions hold everywhere: IDs are UUIDs, times are stored in UTC with the user's timezone kept for streaks, and only server functions write to observations, ledger, entitlements and counters.

## Key flows

Four flows carry the product: scan to points, the care loop, leagues and streaks, and label QR to adoption. Thresholds below are starting values to tune, not findings.

### Scan to identification and points

1. The app captures 1 to 5 photos in its own camera (or picks from the gallery), resizes them to 2 megapixels or less, and sends them with GPS, accuracy, device time and an App Check token.
2. The `identify` function checks the token, the session and the user's quota. Over quota returns a clear limit screen and makes no paid call.
3. It stores the photos in a private bucket with metadata stripped, writes the observation as pending, and writes the precise point to the owner-only table.
4. It calls Plant.id with the photos, coordinates, time and similar images, adding plant.health when the user asked for a diagnosis.
5. Below a confidence threshold (start at 50%), the app shows the alternatives with comparison photos and asks for a leaf, flower or whole-plant shot instead of guessing.
6. The user confirms a species. The server upserts it into the species catalogue, attaches the household's pet verdicts with the identification's confidence, and sends any correction back to Plant.id as feedback, which costs no credits ([Kindwise](https://www.kindwise.com/faq)).
7. A scoring job runs integrity checks, classifies the find, applies the versioned rules, writes ledger rows, then updates boards, streaks, badges and set progress and queues notifications.
8. A public projection exposes only species, H3 resolution-5 cell and date for public finds. Sensitive taxa get no location at all.

### Care loop

1. Adding a plant (from a scan or a label QR) asks three questions: light in the room, pot size and material, drainage.
2. The rules engine schedules a check, not a watering, from the species' watering range, pot, light and season; outdoor plants also use WeatherKit forecasts cached per resolution-7 cell and refreshed every 6 hours.
3. A check-in asks whether the top of the soil is dry. Yes creates a watering task; no moves the next check. Every answer is a care event.
4. A diagnosis changes the plan: an overwatering result pauses watering tasks until two dry checks in a row.
5. The app schedules local notifications from the server's task list, so reminders fire offline; the server recomputes after every event and nightly.
6. Status changes (alive, dead plus cause, given away) and photo check-ins become the labelled outcome data for care model v2.

### Leagues and streaks

1. Weekly leagues group users by H3 resolution-5 cell, merging neighbouring cells until a league reaches 20 members. Friends boards are computed on read.
2. Boards reset weekly; all-time totals are sums over the ledger, never a separate counter.
3. Streaks are evaluated in the user's timezone: any care check-in extends the daily streak, a new species extends the weekly discovery streak, and a held freeze is spent automatically on a missed day.

### Label QR to adoption

1. A grower prints a label code that maps to a partner and a species or cultivar.
2. Scanning opens a fast web page with care basics and pet toxicity, no install needed; Universal Links and App Links open the app instead when it is installed.
3. "Add to my plants" creates the plant with source set to label QR. Without the app, the page sends the user to the store, and the first-run screen offers "Scan your plant label" to finish adoption.
4. Each scan, install and adoption is recorded against the partner for their reporting.

## Privacy, safety and anti-cheat

Precise locations never leave their owner, rare plants never get a public pin, and points are awarded only for evidence the server can check.

### Location

- **Precise points** stay in the owner-only table: never in public APIs, exports or shared images, which are stripped of metadata.
- **Public location** is at most an H3 resolution-5 cell, about 253 km2 on average. For comparison, iNaturalist's obscured mode shows a random point in a 0.2 by 0.2 degree cell, about 500 km2 at the equator ([iNaturalist](https://help.inaturalist.org/en/support/solutions/articles/151000233080-how-does-inaturalist-protect-the-locations-of-sensitive-species-)).
- **Home privacy zone** is set during onboarding with a randomised centre, and finds inside it are never public, even as a cell. Strava's zones were opt-in when its heatmap exposed military bases ([The Register](https://www.theregister.co.uk/2018/01/29/strava_military_base_locations)), and an analysis showed a fixed circular zone can reveal its centre ([The Register](https://www.theregister.co.uk/2018/02/08/strava_privacy_still_leakable/)).
- **Sensitive taxa** get no public location and stay off public rarity boards. Seed the list by hand, starting with orchids; iNaturalist automatically hides certain orchid species because poachers seek them ([iNaturalist](https://help.inaturalist.org/support/solutions/articles/151000169938)). The IUCN Red List API forbids commercial use ([IUCN client docs](https://iucn-uk.github.io/iucnredlist/)), so its data needs a commercial licence first.
- **Rarity seed data** from GBIF uses CC0 and CC BY records only: CC BY-NC bars commercial use ([GBIF](https://www.gbif.org/news/82812)), and iNaturalist's dataset on GBIF carries that licence ([iNaturalist forum](https://forum.inaturalist.org/t/inaturalist-data-on-gbif-shows-only-cc-by-nc-excluding-cc0-and-cc-by/9952)).

### People

- **13 and over at launch.** COPPA requires verifiable parental consent before collecting personal information from under-13s ([Kelley Drye](https://www.kelleydrye.com/viewpoints/client-advisories/ftc-releases-proposed-revisions-to-childrens-online-privacy-protection-rule-coppa)), and the definition covers geolocation and photos ([TechNewsWorld](https://www.technewsworld.com/?p=67769)). Anyone who gives an age under 13 cannot create an account at launch.
- **Account deletion** in the app removes observations, locations, photos and ledger rows, and revokes Sign in with Apple tokens as Apple requires ([Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app)).
- **Sharing is opt-in per item**, and reports land in a moderation queue on the admin page.

### Safety rules in the product

- Toxicity answers carry the identification's confidence, unknown is never shown as safe, and any ingestion links to a vet or poison line; in the US that is the ASPCA Animal Poison Control Center, (888) 426-4435 ([ASPCA](https://www.aspca.org/node/30171)).
- No points for picking, foraging or edibility, and no challenges on private property. Pokémon Go settled a trespass class action by removing stops near single-family homes and adding a complaints process ([VGC](https://videogameschronicle.com/news/pokemon-go-studio-settles-lawsuit-involving-players-trespassing)).

### Anti-cheat

Every check runs server-side in the scoring job; values are starting points to tune.

| Check | Signal | Effect when it fails |
| --- | --- | --- |
| App integrity | App Check token from App Attest or Play Integrity ([Firebase](https://firebase.google.com/docs/app-check)) | Identification works, no points |
| Capture source | In-app camera versus gallery upload | Identification works, no points |
| Location | Mock-location flag, reported accuracy, speed between scans | Points held for review |
| Time | Device time versus server time, more than 10 minutes apart | No points |
| Duplicates | Image hash match, or same species within 30 m for the same user | Counts once |
| Plausibility | Species unusual for the cell and season in regional stats | Points held until a second find or review |
| Volume | Daily cap on scoring scans | Extra scans identify but score nothing |

Held or revoked points are ledger rows with a revoked time, so boards are rebuilt from the ledger rather than patched.

## Monetization and entitlements

Free covers what rivals charge for: identification within a monthly cap, basic care and pet toxicity. Premium sells the keep-it-alive coach. Our server is the only judge of who is premium and how many paid calls they have left.

| Feature | Free | Premium |
| --- | --- | --- |
| Identifications | 10 a month | Fair use, 60 a month |
| Pet toxicity for the household | Included | Included |
| Basic care guide per species | Included | Included |
| Adaptive check-ins, weather, diagnosis-driven plan | Not included | Included |
| Diagnoses (plant.health) | 1 a month | Fair use, 10 a month |
| Household sharing and holiday hand-over | Not included | Included |
| Plantdex, sets, streaks, leagues, species cards | Included | Included |
| Streak freezes | Earned by referrals | 2 held at all times |

Caps and prices are starting values to test. Start at $24.99 a year or $4.99 a month with no weekly plan, priced under [Greg](https://apps.apple.com/app/id1512912236) at $29.99 and [Planta](https://apps.apple.com/app/1410126781) at $35.99 a year.

**Honest trial.** A 7-day Premium preview is granted by our server as an entitlement row with an expiry. No store subscription starts, nothing auto-renews, and the preview simply ends with a prompt to subscribe.

**Billing path.** The app buys through the RevenueCat SDK; RevenueCat's webhooks ([RevenueCat](https://www.revenuecat.com/pricing)) call our `billing-webhook` function, which updates the entitlements table; the app reads entitlements only from our API.

**Store fees.** Apple charges 15% under its Small Business Program for developers under $1 million in proceeds ([Apple](https://developer.apple.com/app-store/small-business-program/)). Google Play subscriptions cost a 10% service fee plus a 5% billing fee in the US, UK, EEA, Australia and Japan, and 15% elsewhere ([Google](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)). At $24.99 a year, that leaves about $21.24 before sales tax or VAT, and about $20.99 once RevenueCat's 1% applies.

**Quotas.** Each paid call increments the user's usage counter in the same transaction that authorises it, so retries and parallel requests cannot overspend.

## Costs

Fixed running costs at launch are about $45 a month plus store fees; identification credits are the cost that grows with use, which is why the caps exist.

| Item | Price | Notes |
| --- | --- | --- |
| Apple Developer Program | $99 a year | Needed to publish; includes WeatherKit ([Apple](https://developer.apple.com/support/compare-memberships)) |
| Google Play developer account | $25 once | ([Google](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)) |
| Supabase Pro | $25 a month | A $10 credit covers one Micro compute instance; file storage over 100 GB costs $0.0213 per GB ([Supabase](https://supabase.com/pricing)) |
| Vercel Pro | $20 a month | One seat ([Vercel](https://vercel.com/docs/plans/hobby)) |
| RevenueCat | $0 up to $2,500 monthly tracked revenue, then 1% | ([RevenueCat](https://www.revenuecat.com/pricing)) |
| WeatherKit | $0 up to 500,000 calls a month | ([Apple](https://developer.apple.com/weatherkit/get-started/)) |
| Plant.id credits | €0.05 down to €0.01 per credit by volume, prepaid from 1,000 credits | Purchases of 30,000 credits or more expire after 3 months ([Kindwise](https://kindwise.com/pricing)) |

**Identification is the variable cost.** A free user at the cap uses 11 credits a month (10 identifications, 1 diagnosis), €0.11 to €0.55. A premium user at the cap uses 70 credits, €0.70 to €3.50.

**Break-even.** A premium subscriber nets about $1.75 a month ($20.99 a year). At €0.05 a credit that pays for roughly 30 to 35 credits, depending on the exchange rate; at €0.01, roughly 150 to 175. While buying small packs, a subscriber who maxes out costs more than they pay, so track median and 95th-percentile usage from day one and move common species to an on-device model once volume justifies it.

**Storage and weather.** At an assumed 0.5 MB per stored photo, the included 100 GB holds about 200,000 photos. Refreshing each active resolution-7 cell every 6 hours costs 120 weather calls a cell a month, so the included 500,000 calls cover about 4,100 cells.

PostHog and Sentry are not priced here; check their current plans before launch.

## Build plan

Five phases of four to six weeks take the app from an empty repository to launch on 15 March 2027, ahead of the busy season that starts in May ([Appfigures](https://appfigures.com/resources/insights/20220610/3-this-plant-finder-app-is-crushing-it-right-now)).

&#91;embedded content: build plan · 5 phases, 5 gates, launch 15 March 2027\]

Each phase ends at a gate that must hold before the next starts; if a phase slips, cut collector scope rather than move the launch.

- **Google Play:** new personal developer accounts must run a closed test with at least 12 testers opted in for the preceding 14 days before applying for production ([Google](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)). Open it by 1 February with about 20 testers so the count never dips below 12.
- **Toxicity curation** runs alongside phase 3: review common houseplants first and leave every other species as unknown.
- **Plant.id credits:** buy small packs during the build, since purchases of 30,000 credits or more expire after 3 months ([Kindwise](https://kindwise.com/pricing)).

**Wild finds at launch.** The sensitive-taxa list and GBIF rarity seed are built in phase 2, and the phase 4 cheating test covers wild finds as well as houseplants.

## Risks and open decisions

The biggest risk is economic, not technical: collector features drive scans, and every scan costs a credit.

| Risk | Mitigation |
| --- | --- |
| Heavy scanners cost more than they pay | Caps enforced server-side; daily habit built on free care check-ins; usage percentiles tracked from launch; Kindwise offers custom pricing at volume ([Kindwise](https://kindwise.com/pricing)); on-device model for common species later |
| Single identification vendor | Provider interface from day one; observations keep our own species IDs, not vendor IDs |
| Wrong toxicity answer | Reviewed table only, unknown never shown as safe, confidence on every verdict, vet or poison line on every ingestion screen |
| Location leak | Precise points in an owner-only table, public data only through views, row-level security tests in CI |
| Leaderboard cheating | Server-side scoring, held points, small boards, a cheating test as the phase 4 gate |
| Store rejection or delay | Sign in with Apple beside Google login, in-app account deletion, 13+ rating, Play closed test opened early |
| Winter revenue dip | Winter mode for streaks; plan cash for the off-season |
| Data licences | GBIF CC0 and CC BY only; no IUCN data without a commercial licence |

### Open decisions

- [ ] Personal or organization developer accounts; the 12-tester closed test applies to new personal Play accounts ([Google](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)) - Will do
- [ ] Launch countries and languages - Ireland, EU and US all in English
- [ ] Final prices and caps after a paywall test - Agreed with the prices suggested in above doc
- [ ] App name and brand - Tendril

## Sources

- Platform and pricing: [Supabase pricing](https://supabase.com/pricing), [Supabase PostGIS](https://supabase.com/docs/guides/database/extensions/postgis), [Vercel Hobby plan](https://vercel.com/docs/plans/hobby), [RevenueCat pricing](https://www.revenuecat.com/pricing), [WeatherKit](https://developer.apple.com/weatherkit/get-started/), [Apple Developer Program](https://developer.apple.com/support/compare-memberships), [Google Play registration](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)
- Identification: [Kindwise FAQ](https://www.kindwise.com/faq), [Kindwise pricing](https://kindwise.com/pricing), [Kindwise client docs](https://deepwiki.com/flowerchecker/kindwise-api-client/5.3-knowledge-base-queries)
- Geodata: [H3 cell statistics](https://h3geo.org/docs/core-library/restable/)
- Store rules and fees: [App Store Small Business Program](https://developer.apple.com/app-store/small-business-program/), [Google Play service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en), [Google Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), [Apple account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app), [Apple login services thread](https://developer.apple.com/forums/thread/765145)
- Integrity and links: [Firebase App Check](https://firebase.google.com/docs/app-check), [Firebase Dynamic Links FAQ](https://firebase.google.com/support/dynamic-links-faq/)
- Privacy and data licences: [iNaturalist sensitive species](https://help.inaturalist.org/en/support/solutions/articles/151000233080-how-does-inaturalist-protect-the-locations-of-sensitive-species-), [iNaturalist geoprivacy](https://help.inaturalist.org/support/solutions/articles/151000169938), [Strava heatmap](https://www.theregister.co.uk/2018/01/29/strava_military_base_locations), [Strava privacy zones](https://www.theregister.co.uk/2018/02/08/strava_privacy_still_leakable/), [IUCN Red List API terms](https://iucn-uk.github.io/iucnredlist/), [GBIF licences](https://www.gbif.org/news/82812), [iNaturalist data on GBIF](https://forum.inaturalist.org/t/inaturalist-data-on-gbif-shows-only-cc-by-nc-excluding-cc0-and-cc-by/9952), [COPPA rule](https://www.kelleydrye.com/viewpoints/client-advisories/ftc-releases-proposed-revisions-to-childrens-online-privacy-protection-rule-coppa), [COPPA amendments](https://www.technewsworld.com/?p=67769)
- Safety: [ASPCA Animal Poison Control](https://www.aspca.org/node/30171), [Pokémon Go trespass settlement](https://videogameschronicle.com/news/pokemon-go-studio-settles-lawsuit-involving-players-trespassing)
- Market: [PictureThis revenue and seasonality (Appfigures)](https://appfigures.com/resources/insights/20220610/3-this-plant-finder-app-is-crushing-it-right-now), [Greg on the App Store](https://apps.apple.com/app/id1512912236), [Planta on the App Store](https://apps.apple.com/app/1410126781)
