# Phase 1A: Design System and App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tendril's design tokens, copy, domain types and sample data live in `@tendril/core`. The Expo app has the theme, typography, every design-system component with its states, a dev catalog that renders any design frame, a visual comparison tool, and a working five-tab shell on a fixture API, all ready for Phase 1B to build the 88 screens.

**Architecture:**
- **Shared rules:** `@tendril/core` holds the shared design and domain rules, written test first: tokens, toxicity and verdict wording, copy, domain types and fixtures.
- **Building blocks:** the mobile app's `src/theme` reads the core tokens, and `src/components` holds presentational building blocks that take props only.
- **Data:** `src/api` defines the `TendrilApi` interface. Phase 1 uses its in-memory fixture implementation, and Phase 2 adds a Supabase one.
- **Catalog:** a dev-only route at `/catalog/[frame]` renders any registered design frame inside iPhone 16 device chrome (393×852, 59 pt top inset, 34 pt bottom inset). `tools/visual` screenshots it next to the matching design render.

**Tech Stack:** Expo SDK 57, expo-router 57, react-native-svg 15, lucide-react-native 1.51, `@expo-google-fonts/fraunces` and `@expo-google-fonts/inter`, TanStack Query 5, jest-expo with @testing-library/react-native 14 (async `render`), Playwright with pngjs and pixelmatch, vitest.

**Spec:** `docs/superpowers/specs/2026-10-03-tendril-v1-design.md` (§5 core, §6.1–6.3 mobile). Design sources:
- `design/frames/<id>.html`: one file per frame, with the exact inline styles; this is the source of truth for every pixel value.
- `design/screens/<id>.png`: rendered frames.
- `docs/ux/tendril-ux-doc.md`: tokens, type, copy and components.

## Global Constraints

- **Colours:** use only the UX brief's tokens, given here as light / dark.

  | Token | Light | Dark |
  | --- | --- | --- |
  | background | #FBFAF6 | #121714 |
  | surface | #FFFFFF | #1B221E |
  | text-primary | #1D2420 | #E8EEEA |
  | text-secondary | #56605A | #A9B5AE |
  | border | #7F8983 | #69756E |
  | primary | #2E6B4E | #7BC79C |
  | on-primary | #FFFFFF | #0E1A13 |
  | primary-tint | #E6F0EA | #1E3328 |
  | streak | #A36100 | #F2B35C |

  The design also uses these effects, copied exactly:
  - hairline: rgba(127,137,131,0.28) light, rgba(105,117,110,0.45) dark
  - divider: rgba(127,137,131,0.18) light, rgba(105,117,110,0.4) dark
  - scrim: rgba(18,23,20,0.45)
  - photo button: rgba(18,23,20,0.6)
  - pressed overlay: rgba(29,36,32,0.22) light, rgba(14,26,19,0.2) dark

  No other colours, and no gradients behind text.
- **Verdict chips** (light / dark):
  - Unknown: #5F6B66 / #B9C3BE
  - No known toxicity: #2B6A45 / #86CFA1
  - Mild: #8A5A00 / #E6B85C
  - Moderate: #B3401F / #F0A07F
  - Severe: #9B1C1C / #F2A3A3
- **Rarity badges** (light / dark):
  - Common: #5E6E66 / #B4C0B9
  - Uncommon: #2F7D6D / #7FCDB9
  - Rare: #3F5BA9 / #A9B8F0
  - Legendary: #8C6A12 / #E3C26A
- **Chip and badge text:** #FFFFFF in light mode, #0E1A13 in dark mode. Severe doubles as the danger colour.
- **Type** (face, weight, size / line height):

  | Variant | Face | Weight | Size / line height |
  | --- | --- | --- | --- |
  | moment | Fraunces | 600 | 34/41 |
  | title | Fraunces | 600 | 28/34 |
  | heading | Inter | 600 | 20/25 |
  | body | Inter | 400 | 17/22 (body copy blocks use 17/24) |
  | bodyStrong | Inter | 600 | 17/22 |
  | sub | Inter | 400 | 15/21 |
  | sci | Inter | 400 italic | 15/20 |
  | caption | Inter | 500 | 13/18 |

  Nothing goes below 11 pt. Scientific names are always italic.
- **Shape:** 4 pt grid, 16 pt screen margins, 16 pt card corners, 14 pt button and note corners, 12 pt input corners, fully rounded chips and pills. Controls are at least 44 pt.
- **Icons:** Lucide outlines at 24 pt with a 2 pt stroke. Tab labels always show.
- **Motion:** 200–300 ms fades and short slides. With Reduce Motion on, movement becomes a fade.
- **Copy:** use the exact lines in the UX brief's Copy table and the design frames. Sentence case. Never write "safe". Confidence labels are word first ("Very likely, 94%").
- **Accessibility:** verdict chips read in full ("Cats: moderate toxicity"), confidence reads "Very likely, 94 percent", and missing tiles read "Not found yet".
- **Tooling and code rules:**
  - Add Expo-side packages only with `npx expo install <pkg>`, run inside `apps/mobile`.
  - RNTL 14's `render` and `fireEvent` are async, so always write `await render(...)` and `await fireEvent.press(...)`.
- ESLint stays on 9.x: eslint-plugin-react, through eslint-config-expo, crashes on ESLint 10. Never `expo install eslint` without pinning `eslint@^9`.
- Run root-level tools with `pnpm exec` or `pnpm dlx`, not `npx`. The root `devEngines` Deno pin makes `npx` fail with EBADDEVENGINES at the repo root, though `npx expo install` inside `apps/mobile` works.
  - `@tendril/core` has zero runtime dependencies, and every relative import ends in `.ts`.
  - Screens and components take props only. Data comes in through containers in `src/app`.

## Review Focus

1. **Text scaling up to iOS's largest accessibility size.** At 2× Dynamic Type, verdict chips and confidence labels wrap instead of truncating, and buttons grow taller instead of clipping. Tested in Task 6 (chips) and Task 4 (button) by rendering with `maxFontSizeMultiplier` unset and asserting no `numberOfLines` on verdict text.
2. **The "other" pet kind and pets with no name.** A pet check must never print "null" or "undefined". It falls back to "your cat", "your dog" or "your pet", and "other" pets always read Unknown. Tested in Task 1.
3. **Dark mode chip text.** Chip and badge text must switch to #0E1A13 in dark mode, or white text sits on light chips. Tested in Task 6.
4. **A catalog frame id with no registration** (a typo, or an unbuilt frame). `/catalog/<id>` must show "No frame <id>" with the registered ids, not crash or show a blank screen. Tested in Task 3.
5. **Sheet dismissal.** A backdrop tap, the close button and Android back must all call `onClose` exactly once. Tested in Task 5.

---

### Task 1: Core design tokens and pet toxicity wording

**Files:**
- Create:
  - `packages/core/src/tokens.ts`
  - `packages/core/src/toxicity.ts`
- Modify: `packages/core/src/index.ts`
- Test:
  - `packages/core/src/tokens.test.ts`
  - `packages/core/src/toxicity.test.ts`

**Interfaces:**
- Consumes: `ConfidenceBand` from `./confidence.ts`.
- Produces:
  - from `tokens.ts`:
    - `type Scheme = 'light' | 'dark'`
    - `colors: Record<Scheme, ColorTokens>`, where `ColorTokens` has keys `background`, `surface`, `textPrimary`, `textSecondary`, `border`, `primary`, `onPrimary`, `primaryTint`, `streak`, `danger`, `onChip`, `hairline`, `divider`, `scrim`, `photoButton` and `pressedOverlay`
    - `verdictColors: Record<Scheme, Record<Severity, string>>`
    - `rarityColors: Record<Scheme, Record<RarityTier, string>>`
    - `typeScale: Record<TypeVariant, { family: 'Fraunces' | 'Inter'; weight: '400' | '500' | '600'; italic: boolean; size: number; lineHeight: number }>`
    - `type TypeVariant = 'moment' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'sub' | 'sci' | 'caption'`
    - `space` (4-pt steps), `radius = { card: 16, button: 14, note: 14, input: 12, tile: 14, pill: 999 }`, `motion = { fast: 200, base: 250, slow: 300 }`
  - from `toxicity.ts`:
    - `type Animal = 'cat' | 'dog' | 'other'`
    - `type Severity = 'unknown' | 'none' | 'mild' | 'moderate' | 'severe'`
    - `type RarityTier = 'common' | 'uncommon' | 'rare' | 'legendary'`
    - `animalPlural(animal): 'Cats' | 'Dogs' | 'Other pets'`
    - `severityWord(severity)`: "Unknown", "No known toxicity", "Mild", "Moderate", "Severe"
    - `verdictChipLabel(animal, severity)`, e.g. "Cats: Moderate"
    - `verdictA11yLabel(animal, severity)`, e.g. "Cats: moderate toxicity"
    - `petCheckLine(input: PetCheckInput): string`
    - `likelyMatchNote(band: ConfidenceBand): string | null`
    - `effectiveSeverity(animal, severity | undefined): Severity`, which turns 'other' and missing data into 'unknown'

- [ ] **Step 1: Write the failing tests**

`packages/core/src/toxicity.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  animalPlural,
  effectiveSeverity,
  likelyMatchNote,
  petCheckLine,
  severityWord,
  verdictA11yLabel,
  verdictChipLabel,
} from './toxicity.ts';

describe('verdict labels', () => {
  it('names the animal, then the verdict word', () => {
    expect(verdictChipLabel('cat', 'moderate')).toBe('Cats: Moderate');
    expect(verdictChipLabel('dog', 'none')).toBe('Dogs: No known toxicity');
    expect(verdictChipLabel('cat', 'unknown')).toBe('Cats: Unknown');
    expect(verdictChipLabel('other', 'unknown')).toBe('Other pets: Unknown');
  });
  it('reads in full for screen readers and never says safe', () => {
    expect(verdictA11yLabel('cat', 'moderate')).toBe('Cats: moderate toxicity');
    expect(verdictA11yLabel('dog', 'severe')).toBe('Dogs: severe toxicity');
    expect(verdictA11yLabel('dog', 'none')).toBe('Dogs: no known toxicity');
    expect(verdictA11yLabel('cat', 'unknown')).toBe('Cats: toxicity not reviewed yet');
    for (const s of ['unknown', 'none', 'mild', 'moderate', 'severe'] as const) {
      expect(verdictA11yLabel('cat', s).toLowerCase()).not.toContain('safe');
      expect(severityWord(s).toLowerCase()).not.toContain('safe');
    }
  });
  it('pluralises animals', () => {
    expect(animalPlural('cat')).toBe('Cats');
    expect(animalPlural('dog')).toBe('Dogs');
    expect(animalPlural('other')).toBe('Other pets');
  });
});

describe('effectiveSeverity', () => {
  it('treats other pets and missing data as unknown, never as safe', () => {
    expect(effectiveSeverity('other', 'none')).toBe('unknown');
    expect(effectiveSeverity('cat', undefined)).toBe('unknown');
    expect(effectiveSeverity('dog', 'mild')).toBe('mild');
  });
});

describe('petCheckLine', () => {
  const lily = 'Peace lily can irritate the mouth and cause drooling and vomiting.';
  it('moderate and mild: severity, summary, source', () => {
    expect(
      petCheckLine({ animal: 'cat', severity: 'moderate', summary: lily, sourceName: 'ASPCA', petName: 'Miso' }),
    ).toBe('Moderate for cats. Peace lily can irritate the mouth and cause drooling and vomiting. Source: ASPCA.');
  });
  it('severe tells you to call the vet', () => {
    expect(
      petCheckLine({
        animal: 'cat',
        severity: 'severe',
        summary: 'Easter lily can cause kidney failure.',
        sourceName: 'ASPCA',
        petName: 'Miso',
      }),
    ).toBe('Severe for cats. Easter lily can cause kidney failure. Call your vet now.');
  });
  it('no known toxicity names the source and the general caveat', () => {
    expect(
      petCheckLine({ animal: 'cat', severity: 'none', summary: null, sourceName: 'ASPCA', petName: 'Miso' }),
    ).toBe('No known toxicity to cats (ASPCA). Eating any plant can still cause vomiting or an upset stomach.');
  });
  it('unknown uses the pet name, falling back to the animal, never null', () => {
    expect(
      petCheckLine({ animal: 'cat', severity: 'unknown', summary: null, sourceName: null, petName: 'Miso' }),
    ).toBe('Not reviewed yet. Keep it away from Miso until we know more.');
    expect(
      petCheckLine({ animal: 'dog', severity: 'unknown', summary: null, sourceName: null, petName: null }),
    ).toBe('Not reviewed yet. Keep it away from your dog until we know more.');
    expect(
      petCheckLine({ animal: 'other', severity: 'none', summary: null, sourceName: 'ASPCA', petName: null }),
    ).toBe('Not reviewed yet. Keep it away from your pet until we know more.');
  });
  it('falls back gracefully when a reviewed verdict has no summary or source', () => {
    const line = petCheckLine({ animal: 'dog', severity: 'mild', summary: null, sourceName: null, petName: 'Bran' });
    expect(line).toBe('Mild for dogs.');
    expect(line).not.toMatch(/null|undefined/);
  });
});

describe('likelyMatchNote', () => {
  it('only appears when the match is not very likely', () => {
    expect(likelyMatchNote('very_likely')).toBeNull();
    expect(likelyMatchNote('likely')).toBe('This depends on the match. Confirm the plant to be sure.');
    expect(likelyMatchNote('not_sure')).toBe('This depends on the match. Confirm the plant to be sure.');
  });
});
```

