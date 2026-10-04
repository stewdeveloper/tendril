// End-to-end flow against the local stack, through the real Edge Functions (`pnpm e2e:functions`).
// Not under tests/: `pnpm test:functions` must not need a running stack.
import { assert, assertEquals, assertNotEquals } from '@std/assert';
import exifr from 'exifr';
import {
  admin,
  BUCKET,
  call,
  createUser,
  deleteUsers,
  PUBLISHABLE,
  type TestUser,
  URL_,
} from './support.ts';

const fixture = (name: string) =>
  Deno.readFile(new globalThis.URL(`../tests/fixtures/${name}`, import.meta.url));

const DEV = { 'x-firebase-appcheck': 'dev-ok' };

let photoPaths: string[] = [];
async function uploadAs(user: TestUser, bytes: Uint8Array): Promise<string> {
  const p = `${user.id}/${crypto.randomUUID()}.jpg`;
  const res = await user.client.storage
    .from(BUCKET)
    .upload(p, bytes, { contentType: 'image/jpeg' });
  if (res.error) throw res.error;
  photoPaths.push(p);
  return p;
}

const identifyBody = (paths: string[], extra: Record<string, unknown> = {}) => ({
  photos: paths.map((path) => ({ path, organ: 'whole' })),
  captureSource: 'camera',
  location: null,
  deviceTime: new Date().toISOString(),
  healthCheck: false,
  ...extra,
});

const SETUP = {
  nickname: 'Lily',
  room: 'Kitchen',
  light: 'bright',
  potMaterial: 'ceramic',
  potSizeCm: 14,
  drainage: 'yes',
  indoor: true,
};

async function used(uid: string): Promise<number> {
  const { data, error } = await admin
    .from('usage_counters')
    .select('used')
    .eq('user_id', uid)
    .eq('kind', 'identification');
  if (error) throw error;
  return (data ?? []).reduce((n, r) => n + r.used, 0);
}

async function plantdex(uid: string, speciesId: string) {
  const { data, error } = await admin
    .from('plantdex_entries')
    .select('finds_count')
    .eq('user_id', uid)
    .eq('species_id', speciesId)
    .maybeSingle();
  if (error) throw error;
  const all = await admin
    .from('plantdex_entries')
    .select('species_id', { count: 'exact', head: true })
    .eq('user_id', uid);
  return { findsCount: data?.finds_count ?? 0, count: all.count ?? 0 };
}

