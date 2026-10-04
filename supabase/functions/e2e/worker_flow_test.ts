// The cron worker against the local stack (`pnpm e2e:functions`): the fake weather provider, the weather cache and the
// nightly recompute, called exactly as pg_cron's private.call_worker calls them.
import { assert, assertEquals } from '@std/assert';
import {
  admin,
  call,
  createUser,
  deleteUsers,
  eventually,
  PUBLISHABLE,
  type TestUser,
  URL_,
} from './support.ts';

const WORKER_KEY = Deno.env.get('WORKER_KEY');
if (!WORKER_KEY) {
  throw new Error('Run through `pnpm e2e:functions`: WORKER_KEY is not set (run `pnpm db:cron`).');
}
/** The e2e script deletes these cells' cache rows afterwards (private.weather_cache is not reachable from here). */
const CELLS_FILE = Deno.env.get('E2E_WEATHER_CELLS_FILE');

const worker = (path: string, headers: Record<string, string> = {}) =>
  fetch(`${URL_}/functions/v1/worker${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: '{}',
  });
/** pg_cron's headers: the worker key as the bearer (and as apikey, which the worker ignores). */
const cron = (path: string) =>
  worker(path, { authorization: `Bearer ${WORKER_KEY}`, apikey: WORKER_KEY });

const openChecks = async (plantId: string) => {
  const res = await admin
    .from('care_tasks')
    .select('id, due_on')
    .eq('plant_id', plantId)
    .eq('kind', 'check')
    .eq('status', 'due');
  if (res.error) throw res.error;
  return res.data ?? [];
};

Deno.test('worker: /weather caches the plant cell, /nightly keeps one open check', async (t) => {
  const users: TestUser[] = [];
  try {
    const u = await createUser();
    users.push(u);
    const boot = await call(u, 'POST', 'me/bootstrap', {
      ageConfirmed13Plus: true,
      timezone: 'Europe/Dublin',
      countryCode: 'IE',
    });
    assertEquals(boot.status, 200, JSON.stringify(boot.json));
    const area = await call(u, 'PUT', 'me/home-area', { lat: 53.35, lng: -6.26, radiusM: 1000 });
    assertEquals(area.status, 200, JSON.stringify(area.json));
    const premium = await admin.from('entitlements').insert({
      user_id: u.id,
      source: 'store',
      active_until: new Date(Date.now() + 86_400_000).toISOString(),
    });
    assertEquals(premium.error, null);
    const species = await admin.from('species').select('id').order('slug').limit(1).single();
    assertEquals(species.error, null);
    const created = await call(u, 'POST', 'care/plants', {
      source: 'manual',
      speciesId: species.data!.id,
      setup: {
        nickname: 'Rosemary',
        room: 'Garden',
        light: 'bright',
        potMaterial: 'terracotta',
        potSizeCm: 20,
        drainage: 'yes',
        indoor: false,
      },
    });
    assertEquals(created.status, 200, JSON.stringify(created.json));
    const plantId: string = created.json.plantId;

    await t.step('without the worker key: 401', async () => {
      const none = await worker('/weather');
      assertEquals(none.status, 401);
      await none.body?.cancel();
      const asUser = await worker('/nightly', {
        authorization: `Bearer ${u.token}`,
        apikey: PUBLISHABLE,
      });
      assertEquals(asUser.status, 401, 'a user JWT is not the worker key');
      await asUser.body?.cancel();
      const apikeyOnly = await worker('/nightly', { apikey: WORKER_KEY });
      assertEquals(apikeyOnly.status, 401, 'the key as apikey alone is not enough');
      await apikeyOnly.body?.cancel();
    });

    let cell = '';
    await t.step('/weather: 202, then the plant has a cell and the cell a forecast', async () => {
      const res = await cron('/weather');
      assertEquals(res.status, 202);
      assertEquals(await res.json(), { accepted: true });
      cell = await eventually('the plant cell', async () => {
        const r = await admin
          .from('plants')
          .select('cell:cell_r7::text')
          .eq('id', plantId)
          .single();
        if (r.error) throw r.error;
        return (r.data as { cell: string | null }).cell;
      });
      assert(/^\d+$/.test(cell) && BigInt(cell) > 2n ** 53n, cell);
      const cached = await eventually('the cached forecast', async () => {
        const r = await admin.rpc('srv_weather_for_cell', { p_cell: cell });
        if (r.error) throw r.error;
        return (r.data as { summary: unknown; fetched_at: string }[])[0];
      });
      assertEquals(
        cached.summary,
        { rainNext48hMm: 0, maxTempNext48hC: 18 },
        'the fake: dry, mild',
      );
    });

    await t.step('/nightly: 202, then the plant has exactly one open check', async () => {
      // Close the plant's open check so the run has to date a new one.
      const closed = await admin
        .from('care_tasks')
        .update({ status: 'superseded', completed_at: new Date().toISOString() })
        .eq('plant_id', plantId)
        .eq('kind', 'check')
        .eq('status', 'due');
      assertEquals(closed.error, null);
      assertEquals((await openChecks(plantId)).length, 0);

      const res = await cron('/nightly');
      assertEquals(res.status, 202);
      assertEquals(await res.json(), { accepted: true });
      const open = await eventually('an open check', async () => {
        const rows = await openChecks(plantId);
        return rows.length > 0 ? rows : null;
      });
      assertEquals(open.length, 1);
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin' }).format(
        new Date(),
      );
      assert(open[0]!.due_on > today, `dated after today: ${open[0]!.due_on}`);
      const state = await admin.from('plants').select('care_state').eq('id', plantId).single();
      assert((state.data?.care_state as { checkBasis?: unknown }).checkBasis, 'basis recorded');
    });
  } finally {
    const ids = users.map((x) => x.id);
    if (CELLS_FILE && ids.length > 0) {
      const r = await admin.from('plants').select('cell:cell_r7::text').in('created_by', ids);
      const cells = ((r.data ?? []) as { cell: string | null }[])
        .map((x) => x.cell)
        .filter((c): c is string => !!c);
      if (cells.length > 0) {
        await Deno.writeTextFile(CELLS_FILE, `${cells.join('\n')}\n`, { append: true });
      }
    }
    await deleteUsers(ids);
  }
});
