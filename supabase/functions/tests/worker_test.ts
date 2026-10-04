import { assert, assertEquals, assertNotEquals } from '@std/assert';
import { cellCentre, cellR7Text } from '../_shared/h3.ts';
import { fakeDb, type FakeDb } from '../_shared/testing/fake-db.ts';
import { captureLogs } from '../_shared/testing/logs.ts';
import type { WeatherForecast, WeatherProvider } from '../_shared/providers/weather.ts';
import { createHandler, type WorkerDeps } from '../worker/handler.ts';

const KEY = 'a'.repeat(64);
const SPECIES = '00000000-0000-4000-8000-0000000000c1';
const A = '00000000-0000-4000-8000-0000000000a1'; // premium, home area in Dublin
const B = '00000000-0000-4000-8000-0000000000b1'; // free, home area in Cork
const C = '00000000-0000-4000-8000-0000000000d1'; // no home area
const HA = '00000000-0000-4000-8000-0000000001a1';
const HB = '00000000-0000-4000-8000-0000000001b1';
const HC = '00000000-0000-4000-8000-0000000001d1';
const DUBLIN = { lat: 53.3498, lng: -6.2603 };
const CORK = { lat: 51.8985, lng: -8.4756 };

const plant = (id: string, household: string, by: string, over: Record<string, unknown> = {}) => ({
  id,
  household_id: household,
  species_id: SPECIES,
  created_by: by,
  status: 'alive',
  indoor: false,
  pot_material: 'unknown',
  pot_size_cm: null,
  light: 'unknown',
  drainage: 'unknown',
  care_state: {},
  cell_r7: null,
  created_at: '2026-10-01T00:00:00Z',
  ...over,
});

const P = {
  a1: '00000000-0000-4000-8000-000000000a01',
  a2: '00000000-0000-4000-8000-000000000a02',
  indoor: '00000000-0000-4000-8000-000000000a03',
  dead: '00000000-0000-4000-8000-000000000a04',
  b1: '00000000-0000-4000-8000-000000000b01',
  c1: '00000000-0000-4000-8000-000000000d01',
};

function seed(): FakeDb {
  const zone = (uid: string, p: { lat: number; lng: number }) => ({
    user_id: uid,
    center: `SRID=4326;POINT(${p.lng} ${p.lat})`,
    radius_m: 1000,
  });
  return fakeDb({
    profiles: [
      { id: A, timezone: 'Europe/Dublin', country_code: 'IE' },
      { id: B, timezone: 'Europe/Dublin', country_code: 'IE' },
      { id: C, timezone: 'UTC', country_code: 'IE' },
    ],
    household_members: [
      { household_id: HA, user_id: A, role: 'owner' },
      { household_id: HB, user_id: B, role: 'owner' },
      { household_id: HC, user_id: C, role: 'owner' },
    ],
    entitlements: [{ user_id: A, source: 'store', active_until: '2099-01-01T00:00:00Z' }],
    privacy_zones: [zone(A, DUBLIN), zone(B, CORK)],
    species: [{ id: SPECIES, watering_min: 2, watering_max: 2, check_interval_days: null }],
    plants: [
      plant(P.a1, HA, A),
      plant(P.a2, HA, A, { created_at: '2026-10-02T00:00:00Z' }),
      plant(P.indoor, HA, A, { indoor: true }),
      plant(P.dead, HA, A, { status: 'dead' }),
      plant(P.b1, HB, B),
      plant(P.c1, HC, C),
    ],
    care_tasks: [
      {
        id: 't1',
        plant_id: P.a1,
        household_id: HA,
        kind: 'check',
        due_on: '2026-10-15',
        status: 'due',
      },
      {
        id: 't2',
        plant_id: P.dead,
        household_id: HA,
        kind: 'check',
        due_on: '2026-10-15',
        status: 'superseded',
      },
    ],
  });
}

function recordingWeather(summary: WeatherForecast = { rainNext48hMm: 6.5, maxTempNext48hC: 14 }) {
  const calls: { lat: number; lng: number; tz: string }[] = [];
  const provider: WeatherProvider = {
    forecast(lat, lng, tz) {
      calls.push({ lat, lng, tz });
      return Promise.resolve({ ...summary });
    },
  };
  return { provider, calls };
}

