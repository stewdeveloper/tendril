# Phase 1B: Every Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All 88 design frames (2a–2g, 3a–3k, 4a–4bk, 6a–6g) exist as real screens on the fixture API, reachable through real navigation. Each one is registered in the dev catalog and checked side by side against its design render.

**Architecture:**
- **Screens:** each one is a presentational component in `apps/mobile/src/screens/<area>/`. It takes a view model plus callbacks, and never touches the router or the API.
- **Route containers:** `apps/mobile/src/app/...` (created as placeholders in Phase 1A) map `useApi` hooks to screen props and wire up navigation.
- **Catalog:** each area has a file `src/catalog/frames/<area>.tsx` that registers every design frame id with fixture props, and `src/catalog/frames.ts` imports them all.
- **Visual check:** `pnpm visual:app <ids> && pnpm visual:compare <ids>` produces design | app | diff panels, which the implementer reads and corrects against.

**Tech Stack:** As Phase 1A, plus `react-native-maps` (native) with a web stub, `expo-camera`, `expo-image-picker`, `expo-location`, `expo-linking` and `react-native-reanimated` (already installed).

**Spec:** `docs/superpowers/specs/2026-10-03-tendril-v1-design.md` (§6.2 design system, §6.3 routes and frame map, precedence rules). Builds on `docs/superpowers/plans/2026-10-03-phase-1a-design-system.md`, which supplies the components, `TendrilApi`, `FixtureApi`, hooks, `SessionProvider`, catalog and visual tool.

## Global Constraints

- Every Global Constraint of Phase 1A applies: tokens, type, shape, motion, copy and accessibility, `npx expo install`, async RNTL `render` and `fireEvent` (always awaited), ESLint pinned to 9.x, and no test files under `src/app/` (route tests go in `src/__tests__/routes/`).
- **Where pixel values come from:** `design/frames/<id>.html` is the source for spacing, sizes, radii, fonts and colours. Use the Phase 1A components wherever they fit, and don't restyle them per screen.
- **Precedence (spec §6.3):**
  - Where a 4-series frame and a hero or onboarding frame show the same screen, the hero frame sets the layout and the 4-series frame sets the state's content.
  - Where a 4-series frame uses a plain row list for something the component sheet defines (plant card, task row, league row, Plantdex tile, plan card), use the component.
- **Screens take props only.** Containers call hooks and the router. Catalog entries pass fixture props built from `aoife` (from `@tendril/core`) plus each frame's exact text.
- **Every frame id gets a catalog entry.**
  - Hero and photo-led frames set `statusBar: 'light'`.
  - Dark-mode frames 6a–6g reuse the 2a–2g props with `scheme: 'dark'`.
  - Where the design shows a placeholder photo, use `PhotoSlot` with the design's placeholder label (e.g. "Your photo: peace lily"), so both panels show placeholders.
- **Visual acceptance for every frame:** run `pnpm visual:app <ids> && pnpm visual:compare <ids>`, open each `design/compare/<id>.png` with the Read tool, and fix any differences in layout, spacing, type, colour, copy or order. The only acceptable differences are:
  - placeholder art
  - anti-aliasing
  - text-wrap differences of one word or less
  - the precedence substitutions above

  Record each frame's diff % and a one-line verdict in the report.
- Text never sits on a photo without the scrim. Scientific names are always italic. Never write "safe".
- Add Expo-side packages only with `npx expo install` inside `apps/mobile`.

## Review Focus

1. **The age gate at the 13th birthday month.** With month-level precision, someone born in the current month 13 years ago may still be 12. The rule is conservative: allow only when the birth month and year is strictly earlier than the same month 13 years ago. Tested in Task 1.
2. **Answering a check-in twice.** A double tap must not create two watering tasks or two events. Use the fixture API's `clientId` idempotency and disable the answer buttons while pending. Tested in Task 2.
3. **Starting a scan at the identification cap.** It must open the Limit reached sheet before the camera and make no `identify` call. Free and Premium at their caps get different copy. Tested in Task 5.
4. **A sensitive species on the species card and the finds map.** It never shows a map link or a pin, and it shows the privacy note. Tested in Task 8.
5. **The paywall's price hierarchy.** The billed amount is the largest price text, any "Best value" tag is smaller, and the close button is visible from the start. Tested in Task 11.

---

### Task 1: Onboarding (3a–3k)

**Files:**
- Create:
  - `apps/mobile/src/screens/onboarding/`: `WelcomeScreen.tsx`, `AgeScreen.tsx`, `AgeStopScreen.tsx`, `SignInScreen.tsx`, `LinkSentScreen.tsx`, `LinkExpiredScreen.tsx`, `PetsScreen.tsx`, `HomeAreaScreen.tsx`, `FirstScanScreen.tsx`
  - `apps/mobile/src/screens/onboarding/OnboardingProgress.tsx`
  - `apps/mobile/src/components/MonthYearWheel.tsx`
  - `apps/mobile/src/components/HomeAreaMap.tsx`
  - `apps/mobile/src/components/HomeAreaMap.web.tsx`
  - `apps/mobile/src/catalog/frames/onboarding.tsx`
  - `packages/core/src/age.ts`
- Modify: every route in `apps/mobile/src/app/(onboarding)/`, and `apps/mobile/src/catalog/frames.ts`
- Test:
  - `packages/core/src/age.test.ts`
  - `apps/mobile/src/screens/onboarding/onboarding.test.tsx`

**Interfaces:**
- Consumes:
  - `useSession()`: `signIn`, `blockForAge`, `completeOnboarding`
  - `useApi().savePets`
  - Phase 1A components: `Button`, `Note`, `TextField`, `OptionPills`, `PermissionPrimer`, `TendrilDrawing`, `BackBar`
- Produces:
  - `isAtLeast13(birth: { year: number; month: number }, today: { year: number; month: number }): boolean`, from core, with conservative month precision
  - `OnboardingProgress({ step: 1 | 2 | 3 | 4 | 5; onBack?; right?: ReactNode })`: the back chevron plus five 4-high segments (`3b.html`)
  - the route flow welcome → age → (age-stop | sign-in) → link-sent → pets → home-area → first-scan → `/camera`, each step calling the session

**Frames:**

| Frame | Screen and state | Source text |
| --- | --- | --- |
| 3a | Welcome | `design/frames/3a.html`. Full-bleed photo (PhotoSlot, dark placeholder). Bottom card, always in dark tokens: "Tendril", the value line, "Get started" (primary), "Scan your plant label" (secondary, QR icon) |
| 3b | Age | "When were you born?" / "Month and year are enough.", a month and year wheel with September 1998 selected, Continue. Never mentions the age limit |
| 3c | Age stop | Tendril drawing, "Thanks for telling us", "You can't create a Tendril account right now. We haven't kept your date of birth." No back button, no actions |
| 3d | Sign in | "Save your plants" / "Sign in so your plants and finds follow you to a new phone.", Continue with Apple (black), Continue with Google, "or use email", Email field (placeholder you@example.com), "Email me a sign-in link", terms line |
| 3e | Link sent | "Check your email" / "We sent a sign-in link to aoife@example.com. Open it on this phone within 15 minutes." / Open Mail / Send it again |
| 3f | Link expired | "This link has expired" / "Sign-in links work once, for 15 minutes. We can send a fresh one to aoife@example.com." / Send a new link / Use a different email |
| 3g | Pets, cat and dog picked | A 2×2 grid of tiles (Cat, Dog, Other, None) with a tint and a check when selected; "Names (optional)" fields prefixed Cat/Miso and Dog/Bran; "+ Add another dog"; Continue |
| 3h | Pets, none | "None" selected, with the Note "No pet checks for now. Add a pet any time in Settings and every plant gets checked." |
| 3i | Home area | Skip (top right), "Where's home?", town search field, map card with the area circle and a drag handle, lock line `copy.homeArea`, "Save area". No location prompt |
| 3j | Town not found | The search reads "Ballynahinchh", with an error row "We couldn't find that town" / "Check the spelling, or move the area on the map instead." |
| 3k | First scan | Camera icon in a circle, "Your first scan", three icon lines, dark Note "Home area skipped. We'll ask again before your first public find.", "Allow camera", "Not now" |

- [ ] **Step 1: Write the failing tests**

`packages/core/src/age.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isAtLeast13 } from './age.ts';

const today = { year: 2026, month: 10 };
describe('isAtLeast13', () => {
  it('allows anyone clearly 13 or over', () => {
    expect(isAtLeast13({ year: 1998, month: 9 }, today)).toBe(true);
    expect(isAtLeast13({ year: 2013, month: 9 }, today)).toBe(true);
  });
  it('blocks the 13th-birthday month because they may still be 12', () => {
    expect(isAtLeast13({ year: 2013, month: 10 }, today)).toBe(false);
  });
  it('blocks anyone younger', () => {
    expect(isAtLeast13({ year: 2013, month: 11 }, today)).toBe(false);
    expect(isAtLeast13({ year: 2020, month: 1 }, today)).toBe(false);
  });
  it('rejects impossible input as not old enough', () => {
    expect(isAtLeast13({ year: 2030, month: 1 }, today)).toBe(false);
    expect(isAtLeast13({ year: 1998, month: 13 }, today)).toBe(false);
  });
});
```

