import { assertEquals } from '@std/assert';
import { createHandler } from '../care/handler.ts';
import { fakeDb } from '../_shared/testing/fake-db.ts';

const UID = '11111111-1111-1111-1111-111111111111';
const PARTNER = '22222222-2222-2222-2222-222222222222';
const OUTSIDER = '33333333-3333-3333-3333-333333333333';
const PEACE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const FERN = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const P1 = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1';
const P2 = 'c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2';
const CID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NOW = new Date('2026-10-03T10:00:00Z'); // 3 October, Dublin time too
const TODAY = '2026-10-03';
const H1 = 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1';
const H2 = 'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2';
const T1 = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';
const T2 = 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2';
const TC = 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3';

const seed = (extra: Record<string, unknown> = {}) =>
  fakeDb({
    profiles: [
      { id: UID, timezone: 'Europe/Dublin' },
      { id: PARTNER, timezone: 'UTC' },
      { id: OUTSIDER, timezone: 'UTC' },
    ],
    households: [{ id: H1 }, { id: H2 }],
    household_members: [
      { household_id: H1, user_id: UID, role: 'owner' },
      { household_id: H1, user_id: PARTNER, role: 'member' },
      { household_id: H2, user_id: OUTSIDER, role: 'owner' },
    ],
    species: [
      { id: PEACE, watering_min: 2, watering_max: 3, check_interval_days: null },
      { id: FERN, watering_min: 1, watering_max: 1, check_interval_days: 12 },
    ],
    plants: [
      { id: P1, household_id: H1, species_id: PEACE, nickname: 'Lily', status: 'alive' },
      { id: P2, household_id: H1, species_id: FERN, nickname: 'Fern', status: 'alive' },
    ],
    care_tasks: [
      {
        id: TC,
        plant_id: P1,
        household_id: H1,
        kind: 'check',
        due_on: TODAY,
        status: 'due',
      },
    ],
    qr_codes: [
      { code: 'PL-0001', species_id: PEACE, status: 'active' },
      { code: 'PL-OLD1', species_id: PEACE, status: 'retired' },
    ],
    ...extra,
  });
type Db = ReturnType<typeof seed>;

const make = (db: Db, uid = UID) =>
  createHandler({
    db,
    verifier: { verify: () => Promise.resolve({ userId: uid }) },
    now: () => NOW,
  });
