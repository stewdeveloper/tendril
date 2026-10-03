# Tendril

Plant ID, pet safety, care coaching and collecting. iOS and Android (Expo) on a Supabase backend.

- Spec: `docs/superpowers/specs/2026-10-03-tendril-v1-design.md`
- Plans: `docs/superpowers/plans/`
- Design reference: `design/claude-design/` (source) and `design/screens/` (rendered frames)

## Requirements

Node 22.13 or later and pnpm 12 (`corepack enable`). The local Supabase stack needs Docker; on Windows, turn on Docker Desktop's WSL integration.

Run root-level tools with `pnpm exec <tool>` or `pnpm dlx <tool>`, not bare `npx`; the root install is managed by pnpm.

Deno 2.9.6 is pinned in the root `package.json` under `devEngines`. pnpm downloads it from GitHub on `pnpm install`, so `pnpm exec deno` and the `deno` calls in the scripts need no separate install.

pnpm 12 stops with `ERR_PNPM_IGNORED_BUILDS` when a new dependency has an install script. `pnpm approve-builds` is interactive, so add the package to `allowBuilds` in `pnpm-workspace.yaml` instead (`true` to run its script, `false` to skip it).

ESLint stays on 9.x for now: eslint-plugin-react (via eslint-config-expo) crashes on ESLint 10, so don't `expo install eslint` without pinning `eslint@^9`.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Install everything (pnpm workspace, hoisted for Expo) |
| `pnpm verify` | Typecheck, test and lint the whole repo |
| `pnpm test` | All unit tests (core, mobile, Edge Functions via Deno) |
| `pnpm --filter @tendril/mobile start` | Expo dev server |
| `pnpm exec supabase start` | Local Supabase (Docker) |

## Layout

`apps/mobile` (Expo), `apps/web` (Next.js, phase 7), `packages/core` (shared domain rules), `supabase/` (migrations, tests, Edge Functions), `design/frames/` (one HTML file per design frame, with the exact styles) and `design/screens/` (the frames rendered to images).