function handler(db: FakeDb, over: Partial<WorkerDeps> = {}) {
  return createHandler({
    db,
    weather: recordingWeather().provider,
    workerKey: KEY,
    now: () => new Date('2026-10-10T03:17:00Z'),
    ...over,
  });
}

const post = (path: string, headers: Record<string, string> = {}) =>
  new Request(`http://localhost/functions/v1/worker${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: '{}',
  });
const withKey = (path: string, key = KEY) => post(path, { authorization: `Bearer ${key}` });

// Auth ----------------------------------------------------------------------------------------------------------

Deno.test('worker: no bearer is 401 and touches nothing', async () => {
  const db = seed();
  const res = await handler(db)(post('/weather'));
  assertEquals(res.status, 401);
  assertEquals(db.rpcCalls, []);
});

Deno.test('worker: a user JWT, or the key as apikey, is 401', async () => {
  const db = seed();
  const h = handler(db);
  const jwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ.c2ln';
  assertEquals((await h(post('/nightly', { authorization: `Bearer ${jwt}` }))).status, 401);
  assertEquals((await h(post('/nightly', { apikey: KEY }))).status, 401, 'apikey is ignored');
  assertEquals((await h(post('/nightly', { authorization: `Basic ${KEY}` }))).status, 401);
  assertEquals(
    (await h(withKey('/nightly', 'b'.repeat(64)))).status,
    401,
    'same length, wrong key',
  );
  assertEquals((await h(withKey('/nightly', `${KEY}x`))).status, 401, 'a longer key');
  assertEquals((await h(withKey('/nightly', KEY.slice(1)))).status, 401, 'a shorter key');
  assertEquals((await h(withKey('/unknown'))).status !== 401, true, 'routing happens after auth');
  assertEquals((await h(post('/unknown'))).status, 401, 'an unknown route without the key is 401');
  assertEquals(db.rpcCalls, []);
});

Deno.test(
  'worker: no WORKER_KEY configured means every call is 401, with the same body',
  async () => {
    const db = seed();
    for (const workerKey of [undefined, '']) {
      const res = await handler(db, { workerKey })(withKey('/weather'));
      assertEquals(res.status, 401);
      const wrong = await handler(db)(withKey('/weather', 'nope'));
      assertEquals(await res.json(), await wrong.json(), 'no detail on why');
    }
    assertEquals(db.rpcCalls, []);
  },
);

Deno.test('worker: a missing WORKER_KEY is logged once, by name only', async () => {
  for (const workerKey of [undefined, '']) {
    const { logs } = await captureLogs(async () => {
      const h = handler(seed(), { workerKey });
      for (let i = 0; i < 3; i++) assertEquals((await h(withKey('/nightly'))).status, 401);
    });
    assertEquals(logs.filter((l) => l.message === 'worker_key_missing').length, 1);
    assert(!JSON.stringify(logs).includes(KEY));
  }
  const { logs } = await captureLogs(async () => {
    await handler(seed())(withKey('/nightly'));
  });
  assertEquals(logs.filter((l) => l.message === 'worker_key_missing').length, 0, 'not when set');
});

Deno.test('worker: unknown paths and methods are 404 with the key', async () => {
  const h = handler(seed());
  assertEquals((await h(withKey('/unknown'))).status, 404);
  const get = new Request('http://localhost/functions/v1/worker/weather', {
    headers: { authorization: `Bearer ${KEY}` },
  });
  assertEquals((await h(get)).status, 404);
});

// /weather ------------------------------------------------------------------------------------------------------

Deno.test(
  'worker /weather: 202, fills cells for outdoor plants with a home area, caches premium cells',
  async () => {
    const db = seed();
    const { provider, calls } = recordingWeather();
    const res = await handler(db, { weather: provider })(withKey('/weather'));
    assertEquals(res.status, 202);
    assertEquals(await res.json(), { accepted: true });

    const cell = (id: string) => db.tables.plants!.find((p) => p.id === id)!.cell_r7;
    const dublin = cellR7Text(DUBLIN.lat, DUBLIN.lng);
    assertEquals(cell(P.a1), dublin, 'decimal text from the zone centre');
    assertEquals(cell(P.a2), dublin);
    assertEquals(cell(P.b1), cellR7Text(CORK.lat, CORK.lng), 'free plants get a cell too');
    assertEquals(cell(P.indoor), null);
    assertEquals(cell(P.dead), null);
    assertEquals(cell(P.c1), null, 'no home area, no cell');

    // One fetch per premium cell, at the cell centre (never the zone centre), in the owner's tz.
    assertEquals(calls, [{ ...cellCentre(dublin), tz: 'Europe/Dublin' }]);
    assertNotEquals({ lat: calls[0]!.lat, lng: calls[0]!.lng }, DUBLIN);
    assertEquals(
      db.tables.weather_cache!.map((w) => [w.cell_r7, w.tz, w.summary]),
      [[dublin, 'Europe/Dublin', { rainNext48hMm: 6.5, maxTempNext48hC: 14 }]],
    );
    const set = db.rpcCalls.find((c) => c.fn === 'srv_set_plant_cells')!;
    assert((set.args.p_cells as { cell: unknown }[]).every((c) => typeof c.cell === 'string'));
  },
);

Deno.test('worker /weather: a fresh cell is not fetched again on the next call', async () => {
  const db = seed();
  const { provider, calls } = recordingWeather();
  const h = handler(db, { weather: provider });
  await h(withKey('/weather'));
  await h(withKey('/weather'));
  assertEquals(calls.length, 1);
  const due = db.rpcCalls.filter((c) => c.fn === 'srv_weather_cells_due');
  assertEquals(due[0]!.args, { p_older_than: '5 hours', p_limit: 500 });
});

Deno.test('worker /weather: one failing cell is logged and skipped', async () => {
  const db = seed();
  // B goes premium too: two cells due.
  db.tables.entitlements!.push({
    user_id: B,
    source: 'store',
    active_until: '2099-01-01T00:00:00Z',
  });
  const dublin = cellCentre(cellR7Text(DUBLIN.lat, DUBLIN.lng));
  const provider: WeatherProvider = {
    forecast: (lat) =>
      lat === dublin.lat
        ? Promise.reject(new Error('weatherkit: request failed (500)'))
        : Promise.resolve({ rainNext48hMm: 0, maxTempNext48hC: 12 }),
  };
  const { result: res, logs } = await captureLogs(() =>
    handler(db, { weather: provider })(withKey('/weather')),
  );
  assertEquals(res.status, 202);
  assertEquals(
    db.tables.weather_cache!.map((w) => w.cell_r7),
    [cellR7Text(CORK.lat, CORK.lng)],
  );
  const failed = logs.find((l) => l.message === 'weather_cell_failed');
  assertEquals(failed?.cell, cellR7Text(DUBLIN.lat, DUBLIN.lng));
  const run = logs.find((l) => l.message === 'weather_run');
  assertEquals([run?.due, run?.cellsStored, run?.failed], [2, 1, 1]);
  const text = JSON.stringify(logs);
  for (const n of [DUBLIN.lat, DUBLIN.lng, CORK.lat, CORK.lng, dublin.lat, dublin.lng]) {
    assert(!text.includes(String(n)), `no coordinates in logs (${n})`);
  }
  assert(!text.includes(KEY), 'no key in logs');
});

Deno.test('worker /weather: no provider still fills cells but fetches nothing', async () => {
  const db = seed();
  const res = await handler(db, { weather: null })(withKey('/weather'));
  assertEquals(res.status, 202);
  assertEquals(
    db.tables.plants!.find((p) => p.id === P.a1)!.cell_r7,
    cellR7Text(DUBLIN.lat, DUBLIN.lng),
  );
  assertEquals(db.tables.weather_cache!, []);
  assertEquals(
    db.rpcCalls.some((c) => c.fn === 'srv_weather_cells_due'),
    false,
  );
});

Deno.test('worker /weather: cells are filled a page at a time until none are missing', async () => {
  const many = Array.from({ length: 450 }, (_, i) =>
    plant(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, HA, A),
  );
  const db = seed();
  db.tables.plants!.push(...many);
  await handler(db)(withKey('/weather'));
  const pages = db.rpcCalls.filter((c) => c.fn === 'srv_plants_missing_cell');
  assertEquals(
    pages.map((c) => c.args.p_limit),
    [200, 200, 200],
  );
  assertEquals(
    db.tables
      .plants!.filter((p) => p.status === 'alive' && !p.indoor && p.cell_r7 == null)
      .map((p) => p.id),
    [P.c1],
  );
});

Deno.test('worker /weather: a run past its budget stops cleanly and says so', async () => {
  const db = seed();
  const { result, logs } = await captureLogs(() =>
    handler(db, { budgetMs: 0 })(withKey('/weather')),
  );
  assertEquals(result.status, 202);
  assertEquals(db.rpcCalls, []);
  const stop = logs.find((l) => l.message === 'worker_budget_exhausted');
  assertEquals([stop?.route, stop?.cellsFilled, stop?.cellsStored], ['weather', 0, 0]);
});

Deno.test('worker /weather: a cell fetched just under 6 hours ago is due again', async () => {
  // The cron runs every 6 hours and fetched_at is stamped after the due query, so a 6-hour max age would skip it.
  const db = seed();
  const dublin = cellR7Text(DUBLIN.lat, DUBLIN.lng);
  for (const p of db.tables.plants!) if (p.created_by === A && !p.indoor) p.cell_r7 = dublin;
  db.tables.weather_cache!.push({
    cell_r7: dublin,
    tz: 'Europe/Dublin',
    summary: { rainNext48hMm: 0, maxTempNext48hC: 10 },
    fetched_at: new Date(Date.now() - (6 * 3600 - 5) * 1000).toISOString(),
  });
  const { provider, calls } = recordingWeather();
  await handler(db, { weather: provider })(withKey('/weather'));
  assertEquals(calls.length, 1);
  const due = db.rpcCalls.find((c) => c.fn === 'srv_weather_cells_due')!;
  assertEquals(due.args.p_older_than, '5 hours');
});

Deno.test('worker /weather: filling stops at a page that writes nothing', async () => {
  const db = seed();
  db.tables.plants!.push(
    ...Array.from({ length: 450 }, (_, i) =>
      plant(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, HA, A),
    ),
  );
  // Every plant raced away (went indoor, died) between the read and the write.
  db.rpcImpl.srv_set_plant_cells = () => ({ data: 0, error: null });
  const { result } = await captureLogs(() => handler(db)(withKey('/weather')));
  assertEquals(result.status, 202);
  assertEquals(db.rpcCalls.filter((c) => c.fn === 'srv_plants_missing_cell').length, 1);
  assert(
    db.rpcCalls.some((c) => c.fn === 'srv_weather_cells_due'),
    'the refresh still runs',
  );
});

Deno.test('worker /weather: filling stops between pages when the budget runs out', async () => {
  const db = seed();
  db.tables.plants!.push(
    ...Array.from({ length: 450 }, (_, i) =>
      plant(`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, HA, A),
    ),
  );
  let t = 0;
  // Each read of the clock moves time on 10 ms: room for a page or two of the three.
  const { logs } = await captureLogs(() =>
    handler(db, { budgetMs: 25, clock: () => (t += 10) })(withKey('/weather')),
  );
  const pages = db.rpcCalls.filter((c) => c.fn === 'srv_plants_missing_cell').length;
  assert(pages >= 1 && pages < 3, `${pages} pages`);
  assert(
    db.tables.plants!.some(
      (p) => p.status === 'alive' && !p.indoor && p.created_by === A && p.cell_r7 == null,
    ),
  );
  assertEquals(
    db.rpcCalls.some((c) => c.fn === 'srv_weather_cells_due'),
    false,
    'no refresh after',
  );
  const stop = logs.find((l) => l.message === 'worker_budget_exhausted');
  assertEquals([stop?.route, stop?.cellsFilled], ['weather', pages * 200]);
});

