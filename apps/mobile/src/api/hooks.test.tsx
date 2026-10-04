import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ApiProvider } from './ApiProvider';
import { FixtureApi } from './fixture/FixtureApi';
import {
  useAddPlant,
  useCheckIn,
  useConfirmScan,
  useEntitlement,
  useFinds,
  usePlant,
  usePlantdex,
  usePlants,
  useQuota,
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

  it('confirming a scan refreshes the Plantdex, finds and quota', async () => {
    const { wrapper } = setup();
    const { result } = await renderHook(
      () => ({
        dex: usePlantdex('wild'),
        finds: useFinds(),
        quota: useQuota('identification'),
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
});
