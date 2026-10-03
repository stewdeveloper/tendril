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
