# Phase 0: Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pnpm monorepo where `@tendril/core` (pure TypeScript domain rules) is imported and tested by vitest, by Deno (Supabase Edge Functions) and by the Expo app, and where one root command runs every typecheck and test.

**Architecture:** The pnpm workspace uses `nodeLinker: hoisted`, which Expo needs. `packages/core` has no runtime dependencies and uses explicit `.ts` relative imports, so Metro, Next.js and Deno can all load it. Supabase is initialised with one shared `supabase/functions/deno.json` that maps `@core/` to `packages/core/src/`. The Expo app is scaffolded from the SDK 57 default template and stripped down.

**Tech Stack:** pnpm 12.8.1, Node 22.23, TypeScript ~6.0.3, vitest 5, Deno 2.9.6 (npm `deno`), Supabase CLI 2.119.0 (npm `supabase`), Expo SDK 57 (expo-router, jest-expo), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-03-tendril-v1-design.md` (§4 Repository layout, §5 core, §13 testing). Research: `docs/research/2026-10-03-stack-research.md`.

## Global Constraints

- Node `>=22.13`, local 22.23.2. pnpm is pinned with `"packageManager": "pnpm@12.8.1"`.
- `pnpm-workspace.yaml` sets `nodeLinker: hoisted`, and the workspaces are `apps/*` and `packages/*`.
- Expo SDK 57: `expo ~57.0.26`, `react-native 0.86.3`, `react 19.2.3`. **Add Expo-side packages only with `npx expo install <pkg>`**, run inside `apps/mobile`, so the versions match SDK 57.
- Supabase CLI is pinned at `supabase@2.119.0` and run as `pnpm exec supabase …`. Deno is pinned at `deno@2.9.6` and run as `pnpm exec deno …`. Function code must use only APIs available in Deno 2.1, the edge runtime's level.
- **`@tendril/core`:**
  - zero runtime dependencies
  - every relative import ends in `.ts`
  - TypeScript strict
  - no DOM, Node or React Native APIs
- TypeScript is `strict` everywhere. Never set `baseUrl` or `esModuleInterop` (TypeScript 6 deprecations).
- Work on branch `feat/tendril-v1`. Commit after each task and never push. Never commit `.env*` files except `*.env.example`.
- Copy and number rules come from the spec. Confidence: "Very likely" ≥ 80%, "Likely" 50–79%, "Not sure" < 50%. The label is the word first, then the percentage ("Very likely, 94%"), and the accessible label is "Very likely, 94 percent".

## Review Focus

1. **Band edges after rounding.** A probability of 0.795 displays as 80%, so it must read "Very likely, 80%", never "Likely, 80%". Derive the band from the rounded percentage. Tested in Task 2.
2. **Bad probabilities from a provider.** NaN, negative values or values above 1 must clamp to 0–100%, and NaN counts as 0 ("Not sure, 0%"). It must never throw or render "NaN%". Tested in Task 2.
3. **A relative import without `.ts` in core.** Vitest and Metro accept it, but Deno fails at runtime in production. Task 2 adds a guard test, and Task 3 imports core through Deno.
4. **Two copies of React in the hoisted monorepo.** This causes an "Invalid hook call" crash at runtime. Task 4 runs `npx expo-doctor` and a hook-using render test.
5. **Metro can't resolve `@tendril/core`'s `.ts` imports in a web export.** Task 4 builds `expo export --platform web` with a screen that imports core.

---

### Task 1: Root workspace

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.editorconfig`, `.prettierrc.json`, `.prettierignore`
- Modify: `.gitignore` (currently only `.claude/`), `README.md`

**Interfaces:**
- Produces:
  - root scripts `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm verify` (typecheck + test + lint), used by every later task and by CI
  - `tsconfig.base.json`, extended by `packages/*`
  - binaries `pnpm exec supabase` and `pnpm exec deno`

- [ ] **Step 1: Write the root files**

`package.json`:
```json
{
  "name": "tendril",
  "private": true,
  "packageManager": "pnpm@12.8.1",
  "engines": { "node": ">=22.13" },
  "scripts": {
    "test": "pnpm -r --if-present test && pnpm test:functions",
    "typecheck": "pnpm -r --if-present typecheck && pnpm check:functions",
    "lint": "prettier --check . && pnpm -r --if-present lint",
    "format": "prettier --write .",
    "test:functions": "deno test --config supabase/functions/deno.json --allow-env --allow-net --allow-read supabase/functions/tests/",
    "check:functions": "deno check --config supabase/functions/deno.json supabase/functions/*/index.ts",
    "verify": "pnpm typecheck && pnpm test && pnpm lint"
  },
  "devDependencies": {}
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
nodeLinker: hoisted
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