`packages/core/src/tokens.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { colors, radius, rarityColors, typeScale, verdictColors } from './tokens.ts';

describe('tokens', () => {
  it('match the UX brief exactly', () => {
    expect(colors.light).toMatchObject({
      background: '#FBFAF6', surface: '#FFFFFF', textPrimary: '#1D2420', textSecondary: '#56605A',
      border: '#7F8983', primary: '#2E6B4E', onPrimary: '#FFFFFF', primaryTint: '#E6F0EA',
      streak: '#A36100', danger: '#9B1C1C', onChip: '#FFFFFF',
    });
    expect(colors.dark).toMatchObject({
      background: '#121714', surface: '#1B221E', textPrimary: '#E8EEEA', textSecondary: '#A9B5AE',
      border: '#69756E', primary: '#7BC79C', onPrimary: '#0E1A13', primaryTint: '#1E3328',
      streak: '#F2B35C', danger: '#F2A3A3', onChip: '#0E1A13',
    });
    expect(verdictColors.light).toEqual({
      unknown: '#5F6B66', none: '#2B6A45', mild: '#8A5A00', moderate: '#B3401F', severe: '#9B1C1C',
    });
    expect(verdictColors.dark).toEqual({
      unknown: '#B9C3BE', none: '#86CFA1', mild: '#E6B85C', moderate: '#F0A07F', severe: '#F2A3A3',
    });
    expect(rarityColors.light).toEqual({
      common: '#5E6E66', uncommon: '#2F7D6D', rare: '#3F5BA9', legendary: '#8C6A12',
    });
    expect(rarityColors.dark).toEqual({
      common: '#B4C0B9', uncommon: '#7FCDB9', rare: '#A9B8F0', legendary: '#E3C26A',
    });
  });
  it('type scale follows Dynamic Type defaults and never goes below 11 pt', () => {
    expect(typeScale.moment).toEqual({ family: 'Fraunces', weight: '600', italic: false, size: 34, lineHeight: 41 });
    expect(typeScale.title).toEqual({ family: 'Fraunces', weight: '600', italic: false, size: 28, lineHeight: 34 });
    expect(typeScale.heading).toEqual({ family: 'Inter', weight: '600', italic: false, size: 20, lineHeight: 25 });
    expect(typeScale.body).toEqual({ family: 'Inter', weight: '400', italic: false, size: 17, lineHeight: 22 });
    expect(typeScale.bodyStrong).toEqual({ family: 'Inter', weight: '600', italic: false, size: 17, lineHeight: 22 });
    expect(typeScale.sub).toEqual({ family: 'Inter', weight: '400', italic: false, size: 15, lineHeight: 21 });
    expect(typeScale.sci).toEqual({ family: 'Inter', weight: '400', italic: true, size: 15, lineHeight: 20 });
    expect(typeScale.caption).toEqual({ family: 'Inter', weight: '500', italic: false, size: 13, lineHeight: 18 });
    for (const v of Object.values(typeScale)) expect(v.size).toBeGreaterThanOrEqual(11);
  });
  it('shapes', () => {
    expect(radius).toEqual({ card: 16, button: 14, note: 14, input: 12, tile: 14, pill: 999 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/core test`
Expected: FAIL, because `./toxicity.ts` and `./tokens.ts` don't exist yet.

- [ ] **Step 3: Implement `toxicity.ts`**

```ts
import type { ConfidenceBand } from './confidence.ts';

export type Animal = 'cat' | 'dog' | 'other';
export type Severity = 'unknown' | 'none' | 'mild' | 'moderate' | 'severe';
export type RarityTier = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface PetCheckInput {
  animal: Animal;
  severity: Severity;
  /** Curated one-sentence summary, e.g. "Peace lily can irritate the mouth…". */
  summary: string | null;
  sourceName: string | null;
  petName: string | null;
}

const PLURAL: Record<Animal, 'Cats' | 'Dogs' | 'Other pets'> = {
  cat: 'Cats',
  dog: 'Dogs',
  other: 'Other pets',
};
const SINGULAR: Record<Animal, string> = { cat: 'cat', dog: 'dog', other: 'pet' };
const WORD: Record<Severity, string> = {
  unknown: 'Unknown',
  none: 'No known toxicity',
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
};
const A11Y: Record<Severity, string> = {
  unknown: 'toxicity not reviewed yet',
  none: 'no known toxicity',
  mild: 'mild toxicity',
  moderate: 'moderate toxicity',
  severe: 'severe toxicity',
};

export function animalPlural(animal: Animal): 'Cats' | 'Dogs' | 'Other pets' {
  return PLURAL[animal];
}

export function severityWord(severity: Severity): string {
  return WORD[severity];
}

/** Toxicity data covers cats and dogs only; anything else, or missing data, is unknown, never safe. */
export function effectiveSeverity(animal: Animal, severity: Severity | undefined): Severity {
  if (animal === 'other' || severity === undefined) return 'unknown';
  return severity;
}

export function verdictChipLabel(animal: Animal, severity: Severity): string {
  return `${PLURAL[animal]}: ${WORD[effectiveSeverity(animal, severity)]}`;
}

export function verdictA11yLabel(animal: Animal, severity: Severity): string {
  return `${PLURAL[animal]}: ${A11Y[effectiveSeverity(animal, severity)]}`;
}

/** The one plain line under each pet's verdict chip, as written in the UX brief's Copy table. */
export function petCheckLine(input: PetCheckInput): string {
  const severity = effectiveSeverity(input.animal, input.severity);
  const plural = PLURAL[input.animal].toLowerCase();
  if (severity === 'unknown') {
    const who = input.petName ?? `your ${SINGULAR[input.animal]}`;
    return `Not reviewed yet. Keep it away from ${who} until we know more.`;
  }
  if (severity === 'none') {
    const source = input.sourceName ? ` (${input.sourceName})` : '';
    return `No known toxicity to ${plural}${source}. Eating any plant can still cause vomiting or an upset stomach.`;
  }
  const parts = [`${WORD[severity]} for ${plural}.`];
  if (input.summary) parts.push(input.summary);
  if (severity === 'severe') parts.push('Call your vet now.');
  else if (input.sourceName) parts.push(`Source: ${input.sourceName}.`);
  return parts.join(' ');
}

export function likelyMatchNote(band: ConfidenceBand): string | null {
  return band === 'very_likely' ? null : 'This depends on the match. Confirm the plant to be sure.';
}
```

- [ ] **Step 4: Implement `tokens.ts`**

```ts
import type { RarityTier, Severity } from './toxicity.ts';

export type Scheme = 'light' | 'dark';

export interface ColorTokens {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  primary: string;
  onPrimary: string;
  primaryTint: string;
  streak: string;
  /** Severe's colour, doubling as the danger colour for destructive buttons. */
  danger: string;
  /** Text on verdict chips and rarity badges. */
  onChip: string;
  hairline: string;
  divider: string;
  scrim: string;
  photoButton: string;
  pressedOverlay: string;
}

export const colors: Record<Scheme, ColorTokens> = {
  light: {
    background: '#FBFAF6',
    surface: '#FFFFFF',
    textPrimary: '#1D2420',
    textSecondary: '#56605A',
    border: '#7F8983',
    primary: '#2E6B4E',
    onPrimary: '#FFFFFF',
    primaryTint: '#E6F0EA',
    streak: '#A36100',
    danger: '#9B1C1C',
    onChip: '#FFFFFF',
    hairline: 'rgba(127,137,131,0.28)',
    divider: 'rgba(127,137,131,0.18)',
    scrim: 'rgba(18,23,20,0.45)',
    photoButton: 'rgba(18,23,20,0.6)',
    pressedOverlay: 'rgba(29,36,32,0.22)',
  },
  dark: {
    background: '#121714',
    surface: '#1B221E',
    textPrimary: '#E8EEEA',
    textSecondary: '#A9B5AE',
    border: '#69756E',
    primary: '#7BC79C',
    onPrimary: '#0E1A13',
    primaryTint: '#1E3328',
    streak: '#F2B35C',
    danger: '#F2A3A3',
    onChip: '#0E1A13',
    hairline: 'rgba(105,117,110,0.45)',
    divider: 'rgba(105,117,110,0.4)',
    scrim: 'rgba(18,23,20,0.45)',
    photoButton: 'rgba(18,23,20,0.6)',
    pressedOverlay: 'rgba(14,26,19,0.2)',
  },
};

export const verdictColors: Record<Scheme, Record<Severity, string>> = {
  light: { unknown: '#5F6B66', none: '#2B6A45', mild: '#8A5A00', moderate: '#B3401F', severe: '#9B1C1C' },
  dark: { unknown: '#B9C3BE', none: '#86CFA1', mild: '#E6B85C', moderate: '#F0A07F', severe: '#F2A3A3' },
};

export const rarityColors: Record<Scheme, Record<RarityTier, string>> = {
  light: { common: '#5E6E66', uncommon: '#2F7D6D', rare: '#3F5BA9', legendary: '#8C6A12' },
  dark: { common: '#B4C0B9', uncommon: '#7FCDB9', rare: '#A9B8F0', legendary: '#E3C26A' },
};

export type TypeVariant = 'moment' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'sub' | 'sci' | 'caption';

export interface TypeStyle {
  family: 'Fraunces' | 'Inter';
  weight: '400' | '500' | '600';
  italic: boolean;
  size: number;
  lineHeight: number;
}

export const typeScale: Record<TypeVariant, TypeStyle> = {
  moment: { family: 'Fraunces', weight: '600', italic: false, size: 34, lineHeight: 41 },
  title: { family: 'Fraunces', weight: '600', italic: false, size: 28, lineHeight: 34 },
  heading: { family: 'Inter', weight: '600', italic: false, size: 20, lineHeight: 25 },
  body: { family: 'Inter', weight: '400', italic: false, size: 17, lineHeight: 22 },
  bodyStrong: { family: 'Inter', weight: '600', italic: false, size: 17, lineHeight: 22 },
  sub: { family: 'Inter', weight: '400', italic: false, size: 15, lineHeight: 21 },
  sci: { family: 'Inter', weight: '400', italic: true, size: 15, lineHeight: 20 },
  caption: { family: 'Inter', weight: '500', italic: false, size: 13, lineHeight: 18 },
};

/** 4 pt grid. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48 } as const;
export const radius = { card: 16, button: 14, note: 14, input: 12, tile: 14, pill: 999 } as const;
export const motion = { fast: 200, base: 250, slow: 300 } as const;
```

Update `packages/core/src/index.ts`:
```ts
export * from './confidence.ts';
export * from './toxicity.ts';
export * from './tokens.ts';
```

- [ ] **Step 5: Run the tests and typecheck to verify they pass**

Run: `pnpm --filter @tendril/core test && pnpm --filter @tendril/core typecheck`
Expected: every test passes and tsc reports no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): add design tokens and pet toxicity wording"
```

---

### Task 2: Core domain types, copy and sample data

**Files:**
- Create:
  - `packages/core/src/domain.ts`
  - `packages/core/src/quota.ts`
  - `packages/core/src/copy.ts`
  - `packages/core/src/fixtures/aoife.ts`
  - `packages/core/src/fixtures/index.ts`
- Modify: `packages/core/src/index.ts`
- Test:
  - `packages/core/src/quota.test.ts`
  - `packages/core/src/copy.test.ts`
  - `packages/core/src/fixtures/aoife.test.ts`

**Interfaces:**
- Consumes: `Animal`, `Severity` and `RarityTier` from `./toxicity.ts`; `toPercent` from `./confidence.ts`.
- Produces: everything below, exported from `@tendril/core`. Phase 1B screens and Phase 2 backend contracts use these exact names.

`packages/core/src/domain.ts` (write exactly):
```ts
import type { Animal, RarityTier, Severity } from './toxicity.ts';

/** Calendar date, YYYY-MM-DD, in the user's timezone. */
export type IsoDate = string;
export type Plan = 'free' | 'premium';
export type QuotaKind = 'identification' | 'diagnosis';
export type Organ = 'leaf' | 'flower' | 'whole';
export type CaptureSource = 'camera' | 'gallery';
export type PlaceType = 'shop' | 'garden_park' | 'wild';
export type LightLevel = 'bright' | 'medium' | 'low' | 'unknown';
export type PotMaterial = 'plastic' | 'terracotta' | 'ceramic' | 'unknown';
export type Drainage = 'yes' | 'no' | 'unknown';
export type PlantStatus = 'alive' | 'dead' | 'given_away';
export type PlantSource = 'scan' | 'label_qr' | 'gift' | 'manual';
export type LeafState = 'healthy' | 'yellowing' | 'drooping' | 'brown_tips' | 'spots';
export type PointsStatus = 'none' | 'processing' | 'awarded' | 'held' | 'no_points';
export type NoPointsReason = 'gallery' | 'integrity' | 'time_skew' | 'location_off' | 'duplicate' | 'daily_cap';

export interface Pet { id: string; animal: Animal; name: string | null }
export interface Vet { name: string; phone: string }

export interface SpeciesRef {
  id: string;
  commonName: string;
  scientificName: string;
  rarity: RarityTier;
  sensitive: boolean;
  imageUrl: string | null;
}

export interface ToxicityEntry {
  animal: 'cat' | 'dog';
  severity: Severity;
  summary: string | null;
  symptoms: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
}

export interface CareBasics { light: string; soilCheck: string; warmth: string | null }

export interface QuotaState { kind: QuotaKind; used: number; limit: number; resetsOn: IsoDate; plan: Plan }

export interface PlantSetup {
  nickname: string;
  room: string | null;
  light: LightLevel;
  potMaterial: PotMaterial;
  potSizeCm: number | null;
  drainage: Drainage;
  indoor: boolean;
}

export type PlantCareState = 'due' | 'overdue' | 'ok' | 'paused' | 'closed';

export interface PlantSummary {
  id: string;
  nickname: string;
  species: SpeciesRef;
  room: string | null;
  status: PlantStatus;
  careState: PlantCareState;
  nextCheckOn: IsoDate | null;
  /** e.g. "1 of 2 dry checks" while watering is paused by a diagnosis. */
  pausedNote: string | null;
  photoUrl: string | null;
}

export interface CarePlanLine { icon: 'sprout' | 'sun' | 'droplet' | 'thermometer'; title: string; detail: string }
export interface HistoryEntry { label: string; on: IsoDate }

export interface PlantDetail extends PlantSummary {
  setup: PlantSetup;
  matchProbability: number | null;
  carePlan: CarePlanLine[];
  toxicity: ToxicityEntry[];
  history: HistoryEntry[];
  statusOn: IsoDate | null;
  deathCause: string | null;
}

export type TaskKind = 'check' | 'water';
export interface CareTask {
  id: string;
  plantId: string;
  plantNickname: string;
  room: string | null;
  kind: TaskKind;
  dueOn: IsoDate;
  status: 'due' | 'overdue' | 'done';
  photoUrl: string | null;
}

export type DayMark = 'checked' | 'freeze' | 'missed' | 'empty';
export interface StreakSummary {
  careDays: number;
  careState: 'active' | 'last_day' | 'freeze_used' | 'broken';
  lastBrokenLength: number | null;
  discoveryWeeks: number;
  freezesHeld: number;
  winterMode: boolean;
  winterModeAvailable: boolean;
  /** Last 28 days, oldest first. */
  calendar: DayMark[];
}

export interface LeagueStanding { rank: number; of: number; points: number; daysLeft: number }

export interface TodaySummary {
  dateLabel: string;
  streak: StreakSummary;
  tasks: CareTask[];
  league: LeagueStanding | null;
  identifications: QuotaState;
  hasPlants: boolean;
  nextCheck: { plantNickname: string; on: IsoDate } | null;
}

export interface Suggestion { species: SpeciesRef; probability: number; referenceImageUrl: string | null }

export type ResultState = 'identified' | 'not_a_plant' | 'offline' | 'error';
export interface DiagnosisResult {
  id: string;
  conditionName: string;
  probability: number;
  explanation: string;
  planChange: { title: string; detail: string } | null;
}