Deno.test('scan to check-in flow against the local stack', async (t) => {
  const users: TestUser[] = [];
  try {
    const a = await createUser();
    users.push(a);
    let householdId = '';
    let plantId = '';
    let lilyId = '';

    await t.step('health is up and the gateway rejects a missing user', async () => {
      const h = await fetch(`${URL_}/functions/v1/health`);
      assertEquals(h.status, 200);
      const anon = await fetch(`${URL_}/functions/v1/me/bootstrap`, {
        method: 'POST',
        headers: { apikey: PUBLISHABLE },
      });
      assertEquals(anon.status, 401);
    });

    await t.step('me/bootstrap then me/pets (Miso the cat)', async () => {
      const boot = await call(a, 'POST', 'me/bootstrap', {
        ageConfirmed13Plus: true,
        timezone: 'Europe/Dublin',
        countryCode: 'IE',
      });
      assertEquals(boot.status, 200, JSON.stringify(boot.json));
      assertEquals(boot.json.userId, a.id);
      householdId = boot.json.householdId;
      const again = await call(a, 'POST', 'me/bootstrap', {
        ageConfirmed13Plus: true,
        timezone: 'Europe/Dublin',
        countryCode: 'IE',
      });
      assertEquals(again.json.householdId, householdId, 'bootstrap is idempotent');
      const pets = await call(a, 'PUT', 'me/pets', {
        householdId,
        pets: [{ animal: 'cat', name: 'Miso' }],
      });
      assert(pets.status === 200 || pets.status === 204, JSON.stringify(pets.json));
      const rows = await a.client.from('household_pets').select('name, animal');
      assertEquals(rows.data, [{ name: 'Miso', animal: 'cat' }]);
    });

    let gpsPath = '';
    await t.step('the user uploads a GPS photo to their own folder only', async () => {
      gpsPath = await uploadAs(a, await fixture('gps.jpg'));
      const other = await a.client.storage
        .from(BUCKET)
        .upload(`${crypto.randomUUID()}/x.jpg`, await fixture('plain.jpg'), {
          contentType: 'image/jpeg',
        });
      assert(other.error, "uploading outside the user's own folder is refused");
    });

    let observationId = '';
    await t.step('identify: peace lily very likely', async () => {
      const before = await used(a.id);
      const res = await call(a, 'POST', 'identify', identifyBody([gpsPath]), DEV);
      assertEquals(res.status, 200, JSON.stringify(res.json));
      assertEquals(res.json.state, 'identified');
      assertEquals(res.json.suggestions[0].species.scientificName, 'Spathiphyllum');
      assert(res.json.suggestions[0].probability >= 0.9);
      assertEquals(await used(a.id), before + 1);
      observationId = res.json.observationId;
      lilyId = res.json.suggestions[0].species.id;
    });

    await t.step('the stored photo has no GPS', async () => {
      const dl = await admin.storage.from(BUCKET).download(gpsPath);
      assert(dl.data);
      const bytes = new Uint8Array(await dl.data.arrayBuffer());
      const gps = await exifr.gps(bytes).catch(() => undefined);
      assertEquals(gps, undefined);
      const parsed = (await exifr.parse(bytes, { gps: true })) ?? {};
      assertEquals(
        Object.keys(parsed).filter((k) => /gps|latitude|longitude/i.test(k)),
        [],
      );
    });

    await t.step('confirm as add_plant, then check in (soil dry)', async () => {
      const early = await call(a, 'GET', `observations/${observationId}/outcome`);
      assertEquals(early.status, 409, 'outcome before confirm is a conflict');
      const conf = await call(a, 'POST', `observations/${observationId}/confirm`, {
        speciesId: lilyId,
        action: 'add_plant',
        setup: SETUP,
      });
      assertEquals(conf.status, 200, JSON.stringify(conf.json));
      plantId = conf.json.plantId;
      assert(plantId);
      const out = await call(a, 'GET', `observations/${observationId}/outcome`);
      assertEquals(out.json.newToPlantdex, true);
      assertEquals(out.json.plantdexCount, 1);

      const clientId = crypto.randomUUID();
      const body = {
        clientId,
        plantId,
        soilDry: true,
        leafStates: ['healthy'],
        occurredAt: new Date().toISOString(),
      };
      const ci = await call(a, 'POST', 'care/checkins', body);
      assertEquals(ci.status, 200, JSON.stringify(ci.json));
      assertEquals(ci.json.waterTaskCreated, true);
      const replay = await call(a, 'POST', 'care/checkins', body);
      assertEquals(replay.status, 200);
      assertEquals(replay.json.waterTaskCreated, true, 'replay returns the stored answer');
    });

    await t.step('RLS: the user sees a water task due today', async () => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin' }).format(
        new Date(),
      );
      const tasks = await a.client
        .from('care_tasks')
        .select('kind, due_on, status')
        .eq('plant_id', plantId);
      assertEquals(tasks.error, null);
      const water = (tasks.data ?? []).filter((r) => r.kind === 'water' && r.status === 'due');
      assertEquals(water.length, 1);
      assertEquals(water[0]!.due_on, today);
    });

    const b = await createUser();
    users.push(b);
    await t.step('RLS: a second user cannot read observation_locations', async () => {
      // A located scan so that the table has a row to hide.
      const p = await uploadAs(a, await fixture('plain.jpg'));
      const res = await call(
        a,
        'POST',
        'identify',
        identifyBody([p], { location: { lat: 53.35, lng: -6.26, accuracyM: 8, mocked: false } }),
        DEV,
      );
      assertEquals(res.status, 200, JSON.stringify(res.json));
      const own = await a.client
        .from('observation_locations')
        .select('observation_id')
        .eq('observation_id', res.json.observationId);
      assertEquals(own.data?.length, 1, 'the owner reads their own location');
      const theirs = await b.client
        .from('observation_locations')
        .select('observation_id')
        .eq('observation_id', res.json.observationId);
      assertEquals(theirs.error, null);
      assertEquals(theirs.data, []);
    });

    await t.step('provider failure: no 409/500, retry works, quota used once', async () => {
      const p1 = await uploadAs(a, await fixture('plain.jpg'));
      const before = await used(a.id);
      const failed = await call(a, 'POST', 'identify', identifyBody([p1]), {
        ...DEV,
        'x-tendril-fake': 'error',
      });
      assertEquals(failed.status, 503, JSON.stringify(failed.json));
      assertEquals(failed.json.error.code, 'provider_unavailable');
      assertEquals(await used(a.id), before, 'the reservation was released');
      const left = await admin.from('observation_photos').select('id').eq('storage_path', p1);
      assertEquals(left.data, [], 'no half-made observation is left behind');

      // Same paths, no header: nothing was left behind, so the retry needs no re-upload.
      const retry = await call(a, 'POST', 'identify', identifyBody([p1]), DEV);
      assertEquals(retry.status, 200, JSON.stringify(retry.json));
      assertEquals(await used(a.id), before + 1, 'quota is used exactly once');
    });

    await t.step('orchid: a sensitive species gets no public cell', async () => {
      const p = await uploadAs(a, await fixture('plain.jpg'));
      const res = await call(
        a,
        'POST',
        'identify',
        identifyBody([p], { location: { lat: 53.5, lng: -6.3, accuracyM: 10, mocked: false } }),
        { ...DEV, 'x-tendril-fake': 'orchid' },
      );
      assertEquals(res.status, 200, JSON.stringify(res.json));
      const sp = res.json.suggestions[0].species;
      assertEquals(sp.scientificName, 'Orchis mascula');
      const conf = await call(a, 'POST', `observations/${res.json.observationId}/confirm`, {
        speciesId: sp.id,
        action: 'log_find',
        placeType: 'wild',
      });
      assertEquals(conf.status, 200, JSON.stringify(conf.json));
      const obs = await admin
        .from('observations')
        .select('public_cell_r5, place_type, status')
        .eq('id', res.json.observationId)
        .single();
      assertEquals(obs.data?.place_type, 'wild');
      assertEquals(obs.data?.status, 'confirmed');
      assertEquals(obs.data?.public_cell_r5, null);
      const species = await admin.from('species').select('sensitive').eq('id', sp.id).single();
      assertEquals(species.data?.sensitive, true);
    });

    await t.step('second find of a known species updates finds_count only', async () => {
      const before = await plantdex(a.id, lilyId);
      assertEquals(before.findsCount, 1);
      const p = await uploadAs(a, await fixture('plain.jpg'));
      const res = await call(
        a,
        'POST',
        'identify',
        identifyBody([p], { location: { lat: 52.1, lng: -7.1, accuracyM: 10, mocked: false } }),
        DEV,
      );
      assertEquals(res.status, 200, JSON.stringify(res.json));
      const conf = await call(a, 'POST', `observations/${res.json.observationId}/confirm`, {
        speciesId: lilyId,
        action: 'log_find',
        placeType: 'wild',
      });
      assertEquals(conf.status, 200, JSON.stringify(conf.json));
      const out = await call(a, 'GET', `observations/${res.json.observationId}/outcome`);
      assertEquals(out.json.newToPlantdex, false);
      const after = await plantdex(a.id, lilyId);
      assertEquals(after.findsCount, 2);
      assertEquals(after.count, before.count, 'Plantdex size is unchanged');
      const obs = await admin
        .from('observations')
        .select('public_cell_r5')
        .eq('id', res.json.observationId)
        .single();
      assertNotEquals(obs.data?.public_cell_r5, null, 'a non-sensitive wild find is shareable');
    });

    await t.step('a user who left the household gets 403 on a check-in', async () => {
      const boot = await call(b, 'POST', 'me/bootstrap', {
        ageConfirmed13Plus: true,
        timezone: 'Europe/Dublin',
        countryCode: 'IE',
      });
      assertEquals(boot.status, 200);
      const join = await admin
        .from('household_members')
        .insert({ household_id: householdId, user_id: b.id, role: 'member' });
      assertEquals(join.error, null);
      const checkin = () =>
        call(b, 'POST', 'care/checkins', {
          clientId: crypto.randomUUID(),
          plantId,
          soilDry: false,
          leafStates: [],
          occurredAt: new Date().toISOString(),
        });
      assertEquals((await checkin()).status, 200, 'a member can check in');
      const left = await admin
        .from('household_members')
        .delete()
        .eq('household_id', householdId)
        .eq('user_id', b.id);
      assertEquals(left.error, null);
      assertEquals((await checkin()).status, 403);
    });
  } finally {
    if (photoPaths.length > 0) await admin.storage.from(BUCKET).remove(photoPaths);
    photoPaths = [];
    await deleteUsers(users.map((u) => u.id));
  }
});
