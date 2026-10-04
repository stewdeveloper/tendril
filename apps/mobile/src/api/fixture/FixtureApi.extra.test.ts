import { aoife } from '@tendril/core';
import { FIXTURE_TODAY } from '../fixtureDate';
import { FixtureApi } from './FixtureApi';

const camera = { photoUris: ['p1'], organs: ['leaf' as const], captureSource: 'camera' as const };
const setup = (nickname: string) => ({
  nickname,
  room: 'Hall',
  light: 'medium' as const,
  potMaterial: 'ceramic' as const,
  potSizeCm: 18,
  drainage: 'yes' as const,
  indoor: true,
});
const identify = (api: FixtureApi, healthCheck = false) => api.identify({ ...camera, healthCheck });

describe('FixtureApi dates', () => {
  afterEach(() => jest.useRealTimers());

  it('counts from the fixture date, never the device clock', async () => {
    jest.useFakeTimers({ now: new Date('2031-05-01T12:00:00Z') });
    const api = new FixtureApi();
    expect(FIXTURE_TODAY).toBe('2026-10-03');
    expect((await api.getToday()).dateLabel).toBe('Saturday 3 October');
    const dry = await api.checkIn({
      clientId: 'a',
      plantId: 'monty',
      soilDry: true,
      leafStates: [],
    });
    expect(dry).toMatchObject({ nextCheckOn: '2026-10-10', nextCheckWeekday: 'Saturday' });
    const damp = await api.checkIn({
      clientId: 'b',
      plantId: 'lily',
      soilDry: false,
      leafStates: [],
    });
    expect(damp).toMatchObject({ nextCheckOn: '2026-10-05', nextCheckWeekday: 'Monday' });
  });

  it('waits latencyMs before answering', async () => {
    jest.useFakeTimers();
    const api = new FixtureApi({ latencyMs: 300 });
    let answered = false;
    const pending = api.getStreaks().then(() => (answered = true));
    await jest.advanceTimersByTimeAsync(299);
    expect(answered).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await pending;
    expect(answered).toBe(true);
  });
});

describe('FixtureApi check-ins', () => {
  it('finishes the task, moves the plant and keeps the streak', async () => {
    const api = new FixtureApi();
    await api.checkIn({ clientId: 'c', plantId: 'monty', soilDry: false, leafStates: [] });
    const today = await api.getToday();
    expect(today.tasks.find((t) => t.id === 't-monty')?.status).toBe('done');
    expect(today.streak).toMatchObject({ careDays: 12, careState: 'active' });
    expect(today.nextCheck).toEqual({ plantNickname: 'Monty', on: '2026-10-05' });
    const monty = await api.getPlant('monty');
    expect(monty).toMatchObject({ careState: 'ok', nextCheckOn: '2026-10-05' });
    expect(monty.history[0]).toEqual({ label: 'Soil not dry yet', on: '2026-10-03' });
    expect((await api.getPlants('our-flat'))[0]).toMatchObject({ nextCheckOn: '2026-10-05' });
  });

  it('a dry answer adds a watering task and checks again in a week', async () => {
    const api = new FixtureApi();
    const r = await api.checkIn({
      clientId: 'c',
      plantId: 'spidey',
      soilDry: true,
      leafStates: [],
    });
    expect(r).toMatchObject({ waterTaskCreated: true, nextCheckOn: '2026-10-10' });
    const water = (await api.getToday()).tasks.find(
      (t) => t.kind === 'water' && t.plantId === 'spidey',
    );
    expect(water).toMatchObject({ status: 'due', dueOn: '2026-10-03', plantNickname: 'Spidey' });
  });

  it('offline: saved on the device, and the server makes the watering task later', async () => {
    const api = new FixtureApi({ scenario: 'offline' });
    const r = await api.checkIn({ clientId: 'c', plantId: 'monty', soilDry: true, leafStates: [] });
    expect(r).toMatchObject({ savedOffline: true, waterTaskCreated: false });
    expect(
      (await api.getToday()).tasks.filter((t) => t.kind === 'water' && t.plantId === 'monty'),
    ).toEqual([]);
  });

  it('rejects an unknown plant', async () => {
    const api = new FixtureApi();
    await expect(
      api.checkIn({ clientId: 'c', plantId: 'nope', soilDry: true, leafStates: [] }),
    ).rejects.toThrow('not_found');
  });
});

