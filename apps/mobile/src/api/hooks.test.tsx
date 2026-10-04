import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ApiProvider } from './ApiProvider';
import { FixtureApi } from './fixture/FixtureApi';
import {
  useAddPlant,
  useApplyDiagnosis,
  useCheckIn,
  useConfirmScan,
  useDeleteAccount,
  useDiagnose,
  useEntitlement,
  useFinds,
  useFriends,
  useHousehold,
  useHouseholds,
  useIdentify,
  usePlant,
  usePlantdex,
  usePlants,
  useQuota,
  useSavePets,
  useSendFriendRequest,
  useSetPlantStatus,
  useStartPreview,
  useToday,
} from './hooks';

function setup() {
  const api = new FixtureApi();
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      // A cache entry's garbage-collection timer would keep jest alive.
      mutations: { gcTime: Infinity },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  return { api, wrapper };
}

describe('API hooks', () => {
  it('load through the API provided', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(
      () => ({ today: useToday(), plants: usePlants('our-flat') }),
      {
        wrapper,
      },
    );
    await waitFor(() => expect(result.current.today.data?.streak.careDays).toBe(12));
    await waitFor(() => expect(result.current.plants.data).toHaveLength(3));
  });

  it('surface a rejected call as an error state', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(() => usePlant('nope'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('a check-in refreshes Today and the plant', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(
      () => ({ today: useToday(), plant: usePlant('monty'), checkIn: useCheckIn() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.plant.data?.nextCheckOn).toBe('2026-10-03'));
    await act(() =>
      result.current.checkIn.mutateAsync({
        clientId: 'c1',
        plantId: 'monty',
        soilDry: false,
        leafStates: [],
      }),
    );
    await waitFor(() => expect(result.current.plant.data?.nextCheckOn).toBe('2026-10-05'));
    await waitFor(() =>
      expect(result.current.today.data?.tasks.find((t) => t.id === 't-monty')?.status).toBe('done'),
    );
  });

  it('adding a plant refreshes the list and Today', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(
      () => ({ plants: usePlants('our-flat'), addPlant: useAddPlant() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.plants.data).toHaveLength(3));
    await act(() =>
      result.current.addPlant.mutateAsync({
        source: 'label_qr',
        labelCode: 'PL-0001',
        setup: {
          nickname: 'Pea',
          room: null,
          light: 'unknown',
          potMaterial: 'unknown',
          potSizeCm: null,
          drainage: 'unknown',
          indoor: true,
        },
      }),
    );
    await waitFor(() => expect(result.current.plants.data).toHaveLength(4));
  });

  it('confirming a scan refreshes the Plantdex and finds', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(
      () => ({
        dex: usePlantdex('wild'),
        finds: useFinds(),
        confirm: useConfirmScan(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.finds.data).toHaveLength(3));
    await act(() =>
      result.current.confirm.mutateAsync({
        observationId: 'obs-foxglove-find',
        speciesId: 'foxglove',
        action: 'log_find',
        placeType: 'wild',
      }),
    );
    await waitFor(() => expect(result.current.finds.data).toHaveLength(4));
    await waitFor(() => expect(result.current.dex.data?.counts.all).toBe(38));
  });

  it('starting the preview refreshes the entitlement and quota', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(
      () => ({
        entitlement: useEntitlement(),
        quota: useQuota('identification'),
        start: useStartPreview(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.quota.data?.limit).toBe(10));
    await act(() => result.current.start.mutateAsync());
    await waitFor(() => expect(result.current.entitlement.data?.plan).toBe('premium'));
    await waitFor(() => expect(result.current.quota.data?.limit).toBe(60));
  });

  it('lists households', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(() => useHouseholds(), { wrapper });
    await waitFor(() =>
      expect(result.current.data?.map((h) => h.id)).toEqual(['our-flat', 'mams-house']),
    );
  });

  it('identifying refreshes the quota', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(
      () => ({ quota: useQuota('identification'), identify: useIdentify() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.quota.data).toBeDefined());
    const before = result.current.quota.data!.used;
    await act(() =>
      result.current.identify.mutateAsync({
        photoUris: ['file:///a.jpg'],
        organs: ['leaf'],
        captureSource: 'camera',
        healthCheck: false,
      }),
    );
    await waitFor(() => expect(result.current.quota.data?.used).toBe(before + 1));
  });

  it('saving pets refreshes the household', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(
      () => ({ household: useHousehold(), save: useSavePets() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.household.data?.pets).toHaveLength(2));
    await act(() => result.current.save.mutateAsync([{ animal: 'dog', name: 'Pip' }]));
    await waitFor(() =>
      expect(result.current.household.data?.pets.map((p) => p.name)).toEqual(['Pip']),
    );
  });

  it('setting a plant status refreshes the plant and the list', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(
      () => ({ plant: usePlant('monty'), set: useSetPlantStatus() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.plant.data?.status).toBe('alive'));
    await act(() => result.current.set.mutateAsync({ id: 'monty', status: 'given_away' }));
    await waitFor(() => expect(result.current.plant.data?.status).toBe('given_away'));
  });

  it('diagnosing refreshes the diagnosis quota, and applying the plant', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(
      () => ({
        quota: useQuota('diagnosis'),
        plant: usePlant('monty'),
        diagnose: useDiagnose(),
        apply: useApplyDiagnosis(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.quota.data?.used).toBe(0));
    let id = '';
    await act(async () => {
      id = (await result.current.diagnose.mutateAsync({ plantId: 'monty', photoUris: ['a'] })).id;
    });
    await waitFor(() => expect(result.current.quota.data?.used).toBe(1));
    await act(() => result.current.apply.mutateAsync(id));
    await waitFor(() => expect(result.current.plant.data?.careState).toBe('paused'));
  });

  it('a friend request refreshes the friends board without adding a row', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(
      () => ({ friends: useFriends(), send: useSendFriendRequest() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.friends.data).toBeDefined());
    const rows = result.current.friends.data!.rows.length;
    await act(() => result.current.send.mutateAsync('lichenlou'));
    expect(result.current.send.isSuccess).toBe(true);
    await waitFor(() => expect(result.current.friends.data?.rows).toHaveLength(rows));
  });

  it('deleting the account refreshes everything', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(
      () => ({ plants: usePlants('our-flat'), del: useDeleteAccount() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.plants.data).toHaveLength(3));
    await act(() => result.current.del.mutateAsync());
    await waitFor(() => expect(result.current.plants.data).toEqual([]));
  });
});
