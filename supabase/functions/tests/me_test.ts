import { assertEquals } from '@std/assert';
import { createHandler } from '../me/handler.ts';
import { fakeDb } from '../_shared/testing/fake-db.ts';
import { distanceM } from '@core/privacy.ts';

const UID = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const verifier = { verify: () => Promise.resolve({ userId: UID }) };
const call = (h: (r: Request) => Promise<Response>, method: string, path: string, body?: unknown) =>
  h(
    new Request(`http://x/functions/v1/me${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
const boot = { ageConfirmed13Plus: true, timezone: 'Europe/Dublin', countryCode: 'IE' };

Deno.test('bootstrap is idempotent and requires the 13+ attestation', async () => {
  const db = fakeDb({});
  const h = createHandler({ db, verifier, random: () => 0.5 });
  assertEquals(
    (await call(h, 'POST', '/bootstrap', { ...boot, ageConfirmed13Plus: false })).status,
    400,
  );
  const a = await (await call(h, 'POST', '/bootstrap', { ...boot, handle: 'aoifegrows' })).json();
  const b = await (await call(h, 'POST', '/bootstrap', { ...boot, handle: 'aoifegrows' })).json();
  assertEquals(a, b);
  assertEquals(a.handle, 'aoifegrows');
  assertEquals(db.tables.households.length, 1);
  assertEquals(db.tables.household_members[0]?.role, 'owner');
});

Deno.test('bootstrap without a handle generates plant plus six digits', async () => {
  const h = createHandler({ db: fakeDb({}), verifier, random: () => 0.5 });
  const res = await (await call(h, 'POST', '/bootstrap', boot)).json();
  assertEquals(/^plant\d{6}$/.test(res.handle), true);
});

Deno.test('bootstrap validates handle, timezone and country before writing', async () => {
  const db = fakeDb({});
  const h = createHandler({ db, verifier, random: () => 0.5 });
  for (const bad of [
    { ...boot, handle: 'ab' },
    { ...boot, handle: 'has space' },
    { ...boot, timezone: 'Mars/Olympus' },
    { ...boot, countryCode: 'ie' },
    { ...boot, displayName: 'x'.repeat(61) },
  ]) {
    assertEquals((await call(h, 'POST', '/bootstrap', bad)).status, 400);
  }
  assertEquals(db.rpcCalls.length, 0);
});

Deno.test('bootstrap lower-cases the handle; a taken handle is a 409', async () => {
  const db = fakeDb({ profiles: [{ id: OTHER, handle: 'taken' }] });
  const h = createHandler({ db, verifier, random: () => 0.5 });
  assertEquals((await call(h, 'POST', '/bootstrap', { ...boot, handle: 'TAKEN' })).status, 409);
  const res = await (await call(h, 'POST', '/bootstrap', { ...boot, handle: 'Fresh_One' })).json();
  assertEquals(res.handle, 'fresh_one');
});

Deno.test('requests without a user are 401', async () => {
  const h = createHandler({
    db: fakeDb({}),
    verifier: { verify: () => Promise.resolve(null) },
    random: () => 0.5,
  });
  assertEquals((await call(h, 'POST', '/bootstrap', boot)).status, 401);
});

Deno.test('home area never stores the real point', async () => {
  const db = fakeDb({ profiles: [{ id: UID }] });
  const h = createHandler({ db, verifier, random: () => 0.9 });
  await call(h, 'PUT', '/home-area', { lat: 53.35, lng: -6.26, radiusM: 2000 });
  const zone = db.tables.privacy_zones[0]!;
  assertEquals(zone.radius_m, 3000);
  assertEquals(distanceM({ lat: 53.35, lng: -6.26 }, zone.centerLatLng) > 100, true);
  assertEquals(String(zone.center).startsWith('SRID=4326;POINT('), true);
  assertEquals(String(zone.center).includes('-6.26 53.35'), false);
});

Deno.test('home area rejects out-of-range input and DELETE clears it', async () => {
  const db = fakeDb({ profiles: [{ id: UID }] });
  const h = createHandler({ db, verifier, random: () => 0.5 });
  for (const bad of [
    { lat: 91, lng: 0, radiusM: 2000 },
    { lat: 0, lng: 181, radiusM: 2000 },
    { lat: 0, lng: 0, radiusM: 100 },
    { lat: 0, lng: 0, radiusM: 25000 },
  ]) {
    assertEquals((await call(h, 'PUT', '/home-area', bad)).status, 400);
  }
  await call(h, 'PUT', '/home-area', { lat: 53.35, lng: -6.26, radiusM: 2000 });
  assertEquals(db.tables.privacy_zones.length, 1);
  assertEquals((await call(h, 'DELETE', '/home-area')).status, 204);
  assertEquals(db.tables.privacy_zones.length, 0);
});

Deno.test('profile patch updates only the given fields and validates them', async () => {
  const db = fakeDb({
    profiles: [{ id: UID, handle: 'aoife', display_name: null, timezone: 'UTC' }],
  });
  const h = createHandler({ db, verifier, random: () => 0.5 });
  assertEquals((await call(h, 'PATCH', '/profile', { timezone: 'Nowhere/Land' })).status, 400);
  assertEquals((await call(h, 'PATCH', '/profile', {})).status, 400);
  assertEquals((await call(h, 'PATCH', '/profile', { timezone: 'Europe/Dublin' })).status, 200);
  assertEquals(db.tables.profiles[0]?.timezone, 'Europe/Dublin');
  assertEquals(db.tables.profiles[0]?.handle, 'aoife');
});

Deno.test('pets replace the household pets; non-members get 403', async () => {
  const db = fakeDb({
    household_members: [{ household_id: 'h1', user_id: UID, role: 'owner' }],
    household_pets: [{ id: 'old', household_id: 'h1', animal: 'dog', name: 'Rex' }],
  });
  const h = createHandler({ db, verifier, random: () => 0.5 });
  const res = await call(h, 'PUT', '/pets', { pets: [{ animal: 'cat', name: 'Miso' }] });
  assertEquals(res.status, 204);
  assertEquals(
    db.tables.household_pets.map((p) => p.name),
    ['Miso'],
  );
  assertEquals((await call(h, 'PUT', '/pets', { householdId: 'nope', pets: [] })).status, 403);
  assertEquals(
    (await call(h, 'PUT', '/pets', { pets: [{ animal: 'fish', name: null }] })).status,
    400,
  );
});

Deno.test('vet is validated and upserted for a member household', async () => {
  const db = fakeDb({ household_members: [{ household_id: 'h1', user_id: UID, role: 'owner' }] });
  const h = createHandler({ db, verifier, random: () => 0.5 });
  assertEquals((await call(h, 'PUT', '/vet', { name: 'Dr Byrne', phone: 'call me' })).status, 400);
  assertEquals(
    (await call(h, 'PUT', '/vet', { name: 'Dr Byrne', phone: '+353 1 234 5678' })).status,
    204,
  );
  assertEquals(
    (await call(h, 'PUT', '/vet', { name: 'Dr Walsh', phone: '+353 1 234 5678' })).status,
    204,
  );
  assertEquals(db.tables.household_vets.length, 1);
  assertEquals(db.tables.household_vets[0]?.name, 'Dr Walsh');
});

Deno.test('push token upsert reassigns a shared device to the signed-in user', async () => {
  const db = fakeDb({ push_tokens: [{ user_id: OTHER, token: 'tok', platform: 'ios' }] });
  const h = createHandler({ db, verifier, random: () => 0.5 });
  assertEquals(
    (await call(h, 'POST', '/push-token', { token: 'tok', platform: 'ios' })).status,
    204,
  );
  assertEquals(db.tables.push_tokens.length, 1);
  assertEquals(db.tables.push_tokens[0]?.user_id, UID);
  assertEquals((await call(h, 'POST', '/push-token', { token: '', platform: 'ios' })).status, 400);
  assertEquals((await call(h, 'POST', '/push-token', { token: 't', platform: 'web' })).status, 400);
});

Deno.test('timezone accepts IANA names only and is stored canonically', async () => {
  const db = fakeDb({});
  const h = createHandler({ db, verifier, random: () => 0.5 });
  for (const tz of ['+05:00', '-0300', 'UTC+5', 'GMT+1', 'EST5EDT ', 'Europe']) {
    assertEquals((await call(h, 'POST', '/bootstrap', { ...boot, timezone: tz })).status, 400, tz);
  }
  assertEquals((await call(h, 'POST', '/bootstrap', { ...boot, timezone: 'UTC' })).status, 200);
  assertEquals(db.tables.profiles[0]?.timezone, 'UTC');
  const canon = createHandler({ db: fakeDb({}), verifier, random: () => 0.5 });
  assertEquals(
    (await call(canon, 'POST', '/bootstrap', { ...boot, timezone: 'america/new_york' })).status,
    200,
  );
});
