import { assertEquals } from '@std/assert';
import { createHandler } from '../observations/handler.ts';
import { fakeDb } from '../_shared/testing/fake-db.ts';

const UID = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const SP = '33333333-3333-3333-3333-333333333333';
const SP2 = '44444444-4444-4444-4444-444444444444';
const ORCHID = '55555555-5555-5555-5555-555555555555';
const BIG_CELL = '599686042433355775'; // above 2^53: it must travel as a string
const NOW = new Date('2026-10-03T10:00:00Z');

const verifier = (id = UID) => ({ verify: () => Promise.resolve({ userId: id }) });
type Fb = { calls: { token: string; comment: string }[] };
function provider(): Fb & {
  identify: () => Promise<never>;
  feedback: (t: string, c: string) => Promise<void>;
} {
  const calls: Fb['calls'] = [];
  return {
    calls,
    identify: () => Promise.reject(new Error('unused')),
    feedback: (token, comment) => {
      calls.push({ token, comment });
      return Promise.resolve();
    },
  };
}
const obs = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  user_id: UID,
  status: 'identified',
  suggestions: [
    { speciesId: SP, probability: 0.94, providerEntityId: 'e1' },
    { speciesId: SP2, probability: 0.04, providerEntityId: 'e2' },
  ],
  ...extra,
});
const seed = (extra: Record<string, unknown> = {}) =>
  fakeDb({
    profiles: [{ id: UID, timezone: 'Europe/Dublin' }],
    households: [{ id: 'h1' }, { id: 'h2' }],
    household_members: [
      { household_id: 'h1', user_id: UID, role: 'owner' },
      { household_id: 'h2', user_id: UID, role: 'member' },
    ],
    species: [
      {
        id: SP,
        common_name: 'Peace lily',
        is_houseplant: true,
        sensitive: false,
        watering_min: 2,
        watering_max: 3,
        check_interval_days: null,
      },
      {
        id: SP2,
        common_name: 'Fern',
        is_houseplant: true,
        sensitive: false,
        watering_min: 1,
        watering_max: 1,
        check_interval_days: null,
      },
      {
        id: ORCHID,
        common_name: 'Orchid',
        is_houseplant: false,
        sensitive: true,
        watering_min: null,
        watering_max: null,
        check_interval_days: null,
      },
    ],
    observations: [obs('o1')],
    ...extra,
  });