`apps/mobile/src/screens/onboarding/onboarding.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { AgeScreen } from './AgeScreen';
import { AgeStopScreen } from './AgeStopScreen';
import { PetsScreen } from './PetsScreen';
import { SignInScreen } from './SignInScreen';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

describe('onboarding', () => {
  it('age screen never mentions the limit and submits month and year', async () => {
    const onContinue = jest.fn();
    await wrap(<AgeScreen initial={{ year: 1998, month: 9 }} onContinue={onContinue} onBack={() => {}} />);
    expect(screen.queryByText(/13|under|old enough|limit/i)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledWith({ year: 1998, month: 9 });
  });
  it('age stop has no way back', async () => {
    await wrap(<AgeStopScreen />);
    expect(screen.getByText('Thanks for telling us')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('sign in offers Apple, Google and an email link', async () => {
    const onApple = jest.fn();
    const onEmail = jest.fn();
    await wrap(<SignInScreen showApple onApple={onApple} onGoogle={() => {}} onEmail={onEmail} onBack={() => {}} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Apple' }));
    expect(onApple).toHaveBeenCalled();
    await fireEvent.changeText(screen.getByPlaceholderText('you@example.com'), 'aoife@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a sign-in link' }));
    expect(onEmail).toHaveBeenCalledWith('aoife@example.com');
  });
  it('pets: picking None clears others and shows the note', async () => {
    const onContinue = jest.fn();
    await wrap(<PetsScreen initial={[{ animal: 'cat', name: 'Miso' }]} onContinue={onContinue} onBack={() => {}} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'None' }));
    expect(screen.getByText('No pet checks for now. Add a pet any time in Settings and every plant gets checked.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledWith([]);
  });
  it('pets: names are optional and empty names save as null', async () => {
    const onContinue = jest.fn();
    await wrap(<PetsScreen initial={[{ animal: 'dog', name: '' }]} onContinue={onContinue} onBack={() => {}} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalledWith([{ animal: 'dog', name: null }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/core test -- age && pnpm --filter @tendril/mobile test -- onboarding`
Expected: FAIL, because the modules don't exist yet.

- [ ] **Step 3: Implement**

`packages/core/src/age.ts`:
```ts
/**
 * COPPA gate with month precision. Someone born in the current month 13 years ago may still be 12,
 * so only birth months strictly before that count as 13 or over. Only the boolean is ever stored.
 */
export function isAtLeast13(birth: { year: number; month: number }, today: { year: number; month: number }): boolean {
  if (birth.month < 1 || birth.month > 12) return false;
  const birthIndex = birth.year * 12 + (birth.month - 1);
  const cutoff = (today.year - 13) * 12 + (today.month - 1);
  return birthIndex < cutoff;
}
```

Export it from `packages/core/src/index.ts`.

**Screens:** implement each to its frame. Then:
- `MonthYearWheel`: two columns (months, then years from 1920 to the current year) in a surface card. The selected row is highlighted with `primaryTint`, and neighbouring rows fade, as in `3b.html`. Use scrollable `FlatList`s with snapping. For accessibility, each column is an `adjustable` element whose `accessibilityValue` is the selected month or year.
- `HomeAreaMap`:
  - **native:** react-native-maps' `MapView` with a `Circle` (radius state, default 2 km), a centre `Marker`, and a draggable edge handle that changes the radius.
  - **web:** the `PhotoSlot`-style placeholder with "Map tiles" and the circle drawn over it, matching `3i.html`.
  - Install with `npx expo install react-native-maps`.

**Containers:**
- `age`: on Continue, call `isAtLeast13` against today's date. If false, call `session.blockForAge()` and replace the route with `/age-stop`. If `session.ageBlocked` is already true when onboarding mounts, go straight to `age-stop`.
- `sign-in`:
  - Apple: shown only on iOS, or always in the catalog.
  - Email: shows `link-sent` with the address.
  - Fixture sign-in completes after `link-sent`'s "Open Mail" in dev.
- `pets` saves through `useApi().savePets`.
- `home-area`: Skip goes to `first-scan` with the skipped note visible. Save goes to `first-scan` without the note.
- `first-scan`: "Allow camera" calls `session.completeOnboarding()` and pushes `/camera`. "Not now" calls `completeOnboarding()` and goes to `/today`.

Register frames 3a–3k in `catalog/frames/onboarding.tsx`.

- [ ] **Step 4: Run the tests and the visual check**

Run: `pnpm --filter @tendril/core test && pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck && pnpm visual:app 3a 3b 3c 3d 3e 3f 3g 3h 3i 3j 3k && pnpm visual:compare 3a 3b 3c 3d 3e 3f 3g 3h 3i 3j 3k`
Expected: the tests pass. Then read every `design/compare/3*.png` and fix differences, as the Global Constraints describe.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src apps/mobile
git commit -m "feat(mobile): onboarding screens with conservative age gate (3a-3k)"
```

---

### Task 2: Today, check-in and streaks (2e, 4a–4h)

**Files:**
- Create:
  - `apps/mobile/src/screens/today/TodayScreen.tsx`
  - `apps/mobile/src/screens/today/StreaksScreen.tsx`
  - `apps/mobile/src/catalog/frames/today.tsx`
- Modify: `apps/mobile/src/app/(tabs)/today/index.tsx`, `apps/mobile/src/app/(tabs)/today/streaks.tsx`, `apps/mobile/src/catalog/frames.ts`
- Test: `apps/mobile/src/screens/today/today.test.tsx`

**Interfaces:**
- Consumes:
  - `useToday`, `useStreaks`, `useCheckIn` (Phase 1A Task 8)
  - `TaskRow`, `StreakCounter`, `StreakCalendar`, `QuotaMeter`, `CheckInSheet`, `EmptyState`, `Note`, `RowsCard`, `ScreenHeader` and `BackBar`
  - `streakLastDay` and `freezeUsed` from core
- Produces:
  - `TodayScreen({ summary: TodaySummary; checkIn: { taskId: string; state: CheckInSheet['state']; nextCheckWeekday?: string; streakDays?: number } | null; onOpenTask(taskId); onAnswer(dry, leaves); onCloseCheckIn(); onScan(); onScanLabel(); onOpenStreaks(); onOpenLeague(); onAvatar() })`
  - `StreaksScreen({ streak: StreakSummary; onBack(); onInvite(); onCheckInFirst(); onToggleWinter?(on: boolean) })`

**Frames:**

| Frame | State | Content |
| --- | --- | --- |
| 2e | Tasks due | Layout from `2e.html`: header "Today" with "Saturday 3 October" and the avatar; two streak tiles; the line `streakLastDay(12)` with "1 freeze held"; "Due today"; a task card (Monty due, with an inline "Check in"; Spidey overdue, with a chevron; Lily done, struck through); League tile ("4th of 20", "340 points · 3 days left"); Identifications tile ("7 of 10 left" with a bar) |
| 4a | No plants yet | Header, `QuotaMeter variant="bar"`, EmptyState "Add your first plant and we'll tell you when to check its soil.", "Scan a plant", "Scan your plant label" (secondary) |
| 4b | All done today | 2e layout; tasks all done; Note "All done for today. Next check: Spidey, tomorrow."; League and Identifications tiles |
| 4c | Check-in sheet, unanswered | 2e behind the scrim, `CheckInSheet` state `unanswered` for Monty |
| 4d | Check-in sheet, answered No | `answered_no`, Friday, 12 days |
| 4e | Check-in sheet, offline | `saved_offline` |
| 4f | Streaks | BackBar "Today"; title "Streaks"; `StreakCounter` stat 12; calendar with the last 12 checked; rows Discovery streak (3 weeks, in the streak colour), Freezes (1 held), Winter mode (Off); "Invite a friend to earn a freeze" (secondary) |
| 4g | Freeze used | Calendar with a freeze on day 12 of 13; Note `freezeUsed(12)`; Freezes row "0 held" with "Invite a friend to earn another" |
| 4h | Broken, without blame | Grey stat 0; grey calendar; body "Your last streak ran 16 days. Any check-in starts a new one."; "Check in on Monty" |

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/screens/today/today.test.tsx`:
```tsx
import { aoife } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { StreaksScreen } from './StreaksScreen';
import { TodayScreen } from './TodayScreen';

const noop = () => {};
const handlers = { onOpenTask: noop, onAnswer: noop, onCloseCheckIn: noop, onScan: noop, onScanLabel: noop, onOpenStreaks: noop, onOpenLeague: noop, onAvatar: noop };
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

describe('TodayScreen', () => {
  it('shows tasks, both streaks, league rank and identifications left', async () => {
    await wrap(<TodayScreen summary={aoife.today} checkIn={null} {...handlers} />);
    expect(screen.getByText('Your 12-day streak needs one check-in today.')).toBeTruthy();
    expect(screen.getByText("Time to check Monty's soil.")).toBeTruthy();
    expect(screen.getByText('4th of 20')).toBeTruthy();
    expect(screen.getByText('7 of 10 left')).toBeTruthy();
  });
  it('empty state offers both scan routes', async () => {
    const summary = { ...aoife.today, hasPlants: false, tasks: [] };
    const onScanLabel = jest.fn();
    await wrap(<TodayScreen summary={summary} checkIn={null} {...handlers} onScanLabel={onScanLabel} />);
    expect(screen.getByText("Add your first plant and we'll tell you when to check its soil.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Scan your plant label' }));
    expect(onScanLabel).toHaveBeenCalled();
  });
  it('answer buttons are disabled while an answer is pending (no double check-ins)', async () => {
    const onAnswer = jest.fn();
    await wrap(<TodayScreen summary={aoife.today} checkIn={{ taskId: 't-monty', state: 'unanswered' }} {...handlers} onAnswer={onAnswer} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, dry' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, dry' }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });
});

describe('StreaksScreen', () => {
  it('broken streak is grey and blame-free', async () => {
    const streak = { ...aoife.today.streak, careDays: 0, careState: 'broken' as const, lastBrokenLength: 16 };
    await wrap(<StreaksScreen streak={streak} onBack={noop} onInvite={noop} onCheckInFirst={noop} />);
    expect(screen.getByText('Your last streak ran 16 days. Any check-in starts a new one.')).toBeTruthy();
    expect(screen.queryByText(/lost|failed|missed out/i)).toBeNull();
  });
});
```

