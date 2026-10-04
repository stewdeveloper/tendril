# Tendril mobile release pipeline

How to get from empty accounts to signed iOS and Android builds that testers can install, and then to the App Store and Google Play.

Written 4 October 2026 against Expo SDK 57 and EAS CLI 24.x. Every Expo claim below was checked against the current docs, linked inline. Anything I could not confirm is marked **verify**. The release runbook (`RUNBOOK.md`, Phase 8 Task 6) covers the non-mobile side (Supabase, RevenueCat, Vercel and so on). This guide covers only the mobile build and submit path.

## 0. What exists today and what lands later

| Piece | Status |
| --- | --- |
| `apps/mobile/app.config.ts` (bundle id and package from `TENDRIL_APP_ID`, default `app.tendril`; scheme `tendril`) | Exists |
| `apps/mobile/eas.json`, `extra.eas.projectId`, `runtimeVersion`, `updates.url` | Lands in Phase 8 Task 2 (content in section 2.3) |
| `expo-dev-client` | Phase 8 Task 2 (`npx expo install expo-dev-client`) |
| `expo-updates` | Not in any plan task I could find. Needed for OTA (section 7.3). Add it in Task 2 |
| Native modules the guide relies on: `expo-sqlite`, `expo-crypto`, `react-native-svg` now; `expo-camera`, RevenueCat, Firebase App Check later | Expo Go cannot run them, so every test build is a development, preview or production build |
| CI: `.github/workflows/ci.yml` (typecheck, test, lint, database) | Exists. The release workflows in section 6 are separate files |

Do not run the commands in sections 2 to 5 until Task 2 has landed, except the account setup in section 1.

## 1. Accounts and ownership

### 1.1 What you need

| Account | Why | Cost (check current pricing) |
| --- | --- | --- |
| Expo account, plus an **organization** | Owns the EAS project, builds, credentials, OTA updates | Free plan exists. See section 9 |
| Apple Developer Program | Signing, TestFlight, App Store, push keys, Sign in with Apple, App Attest | $99 a year |
| Google Play Console | Play internal and closed testing, production | $25 one time |
| Firebase project | App Check (Play Integrity, App Attest), Android push (FCM) | Free tier |
| GitHub | Already in use. Holds `EXPO_TOKEN` for CI | n/a |

Sign up in this order: Apple and Google first, because identity checks take days. Expo and Firebase take minutes.

### 1.2 Decisions for the team

