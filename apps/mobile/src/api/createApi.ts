import { FixtureApi } from './fixture/FixtureApi';
import type { TendrilApi } from './types';

/** The backend the app runs on: the fixture until Phase 2 adds Supabase. */
export function createApi(mode: string | undefined = process.env.EXPO_PUBLIC_API_MODE): TendrilApi {
  if (mode === 'supabase') {
    throw new Error(
      'EXPO_PUBLIC_API_MODE=supabase needs the Supabase API, which arrives in Phase 2. Unset it to run on the fixture API.',
    );
  }
  return new FixtureApi({ latencyMs: 300 });
}