The double-press guard lives in `CheckInSheet` or `TodayScreen`: after the first answer, the answer tiles become disabled until the `state` prop changes away from `unanswered`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/mobile test -- today`
Expected: FAIL, because the screens don't exist yet.

- [ ] **Step 3: Implement the screens, containers and catalog entries**

- The `today` container keeps the check-in sheet state and calls `useCheckIn` with `clientId = Crypto.randomUUID()`, created once per opened sheet so retries reuse it.
- On success it shows `answered_no` or `answered_yes`, or `saved_offline` when the result says `savedOffline`.

Register 2e and 4a–4h. For 4c–4e, use the Today screen behind the sheet with fixture props.

- [ ] **Step 4: Run the tests and the visual check**

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck && pnpm visual:app 2e 4a 4b 4c 4d 4e 4f 4g 4h && pnpm visual:compare 2e 4a 4b 4c 4d 4e 4f 4g 4h`
Expected: the tests pass. Read every panel and fix differences.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): Today, check-in sheet and streak screens (2e, 4a-4h)"
```

---

### Task 3: My Plants, plant detail, setup and label adoption (2d, 4i–4p)

**Files:**
- Create in `apps/mobile/src/screens/plants/`: `MyPlantsScreen.tsx`, `PlantDetailScreen.tsx`, `PlantSetupScreen.tsx`, `LabelAdoptionScreen.tsx`
- Create: `apps/mobile/src/catalog/frames/plants.tsx`
- Modify: `apps/mobile/src/app/(tabs)/plants/index.tsx`, `apps/mobile/src/app/plants/[id]/index.tsx`, `apps/mobile/src/app/plants/setup.tsx`, `apps/mobile/src/app/l/[code].tsx`, `apps/mobile/src/catalog/frames.ts`
- Test: `apps/mobile/src/screens/plants/plants.test.tsx`

**Interfaces:**
- Consumes:
  - `usePlants`, `usePlant`, `useHousehold`, `useLabel`, `useAddPlant`
  - `PlantCard`, `SegmentedControl`, `HeroHeader`, `PetCheckCard`, `ConfidenceLabel`, `RowsCard`, `OptionPills`, `TextField` and `EmptyState`
- Produces:
  - `MyPlantsScreen({ households: { id; name }[]; householdId; plants: PlantSummary[]; onSwitch(id); onOpen(id); onAdd(); onScan(); onScanLabel(); onAvatar() })`. It groups by room in the order the rooms first appear.
  - `PlantDetailScreen({ plant: PlantDetail; pets: Pet[]; onBack(); onMore(); onCheckIn(); onPetAte(petId); onDiagnose() })`
  - `PlantSetupScreen({ speciesName; initial: PlantSetup; onSave(setup); onCancel() })`
  - `LabelAdoptionScreen({ label: LabelInfo | null; pets: Pet[]; onAdd(); onScanPlant(); onBack(); onPetAte(petId) })`

**Frames:**

| Frame | State | Content |
| --- | --- | --- |
| 4i | By room, household switcher | Header "My Plants"; segmented "Our flat" / "Mam’s house"; room headings Living room, Kitchen, Bedroom with a `PlantCard` for each plant; "Add a plant" |
| 4j | Empty | EmptyState "No plants yet. Scan one, or scan the label it came with."; "Scan a plant"; "Scan a plant label" (secondary) |
| 2d | Monty, pet check unknown | Layout from `2d.html`:<br>- hero photo with back and "…" buttons<br>- "Monty"; "Swiss cheese plant · *Monstera deliciosa*"<br>- room pill "Living room" and `ConfidenceLabel` 0.96<br>- next-check card "Next soil check / Today" with "Check in"<br>- "Care plan" rows with icons<br>- `PetCheckCard` with Unknown for both pets<br>- "History" rows<br>- tab bar visible |
| 4k | Given away | Hero photo at 0.55 opacity; "Lily"; "Peace lily · Spathiphyllum"; Note "Given away on 12 September. Kept in your history."; History rows |
| 4l | Dead | "Fern"; "Boston fern · Nephrolepis exaltata"; Note "Marked as died on 20 August: too dry. We use this to give better advice."; History |
| 4m | Add plant setup | BackBar "Cancel"; title "Set up Lily"; Nickname field; "Light in the room" pills (Medium selected); "Pot" pills (Plastic selected); "Drains at the bottom?" pills (Yes selected); Save |
| 4n | "Not sure" answers | All three groups on "Not sure"; Note "Not sure is fine. We'll start with the species' basic schedule and you can change it later." |
| 4o | Label adoption | Hero "Grower photo: peace lily"; "Peace lily"; *Spathiphyllum*; "From the label · Greenhouse Growers"; verdict chips Cats and Dogs Moderate with the line; care rows; "Add to my plants"; "No identification used." |
| 4p | Unknown or retired code | BackBar "Back"; EmptyState "We don't know this label. The code may be retired."; body "You can still scan the plant itself."; "Scan the plant" |

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/screens/plants/plants.test.tsx`:
```tsx
import { aoife } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { LabelAdoptionScreen } from './LabelAdoptionScreen';
import { MyPlantsScreen } from './MyPlantsScreen';
import { PlantDetailScreen } from './PlantDetailScreen';
import { PlantSetupScreen } from './PlantSetupScreen';

const noop = () => {};
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

describe('plants screens', () => {
  it('groups plants by room', async () => {
    await wrap(<MyPlantsScreen households={aoife.households} householdId="our-flat" plants={aoife.plants} onSwitch={noop} onOpen={noop} onAdd={noop} onScan={noop} onScanLabel={noop} onAvatar={noop} />);
    expect(screen.getByText('Living room')).toBeTruthy();
    expect(screen.getByText('Kitchen')).toBeTruthy();
    expect(screen.getByText('Bedroom')).toBeTruthy();
  });
  it('plant detail shows Unknown for both pets and the confidence', async () => {
    await wrap(<PlantDetailScreen plant={aoife.plantDetails['monty']!} pets={aoife.household.pets} onBack={noop} onMore={noop} onCheckIn={noop} onPetAte={noop} onDiagnose={noop} />);
    expect(screen.getByText('Cats: Unknown')).toBeTruthy();
    expect(screen.getByText('Dogs: Unknown')).toBeTruthy();
    expect(screen.getByText('Very likely, 96%')).toBeTruthy();
  });
  it('a dead plant keeps its history', async () => {
    await wrap(<PlantDetailScreen plant={aoife.plantDetails['fern-dead']!} pets={aoife.household.pets} onBack={noop} onMore={noop} onCheckIn={noop} onPetAte={noop} onDiagnose={noop} />);
    expect(screen.getByText('Marked as died on 20 August: too dry. We use this to give better advice.')).toBeTruthy();
    expect(screen.getByText('Died · too dry')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check in' })).toBeNull();
  });
  it('setup saves the answers, with not-sure allowed', async () => {
    const onSave = jest.fn();
    const initial = { nickname: 'Lily', room: null, light: 'unknown', potMaterial: 'unknown', potSizeCm: null, drainage: 'unknown', indoor: true } as const;
    await wrap(<PlantSetupScreen speciesName="Peace lily" initial={initial} onSave={onSave} onCancel={noop} />);
    expect(screen.getByText("Not sure is fine. We'll start with the species' basic schedule and you can change it later.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Bright' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ nickname: 'Lily', light: 'bright', drainage: 'unknown' }));
  });
  it('label adoption says no identification is used; unknown code offers a scan', async () => {
    const onScanPlant = jest.fn();
    const first = await wrap(<LabelAdoptionScreen label={aoife.label} pets={aoife.household.pets} onAdd={noop} onScanPlant={noop} onBack={noop} onPetAte={noop} />);
    expect(screen.getByText('No identification used.')).toBeTruthy();
    first.unmount();
    await wrap(<LabelAdoptionScreen label={null} pets={aoife.household.pets} onAdd={noop} onScanPlant={onScanPlant} onBack={noop} onPetAte={noop} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Scan the plant' }));
    expect(onScanPlant).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/mobile test -- plants`
Expected: FAIL.

- [ ] **Step 3: Implement the screens, containers and catalog entries**

- The setup screen shows the "Not sure" Note whenever any answer is `unknown`.
- `l/[code]` is the deep-link target. "Add to my plants" opens `plants/setup` with `source=label_qr` and `labelCode`; on save it calls `addPlant` and goes to the new plant.
- `PetCheckCard`'s "My pet ate this" pushes `/pet-emergency` with `plantId` and `petId`. A single pet goes straight there; with several pets, the card asks which pet first.

- [ ] **Step 4: Run the tests and the visual check**

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck && pnpm visual:app 2d 4i 4j 4k 4l 4m 4n 4o 4p && pnpm visual:compare 2d 4i 4j 4k 4l 4m 4n 4o 4p`
Expected: the tests pass. Read every panel and fix differences.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): My Plants, plant detail, setup and label adoption (2d, 4i-4p)"
```

---

### Task 4: Diagnosis and pet emergency (4q–4s, 4bh, 4bi)

**Files:**
- Create:
  - `apps/mobile/src/screens/plants/DiagnosisScreen.tsx`
  - `apps/mobile/src/screens/emergency/PetEmergencyScreen.tsx`
  - `packages/core/src/emergency.ts`
  - `apps/mobile/src/catalog/frames/care.tsx`
- Modify: `apps/mobile/src/app/plants/[id]/diagnosis.tsx`, `apps/mobile/src/app/pet-emergency.tsx`, `apps/mobile/src/catalog/frames.ts`
- Test:
  - `packages/core/src/emergency.test.ts`
  - `apps/mobile/src/screens/emergency/emergency.test.tsx`