const call = async (
  h: (r: Request) => Promise<Response>,
  method: string,
  path: string,
  body?: unknown,
) => {
  const res = await h(
    new Request(`http://x/care${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: 'Bearer t' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

const checkIn = (clientId: string, soilDry: boolean, extra: Record<string, unknown> = {}) => ({
  clientId,
  plantId: P1,
  soilDry,
  leafStates: ['healthy'],
  occurredAt: NOW.toISOString(),
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
const due = (db: Db, plant = P1) =>
  db.tables.care_tasks!.filter((t) => t.plant_id === plant && t.status === 'due');

// --- check-ins --------------------------------------------------------------------------------------------------
Deno.test('check-in: a No creates no water task and checks again in two days', async () => {
  const db = seed();
  const r = await call(make(db), 'POST', '/checkins', checkIn(CID(1), false));
  assertEquals(r.status, 200);
  assertEquals(r.body, {
    nextCheckOn: '2026-10-05',
    nextCheckWeekday: 'Monday',
    waterTaskCreated: false,
    streakDays: 0,
  });
  assertEquals(
    due(db).map((t) => [t.kind, t.due_on]),
    [['check', '2026-10-05']],
  );
});

Deno.test(
  'check-in: a Yes creates a water task today and checks again at the base interval',
  async () => {
    const db = seed();
    const r = await call(make(db), 'POST', '/checkins', checkIn(CID(1), true));
    assertEquals(r.body.waterTaskCreated, true);
    assertEquals(r.body.nextCheckOn, '2026-10-07'); // peace lily, watering 2 to 3: four days
    assertEquals(r.body.nextCheckWeekday, 'Wednesday');
    assertEquals(
      due(db)
        .map((t) => [t.kind, t.due_on])
        .sort(),
      [
        ['check', '2026-10-07'],
        ['water', TODAY],
      ],
    );
    // the previous check task is done
    assertEquals(db.tables.care_tasks!.find((t) => t.id === TC)!.status, 'done');
  },
);

Deno.test('check-in: the curated interval wins over the watering range', async () => {
  const db = seed();
  const r = await call(make(db), 'POST', '/checkins', { ...checkIn(CID(1), true), plantId: P2 });
  assertEquals(r.body.nextCheckOn, '2026-10-15'); // fern override: 12 days
});

Deno.test(
  'check-in: a retry with the same clientId returns the same body and stores one event',
  async () => {
    const db = seed();
    const h = make(db);
    const a = await call(h, 'POST', '/checkins', checkIn(CID(1), true));
    const b = await call(h, 'POST', '/checkins', checkIn(CID(1), true));
    assertEquals(b.status, 200);
    assertEquals(b.body, a.body);
    assertEquals(db.tables.care_events!.filter((e) => e.kind === 'checkin').length, 1);
    assertEquals(due(db).length, 2);
  },
);

Deno.test(
  'check-in: a clientId already used on another plant or by another member is a conflict',
  async () => {
    const db = seed();
    await call(make(db), 'POST', '/checkins', checkIn(CID(1), false));
    const otherPlant = await call(make(db), 'POST', '/checkins', {
      ...checkIn(CID(1), false),
      plantId: P2,
    });
    assertEquals(otherPlant.status, 409);
    const otherUser = await call(make(db, PARTNER), 'POST', '/checkins', checkIn(CID(1), false));
    assertEquals(otherUser.status, 409);
  },
);

Deno.test(
  'check-in: someone outside the household gets 403, an unknown plant 404, a closed plant 409',
  async () => {
    const db = seed();
    assertEquals(
      (await call(make(db, OUTSIDER), 'POST', '/checkins', checkIn(CID(1), false))).status,
      403,
    );
    const ghost = { ...checkIn(CID(2), false), plantId: CID(99) };
    assertEquals((await call(make(db), 'POST', '/checkins', ghost)).status, 404);
    db.tables.plants!.find((p) => p.id === P1)!.status = 'dead';
    assertEquals((await call(make(db), 'POST', '/checkins', checkIn(CID(3), false))).status, 409);
    assertEquals(db.tables.care_events!.length, 0);
  },
);

Deno.test('check-in: validation happens before any write', async () => {
  const db = seed();
  const h = make(db);
  const bad: Record<string, unknown>[] = [
    { clientId: 'not-a-uuid' },
    { occurredAt: '2026-10-09T10:00:00Z' }, // more than two days out
    { occurredAt: 'yesterday' },
    { leafStates: ['mouldy'] },
    { leafStates: 'healthy' },
    { soilDry: 'yes' },
    { photoPath: `${UID}/../${PARTNER}/a.jpg` },
    { photoPath: `${PARTNER}/a.jpg` },
    { plantId: 'nope' },
  ];
  for (const patch of bad) {
    const r = await call(h, 'POST', '/checkins', { ...checkIn(CID(1), true), ...patch });
    assertEquals([400, 403].includes(r.status), true, JSON.stringify(patch));
  }
  assertEquals(db.tables.care_events!.length, 0);
  const ok = await call(
    h,
    'POST',
    '/checkins',
    checkIn(CID(1), false, { photoPath: `${UID}/c.jpg` }),
  );
  assertEquals(ok.status, 200);
});

// --- creating plants --------------------------------------------------------------------------------------------
Deno.test(
  'POST /plants from a label: species from the code, adoption recorded, no quota used',
  async () => {
    const db = seed();
    const r = await call(make(db), 'POST', '/plants', {
      source: 'label_qr',
      labelCode: ' pl-0001 ',
      speciesId: FERN, // ignored: the code decides
      setup,
    });
    assertEquals(r.status, 200);
    const plant = db.tables.plants!.find((p) => p.id === r.body.plantId)!;
    assertEquals(plant.source, 'label_qr');
    assertEquals(plant.species_id, PEACE);
    assertEquals(plant.label_code, 'PL-0001');
    assertEquals(plant.household_id, H1);
    const scans = db.tables.qr_scans!;
    assertEquals(scans.length, 1);
    assertEquals(
      [scans[0]!.code, scans[0]!.event, scans[0]!.user_id],
      ['PL-0001', 'adoption', UID],
    );
    assertEquals(db.rpcCalls.filter((c) => c.fn === 'srv_reserve_usage').length, 0);
    // the first check is a base interval after today (peace lily: four days)
    const first = db.tables.care_tasks!.find((t) => t.plant_id === r.body.plantId)!;
    assertEquals([first.kind, first.due_on], ['check', '2026-10-07']);
  },
);

Deno.test(
  'POST /plants from a label: retired, unknown or malformed codes are refused',
  async () => {
    const db = seed();
    const h = make(db);
    const go = (labelCode: unknown) =>
      call(h, 'POST', '/plants', { source: 'label_qr', labelCode, setup });
    assertEquals((await go('PL-OLD1')).status, 404);
    assertEquals((await go('NOPE-9999')).status, 404);
    assertEquals((await go('x')).status, 400);
    assertEquals((await go(undefined)).status, 400);
    assertEquals(db.tables.plants!.length, 2);
    assertEquals(db.tables.qr_scans!.length, 0);
  },
);

Deno.test('POST /plants manual: uses the curated interval and the setup', async () => {
  const db = seed();
  const r = await call(make(db), 'POST', '/plants', { source: 'manual', speciesId: FERN, setup });
  assertEquals(r.status, 200);
  const first = db.tables.care_tasks!.find((t) => t.plant_id === r.body.plantId)!;
  assertEquals(first.due_on, '2026-10-15');
  assertEquals(db.tables.qr_scans!.length, 0);
});

Deno.test('POST /plants: invalid input is a 400 before any write', async () => {
  const db = seed();
  const h = make(db);
  const base = { source: 'manual', speciesId: PEACE, setup };
  const bad: unknown[] = [
    { ...base, source: 'scan' },
    { ...base, speciesId: undefined },
    { ...base, speciesId: 'nope' },
    { ...base, speciesId: CID(5) }, // unknown species
    { ...base, setup: { ...setup, nickname: '' } },
    { ...base, setup: { ...setup, nickname: '   ' } },
    { ...base, setup: { ...setup, nickname: 'a'.repeat(41) } },
    { ...base, setup: { ...setup, room: 'r'.repeat(41) } },
    { ...base, setup: { ...setup, light: 'dim' } },
    { ...base, setup: { ...setup, potSizeCm: 3 } },
    { ...base, setup: undefined },
    { ...base, householdId: 'not-a-uuid' },
  ];
  for (const b of bad)
    assertEquals((await call(h, 'POST', '/plants', b)).status, 400, JSON.stringify(b));
  assertEquals(db.tables.plants!.length, 2);
  const longest = await call(h, 'POST', '/plants', {
    ...base,
    setup: { ...setup, nickname: 'a'.repeat(40) },
  });
  assertEquals(longest.status, 200);
});

Deno.test('POST /plants: another household is 403', async () => {
  const db = seed();
  const r = await call(make(db), 'POST', '/plants', {
    source: 'gift',
    speciesId: PEACE,
    setup,
    householdId: H2,
  });
  assertEquals(r.status, 403);
});

// --- editing ----------------------------------------------------------------------------------------------------
Deno.test('PATCH /plants/:id changes the setup fields and nothing else', async () => {
  const db = seed();
  const r = await call(make(db, PARTNER), 'PATCH', `/plants/${P1}`, {
    nickname: '  Big Lily ',
    room: 'Kitchen',
    light: 'bright',
    potSizeCm: 20,
  });
  assertEquals(r.status, 204);
  const p = db.tables.plants!.find((x) => x.id === P1)!;
  assertEquals(
    [p.nickname, p.room, p.light, p.pot_size_cm, p.species_id],
    ['Big Lily', 'Kitchen', 'bright', 20, PEACE],
  );
  await call(make(db), 'PATCH', `/plants/${P1}`, { room: null });
  assertEquals(db.tables.plants!.find((x) => x.id === P1)!.room, null);
});

Deno.test('PATCH /plants/:id validates, and respects household membership', async () => {
  const db = seed();
  const h = make(db);
  for (const b of [
    {},
    { nickname: '' },
    { nickname: '   ' },
    { nickname: 'a'.repeat(41) },
    { room: 'r'.repeat(41) },
    { drainage: 'maybe' },
    { indoor: 'yes' },
    { speciesId: FERN },
  ]) {
    assertEquals((await call(h, 'PATCH', `/plants/${P1}`, b)).status, 400, JSON.stringify(b));
  }
  assertEquals((await call(h, 'PATCH', `/plants/${P1}`, { nickname: 'a'.repeat(40) })).status, 204);
  assertEquals(
    (await call(make(db, OUTSIDER), 'PATCH', `/plants/${P1}`, { nickname: 'Mine' })).status,
    403,
  );
  assertEquals((await call(h, 'PATCH', `/plants/${CID(9)}`, { nickname: 'Ghost' })).status, 404);
  assertEquals(db.tables.plants!.find((x) => x.id === P1)!.nickname, 'a'.repeat(40));
});

// --- status -----------------------------------------------------------------------------------------------------
const withOpenTasks = () =>
  seed({
    care_tasks: [
      {
        id: T1,
        plant_id: P1,
        household_id: H1,
        kind: 'check',
        due_on: '2026-10-12',
        status: 'due',
      },
      { id: T2, plant_id: P1, household_id: H1, kind: 'water', due_on: TODAY, status: 'due' },
    ],
  });

Deno.test('status: dead supersedes the open tasks and stores the cause', async () => {
  const db = withOpenTasks();
  const r = await call(make(db), 'POST', `/plants/${P1}/status`, {
    status: 'dead',
    deathCause: 'Overwatered',
  });
  assertEquals(r.status, 200);
  const p = db.tables.plants!.find((x) => x.id === P1)!;
  assertEquals([p.status, p.death_cause, p.status_at], ['dead', 'Overwatered', NOW.toISOString()]);
  assertEquals(due(db).length, 0);
  assertEquals(
    db.tables.care_tasks!.map((t) => t.status),
    ['superseded', 'superseded'],
  );
});

Deno.test('status: given_away goes back to alive (the Undo) and restores the check', async () => {
  const db = withOpenTasks();
  const h = make(db);
  assertEquals(
    (await call(h, 'POST', `/plants/${P1}/status`, { status: 'given_away' })).status,
    200,
  );
  assertEquals(due(db).length, 0);
  const back = await call(h, 'POST', `/plants/${P1}/status`, { status: 'alive' });
  assertEquals(back.status, 200);
  const p = db.tables.plants!.find((x) => x.id === P1)!;
  assertEquals([p.status, p.status_at, p.death_cause], ['alive', null, null]);
  assertEquals(
    due(db).map((t) => [t.kind, t.due_on]),
    [['check', '2026-10-12']],
  );
  assertEquals(back.body.nextCheckOn, '2026-10-12');
});

Deno.test('status: dead goes back to alive and clears the cause', async () => {
  const db = withOpenTasks();
  const h = make(db);
  await call(h, 'POST', `/plants/${P1}/status`, { status: 'dead', deathCause: 'Drought' });
  const back = await call(h, 'POST', `/plants/${P1}/status`, { status: 'alive' });
  assertEquals(back.status, 200);
  const p = db.tables.plants!.find((x) => x.id === P1)!;
  assertEquals([p.status, p.status_at, p.death_cause], ['alive', null, null]);
  assertEquals(
    due(db).map((t) => [t.kind, t.due_on]),
    [['check', '2026-10-12']],
  );
});

Deno.test(
  'status: with no last check date the restored check is today plus the base interval',
  async () => {
    const db = seed({ care_tasks: [] });
    const h = make(db);
    await call(h, 'POST', `/plants/${P1}/status`, { status: 'given_away' });
    await call(h, 'POST', `/plants/${P1}/status`, { status: 'alive' });
    assertEquals(
      due(db).map((t) => [t.kind, t.due_on]),
      [['check', '2026-10-07']],
    ); // peace lily: four days
    await call(h, 'POST', `/plants/${P2}/status`, { status: 'dead' });
    await call(h, 'POST', `/plants/${P2}/status`, { status: 'alive' });
    assertEquals(
      due(db, P2).map((t) => t.due_on),
      ['2026-10-15'],
    ); // fern override: twelve days
  },
);

Deno.test('status: validation, membership and unknown plants', async () => {
  const db = withOpenTasks();
  const h = make(db);
  const path = `/plants/${P1}/status`;
  assertEquals((await call(h, 'POST', path, { status: 'sold' })).status, 400);
  assertEquals((await call(h, 'POST', path, {})).status, 400);
  assertEquals(
    (await call(h, 'POST', path, { status: 'dead', deathCause: 'x'.repeat(81) })).status,
    400,
  );
  assertEquals(
    (await call(h, 'POST', path, { status: 'dead', deathCause: 'x'.repeat(80) })).status,
    200,
  );
  assertEquals((await call(make(db, OUTSIDER), 'POST', path, { status: 'alive' })).status, 403);
  assertEquals((await call(h, 'POST', `/plants/${CID(9)}/status`, { status: 'dead' })).status, 404);
  assertEquals(db.tables.plants!.find((x) => x.id === P1)!.status, 'dead');
});

// --- tasks ------------------------------------------------------------------------------------------------------
Deno.test(
  'POST /tasks/:id/done completes a water task once and records a water event',
  async () => {
    const db = withOpenTasks();
    const h = make(db, PARTNER);
    const body = { clientId: CID(7), occurredAt: NOW.toISOString() };
    assertEquals((await call(h, 'POST', `/tasks/${T2}/done`, body)).status, 204);
    const t = db.tables.care_tasks!.find((x) => x.id === T2)!;
    assertEquals([t.status, t.completed_by], ['done', PARTNER]);
    assertEquals(db.tables.care_events!.filter((e) => e.kind === 'water').length, 1);
    assertEquals((await call(h, 'POST', `/tasks/${T2}/done`, body)).status, 204); // a retry
    assertEquals(db.tables.care_events!.filter((e) => e.kind === 'water').length, 1);
    assertEquals(
      (await call(h, 'POST', `/tasks/${T2}/done`, { ...body, clientId: CID(8) })).status,
      409,
    );
    assertEquals((await call(make(db), 'POST', `/tasks/${T2}/done`, body)).status, 409); // someone else's client id
  },
);

Deno.test(
  'POST /tasks/:id/done: check tasks, outsiders, unknown tasks and bad bodies',
  async () => {
    const db = withOpenTasks();
    const body = { clientId: CID(7), occurredAt: NOW.toISOString() };
    assertEquals((await call(make(db), 'POST', `/tasks/${T1}/done`, body)).status, 409);
    assertEquals((await call(make(db, OUTSIDER), 'POST', `/tasks/${T2}/done`, body)).status, 403);
    assertEquals((await call(make(db), 'POST', `/tasks/${CID(9)}/done`, body)).status, 404);
    assertEquals((await call(make(db), 'POST', '/tasks/nope/done', body)).status, 400);
    assertEquals(
      (await call(make(db), 'POST', `/tasks/${T2}/done`, { ...body, clientId: 'x' })).status,
      400,
    );
    assertEquals(
      (
        await call(make(db), 'POST', `/tasks/${T2}/done`, {
          ...body,
          occurredAt: '2026-11-01T00:00:00Z',
        })
      ).status,
      400,
    );
    assertEquals(db.tables.care_events!.length, 0);
    assertEquals(
      db.tables.care_tasks!.every((t) => t.status === 'due'),
      true,
    );
  },
);

Deno.test('care routes need a signed-in user and know their own paths', async () => {
  const db = seed();
  const h = createHandler({
    db,
    verifier: { verify: () => Promise.resolve(null) },
    now: () => NOW,
  });
  assertEquals((await call(h, 'POST', '/checkins', checkIn(CID(1), true))).status, 401);
  assertEquals((await call(make(db), 'GET', '/plants')).status, 404);
});
