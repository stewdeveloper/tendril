import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { ApiProvider } from '../api/ApiProvider';
import { FixtureApi, type FixtureScenario } from '../api/fixture/FixtureApi';
import type { TendrilApi } from '../api/types';
import { useStartScan } from './useStartScan';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
}));

const setup = async (api: TendrilApi) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ApiProvider api={api}>{children}</ApiProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useStartScan(), { wrapper });
};

describe('useStartScan', () => {
  beforeEach(() => jest.clearAllMocks());

  it('opens the camera under the cap', async () => {
    const { result } = await setup(new FixtureApi());
    await act(() => result.current());
    expect(mockPush).toHaveBeenCalledWith('/camera');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it.each<FixtureScenario>(['limit_free', 'limit_premium'])(
    'opens the Scan screen at the cap (%s), and never the camera',
    async (scenario) => {
      const { result } = await setup(new FixtureApi({ scenario }));
      await act(() => result.current());
      expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/scan');
      expect(mockPush).not.toHaveBeenCalled();
    },
  );

  it('reads the quota fresh each time, so a limit reached since the last scan is seen', async () => {
    const api = new FixtureApi();
    const { result } = await setup(api);
    await act(() => result.current());
    expect(mockPush).toHaveBeenCalledTimes(1);
    api.setScenario('limit_free');
    await act(() => result.current());
    expect(mockNavigate).toHaveBeenCalledWith('/(tabs)/scan');
  });

  it('opens the camera when the quota cannot be read, and leaves the server to refuse', async () => {
    const api = new FixtureApi();
    api.getQuota = () => Promise.reject(new Error('offline'));
    const { result } = await setup(api);
    await act(() => result.current());
    expect(mockPush).toHaveBeenCalledWith('/camera');
  });
});