Deno.test(
  'worker /weather: a failure while filling cells is logged and the refresh still runs',
  async () => {
    const db = seed();
    const dublin = cellR7Text(DUBLIN.lat, DUBLIN.lng);
    db.tables.plants!.find((p) => p.id === P.a1)!.cell_r7 = dublin;
    db.rpcImpl.srv_plants_missing_cell = () => ({
      data: null,
      error: { code: 'XX000', message: 'down' },
    });
    const { provider, calls } = recordingWeather();
    const { result, logs } = await captureLogs(() =>
      handler(db, { weather: provider })(withKey('/weather')),
    );
    assertEquals(result.status, 202);
    assert(
      logs.some((l) => l.message === 'weather_fill_failed'),
      JSON.stringify(logs),
    );
    assertEquals(calls.length, 1);
    assertEquals(
      db.tables.weather_cache!.map((w) => w.cell_r7),
      [dublin],
    );
    const run = logs.find((l) => l.message === 'weather_run');
    assertEquals([run?.cellsFilled, run?.cellsStored], [0, 1]);
  },
);

Deno.test('worker /weather: a failed refresh logs the counts so far', async () => {
  const db = seed();
  db.rpcImpl.srv_weather_cells_due = () => ({
    data: null,
    error: { code: 'XX000', message: 'down' },
  });
  const { result, logs } = await captureLogs(() => handler(db)(withKey('/weather')));
  assertEquals(result.status, 202);
  const run = logs.find((l) => l.message === 'weather_run');
  assertEquals([run?.aborted, run?.cellsFilled], [true, 3]);
  assert(logs.some((l) => l.message === 'worker_run_failed' && l.route === 'weather'));
});

