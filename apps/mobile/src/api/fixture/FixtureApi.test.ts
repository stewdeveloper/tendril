import { FixtureApi } from './FixtureApi';

describe('FixtureApi', () => {
  it('serves the UX brief sample data', async () => {
    const api = new FixtureApi({ latencyMs: 0 });
    const today = await api.getToday();
    expect(today.streak.careDays).toBe(12);
    expect((await api.getPlants('our-flat')).map((p) => p.nickname)).toEqual([
      'Monty',
      'Spidey',
      'Lily',
    ]);
  });
  it('check-in No moves the next check and keeps the streak', async () => {
    const api = new FixtureApi({ latencyMs: 0 });
    const r = await api.checkIn({
      clientId: 'c1',
      plantId: 'monty',
      soilDry: false,
      leafStates: [],
    });
    expect(r.waterTaskCreated).toBe(false);
    expect(r.streakDays).toBe(12);
    expect(r.nextCheckWeekday).toBe('Monday');
  });
  it('check-in is idempotent on clientId', async () => {
    const api = new FixtureApi({ latencyMs: 0 });
    const a = await api.checkIn({
      clientId: 'same',
      plantId: 'monty',
      soilDry: true,
      leafStates: [],
    });
    const b = await api.checkIn({
      clientId: 'same',
      plantId: 'monty',
      soilDry: true,
      leafStates: [],
    });
    expect(b).toEqual(a);
    expect(
      (await api.getToday()).tasks.filter((t) => t.kind === 'water' && t.plantNickname === 'Monty'),
    ).toHaveLength(1);
  });
  it('scenarios drive state screens', async () => {
    const api = new FixtureApi({ latencyMs: 0 });
    api.setScenario('empty');
    expect(await api.getPlants('our-flat')).toEqual([]);
    expect((await api.getToday()).hasPlants).toBe(false);
    api.setScenario('limit_free');
    expect(await api.getQuota('identification')).toMatchObject({
      used: 10,
      limit: 10,
      plan: 'free',
    });
    api.setScenario('not_a_plant');
    expect(
      (
        await api.identify({
          photoUris: ['x'],
          organs: ['leaf'],
          captureSource: 'camera',
          healthCheck: false,
        })
      ).state,
    ).toBe('not_a_plant');
  });
  it('unknown label codes return null', async () => {
    const api = new FixtureApi({ latencyMs: 0 });
    expect(await api.getLabel('PL-0001')).not.toBeNull();
    expect(await api.getLabel('RETIRED-9')).toBeNull();
  });
});