describe('FixtureApi scenarios', () => {
  it('empty: no plants anywhere, then a label adoption fills Today and a check-in starts a streak', async () => {
    const api = new FixtureApi({ scenario: 'empty' });
    const empty = await api.getToday();
    expect(empty).toMatchObject({ hasPlants: false, tasks: [], league: null, nextCheck: null });
    expect(empty.streak.careDays).toBe(0);
    expect((await api.getQuota('identification')).used).toBe(0);
    expect((await api.getLeague()).joined).toBe(false);

    const { plantId } = await api.addPlant({
      source: 'label_qr',
      labelCode: 'pl-0001',
      setup: setup('Pea'),
    });
    expect(await api.getPlants('our-flat')).toHaveLength(1);
    expect((await api.getToday()).hasPlants).toBe(true);
    expect((await api.getPlant(plantId)).history[0]?.label).toBe('Added from a label');
    await api.checkIn({ clientId: 'c', plantId, soilDry: false, leafStates: [] });
    expect((await api.getStreaks()).careDays).toBe(1);
  });

  it('setScenario starts a fresh world', async () => {
    const api = new FixtureApi();
    await api.checkIn({ clientId: 'c', plantId: 'monty', soilDry: false, leafStates: [] });
    api.setScenario('default');
    expect((await api.getToday()).tasks.find((t) => t.id === 't-monty')?.status).toBe('due');
  });

  it('limits: both quotas are used up, and identify refuses before it spends a call', async () => {
    const free = new FixtureApi({ scenario: 'limit_free' });
    expect(await free.getQuota('diagnosis')).toMatchObject({ used: 1, limit: 1, plan: 'free' });
    await expect(identify(free)).rejects.toThrow('quota_exceeded');
    const premium = new FixtureApi({ scenario: 'limit_premium' });
    expect(await premium.getQuota('identification')).toMatchObject({
      used: 60,
      limit: 60,
      plan: 'premium',
    });
    expect((await premium.getEntitlement()).plan).toBe('premium');
    expect((await premium.getToday()).identifications.used).toBe(60);
    await expect(identify(premium)).rejects.toThrow('quota_exceeded');
  });

  it.each([
    ['default', 'identified', 'peace-lily', 0.94],
    ['likely', 'identified', 'peace-lily', 0.71],
    ['not_sure', 'identified', 'peace-lily', 0.41],
    ['offline', 'offline', undefined, undefined],
    ['error', 'error', undefined, undefined],
    ['not_a_plant', 'not_a_plant', undefined, undefined],
  ] as const)('identify in the %s scenario', async (scenario, state, speciesId, probability) => {
    const api = new FixtureApi({ scenario });
    const result = await identify(api);
    expect(result.state).toBe(state);
    expect(result.suggestions[0]?.species.id).toBe(speciesId);
    expect(result.suggestions[0]?.probability).toBe(probability);
    expect(result.photoUrls).toEqual(['p1']);
    // Only a real identification uses one ("This didn't use an identification").
    expect((await api.getQuota('identification')).used).toBe(state === 'identified' ? 4 : 3);
  });

  it('keeps each identification for getScanResult, with its own id', async () => {
    const api = new FixtureApi();
    const a = await identify(api);
    const b = await api.identify({ ...camera, captureSource: 'gallery', healthCheck: false });
    expect(a.observationId).not.toBe(b.observationId);
    expect((await api.getScanResult(b.observationId)).captureSource).toBe('gallery');
    expect((await api.getScanResult('obs-foxglove-find')).state).toBe('identified');
    await expect(api.getScanResult('obs-nope')).rejects.toThrow('not_found');
  });
});