**Individual or organisation Apple account.** The design spec says personal accounts. Source: [Apple enrollment](https://developer.apple.com/support/enrollment/).

- Individual: no D-U-N-S number, your legal name appears as the seller on the App Store.
- Organisation: needs a legal entity, a D-U-N-S number, a work email on the entity's domain and a working website. The entity name appears as the seller.
- A sole trader enrols as an individual. Moving to an organisation later means contacting Apple support.
- **Recommendation:** follow the spec and enrol as an individual if there is no company yet, and accept that your name is public. If a company is planned within six months, enrol as an organisation now. Starting the D-U-N-S request early costs nothing. Time to approval: verify, plan for days to weeks.

**Individual or organisation Google account.** Google's closed-test rule (12 testers, 14 days) is documented for **personal accounts created after 13 November 2023**. The page does not say whether organisation accounts are exempt, so **verify** before choosing on that basis. Source: [Google Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465). The spec plans for personal accounts, so this guide does too.

**Expo organization, not a personal Expo account.** Create an organization on expo.dev, put the project under it, and invite teammates. A project under a personal account is awkward to hand over. Recommended.

### 1.3 Who owns what and where secrets live

Name one owner per row. If the owner is unavailable, someone else must be able to reach the secret.

| Item | Owner role | Lives in |
| --- | --- | --- |
| Apple Developer account, Apple ID with 2FA | Account holder | Account holder's password manager. Recovery contact documented |
| App Store Connect API key (`.p8`, key ID, issuer ID) | Admin | EAS credentials (uploaded once). Backup `.p8` in the team password manager. Apple lets you download it only once |
| Distribution certificate, provisioning profiles, APNs push key | EAS | EAS servers. Backup with `eas credentials` (section 3.3) |
| Google Play account | Account holder | Account holder's password manager |
| Google service account JSON (for `eas submit`) | Admin | EAS credentials. Backup in the password manager |
| Android upload keystore | EAS | EAS servers. Backup with `eas credentials`. Play App Signing means Google can reset a lost upload key |
| `EXPO_TOKEN` (personal access token) | CI owner | GitHub repo secret. Create it from a dedicated robot Expo user, not a person |
| EAS env vars: public values (Supabase URL and publishable key, RevenueCat SDK keys, PostHog key, Sentry DSN) | Anyone with project access | EAS env, `plaintext`. These end up in the app bundle, so treat them as public |
| EAS env secrets (`SENTRY_AUTH_TOKEN`, file vars) | Admin | EAS env, `secret` |
| Supabase service role key, Plant.id key, RevenueCat REST key | Backend | **Never** in EAS or the mobile app. They belong in Supabase secrets (see `RUNBOOK.md`) |

Rule from Expo: anything in client code is readable by anyone who runs the app, and client variables cannot use `secret` visibility. Source: [EAS environment variables](https://docs.expo.dev/eas/environment-variables/).

## 2. One-time project setup

All EAS commands run from `apps/mobile`, not the repo root. Source: [Set up EAS Build with a monorepo](https://docs.expo.dev/build-reference/build-with-monorepos/). `eas.json` lives in `apps/mobile`.

### 2.1 Install and log in

```sh
pnpm add --global eas-cli     # or: npx eas-cli@latest <command>
eas login
eas whoami
```

### 2.2 Create the EAS project

```sh
cd apps/mobile
eas init --account <your-org-slug>
```

`eas init` creates or links the project and prints a project ID. Source: [`eas init`](https://docs.expo.dev/eas/cli/). Because `app.config.ts` is dynamic, **verify** whether the CLI can write the ID into it. Assume it cannot. Tendril reads the ID from the environment instead:

```sh
# Plain text. The project ID is not a secret.
eas env:set --name EAS_PROJECT_ID --value <uuid> --environment development --visibility plaintext
eas env:set --name EAS_PROJECT_ID --value <uuid> --environment preview --visibility plaintext
eas env:set --name EAS_PROJECT_ID --value <uuid> --environment production --visibility plaintext
```

Plain text and sensitive EAS variables are available when the CLI evaluates a dynamic app config. Source: [Environment variables usage](https://docs.expo.dev/eas/environment-variables/usage/). That does not help the very first command, because the CLI needs the project ID before it can fetch variables. So also:

- locally: put `EAS_PROJECT_ID=<uuid>` in `apps/mobile/.env` (git-ignored by the repo's `.env` rule), or run `eas env:pull --environment development`;
- in GitHub Actions: set `EAS_PROJECT_ID` as a repository variable and pass it as `env` (section 6.1). **Verify** that builds work without it. If they do, drop the extra copy.

### 2.3 `eas.json` (lands in Phase 8 Task 2)

This is the plan's file with the fields the current docs require added. The additions are marked in the notes below the file.

```json
{
  "cli": { "version": ">= 19.1.0", "appVersionSource": "remote" },
  "build": {
    "base": { "pnpm": "12.8.1" },
    "development": {
      "extends": "base",
      "developmentClient": true,
      "distribution": "internal",
      "environment": "development",
      "env": {
        "EXPO_PUBLIC_API_MODE": "supabase",
        "EXPO_PUBLIC_APP_CHECK_DEV": "1"
      }
    },
    "preview": {
      "extends": "base",
      "distribution": "internal",
      "channel": "preview",
      "environment": "preview",
      "env": { "EXPO_PUBLIC_API_MODE": "supabase" }
    },
    "production": {
      "extends": "base",
      "autoIncrement": true,
      "channel": "production",
      "environment": "production",
      "env": { "EXPO_PUBLIC_API_MODE": "supabase" }
    }
  },
  "submit": {
    "production": {
      "ios": { "ascAppId": "<Apple ID number from App Store Connect>" },
      "android": { "track": "internal", "releaseStatus": "draft" }
    }
  }
}
```

Notes, against the [eas.json reference](https://docs.expo.dev/eas/json/):

- `base` is not built directly. It only carries the pnpm pin, so the pin is written once. `extends` is documented. Plan Task 2 repeats `"pnpm": "12.8.1"` on each profile, which is equivalent.
- `pnpm` is a documented per-profile field. The EAS `sdk-57` image ships pnpm 11.9.0 ([infrastructure](https://docs.expo.dev/build-reference/infrastructure/)), so the pin matters: the repo's lockfile and `packageManager` say 12.8.1.
- `cli.version` is `>= 19.1.0`, not `>= 16.0.0`. `--refresh-ad-hoc-provisioning-profile` (section 4.1) needs 19.1.0. Current is 24.10.0.
- `environment` is added to every profile. Without it, EAS picks one: `production` for store distribution, `development` for dev clients, `preview` otherwise. Setting it explicitly avoids surprises. The field does not apply to `env` below, which is committed and not secret.
- `channel` is added to `preview` and `production` for OTA updates. It has no effect on development builds, which run updates from any channel.
- `submit.production.ios.ascAppId` is added. Without it, `eas submit` may prompt to create an app record, which cannot work in CI. The ID is not secret. Find it in App Store Connect under App Information, General Information, "Apple ID".
- `submit.production.android` is added. `releaseStatus: draft` uploads without rolling out, which is what you want while the Play listing is incomplete. Change it to `completed` once the app is live.
- Android: `preview` and `development` with `distribution: internal` produce an **APK**. `production` produces an **AAB**, which is what Play requires. Sources: [internal distribution](https://docs.expo.dev/build/internal-distribution/), [Android submit](https://docs.expo.dev/submit/android/).
- Simulator builds are optional: add `"development-simulator": { "extends": "development", "ios": { "simulator": true } }` if people want to run on a simulator. Not needed for the first test build.
- `EXPO_PUBLIC_APP_CHECK_DEV=1` on the development profile is carried over from the plan.

### 2.4 Environment variables per profile

Two places hold variables:

- `env` in `eas.json`: committed to git, for non-sensitive switches (`EXPO_PUBLIC_API_MODE`).
- EAS environment variables (`eas env:set`): per environment (`development`, `preview`, `production`), with visibility `plaintext`, `sensitive` or `secret`.

Commands (`eas env:set` creates or updates; there is no `env:create` or `env:update`). Sources: [manage variables](https://docs.expo.dev/eas/environment-variables/manage/), [CLI reference](https://docs.expo.dev/eas/cli/).

```sh
eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --environment preview --visibility plaintext
eas env:set --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value <key> --environment preview --visibility plaintext
eas env:list --environment preview
eas env:pull --environment preview       # writes a local .env (git-ignored)
```

Variable names below are the ones the plans reference. Check the committed `apps/mobile/.env.example` and the `pnpm env:check` output (Phase 8 Task 5) for the authoritative list.

| Variable | development | preview | production |
| --- | --- | --- | --- |
| `EAS_PROJECT_ID` | same | same | same |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | local stack or staging | staging project | production project |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | test keys | test keys | live keys |
| `EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_SENTRY_DSN` | unset | optional | set |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | set | set | set |
| `EXPO_PUBLIC_FIREBASE_ENABLED` | `1` once Firebase is configured | `1` | `1` |
| `SENTRY_AUTH_TOKEN` (source maps, only if Sentry's Expo plugin needs it: **verify**) | unset | `secret` | `secret` |
| `GOOGLE_SERVICES_JSON`, `GOOGLE_SERVICE_INFO_PLIST` (file variables, `--type file --visibility secret`) | set | set | set |

Notes:

- The app runs with none of the optional keys (Phase 8 global constraint). A first test build needs only the Supabase pair and `EXPO_PUBLIC_API_MODE=supabase`.
- `EXPO_PUBLIC_*` values are inlined into the JS bundle at build time. Changing one requires a new build or an OTA update that includes it, not just a dashboard edit.
- File variables supply git-ignored files such as `google-services.json`. In `app.config.ts`: `android: { googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json' }`. Source: [manage variables](https://docs.expo.dev/eas/environment-variables/manage/). This is not in `app.config.ts` yet. Add it when Firebase lands.
- **Which Supabase project do testers hit?** Decision for the team. The spec names one hosted project. Test data in the production database is hard to clean up. **Recommendation:** point `preview` at a staging project and create the production project before store release. If the cost of a second project is not acceptable yet, point `preview` at the one hosted project and wipe test data before launch.
- **Bundle id per profile.** Keep `app.tendril` for all profiles in v1. Distinct ids per variant let dev and store builds install side by side but multiply the Apple, Firebase and Sign in with Apple registrations. Source if you change your mind: [app variants](https://docs.expo.dev/build-reference/variants/). The cost: a development build and a TestFlight build overwrite each other on one phone.

### 2.5 App config changes that builds depend on

Phase 8 Task 2 covers the first four. The rest land with their features, but the pipeline needs them in place before the matching store step.

| Setting | Why |
| --- | --- |
| `extra.eas.projectId` from `EAS_PROJECT_ID` | Links the app to EAS |
| `runtimeVersion: { policy: 'appVersion' }`, `updates.url` only when the ID is set | OTA (section 7.3) |
| `expo-dev-client` and `expo-updates` installed | Development builds and OTA |
| **Remove** `ios.buildNumber` and `android.versionCode` from env in app config | Ignored under `appVersionSource: remote` (section 7.1) |
| `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` | Stops App Store Connect asking an export-compliance question on every build. **Verify** the answer is right for Tendril (HTTPS only is normally exempt) |
| `ios.usesAppleSignIn: true` | Sign in with Apple capability. EAS syncs capabilities on `eas build` ([iOS capabilities](https://docs.expo.dev/build-reference/ios-capabilities/)) |
| `ios.associatedDomains: ['applinks:tendril.app']` | Universal Links for `/l/*` and `/s/*` |
| `android.intentFilters` with `autoVerify: true` for `https://tendril.app/l` and `/s` | App Links ([Android App Links](https://docs.expo.dev/linking/android-app-links/)) |
| `expo-notifications` plugin | Push. Needs `google-services.json` on Android |
| Camera and location permission strings | Required by both stores' review |
| App Attest capability | Firebase App Check on iOS. The capabilities table lists App Attest as synced |

### 2.6 Monorepo specifics

- **App root.** Run every `eas` command in `apps/mobile`. EAS uploads the git repo and builds from the app directory.
- **Hoisted linker.** `pnpm-workspace.yaml` already sets `nodeLinker: hoisted`. Expo supports isolated pnpm installs since SDK 54 and recommends hoisted only if a library breaks ([monorepo guide](https://docs.expo.dev/guides/monorepos/)). Keep hoisted. Debug duplicates with `pnpm why --depth=10 react-native`.
- **What EAS runs.** The build runs `eas-build-pre-install`, then the package manager's install at the project root, then `eas-build-post-install` ([build lifecycle hooks](https://docs.expo.dev/build-reference/npm-hooks/), [Android build process](https://docs.expo.dev/build-reference/android-builds/)). pnpm is chosen from the lockfile.
- **Filtered install on EAS.** The Phase 8 plan wants `pnpm install --filter @tendril/mobile...` to skip the Supabase CLI binary and Deno. I found no documented EAS setting or `PNPM_FLAGS` variable that changes the install command, and the pre-install hook runs *before* the install, so it cannot replace it. **Verify** this: run one build, read the "Install dependencies" log, and measure. Only optimise if it costs real minutes. If it does, ask Expo (or use a [custom build](https://docs.expo.dev/custom-builds/get-started/)), or rewrite the install in a hook, which risks breaking `--frozen-lockfile`. Note also `allowBuilds` in `pnpm-workspace.yaml` does not list `supabase`, so its binary download script may already be blocked. Check before assuming 146 MB.
- **Filtered install in GitHub Actions** is under our control and is documented in section 6.1.
- **Workspace package.** `@tendril/core` is `workspace:*`. If it needs a build step, add `"postinstall"` or `eas-build-post-install` in `apps/mobile/package.json` that builds it. The monorepo doc gives that pattern. If Metro consumes the TypeScript source directly (check), nothing is needed.
- **Lockfile.** Commit `pnpm-lock.yaml`. EAS installs from it.
- **`.easignore`.** If present it replaces `.gitignore` for deciding what is uploaded ([`.easignore`](https://docs.expo.dev/build-reference/easignore/)). Do not create one unless uploads are too large.

## 3. Signing

EAS manages signing by default (`credentialsSource: remote`). You do not generate or store keys yourself.

### 3.1 iOS

Three credentials ([app credentials](https://docs.expo.dev/app-signing/app-credentials/)):

| Credential | Limit | Notes |
| --- | --- | --- |
| Distribution certificate | 2 per Apple account | Shared by all apps on the account. Expiry blocks new builds but not installed apps |
| Provisioning profile | Unlimited | One per app. Expires after 12 months. Regenerated on the next build |
| Push key (APNs) | 2 per account | Does not expire. Revoking it stops push for every app using it |

**First iOS build must be interactive and run on a machine with a person at the keyboard.** The CLI asks you to log in with your Apple ID (2FA) and then creates the certificate and profile. CI cannot do this the first time. Source: [Trigger builds from CI](https://docs.expo.dev/build/building-on-ci/).

```sh
cd apps/mobile
eas credentials:configure-build --platform ios --profile production   # optional: set up without building
```

**App Store Connect API key (needed for submit and for CI).** Create it in App Store Connect under Users and Access, Integrations. The role needed is **verify** (Admin is the safe choice). Then:

```sh
eas credentials --platform ios
# choose the production profile, log in, then:
# "App Store Connect: Manage your API Key" -> "Set up your project to use an API Key for EAS Submit"
```

Source: [iOS submit](https://docs.expo.dev/submit/ios/). Download the `.p8` once and back it up.

**Registering tester devices (ad hoc builds only).** Each tester registers their iPhone once:

```sh
eas device:create
```

The CLI prints a URL and QR code. The tester opens it in Safari on the iPhone, installs the profile in Settings, and the device ID is recorded. Apple caps ad hoc distribution at **100 iPhones per year per membership**, and a newly added device can take 24 to 72 hours to become installable. Source: [internal distribution](https://docs.expo.dev/build/internal-distribution/). A device added after the last build needs a rebuild, or `eas build:resign` to re-sign an existing build ([app credentials](https://docs.expo.dev/app-signing/app-credentials/)).

TestFlight and App Store builds do not need device registration.

**Push credentials.** The app uses Expo push tokens (spec section 6).

- iOS: the first time you create a development build, answer yes when `eas build` asks about push notifications and EAS creates the APNs key. Otherwise `eas credentials` later. Source: [push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/).
- Android needs FCM V1: a Firebase service account key uploaded with `eas credentials --platform android`, plus `google-services.json` in the app. Source: [FCM V1 credentials](https://docs.expo.dev/push-notifications/fcm-credentials/).

### 3.2 Android

- **Upload keystore.** The first Android build asks to generate a keystore. Say yes. EAS stores it and **reuses it for every profile with the same package name**, including development builds ([internal distribution](https://docs.expo.dev/build/internal-distribution/)).
- **Play App Signing.** On the first Play upload Google offers "App signing by Google Play". Accept it (this is the default). From then on your EAS keystore is only the *upload* key. Google re-signs what users install. If the upload key is lost, Google support can reset it, with a 72 hour wait ([app credentials](https://docs.expo.dev/app-signing/app-credentials/)).
- **Two SHA-256 fingerprints, not one.** This matters for `assetlinks.json`:

  | Fingerprint | Used by | Where to get it |
  | --- | --- | --- |
  | EAS upload key | APK from internal distribution, sideloaded | `eas credentials --platform android`, pick the profile, copy "SHA256 Fingerprint" |
  | Play app signing key | Installs from Play (internal, closed, production) | Play Console, the app, Release, Setup, App signing (the docs' name for the page; the console menu may differ, **verify**) |

  Source: [Android App Links](https://docs.expo.dev/linking/android-app-links/).

- **`assetlinks.json` for `tendril.app/l/...`.** Host it at `https://tendril.app/.well-known/assetlinks.json` (the spec has a route handler for it). List **both** fingerprints in `sha256_cert_fingerprints` so links verify for sideloaded test APKs and for Play installs. Package name: `app.tendril`. Until the Play app exists you only have the EAS fingerprint, so add the Play one after the first upload.
- **Firebase.** Add the same SHA-256 fingerprints (and SHA-1 if Firebase asks) to the Android app in the Firebase project. Play Integrity for App Check only works for builds installed from Play. A sideloaded APK will not pass it. See section 4.4.
- **Google sign-in.** The Android OAuth client also needs the package name and a SHA-1 fingerprint. Use the Play app signing SHA-1 for Play installs and the EAS upload SHA-1 for sideloaded APKs. **Verify** the exact console steps.

### 3.3 Backing up credentials

Do this after the first successful build of each platform, and after any rotation.

```sh
cd apps/mobile
eas credentials
# Android -> pick profile -> "credentials.json: Upload/Download credentials between EAS servers and your local json"
#   -> "Download credentials from EAS to credentials.json"
```

Source: [app credentials](https://docs.expo.dev/app-signing/app-credentials/). That gives you the keystore (`.jks`) and its passwords. For iOS the same menu offers the distribution certificate and profile. Then:

1. Put the keystore, passwords, `credentials.json`, the ASC `.p8` and the Google service account JSON in the team password manager or an encrypted vault.
2. Delete the local copies. **Never commit them.** The repo `.gitignore` does not list `credentials.json` or `*.jks`. Add both before running the download.
3. Record in the vault: Apple Team ID, bundle id, ASC key ID and issuer ID, Firebase project number, and the two Android fingerprints.

`eas credentials` can also remove credentials from EAS. That does not delete them at Apple. Revoke or remove them in the Apple Developer console too if you need a fresh set.

## 4. Downloadable test builds

### 4.1 Internal distribution (the "link plus QR" route)

`preview` is the profile. EAS hosts a build page with an install link and a QR code. By default anyone with the URL can open it (a 32-character ID). You can require an Expo sign-in in the project settings. Source: [internal distribution](https://docs.expo.dev/build/internal-distribution/).

```sh
cd apps/mobile
eas build --platform android --profile preview     # APK
eas build --platform ios --profile preview         # ad hoc IPA; asks for Apple login the first time
```

- **Android:** the tester opens the link on the phone, downloads the APK and allows installs from that source. Nothing else is required.
- **iOS:** each tester must have run `eas device:create` first (section 3.1) and be in the provisioning profile. They must also have Developer Mode on for development builds (Settings, Privacy and Security). Whether ad hoc preview builds need it too: **verify**.
- **Adding a device later:** rebuild, or on CI use `--non-interactive --refresh-ad-hoc-provisioning-profile`. That flag reads devices registered on EAS, registers missing ones at Apple and refreshes the profile. It needs an ASC API key either as `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID` or the key already stored in EAS for submit.

**Development builds** use the same mechanics with the `development` profile and are for engineers, not testers. They load JS from `expo start --dev-client`.

```sh
eas build --platform android --profile development
eas build --platform ios --profile development
```

**Android sideloading is getting stricter.** Google is rolling out developer verification for sideloaded apps: Brazil, Indonesia, Singapore and Thailand from 30 September 2026, global from 2027 (reported by [Android Authority](https://www.androidauthority.com/android-sideloading-changes-timeline-3679204/); **verify** the current dates). Testers in those countries may hit extra prompts for APKs. Play internal testing avoids sideloading and works everywhere.

### 4.2 TestFlight

Needs a `production`-style build (`distribution: store`). Source: [TestFlight](https://docs.expo.dev/submit/testflight/).

```sh
cd apps/mobile
eas build --platform ios --profile production --auto-submit
# or build first, then: eas submit --platform ios --latest
```

The build shows in App Store Connect after processing (about 10 to 15 minutes).

| | Internal testing | External testing |
| --- | --- | --- |
| Who | People on your App Store Connect team | Anyone, including by public link |
| Maximum | 100 | 10,000 |
| Beta App Review | No | Yes, on the first build of each app version |
| Needs beta description and feedback email | No | Yes |
| Reaches testers | After processing | After review approval |
| Build expiry | 90 days | 90 days |

For internal testers, add each person in App Store Connect under Users and Access, then add them to an internal group. They need the TestFlight app and an Apple ID.

### 4.3 Google Play testing tracks

First, create the app in Play Console and complete the mandatory setup tasks (app content, store listing). The app stays in draft until you do. Then:

```sh
cd apps/mobile
eas build --platform android --profile production      # AAB
eas submit --platform android --latest                 # internal track, draft release (from eas.json)
```

Per Expo, the default `eas submit` works for a first submission, creating the first release on the internal track. If it fails, upload the first AAB by hand in Play Console and use `eas submit` from the second release. You must have created the app and uploaded a Google service account key first ([Android submit](https://docs.expo.dev/submit/android/)). Setting up the service account:

1. Google Cloud: create a service account, then a JSON key.
2. Play Console, Users and permissions: invite the service account's email and grant release permissions (exact permission names: **verify**).
3. `eas credentials --platform android`, pick `production`, then Google Service Account, Upload a Google Service Account Key.

Tracks:

- **Internal testing.** Up to 100 testers (number: **verify**), no Google review, available within minutes to hours. Testers opt in through a link or email list and install from Play. Use for the team and for any tester who cannot sideload.
- **Closed testing.** Needed for the production-access rule. **New personal accounts must run a closed test with at least 12 testers opted in for 14 continuous days, then apply for production access.** A tester who opts out resets their own 14 days. Google reviews the application, said to take up to seven days. Source: [Google Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465). Plan: start the closed test by 1 February 2027 (from the Phase 8 plan) to leave time for the 14 days, the application and a rejection round before the 15 March launch.
- **Production.** Only after access is granted.

Recruit 15 to 20 people for the closed test, not 12. Dropouts reset the clock.

### 4.4 App Check and test builds

Play Integrity (Android) and App Attest (iOS) attest genuine Play or App Store installs. Builds installed through internal distribution (APK, ad hoc) may not pass. The spec's fallback is the dev token path: the server accepts `dev-ok` only when `APP_CHECK_MODE=dev`. For the staging project, run `APP_CHECK_MODE=dev` and ship preview builds with the dev provider on. That makes identification work but means testers' points are not integrity-checked. Whether App Attest works on ad hoc builds: **verify**. Production builds go through Play and TestFlight, so they get the real providers.

### 4.5 When to use which

| Situation | Use |
| --- | --- |
| Engineers iterating on native code | `development` build |
| First 5 testers today, Android | `preview` APK link |
| First 5 testers today, iPhone, and you can wait for device registration | `preview` ad hoc link |
| Testers on your team who have Apple IDs, no device registration wanted | TestFlight internal (the easier iOS route) |
| Wider beta, testers who are not on your team | TestFlight external or Play closed testing |
| Testers who cannot sideload an APK | Play internal testing |
| Satisfying the Play 12-tester rule | Play closed testing |
| Release candidate for the stores | `production` build to TestFlight and Play internal |

## 5. Store submission

`eas submit` uploads the binary only. It does not set listing text, screenshots or release notes ([Submit introduction](https://docs.expo.dev/submit/introduction/)). Those are filled in by hand in the two consoles. Most of the work in this section is that manual part.

### 5.1 Commands

```sh
cd apps/mobile
eas submit --platform ios --profile production --latest
eas submit --platform android --profile production --latest
# one step, from a build:
eas build --platform all --profile production --auto-submit
```

iOS needs the app record to exist and `ascAppId` set (or the CLI creates the record interactively). Android needs the app created in Play Console and a service account key in EAS. Both listed in sections 3.1 and 4.3.

### 5.2 App Store Connect metadata

Create the app (Apps, plus). Bundle id `app.tendril` must already be registered (EAS registers it on the first build).

- Name, subtitle, description, keywords, support URL, marketing URL (`tendril.app`), privacy policy URL (from the Phase 8 Terms and Privacy pages).
- Screenshots for the required iPhone sizes (the console lists them).
- **Privacy nutrition labels.** Declare every data type the app and its SDKs collect, and whether each is linked to the user and used for tracking. Start from this list and **verify against the code and each SDK's own disclosure** at submission: email address, user id, photos, location (foreground only), purchase history, push token, crash and diagnostic data (Sentry), product usage data (PostHog), device identifiers (App Check). Name the SDKs. `RUNBOOK.md` section 6 carries the final answers.
- **Age rating.** The app is 13+ with an age gate (the onboarding age and under-13 stop screens). Apple's age-rating questionnaire has been revised and gives ratings of 4+, 9+, 13+, 16+ and 18+. **Verify** the current categories and answer the questions honestly. The rating follows from the content, not the gate.
- **Account deletion.** Required. In-app deletion exists (Phase 6) and revokes the Apple credential.
- **Sign in with Apple.** The app offers Google sign-in, so Apple requires Sign in with Apple too. It is in the spec.
- **Export compliance.** Matches `ITSAppUsesNonExemptEncryption` (section 2.5).
- **Review notes.** Give the reviewer:
  - how the 7-day preview works, and that it is granted by the server, not a store purchase (guideline 3.1.1 explanation, with the fallback plan from the Phase 8 plan);
  - a **demo account**;
  - how to sign in.
- **Reviewer sign-in.** Normal sign-in is Apple, Google or a 15-minute email magic link. A reviewer can't open a link sent to our inbox. A build-time flag doesn't help, because the build Apple reviews is the build that ships. The plan (Phase 8 Task 2b) adds a server-side reviewer login:
  - When the email typed on the sign-in screen equals `EXPO_PUBLIC_REVIEW_EMAIL`, the app shows a password field.
  - The `review-login` function signs in that one pre-created account. It works only while the `REVIEW_EMAIL` and `REVIEW_PASSWORD` function secrets are set; otherwise it returns 404.
  - Password sign-in stays disabled for everyone else.
  - Put the email and password in the review notes. Rotate the password after each review, and unset both secrets when no review is pending.
  - Google Play's review uses the same account ("App access" under App content).

### 5.3 Play Console

- Store listing, screenshots, feature graphic, privacy policy URL, and an **account deletion URL** (Google requires one in addition to in-app deletion).
- **App content**, all mandatory before the app can go to production:
  - **Data safety form.** Declare data collected, shared, whether it is encrypted in transit, and whether users can request deletion. Use the same inventory as the Apple labels. **Verify** each SDK's disclosure.
  - **Content rating.** Complete the IARC questionnaire.
  - **Target audience.** Select age groups 13 and over, not under 13, to match the age gate. Choosing children's groups triggers the Families policy. **Verify** the exact options.
  - Ads declaration, news app, government app, financial features, health apps. Answer the ones that apply.
  - Permissions declarations (location, camera). **Verify** which need justification.
- Closed test: see section 4.3. Then "Apply for production" on the dashboard once the 12 testers and 14 days are met.

## 6. Automation

### 6.1 Options and recommendation

| | GitHub Actions calling `eas` | EAS Workflows (`.eas/workflows/*.yml`) |
| --- | --- | --- |
| Where it runs | GitHub runners trigger, EAS builds | EAS infrastructure |
| Secrets | `EXPO_TOKEN` in GitHub | None to store. Uses the project's own credentials |
| Monorepo | Clear: `working-directory: apps/mobile` | Workflow files sit with the app, and the repo-to-app link is set in the dashboard. **Verify** the base-directory behaviour |
| Fits existing CI | Yes, same Actions setup and conventions as `ci.yml` | Separate system |
| Build and submit | `eas build ... --auto-submit` | `build`, `submit` and `testflight` job types, plus fingerprint-based skipping |
| Free plan | Runner minutes are tiny (`--no-wait`) | The plan shows "up to 60 minutes" of workflow time. Check current pricing |

Sources: [EAS Workflows get started](https://docs.expo.dev/eas/workflows/get-started/), [syntax](https://docs.expo.dev/eas/workflows/syntax/), [pre-packaged jobs](https://docs.expo.dev/eas/workflows/pre-packaged-jobs/), [building on CI](https://docs.expo.dev/build/building-on-ci/).

**Recommendation for v1: GitHub Actions.** The repo already runs CI there, the monorepo path is unambiguous, and the pnpm install can be filtered (which EAS does not offer). Revisit EAS Workflows when you want fingerprint-based build skipping or the TestFlight job.

Setup:

1. Create a robot Expo user, add it to the organization with build and submit access, and create a personal access token ([programmatic access](https://docs.expo.dev/accounts/programmatic-access/)).
2. GitHub, Settings, Secrets and variables, Actions: add secret `EXPO_TOKEN`, and variable `EAS_PROJECT_ID`.
3. Store the ASC API key and the Google service account key in EAS (sections 3.1 and 4.3). Nothing else from Apple or Google needs to be in GitHub.
4. Do one iOS build and one Android build by hand first. CI cannot create the first credentials.

### 6.2 Workflow: preview build on push to main

`.github/workflows/mobile-preview.yml`

```yaml
name: Mobile preview build
on:
  push:
    branches: [main]
    paths:
      - 'apps/mobile/**'
      - 'packages/**'
      - 'pnpm-lock.yaml'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: mobile-preview
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      EAS_PROJECT_ID: ${{ vars.EAS_PROJECT_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - name: Install only what the app needs
        run: pnpm install --frozen-lockfile --filter @tendril/mobile...
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - name: Trigger builds (EAS does the work, this job exits)
        working-directory: apps/mobile
        run: |
          eas build --platform android --profile preview --non-interactive --no-wait
          eas build --platform ios --profile preview --non-interactive --no-wait --refresh-ad-hoc-provisioning-profile
```

Notes:

- `--no-wait` exits once the build is queued, so you are not billed runner time while EAS builds. The job passes if queuing succeeds, not if the build does. Source: [building on CI](https://docs.expo.dev/build/building-on-ci/). Watch builds on expo.dev.
- Free plan builds are capped. Two builds per push to `main` will use a free month quickly. The `paths` filter helps. Consider triggering only with `workflow_dispatch` until you are on a paid plan.
- `expo/expo-github-action@v8` is what its README shows. A `v9` tag also exists. **Verify** which is current.
- The `--refresh-ad-hoc-provisioning-profile` line needs the ASC key (section 4.1).
- `pnpm/action-setup@v6` with no version reads `packageManager`, as `ci.yml` does.

### 6.3 Workflow: production build and submit on a tag

`.github/workflows/mobile-release.yml`

```yaml
name: Mobile release
on:
  push:
    tags: ['v*.*.*']

permissions:
  contents: read

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      EAS_PROJECT_ID: ${{ vars.EAS_PROJECT_ID }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile --filter @tendril/mobile...
      - name: Tag must match the app version
        working-directory: apps/mobile
        run: |
          APP_VERSION=$(pnpm exec expo config --type public --json | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).version")
          test "v$APP_VERSION" = "$GITHUB_REF_NAME" || { echo "Tag $GITHUB_REF_NAME does not match app version $APP_VERSION"; exit 1; }
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - name: Build production and hand off to EAS Submit
        working-directory: apps/mobile
        run: eas build --platform all --profile production --non-interactive --no-wait --auto-submit
```

`--auto-submit` uses the submit profile with the same name as the build profile (`production`). iOS goes to TestFlight and Android goes to the internal track as a draft, per `eas.json`. A human then promotes the release in each console. Only tag a commit whose `ci.yml` run is green. This workflow does not re-run the checks.

Cut a release:

```sh
# bump "version" in apps/mobile/app.config.ts, merge to main, then:
git tag v1.0.1 && git push origin v1.0.1
```

### 6.4 The same thing in EAS Workflows

If you choose EAS Workflows instead, the files are `apps/mobile/.eas/workflows/preview.yml` and `release.yml` (location and the GitHub link base directory: **verify**). Link the repo in the project's GitHub settings on expo.dev first.

```yaml
# preview.yml
name: Preview build
on:
  push:
    branches: ['main']
jobs:
  build_android:
    type: build
    params: { platform: android, profile: preview }
  build_ios:
    type: build
    params: { platform: ios, profile: preview, refresh_ad_hoc_provisioning_profile: true }
```

```yaml
# release.yml
name: Release
on:
  push:
    tags: ['v*.*.*']
jobs:
  build_android:
    type: build
    params: { platform: android, profile: production }
  build_ios:
    type: build
    params: { platform: ios, profile: production }
  submit_android:
    needs: [build_android]
    type: submit
    params:
      build_id: ${{ needs.build_android.outputs.build_id }}
      profile: production
  submit_ios:
    needs: [build_ios]
    type: submit
    params:
      build_id: ${{ needs.build_ios.outputs.build_id }}
      profile: production
```

Validate with `eas workflow:validate <file>` and run by hand with `eas workflow:run <file>`. Expo's own tag-based release tutorial adds fingerprint and `get-build` jobs to skip builds when native code has not changed: [tag-based releases](https://docs.expo.dev/tutorial/cicd/tag-based-releases/).

## 7. Versioning and over-the-air updates

### 7.1 Build numbers

With `cli.appVersionSource: remote` and `autoIncrement: true` on `production`, EAS stores and increments `ios.buildNumber` and `android.versionCode` on its servers. Source: [App version management](https://docs.expo.dev/build-reference/app-versions/).

- You set the user-facing `version` (`1.0.0` in `app.config.ts`) by hand when starting a release cycle.
- **With the remote source, build numbers in app config are ignored.** The Phase 8 plan says to read `ios.buildNumber` and `android.versionCode` from env in `app.config.ts`. Drop that. It does nothing and misleads.
- The remote counter starts from the value in app config, or 1. If you ever ship from outside EAS, sync it first: `eas build:version:set`. To get the remote values into a local native build: `eas build:version:sync`.
- `autoIncrement` is set only on `production`, so `preview` builds do not consume store build numbers. Check this does not collide with TestFlight: each upload to App Store Connect needs a higher build number than the last for that version.
- Docs warn that duplicate version numbers are a common cause of store rejection. That is what `autoIncrement` prevents.

### 7.2 Channels

`preview` profile uses channel `preview`. `production` uses channel `production`. A build is bound to one channel, fixed at build time. Source: [EAS Update deployment](https://docs.expo.dev/eas-update/deployment/).

### 7.3 EAS Update and runtime version

One-time: `npx expo install expo-updates`, then `eas update:configure` (it writes `runtimeVersion` and `updates.url`, and the project ID if missing). With the Phase 8 config these already come from `app.config.ts`, so check the result with `npx expo config --type public`.

Publish (from `apps/mobile`). `--environment` is required on SDK 55 and later ([usage](https://docs.expo.dev/eas/environment-variables/usage/)):

```sh
eas update --channel preview --environment preview --message "Fix check-in crash"
eas update --channel production --environment production --message "Fix check-in crash"
```

Runtime version policy: the plan uses `appVersion`. Under it the runtime version equals `version`, so an update only reaches builds with the same `version`. Source: [runtime versions](https://docs.expo.dev/eas-update/runtime-versions/).

The risk: if you add or upgrade a native module and forget to bump `version`, an update that needs the new native code reaches old builds and may crash. Docs offer the `fingerprint` policy as the safer choice, which changes the runtime version whenever anything native changes, at the cost of more builds. **Decision for the team.** Recommendation: keep `appVersion` as planned, and add a rule: any pull request that touches `package.json` native dependencies, `app.config.ts` plugins or `eas.json` bumps `version` in the same PR. Switch to `fingerprint` if that rule slips even once.

Never publish OTA updates that change store-reviewed behaviour. Apple and Google both allow JS and asset updates that keep the app's purpose, but read the current policies before relying on it.

Test an update: install a preview build, publish to `preview`, force-close the app and open it twice. Source: [getting started](https://docs.expo.dev/eas-update/getting-started/).

## 8. Checklists

### 8.1 First test build to 5 testers today

Assumes Phase 8 Task 2 has landed. Android first, because it needs nothing from Apple.

1. Create the Expo organization. `eas login`. `cd apps/mobile`. `eas init --account <org>`.
2. Set `EAS_PROJECT_ID` in `apps/mobile/.env` and as an EAS env var for all three environments (section 2.2).
3. Set the Supabase URL and publishable key in the `preview` environment (section 2.4).
4. `npx expo-doctor` and `npx expo config --type public`. Fix anything they report.
5. `eas build --platform android --profile preview`. Accept the new keystore. Wait for the build, about 10 to 30 minutes, longer on the free queue.
6. Open the build page on expo.dev, copy the install link or QR code, send it to Android testers. They allow installs from that source.
7. For iPhone testers, pick one:
   - **Fast path (team members):** skip to the TestFlight steps in 8.2 and invite them as internal testers.
   - **Ad hoc path:** each tester runs `eas device:create` and follows the URL on the iPhone. Then `eas build --platform ios --profile preview` and sign in to Apple when asked. Send the link. Allow up to 72 hours for newly registered devices.
8. Back up the keystore and iOS credentials (section 3.3).
9. Put the install link and a known-issues list in the tester channel. Say that sign-in uses a magic link, and which inbox it goes to.

### 8.2 First store submission

Do these in order. Items that need waiting come first.

Start early (waiting time):

1. Apple Developer enrolment (section 1.2). Google Play Console account and identity verification.
2. Firebase project, App Check providers, Android push key (`RUNBOOK.md` section 8).

Set up:

3. App Store Connect: create the app record, copy the Apple ID into `submit.production.ios.ascAppId`, create the API key, upload it to EAS (section 3.1).
4. Play Console: create the app, complete store listing and app content (section 5.3), create the service account, upload its key to EAS (section 4.3).
5. Set production values in the `production` EAS environment: production Supabase project, live RevenueCat keys, Sentry and PostHog keys.
6. App config: associated domains, intent filters, Sign in with Apple, push plugin, permission strings (section 2.5).

Build and upload:

7. Bump `version` if this is a new cycle. `eas build --platform all --profile production --auto-submit`. Or tag, section 6.3.
8. Copy both fingerprints into `assetlinks.json` (section 3.2). Check `curl -I https://tendril.app/.well-known/assetlinks.json` and the AASA file return 200 with JSON, with no redirect.
9. TestFlight: add internal testers, smoke-test, then external group if wanted (beta review).
10. Play: promote the internal draft to internal testing, then to closed testing. Recruit 15 to 20 testers, start the 14-day clock (by 1 February 2027 for a 15 March launch). Day 14: Apply for production.

Review:

11. App Store Connect: attach the build to the version, fill privacy labels, age rating, review notes and the demo account (section 5.2), submit for review.
12. Play: after production access, create the production release, roll out staged (for example 20 percent), then widen.

After release:

13. Publish OTA fixes with `eas update --channel production --environment production`, subject to section 7.3.
14. Diary dates: provisioning profile 12 months, distribution certificate expiry, Apple Developer renewal ($99, yearly).

## 9. Costs and limits (check current pricing)

All figures were read on 4 October 2026 from [expo.dev/pricing](https://expo.dev/pricing) and the [billing docs](https://docs.expo.dev/billing/plans/). **Check current pricing** before budgeting.

| Item | Figure | Note |
| --- | --- | --- |
| EAS Free plan | $0, about 15 iOS and 15 Android builds a month, low-priority queue | Queue waits of 90 minutes or more at peak were stated. No overage on the free plan, it stops |
| EAS Starter | $19 a month with $45 of build credit | High-priority queue, pay for more usage |
| EAS Production | $199 a month with $225 of credit | Needed only at scale |
| EAS Update | Free plan: 1,000 monthly active users. Starter: 3,000 | Counted per MAU, relevant at launch |
| EAS Workflows | Free plan: up to 60 minutes of workflow time a month | Only if you use Workflows |
| `large` resource class | Not on the free plan | Faster builds |
| Apple Developer Program | $99 a year | Renew or the app is removed from sale |
| Google Play Console | $25 once | |
| Apple ad hoc devices | 100 iPhones a year | Plus 24 to 72 hours to activate a new device |
| TestFlight | 100 internal, 10,000 external testers; builds expire after 90 days | Upload a fresh build before expiry |
| Apple distribution certificates | 2 per account | |
| Apple push keys | 2 per account | |

A paid EAS plan is likely before launch week, when you will rebuild often. Decide whether the free queue wait is acceptable during the closed test.

## 10. Things to verify before you rely on this guide

1. Whether `eas init` can write the project ID into `app.config.ts` (section 2.2), and whether builds need `EAS_PROJECT_ID` in the CI environment.
2. Whether EAS installs the whole workspace and how slow that is. Measure before optimising (section 2.6).
3. EAS Workflows base directory for `apps/mobile` (section 6.4).
4. Whether Google organisation accounts are exempt from the 12-tester rule (section 1.2).
5. The ASC API key role and the Play service account permissions for submit (sections 3.1, 4.3).
6. Whether App Attest and Developer Mode apply to ad hoc preview builds (sections 4.1, 4.4).
7. Apple's current age-rating categories, Play's target-audience options, and each SDK's privacy disclosure (section 5).
8. The sideloading verification dates (section 4.1).
9. The `expo-github-action` major version (section 6.2).
10. EAS prices and limits (section 9).

If a doc disagrees with this guide, trust the doc and fix the guide. The relevant entry points are [EAS Build](https://docs.expo.dev/build/introduction/), [EAS Submit](https://docs.expo.dev/submit/introduction/), [EAS Update](https://docs.expo.dev/eas-update/introduction/), [EAS Workflows](https://docs.expo.dev/eas/workflows/introduction/) and the [full docs index](https://docs.expo.dev/llms.txt).