**Interfaces:**
- Consumes: `useEmergency`, `useQuota('diagnosis')`, `HeroHeader`, `ConfidenceLabel`, `VerdictChip` and `limitReachedLine`.
- Produces:
  - `poisonLineFor(countryCode: string): { name: string; phone: string; note: string } | null`. 'US' returns `{ name: 'ASPCA Poison Control', phone: '(888) 426-4435', note: 'Open 24 hours. A fee may apply.' }`. Everything else returns `null`.
  - `DiagnosisScreen({ state: 'result' | 'not_sure' | 'used_up'; result?: DiagnosisResult; quota?: QuotaState; photoLabel: string; plantName: string; onApply(); onRetake(); onTryPremium(); onNotNow(); onBack() })`
  - `PetEmergencyScreen({ info: EmergencyInfo; onCallVet(); onCallPoisonLine(); onFindVet(); onSaveVet(); onBack() })`. The call buttons sit in the bottom half of the screen, the vet button comes first, and there are no timeouts.

**Frames:**

| Frame | State | Content |
| --- | --- | --- |
| 4q | Result | Hero "Your photo: yellow leaves"; `ConfidenceLabel` 0.72; title "Overwatering"; sub "Yellow lower leaves and soft stems often mean the roots are staying wet."; "Change to your plan" with the row "Pause watering" / "Until two dry checks in a row"; "Apply to care plan" |
| 4r | Used up | BackBar "Monty"; title "You've used this month's diagnosis"; body "More arrive on 1 November, or get 10 a month with Premium."; "Try Premium free for 7 days"; "Not now" (text button) |
| 4s | Not sure | `ConfidenceLabel` 0.34 (not sure); title "Not sure yet"; body "Try a close photo of one affected leaf, in daylight."; Note "This didn't use your diagnosis."; "Take a close photo" |
| 4bh | Pet emergency, US | BackBar "Lily"; title "If Miso ate peace lily"; chip "Cats: Moderate"; body "Peace lily can irritate the mouth and cause drooling, vomiting and trouble swallowing."; sub "Source: ASPCA. Based on a very likely match, 94%."; then, lower on the screen: "Call your vet" (primary), "Call ASPCA Poison Control (888) 426-4435" (secondary), sub "Open 24 hours. A fee may apply." |
| 4bi | No vet saved, country without a line | The same top; Note "You haven't saved a vet yet. Call your nearest vet now."; "Find a vet nearby"; "Save your vet" (text button) |

- [ ] **Step 1: Write the failing tests**

`packages/core/src/emergency.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { poisonLineFor } from './emergency.ts';

describe('poisonLineFor', () => {
  it('US gets the ASPCA line', () => {
    expect(poisonLineFor('US')).toEqual({ name: 'ASPCA Poison Control', phone: '(888) 426-4435', note: 'Open 24 hours. A fee may apply.' });
  });
  it('Ireland and the EU show the vet only until a line is confirmed', () => {
    expect(poisonLineFor('IE')).toBeNull();
    expect(poisonLineFor('DE')).toBeNull();
    expect(poisonLineFor('')).toBeNull();
  });
});
```

`apps/mobile/src/screens/emergency/emergency.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { PetEmergencyScreen } from './PetEmergencyScreen';

const base = {
  petName: 'Miso', animal: 'cat' as const, speciesName: 'peace lily', matchProbability: 0.94,
  toxicity: { animal: 'cat' as const, severity: 'moderate' as const, summary: null, symptoms: 'Peace lily can irritate the mouth and cause drooling, vomiting and trouble swallowing.', sourceName: 'ASPCA', sourceUrl: null },
};
const noop = () => {};
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

describe('PetEmergencyScreen', () => {
  it('puts the vet first, then the poison line, with the match confidence', async () => {
    const onCallVet = jest.fn();
    await wrap(<PetEmergencyScreen info={{ ...base, vet: { name: 'Riverside Vets', phone: '01 555 0100' }, poisonLine: { name: 'ASPCA Poison Control', phone: '(888) 426-4435', note: 'Open 24 hours. A fee may apply.' } }} onCallVet={onCallVet} onCallPoisonLine={noop} onFindVet={noop} onSaveVet={noop} onBack={noop} />);
    expect(screen.getByText('If Miso ate peace lily')).toBeTruthy();
    expect(screen.getByText('Source: ASPCA. Based on a very likely match, 94%.')).toBeTruthy();
    const buttons = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? '');
    expect(buttons.findIndex((l) => l.startsWith('Call your vet'))).toBeLessThan(buttons.findIndex((l) => l.startsWith('Call ASPCA')));
    await fireEvent.press(screen.getByRole('button', { name: /Call your vet/ }));
    expect(onCallVet).toHaveBeenCalled();
  });
  it('without a vet or a poison line it says what to do', async () => {
    await wrap(<PetEmergencyScreen info={{ ...base, vet: null, poisonLine: null }} onCallVet={noop} onCallPoisonLine={noop} onFindVet={noop} onSaveVet={noop} onBack={noop} />);
    expect(screen.getByText("You haven't saved a vet yet. Call your nearest vet now.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Find a vet nearby' })).toBeTruthy();
    expect(screen.queryByText(/ASPCA Poison Control/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/core test -- emergency && pnpm --filter @tendril/mobile test -- emergency`
Expected: FAIL.

- [ ] **Step 3: Implement**

`packages/core/src/emergency.ts`:
```ts
export interface PoisonLine { name: string; phone: string; note: string }

/** Only the US line is confirmed (ASPCA). Ireland and the EU show the vet only until a line is confirmed. */
export function poisonLineFor(countryCode: string): PoisonLine | null {
  if (countryCode.toUpperCase() === 'US') {
    return { name: 'ASPCA Poison Control', phone: '(888) 426-4435', note: 'Open 24 hours. A fee may apply.' };
  }
  return null;
}
```

Export it from the core index. Calls use `Linking.openURL('tel:...')`, with non-digits stripped except a leading `+`. "Find a vet nearby" opens the maps search URL for "vet". Then implement the screens, containers and catalog entries.

- [ ] **Step 4: Run the tests and the visual check**

Run: `pnpm --filter @tendril/core test && pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck && pnpm visual:app 4q 4r 4s 4bh 4bi && pnpm visual:compare 4q 4r 4s 4bh 4bi`
Expected: the tests pass. Read every panel and fix differences.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src apps/mobile
git commit -m "feat(mobile): diagnosis and pet emergency screens (4q-4s, 4bh, 4bi)"
```

---

### Task 5: Camera, gallery and limit sheets (2b, 4t, 4u, 4af, 4ag)

**Files:**
- Create:
  - `apps/mobile/src/screens/scan/CameraScreen.tsx`
  - `apps/mobile/src/screens/scan/CameraDeniedScreen.tsx`
  - `apps/mobile/src/screens/scan/GalleryScreen.tsx`
  - `apps/mobile/src/screens/scan/LimitSheet.tsx`
  - `apps/mobile/src/services/photos.ts`
  - `apps/mobile/src/catalog/frames/scan.tsx`
- Modify: `apps/mobile/src/app/camera.tsx`, `apps/mobile/src/app/(tabs)/scan.tsx`, `apps/mobile/src/components/TabBar.tsx` (the Scan press checks the quota first), `apps/mobile/src/catalog/frames.ts`
- Test: `apps/mobile/src/screens/scan/camera.test.tsx`

**Interfaces:**
- Consumes: `useQuota('identification')`, `useQuota('diagnosis')`, the `identify` API, `QuotaMeter variant="pill"`, `Sheet`, `limitReachedLine`, `copy.galleryNote` and `copy.previewOffer`.
- Produces:
  - `CameraScreen({ preview: ReactNode; quota: QuotaState; organ: Organ; photos: string[]; healthCheck: boolean; diagnosisQuota: QuotaState; onOrgan(o); onShutter(); onRemovePhoto(i); onGallery(); onToggleHealth(on); onIdentify(); onClose() })`. Always in the dark scheme, from `2b.html`:
    - close button and quota pill at the top
    - organ chips: Leaf, Flower, Whole plant
    - viewfinder corners
    - a tray of 5 slots with "2 of 5"
    - Gallery button, an 80 pt shutter, and "Identify" (disabled at 0 photos)
    - a "Check its health" toggle with "Uses your 1 diagnosis this month"
    - the gallery note
  - `LimitSheet({ quota: QuotaState; visible; onTryPremium(); onClose() })`:
    - Free: `limitReachedLine` plus "Try Premium" and "Not now".
    - Premium at its cap: `limitReachedLine` and "OK" only.
  - `services/photos.ts`: `preparePhoto(uri: string, width: number, height: number): Promise<{ uri: string; base64: string; sha256: string; width: number; height: number }>`. It resizes to at most 2,000,000 pixels with the expo-image-manipulator context API, saves a JPEG at compress 0.85, and returns the base64 and the SHA-256 of the bytes (expo-crypto).
  - The Scan entry point (tab button and empty states) calls `useQuota('identification')` first. When `used >= limit`, it opens `LimitSheet` on the Scan tab and doesn't open the camera.

**Frames:**

| Frame | Screen | Content |
| --- | --- | --- |
| 2b | Camera | Leaf chip, 2 of 5 photos, quota pill "7 of 10 left this month", health toggle off |
| 4t | Camera denied | BackBar "Close"; EmptyState "The camera is off for Tendril."; body "Turn it on in Settings to scan plants. Gallery photos still work."; gallery Note; "Open Settings"; "Choose from gallery" (secondary) |
| 4u | Gallery only | BackBar "Close"; title "Choose photos"; sub "Up to 5 photos of the same plant."; a 300-high photo-library placeholder; gallery Note; "Identify" disabled |
| 4af | Limit reached | The Scan tab (header "Scan") with the sheet "Limit reached": the free copy, "Try Premium", "Not now" |
| 4ag | Limit reached, Premium at its cap | The Premium copy and "OK" only, with no upsell |

- [ ] **Step 1: Install and write the failing tests**

Inside `apps/mobile`: `npx expo install expo-camera expo-image-picker expo-image-manipulator expo-file-system expo-haptics`

`apps/mobile/src/screens/scan/camera.test.tsx`:
```tsx
import { aoife } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../../theme';
import { CameraScreen } from './CameraScreen';
import { LimitSheet } from './LimitSheet';

