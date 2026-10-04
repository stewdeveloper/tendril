// Shared by the e2e tests (`pnpm e2e:functions`), which run against the local stack through the real Edge Functions.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const URL_ = Deno.env.get('SUPABASE_URL')!;
export const PUBLISHABLE = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
const SECRET = Deno.env.get('SUPABASE_SECRET_KEY');
if (!URL_ || !PUBLISHABLE || !SECRET) {
  throw new Error(
    'Run through `pnpm e2e:functions`: SUPABASE_URL/PUBLISHABLE_KEY/SECRET_KEY are not set.',
  );
}

export const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });
export const BUCKET = 'plant-photos';

export interface TestUser {
  id: string;
  email: string;
  token: string;
  client: SupabaseClient;
}

export async function createUser(): Promise<TestUser> {
  const email = `e2e+${crypto.randomUUID().slice(0, 8)}@example.com`;
  const password = `pw-${crypto.randomUUID()}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const client = createClient(URL_, PUBLISHABLE, { auth: { persistSession: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) throw signed.error ?? new Error('no session');
  return { id: created.data.user.id, email, token: signed.data.session.access_token, client };
}

/** A function call as the user: their JWT plus the publishable key, as the app sends it. */
export async function call(
  user: TestUser,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
  // deno-lint-ignore no-explicit-any
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${URL_}/functions/v1/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${user.token}`,
      apikey: PUBLISHABLE,
      'content-type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

/**
 * Deletes everything the users made, so `pnpm db:test` passes after an e2e run. Households outlive their creator
 * (`created_by` is set null), so the ones the users created or own go first, taking plants, tasks, events,
 * diagnoses, members, pets and vets with them. A household a test user merely joined is never touched. Deleting the
 * users then removes profiles, zones, observations, Plantdex rows, quotas and entitlements. Storage objects and
 * weather-cache rows are removed by the caller and the e2e script.
 */
export async function deleteUsers(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const created = await admin.from('households').select('id').in('created_by', ids);
  if (created.error) throw created.error;
  const owned = await admin
    .from('household_members')
    .select('household_id')
    .in('user_id', ids)
    .eq('role', 'owner');
  if (owned.error) throw owned.error;
  const households = [
    ...new Set([
      ...(created.data ?? []).map((h) => h.id as string),
      ...(owned.data ?? []).map((m) => m.household_id as string),
    ]),
  ];
  if (households.length > 0) {
    const gone = await admin.from('households').delete().in('id', households);
    if (gone.error) throw gone.error;
  }
  for (const id of ids) {
    const res = await admin.auth.admin.deleteUser(id);
    if (res.error) throw res.error;
  }
}

/** Polls `read` until it returns a value (not null or undefined), or fails after `timeoutMs`. */
export async function eventually<T>(
  what: string,
  read: () => Promise<T | null | undefined>,
  timeoutMs = 20_000,
): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (value !== null && value !== undefined) return value;
    if (Date.now() > until) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}