describe('FixtureApi scans and plants', () => {
  it('adds a plant from a scan and shows it in the list, detail and Today', async () => {
    const api = new FixtureApi();
    const scan = await identify(api);
    const { plantId } = await api.addPlant({
      source: 'scan',
      observationId: scan.observationId,
      setup: setup('Pea'),
    });
    expect((await api.getPlants('our-flat')).map((p) => p.nickname)).toEqual([
      'Monty',
      'Spidey',
      'Lily',
      'Pea',
    ]);
    const detail = await api.getPlant(plantId);
    expect(detail).toMatchObject({
      matchProbability: 0.94,
      nextCheckOn: '2026-10-10',
      room: 'Hall',
    });
    expect(detail.species.id).toBe('peace-lily');
    expect(detail.carePlan.map((l) => l.icon)).toEqual(['sprout', 'sun', 'droplet']);
    expect(detail.toxicity.length).toBeGreaterThan(0);
  });

  it('confirming the pre-made foxglove scan gives its pre-made new-species outcome', async () => {
    const api = new FixtureApi();
    expect(
      await api.confirmScan({
        observationId: 'obs-foxglove-find',
        speciesId: 'foxglove',
        action: 'log_find',
        placeType: 'wild',
      }),
    ).toEqual({ plantId: null });
    expect(await api.getOutcome('obs-foxglove-find')).toEqual(aoife.outcomes['foxglove-awarded']);
    expect((await api.getFinds())[0]).toMatchObject({
      observationId: 'obs-foxglove-find',
      foundOn: '2026-10-03',
    });
    expect((await api.getPlantdex('wild')).counts).toEqual({ all: 38, houseplants: 21, wild: 17 });
    expect((await api.getProfile()).plantdexCount).toBe(38);
  });

  it('a new wild find scores by rarity and joins the Plantdex', async () => {
    const api = new FixtureApi();
    const scan = await identify(api);
    await api.confirmScan({
      observationId: scan.observationId,
      speciesId: 'early-purple-orchid',
      action: 'log_find',
      placeType: 'wild',
    });
    expect(await api.getOutcome(scan.observationId)).toMatchObject({
      pointsStatus: 'awarded',
      points: 80,
      newToPlantdex: true,
      plantdexCount: 38,
    });
    expect((await api.getSpeciesCard('early-purple-orchid')).findsCount).toBe(1);
  });

  it('a gallery find earns nothing, and a repeat find earns 2', async () => {
    const api = new FixtureApi();
    const gallery = await api.identify({ ...camera, captureSource: 'gallery', healthCheck: false });
    await api.confirmScan({
      observationId: gallery.observationId,
      speciesId: 'peace-lily',
      action: 'log_find',
      placeType: 'garden_park',
    });
    expect(await api.getOutcome(gallery.observationId)).toMatchObject({
      pointsStatus: 'no_points',
      points: 0,
      noPointsReason: 'gallery',
    });
    const again = await identify(api);
    await api.confirmScan({
      observationId: again.observationId,
      speciesId: 'peace-lily',
      action: 'log_find',
      placeType: 'garden_park',
    });
    expect(await api.getOutcome(again.observationId)).toMatchObject({
      points: 2,
      newToPlantdex: false,
    });
    expect((await api.getSpeciesCard('peace-lily')).findsCount).toBe(2);
  });

  it('adding a plant from a scan adds it to the houseplants', async () => {
    const api = new FixtureApi();
    const scan = await identify(api);
    const { plantId } = await api.confirmScan({
      observationId: scan.observationId,
      speciesId: 'peace-lily',
      action: 'add_plant',
    });
    expect(plantId).toEqual(expect.any(String));
    expect(await api.getPlant(plantId!)).toMatchObject({ nickname: 'Peace lily' });
    expect((await api.getPlantdex('houseplant')).entries.map((e) => e.species.id)).toEqual([
      'peace-lily',
    ]);
    expect((await api.getOutcome(scan.observationId)).points).toBe(10);
  });

  it('closes a plant: status, date, cause, history and its open tasks', async () => {
    const api = new FixtureApi();
    await api.setPlantStatus('spidey', 'dead', 'too dry');
    expect(await api.getPlant('spidey')).toMatchObject({
      status: 'dead',
      careState: 'closed',
      nextCheckOn: null,
      statusOn: '2026-10-03',
      deathCause: 'too dry',
    });
    expect((await api.getPlant('spidey')).history[0]?.label).toBe('Died · too dry');
    expect((await api.getToday()).tasks.some((t) => t.plantId === 'spidey')).toBe(false);
    expect((await api.getPlants('our-flat')).find((p) => p.id === 'spidey')?.status).toBe('dead');
  });

  it('serves the two closed plants in history', async () => {
    const api = new FixtureApi();
    expect((await api.getPlant('fern-dead')).status).toBe('dead');
    expect((await api.getPlant('lily-given-away')).status).toBe('given_away');
    await expect(api.getPlant('nope')).rejects.toThrow('not_found');
  });

  it('diagnoses a plant and applies the plan change', async () => {
    const api = new FixtureApi();
    const d = await api.diagnose({ plantId: 'monty', photoUris: ['x'] });
    expect(d).toMatchObject({ conditionName: 'Overwatering', probability: 0.72 });
    expect((await api.getQuota('diagnosis')).used).toBe(1);
    await expect(api.diagnose({ plantId: 'monty', photoUris: ['x'] })).rejects.toThrow(
      'quota_exceeded',
    );
    await api.applyDiagnosis(d.id);
    expect(await api.getPlant('monty')).toMatchObject({
      careState: 'paused',
      pausedNote: '0 of 2 dry checks',
    });
  });

  it('a not-sure diagnosis uses nothing and changes nothing', async () => {
    const api = new FixtureApi({ scenario: 'not_sure' });
    const d = await api.diagnose({ plantId: 'monty', photoUris: ['x'] });
    expect(d).toMatchObject({ conditionName: 'Not sure yet', planChange: null });
    expect((await api.getQuota('diagnosis')).used).toBe(0);
    await api.applyDiagnosis(d.id);
    expect((await api.getPlant('monty')).careState).toBe('due');
  });

  it('a health check on a scan carries a diagnosis and uses the diagnosis quota', async () => {
    const api = new FixtureApi();
    expect((await identify(api, true)).diagnosis?.conditionName).toBe('Overwatering');
    expect((await api.getQuota('diagnosis')).used).toBe(1);
  });
});