const setup = {
  nickname: 'Lily',
  room: 'Bedroom',
  light: 'medium',
  potMaterial: 'plastic',
  potSizeCm: 14,
  drainage: 'yes',
  indoor: true,
};
const make = (db: ReturnType<typeof seed>, uid = UID, p = provider()) => ({
  p,
  h: createHandler({ db, verifier: verifier(uid), provider: p, now: () => NOW }),
});
type H = (r: Request) => Promise<Response>;
const post = (h: H, path: string, body?: unknown) =>
  h(
    new Request(`http://x/functions/v1/observations${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
const get = (h: H, path: string) => h(new Request(`http://x/functions/v1/observations${path}`));
const confirm = (h: H, id = 'o1', body: Record<string, unknown> = {}) =>
  post(h, `/${id}/confirm`, { speciesId: SP, action: 'add_plant', setup, ...body });
const point = {
  observation_id: 'o1',
  user_id: UID,
  point: 'SRID=4326;POINT(-6.26 53.35)',
  cell_r5: BIG_CELL,
};

Deno.test('confirm add_plant creates the plant, the first check and a Plantdex entry', async () => {
  const db = seed({ observation_locations: [point] });
  const { h } = make(db);
  const res = await confirm(h);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(typeof body.plantId, 'string');
  assertEquals(db.tables.care_tasks[0]?.due_on, '2026-10-07');
  assertEquals(db.tables.care_tasks[0]?.kind, 'check');
  assertEquals(db.tables.care_events[0]?.kind, 'setup');
  assertEquals(db.tables.plants[0]?.source, 'scan');
  assertEquals(db.tables.plants[0]?.observation_id, 'o1');
  assertEquals(db.tables.plantdex_entries[0]?.category, 'houseplant');
  const o = db.tables.observations[0]!;
  assertEquals(o.status, 'confirmed');
  assertEquals(o.intent, 'add_plant');
  assertEquals(o.place_type, 'home');
  assertEquals(o.species_id, SP);
  assertEquals(o.confidence, 0.94);
  assertEquals(o.plant_id, body.plantId);
  assertEquals(o.household_id, 'h1');
  assertEquals(typeof o.confirmed_at, 'string');
});

Deno.test('first check uses the curated interval override', async () => {
  const db = seed();
  db.tables.species[0]!.check_interval_days = 6;
  const { h } = make(db);
  await confirm(h);
  assertEquals(db.tables.care_tasks[0]?.due_on, '2026-10-09');
});

Deno.test(
  'add_plant into a named household links that household; a stranger household is 403',
  async () => {
    const db = seed();
    const { h } = make(db);
    assertEquals(
      (await confirm(h, 'o1', { householdId: '99999999-9999-9999-9999-999999999999' })).status,
      403,
    );
    assertEquals(db.tables.observations[0]?.status, 'identified');
    assertEquals(db.tables.plants.length, 0);
    assertEquals(
      (await confirm(h, 'o1', { householdId: '66666666-6666-6666-6666-666666666666' })).status,
      403,
    );
    const db2 = seed({
      households: [{ id: '66666666-6666-6666-6666-666666666666' }],
      household_members: [
        { household_id: '66666666-6666-6666-6666-666666666666', user_id: UID, role: 'member' },
      ],
    });
    const { h: h2 } = make(db2);
    assertEquals(
      (await confirm(h2, 'o1', { householdId: '66666666-6666-6666-6666-666666666666' })).status,
      200,
    );
    assertEquals(db2.tables.plants[0]?.household_id, '66666666-6666-6666-6666-666666666666');
    assertEquals(db2.tables.observations[0]?.household_id, '66666666-6666-6666-6666-666666666666');
  },
);

Deno.test('confirming twice is idempotent and never double-counts the Plantdex', async () => {
  const db = seed();
  const { h } = make(db);
  const a = await (await confirm(h)).json();
  const b = await (await confirm(h)).json();
  assertEquals(a, b);
  assertEquals(db.tables.plants.length, 1);
  assertEquals(db.tables.care_tasks.length, 1);
  assertEquals(db.tables.plantdex_entries[0]?.finds_count, 1);
});

Deno.test('another user gets 404, not 403', async () => {
  const db = seed();
  const { h } = make(db, OTHER);
  assertEquals((await confirm(h)).status, 404);
  assertEquals((await get(h, '/o1/outcome')).status, 404);
  assertEquals((await post(h, '/o1/discard')).status, 404);
  assertEquals(db.tables.observations[0]?.status, 'identified');
});

Deno.test('only an identified observation can be confirmed', async () => {
  for (const status of ['pending', 'failed', 'not_a_plant', 'discarded']) {
    const db = seed({ observations: [obs('o1', { status })] });
    const { h } = make(db);
    assertEquals((await confirm(h)).status, 409, status);
    assertEquals(db.tables.plants.length, 0);
    assertEquals(db.tables.plantdex_entries.length, 0);
  }
});

Deno.test('the species must be one of the stored suggestions', async () => {
  const db = seed();
  const { h } = make(db);
  assertEquals((await confirm(h, 'o1', { speciesId: ORCHID })).status, 400);
  assertEquals(db.tables.observations[0]?.status, 'identified');
});

Deno.test('input is validated against the database checks before any write', async () => {
  const db = seed();
  const { h } = make(db);
  const bad: Record<string, unknown>[] = [
    { setup: { ...setup, nickname: '' } },
    { setup: { ...setup, nickname: 'x'.repeat(41) } },
    { setup: { ...setup, room: 'x'.repeat(41) } },
    { setup: { ...setup, potSizeCm: 3 } },
    { setup: { ...setup, potSizeCm: 201 } },
    { setup: { ...setup, light: 'neon' } },
    { setup: { ...setup, potMaterial: 'glass' } },
    { setup: { ...setup, drainage: 'maybe' } },
    { setup: undefined },
    { placeType: 'wild' }, // add_plant is always at home
    { placeType: 'moon' },
    { action: 'steal' },
    { speciesId: 'nope' },
  ];
  for (const b of bad) assertEquals((await confirm(h, 'o1', b)).status, 400, JSON.stringify(b));
  assertEquals(db.tables.plants.length, 0);
  assertEquals(db.tables.observations[0]?.status, 'identified');
});

Deno.test('a find must say where it was', async () => {
  const db = seed();
  const { h } = make(db);
  assertEquals((await post(h, '/o1/confirm', { speciesId: SP, action: 'log_find' })).status, 400);
  assertEquals(db.tables.observations[0]?.status, 'identified');
});

Deno.test('a replay with a different species or action is a conflict', async () => {
  const db = seed();
  const { h } = make(db);
  await confirm(h);
  assertEquals((await confirm(h, 'o1', { speciesId: SP2 })).status, 409);
  assertEquals((await find(h)).status, 409);
});

Deno.test('a replay sends no second provider feedback', async () => {
  const db = seed();
  db.providerTokens.o1 = 'tok';
  const { h, p } = make(db);
  const body = { speciesId: SP2, action: 'log_find', placeType: 'wild' };
  await post(h, '/o1/confirm', body);
  await post(h, '/o1/confirm', body);
  await new Promise((r) => setTimeout(r, 0));
  assertEquals(p.calls.length, 1);
});

Deno.test('log_find records a wild find without a plant', async () => {
  const db = seed({ observations: [obs('o1', {})] });
  db.tables.species[0]!.is_houseplant = false;
  const { h } = make(db);
  const res = await post(h, '/o1/confirm', {
    speciesId: SP,
    action: 'log_find',
    placeType: 'garden_park',
  });
  assertEquals((await res.json()).plantId, null);
  assertEquals(db.tables.plants.length, 0);
  assertEquals(db.tables.plantdex_entries[0]?.category, 'wild');
  assertEquals(db.tables.observations[0]?.intent, 'log_find');
  assertEquals(db.tables.observations[0]?.place_type, 'garden_park');
  assertEquals(db.tables.observations[0]?.household_id, 'h1');
});

const find = (h: H, id = 'o1', body: Record<string, unknown> = {}) =>
  post(h, `/${id}/confirm`, { speciesId: SP, action: 'log_find', placeType: 'wild', ...body });

Deno.test('a wild find outside the zone shares its cell as the exact decimal string', async () => {
  const db = seed({ observation_locations: [point] });
  const { h } = make(db);
  await find(h);
  assertEquals(db.tables.observations[0]?.public_cell_r5, BIG_CELL);
});

Deno.test('garden finds and add_plant never share a cell', async () => {
  for (const placeType of ['garden_park']) {
    const db = seed({ observation_locations: [point] });
    const { h } = make(db);
    await find(h, 'o1', { placeType });
    assertEquals(db.tables.observations[0]?.public_cell_r5, null, placeType);
  }
  const db = seed({ observation_locations: [point] });
  await confirm(make(db).h);
  assertEquals(db.tables.observations[0]?.public_cell_r5, null);
});

Deno.test('the client never sends a cell or coordinates to the confirm function', async () => {
  const db = seed({ observation_locations: [point] });
  await find(make(db).h);
  const args = JSON.stringify(db.rpcCalls.find((c) => c.fn === 'srv_confirm_observation')?.args);
  assertEquals(/cell|lat|lng|point/i.test(args), false);
});

Deno.test('a sensitive species never gets a public cell', async () => {
  const db = seed({
    observations: [
      obs('o1', { suggestions: [{ speciesId: ORCHID, probability: 0.9, providerEntityId: 'e9' }] }),
    ],
    observation_locations: [point],
  });
  const { h } = make(db);
  const res = await post(h, '/o1/confirm', {
    speciesId: ORCHID,
    action: 'log_find',
    placeType: 'wild',
  });
  assertEquals(res.status, 200);
  assertEquals(db.tables.observations[0]?.public_cell_r5, null);
  assertEquals(db.tables.observations[0]?.status, 'confirmed');
});

Deno.test('a point inside the privacy zone never gets a public cell', async () => {
  const db = seed({
    observation_locations: [point],
    privacy_zones: [{ user_id: UID, center: 'SRID=4326;POINT(-6.261 53.351)', radius_m: 1500 }],
  });
  const { h } = make(db);
  await find(h);
  assertEquals(db.tables.observations[0]?.public_cell_r5, null);
  assertEquals(db.tables.observations[0]?.status, 'confirmed');
});

Deno.test('an observation without a location has no public cell', async () => {
  const db = seed();
  const { h } = make(db);
  await find(h);
  assertEquals(db.tables.observations[0]?.public_cell_r5, null);
});

Deno.test(
  'a second find of the same species keeps the Plantdex count and adds a find',
  async () => {
    const db = seed({ observations: [obs('o1'), obs('o2')] });
    const { h } = make(db);
    await post(h, '/o1/confirm', { speciesId: SP, action: 'log_find', placeType: 'wild' });
    await post(h, '/o2/confirm', { speciesId: SP, action: 'log_find', placeType: 'wild' });
    assertEquals(db.tables.plantdex_entries.length, 1);
    assertEquals(db.tables.plantdex_entries[0]?.finds_count, 2);
    const first = await (await get(h, '/o1/outcome')).json();
    const second = await (await get(h, '/o2/outcome')).json();
    assertEquals(first.newToPlantdex, true);
    assertEquals(second.newToPlantdex, false);
    assertEquals(second.plantdexCount, 1);
  },
);

Deno.test('outcome reports points status, Plantdex and no sets; unconfirmed is 409', async () => {
  const db = seed();
  const { h } = make(db);
  assertEquals((await get(h, '/o1/outcome')).status, 409);
  await confirm(h);
  assertEquals(await (await get(h, '/o1/outcome')).json(), {
    pointsStatus: 'none',
    points: 0,
    noPointsReason: null,
    newToPlantdex: true,
    plantdexCount: 1,
    sets: [],
  });
});

Deno.test(
  'choosing a lower suggestion sends provider feedback; choosing the top one does not',
  async () => {
    const db = seed();
    db.providerTokens.o1 = 'tok';
    const { h, p } = make(db);
    await post(h, '/o1/confirm', { speciesId: SP2, action: 'log_find', placeType: 'wild' });
    await new Promise((r) => setTimeout(r, 0));
    assertEquals(p.calls, [{ token: 'tok', comment: 'user chose e2' }]);

    const db2 = seed();
    db2.providerTokens.o1 = 'tok';
    const { h: h2, p: p2 } = make(db2);
    await confirm(h2);
    await new Promise((r) => setTimeout(r, 0));
    assertEquals(p2.calls, []);
  },
);

Deno.test('a provider feedback failure does not fail the confirm', async () => {
  const db = seed();
  db.providerTokens.o1 = 'tok';
  const p = { ...provider(), feedback: () => Promise.reject(new Error('down')) };
  const h = createHandler({ db, verifier: verifier(), provider: p, now: () => NOW });
  const res = await post(h, '/o1/confirm', {
    speciesId: SP2,
    action: 'log_find',
    placeType: 'wild',
  });
  assertEquals(res.status, 200);
});

Deno.test(
  'a failed plant creation leaves the observation identified so the user can retry',
  async () => {
    const db = seed({ household_members: [] });
    const { h } = make(db);
    assertEquals((await confirm(h)).status, 404); // no household yet
    assertEquals(db.tables.observations[0]?.status, 'identified');
    assertEquals(db.tables.plantdex_entries.length, 0);
  },
);

Deno.test(
  'discard marks the observation discarded; a confirmed one cannot be discarded',
  async () => {
    const db = seed({ observations: [obs('o1'), obs('o2')] });
    const { h } = make(db);
    assertEquals((await post(h, '/o1/discard')).status, 204);
    assertEquals(db.tables.observations[0]?.status, 'discarded');
    assertEquals((await post(h, '/o1/discard')).status, 204);
    await confirm(h, 'o2');
    assertEquals((await post(h, '/o2/discard')).status, 409);
    assertEquals(db.tables.observations[1]?.status, 'confirmed');
  },
);