export interface ScanResult {
  observationId: string;
  state: ResultState;
  photoUrls: string[];
  suggestions: Suggestion[];
  captureSource: CaptureSource;
  care: CareBasics | null;
  toxicity: ToxicityEntry[];
  diagnosis: DiagnosisResult | null;
}

export interface SetProgress { setId: string; name: string; found: number; total: number }
export interface Outcome {
  pointsStatus: PointsStatus;
  points: number;
  noPointsReason: NoPointsReason | null;
  newToPlantdex: boolean;
  plantdexCount: number;
  sets: SetProgress[];
}

export interface PlantdexEntry { species: SpeciesRef; category: 'houseplant' | 'wild'; findsCount: number; photoUrl: string | null }
export interface CollectionSet {
  id: string;
  name: string;
  preview: string;
  found: number;
  total: number;
  tiles: { species: SpeciesRef | null; found: boolean }[];
}
export interface FindListItem { observationId: string; species: SpeciesRef; placeType: PlaceType; foundOn: IsoDate; lat: number | null; lng: number | null }
export interface Badge { id: string; name: string; description: string; earned: boolean; progress: { current: number; target: number } | null }

export interface BoardRow { rank: number; handle: string; points: number; isYou: boolean; pending: boolean }
export interface LeagueBoard { daysLeft: number; resetsOn: string; rows: BoardRow[]; joined: boolean }
export interface WeekResult { rank: number | null; of: number | null; points: number; bestFind: { name: string; rarity: RarityTier } | null }

export interface Profile {
  handle: string;
  displayName: string;
  plantdexCount: number;
  careStreakDays: number;
  discoveryStreakWeeks: number;
  badgesEarned: string[];
}

export interface Entitlement { plan: Plan; source: 'preview' | 'store' | null; activeUntil: IsoDate | null; previewUsed: boolean }

export interface Household {
  id: string;
  name: string;
  members: { name: string; isYou: boolean }[];
  pets: Pet[];
  vet: Vet | null;
}

export interface LabelInfo {
  code: string;
  species: SpeciesRef;
  growerName: string;
  care: CareBasics;
  careLines: string[];
  toxicity: ToxicityEntry[];
}
```

`packages/core/src/quota.ts` interface:
- `QUOTA_LIMITS: Record<Plan, Record<QuotaKind, number>>`, equal to `{ free: { identification: 10, diagnosis: 1 }, premium: { identification: 60, diagnosis: 10 } }`
- `quotaLeft(q: QuotaState): number`, never below 0
- `quotaMeterLabel(q: QuotaState): string`, e.g. "7 of 10 left this month"
- `formatResetDate(iso: IsoDate): string`, e.g. "1 November"
- `limitReachedLine(q: QuotaState): string`

`packages/core/src/copy.ts` interface (fixed strings plus template functions; the plain strings come from the UX brief's Copy table):
- `copy.galleryNote`: "Gallery photos get identified but don't earn points."
- `copy.pointsHeld`: "Points pending review. We check unusual finds before they count."
- `copy.sensitiveSpecies`: "We keep this species' location private to protect it."
- `copy.homeArea`: "Finds near home never appear publicly, not even as an area."
- `copy.previewOffer`: "Try Premium free for 7 days. No payment details, nothing to cancel."
- `copy.notAPlant`: "We couldn't find a plant in this photo. Try again with the plant filling the frame."
- `copy.notSure`: "Try a close photo of one leaf or flower."
- `copy.deleteAccount`: "This deletes your plants, finds, photos and points for good."
- `copy.deleteAccountWithSubscription`: "This deletes your plants, finds, photos and points for good. It doesn't cancel your subscription, so do that first."
- `checkInQuestion(nickname)`: "Is the top of Monty's soil dry?"
- `checkInAnsweredNo(weekday)`: "Good. We'll check again on Friday."
- `streakLastDay(days)`: "Your 12-day streak needs one check-in today."
- `freezeUsed(days)`: "A freeze kept your 12-day streak going."
- `previewEnding()`: "Your Premium preview ends tomorrow. You'll go back to Free, and nothing is charged."
- `likelyResultLine(name, percent)`: "Likely a peace lily, 71%. Compare these two before you add it."
- `veryLikelyResultLine(name, percent)`: "Very likely a peace lily, 94% match."

The fixtures module exports `aoife`, an object holding the UX brief's sample data, typed with the domain types. Its fields (exact values) are listed in Step 1's test.

- [ ] **Step 1: Write the failing tests**

`packages/core/src/quota.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatResetDate, limitReachedLine, QUOTA_LIMITS, quotaLeft, quotaMeterLabel } from './quota.ts';

describe('quota', () => {
  const free = { kind: 'identification', used: 3, limit: 10, resetsOn: '2026-11-01', plan: 'free' } as const;
  it('limits match the architecture doc', () => {
    expect(QUOTA_LIMITS).toEqual({
      free: { identification: 10, diagnosis: 1 },
      premium: { identification: 60, diagnosis: 10 },
    });
  });
  it('reads "7 of 10 left this month"', () => {
    expect(quotaLeft(free)).toBe(7);
    expect(quotaMeterLabel(free)).toBe('7 of 10 left this month');
  });
  it('never goes negative', () => {
    expect(quotaLeft({ ...free, used: 12 })).toBe(0);
    expect(quotaMeterLabel({ ...free, used: 12 })).toBe('0 of 10 left this month');
  });
  it('formats the reset date as day and month', () => {
    expect(formatResetDate('2026-11-01')).toBe('1 November');
    expect(formatResetDate('2027-01-31')).toBe('31 January');
  });
  it('limit lines differ for free and premium at its cap', () => {
    expect(limitReachedLine({ ...free, used: 10 })).toBe(
      "You've used your 10 free identifications this month. More arrive on 1 November, or get 60 a month with Premium.",
    );
    expect(limitReachedLine({ ...free, used: 60, limit: 60, plan: 'premium' })).toBe(
      "You've used your 60 identifications this month. More arrive on 1 November.",
    );
    expect(limitReachedLine({ kind: 'diagnosis', used: 1, limit: 1, resetsOn: '2026-11-01', plan: 'free' })).toBe(
      "You've used this month's diagnosis. More arrive on 1 November, or get 10 a month with Premium.",
    );
  });
});
```

`packages/core/src/copy.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  checkInAnsweredNo,
  checkInQuestion,
  copy,
  freezeUsed,
  likelyResultLine,
  streakLastDay,
  veryLikelyResultLine,
} from './copy.ts';

describe('copy', () => {
  it('uses the UX brief lines', () => {
    expect(checkInQuestion('Monty')).toBe("Is the top of Monty's soil dry?");
    expect(checkInAnsweredNo('Friday')).toBe("Good. We'll check again on Friday.");
    expect(streakLastDay(12)).toBe('Your 12-day streak needs one check-in today.');
    expect(freezeUsed(12)).toBe('A freeze kept your 12-day streak going.');
    expect(veryLikelyResultLine('peace lily', 94)).toBe('Very likely a peace lily, 94% match.');
    expect(likelyResultLine('peace lily', 71)).toBe('Likely a peace lily, 71%. Compare these two before you add it.');
    expect(copy.galleryNote).toBe("Gallery photos get identified but don't earn points.");
  });
  it('never uses the word safe', () => {
    for (const v of Object.values(copy)) expect(v.toLowerCase()).not.toMatch(/\bsafe\b/);
  });
});
```

`packages/core/src/fixtures/aoife.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { aoife } from './aoife.ts';

