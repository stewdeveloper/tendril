import { assertEquals, assertThrows } from '@std/assert';
import { ApiError } from '../_shared/errors.ts';
import { throwDbError } from '../_shared/db.ts';
import { assertPhotoPath, parseBootstrap } from '../_shared/validate.ts';
import { selectedProviderName } from '../_shared/providers/select.ts';
import { fakeDb } from '../_shared/testing/fake-db.ts';

const UID = '11111111-1111-1111-1111-111111111111';

Deno.test('photo paths reject dot segments, empty segments and other owners', () => {
  for (const p of [`${UID}/./a.jpg`, `${UID}/../a.jpg`, `${UID}//a.jpg`, UID, `${UID}/a b.jpg`]) {
    assertThrows(() => assertPhotoPath(p, UID), ApiError, '', p);
  }
  assertEquals(assertPhotoPath(`${UID}/obs/1.jpg`, UID), `${UID}/obs/1.jpg`);
  const other = assertThrows(() => assertPhotoPath('2222/a.jpg', UID), ApiError);
  assertEquals(other.code, 'forbidden');
});

Deno.test('bootstrap timezones are canonical IANA names', () => {
  const boot = { ageConfirmed13Plus: true, countryCode: 'IE' };
  assertEquals(parseBootstrap({ ...boot, timezone: 'Europe/Dublin' }).timezone, 'Europe/Dublin');
  assertEquals(
    parseBootstrap({ ...boot, timezone: 'america/new_york' }).timezone,
    'America/New_York',
  );
  assertEquals(parseBootstrap({ ...boot, timezone: 'UTC' }).timezone, 'UTC');
  for (const tz of ['+05:00', '-0300', 'UTC+5', 'Etc/GMT+5x', 'Mars/Olympus', 'EST']) {
    assertThrows(() => parseBootstrap({ ...boot, timezone: tz }), ApiError, '', tz);
  }
});

Deno.test('date, time and not-null SQLSTATEs are invalid input', () => {
  for (const code of ['22007', '22008', '23502']) {
    const e = assertThrows(() => throwDbError({ code, message: 'x' }), ApiError);
    assertEquals(e.code, 'invalid_input');
  }
});

Deno.test("one user's release cannot touch another user's counter", async () => {
  const db = fakeDb({});
  const args = (uid: string) => ({ p_uid: uid, p_kind: 'identification', p_period_key: '2026-10' });
  await db.rpc('srv_reserve_usage', { ...args('a'), p_limit: 5 } as never);
  await db.rpc('srv_reserve_usage', { ...args('b'), p_limit: 5 } as never);
  await db.rpc('srv_release_usage', args('a') as never);
  await db.rpc('srv_release_usage', args('a') as never);
  assertEquals(db.usage['a:identification:2026-10'], 0);
  assertEquals(db.usage['b:identification:2026-10'], 1);
});

Deno.test('selectedProviderName follows the fail-closed selection', () => {
  const keys = ['IDENTIFY_PROVIDER', 'SUPABASE_URL', 'TENDRIL_LOCAL'];
  const saved = keys.map((k) => [k, Deno.env.get(k)] as const);
  try {
    Deno.env.delete('TENDRIL_LOCAL');
    Deno.env.set('SUPABASE_URL', 'https://abc.supabase.co');
    Deno.env.set('IDENTIFY_PROVIDER', 'fake');
    assertEquals(selectedProviderName(), 'plantid');
    Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:54321');
    assertEquals(selectedProviderName(), 'fake');
    Deno.env.delete('IDENTIFY_PROVIDER');
    assertEquals(selectedProviderName(), 'fake');
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
});