const noop = () => {};
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);
const dq = { kind: 'diagnosis' as const, used: 0, limit: 1, resetsOn: '2026-11-01', plan: 'free' as const };

describe('CameraScreen', () => {
  it('shows quota, organ chips, tray count and gallery note; Identify disabled with no photos', async () => {
    await wrap(<CameraScreen preview={<Text>preview</Text>} quota={aoife.today.identifications} organ="leaf" photos={[]} healthCheck={false} diagnosisQuota={dq} onOrgan={noop} onShutter={noop} onRemovePhoto={noop} onGallery={noop} onToggleHealth={noop} onIdentify={noop} onClose={noop} />);
    expect(screen.getByText('7 of 10 left this month')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Leaf' })).toBeChecked();
    expect(screen.getByText('0 of 5')).toBeTruthy();
    expect(screen.getByText("Gallery photos get identified but don't earn points.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Identify' })).toBeDisabled();
  });
  it('caps the tray at 5 photos', async () => {
    const onShutter = jest.fn();
    await wrap(<CameraScreen preview={<Text>p</Text>} quota={aoife.today.identifications} organ="leaf" photos={['1', '2', '3', '4', '5']} healthCheck={false} diagnosisQuota={dq} onOrgan={noop} onShutter={onShutter} onRemovePhoto={noop} onGallery={noop} onToggleHealth={noop} onIdentify={noop} onClose={noop} />);
    expect(screen.getByText('5 of 5')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Take photo' }));
    expect(onShutter).not.toHaveBeenCalled();
  });
});

describe('LimitSheet', () => {
  it('free users see the preview offer; premium at the cap sees only the reset date', async () => {
    const free = { kind: 'identification' as const, used: 10, limit: 10, resetsOn: '2026-11-01', plan: 'free' as const };
    const a = await wrap(<LimitSheet visible quota={free} onTryPremium={noop} onClose={noop} />);
    expect(screen.getByRole('button', { name: 'Try Premium' })).toBeTruthy();
    a.unmount();
    await wrap(<LimitSheet visible quota={{ ...free, used: 60, limit: 60, plan: 'premium' }} onTryPremium={noop} onClose={noop} />);
    expect(screen.getByText("You've used your 60 identifications this month. More arrive on 1 November.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try Premium' })).toBeNull();
    expect(screen.getByRole('button', { name: 'OK' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/mobile test -- camera`
Expected: FAIL.

- [ ] **Step 3: Implement**

**`camera` container:**
- Uses `useCameraPermissions`.
- Denied permission → `CameraDeniedScreen`. "Open Settings" calls `Linking.openSettings()`.
- `preview` is a `CameraView`, unmounted when the screen loses focus.
- The shutter calls `takePictureAsync`, then `preparePhoto`, and adds the result to the tray.
- Gallery uses `launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5 - photos.length })` and marks the capture source as gallery.
- "Identify" calls `api.identify(...)`, then `router.replace('/scan/<id>')`.
- The health toggle is disabled with "Diagnosis used this month" when the diagnosis quota is used up.

The catalog passes a dark `View` as the preview.

- [ ] **Step 4: Run the tests and the visual check**

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck && pnpm visual:app 2b 4t 4u 4af 4ag && pnpm visual:compare 2b 4t 4u 4af 4ag`
Expected: the tests pass. Read every panel and fix differences.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): camera, gallery, permission and limit screens (2b, 4t, 4u, 4af, 4ag)"
```

---

### Task 6: Scan results and logging a find (2a, 2c, 4v–4aa)

**Files:**
- Create:
  - `apps/mobile/src/screens/scan/ResultScreen.tsx`
  - `apps/mobile/src/screens/scan/LogFindSheet.tsx`
  - `apps/mobile/src/catalog/frames/result.tsx`
- Modify: `apps/mobile/src/app/scan/[id]/index.tsx`, `apps/mobile/src/catalog/frames.ts`
- Test: `apps/mobile/src/screens/scan/result.test.tsx`

**Interfaces:**
- Consumes:
  - `useScanResult`, `useConfirmScan`
  - `ConfidenceLabel`, `PetCheckCard`, `RowsCard`, `PhotoSlot`, `Note`, `Sheet` and `OptionPills`
  - `bandFor`, `copy.notAPlant`, `copy.notSure`, `likelyResultLine` and `veryLikelyResultLine`
- Produces:
  - `ResultScreen({ result: ScanResult; pets: Pet[]; logFind: { visible: boolean; placeType: PlaceType; locationOn: boolean } | null; onClose(); onAddToPlants(speciesId); onLogFind(); onChoose(speciesId); onRetake(); onRetry(); onPetAte(petId); onPlaceType(p); onSaveFind(); onTurnOnLocation(); onCloseLogFind() })`
  - The layout is chosen by state and band:
    - `identified` and very likely → 2a (scrolls): photo strip with "3 photos"; confidence; name; italic scientific name; `PetCheckCard`; "Care basics" rows (Light, Soil check, Warmth); "Other possibilities"; footer with "Log a find" (secondary) and "Add to My Plants"
    - `identified` and likely → 4v: confidence; `likelyResultLine`; rows comparing the top two with their confidence labels; verdict chips; the likely-match note; "This is a peace lily"
    - `identified` and not sure → 2c: "Not sure yet"; "Try a close photo of one leaf or flower."; "Closest matches" as two cards with reference images; a pet check with Unknown chips and the likely-match note; "Take a close photo"
    - `not_a_plant` → 4w; `offline` → 4x; `error` → 4y
  - `LogFindSheet` (4z, 4aa): "Where was it?" with pills Shop / Garden or park / Wild, and the Note "Points come from in-app camera finds. No picking, no trespassing, and others only ever see an area." With location off, the Note becomes "Location is off. This find goes in your Plantdex without points." and a "Turn on location" text button is added. Then "Save find".

**Frames:**
- 2a: Peace lily very likely
- 2c: not sure 41%
- 4v: likely 71%
- 4w: not a plant ("No plant found", `copy.notAPlant`, Note "This didn't use an identification.", "Try again")
- 4x: offline ("You're offline" / "Your photos are saved. We'll identify them when you're back online." / OK)
- 4y: error ("Something went wrong" / "We couldn't identify this one. It didn't use an identification." / "Try again" / "Close")
- 4z: foxglove with the Log a find sheet, Wild selected
- 4aa: the same with location off

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/screens/scan/result.test.tsx`:
```tsx
import { aoife } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { ResultScreen } from './ResultScreen';

const noop = () => {};
const h = { onClose: noop, onAddToPlants: noop, onLogFind: noop, onChoose: noop, onRetake: noop, onRetry: noop, onPetAte: noop, onPlaceType: noop, onSaveFind: noop, onTurnOnLocation: noop, onCloseLogFind: noop };
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);
const pets = aoife.household.pets;

describe('ResultScreen', () => {
  it('very likely: confidence first, pet check, both actions', async () => {
    const onAdd = jest.fn();
    await wrap(<ResultScreen result={aoife.scanResults['peace-lily-very-likely']!} pets={pets} logFind={null} {...h} onAddToPlants={onAdd} />);
    expect(screen.getByText('Very likely, 94%')).toBeTruthy();
    expect(screen.getByText('Peace lily')).toBeTruthy();
    expect(screen.getByText('Cats: Moderate')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add to My Plants' }));
    expect(onAdd).toHaveBeenCalled();
  });
  it('likely: compares two and adds the match note', async () => {
    await wrap(<ResultScreen result={aoife.scanResults['peace-lily-likely']!} pets={pets} logFind={null} {...h} />);
    expect(screen.getByText('Likely a peace lily, 71%. Compare these two before you add it.')).toBeTruthy();
    expect(screen.getByText('This depends on the match. Confirm the plant to be sure.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to My Plants' })).toBeNull();
  });
  it('not sure asks for a better photo instead of guessing', async () => {
    await wrap(<ResultScreen result={aoife.scanResults['not-sure']!} pets={pets} logFind={null} {...h} />);
    expect(screen.getByText('Not sure yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Take a close photo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to My Plants' })).toBeNull();
  });
  it('not a plant and error say no identification was used', async () => {
    const a = await wrap(<ResultScreen result={aoife.scanResults['not-a-plant']!} pets={pets} logFind={null} {...h} />);
    expect(screen.getByText("This didn't use an identification.")).toBeTruthy();
    a.unmount();
    await wrap(<ResultScreen result={aoife.scanResults['error']!} pets={pets} logFind={null} {...h} />);
    expect(screen.getByText("We couldn't identify this one. It didn't use an identification.")).toBeTruthy();
  });
  it('log a find with location off says it earns no points', async () => {
    await wrap(<ResultScreen result={aoife.scanResults['foxglove-find']!} pets={pets} logFind={{ visible: true, placeType: 'wild', locationOn: false }} {...h} />);
    expect(screen.getByText('Location is off. This find goes in your Plantdex without points.')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Wild' })).toBeChecked();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/mobile test -- result`
Expected: FAIL.

- [ ] **Step 3: Implement the screen, sheet, container and catalog entries**

- **"Add to My Plants"** goes to `plants/setup` with the observation id. On save, it calls `confirmScan` with `action: 'add_plant'` and the setup, then goes to the new-species screen if `getOutcome` reports `newToPlantdex`, otherwise to the plant.
- **"Log a find"** opens `LogFindSheet`. Location permission is requested in context here, behind the location `PermissionPrimer`, the first time only. "Save find" calls `confirmScan` with `action: 'log_find'`, then goes to `/scan/<id>/new-species` or the Plantdex.

- [ ] **Step 4: Run the tests and the visual check**

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck && pnpm visual:app 2a 2c 4v 4w 4x 4y 4z 4aa && pnpm visual:compare 2a 2c 4v 4w 4x 4y 4z 4aa`
Expected: the tests pass. Read every panel and fix differences. Frame 2a scrolls: the catalog shows its top, so also check the scrolled content against the text in `design/frames/2a.html`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): scan result states and log-a-find sheet (2a, 2c, 4v-4aa)"
```

---

### Task 7: New species moment and set completion (4ab–4ae, 4al)

**Files:**
- Create:
  - `apps/mobile/src/screens/scan/NewSpeciesScreen.tsx`
  - `apps/mobile/src/screens/collection/SetCompleteScreen.tsx`
  - `apps/mobile/src/hooks/useReduceMotion.ts`
  - `apps/mobile/src/catalog/frames/moments.tsx`
- Modify: `apps/mobile/src/app/scan/[id]/new-species.tsx`, `apps/mobile/src/app/collection/sets/[id]/complete.tsx`, `apps/mobile/src/catalog/frames.ts`
- Test: `apps/mobile/src/screens/scan/moments.test.tsx`

**Interfaces:**
- Consumes: `useOutcome`, `RarityBadge`, `RowsCard`, `Note`, `PhotoSlot`, `copy.pointsHeld`, `copy.galleryNote`, and Reanimated.
- Produces:
  - `useReduceMotion(): boolean`: the live value from `AccessibilityInfo.isReduceMotionEnabled()` plus the `reduceMotionChanged` listener.
  - `NewSpeciesScreen({ species: SpeciesRef; outcome: Outcome; photoLabel: string; reduceMotion: boolean; onContinue() })`:
    - photo, "New to your Plantdex", the name in `moment`, the italic scientific name, `RarityBadge`
    - awarded: rows "Points +40", "Plantdex 38 species", "Irish hedgerow 5 of 8"
    - held: Note `copy.pointsHeld`
    - gallery or integrity (no points): Note `copy.galleryNote`
    - otherwise no points: the plain reason
    - entrance animation: a scale and fade under 1.5 s that a tap skips; with Reduce Motion, a fade only and the sub "Reduce Motion is on, so this card appears with a fade only." The sub appears only in the catalog frame 4ac, via `showReduceMotionNote`.
  - `SetCompleteScreen({ setName; total; onShare(); onContinue(); onBack() })` (4al): tendril drawing, the set name in `moment`, "Set complete: 6 of 6.", a Legendary badge, "Share", and "Continue" (text button).

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/screens/scan/moments.test.tsx`:
```tsx
import { aoife } from '@tendril/core';
import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { NewSpeciesScreen } from './NewSpeciesScreen';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);
const fox = aoife.species['foxglove']!;

describe('NewSpeciesScreen', () => {
  it('awarded shows points, Plantdex count and set progress', async () => {
    await wrap(<NewSpeciesScreen species={fox} outcome={aoife.outcomes['foxglove-awarded']!} photoLabel="Your photo: foxglove" reduceMotion={false} onContinue={() => {}} />);
    expect(screen.getByText('New to your Plantdex')).toBeTruthy();
    expect(screen.getByText('+40')).toBeTruthy();
    expect(screen.getByText('38 species')).toBeTruthy();
    expect(screen.getByText('5 of 8')).toBeTruthy();
  });
  it('held points read as pending review, never as an accusation', async () => {
    await wrap(<NewSpeciesScreen species={aoife.species['bluebell']!} outcome={aoife.outcomes['bluebell-held']!} photoLabel="Your photo: bluebell" reduceMotion={false} onContinue={() => {}} />);
    expect(screen.getByText('Points pending review. We check unusual finds before they count.')).toBeTruthy();
    expect(screen.queryByText(/cheat|suspicious|fraud/i)).toBeNull();
  });
  it('gallery finds explain why there are no points', async () => {
    await wrap(<NewSpeciesScreen species={aoife.species['primrose']!} outcome={aoife.outcomes['primrose-gallery']!} photoLabel="Gallery photo: primrose" reduceMotion onContinue={() => {}} />);
    expect(screen.getByText("Gallery photos get identified but don't earn points.")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/mobile test -- moments`
Expected: FAIL.

- [ ] **Step 3: Implement the screens, hook, containers and catalog entries** (4ab, 4ac with the reduce-motion note, 4ad and 4ae; 4al).

- [ ] **Step 4: Run the tests and the visual check**

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck && pnpm visual:app 4ab 4ac 4ad 4ae 4al && pnpm visual:compare 4ab 4ac 4ad 4ae 4al`
Expected: the tests pass, and the panels match after fixes. The catalog renders the final, settled animation state.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): new-species moment with Reduce Motion, and set completion (4ab-4ae, 4al)"
```

---

### Task 8: Collection (2f, 4ah–4ak, 4am–4ap)

**Files:**
- Create:
  - `apps/mobile/src/screens/collection/CollectionScreen.tsx`
  - `apps/mobile/src/screens/collection/SpeciesCardScreen.tsx`
  - `apps/mobile/src/components/FindsMap.tsx`
  - `apps/mobile/src/components/FindsMap.web.tsx`
  - `apps/mobile/src/catalog/frames/collection.tsx`
- Modify: `apps/mobile/src/app/(tabs)/collection/index.tsx`, `apps/mobile/src/app/collection/species/[id].tsx`, `apps/mobile/src/catalog/frames.ts`
- Test: `apps/mobile/src/screens/collection/collection.test.tsx`

**Interfaces:**
- Consumes:
  - `usePlantdex`, `useSets`, `useFinds`, `useBadges`, `useSpeciesCard`
  - `SegmentedControl`, `PlantdexTile`, `RarityBadge`, `RowsCard`, `VerdictChip`, `EmptyState`, `FindMarker`, `Note` and `copy.sensitiveSpecies`
- Produces:
  - `CollectionScreen({ segment: 'plantdex' | 'sets' | 'map' | 'badges'; plantdex: { entries; counts; filter } | null; sets: CollectionSet[]; finds: FindListItem[]; locationGranted: boolean; badges: Badge[]; onSegment(s); onFilter(f); onOpenSpecies(id); onOpenSet(id); onOpenFind(id); onScan(); onTurnOnLocation(); onShareBadge(); onAvatar() })`
    - Plantdex (2f, 4ah): filter pills "All · 37", "Houseplants · 21", "Wild · 16"; a set progress card "Irish hedgerow 4 of 8" with 8 segments; a 2-column tile grid
    - Sets (4ak): rows, then a heading and a 3-column tile grid
    - Map (4am, 4an): `FindsMap` with exact pins (native react-native-maps; web shows the placeholder "Map with your exact pins"), the sub "Only you see exact pins. Anything shared shows an area at most.", and finds rows. Without location: Note "Location is off, so your finds show as a list.", the rows, and "Turn on location".
    - Badges (4ao, 4ap): rows showing "Earned" in `primary` or "12 of 30"; "Share a badge". Empty: EmptyState "No badges yet. Log your first find to earn one." and the locked row.
    - Empty Plantdex (4ah): EmptyState "Your Plantdex fills up as you scan. Start with a plant at home." and "Scan a plant".
  - `SpeciesCardScreen({ card: SpeciesCard; pets: Pet[]; onBack(); onSeeOnMap(); onPetAte(petId) })` (4ai, 4aj): hero, name, scientific name, rarity, rows "Your finds", set progress, verdict chips with the line, "See finds on the map".
    - Sensitive species have no map button and show the Note `copy.sensitiveSpecies`.
    - `FindsMap` never renders pins for sensitive species. Their finds appear in the list as "Location private".

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/screens/collection/collection.test.tsx`:
```tsx
import { aoife, plantdexCounts } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { CollectionScreen } from './CollectionScreen';
import { SpeciesCardScreen } from './SpeciesCardScreen';

const noop = () => {};
const base = { plantdex: { entries: aoife.plantdex, counts: plantdexCounts, filter: 'all' as const }, sets: aoife.sets, finds: aoife.finds, locationGranted: true, badges: aoife.badges, onSegment: noop, onFilter: noop, onOpenSpecies: noop, onOpenSet: noop, onOpenFind: noop, onScan: noop, onTurnOnLocation: noop, onShareBadge: noop, onAvatar: noop };
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

describe('CollectionScreen', () => {
  it('Plantdex shows filters with counts and a missing tile', async () => {
    await wrap(<CollectionScreen segment="plantdex" {...base} />);
    expect(screen.getByText('All · 37')).toBeTruthy();
    expect(screen.getByText('Wild · 16')).toBeTruthy();
    expect(screen.getAllByLabelText('Not found yet').length).toBeGreaterThan(0);
  });
  it('map without location falls back to a list', async () => {
    const onTurnOn = jest.fn();
    await wrap(<CollectionScreen segment="map" {...base} locationGranted={false} onTurnOnLocation={onTurnOn} />);
    expect(screen.getByText('Location is off, so your finds show as a list.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Turn on location' }));
    expect(onTurnOn).toHaveBeenCalled();
  });
});

describe('SpeciesCardScreen', () => {
  it('sensitive species: privacy note and no map link', async () => {
    const card = { species: aoife.species['early-purple-orchid']!, findsCount: 1, sets: [], toxicity: [] };
    await wrap(<SpeciesCardScreen card={card} pets={aoife.household.pets} onBack={noop} onSeeOnMap={noop} onPetAte={noop} />);
    expect(screen.getByText("We keep this species' location private to protect it.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'See finds on the map' })).toBeNull();
  });
  it('unknown toxicity names the pet', async () => {
    const card = { species: aoife.species['bluebell']!, findsCount: 2, sets: [{ name: 'Irish hedgerow', found: 4, total: 8 }], toxicity: [] };
    await wrap(<SpeciesCardScreen card={card} pets={aoife.household.pets} onBack={noop} onSeeOnMap={noop} onPetAte={noop} />);
    expect(screen.getByText('Cats: Unknown')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'See finds on the map' })).toBeTruthy();
  });
});
```

`plantdexCounts` is exported from `fixtures/aoife.ts`, per Phase 1A Task 2.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/mobile test -- collection`
Expected: FAIL.

- [ ] **Step 3: Implement the screens, map, containers and catalog entries** (2f, 4ah, 4ai, 4aj, 4ak, 4am, 4an, 4ao, 4ap).

- [ ] **Step 4: Run the tests and the visual check**

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck && pnpm visual:app 2f 4ah 4ai 4aj 4ak 4am 4an 4ao 4ap && pnpm visual:compare 2f 4ah 4ai 4aj 4ak 4am 4an 4ao 4ap`
Expected: the tests pass. Read every panel and fix differences.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): Plantdex, sets, finds map, badges and species card (2f, 4ah-4ap)"
```

---

### Task 9: Leagues and friends (4aq–4ax)

**Files:**
- Create:
  - `apps/mobile/src/screens/leagues/LeaguesScreen.tsx`
  - `apps/mobile/src/screens/leagues/AddFriendsScreen.tsx`
  - `apps/mobile/src/screens/leagues/WeekResultsScreen.tsx`
  - `apps/mobile/src/catalog/frames/leagues.tsx`
- Modify: `apps/mobile/src/app/(tabs)/leagues/index.tsx`, `apps/mobile/src/app/leagues/add-friends.tsx`, `apps/mobile/src/app/leagues/week-results.tsx`, `apps/mobile/src/catalog/frames.ts`
- Test: `apps/mobile/src/screens/leagues/leagues.test.tsx`

**Interfaces:**
- Consumes: `useLeague`, `useFriends`, `useWeekResult`, the `findHandle`, `sendFriendRequest` and `createInvite` API calls, and `LeagueRow`, `SegmentedControl`, `EmptyState`, `TextField` and `RowsCard`.
- Produces:
  - `LeaguesScreen({ segment: 'league' | 'friends'; league: LeagueBoard; friends: LeagueBoard; onSegment(s); onOpenProfile(handle); onAddFriends(); onScan(); onAvatar() })`
    - league (4aq): the sub "3 days left · resets Monday", then rows
    - before any points (4ar): EmptyState "Log a find to join this week’s board with 20 people near you." and "Scan a plant"
    - friends (4as): rows and "Add friends" (secondary)
    - no friends (4at): EmptyState "No friends here yet. Invite someone to compare finds each week." and "Add friends"
  - `AddFriendsScreen({ query: string; result: { handle: string; plantdexCount: number } | null | 'not_found'; onQuery(q); onAdd(handle); onInvite(); onBack() })`:
    - found (4au): a row "@siobhanplants · 37 species · Add"
    - not found (4av): Note "No one has that handle. Check the spelling, or send an invite link."
    - search is exact-match only and triggers on submit, not on each keystroke, so handles can't be enumerated
  - `WeekResultsScreen({ result: WeekResult; onContinue() })`:
    - 4aw: sub "Week results", "4th of 20" in `moment`, rows Points 340 and Best find Foxglove (Uncommon)
    - 4ax: "A quiet week", "No points this week. A new board starts Monday."

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/screens/leagues/leagues.test.tsx`:
```tsx
import { aoife } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { AddFriendsScreen } from './AddFriendsScreen';
import { LeaguesScreen } from './LeaguesScreen';
import { WeekResultsScreen } from './WeekResultsScreen';

const noop = () => {};
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

describe('leagues', () => {
  it('this week: days left and your highlighted row', async () => {
    await wrap(<LeaguesScreen segment="league" league={aoife.league} friends={aoife.friends} onSegment={noop} onOpenProfile={noop} onAddFriends={noop} onScan={noop} onAvatar={noop} />);
    expect(screen.getByText('3 days left · resets Monday')).toBeTruthy();
    expect(screen.getByText('You · @aoifegrows')).toBeTruthy();
  });
  it('searches only on submit, exact handle', async () => {
    const onQuery = jest.fn();
    await wrap(<AddFriendsScreen query="" result={null} onQuery={onQuery} onAdd={noop} onInvite={noop} onBack={noop} />);
    await fireEvent.changeText(screen.getByLabelText('Handle'), '@siobhanplant');
    expect(onQuery).not.toHaveBeenCalled();
    await fireEvent(screen.getByLabelText('Handle'), 'submitEditing');
    expect(onQuery).toHaveBeenCalledWith('@siobhanplant');
  });
  it('handle not found suggests an invite', async () => {
    await wrap(<AddFriendsScreen query="@aoifegrow" result="not_found" onQuery={noop} onAdd={noop} onInvite={noop} onBack={noop} />);
    expect(screen.getByText('No one has that handle. Check the spelling, or send an invite link.')).toBeTruthy();
  });
  it('a quiet week is calm', async () => {
    await wrap(<WeekResultsScreen result={{ rank: null, of: null, points: 0, bestFind: null }} onContinue={noop} />);
    expect(screen.getByText('A quiet week')).toBeTruthy();
    expect(screen.getByText('No points this week. A new board starts Monday.')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/mobile test -- leagues`
Expected: FAIL.

- [ ] **Step 3: Implement the screens, containers and catalog entries** (4aq–4ax).

- [ ] **Step 4: Run the tests and the visual check**

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck && pnpm visual:app 4aq 4ar 4as 4at 4au 4av 4aw 4ax && pnpm visual:compare 4aq 4ar 4as 4at 4au 4av 4aw 4ax`
Expected: the tests pass, and the panels match after fixes.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): league, friends, add friends and week results (4aq-4ax)"
```

---

### Task 10: Profile, settings, household and account deletion (4ay–4bd, 4bj, 4bk)

**Files:**
- Create in `apps/mobile/src/screens/profile/`: `ProfileScreen.tsx`, `PublicProfileScreen.tsx`, `SettingsScreen.tsx`, `HouseholdScreen.tsx`, `DeleteAccountScreen.tsx`, `NotificationsSettingsScreen.tsx`, `AccountScreen.tsx`
- Create: `apps/mobile/src/catalog/frames/profile.tsx`
- Modify: the routes `profile/*` and `settings/*`, and `apps/mobile/src/catalog/frames.ts`
- Test: `apps/mobile/src/screens/profile/profile.test.tsx`

**Interfaces:**
- Consumes: `useProfile`, `useHousehold`, `useEntitlement`, `useStartPreview`, the `deleteAccount` API, `RowsCard`, `Note`, `Button`, `copy.previewOffer`, `copy.deleteAccount` and `copy.deleteAccountWithSubscription`.
- Produces:
  - `ProfileScreen({ profile; onBack(); onEdit(); onSettings(); onPublicView() })` (4ay)
  - `PublicProfileScreen({ profile; onBack() })` (4az). Note "This is what others see. No locations, pets or plants at home."
  - `SettingsScreen({ household: Household; homeAreaSet: boolean; remindersOn: boolean; entitlement: Entitlement; previewDaysLeft: number | null; onOpen(key: 'household' | 'home-area' | 'notifications' | 'premium' | 'account' | 'terms' | 'privacy'); onBack() })`:
    - 4ba: rows
    - 4bb, preview active: Note "Premium preview: 5 days left. It ends on its own, and nothing is charged." and the Premium row "Preview, ends 8 Oct"
  - `HouseholdScreen({ household; plan: Plan; previewUsed: boolean; onInvite(); onStartPreview(); onEditVet(); onBack() })`:
    - 4bc, premium (or during the preview): members, pets, vet, "Invite a member"
    - 4bd, free: Note "Household sharing and holiday hand-over come with Premium.", body `copy.previewOffer`, "Start the preview"
  - `DeleteAccountScreen({ counts: { plants: number; species: number }; activeSubscription: boolean; onManageSubscription(); onDelete(); onBack() })`:
    - 4bj: `copy.deleteAccount`, rows Plants 3, Finds and locations 37 species, Photos, Points, then a danger "Delete account"
    - 4bk: `copy.deleteAccountWithSubscription`, Note "Billing continues through the App Store until you cancel it there.", "Manage subscription" (secondary), then a danger "Delete account"
    - **one confirmation**: pressing Delete shows an alert ("Delete your account? This can't be undone.") with Cancel and Delete. Only Delete calls `onDelete`.
  - `NotificationsSettingsScreen` and `AccountScreen` are composed from `RowsCard`, matching the style of 4ba. Account rows: Email, Sign out, Delete account (danger text).

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/screens/profile/profile.test.tsx`:
```tsx
import { aoife } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ThemeProvider } from '../../theme';
import { DeleteAccountScreen } from './DeleteAccountScreen';
import { HouseholdScreen } from './HouseholdScreen';
import { PublicProfileScreen } from './PublicProfileScreen';

const noop = () => {};
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

describe('profile and account', () => {
  it('public view hides locations, pets and plants', async () => {
    await wrap(<PublicProfileScreen profile={aoife.profile} onBack={noop} />);
    expect(screen.getByText('This is what others see. No locations, pets or plants at home.')).toBeTruthy();
    expect(screen.queryByText('Miso')).toBeNull();
  });
  it('free household offers the preview without payment details', async () => {
    await wrap(<HouseholdScreen household={aoife.household} plan="free" previewUsed={false} onInvite={noop} onStartPreview={noop} onEditVet={noop} onBack={noop} />);
    expect(screen.getByText('Try Premium free for 7 days. No payment details, nothing to cancel.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Invite a member' })).toBeNull();
  });
  it('delete account warns about an active subscription and asks once', async () => {
    const onDelete = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'Delete')?.onPress?.());
    await wrap(<DeleteAccountScreen counts={{ plants: 3, species: 37 }} activeSubscription onManageSubscription={noop} onDelete={onDelete} onBack={noop} />);
    expect(screen.getByText('Billing continues through the App Store until you cancel it there.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/mobile test -- profile`
Expected: FAIL.

- [ ] **Step 3: Implement the screens, containers and catalog entries** (4ay, 4az, 4ba, 4bb, 4bc, 4bd, 4bj, 4bk). On web, `Alert.alert` falls back to `window.confirm` in the container. After deletion, call `session.signOut()` and go to Welcome.

- [ ] **Step 4: Run the tests and the visual check**

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck && pnpm visual:app 4ay 4az 4ba 4bb 4bc 4bd 4bj 4bk && pnpm visual:compare 4ay 4az 4ba 4bb 4bc 4bd 4bj 4bk`
Expected: the tests pass, and the panels match after fixes.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): profile, settings, household and account deletion (4ay-4bd, 4bj, 4bk)"
```

---

### Task 11: Paywall (2g, 4be–4bg)

**Files:**
- Create:
  - `apps/mobile/src/screens/paywall/PaywallScreen.tsx`
  - `apps/mobile/src/services/purchases.ts`
  - `apps/mobile/src/catalog/frames/paywall.tsx`
- Modify: `apps/mobile/src/app/paywall.tsx`, `apps/mobile/src/catalog/frames.ts`
- Test: `apps/mobile/src/screens/paywall/paywall.test.tsx`

**Interfaces:**
- Consumes: `useEntitlement`, `useStartPreview`, `PlanCard`, `Note`, `Button` and `copy.previewOffer`.
- Produces:
  - `PurchasesProvider` interface (`services/purchases.ts`):
    - `getPlans(): Promise<{ id: 'yearly' | 'monthly'; title: string; price: string; per: string; subtitle: string; tag?: string }[]>`
    - `purchase(id): Promise<'purchased' | 'pending' | 'cancelled' | 'failed'>`
    - `restore(): Promise<void>`
    - `FakePurchases`: returns Yearly $24.99 ("$2.08 a month, billed yearly", tag "Best value") and Monthly $4.99 ("Billed monthly"). A `scenario` field controls the outcome.
  - `PaywallScreen({ plans; selected: 'yearly' | 'monthly'; state: 'idle' | 'pending' | 'failed'; previewDaysLeft: number | null; previewAvailable: boolean; onSelect(id); onSubscribe(); onStartPreview(); onRestore(); onTerms(); onPrivacy(); onClose() })`. Layout from `2g.html`:
    - the close button is visible from the start
    - title "Tendril Premium"
    - four check rows of features
    - two `PlanCard`s
    - "Subscribe for $24.99 a year", following the selected plan
    - "Try Premium free for 7 days" (secondary), shown only when `previewAvailable`
    - the line "No payment details, nothing to cancel. Subscriptions renew until you cancel in App Store settings."
    - links: Restore purchases, Terms of Use, Privacy Policy
  - Paywall states:
    - 4be, preview days left: add the Note `previewEnding()`
    - 4bf, pending: Note "Your purchase is waiting for approval from the App Store. We’ll unlock Premium as soon as it goes through." and a disabled "Waiting for the App Store"
    - 4bg, failed: Note "The purchase didn't go through, and you weren't charged.", "Try again", "Restore purchases"

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/screens/paywall/paywall.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../../theme';
import { PaywallScreen } from './PaywallScreen';

const plans = [
  { id: 'yearly' as const, title: 'Yearly', tag: 'Best value', subtitle: '$2.08 a month, billed yearly', price: '$24.99', per: 'a year' },
  { id: 'monthly' as const, title: 'Monthly', subtitle: 'Billed monthly', price: '$4.99', per: 'a month' },
];
const noop = () => {};
const h = { onSelect: noop, onSubscribe: noop, onStartPreview: noop, onRestore: noop, onTerms: noop, onPrivacy: noop, onClose: noop };
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

describe('PaywallScreen', () => {
  it('close is available from the start; terms, privacy and restore are present', async () => {
    await wrap(<PaywallScreen plans={plans} selected="yearly" state="idle" previewDaysLeft={null} previewAvailable {...h} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    for (const l of ['Restore purchases', 'Terms of Use', 'Privacy Policy']) expect(screen.getByRole('link', { name: l })).toBeTruthy();
  });
  it('the billed price is the largest price text, and the tag is smaller', async () => {
    await wrap(<PaywallScreen plans={plans} selected="yearly" state="idle" previewDaysLeft={null} previewAvailable {...h} />);
    const price = StyleSheet.flatten(screen.getByText('$24.99').props.style).fontSize as number;
    const perMonth = StyleSheet.flatten(screen.getByText('$2.08 a month, billed yearly').props.style).fontSize as number;
    const tag = StyleSheet.flatten(screen.getByText('Best value').props.style).fontSize as number;
    expect(price).toBeGreaterThan(perMonth);
    expect(price).toBeGreaterThan(tag);
  });
  it('subscribe button follows the selected plan', async () => {
    await wrap(<PaywallScreen plans={plans} selected="monthly" state="idle" previewDaysLeft={null} previewAvailable={false} {...h} />);
    expect(screen.getByRole('button', { name: 'Subscribe for $4.99 a month' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try Premium free for 7 days' })).toBeNull();
  });
  it('pending disables purchase; failed reassures no charge', async () => {
    const a = await wrap(<PaywallScreen plans={plans} selected="yearly" state="pending" previewDaysLeft={null} previewAvailable={false} {...h} />);
    expect(screen.getByRole('button', { name: 'Waiting for the App Store' })).toBeDisabled();
    a.unmount();
    await wrap(<PaywallScreen plans={plans} selected="yearly" state="failed" previewDaysLeft={null} previewAvailable={false} {...h} />);
    expect(screen.getByText("The purchase didn't go through, and you weren't charged.")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/mobile test -- paywall`
Expected: FAIL.

- [ ] **Step 3: Implement the screen, `FakePurchases`, container and catalog entries** (2g, 4be, 4bf, 4bg). Links use `accessibilityRole="link"`. The container uses `FakePurchases` in fixture mode; Phase 6 adds RevenueCat behind the same interface.

- [ ] **Step 4: Run the tests and the visual check**

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck && pnpm visual:app 2g 4be 4bf 4bg && pnpm visual:compare 2g 4be 4bf 4bg`
Expected: the tests pass, and the panels match after fixes.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): paywall with honest price hierarchy and purchase states (2g, 4be-4bg)"
```

---

### Task 12: Dark mode and the full visual sweep (6a–6g and all frames)

**Files:**
- Create: `apps/mobile/src/catalog/frames/dark.tsx`
- Modify: any screen or component that the sweep shows to be off
- Create: `docs/design-notes/visual-sweep.md`, a table of every frame id with its diff % and verdict

**Interfaces:**
- Consumes: every catalog registration so far.
- Produces: frames 6a–6g (2a–2g props with `scheme: 'dark'` and `statusBar: 'light'`), plus a sweep report.

- [ ] **Step 1: Register the dark frames and write a coverage test**

`apps/mobile/src/catalog/coverage.test.ts`:
```ts
import '../catalog/frames';
import { listFrames } from './registry';

const DESIGN_FRAMES = [
  '2a', '2b', '2c', '2d', '2e', '2f', '2g',
  '3a', '3b', '3c', '3d', '3e', '3f', '3g', '3h', '3i', '3j', '3k',
  ...'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => `4${c}`),
  ...'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => `4a${c}`),
  '4ba', '4bb', '4bc', '4bd', '4be', '4bf', '4bg', '4bh', '4bi', '4bj', '4bk',
  '6a', '6b', '6c', '6d', '6e', '6f', '6g',
];

describe('catalog coverage', () => {
  it('registers all 88 design frames', () => {
    const ids = new Set(listFrames().map((f) => f.id));
    expect(DESIGN_FRAMES).toHaveLength(88);
    expect(DESIGN_FRAMES.filter((id) => !ids.has(id))).toEqual([]);
  });
  it('dark frames use the dark scheme', () => {
    for (const id of ['6a', '6b', '6c', '6d', '6e', '6f', '6g']) {
      expect(listFrames().find((f) => f.id === id)?.scheme).toBe('dark');
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails, then register the dark frames**

Run: `pnpm --filter @tendril/mobile test -- coverage`
Expected: FAIL, listing 6a–6g, plus any frame earlier tasks missed. Register the missing frames until it passes.

- [ ] **Step 3: Sweep every frame**

Run: `pnpm visual:app && pnpm visual:compare > docs/design-notes/visual-sweep.raw.txt`

Read every `design/compare/<id>.png`, highest diff first. Fix real differences in the screens and components, re-run the affected ids, and repeat. Then write `docs/design-notes/visual-sweep.md` with one row per frame: id | diff % | verdict (`matches`, or `accepted: <reason>` citing the allowed differences in the Global Constraints). Delete the raw file.

- [ ] **Step 4: Run the full verification**

Run: `pnpm verify`
Expected: typecheck, tests (core, mobile, functions and visual) and lint all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile docs/design-notes
git commit -m "feat(mobile): dark-mode hero frames and full visual sweep of all 88 frames"
```