// /nightly ------------------------------------------------------------------------------------------------------

Deno.test('worker /nightly: 202 and exactly one open check per alive plant', async () => {
  const db = seed();
  const res = await handler(db)(withKey('/nightly'));
  assertEquals(res.status, 202);
  assertEquals(await res.json(), { accepted: true });
  for (const p of db.tables.plants!) {
    const open = db.tables.care_tasks!.filter(
      (t) => t.plant_id === p.id && t.kind === 'check' && t.status === 'due',
    );
    assertEquals(open.length, p.status === 'alive' ? 1 : 0, `${p.id} ${p.status}`);
  }
  // Plants are dated from each one's local date: 03:17Z is 2026-10-10 in Dublin, base interval 7.
  assertEquals(
    db.tables.care_tasks!.find((t) => t.plant_id === P.b1 && t.status === 'due')!.due_on,
    '2026-10-17',
  );
  const again = await captureLogs(() => handler(db)(withKey('/nightly')));
  const run = again.logs.find((l) => l.message === 'nightly_run');
  assertEquals([run?.updated, run?.skipped], [0, 5], 'a second run writes nothing');
});

Deno.test('worker /nightly: a failure is logged and still answers 202', async () => {
  const db = seed();
  db.rpcImpl.srv_recompute_batch = () => ({
    data: null,
    error: { code: 'XX000', message: 'down' },
  });
  const { result, logs } = await captureLogs(() => handler(db)(withKey('/nightly')));
  assertEquals(result.status, 202);
  assert(logs.some((l) => l.message === 'worker_run_failed' && l.route === 'nightly'));
});

// Background work ------------------------------------------------------------------------------------------------

Deno.test('worker: with waitUntil the answer comes first and the work finishes after', async () => {
  const db = seed();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const provider: WeatherProvider = {
    forecast: async () => {
      await gate;
      return { rainNext48hMm: 1, maxTempNext48hC: 10 };
    },
  };
  const pending: Promise<unknown>[] = [];
  const res = await handler(db, { weather: provider, waitUntil: (p) => pending.push(p) })(
    withKey('/weather'),
  );
  assertEquals(res.status, 202);
  assertEquals(pending.length, 1);
  assertEquals(db.tables.weather_cache!, [], 'nothing stored yet');
  release();
  await pending[0];
  assertEquals(db.tables.weather_cache!.length, 1);
});