describe('FixtureApi people, pets and Premium', () => {
  it('finds exact handles and sends friend requests', async () => {
    const api = new FixtureApi();
    expect(await api.findHandle('@FernAndFox')).toEqual({
      handle: 'fernandfox',
      plantdexCount: 44,
    });
    expect(await api.findHandle('nobody')).toBeNull();
    const before = await api.getFriends();
    await api.sendFriendRequest('lichenlou');
    // A request is not a friend until it is accepted.
    expect(await api.getFriends()).toEqual(before);
    await expect(api.sendFriendRequest('nobody')).rejects.toThrow('not_found');
  });

  it('saves pets with new ids', async () => {
    const api = new FixtureApi();
    await api.savePets([
      { animal: 'cat', name: 'Miso' },
      { animal: 'other', name: null },
    ]);
    const pets = (await api.getHousehold()).pets;
    expect(pets.map((p) => p.animal)).toEqual(['cat', 'other']);
    expect(new Set(pets.map((p) => p.id)).size).toBe(2);
  });

  it('trims pet names, and a blank name falls back in the emergency copy', async () => {
    const api = new FixtureApi();
    await api.savePets([
      { animal: 'cat', name: '  Miso ' },
      { animal: 'dog', name: '   ' },
    ]);
    const pets = (await api.getHousehold()).pets;
    expect(pets.map((p) => p.name)).toEqual(['Miso', null]);
    const blank = await api.getEmergency({ speciesId: 'peace-lily', petId: pets[1]!.id });
    expect(blank.petName).toBe('your dog');
  });

  it('keeps a proper first word capitalised in the emergency species name', async () => {
    const api = new FixtureApi();
    const info = await api.getEmergency({ plantId: 'monty', petId: 'pet-miso' });
    expect(info.speciesName).toBe('Swiss cheese plant');
  });

  it('starts one 7-day preview, and it raises the limits', async () => {
    const api = new FixtureApi();
    expect(await api.startPreview()).toEqual({
      plan: 'premium',
      source: 'preview',
      activeUntil: '2026-10-10',
      previewUsed: true,
    });
    expect(await api.getQuota('identification')).toMatchObject({
      plan: 'premium',
      limit: 60,
      used: 3,
    });
    expect((await api.getQuota('diagnosis')).limit).toBe(10);
    await expect(api.startPreview()).rejects.toThrow('preview_unavailable');
  });

  it('answers a pet emergency from the plant, with unknown for other animals', async () => {
    const api = new FixtureApi();
    const info = await api.getEmergency({ plantId: 'lily', petId: 'pet-miso' });
    expect(info).toMatchObject({
      petName: 'Miso',
      animal: 'cat',
      speciesName: 'peace lily',
      matchProbability: null,
      vet: null,
      poisonLine: null,
    });
    expect(info.toxicity).toMatchObject({ animal: 'cat', severity: 'moderate' });
    await api.savePets([{ animal: 'other', name: null }]);
    const pet = (await api.getHousehold()).pets[0]!;
    const other = await api.getEmergency({ speciesId: 'peace-lily', petId: pet.id });
    expect(other).toMatchObject({ petName: 'your pet', toxicity: null, speciesName: 'peace lily' });
    await expect(api.getEmergency({ plantId: 'lily', petId: 'nope' })).rejects.toThrow('not_found');
  });

  it('deleting the account leaves an empty world', async () => {
    const api = new FixtureApi();
    await api.deleteAccount();
    expect(await api.getPlants('our-flat')).toEqual([]);
  });
});

