import type { IsoDate } from '@tendril/core';

/**
 * "Today" in the fixture world: Saturday 3 October 2026, the day the design frames show. Every
 * date the API derives (next checks, history, find dates) counts from here, never the device clock,
 * so screens read the same on any day. Lives apart from `FixtureApi` so supabase-mode bundles can
 * import it (via `hooks.ts`) without pulling the whole fixture in.
 */
export const FIXTURE_TODAY: IsoDate = '2026-10-03';