describe('aoife fixture (UX brief sample data)', () => {
  it('has the household from the brief', () => {
    expect(aoife.profile.handle).toBe('aoifegrows');
    expect(aoife.household.pets.map((p) => [p.name, p.animal])).toEqual([['Miso', 'cat'], ['Bran', 'dog']]);
  });
  it('has Monty, Spidey and Lily with Monty showing Unknown toxicity', () => {
    expect(aoife.plants.map((p) => [p.nickname, p.species.commonName, p.room])).toEqual([
      ['Monty', 'Swiss cheese plant', 'Living room'],
      ['Spidey', 'Spider plant', 'Kitchen'],
      ['Lily', 'Peace lily', 'Bedroom'],
    ]);
    const monty = aoife.plantDetails['monty'];
    expect(monty?.toxicity.every((t) => t.severity === 'unknown')).toBe(true);
  });
  it('has the quota, streaks, league and collection numbers', () => {
    expect(aoife.today.identifications).toMatchObject({ used: 3, limit: 10, resetsOn: '2026-11-01', plan: 'free' });
    expect(aoife.today.streak).toMatchObject({ careDays: 12, discoveryWeeks: 3, freezesHeld: 1 });
    expect(aoife.today.league).toEqual({ rank: 4, of: 20, points: 340, daysLeft: 3 });
    expect(aoife.profile.plantdexCount).toBe(37);
    expect(aoife.sets.map((s) => [s.name, s.found, s.total])).toEqual([
      ['Irish hedgerow', 4, 8],
      ['Easy-care houseplants', 3, 6],
    ]);
  });
  it('has the peace lily scan result: very likely 94%, flamingo flower 3%', () => {
    const r = aoife.scanResults['peace-lily-very-likely'];
    expect(r?.suggestions.map((s) => [s.species.commonName, s.probability])).toEqual([
      ['Peace lily', 0.94],
      ['Flamingo flower', 0.03],
    ]);
  });
  it('peace lily toxicity matches the ASPCA lines', () => {
    const lily = aoife.speciesToxicity['peace-lily'];
    expect(lily?.find((t) => t.animal === 'cat')).toMatchObject({
      severity: 'moderate',
      summary: 'Peace lily can irritate the mouth and cause drooling and vomiting.',
      sourceName: 'ASPCA',
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/core test`
Expected: FAIL, because the modules don't exist yet.

- [ ] **Step 3: Implement `domain.ts`** exactly as written in the Interfaces block.

- [ ] **Step 4: Implement `quota.ts` and `copy.ts`**

`packages/core/src/quota.ts`:
```ts
import type { IsoDate, Plan, QuotaKind, QuotaState } from './domain.ts';

export const QUOTA_LIMITS: Record<Plan, Record<QuotaKind, number>> = {
  free: { identification: 10, diagnosis: 1 },
  premium: { identification: 60, diagnosis: 10 },
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function quotaLeft(q: QuotaState): number {
  return Math.max(0, q.limit - q.used);
}

export function quotaMeterLabel(q: QuotaState): string {
  return `${quotaLeft(q)} of ${q.limit} left this month`;
}

/** "1 November". Dates are calendar dates (YYYY-MM-DD), so no timezone conversion. */
export function formatResetDate(iso: IsoDate): string {
  const [, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS[(month ?? 1) - 1]}`;
}

export function limitReachedLine(q: QuotaState): string {
  const when = formatResetDate(q.resetsOn);
  const premiumLimit = QUOTA_LIMITS.premium[q.kind];
  if (q.kind === 'diagnosis') {
    return q.plan === 'premium'
      ? `You've used your ${q.limit} diagnoses this month. More arrive on ${when}.`
      : `You've used this month's diagnosis. More arrive on ${when}, or get ${premiumLimit} a month with Premium.`;
  }
  return q.plan === 'premium'
    ? `You've used your ${q.limit} identifications this month. More arrive on ${when}.`
    : `You've used your ${q.limit} free identifications this month. More arrive on ${when}, or get ${premiumLimit} a month with Premium.`;
}
```

`packages/core/src/copy.ts`:
```ts
/** Fixed lines from the UX brief's Copy table. Never use the word "safe". */
export const copy = {
  galleryNote: "Gallery photos get identified but don't earn points.",
  pointsHeld: 'Points pending review. We check unusual finds before they count.',
  sensitiveSpecies: "We keep this species' location private to protect it.",
  homeArea: 'Finds near home never appear publicly, not even as an area.',
  previewOffer: 'Try Premium free for 7 days. No payment details, nothing to cancel.',
  notAPlant: "We couldn't find a plant in this photo. Try again with the plant filling the frame.",
  notSure: 'Try a close photo of one leaf or flower.',
  deleteAccount: 'This deletes your plants, finds, photos and points for good.',
  deleteAccountWithSubscription:
    "This deletes your plants, finds, photos and points for good. It doesn't cancel your subscription, so do that first.",
} as const;

export const checkInQuestion = (nickname: string) => `Is the top of ${nickname}'s soil dry?`;
export const checkInAnsweredNo = (weekday: string) => `Good. We'll check again on ${weekday}.`;
export const streakLastDay = (days: number) => `Your ${days}-day streak needs one check-in today.`;
export const freezeUsed = (days: number) => `A freeze kept your ${days}-day streak going.`;
export const previewEnding = () =>
  "Your Premium preview ends tomorrow. You'll go back to Free, and nothing is charged.";
export const veryLikelyResultLine = (name: string, percent: number) =>
  `Very likely a ${name}, ${percent}% match.`;
export const likelyResultLine = (name: string, percent: number) =>
  `Likely a ${name}, ${percent}%. Compare these two before you add it.`;
```

- [ ] **Step 5: Implement the fixture**

`packages/core/src/fixtures/aoife.ts` exports `const aoife` with these keys. Use the design frames for any value not listed here.
- `profile: Profile`: handle `aoifegrows`, displayName `Aoife`, plantdexCount 37, careStreakDays 12, discoveryStreakWeeks 3, badgesEarned `['First find', 'Hedgerow half']`.
- `household: Household`: id `our-flat`, name `Our flat`, members `[{ name: 'Aoife', isYou: true }]`, pets Miso (cat) and Bran (dog), vet `null`.
- `households: { id: string; name: string }[]`: `Our flat` and `Mam's house`, with a typographic apostrophe, "Mam’s house" (frame 4i).
- `species: Record<string, SpeciesRef>`, keyed by slug, with:
  - Swiss cheese plant (*Monstera deliciosa*, common)
  - spider plant (*Chlorophytum comosum*, common)
  - peace lily (*Spathiphyllum*, common)
  - flamingo flower (*Anthurium andraeanum*, common)
  - Easter lily (*Lilium longiflorum*, common)
  - Boston fern (*Nephrolepis exaltata*, common)
  - foxglove (*Digitalis purpurea*, uncommon)
  - gorse (*Ulex europaeus*, common)
  - primrose (*Primula vulgaris*, common)
  - hawthorn (*Crataegus monogyna*, common)
  - bluebell (*Hyacinthoides non-scripta*, rare)
  - early purple orchid (*Orchis mascula*, rare, `sensitive: true`)

  Every `imageUrl` is `null`.
- `speciesToxicity: Record<string, ToxicityEntry[]>`, with cat and dog entries for each of these:
  - spider plant: none / none, source ASPCA, URL `https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants/spider-plant`
  - peace lily, source ASPCA, URL `…/peace-lily`:
    - cat: moderate, summary "Peace lily can irritate the mouth and cause drooling and vomiting."
    - dog: moderate, summary "Peace lily can irritate the mouth and cause drooling, vomiting and trouble swallowing."
    - symptoms (both): "Mouth irritation, drooling, vomiting and trouble swallowing."
  - Easter lily, source ASPCA:
    - cat: severe, summary "Easter lily can cause kidney failure."
    - dog: none
  - Swiss cheese plant, bluebell and early purple orchid: unknown for both animals, with null summary and source. The brief shows Monty as Unknown to demonstrate that state.
- `plants: PlantSummary[]`:
  - Monty: living room, careState `due`, nextCheckOn `2026-10-03`
  - Spidey: kitchen, careState `overdue`, nextCheckOn `2026-10-02`
  - Lily: bedroom, careState `ok`, nextCheckOn `2026-10-05`
- `plantDetails: Record<string, PlantDetail>`, keyed `monty`, `lily-given-away` and `fern-dead`:
  - `monty`: matchProbability 0.96. Care plan lines:
    - "Check the soil every 7 days" / "Basic schedule for this species"
    - "Bright, indirect light" / "From your setup answers"
    - "24 cm plastic pot, drains" / "Water only when the top is dry"

    History: "Soil not dry yet" 2026-09-30, "Watered" 2026-09-26, "Added from a scan" 2026-08-02. Setup: light bright, plastic, 24 cm, drains yes, indoor.
  - `lily-given-away`: status `given_away`, statusOn 2026-09-12. History: "Given away" 2026-09-12, "Watered" 2026-09-06, "Added from a scan" 2026-06-03.
  - `fern-dead`: nickname Fern, Boston fern, status `dead`, statusOn 2026-08-20, deathCause "too dry". History: "Died · too dry" 2026-08-20, "Soil dry" 2026-08-14.
- `today: TodaySummary`:
  - dateLabel "Saturday 3 October"
  - streak: careDays 12, careState `last_day`, discoveryWeeks 3, freezesHeld 1, winterMode false, winterModeAvailable false, calendar of 28 marks with the last 12 `checked` and the rest `empty`
  - tasks, from frame 2e:
    - check Monty, due
    - check Spidey, overdue
    - water Lily, done
  - league `{ rank: 4, of: 20, points: 340, daysLeft: 3 }`
  - identifications `{ kind: 'identification', used: 3, limit: 10, resetsOn: '2026-11-01', plan: 'free' }`
  - hasPlants true
  - nextCheck `{ plantNickname: 'Spidey', on: '2026-10-04' }`
- `scanResults: Record<string, ScanResult>`, keyed:
  - `peace-lily-very-likely`: 0.94 peace lily, 0.03 flamingo flower
  - `peace-lily-likely`: 0.71 peace lily, 0.22 flamingo flower
  - `not-sure`: 0.41 peace lily, 0.32 flamingo flower
  - `not-a-plant`
  - `offline`
  - `error`
  - `foxglove-find`
- `outcomes: Record<string, Outcome>`, keyed:
  - `foxglove-awarded`: +40, Plantdex 38, Irish hedgerow 5 of 8
  - `bluebell-held`
  - `primrose-gallery`
- `plantdex: PlantdexEntry[]`: the frame 2f tiles (foxglove, bluebell, gorse, primrose, hawthorn), plus counts `{ all: 37, houseplants: 21, wild: 16 }` exported as `plantdexCounts`.
- `sets: CollectionSet[]`:
  - Irish hedgerow: 4 of 8. Preview "Foxglove, gorse, primrose, hawthorn…". Tiles: foxglove, gorse, primrose and hawthorn found; 4 missing.
  - Easy-care houseplants: 3 of 6. Preview "Spider plant, peace lily, Swiss cheese plant".
- `finds: FindListItem[]`:
  - foxglove, wild, 2026-09-28
  - gorse, wild, 2026-09-21
  - primrose, garden_park, 2026-04-02
  - lat/lng near Dublin (53.3, -6.2)
- `badges: Badge[]`:
  - First find: earned
  - Hedgerow half: earned
  - Month of care: 12 of 30
  - Bluebell wood: 1 of 3
- `league: LeagueBoard`: daysLeft 3, resetsOn "Monday", joined true. Rows:
  1. hedgehopper, 520
  2. fernandfox, 410
  3. mossbank, 355
  4. aoifegrows, 340 (you)
  5. greenwick, 290
  6. lichenlou, 275
- `friends: LeagueBoard`, rows:
  1. fernandfox, 410
  2. aoifegrows, 340 (you)
  3. siobhanplants, 120
- `weekResult: WeekResult`: `{ rank: 4, of: 20, points: 340, bestFind: { name: 'Foxglove', rarity: 'uncommon' } }`
- `entitlement: Entitlement`: `{ plan: 'free', source: null, activeUntil: null, previewUsed: false }`
- `label: LabelInfo`:
  - code `PL-0001`, growerName "Greenhouse Growers"
  - species peace lily with its toxicity
  - care: light "Bright, indirect", soil check "Every 5 to 7 days", warmth "18 to 27 °C"
  - careLines: "Bright, indirect light", "Check the soil every 5 to 7 days"

`packages/core/src/fixtures/index.ts`:
```ts
export * from './aoife.ts';
```

Add to `packages/core/src/index.ts`:
```ts
export * from './domain.ts';
export * from './quota.ts';
export * from './copy.ts';
export * from './fixtures/index.ts';
```

- [ ] **Step 6: Run the tests and typecheck to verify they pass**

Run: `pnpm --filter @tendril/core test && pnpm --filter @tendril/core typecheck`
Expected: everything passes, including the Phase 0 import-guard test (every relative import ends in `.ts`).

- [ ] **Step 7: Commit**

```bash
git add packages/core/src
git commit -m "feat(core): add domain types, quota rules, copy and UX-brief sample data"
```

---

### Task 3: Theme, typography and the dev catalog

**Files:**
- Create:
  - `apps/mobile/src/theme/ThemeProvider.tsx`
  - `apps/mobile/src/theme/AppText.tsx`
  - `apps/mobile/src/theme/fonts.ts`
  - `apps/mobile/src/theme/index.ts`
  - `apps/mobile/src/catalog/registry.ts`
  - `apps/mobile/src/catalog/CatalogFrame.tsx`
  - `apps/mobile/src/catalog/DeviceChrome.tsx`
  - `apps/mobile/src/app/catalog/index.tsx`
  - `apps/mobile/src/app/catalog/[frame].tsx`
- Modify: `apps/mobile/src/app/_layout.tsx` (load fonts, keep the splash screen up, add ThemeProvider and SafeAreaProvider)
- Test:
  - `apps/mobile/src/theme/AppText.test.tsx`
  - `apps/mobile/src/theme/ThemeProvider.test.tsx`
  - `apps/mobile/src/catalog/registry.test.tsx`

**Interfaces:**
- Consumes: `colors`, `typeScale`, `Scheme` and `TypeVariant` from `@tendril/core`.
- Produces:
  - `ThemeProvider({ scheme?: Scheme; children })`: uses the system scheme unless `scheme` is given.
  - `useTheme(): { scheme: Scheme; c: ColorTokens; verdict: Record<Severity,string>; rarity: Record<RarityTier,string> }`
  - `AppText` props: `{ variant: TypeVariant; color?: keyof ColorTokens | string; lines?: 'body-24'; style?; children; accessibilityLabel?; numberOfLines? }`. `lines='body-24'` switches body to a 24 line height, for body copy blocks.
  - `fontFamilyFor(style: TypeStyle): string`, returning the loaded font key: `Fraunces_600SemiBold`, `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold` or `Inter_400Regular_Italic`.
  - `registerFrame(entry: FrameEntry)` and `getFrame(id)`, where `FrameEntry = { id: string; title: string; scheme?: Scheme; statusBar?: 'dark' | 'light'; render: () => React.ReactElement }`; plus `listFrames()`.
  - `CatalogFrame({ entry })`: a 393×852 box with the iPhone 16 safe-area insets (top 59, bottom 34), DeviceChrome on top (9:41, Dynamic Island, battery and signal, home indicator) and the frame's scheme.
  - Routes `/catalog` (lists the frame ids) and `/catalog/<id>`. Both are reachable only when `__DEV__` or `process.env.EXPO_PUBLIC_CATALOG === '1'`.

- [ ] **Step 1: Install the dependencies**

Inside `apps/mobile`:
```bash
npx expo install @expo-google-fonts/fraunces @expo-google-fonts/inter expo-font react-native-svg lucide-react-native react-native-safe-area-context
```

- [ ] **Step 2: Write the failing tests**

`apps/mobile/src/theme/AppText.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from './ThemeProvider';
import { AppText } from './AppText';

const flat = (el: { props: { style: unknown } }) => StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

describe('AppText', () => {
  it('maps variants to the type scale and loaded font keys', async () => {
    await render(
      <ThemeProvider scheme="light">
        <AppText variant="title">Peace lily</AppText>
        <AppText variant="sci">Spathiphyllum</AppText>
        <AppText variant="caption">7 of 10 left this month</AppText>
      </ThemeProvider>,
    );
    expect(flat(screen.getByText('Peace lily'))).toMatchObject({ fontFamily: 'Fraunces_600SemiBold', fontSize: 28, lineHeight: 34, color: '#1D2420' });
    expect(flat(screen.getByText('Spathiphyllum'))).toMatchObject({ fontFamily: 'Inter_400Regular_Italic', fontSize: 15, lineHeight: 20 });
    expect(flat(screen.getByText('7 of 10 left this month'))).toMatchObject({ fontFamily: 'Inter_500Medium', fontSize: 13 });
  });
  it('uses theme colour names and dark mode', async () => {
    await render(
      <ThemeProvider scheme="dark">
        <AppText variant="body" color="textSecondary">Kitchen</AppText>
      </ThemeProvider>,
    );
    expect(flat(screen.getByText('Kitchen'))).toMatchObject({ color: '#A9B5AE' });
  });
  it('lets text scale with the system setting (no truncation by default)', async () => {
    await render(
      <ThemeProvider scheme="light">
        <AppText variant="caption">Cats: No known toxicity</AppText>
      </ThemeProvider>,
    );
    const el = screen.getByText('Cats: No known toxicity');
    expect(el.props.numberOfLines).toBeUndefined();
    expect(el.props.allowFontScaling).not.toBe(false);
  });
});
```

`apps/mobile/src/theme/ThemeProvider.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider, useTheme } from './ThemeProvider';

function Probe() {
  const t = useTheme();
  return <Text>{`${t.scheme} ${t.c.background} ${t.verdict.moderate} ${t.c.onChip}`}</Text>;
}

describe('ThemeProvider', () => {
  it('serves the forced scheme tokens', async () => {
    await render(<ThemeProvider scheme="dark"><Probe /></ThemeProvider>);
    expect(screen.getByText('dark #121714 #F0A07F #0E1A13')).toBeTruthy();
  });
});
```

`apps/mobile/src/catalog/registry.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { getFrame, listFrames, registerFrame } from './registry';
import { CatalogScreen } from '../app/catalog/[frame]';

describe('catalog registry', () => {
  it('registers and finds frames', () => {
    registerFrame({ id: 'zz-test', title: 'Test frame', render: () => <Text>hello frame</Text> });
    expect(getFrame('zz-test')?.title).toBe('Test frame');
    expect(listFrames().map((f) => f.id)).toContain('zz-test');
  });
  it('renders an unknown id as a helpful message, not a crash', async () => {
    await render(<CatalogScreen frameId="nope" />);
    expect(screen.getByText(/No frame nope/)).toBeTruthy();
  });
  it('renders a registered frame inside device chrome', async () => {
    registerFrame({ id: 'zz-two', title: 'Two', render: () => <Text>inside</Text> });
    await render(<CatalogScreen frameId="zz-two" />);
    expect(screen.getByText('inside')).toBeTruthy();
    expect(screen.getByText('9:41')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/mobile test`
Expected: FAIL, because the modules don't exist yet.

- [ ] **Step 4: Implement the theme**

`apps/mobile/src/theme/fonts.ts`:
```ts
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_400Regular_Italic, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import type { TypeStyle } from '@tendril/core';

export const fontMap = { Fraunces_600SemiBold, Inter_400Regular, Inter_400Regular_Italic, Inter_500Medium, Inter_600SemiBold };

export function fontFamilyFor(s: TypeStyle): keyof typeof fontMap {
  if (s.family === 'Fraunces') return 'Fraunces_600SemiBold';
  if (s.italic) return 'Inter_400Regular_Italic';
  return s.weight === '600' ? 'Inter_600SemiBold' : s.weight === '500' ? 'Inter_500Medium' : 'Inter_400Regular';
}
```

`apps/mobile/src/theme/ThemeProvider.tsx`:
```tsx
import { colors, rarityColors, verdictColors, type ColorTokens, type RarityTier, type Scheme, type Severity } from '@tendril/core';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export interface Theme { scheme: Scheme; c: ColorTokens; verdict: Record<Severity, string>; rarity: Record<RarityTier, string> }

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ scheme, children }: { scheme?: Scheme; children: ReactNode }) {
  const system = useColorScheme();
  const resolved: Scheme = scheme ?? (system === 'dark' ? 'dark' : 'light');
  const value = useMemo<Theme>(
    () => ({ scheme: resolved, c: colors[resolved], verdict: verdictColors[resolved], rarity: rarityColors[resolved] }),
    [resolved],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const t = useContext(ThemeContext);
  if (!t) throw new Error('useTheme must be used inside ThemeProvider');
  return t;
}
```

`apps/mobile/src/theme/AppText.tsx`:
```tsx
import { typeScale, type ColorTokens, type TypeVariant } from '@tendril/core';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { fontFamilyFor } from './fonts';
import { useTheme } from './ThemeProvider';

export interface AppTextProps extends Omit<TextProps, 'style'> {
  variant: TypeVariant;
  /** A theme colour name, or a literal colour for on-photo and on-chip text. */
  color?: keyof ColorTokens | (string & {});
  /** Body copy blocks use a 24 pt line height (design frames' "body" blocks). */
  lines?: 'body-24';
  style?: StyleProp<TextStyle>;
}

export function AppText({ variant, color = 'textPrimary', lines, style, ...rest }: AppTextProps) {
  const { c } = useTheme();
  const t = typeScale[variant];
  const resolved = (c as unknown as Record<string, string>)[color] ?? color;
  return (
    <Text
      {...rest}
      style={[
        { fontFamily: fontFamilyFor(t), fontSize: t.size, lineHeight: lines === 'body-24' ? 24 : t.lineHeight, color: resolved },
        style,
      ]}
    />
  );
}
```

`apps/mobile/src/theme/index.ts`:
```ts
export * from './ThemeProvider';
export * from './AppText';
export * from './fonts';
```

- [ ] **Step 5: Implement the catalog**

`apps/mobile/src/catalog/registry.ts`:
```ts
import type { Scheme } from '@tendril/core';
import type { ReactElement } from 'react';

export interface FrameEntry {
  id: string;
  title: string;
  scheme?: Scheme;
  /** Status bar text colour: light over hero photos and dark screens. */
  statusBar?: 'dark' | 'light';
  render: () => ReactElement;
}

const frames = new Map<string, FrameEntry>();

export function registerFrame(entry: FrameEntry): void {
  frames.set(entry.id, entry);
}
export function getFrame(id: string): FrameEntry | undefined {
  return frames.get(id);
}
export function listFrames(): FrameEntry[] {
  return [...frames.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}
```

`apps/mobile/src/catalog/DeviceChrome.tsx` draws, with absolute positioning over the frame, the elements from any `design/frames/2e.html`:
- **Status bar:** height 54, padding 0 30 0 48. "9:41" in Inter 600 17. The signal bars and battery are react-native-svg copies of the design's two SVGs. Colour is `#1D2420` for dark text, `#FFFFFF` for light.
- **Dynamic Island:** a black pill, 124×36, top 11, centred, radius 20.
- **Home indicator:** 140×5, bottom 8, centred, radius 3, colour `#1D2420`. Use `#E8EEEA` for dark-scheme frames.

Use `pointerEvents="none"`, and set `accessibilityElementsHidden` and `importantForAccessibility="no-hide-descendants"` so screen readers skip it.

`apps/mobile/src/catalog/CatalogFrame.tsx`:
```tsx
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme';
import { DeviceChrome } from './DeviceChrome';
import type { FrameEntry } from './registry';

/** iPhone 16: 393×852 pt, safe areas 59 top and 34 bottom (UX brief). */
const METRICS = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, bottom: 34, left: 0, right: 0 } };

export function CatalogFrame({ entry }: { entry: FrameEntry }) {
  return (
    <ThemeProvider scheme={entry.scheme ?? 'light'}>
      <SafeAreaProvider initialMetrics={METRICS}>
        <View testID="catalog-frame" style={{ width: 393, height: 852, overflow: 'hidden' }}>
          {entry.render()}
          <DeviceChrome scheme={entry.scheme ?? 'light'} statusBar={entry.statusBar ?? (entry.scheme === 'dark' ? 'light' : 'dark')} />
        </View>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
```

`apps/mobile/src/app/catalog/[frame].tsx` exports a named `CatalogScreen({ frameId })`, which the tests use, and a default route component that reads `useLocalSearchParams<{ frame: string }>()` and renders `CatalogScreen`. Both of these routes redirect to `/` unless `__DEV__ || process.env.EXPO_PUBLIC_CATALOG === '1'`.
- An unknown id renders an `AppText` reading `No frame ${frameId}`, followed by the registered ids.
- The screen imports `../../catalog/frames` (create it as an empty module, `export {};`, in this task). Later tasks register their frames there.

`apps/mobile/src/app/catalog/index.tsx` lists `listFrames()` as links to `/catalog/<id>`.

`apps/mobile/src/app/_layout.tsx`:
```tsx
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { fontMap, ThemeProvider } from '../theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts(fontMap);
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck`
Expected: every test passes, the Phase 0 index test included. In jest, `useFonts` comes from `expo-font`, which jest-expo mocks, so fonts report as loaded.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): theme, AppText type scale and dev catalog with iPhone 16 chrome"
```

---

### Task 4: Visual comparison tool

**Files:**
- Create:
  - `tools/visual/package.json`
  - `tools/visual/README.md`
  - `tools/visual/src/shoot-design.ts`
  - `tools/visual/src/shoot-app.ts`
  - `tools/visual/src/compare.ts`
  - `tools/visual/src/serve.ts`
  - `tools/visual/src/chromium.ts`
- Test: `tools/visual/src/compare.test.ts`

**Interfaces:**
- Consumes:
  - `design/claude-design/*.dc.html` (served over HTTP; the dc runtime loads React from unpkg)
  - `design/frames/<id>.html`
  - the mobile web export from `pnpm --filter @tendril/mobile export:web`, run with `EXPO_PUBLIC_CATALOG=1`
- Produces these root scripts:
  - `pnpm visual:design`: renders the inner 393×852 phone screen of every design frame to `design/screens-inner/<id>.png`. This is committed, because it's the comparison baseline.
  - `pnpm visual:app [ids…]`: exports the web build with the catalog on, serves it, and screenshots `/catalog/<id>` at 393×852 (deviceScaleFactor 1) into `design/compare/app/<id>.png`.
  - `pnpm visual:compare [ids…]`: writes `design/compare/<id>.png`, with the design on the left, the app in the middle and a red pixel-diff overlay on the right. It prints `id  diff%` per frame.

  `design/compare/` is git-ignored.
  - `compareImages(a: PNG, b: PNG): { diffPercent: number; diff: PNG }`, exported for tests.

- [ ] **Step 1: Create the package**

`tools/visual/package.json`:
```json
{
  "name": "@tendril/visual",
  "private": true,
  "type": "module",
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit -p ." },
  "devDependencies": {}
}
```

Install: `pnpm --filter @tendril/visual add -D playwright pngjs pixelmatch @types/pngjs vitest@^5 tsx @types/node@^22`, then `pnpm --filter @tendril/visual exec playwright install chromium`.

Add `tools/*` to `pnpm-workspace.yaml` packages.

Add these root scripts:
- `"visual:design": "tsx tools/visual/src/shoot-design.ts"`
- `"visual:app": "tsx tools/visual/src/shoot-app.ts"`
- `"visual:compare": "tsx tools/visual/src/compare.ts"`

`tools/visual/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "types": ["node"] }, "include": ["src"] }
```

- [ ] **Step 2: Write the failing test**

`tools/visual/src/compare.test.ts`:
```ts
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { compareImages } from './compare.ts';

function solid(w: number, h: number, rgb: [number, number, number]): PNG {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) png.data.set([...rgb, 255], i * 4);
  return png;
}

describe('compareImages', () => {
  it('identical images differ by 0%', () => {
    expect(compareImages(solid(10, 10, [251, 250, 246]), solid(10, 10, [251, 250, 246])).diffPercent).toBe(0);
  });
  it('reports the share of differing pixels', () => {
    const a = solid(10, 10, [255, 255, 255]);
    const b = solid(10, 10, [255, 255, 255]);
    for (let i = 0; i < 25; i++) b.data.set([0, 0, 0, 255], i * 4);
    expect(compareImages(a, b).diffPercent).toBeCloseTo(25, 0);
  });
  it('compares only the overlapping area when sizes differ', () => {
    expect(compareImages(solid(10, 10, [1, 1, 1]), solid(12, 8, [1, 1, 1])).diffPercent).toBe(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @tendril/visual test`
Expected: FAIL, because `./compare.ts` doesn't exist yet.

- [ ] **Step 4: Implement**

`tools/visual/src/chromium.ts`:
```ts
import { chromium, type Browser } from 'playwright';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** This WSL box lacks libnss3/libnspr4/libasound without sudo; they live in ~/.cache/tendril-chromium-libs. */
export async function launch(): Promise<Browser> {
  const libs = join(homedir(), '.cache', 'tendril-chromium-libs');
  const env = { ...process.env } as Record<string, string>;
  if (existsSync(libs)) env.LD_LIBRARY_PATH = [libs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  return chromium.launch({ env });
}
```

`tools/visual/src/serve.ts`: `serveDir(dir: string, port: number, spaFallback: boolean): Promise<() => Promise<void>>`. It's a minimal `node:http` static server:
- It serves the correct content types for html, js, css, png, ttf, svg and json.
- With `spaFallback`, unknown paths serve `index.html`.
- It returns a close function.

`tools/visual/src/shoot-design.ts`:
1. Serve `design/claude-design/` on port 8765.
2. For each of the four phone-frame files (`Tendril 2 Hero Screens`, `3 Onboarding`, `4 All Screens`, `6 Dark Mode`), load the page, wait for network idle plus 2.5 s, then select each frame card `.dv-opt[id]`.
3. Inside each card, screenshot the inner phone element, which is the first descendant `div` whose computed width is 393 px and height 852 px. Save it to `design/screens-inner/<id>.png`.
4. Log the count. All 88 frames are expected.

`tools/visual/src/shoot-app.ts`:
1. Run `pnpm --filter @tendril/mobile export:web` with `EXPO_PUBLIC_CATALOG=1` in the environment, unless `--no-build` is passed.
2. Serve `apps/mobile/dist` on port 8766 with the SPA fallback.
3. For each id (default: every id that has a `design/screens-inner/<id>.png`), open `http://127.0.0.1:8766/catalog/<id>` at viewport 393×852 with deviceScaleFactor 1.
4. Wait for `[data-testid="catalog-frame"]` and for fonts (`document.fonts.ready`).
5. Screenshot that element to `design/compare/app/<id>.png`.

`tools/visual/src/compare.ts` exports `compareImages`, and its CLI writes the side-by-side images:
```ts
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export function compareImages(a: PNG, b: PNG): { diffPercent: number; diff: PNG } {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const crop = (src: PNG) => {
    const out = new PNG({ width, height });
    PNG.bitblt(src, out, 0, 0, width, height, 0, 0);
    return out;
  };
  const diff = new PNG({ width, height });
  const changed = pixelmatch(crop(a).data, crop(b).data, diff.data, width, height, { threshold: 0.15 });
  return { diffPercent: (changed / (width * height)) * 100, diff };
}
```

The CLI part:
1. For each id with both images, build a 3-panel PNG (design | app | diff) with 16 px gaps on a `#ECEAE3` background, and write it to `design/compare/<id>.png`.
2. Print `<id>\t<diff%>` sorted by diff, descending.
3. Exit 0.

The diff percentage is a regression guard only. A person reviews the panels.

`tools/visual/README.md` documents the three commands and the libraries workaround.

- [ ] **Step 5: Run the tests, then produce the baseline**

Run: `pnpm --filter @tendril/visual test && pnpm visual:design && ls design/screens-inner | wc -l`
Expected: the tests pass and the count is `88`. Open `design/screens-inner/2e.png` with the Read tool: it must show only the phone screen, with no bezel and no label.

- [ ] **Step 6: End-to-end smoke test with a test frame**

Temporarily register a frame `2e` in `apps/mobile/src/catalog/frames.ts` that renders an `AppText variant="title"` reading "Today" on the background colour. Then run `pnpm visual:app 2e && pnpm visual:compare 2e`.
Expected: `design/compare/2e.png` exists and shows three panels, and the app panel shows "Today" in Fraunces with the 9:41 chrome. **Then remove the temporary registration**, leaving `frames.ts` as `export {};`.

- [ ] **Step 7: Commit**

```bash
git add tools/visual pnpm-workspace.yaml package.json pnpm-lock.yaml design/screens-inner
git commit -m "feat(tools): visual comparison of catalog frames against design renders"
```

---

### Task 5: Icons and layout primitives

**Files:**
- Create in `apps/mobile/src/components/`:
  - `icons.tsx`
  - `Button.tsx`, `Note.tsx`, `EmptyState.tsx`, `PhotoSlot.tsx`
  - `OptionPills.tsx`, `SegmentedControl.tsx`, `RowsCard.tsx`, `TextField.tsx`
  - `Sheet.tsx`, `Snackbar.tsx`
  - `ScreenHeader.tsx`, `BackBar.tsx`, `HeroHeader.tsx`
  - `index.ts`
- Test:
  - `apps/mobile/src/components/Button.test.tsx`
  - `apps/mobile/src/components/Sheet.test.tsx`
  - `apps/mobile/src/components/controls.test.tsx` (pills, segmented control, rows, text field, snackbar, note, empty state)

**Interfaces:**
- Consumes: `useTheme` and `AppText` (Task 3), `radius` and `motion` (core).
- Produces these props. Each component copies its pixel values from the named design frame elements.
  - `icons.tsx` exports `Icon` components from react-native-svg with exactly the design's Lucide paths, each taking `{ size?: number; color: string; strokeWidth?: number }`:
    - `FlameIcon`, `LeafIcon` (rarity leaf), `FlowerIcon` (legendary)
    - `VerdictIcon({ severity })`: question-circle, check-circle, triangle, diamond and octagon, copying the paths in `design/frames/4v.html` and the style tile
    - `TendrilDrawing` (the empty-state line drawing, 132×110, paths from any empty-state frame such as `4a.html`)
    - `FreezeIcon` (the calendar freeze glyph in `4g.html`)
    - tab icons: `CalendarIcon`, `PlantsIcon`, `ScanCameraIcon`, `CollectionIcon`, `TrophyIcon`
  - Generic icons (X, ChevronLeft, ChevronRight, Search, Lock, Info, Check, Plus, Phone, Sun, Droplet, Sprout, ImageIcon, QrCode/ScanQrCode, Cat, Dog, PawPrint, Ban, HeartPulse, CircleCheck, CircleDashed, CircleQuestionMark) come from `lucide-react-native`.
  - `Button({ label, onPress, variant?: 'primary'|'secondary'|'text'|'danger', disabled?, loading?, icon?, accessibilityLabel? })`:
    - height 52 (it grows with text scaling), radius 14, label in Inter 600 17
    - secondary has a 1.5 pt inset `primary` ring
    - pressed: overlay `pressedOverlay`
    - disabled: opacity 0.4
    - loading: a 20 pt spinner ring, with an accessibility label of "<label>, loading"
    - danger uses `danger` and `onChip`
    - styles from the style tile buttons in `design/frames/4bj.html`
  - `Note({ text, tone?: 'tint' | 'dark', icon?: 'info' | 'lock' })`: padding 12/14, radius 14, Inter 400 15/21, 20 pt info icon (from `4b.html`). The `dark` tone uses background `textPrimary` with white text, as in `4e.html`.
  - `EmptyState({ text, children? })`: the tendril drawing in `primary` at 0.35 opacity, with text in Inter 400 17/24, centred, max width 280, padding 48/16/8 (`4a.html`).
  - `PhotoSlot({ uri?: string | null; label: string; height: number; radius?: number })`. With no `uri`, it shows the design's placeholder: a light grey fill with a dashed border and an image icon over the label, copied from the `image-slot` look in `design/screens/2a.png`.
  - `OptionPills({ options: { value: string; label: string }[]; value: string | string[]; onChange; multiple? })`:
    - each pill 44 high, padding 0 16, radius 999, Inter 500 13
    - selected: `primaryTint` background, 1.5 pt `primary` ring, `primary` text
    - unselected: 1.5 pt `border` ring
    - `accessibilityRole="radio"` or `"checkbox"`, with `accessibilityState.checked`
  - `SegmentedControl({ options; value; onChange })`: padding 3, 1 pt `border` ring, items 38 high, selected item `primary` with `onPrimary` text, Inter 600 13 (`4ah.html`). Uses `accessibilityRole="tab"` with selected state.
  - `RowsCard({ rows: Row[] })`, where `Row = { key; title; subtitle?; subtitleItalic?; right?; rightColor?: 'textSecondary'|'primary'|'streak'; lead?: string; highlight?: boolean; onPress? }`:
    - card: `surface`, radius 16, 1 pt `hairline` ring
    - rows: padding 12/16, 1 pt `divider` bottom border, lead column 28 wide in Inter 600 17
    - title in Inter 400 17/22, subtitle in Inter 400 15/20, right text in Inter 500 13/18
    - highlight uses the `primaryTint` background (`4aq.html`)
  - `TextField({ label, value, onChangeText, placeholder?, focused?, error? })`: label in Inter 500 13; field 52 high, radius 12, `surface`, a 1.5 pt `border` ring (2 pt `primary` when focused), padding 0 16, Inter 400 17 (`4au.html`).
  - `Sheet({ visible, title, onClose, children, height?: number | 'auto' })`:
    - a `scrim` backdrop that is pressable and closes the sheet
    - the sheet: `surface`, radius 16 at the top, padding 8 16 42
    - grab handle 36×5, colour `border` at 0.6 opacity
    - title in Inter 600 20/25, plus a 44 pt close button with a 22 pt X icon and accessibility label "Close"
    - Android back calls `onClose`
    - it slides up over 250 ms, or fades when Reduce Motion is on
    - built on RN `Modal` with `transparent`, so it works on web (`4c.html`)
  - `Snackbar({ text, onUndo?, bottomOffset })`: background `textPrimary`, white text in Inter 400 15/21, radius 14, padding 14/16, an underlined "Undo" in 600, and the design's shadow. `accessibilityLiveRegion="polite"`, with `role="status"` on web.
  - `ScreenHeader({ title, avatarLetter, onAvatarPress, subtitle? })`: title in Fraunces 28/34, plus a 44 pt avatar circle in `primaryTint` with the letter in `primary` Inter 600 17. The avatar's accessibility label is "Profile" (`2e.html`).
  - `BackBar({ label, onPress })`: 44 high, 24 pt chevron in `textPrimary`, label in Inter 400 17 `primary`, accessibility label `Back to ${label}` (`4f.html`).
  - `HeroHeader({ photoUri, photoLabel, opacity?, onBack, right?: ReactNode })`:
    - photo area 236 high
    - top scrim 112 high in `scrim`
    - 44 pt back circle at top 60, left 16, in `photoButton` with a white chevron
    - the content sheet starts at y = 212 with a 16 pt top radius
    - export the constant `HERO_CONTENT_TOP = 212` (`4o.html`, `2d.html`)

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/components/Button.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../theme';
import { Button } from './Button';

const wrap = (ui: React.ReactElement, scheme: 'light' | 'dark' = 'light') => render(<ThemeProvider scheme={scheme}>{ui}</ThemeProvider>);

describe('Button', () => {
  it('fires onPress and exposes a button role', async () => {
    const onPress = jest.fn();
    await wrap(<Button label="Add to My Plants" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add to My Plants' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('does not fire when disabled or loading, and says it is loading', async () => {
    const onPress = jest.fn();
    await wrap(<><Button label="Continue" onPress={onPress} disabled /><Button label="Save" onPress={onPress} loading /></>);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save, loading' }));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
  it('danger uses the severe colour with chip text in dark mode', async () => {
    await wrap(<Button label="Delete account" onPress={() => {}} variant="danger" />, 'dark');
    const btn = screen.getByRole('button', { name: 'Delete account' });
    expect(StyleSheet.flatten(btn.props.style)).toMatchObject({ backgroundColor: '#F2A3A3' });
  });
  it('meets the 44 pt minimum and does not clip text', async () => {
    await wrap(<Button label="Call ASPCA Poison Control (888) 426-4435" onPress={() => {}} variant="secondary" />);
    const btn = screen.getByRole('button');
    expect(StyleSheet.flatten(btn.props.style).minHeight).toBeGreaterThanOrEqual(52);
    expect(screen.getByText('Call ASPCA Poison Control (888) 426-4435').props.numberOfLines).toBeUndefined();
  });
});
```

`apps/mobile/src/components/Sheet.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../theme';
import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('shows a title, content and a close button; close and backdrop each call onClose once', async () => {
    const onClose = jest.fn();
    await render(
      <ThemeProvider scheme="light">
        <Sheet visible title="Check-in" onClose={onClose}><Text>Is the top of Monty's soil dry?</Text></Sheet>
      </ThemeProvider>,
    );
    expect(screen.getByText('Check-in')).toBeTruthy();
    expect(screen.getByText("Is the top of Monty's soil dry?")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it('Android back (Modal onRequestClose) calls onClose', async () => {
    const onClose = jest.fn();
    await render(<ThemeProvider scheme="light"><Sheet visible title="Log a find" onClose={onClose}><Text>x</Text></Sheet></ThemeProvider>);
    await fireEvent(screen.getByTestId('sheet-modal'), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('renders nothing when not visible', async () => {
    await render(<ThemeProvider scheme="light"><Sheet visible={false} title="Hidden" onClose={() => {}}><Text>x</Text></Sheet></ThemeProvider>);
    expect(screen.queryByText('Hidden')).toBeNull();
  });
});
```

`apps/mobile/src/components/controls.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../theme';
import { EmptyState, Note, OptionPills, RowsCard, SegmentedControl, Snackbar, TextField } from './index';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

describe('controls', () => {
  it('OptionPills marks the selected option and reports changes', async () => {
    const onChange = jest.fn();
    await wrap(<OptionPills options={[{ value: 'bright', label: 'Bright' }, { value: 'medium', label: 'Medium' }]} value="medium" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Bright' }));
    expect(onChange).toHaveBeenCalledWith('bright');
  });
  it('OptionPills in multiple mode toggles values', async () => {
    const onChange = jest.fn();
    await wrap(<OptionPills multiple options={[{ value: 'yellowing', label: 'Yellowing' }, { value: 'spots', label: 'Spots' }]} value={['spots']} onChange={onChange} />);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Yellowing' }));
    expect(onChange).toHaveBeenCalledWith(['spots', 'yellowing']);
  });
  it('SegmentedControl selects tabs', async () => {
    const onChange = jest.fn();
    await wrap(<SegmentedControl options={[{ value: 'league', label: 'League' }, { value: 'friends', label: 'Friends' }]} value="league" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'League' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Friends' }));
    expect(onChange).toHaveBeenCalledWith('friends');
  });
  it('RowsCard renders lead, title, subtitle and right text; highlight uses the tint', async () => {
    await wrap(<RowsCard rows={[{ key: 'you', lead: '4', title: 'You · @aoifegrows', right: '340', rightColor: 'primary', highlight: true }]} />);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('340')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('row-you').props.style)).toMatchObject({ backgroundColor: '#E6F0EA' });
  });
  it('TextField shows its label and value', async () => {
    await wrap(<TextField label="Handle" value="@siobhanplants" onChangeText={() => {}} focused />);
    expect(screen.getByText('Handle')).toBeTruthy();
    expect(screen.getByDisplayValue('@siobhanplants')).toBeTruthy();
  });
  it('Snackbar offers Undo', async () => {
    const onUndo = jest.fn();
    await wrap(<Snackbar text="Check-in saved." onUndo={onUndo} bottomOffset={106} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
  });
  it('Note and EmptyState render their sentence', async () => {
    await wrap(<><Note text="This didn't use an identification." /><EmptyState text="No plants yet. Scan one, or scan the label it came with." /></>);
    expect(screen.getByText("This didn't use an identification.")).toBeTruthy();
    expect(screen.getByText('No plants yet. Scan one, or scan the label it came with.')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/mobile test`
Expected: FAIL, because the components don't exist yet.

- [ ] **Step 3: Implement each component** to the props above, copying pixel values from the named design frames. Export everything from `components/index.ts`. Use `Pressable` with `accessibilityRole` for every interactive element, and keep every hit area at least 44 pt.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck && pnpm --filter @tendril/mobile lint`
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components
git commit -m "feat(mobile): design-system icons and layout primitives"
```

---

### Task 6: Domain components, part 1 (pet safety, confidence, progress)

**Files:**
- Create in `apps/mobile/src/components/`:
  - `ConfidenceLabel.tsx`, `VerdictChip.tsx`, `PetCheckCard.tsx`, `RarityBadge.tsx`
  - `QuotaMeter.tsx`, `StreakCounter.tsx`, `StreakCalendar.tsx`, `PermissionPrimer.tsx`
- Test: `apps/mobile/src/components/domain1.test.tsx`

**Interfaces:**
- Consumes:
  - from core: `confidenceLabel`, `confidenceA11yLabel`, `bandFor`, `verdictChipLabel`, `verdictA11yLabel`, `petCheckLine`, `likelyMatchNote`, `effectiveSeverity`, `quotaMeterLabel`, `formatResetDate`, `streakLastDay`, `freezeUsed`
  - the Task 5 primitives
- Produces:
  - `ConfidenceLabel({ probability, compact? })`: a pill 28 high, padding 0 10, Inter 500 13.
    - very likely and likely: `primaryTint` background with `primary` text
    - not sure: transparent with a 1.5 pt `border` ring and `textSecondary` text
    - leading 16 pt icon: very likely `CircleCheck`, likely `CircleDashed`, not sure `CircleQuestionMark` (`2a.html`, `2c.html`)
    - text from `confidenceLabel`, accessibility label from `confidenceA11yLabel`
  - `VerdictChip({ animal, severity })`: 32 high, padding 0 12 0 8, radius 999, gap 6, an 18 pt `VerdictIcon`, Inter 500 13. Background from `theme.verdict[effectiveSeverity]`, text `onChip`. Text from `verdictChipLabel`, accessibility label from `verdictA11yLabel`. Never set `numberOfLines`.
  - `PetCheckCard({ pets: Pet[]; toxicity: ToxicityEntry[]; matchProbability: number | null; speciesName: string; onPetAte: () => void; onSourcePress?: (url: string) => void })`. Layout from `design/frames/2a.html`:
    - card title "Pet check", with the pets' names on the right ("Miso and Bran")
    - one row per pet: a 40 pt avatar circle with a Cat, Dog or PawPrint icon; the name in Inter 600 17; the kind as a caption; `VerdictChip`; the `petCheckLine` text in Inter 400 15/21; and "Source: <name>" as an underlined link
    - when `matchProbability` isn't null: a footer reading "Based on the match: <confidenceLabel>" in a tint box, and when `likelyMatchNote(band)` isn't null, the likely-match note
    - a "My pet ate this" secondary button, 48 high, with a phone icon
    - with no pets, it renders nothing (the caller hides the section)
  - `RarityBadge({ tier })`: 28 high, padding 0 10 0 8, 14 pt leaves (1, 2 or 3, or one flower for legendary) at stroke 2.4 with 1 pt gaps, Inter 500 13, background `theme.rarity[tier]`, text `onChip`. Accessibility label "Rarity: <Word>".
  - `QuotaMeter({ quota: QuotaState; variant?: 'bar' | 'card' | 'pill' })`:
    - `bar`: a caption label above an 8 pt bar (`4a.html`)
    - `card`: the Today tile (`2e.html`)
    - `pill`: on the camera, a dark pill with a mini bar (`2b.html`)
    - label from `quotaMeterLabel`; a press reveals "Resets <formatResetDate>"
  - `StreakCounter({ days, label, state?: 'active' | 'last_day' | 'freeze_used' | 'winter' | 'broken'; size?: 'tile' | 'stat' })`:
    - flame icon and number in `streak`, or `textSecondary` when broken (never red)
    - `stat` size: Fraunces 34 number with a 44 pt flame (`4f.html`)
    - `tile` size: Inter 600 20 with a 28 pt flame (`2e.html`)
  - `StreakCalendar({ marks: DayMark[] })`: a 7-column grid with gap 8 and padding 14 in a card. Circles: checked in `streak`; freeze in `primaryTint` with a 2 pt `primary` ring and the `FreezeIcon`; missed in `border`; empty in `surface` with a 2 pt `border` ring (`4f.html`, `4g.html`, `4h.html`). Each day's accessibility label is "Checked in", "Freeze used", "Missed" or "No check-in".
  - `PermissionPrimer({ kind: 'camera' | 'location' | 'notifications'; onContinue; onNotNow })`: the title and line from the component sheet (§5n of the spec, quoted in the test), with a "Continue" button and a "Not now" text button.

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/components/domain1.test.tsx`:
```tsx
import { aoife } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../theme';
import { ConfidenceLabel, PermissionPrimer, PetCheckCard, QuotaMeter, RarityBadge, StreakCalendar, StreakCounter, VerdictChip } from './index';

const wrap = (ui: React.ReactElement, scheme: 'light' | 'dark' = 'light') => render(<ThemeProvider scheme={scheme}>{ui}</ThemeProvider>);
const lilyTox = aoife.speciesToxicity['peace-lily']!;

describe('ConfidenceLabel', () => {
  it('reads word first and spells percent for screen readers', async () => {
    await wrap(<ConfidenceLabel probability={0.94} />);
    expect(screen.getByText('Very likely, 94%')).toBeTruthy();
    expect(screen.getByLabelText('Very likely, 94 percent')).toBeTruthy();
  });
});

describe('VerdictChip', () => {
  it('names the animal and verdict in text and for screen readers', async () => {
    await wrap(<VerdictChip animal="cat" severity="moderate" />);
    expect(screen.getByText('Cats: Moderate')).toBeTruthy();
    expect(screen.getByLabelText('Cats: moderate toxicity')).toBeTruthy();
  });
  it('switches chip text to #0E1A13 in dark mode', async () => {
    await wrap(<VerdictChip animal="dog" severity="none" />, 'dark');
    const text = screen.getByText('Dogs: No known toxicity');
    expect(StyleSheet.flatten(text.props.style)).toMatchObject({ color: '#0E1A13' });
    expect(text.props.numberOfLines).toBeUndefined();
  });
  it('shows other pets as unknown even if data says none', async () => {
    await wrap(<VerdictChip animal="other" severity="none" />);
    expect(screen.getByText('Other pets: Unknown')).toBeTruthy();
  });
});

describe('PetCheckCard', () => {
  const pets = aoife.household.pets;
  it('one row per pet with the plain line and source, plus the match footer', async () => {
    const onPetAte = jest.fn();
    await wrap(<PetCheckCard pets={pets} toxicity={lilyTox} matchProbability={0.94} speciesName="Peace lily" onPetAte={onPetAte} />);
    expect(screen.getByText('Miso and Bran')).toBeTruthy();
    expect(screen.getByText('Cats: Moderate')).toBeTruthy();
    expect(screen.getByText('Dogs: Moderate')).toBeTruthy();
    expect(screen.getByText(/Moderate for cats\. Peace lily can irritate the mouth and cause drooling and vomiting\./)).toBeTruthy();
    expect(screen.getByText('Based on the match: Very likely, 94%')).toBeTruthy();
    expect(screen.queryByText('This depends on the match. Confirm the plant to be sure.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'My pet ate this' }));
    expect(onPetAte).toHaveBeenCalled();
  });
  it('adds the likely-match note when the match is only likely', async () => {
    await wrap(<PetCheckCard pets={pets} toxicity={lilyTox} matchProbability={0.71} speciesName="Peace lily" onPetAte={() => {}} />);
    expect(screen.getByText('This depends on the match. Confirm the plant to be sure.')).toBeTruthy();
  });
  it('unknown toxicity names the pet and never says safe', async () => {
    await wrap(<PetCheckCard pets={pets} toxicity={[]} matchProbability={0.96} speciesName="Swiss cheese plant" onPetAte={() => {}} />);
    expect(screen.getByText('Not reviewed yet. Keep it away from Miso until we know more.')).toBeTruthy();
    expect(screen.getByText('Not reviewed yet. Keep it away from Bran until we know more.')).toBeTruthy();
    expect(screen.queryByText(/safe/i)).toBeNull();
  });
  it('renders nothing with no pets', async () => {
    await wrap(<PetCheckCard pets={[]} toxicity={lilyTox} matchProbability={0.94} speciesName="Peace lily" onPetAte={() => {}} />);
    expect(screen.queryByText('Pet check')).toBeNull();
  });
});

describe('progress components', () => {
  it('RarityBadge reads its tier', async () => {
    await wrap(<RarityBadge tier="rare" />);
    expect(screen.getByText('Rare')).toBeTruthy();
    expect(screen.getByLabelText('Rarity: Rare')).toBeTruthy();
  });
  it('QuotaMeter reads "7 of 10 left this month" and reveals the reset date on press', async () => {
    await wrap(<QuotaMeter quota={aoife.today.identifications} variant="card" />);
    expect(screen.getByText('7 of 10 left this month')).toBeTruthy();
    await fireEvent.press(screen.getByText('7 of 10 left this month'));
    expect(screen.getByText('Resets 1 November')).toBeTruthy();
  });
  it('a broken streak turns grey, never red', async () => {
    await wrap(<StreakCounter days={0} label="day care streak" state="broken" size="stat" />);
    expect(StyleSheet.flatten(screen.getByText('0').props.style)).toMatchObject({ color: '#56605A' });
  });
  it('StreakCalendar labels each day for screen readers', async () => {
    await wrap(<StreakCalendar marks={['checked', 'freeze', 'missed', 'empty']} />);
    expect(screen.getByLabelText('Checked in')).toBeTruthy();
    expect(screen.getByLabelText('Freeze used')).toBeTruthy();
    expect(screen.getByLabelText('Missed')).toBeTruthy();
    expect(screen.getByLabelText('No check-in')).toBeTruthy();
  });
  it('PermissionPrimer says why and always offers Not now', async () => {
    const onNotNow = jest.fn();
    await wrap(<PermissionPrimer kind="location" onContinue={() => {}} onNotNow={onNotNow} />);
    expect(screen.getByText('Use your location')).toBeTruthy();
    expect(screen.getByText('To place your finds. Others only ever see an area, never a pin.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    expect(onNotNow).toHaveBeenCalled();
  });
});
```

The primer copy, from the component sheet:
- camera: "Use the camera" / "To photograph plants. Photos stay private unless you share one."
- location: "Use your location" / "To place your finds. Others only ever see an area, never a pin."
- notifications: "Care reminders" / "So we can tell you when to check the soil. We never send marketing."

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/mobile test -- domain1`
Expected: FAIL, because the components don't exist yet.

- [ ] **Step 3: Implement** to the props above and the named frames. Export everything from `components/index.ts`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck`
Expected: everything passes.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components
git commit -m "feat(mobile): pet check, verdict chip, confidence, rarity, quota and streak components"
```

---

### Task 7: Domain components, part 2, and the component sheet

**Files:**
- Create in `apps/mobile/src/components/`:
  - `PlantCard.tsx`, `TaskRow.tsx`, `LeagueRow.tsx`, `PlantdexTile.tsx`
  - `FindMarker.tsx`, `PlanCard.tsx`, `CheckInSheet.tsx`
- Create:
  - `apps/mobile/src/catalog/componentSheet.tsx`: registers catalog frames `5a`–`5r`, one per component, each showing every state listed in the component sheet
  - `docs/design-notes/component-sheet.md`: the component sheet's data (ids, rules, states), copied from the plan below, for reviewers
- Test: `apps/mobile/src/components/domain2.test.tsx`

**Interfaces:**
- Consumes: the Task 5 and Task 6 components, and the core domain types.
- Produces:
  - `PlantCard({ plant: PlantSummary; onPress })`:
    - 44 pt rounded photo or initial lead, the nickname in Inter 600 17, the species common name in italic 15 (the component sheet shows the species in italics)
    - right text by `careState`: due "Check today" in `primary`; overdue "Since yesterday", or a date; ok, the weekday name; paused, `pausedNote`; dead "Died <d Mon>"; given away "Given away"
    - dead and given-away cards render at 0.6 opacity
  - `TaskRow({ task: CareTask; onPress; primaryAction?: { label; onPress } })`:
    - a 44 pt photo slot, the title ("Time to check Monty's soil." when due, "Check Spidey's soil" otherwise, "Water Lily" for water tasks), and the subtitle "<room> · due today", "overdue since yesterday" or "done"
    - a done task shows strikethrough, a check icon and 0.6 opacity, and **no celebration**
    - with `primaryAction`, a full-width "Check in" button sits inside the row (`2e.html`)
  - `LeagueRow({ row: BoardRow })`: rank lead, handle (the user's own row reads "You · @handle", on `primaryTint`), points on the right; with `pending`, a subtitle reading "Points pending review".
  - `PlantdexTile({ species: SpeciesRef | null; found: boolean; setName?: string; photoUrl?: string | null; onPress? })`:
    - found: photo slot, name in Inter 600 17, scientific name in italic, rarity badge
    - missing: a dashed `border` ring, a 44 pt question-mark circle on `primaryTint`, "Not found yet" plus the set name, accessibility label "Not found yet"
    - sensitive: "Location private" as the subtitle
    - layout from `2f.html`
  - `FindMarker({ kind: 'exact' | 'area' | 'hidden' })`: the component sheet 5l visuals. A 16 pt `primary` dot with a white ring; an 80 pt circle at 16% `primary` with a `primary` ring; or nothing, with the caption "Hidden: near home or sensitive".
  - `PlanCard({ title, tag?, subtitle, price, per, selected, onPress })`:
    - price in Fraunces 600 28 (the largest text); the tag in Inter 600 13 `primary`, smaller than the price
    - selected: `primaryTint` with a 2 pt `primary` ring and a filled radio
    - unselected: `surface` with a 1.5 pt `border` ring
    - `accessibilityRole="radio"`
    - from `2g.html`
  - `CheckInSheet({ visible; plantNickname; state: 'unanswered' | 'answered_no' | 'answered_yes' | 'saved_offline'; nextCheckWeekday?: string; streakDays?: number; onAnswer: (dry: boolean, leaves: LeafState[]) => void; onAddPhoto; onClose; onDone })`. Built on `Sheet`, with content from `4c.html`, `4d.html` and `4e.html`:
    - **unanswered:**
      - title `checkInQuestion(nickname)` in Fraunces 28
      - sub "Push a finger in up to the first knuckle."
      - caption "How do the leaves look? (optional)"
      - multi-select pills: Healthy, Yellowing, Drooping, Brown tips, Spots
      - secondary "Add a photo"
      - two 64-high answer tiles, "Yes, dry" (primary) and "No, still damp" (outlined)
    - **answered_no:** `checkInAnsweredNo(weekday)`, then "Your 12-day streak continues.", then "Done".
    - **saved_offline:** the same title, plus a dark Note: "You're offline. Saved, and it will sync when you're back."
    - **answered_yes:** title "Time to water <nickname>.", sub "We've added a watering task for today.", then "Done". Watering itself gets no celebration copy.

- [ ] **Step 1: Write the failing tests**

`apps/mobile/src/components/domain2.test.tsx`:
```tsx
import { aoife } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme';
import { CheckInSheet, LeagueRow, PlanCard, PlantCard, PlantdexTile, TaskRow } from './index';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

describe('PlantCard', () => {
  it('shows nickname, species and the next check', async () => {
    await wrap(<PlantCard plant={aoife.plants[0]!} onPress={() => {}} />);
    expect(screen.getByText('Monty')).toBeTruthy();
    expect(screen.getByText('Swiss cheese plant')).toBeTruthy();
    expect(screen.getByText('Check today')).toBeTruthy();
  });
});

describe('TaskRow', () => {
  it('done tasks are struck through and not celebrated', async () => {
    const done = aoife.today.tasks.find((t) => t.status === 'done')!;
    await wrap(<TaskRow task={done} onPress={() => {}} />);
    expect(screen.getByText('Water Lily')).toBeTruthy();
    expect(screen.queryByText(/great|well done|nice/i)).toBeNull();
  });
  it('due task with a Check in action', async () => {
    const due = aoife.today.tasks.find((t) => t.status === 'due')!;
    const onCheck = jest.fn();
    await wrap(<TaskRow task={due} onPress={() => {}} primaryAction={{ label: 'Check in', onPress: onCheck }} />);
    expect(screen.getByText("Time to check Monty's soil.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
    expect(onCheck).toHaveBeenCalled();
  });
});

describe('LeagueRow', () => {
  it('marks your row with You, not colour alone', async () => {
    await wrap(<LeagueRow row={{ rank: 4, handle: 'aoifegrows', points: 340, isYou: true, pending: false }} />);
    expect(screen.getByText('You · @aoifegrows')).toBeTruthy();
  });
  it('shows pending points without accusation', async () => {
    await wrap(<LeagueRow row={{ rank: 3, handle: 'mossbank', points: 355, isYou: false, pending: true }} />);
    expect(screen.getByText('Points pending review')).toBeTruthy();
  });
});

describe('PlantdexTile', () => {
  it('missing tiles read "Not found yet"', async () => {
    await wrap(<PlantdexTile species={null} found={false} setName="Irish hedgerow" />);
    expect(screen.getByLabelText('Not found yet')).toBeTruthy();
  });
});

describe('PlanCard', () => {
  it('the billed price is present and the card is a radio', async () => {
    await wrap(<PlanCard title="Yearly" tag="Best value" subtitle="$2.08 a month, billed yearly" price="$24.99" per="a year" selected onPress={() => {}} />);
    expect(screen.getByRole('radio', { name: /Yearly/ })).toBeChecked();
    expect(screen.getByText('$24.99')).toBeTruthy();
  });
});

describe('CheckInSheet', () => {
  it('asks the soil question and reports the answer with leaf states', async () => {
    const onAnswer = jest.fn();
    await wrap(<CheckInSheet visible plantNickname="Monty" state="unanswered" onAnswer={onAnswer} onAddPhoto={() => {}} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByText("Is the top of Monty's soil dry?")).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Yellowing' }));
    await fireEvent.press(screen.getByRole('button', { name: 'No, still damp' }));
    expect(onAnswer).toHaveBeenCalledWith(false, ['yellowing']);
  });
  it('answered No says when the next check is', async () => {
    await wrap(<CheckInSheet visible plantNickname="Monty" state="answered_no" nextCheckWeekday="Friday" streakDays={12} onAnswer={() => {}} onAddPhoto={() => {}} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByText("Good. We'll check again on Friday.")).toBeTruthy();
    expect(screen.getByText('Your 12-day streak continues.')).toBeTruthy();
  });
  it('offline state says it was saved', async () => {
    await wrap(<CheckInSheet visible plantNickname="Monty" state="saved_offline" nextCheckWeekday="Friday" onAnswer={() => {}} onAddPhoto={() => {}} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByText("You're offline. Saved, and it will sync when you're back.")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/mobile test -- domain2`
Expected: FAIL, because the components don't exist yet.

- [ ] **Step 3: Implement the components, the component-sheet catalog and the notes**

`componentSheet.tsx` registers 18 frames, `5a`–`5r`. Each is a scrollable page in the light scheme, with the component name in Inter 600 20, its rule in Inter 400 15, and every state labelled in a caption. The states come from the component sheet:
- 5a Confidence label: very likely 94%, likely 71%, not sure 41%
- 5b Pet check card: a very likely match, and a likely match (Easter lily, cats severe) with the note
- 5c Verdict chip: all 5 verdicts
- 5d Rarity badge: all 4 tiers
- 5e Plant card: check due, overdue, all good, paused by a diagnosis ("1 of 2 dry checks"), dead, given away
- 5f Task row: due, overdue, done
- 5g Check-in sheet: unanswered, answered, saved offline
- 5h Quota meter: free 7 of 10; premium 52 of 60; one left (1 of 10); used up (0 of 10, resets 1 November)
- 5i Streak counter: active, last day, freeze used, winter mode (3 weeks), broken
- 5j League row: you, others, points pending
- 5k Plantdex tile: found, missing, sensitive
- 5l Find marker: exact, area, hidden
- 5m Plan card: yearly selected, monthly unselected
- 5n Permission primer: camera, location, notifications
- 5o Button: primary, secondary, text, danger, pressed, disabled, loading
- 5p Sheet: half height, full height
- 5q Empty state: My Plants, Friends
- 5r Snackbar: "Check-in saved." with Undo; "You're offline. We'll sync when you're back."; and the points-pending line

Import `componentSheet.tsx` from `catalog/frames.ts`.

- [ ] **Step 4: Run the tests, then visually check the sheet**

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck && pnpm visual:app 5a 5b 5c 5d 5e 5f 5g 5h 5i 5j 5k 5l 5m 5n 5o 5p 5q 5r`
Expected:
- The tests pass.
- Screenshots appear in `design/compare/app/5*.png`.
- Open each with the Read tool and compare it with the component sheet description, `design/screens/2a.png` (pet check) and `design/screens/2g.png` (plan cards).
- Fix anything that differs from the design before committing. There's no `design/screens-inner/5*.png`; this is a visual self-check.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src docs/design-notes
git commit -m "feat(mobile): plant, task, league, Plantdex, plan and check-in components with component sheet"
```

---

### Task 8: App shell — fixture API, session, tabs and route tree

**Files:**
- Create:
  - `apps/mobile/src/api/types.ts`
  - `apps/mobile/src/api/fixture/FixtureApi.ts`
  - `apps/mobile/src/api/ApiProvider.tsx`
  - `apps/mobile/src/api/hooks.ts`
  - `apps/mobile/src/session/SessionProvider.tsx`
  - `apps/mobile/src/components/TabBar.tsx`
  - `apps/mobile/src/app/(onboarding)/_layout.tsx`
  - `apps/mobile/src/app/(tabs)/_layout.tsx`
  - one placeholder route file for every route in spec §6.3 (listed in Step 4)
- Modify: `apps/mobile/src/app/_layout.tsx` (providers and `Stack.Protected` guards)
- Test:
  - `apps/mobile/src/api/fixture/FixtureApi.test.ts`
  - `apps/mobile/src/components/TabBar.test.tsx`
  - `apps/mobile/src/session/SessionProvider.test.tsx`

**Interfaces:**
- Consumes: the core domain types and the `aoife` fixture (Task 2), and the components.
- Produces:
  - `TendrilApi` in `api/types.ts`; Phase 1B screens call it, and Phase 2 implements it with Supabase:
```ts
import type {
  Badge, CollectionSet, Entitlement, FindListItem, Household, LabelInfo, LeafState, LeagueBoard, Outcome, Pet,
  PlaceType, PlantDetail, PlantSetup, PlantSummary, PlantdexEntry, Profile, QuotaKind, QuotaState, ScanResult,
  SpeciesRef, StreakSummary, TodaySummary, ToxicityEntry, WeekResult, CaptureSource, Organ, PlantStatus, DiagnosisResult, IsoDate,
} from '@tendril/core';

export interface CheckInResult { nextCheckOn: IsoDate; nextCheckWeekday: string; waterTaskCreated: boolean; streakDays: number; savedOffline: boolean }
export interface IdentifyInput { photoUris: string[]; organs: Organ[]; captureSource: CaptureSource; healthCheck: boolean }
export interface SpeciesCard { species: SpeciesRef; findsCount: number; sets: { name: string; found: number; total: number }[]; toxicity: ToxicityEntry[] }
export interface EmergencyInfo { petName: string; animal: 'cat' | 'dog' | 'other'; speciesName: string; toxicity: ToxicityEntry | null; matchProbability: number | null; vet: { name: string; phone: string } | null; poisonLine: { name: string; phone: string; note: string } | null }

export interface TendrilApi {
  getToday(): Promise<TodaySummary>;
  getStreaks(): Promise<StreakSummary>;
  checkIn(input: { clientId: string; plantId: string; soilDry: boolean; leafStates: LeafState[] }): Promise<CheckInResult>;
  getHouseholds(): Promise<{ id: string; name: string }[]>;
  getPlants(householdId: string): Promise<PlantSummary[]>;
  getPlant(id: string): Promise<PlantDetail>;
  addPlant(input: { source: 'scan' | 'label_qr'; observationId?: string; labelCode?: string; setup: PlantSetup }): Promise<{ plantId: string }>;
  setPlantStatus(id: string, status: PlantStatus, deathCause?: string): Promise<void>;
  getLabel(code: string): Promise<LabelInfo | null>;
  getQuota(kind: QuotaKind): Promise<QuotaState>;
  identify(input: IdentifyInput): Promise<ScanResult>;
  getScanResult(observationId: string): Promise<ScanResult>;
  confirmScan(input: { observationId: string; speciesId: string; action: 'add_plant' | 'log_find'; placeType?: PlaceType; setup?: PlantSetup }): Promise<{ plantId: string | null }>;
  getOutcome(observationId: string): Promise<Outcome>;
  diagnose(input: { plantId: string; photoUris: string[] }): Promise<DiagnosisResult>;
  applyDiagnosis(diagnosisId: string): Promise<void>;
  getPlantdex(filter: 'all' | 'houseplant' | 'wild'): Promise<{ entries: PlantdexEntry[]; counts: { all: number; houseplants: number; wild: number } }>;
  getSpeciesCard(speciesId: string): Promise<SpeciesCard>;
  getSets(): Promise<CollectionSet[]>;
  getFinds(): Promise<FindListItem[]>;
  getBadges(): Promise<Badge[]>;
  getLeague(): Promise<LeagueBoard>;
  getFriends(): Promise<LeagueBoard>;
  findHandle(handle: string): Promise<{ handle: string; plantdexCount: number } | null>;
  sendFriendRequest(handle: string): Promise<void>;
  createInvite(): Promise<{ url: string }>;
  getWeekResult(): Promise<WeekResult>;
  getProfile(): Promise<Profile>;
  getHousehold(): Promise<Household>;
  savePets(pets: Omit<Pet, 'id'>[]): Promise<void>;
  getEntitlement(): Promise<Entitlement>;
  startPreview(): Promise<Entitlement>;
  getEmergency(input: { plantId?: string; speciesId?: string; petId: string }): Promise<EmergencyInfo>;
  deleteAccount(): Promise<void>;
}
```
  - `FixtureApi implements TendrilApi`. It's built from the `aoife` fixture and keeps an in-memory copy, so mutations like `checkIn` and `addPlant` change what later reads return. It also has:
    - a `scenario` setter, `setScenario(name: FixtureScenario)`, where `FixtureScenario = 'default' | 'empty' | 'offline' | 'limit_free' | 'limit_premium' | 'not_a_plant' | 'not_sure' | 'likely' | 'error'`, to drive the state frames
    - `latencyMs`, defaulting to 0 in tests and 300 in the app
  - `ApiProvider({ api, children })` and `useApi()`.
  - Hooks in `api/hooks.ts`, wrapping TanStack Query:
    - queries: `useToday()`, `useStreaks()`, `usePlants(householdId)`, `usePlant(id)`, `useQuota(kind)`, `useScanResult(id)`, `useOutcome(id)`, `usePlantdex(filter)`, `useSpeciesCard(id)`, `useSets()`, `useFinds()`, `useBadges()`, `useLeague()`, `useFriends()`, `useWeekResult()`, `useProfile()`, `useHousehold()`, `useEntitlement()`, `useLabel(code)`, `useEmergency(input)`
    - mutations: `useCheckIn()`, `useConfirmScan()`, `useAddPlant()`, `useStartPreview()`. Each invalidates the affected keys.
  - `SessionProvider` and `useSession()`, which returns `{ status: 'loading' | 'signed_out' | 'onboarding' | 'ready'; ageBlocked: boolean; signIn(method: 'apple' | 'google' | 'email', email?: string): Promise<void>; completeOnboarding(): void; blockForAge(): void; signOut(): void }`.
    - In fixture mode, sign-in succeeds at once and moves to `onboarding`.
    - `blockForAge` is persisted, so the age stop survives restarts. Use `expo-sqlite/localStorage` via `npx expo install expo-sqlite`. On web and in jest it falls back to an in-memory map.
    - The app starts `ready` when `EXPO_PUBLIC_FIXTURE_SKIP_ONBOARDING=1`, so the catalog and dev runs can skip onboarding.
  - `TabBar`: the design's tab bar (`2e.html`):
    - 90 high, `surface`, with a hairline top border
    - five equal columns: Today (Calendar icon), My Plants, Scan, Collection, Leagues
    - Scan is a raised 60 pt `primary` circle with a 26 pt camera icon, a 5 pt `surface` ring and a shadow, sitting 28 pt higher, with "Scan" underneath
    - labels always show: Inter 600 13/16 for the active tab, 500 otherwise
    - active colour `primary`, inactive `textSecondary`
    - every item has `accessibilityRole="tab"`
    - pressing Scan pushes `/camera` instead of switching tabs

- [ ] **Step 1: Install the dependencies**

Inside `apps/mobile`:
```bash
npx expo install @tanstack/react-query expo-sqlite expo-crypto
```

- [ ] **Step 2: Write the failing tests**

`apps/mobile/src/api/fixture/FixtureApi.test.ts`:
```ts
import { FixtureApi } from './FixtureApi';

describe('FixtureApi', () => {
  it('serves the UX brief sample data', async () => {
    const api = new FixtureApi({ latencyMs: 0 });
    const today = await api.getToday();
    expect(today.streak.careDays).toBe(12);
    expect((await api.getPlants('our-flat')).map((p) => p.nickname)).toEqual(['Monty', 'Spidey', 'Lily']);
  });
  it('check-in No moves the next check and keeps the streak', async () => {
    const api = new FixtureApi({ latencyMs: 0 });
    const r = await api.checkIn({ clientId: 'c1', plantId: 'monty', soilDry: false, leafStates: [] });
    expect(r.waterTaskCreated).toBe(false);
    expect(r.streakDays).toBe(12);
    expect(r.nextCheckWeekday).toBe('Monday');
  });
  it('check-in is idempotent on clientId', async () => {
    const api = new FixtureApi({ latencyMs: 0 });
    const a = await api.checkIn({ clientId: 'same', plantId: 'monty', soilDry: true, leafStates: [] });
    const b = await api.checkIn({ clientId: 'same', plantId: 'monty', soilDry: true, leafStates: [] });
    expect(b).toEqual(a);
    expect((await api.getToday()).tasks.filter((t) => t.kind === 'water' && t.plantNickname === 'Monty')).toHaveLength(1);
  });
  it('scenarios drive state screens', async () => {
    const api = new FixtureApi({ latencyMs: 0 });
    api.setScenario('empty');
    expect((await api.getPlants('our-flat'))).toEqual([]);
    expect((await api.getToday()).hasPlants).toBe(false);
    api.setScenario('limit_free');
    expect((await api.getQuota('identification'))).toMatchObject({ used: 10, limit: 10, plan: 'free' });
    api.setScenario('not_a_plant');
    expect((await api.identify({ photoUris: ['x'], organs: ['leaf'], captureSource: 'camera', healthCheck: false })).state).toBe('not_a_plant');
  });
  it('unknown label codes return null', async () => {
    const api = new FixtureApi({ latencyMs: 0 });
    expect(await api.getLabel('PL-0001')).not.toBeNull();
    expect(await api.getLabel('RETIRED-9')).toBeNull();
  });
});
```

`apps/mobile/src/components/TabBar.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme';
import { TabBarView } from './TabBar';

describe('TabBar', () => {
  it('always shows all five labels and marks the active tab', async () => {
    const onTab = jest.fn();
    const onScan = jest.fn();
    await render(<ThemeProvider scheme="light"><TabBarView active="today" onTab={onTab} onScan={onScan} /></ThemeProvider>);
    for (const label of ['Today', 'My Plants', 'Scan', 'Collection', 'Leagues']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Today' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Leagues' }));
    expect(onTab).toHaveBeenCalledWith('leagues');
    await fireEvent.press(screen.getByRole('tab', { name: 'Scan' }));
    expect(onScan).toHaveBeenCalled();
    expect(onTab).not.toHaveBeenCalledWith('scan');
  });
});
```

`apps/mobile/src/session/SessionProvider.test.tsx`:
```tsx
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SessionProvider, useSession } from './SessionProvider';

function Probe() {
  const s = useSession();
  return <Text onPress={() => s.blockForAge()}>{`${s.status} ${s.ageBlocked}`}</Text>;
}

describe('SessionProvider', () => {
  it('starts signed out and remembers an age block across remounts', async () => {
    const first = await render(<SessionProvider><Probe /></SessionProvider>);
    expect(await screen.findByText('signed_out false')).toBeTruthy();
    await act(async () => screen.getByText('signed_out false').props.onPress());
    expect(await screen.findByText('signed_out true')).toBeTruthy();
    first.unmount();
    await render(<SessionProvider><Probe /></SessionProvider>);
    expect(await screen.findByText('signed_out true')).toBeTruthy();
  });
});
```

The age block persists in a module-level store backed by `expo-sqlite/localStorage`, with an in-memory fallback, so the second mount reads it back.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/mobile test`
Expected: FAIL, because the modules don't exist yet.

- [ ] **Step 4: Implement the API, session, tab bar and route tree**

Create these route files. Each placeholder screen renders `ScreenHeader` or `BackBar` with the route's title and an `AppText` naming the design frames it will hold. Phase 1B replaces the placeholders.
- `(onboarding)/`: `welcome.tsx`, `age.tsx`, `age-stop.tsx`, `sign-in.tsx`, `link-sent.tsx`, `link-expired.tsx`, `pets.tsx`, `home-area.tsx`, `first-scan.tsx`
- `(tabs)/`: `today/index.tsx`, `today/streaks.tsx`, `plants/index.tsx`, `scan.tsx`, `collection/index.tsx`, `leagues/index.tsx`
- `plants/[id]/index.tsx`, `plants/[id]/diagnosis.tsx`, `plants/setup.tsx`
- `l/[code].tsx`
- `camera.tsx`
- `scan/[id]/index.tsx`, `scan/[id]/new-species.tsx`
- `collection/species/[id].tsx`, `collection/sets/[id]/complete.tsx`
- `leagues/add-friends.tsx`, `leagues/week-results.tsx`
- `profile/index.tsx`, `profile/public.tsx`
- `settings/index.tsx`, `settings/household.tsx`, `settings/home-area.tsx`, `settings/notifications.tsx`, `settings/account.tsx`, `settings/delete-account.tsx`
- `paywall.tsx`, `pet-emergency.tsx`, `auth/callback.tsx`

Root layout:
```tsx
<SafeAreaProvider><ThemeProvider><QueryClientProvider client={queryClient}><ApiProvider api={api}><SessionProvider>
  <RootStack />
</SessionProvider></ApiProvider></QueryClientProvider></ThemeProvider></SafeAreaProvider>
```

`RootStack` uses `Stack.Protected` guards:
- `(onboarding)` when the status is `signed_out` or `onboarding`
- `(tabs)` and every other app route when the status is `ready`
- `catalog` always (it guards itself)

`api` is `new FixtureApi({ latencyMs: 300 })` when `EXPO_PUBLIC_API_MODE !== 'supabase'`. The Supabase API arrives in Phase 2; until then, throw a clear error in supabase mode. Keep the splash screen up while the session status is `loading`.

`(tabs)/_layout.tsx` uses expo-router's `Tabs` with `tabBar={(props) => <TabBar {...props} />}`. `TabBar` maps router state to `TabBarView`, and `TabBarView` is exported for tests.

- [ ] **Step 5: Run the tests and a web smoke check**

Run: `pnpm --filter @tendril/mobile test && pnpm --filter @tendril/mobile typecheck && pnpm --filter @tendril/mobile lint && EXPO_PUBLIC_FIXTURE_SKIP_ONBOARDING=1 pnpm --filter @tendril/mobile export:web`
Expected: everything passes, and the web export builds. Then serve `apps/mobile/dist` with `npx serve -s apps/mobile/dist -l 8767` and screenshot `/today` at 393×852 using the visual tool's Chromium (`tools/visual/src/chromium.ts`). Read the screenshot to confirm the tab bar matches `design/screens/2e.png`'s bar: raised Scan button, five labels, Today active.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): app shell with fixture API, session guard, design tab bar and route tree"
```