`.editorconfig`:
```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
insert_final_newline = true
trim_trailing_whitespace = true
```

`.prettierrc.json`:
```json
{ "singleQuote": true, "semi": true, "printWidth": 100, "trailingComma": "all" }
```

`.prettierignore`:
```
docs/
design/
pnpm-lock.yaml
**/node_modules/
**/dist/
**/.expo/
**/.next/
apps/mobile/ios/
apps/mobile/android/
supabase/.temp/
supabase/.branches/
*.md
```

`.gitignore` (replace the whole file):
```
.claude/
node_modules/
dist/
.expo/
.next/
coverage/
*.log
.DS_Store
.env
.env.*
!*.env.example
apps/mobile/ios/
apps/mobile/android/
apps/mobile/expo-env.d.ts
supabase/.temp/
supabase/.branches/
design/compare/
```

- [ ] **Step 2: Install the pinned root dev tools**

Run:
```bash
pnpm add -D -w supabase@2.119.0 deno@2.9.6 prettier@^3 typescript@~6.0.3
```
Expected: the install succeeds. If pnpm warns that the store can't be hard-linked across filesystems, that's harmless.

- [ ] **Step 3: Verify the binaries**

Run: `pnpm exec supabase --version && pnpm exec deno --version`
Expected: `2.119.0`, then `deno 2.9.6 (...)`.

- [ ] **Step 4: Replace README.md with developer docs**

```markdown
# Tendril

Plant ID, pet safety, care coaching and collecting. iOS and Android (Expo) on a Supabase backend.

- Spec: `docs/superpowers/specs/2026-10-03-tendril-v1-design.md`
- Plans: `docs/superpowers/plans/`
- Design reference: `design/claude-design/` (source) and `design/screens/` (rendered frames)

## Requirements

Node 22.13 or later and pnpm 12 (`corepack enable`). The local Supabase stack needs Docker; on Windows, turn on Docker Desktop's WSL integration.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install everything (pnpm workspace, hoisted for Expo) |
| `pnpm verify` | Typecheck, test and lint the whole repo |
| `pnpm test` | All unit tests (core, mobile, Edge Functions via Deno) |
| `pnpm --filter @tendril/mobile start` | Expo dev server |
| `pnpm exec supabase start` | Local Supabase (Docker) |

## Layout

`apps/mobile` (Expo), `apps/web` (Next.js, phase 7), `packages/core` (shared domain rules), `supabase/` (migrations, tests, Edge Functions).
```

- [ ] **Step 5: Check the root scripts parse and prettier passes**