describe('FixtureApi reads', () => {
  it('serves the collection, leagues and profile from the fixture', async () => {
    const api = new FixtureApi();
    expect((await api.getHouseholds()).map((h) => h.id)).toEqual(['our-flat', 'mams-house']);
    expect(await api.getPlants('mams-house')).toEqual([]);
    expect((await api.getPlantdex('all')).counts).toEqual({ all: 37, houseplants: 21, wild: 16 });
    expect((await api.getPlantdex('wild')).entries.every((e) => e.category === 'wild')).toBe(true);
    expect(await api.getSets()).toEqual(aoife.sets);
    expect((await api.getSpeciesCard('peace-lily')).sets.map((s) => s.name)).toEqual([
      'Easy-care houseplants',
    ]);
    expect((await api.getSpeciesCard('peace-lily')).toxicity[0]?.severity).toBe('moderate');
    await expect(api.getSpeciesCard('nope')).rejects.toThrow('not_found');
    expect(await api.getBadges()).toEqual(aoife.badges);
    expect((await api.getLeague()).rows[3]).toMatchObject({ handle: 'aoifegrows', isYou: true });
    expect(await api.getWeekResult()).toEqual(aoife.weekResult);
    expect(await api.getProfile()).toEqual(aoife.profile);
    expect((await api.createInvite()).url).toMatch(/^https:\/\/tendril\.app\//);
    expect(await api.getOutcome('obs-foxglove-find')).toEqual(aoife.outcomes['foxglove-awarded']);
    await expect(api.getOutcome('obs-nope')).rejects.toThrow('not_found');
  });

  it('hands out copies, so a screen cannot change the world', async () => {
    const api = new FixtureApi();
    (await api.getToday()).streak.careDays = 99;
    (await api.getPlants('our-flat'))[0]!.nickname = 'Hacked';
    expect((await api.getToday()).streak.careDays).toBe(12);
    expect((await api.getPlants('our-flat'))[0]!.nickname).toBe('Monty');
  });
});

describe('FixtureApi settings', () => {
  it('starts with a home area and reminders on, and keeps what is saved', async () => {
    const api = new FixtureApi();
    expect(await api.getSettings()).toEqual({ homeAreaSet: true, remindersOn: true });
    await api.clearHomeArea();
    await api.setReminders(false);
    expect(await api.getSettings()).toEqual({ homeAreaSet: false, remindersOn: false });
    await api.saveHomeArea({ lat: 53.3, lng: -6.2, radiusM: 500 });
    expect((await api.getSettings()).homeAreaSet).toBe(true);
  });
  it('refuses a home area with no radius or a non-finite point', async () => {
    const api = new FixtureApi();
    await api.clearHomeArea();
    await expect(api.saveHomeArea({ lat: 53.3, lng: -6.2, radiusM: 0 })).rejects.toThrow();
    await expect(api.saveHomeArea({ lat: NaN, lng: -6.2, radiusM: 100 })).rejects.toThrow();
    expect((await api.getSettings()).homeAreaSet).toBe(false);
  });
  it('a new account has set neither, and the league board knows its size', async () => {
    const api = new FixtureApi({ scenario: 'empty' });
    expect(await api.getSettings()).toEqual({ homeAreaSet: false, remindersOn: false });
    expect((await api.getLeague()).size).toBe(0);
    expect((await new FixtureApi().getLeague()).size).toBe(20);
  });
});
