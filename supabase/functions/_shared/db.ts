import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../packages/db/src/index.ts';
import { env, secretKey } from './env.ts';
import { ApiError } from './errors.ts';

export type Db = SupabaseClient<Database>;

/** Service-role client; bypasses RLS, so handlers must authorise explicitly. */
export function adminClient(): Db {
  return createClient<Database>(env('SUPABASE_URL'), secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Fns = Database['public']['Functions'];
type Nullable<T> = { [K in keyof T]: T[K] | null };
export type DbError = { code?: string | null; message: string };

/** Maps database and `srv_*` SQLSTATEs to API errors; anything else is rethrown as an internal error. */
export function throwDbError(error: DbError): never {
  switch (error.code) {
    case 'P0403':
      throw new ApiError('forbidden', 'You do not have access to that.');
    case 'P0404':
      throw new ApiError('not_found', 'Not found.');
    case 'P0409':
    case '23505':
      throw new ApiError('conflict', 'That already exists.');
    case '23514':
    case '22023':
    case '22P02':
    case '22007':
    case '22008':
      throw new ApiError('invalid_input', 'Some of that input is not valid.');
    default:
      throw new Error(`database error ${error.code ?? ''}: ${error.message}`);
  }
}

/**
 * Calls a `public.srv_*` wrapper (service_role only) that delegates to `private.*` or runs a transactional write.
 * Generated types mark every argument non-null, so nullable arguments are allowed here and passed through.
 */
export async function callPrivate<F extends keyof Fns>(
  db: Db,
  fn: F,
  args: Nullable<Fns[F]['Args']>,
): Promise<Fns[F]['Returns']> {
  const { data, error } = await db.rpc(fn, args as never);
  if (error) throwDbError(error);
  return data as Fns[F]['Returns'];
}
