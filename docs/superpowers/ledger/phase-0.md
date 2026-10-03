# Phase 0 ledger: rulings and deferred findings

Kept from the SDD ledger (`.superpowers/sdd/2026-10-03-phase-0-foundations/progress.md`), which is deleted once a phase is done. Phase 8's runbook collects the deferred items from these files.

## Rulings

- Ruling: add `.superpowers/` to .gitignore in Task 1 — SDD workspace must never be committed — cost if wrong: none.
- Ruling: await every fireEvent call; controller corrected Phase 1A/1B plan text (sed) and added constraints (ESLint 9 pin, pnpm exec at root) — cost if wrong: none, awaiting a sync call is harmless
- Ruling: accept implementer deviations (scratch scaffold, eslint@^9 pin, tsconfig types/allowImportingTsExtensions, pnpm allowBuilds unrs-resolver:false) — required by toolchain; cost if wrong: small config churn
- Ruling: Important 5 deferred to Phase 2A Task 1 (needs Docker) — add `supabase functions serve` + curl health smoke test there; deploy plan uses `supabase functions deploy --use-api` (supports imports outside supabase/); keep shared supabase/functions/deno.json for now, fall back to per-function deno.json or a _shared/core copy if serve/deploy bundling fails — cost if wrong: Phase 2 rework of import maps
- Ruling: disable experiments.typedRoutes until a step generates .expo/types before typecheck — otherwise CI/agents typecheck with stale or missing route types — cost if wrong: lose route-string type safety until re-enabled
- Ruling: app code imports @tendril/core from the package root only (no subpath exports); functions use the @core/ path alias — cost if wrong: add "./*" export later

## Deferred minor findings

- Task 1: minor (deferred): pnpm 12 pinned deno via devEngines.runtime (downloads from GitHub) rather than npm devDependency; `pnpm exec deno` works; CI needs github.com access
- Task 1: minor (deferred): README doesn't mention design/frames (since committed in b95f9d0)
- Task 2: minor (deferred): core import guard misses side-effect/dynamic imports and Node API use (types:["node"] for all src); uses URL.pathname not fileURLToPath; no-deps check ignores peer/optional deps
- Task 2: minor (deferred): missing tests for toPercent(0/1), -Infinity, confidenceLabel(1.2), a11y label lower bands
- Task 3: minor (deferred): health handler returns 200 for any method (plan-mandated verbatim); check:functions only type-checks index.ts graphs
- Task 4: minor (deferred): react-reconciler (via test-renderer) peer wants react ^19.3 vs 19.2.3 installed — benign; @react-native/metro-config peer 0.87.1 vs 0.86.3
- Task 5: minor (deferred): pnpm/action-setup@v4 (v6 supports pnpm 12 officially); add permissions: contents: read, timeout-minutes, concurrency group; jsr:@std/assert unpinned (lock:false)
- Final review (deferred): `pnpm/action-setup@v6` currently resolves to v6.0.10; native pnpm 12 bootstrap arrives in v6.1.0 (v6.0.10's self-update path was verified to work). Revisit when the tag moves, or switch to `pnpm/setup`.
- Final review (deferred): CI `cancel-in-progress` also cancels runs on `main` pushes. Scope it to non-main refs if that's unwanted.
- Final review (deferred): core test files are outside `tsconfig.json`, so editors may not pick up `tsconfig.test.json` for them. CI typechecks both.
- Final review (deferred): the Deno 2.1 API level isn't enforced in tests (they run on Deno 2.9.6). Phase 2's `functions serve` smoke test and end-to-end test cover it.

## Outcome

Phase 0 finished on 2026-10-03: 5 tasks, a final review by the most capable model, and one fix wave (6 commits). `pnpm verify` is green.
