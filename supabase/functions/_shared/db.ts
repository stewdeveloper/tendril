import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../packages/db/src/index.ts';
import { env, secretKey } from './env.ts';

export type Db = SupabaseClient<Database>;

/** Service-role client; bypasses RLS, so handlers must authorise explicitly. */
export function adminClient(): Db {
  return createClient<Database>(env('SUPABASE_URL'), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
