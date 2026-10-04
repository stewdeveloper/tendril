# Phase 1A (design system) — rulings, route table and deferred items

Persisted from the SDD ledger when the phase closed on 2026-10-04. Plan: `docs/superpowers/plans/2026-10-03-phase-1a-design-system.md`. Final review (opus): with fixes; the fix wave was re-reviewed clean. At close: core 52 tests, mobile 317 tests in 26 suites, visual tool 3.

## Rulings

- Ruling: QuotaMeter `card` variant shows "Identifications" / "7 of 10 left" per frame 2e; `bar`/`pill` keep "7 of 10 left this month" — design is the authority; 1B Today test expects the short form — cost if wrong: one label string
- Ruling: FixtureApi uses the fixture's date (2026-10-03) as "today" — deterministic tests and catalog — cost if wrong: none (fixture mode only)
- Ruling: catalog uses static SafeAreaFrameContext/SafeAreaInsetsContext providers instead of SafeAreaProvider initialMetrics — the provider re-measures — cost if wrong: none
- Ruling: no test files under apps/mobile/src/app/ (expo-router bundles every ts/tsx there as a route); route tests live in src/__tests__/routes/ — plans 1A/1B/4/6/7 updated — cost if wrong: none
- Ruling: screens read safe areas with useSafeAreaInsets() (not SafeAreaView) so catalog static insets apply on web — added to plan 1B constraints — cost if wrong: none
- Ruling: after any filtered `pnpm --filter X add`, run a full `pnpm install` (filtered adds prune other workspaces' hoisted node_modules) — add to later dispatches — cost if wrong: none
- Ruling: Sheet split into SheetPanel (in-flow surface) + SheetOverlay (inline scrim+panel absolutely positioned in its parent, no Modal, no animation, for catalog frames under the chrome) + Sheet (Modal+animation wrapping SheetPanel); Phase 1B sheet frames use SheetOverlay — so catalog captures keep chrome above the scrim and don't race the slide — cost if wrong: one extra component
- Ruling: keep useInsets (zeros without provider) — a global safe-area jest mock would break CatalogFrame's static-inset test — cost if wrong: silent zero insets if a provider is ever missing (root layout always mounts one)
- Ruling: enforce deep lucide imports with no-restricted-imports (root barrel pulls ~1,500 icons on native) — cost if wrong: none
- Ruling: StreakCounter winter-mode spoken label "Winter mode is on." is provisional copy (UX doc has none; rules still open) — list in final "Rulings I made" — cost if wrong: one string
- Ruling: frame 2d's compact pet rows → Phase 1B adds PetCheckCard variant='compact' when building 2d (no avatar, kind caption or match footer) — cost if wrong: none
- Ruling: PetCheckCard source link — link sourceName in place where the core line already names it (no appended "Source:"); severe rows keep "Call your vet now." last, with the source as its own link line below; unknown rows get no source; plain text when onSourcePress is absent — sanctioned copy is core's, verbatim — cost if wrong: none
- Ruling: inline source link is exempt from the 44 pt rule (WCAG 2.5.8 inline exemption; RN nested Text has no hitSlop) — applies to later tasks — cost if wrong: small-target complaint
- Ruling: StreakCounter spoken label drops the last_day/freeze_used sentence (screens render it visibly; avoids double announcement) — cost if wrong: none
- Ruling: CheckInSheet presentation 'modal'|'overlay'|'inline' (5g inline, 1B 4c/4d/4e overlay); 5p uses SheetPanel in flow; component-sheet pages that can't fit 852 pt get a continuation frame <id>-2 — cost if wrong: none
- Ruling: where a design frame and the brief disagree on a pixel value, the frame wins (task photo 52 pt, missing-tile solid ring/40 pt glyph, plan tag Inter 500) — frames are the design truth — cost if wrong: none
- Ruling: PlantCard/TaskRow take optional `today` (device date default); Phase 1B screens pass the fixture date 2026-10-03 — cost if wrong: none
- Ruling: v1 dates render in fixed English ("20 Aug", "Monday") — spec copy is English-only — cost if wrong: locale work later
- Ruling: core PlantSummary gains statusOn: IsoDate | null (moved up from PlantDetail); fixtures set it; 2B mapper reads plants.status_at — cost if wrong: none
- Ruling: PlantCard variant 'card' (component sheet 5e, UX table) | 'row' (frame 4i: inside RowsCard, padding 12/16, no lead, nickname Inter 400 17, species non-italic); My Plants (1B) uses 'row'; ok plants due tomorrow read "Tomorrow" (4i) — frame wins for the screen — cost if wrong: one variant
- Ruling: add core copy streakContinues(days); CheckInSheet nextCheckWeekday required for answered_no/saved_offline (discriminated union), invented "check again soon" fallback removed — cost if wrong: none
- Ruling: sensitive Plantdex tiles hide the rarity badge (4aj) — cost if wrong: one line
- Ruling: shared src/screens/PlaceholderScreen used by placeholder routes — Phase 1B replaces each placeholder — cost if wrong: none
- Ruling (cross-plan, 1B): add useIdentify() mutation hook that invalidates quota and scan keys — cost if wrong: none
- Ruling: TabBar outer container 118 pt (28 transparent + 90 surface bar) so the raised circle is inside its parent; screens' bottom padding uses the 90 pt bar height; drop global `types` from mobile tsconfig — node types via /// <reference types="node" /> in the fs-reading route tests — cost if wrong: none
- Ruling: tab bar height 56 + bottom inset (90 on iPhone 16/catalog), labels maxFontSizeMultiplier 1.3 — layout-critical labels per spec §6.2 — cost if wrong: none
- Ruling: PetCheckCard row wraps (chip drops below name) at large text; not-sure match forces Unknown chips (frame 2c, safety); none-without-source reads Unknown — cost if wrong: none
- Ruling: auth/callback unguarded like catalog — PKCE landing happens signed_out — cost if wrong: none
- Ruling: PetCheckCard onPetAte(petId); one pet calls through; several pets show an inline "Which pet?" chooser of pet-name buttons under the button — cost if wrong: one component change in 1B
- Ruling: core indefiniteArticle(name) (a/an by first letter) + midSentenceName(name) (lower-cases the first letter unless the first word is a proper adjective in an exported list: Easter, Swiss, English, African, Boston, Christmas, Irish, Chinese, Japanese, Persian, Venus, Moses) used by result lines and emergency copy — cost if wrong: occasional casing slip on server names
- Ruling: routes follow frames — screens whose frames show the tab bar live under (tabs) with per-tab nested Stacks; screens without it in the root stack; implementer produces a route→frame table, controller updates plan 1B — cost if wrong: route moves in 1B
- Ruling: fold minors — next-check weekday only 2–6 days ahead else "d Mon"; snackbar offset relative to in-flow layout + catalog TabScreenFrame helper; hooks useHouseholds/useIdentify/useSavePets/useSetPlantStatus/useDiagnose/useApplyDiagnosis/useSendFriendRequest/useDeleteAccount with invalidation; sendFriendRequest doesn't add a board row; trim blank pet names in FixtureApi; web age block via localStorage; skip-onboarding only when __DEV__ or fixture mode; core shadow token; avatars cap font scale 1.3; registerFrame throws on duplicate in dev; core copy pointsPendingReview + taskDueTitle; Button 'ink' variant; RowsCard icon lead; PlanCard price wraps at AX; hooks.test title; eslint-disable for the jest.mock require — cost if wrong: none
- Ruling: fixture data in release bundles and edge core bundle → Phase 8 with the catalog alias (same resolver mechanism) — cost if wrong: a few KB shipped

## Route table

Screens whose design frames show the tab bar live under `(tabs)`. Everything else is in the root stack.

| Route file | Frames | Tab bar | Placement |
|---|---|---|---|
| (onboarding)/welcome | 3a | no | onboarding stack |
| (onboarding)/age | 3b | no | onboarding stack |
| (onboarding)/age-stop | 3c | no | onboarding stack |
| (onboarding)/sign-in | 3d | no | onboarding stack |
| (onboarding)/link-sent | 3e | no | onboarding stack |
| (onboarding)/link-expired | 3f | no | onboarding stack |
| (onboarding)/pets | 3g, 3h | no | onboarding stack |
| (onboarding)/home-area | 3i, 3j | no | onboarding stack |
| (onboarding)/first-scan | 3k | no | onboarding stack |
| (tabs)/today/index | 2e, 4a, 4b, 4c, 4d, 4e, 6e | yes | tab (unchanged) |
| today/streaks (was (tabs)/today/streaks) | 4f, 4g, 4h | no | MOVED to root stack, same URL |
| (tabs)/plants/index | 4i, 4j | yes | tab, now inside the nested plants Stack |
| (tabs)/plants/[id]/index (was plants/[id]/index) | 2d, 6d yes; 4k, 4l no | mostly yes | MOVED under tabs; same URL. 4k/4l (given away, dead) draw no bar: 1B must decide how to hide it for those states |
| plants/[id]/diagnosis | 4q, 4r, 4s | no | root stack (unchanged) |
| plants/setup | 4m, 4n | no | root stack |
| l/[code] | 4o, 4p | no | root stack |
| (tabs)/scan | 4af, 4ag (limit sheet over the Scan tab) | yes | tab |
| (tabs)/collection/index | 2f, 4ah, 4ak, 4am, 4an, 4ao, 4ap, 6f | yes | tab |
| collection/species/[id] | 4ai, 4aj | no | root stack |
| collection/sets/[id]/complete | 4al | no | root stack |
| (tabs)/leagues/index | 4aq, 4ar, 4as, 4at | yes | tab |
| leagues/add-friends | 4au, 4av | no | root stack |
| leagues/week-results | 4aw, 4ax | no | root stack |
| camera | 2b, 4t, 4u | no | root stack |
| scan/[id]/index | 2a, 2c, 4v, 4w, 4x, 4y, 4z, 4aa, 6a, 6c | no | root stack |
| scan/[id]/new-species | 4ab, 4ac, 4ad, 4ae | no | root stack |
| paywall | 2g, 4be, 4bf, 4bg, 6g | no | root stack |
| pet-emergency | 4bh, 4bi | no | root stack |
| profile/index, profile/public | 4ay, 4az | no | root stack |
| settings/index | 4ba, 4bb | no | root stack |
| settings/household | 4bc, 4bd | no | root stack |
| settings/delete-account | 4bj, 4bk | no | root stack |
| settings/account, home-area, notifications | none | n/a | root stack (reached from Settings, no bar to match) |
| auth/callback | none | n/a | unguarded root route |

## Deferred and carried items

- Task 1: minor (deferred): colors.danger duplicates verdictColors.severe literal (could derive); petCheckLine assumes curated summary ends with a full stop
- Task 2: minor (deferred): limitReachedLine premium+diagnosis branch untested; Spidey nextCheckOn 10-02 (overdue) vs today.nextCheck 10-04 and frame 4i "Tomorrow" — 1B uses the brief/2e (overdue); empty toxicity arrays rely on per-pet Unknown fallback in UI (PetCheckCard does this)
- Task 3: minor (deferred): unknown-frame screen forces light scheme; catalogEnabled redirect untested; scroll wrapper unverified visually (Task 4 visual tool will exercise it)
- Task 4: minor (deferred): paths.ts duplicated in compare.ts; unregistered-frame detection by 4s timeout (pass ids); compareImages crops silently on size mismatch (should warn); 4 baselines have transparent corner pixels; design/compare/app never cleaned
- Task 5: minor (deferred): DeviceChrome.tsx Inter literal; Sheet cap uses window height (catalog overlay capped to browser window); Sheet closes without slide-out; Spinner ignores Reduce Motion; RowsCard static rows not grouped for screen readers; testTimeout 30s global (cold Animated transform)
- Task 6: minor (deferred): PetCheckCard footer always tint even for not-sure band; calendar day labels carry no date; domain1.extra.test could merge into domain1.test; heart-pulse icon for diagnosis quota invented
- Task 7: minor (carry to 1B/8): catalog frames ship in production bundles (routes import frames statically) — lazy-require behind catalogEnabled before 1B's ~100 frames land; CheckInSheet double-press latch requires parent to advance state; accessibilityLiveRegion Android-only; Button.previewPressed is a catalog-only public prop
- Task 7: minor (deferred): sensitive-tile test asserts a vacuous Digitalis name; row right-text maxWidth 40% vs frame flex 0 0 auto; CheckInSheet weekday required only at type level
- Carry to Phase 8: catalog frames are statically imported by catalog routes, so they ship in production bundles — exclude via a Metro resolver alias (empty module) when EXPO_PUBLIC_CATALOG !== '1' in release builds
- Task 8: minor (carry to Phase 8 device QA): Android Scan hit area and in-flow tab bar unverified on device; BottomTabBarHeightContext reports default height (custom bar never reports its 90 pt)