Run: `pnpm exec prettier --check .`
Expected: "All matched files use Prettier code style!" (or nothing to check).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .editorconfig .prettierrc.json .prettierignore .gitignore README.md
git commit -m "chore: set up pnpm workspace with pinned Supabase CLI, Deno and TypeScript"
```

---

### Task 2: `@tendril/core` package with the confidence module

**Files:**
- Create:
  - `packages/core/package.json`
  - `packages/core/tsconfig.json`
  - `packages/core/vitest.config.ts`
  - `packages/core/src/index.ts`
  - `packages/core/src/confidence.ts`
- Test:
  - `packages/core/src/confidence.test.ts`
  - `packages/core/src/imports.test.ts`

**Interfaces:**
- Consumes: `tsconfig.base.json` from Task 1.
- Produces (exported from `@tendril/core` and from `packages/core/src/confidence.ts`):
  - `type ConfidenceBand = 'very_likely' | 'likely' | 'not_sure'`
  - `const CONFIDENCE_THRESHOLDS: { readonly veryLikely: 80; readonly likely: 50 }`
  - `toPercent(probability: number): number`: an integer from 0 to 100
  - `bandFor(probability: number): ConfidenceBand`
  - `bandWord(band: ConfidenceBand): 'Very likely' | 'Likely' | 'Not sure'`
  - `confidenceLabel(probability: number): string`, e.g. "Very likely, 94%"
  - `confidenceA11yLabel(probability: number): string`, e.g. "Very likely, 94 percent"

- [ ] **Step 1: Create the package files**

`packages/core/package.json`:
```json
{
  "name": "@tendril/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit -p ."
  },
  "devDependencies": {}
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": [] },
  "include": ["src/**/*.ts", "vitest.config.ts"]
}
```

`packages/core/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
```

Then install vitest: `pnpm --filter @tendril/core add -D vitest@^5 @types/node@^22`. Then set `"types": ["node"]` in `packages/core/tsconfig.json`; the import-guard test reads files with `node:fs`. Core's production code must still not import Node APIs.

- [ ] **Step 2: Write the failing tests**

`packages/core/src/confidence.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  bandFor,
  bandWord,
  confidenceA11yLabel,
  confidenceLabel,
  toPercent,
} from './confidence.ts';

describe('toPercent', () => {
  it('rounds to a whole percent', () => {
    expect(toPercent(0.94)).toBe(94);
    expect(toPercent(0.714)).toBe(71);
    expect(toPercent(0.795)).toBe(80);
  });
  it('clamps out-of-range and NaN values instead of throwing', () => {
    expect(toPercent(1.2)).toBe(100);
    expect(toPercent(-0.1)).toBe(0);
    expect(toPercent(Number.NaN)).toBe(0);
    expect(toPercent(Number.POSITIVE_INFINITY)).toBe(100);
  });
});

describe('bandFor', () => {
  it('uses 80% and 50% as the band edges', () => {
    expect(bandFor(0.94)).toBe('very_likely');
    expect(bandFor(0.8)).toBe('very_likely');
    expect(bandFor(0.79)).toBe('likely');
    expect(bandFor(0.5)).toBe('likely');
    expect(bandFor(0.49)).toBe('not_sure');
  });
  it('derives the band from the rounded percent so label and band agree', () => {
    expect(bandFor(0.795)).toBe('very_likely');
    expect(bandFor(0.4951)).toBe('likely');
    expect(bandFor(0.4949)).toBe('not_sure');
  });
  it('treats NaN as not sure', () => {
    expect(bandFor(Number.NaN)).toBe('not_sure');
  });
});

describe('labels', () => {
  it('puts the word first, then the percentage', () => {
    expect(confidenceLabel(0.94)).toBe('Very likely, 94%');
    expect(confidenceLabel(0.71)).toBe('Likely, 71%');
    expect(confidenceLabel(0.41)).toBe('Not sure, 41%');
    expect(confidenceLabel(0.795)).toBe('Very likely, 80%');
    expect(confidenceLabel(Number.NaN)).toBe('Not sure, 0%');
  });
  it('spells out percent for screen readers', () => {
    expect(confidenceA11yLabel(0.94)).toBe('Very likely, 94 percent');
  });
  it('maps bands to words', () => {
    expect(bandWord('very_likely')).toBe('Very likely');
    expect(bandWord('likely')).toBe('Likely');
    expect(bandWord('not_sure')).toBe('Not sure');
  });
});
```

`packages/core/src/imports.test.ts`, the guard that keeps core loadable by Deno:
```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('.', import.meta.url).pathname;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('core imports', () => {
  it('ends every relative import with .ts so Deno can load core', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
        if (!match[1]!.endsWith('.ts')) offenders.push(`${file}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has no runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8'));
    expect(pkg.dependencies ?? {}).toEqual({});
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @tendril/core test`
Expected: FAIL, because `./confidence.ts` can't be resolved.

- [ ] **Step 4: Implement**

`packages/core/src/confidence.ts`:
```ts
export type ConfidenceBand = 'very_likely' | 'likely' | 'not_sure';

/** Starting values from the UX brief; tune with real data. */
export const CONFIDENCE_THRESHOLDS = { veryLikely: 80, likely: 50 } as const;

const WORDS: Record<ConfidenceBand, 'Very likely' | 'Likely' | 'Not sure'> = {
  very_likely: 'Very likely',
  likely: 'Likely',
  not_sure: 'Not sure',
};

/** Whole percent from 0 to 100. Bad provider values clamp; NaN counts as 0. */
export function toPercent(probability: number): number {
  if (Number.isNaN(probability)) return 0;
  const clamped = Math.min(1, Math.max(0, probability));
  return Math.round(clamped * 100);
}

/** Band from the rounded percent, so the band always agrees with the number shown. */
export function bandFor(probability: number): ConfidenceBand {
  const percent = toPercent(probability);
  if (percent >= CONFIDENCE_THRESHOLDS.veryLikely) return 'very_likely';
  if (percent >= CONFIDENCE_THRESHOLDS.likely) return 'likely';
  return 'not_sure';
}

export function bandWord(band: ConfidenceBand): 'Very likely' | 'Likely' | 'Not sure' {
  return WORDS[band];
}

/** "Very likely, 94%": the word first, never a bare number. */
export function confidenceLabel(probability: number): string {
  return `${bandWord(bandFor(probability))}, ${toPercent(probability)}%`;
}

/** "Very likely, 94 percent", for VoiceOver and TalkBack. */
export function confidenceA11yLabel(probability: number): string {
  return `${bandWord(bandFor(probability))}, ${toPercent(probability)} percent`;
}
```

`packages/core/src/index.ts`:
```ts
export * from './confidence.ts';
```

- [ ] **Step 5: Run the tests and typecheck to verify they pass**

Run: `pnpm --filter @tendril/core test && pnpm --filter @tendril/core typecheck`
Expected: every test passes and tsc reports no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/core pnpm-lock.yaml
git commit -m "feat(core): add @tendril/core with confidence bands and labels"
```

---

### Task 3: Supabase project and Deno function harness

**Files:**
- Create:
  - `supabase/` via `supabase init`: `config.toml`, `.gitignore`
  - `supabase/functions/deno.json`
  - `supabase/functions/health/index.ts`
  - `supabase/functions/health/handler.ts`
- Modify: `supabase/config.toml`
- Test:
  - `supabase/functions/tests/health_test.ts`
  - `supabase/functions/tests/core_import_test.ts`

**Interfaces:**
- Consumes: `bandFor` from `packages/core/src/confidence.ts` (Task 2), and the root scripts `test:functions` and `check:functions` (Task 1).
- Produces:
  - the import alias `@core/` → `packages/core/src/`, defined once in `supabase/functions/deno.json` and used by every Edge Function
  - `@std/assert` for function tests
  - the `health` function: `GET` returns `{ ok: true, core: 'very_likely' }`. Phase 2 uses it to smoke-test that bundling picks up core.

- [ ] **Step 1: Initialise Supabase**

Run: `pnpm exec supabase init`
Expected: "Finished supabase init." It creates `supabase/config.toml` and `supabase/.gitignore`.

- [ ] **Step 2: Edit `supabase/config.toml`**

Make these exact changes, leaving everything else at its default:
- `project_id = "tendril"`
- under `[auth]`: `site_url = "tendril://"` and `additional_redirect_urls = ["tendril://**", "exp://**", "http://localhost:8081/**"]`
- under `[auth.email]`: `otp_expiry = 900`. Sign-in links last 15 minutes, as the design copy says ("Open it on this phone within 15 minutes").
- under `[analytics]`: `enabled = false`
- append at the end:

```toml
[functions.health]
verify_jwt = false
import_map = "./functions/deno.json"
```

- [ ] **Step 3: Write the Deno config**

`supabase/functions/deno.json`:
```json
{
  "imports": {
    "@core/": "../../packages/core/src/",
    "@std/assert": "jsr:@std/assert@^1"
  },
  "compilerOptions": { "strict": true }
}
```

- [ ] **Step 4: Write the failing tests**

`supabase/functions/tests/core_import_test.ts`:
```ts
import { assertEquals } from '@std/assert';
import { bandFor, confidenceLabel } from '@core/confidence.ts';

Deno.test('core loads under Deno through the @core/ alias', () => {
  assertEquals(bandFor(0.94), 'very_likely');
  assertEquals(confidenceLabel(0.71), 'Likely, 71%');
});
```

`supabase/functions/tests/health_test.ts`:
```ts
import { assertEquals } from '@std/assert';
import { handler } from '../health/handler.ts';

Deno.test('health returns ok and proves core is bundled', async () => {
  const res = handler(new Request('http://localhost/health'));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true, core: 'very_likely' });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `pnpm test:functions`
Expected: FAIL. The core import test passes, but `../health/handler.ts` isn't found.

- [ ] **Step 6: Implement the health function**

`supabase/functions/health/handler.ts`:
```ts
import { bandFor } from '@core/confidence.ts';

/** Liveness check that also proves @tendril/core is bundled into functions. */
export function handler(_req: Request): Response {
  return Response.json({ ok: true, core: bandFor(0.94) });
}
```

`supabase/functions/health/index.ts`:
```ts
import { handler } from './handler.ts';

Deno.serve(handler);
```

- [ ] **Step 7: Run the tests and the type check to verify they pass**

Run: `pnpm test:functions && pnpm check:functions`
Expected: 2 tests pass, and `deno check` reports no errors. The first run downloads `jsr:@std/assert`.

- [ ] **Step 8: Commit**

```bash
git add supabase
git commit -m "feat(supabase): init project and Deno function harness importing @tendril/core"
```

---

### Task 4: Expo app scaffold

**Files:**
- Create: `apps/mobile/`, from the SDK 57 default template and then stripped down
- Create:
  - `apps/mobile/app.config.ts`, replacing `app.json`
  - `apps/mobile/src/app/_layout.tsx`
  - `apps/mobile/src/app/index.tsx`
  - `apps/mobile/eslint.config.js`
  - `apps/mobile/jest.config.js`
- Test: `apps/mobile/src/app/index.test.tsx`

**Interfaces:**
- Consumes: `confidenceLabel` from `@tendril/core` (Task 2).
- Produces:
  - workspace package `@tendril/mobile` with scripts `start`, `web`, `test`, `typecheck`, `lint` and `export:web`
  - the route root `apps/mobile/src/app/`, plus the `@/*` path alias to `apps/mobile/src/*`
  - `app.config.ts` reading `TENDRIL_APP_ID` (default `app.tendril`), with scheme `tendril`
  - `web.output: "single"`, so web exports serve every route from `index.html`

- [ ] **Step 1: Scaffold from the default template and strip it**

Run from the repo root:
```bash
CI=1 npx --yes create-expo-app@latest apps/mobile --no-install
cd apps/mobile
rm -rf .git .claude .vscode LICENSE AGENTS.md README.md scripts example src/components src/constants src/hooks src/global.css src/app/explore.tsx app.json
rm -rf assets/images/tabIcons assets/images/react-logo*.png assets/images/expo-*.png assets/images/logo-glow.png assets/images/tutorial-web.png
```

Then edit `apps/mobile/package.json`:
- set `"name": "@tendril/mobile"`
- remove the `@expo/ui`, `expo-glass-effect`, `expo-symbols` and `expo-device` dependencies, which the design doesn't use
- add `"@tendril/core": "workspace:*"` to `dependencies`
- set `scripts` to:

```json
{
  "start": "expo start",
  "web": "expo start --web",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "test": "jest --ci",
  "typecheck": "tsc --noEmit",
  "lint": "expo lint",
  "export:web": "expo export --platform web --output-dir dist"
}
```

- [ ] **Step 2: Write `app.config.ts`, the root layout and the index screen**

`apps/mobile/app.config.ts`:
```ts
import type { ExpoConfig } from 'expo/config';

const appId = process.env.TENDRIL_APP_ID ?? 'app.tendril';

const config: ExpoConfig = {
  name: 'Tendril',
  slug: 'tendril',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'tendril',
  userInterfaceStyle: 'automatic',
  ios: { bundleIdentifier: appId, supportsTablet: false },
  android: { package: appId, predictiveBackGestureEnabled: false },
  web: { output: 'single', favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      { backgroundColor: '#FBFAF6', image: './assets/images/splash-icon.png', imageWidth: 76 },
    ],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
};

export default config;
```

`apps/mobile/src/app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

`apps/mobile/src/app/index.tsx`, a temporary screen that Phase 1 replaces:
```tsx
import { confidenceLabel } from '@tendril/core';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function Index() {
  const [probability, setProbability] = useState(0.94);
  return (
    <View style={styles.container}>
      <Text>Tendril</Text>
      <Pressable accessibilityRole="button" onPress={() => setProbability(0.41)}>
        <Text>{confidenceLabel(probability)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBFAF6' },
});
```

- [ ] **Step 3: Install and add the test, lint and web dependencies**

Run from the repo root: `pnpm install`

Then, inside `apps/mobile`:
```bash
npx expo install jest-expo jest @types/jest --dev
npx expo install eslint eslint-config-expo --dev
pnpm add -D @testing-library/react-native@^14 test-renderer
```

`apps/mobile/jest.config.js`:
```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
};
```

`apps/mobile/eslint.config.js`:
```js
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([expoConfig, { ignores: ['dist/*', '.expo/*'] }]);
```

If jest-expo warns that it needs a peer `@react-native/jest-preset`, install it with `npx expo install @react-native/jest-preset --dev`.

- [ ] **Step 4: Write the failing test**

`apps/mobile/src/app/index.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import Index from './index';

describe('Index', () => {
  it('renders a core-formatted confidence label and updates state through a hook', async () => {
    await render(<Index />);
    expect(screen.getByText('Very likely, 94%')).toBeTruthy();
    fireEvent.press(screen.getByRole('button'));
    expect(await screen.findByText('Not sure, 41%')).toBeTruthy();
  });
});
```

The `useState` call is deliberate: if two copies of React are installed, this test crashes with "Invalid hook call".

- [ ] **Step 5: Run the test**

Run: `pnpm --filter @tendril/mobile test`
Expected: PASS. If it fails on module resolution for `@tendril/core`, check that `pnpm install` linked the workspace package (`ls -la node_modules/@tendril`). Don't add babel aliases. If React is duplicated, fix the hoisting with `pnpm dedupe`.

- [ ] **Step 6: Typecheck, lint, check for duplicate dependencies, and test the web export**

Run inside `apps/mobile`:
```bash
pnpm typecheck
pnpm lint
npx expo-doctor
pnpm export:web
```

Expected:
- tsc reports no errors.
- ESLint reports no errors.
- expo-doctor reports no duplicate native modules and no version mismatches. If it only warns about missing app icons or images, that's acceptable.
- The export writes `apps/mobile/dist/index.html`, and its bundle contains `Very likely` (check with `grep -rl "Very likely" dist/_expo/static/js/web/ | head -1`). That proves Metro resolved core's `.ts` imports for web.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile pnpm-lock.yaml
git commit -m "feat(mobile): scaffold Expo SDK 57 app that renders @tendril/core output"
```

---

### Task 5: CI workflow and the full repo check

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the root scripts from Task 1 (`pnpm verify`), and the package scripts from Tasks 2–4.
- Produces: a CI job named `checks`. Phase 2 adds a `database` job next to it.

- [ ] **Step 1: Write the workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [main, 'feat/**']
  pull_request:

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm lint
```

`pnpm/action-setup` reads the version from `packageManager` in `package.json`, so no version is set here.

- [ ] **Step 2: Validate the YAML**

Run: `pnpm dlx js-yaml .github/workflows/ci.yml > /dev/null && echo valid`
Expected: `valid`

- [ ] **Step 3: Run the whole repo check locally**

Run from the repo root: `pnpm verify`
Expected:
- typecheck passes for core and mobile, plus `deno check` for functions
- tests pass: core vitest, mobile jest, and 2 Deno tests
- prettier and ESLint are clean

If prettier flags files from earlier tasks, run `pnpm format`, re-run `pnpm verify`, and include those files in this commit.

- [ ] **Step 4: Commit**

```bash
git add .github pnpm-lock.yaml
git add -u
git commit -m "ci: run typecheck, tests and lint for the whole repo"
```
