import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiProvider } from '../../api/ApiProvider';
import { FixtureApi, type FixtureScenario } from '../../api/fixture/FixtureApi';
import StreaksRoute from '../../app/today/streaks';
import TodayRoute from '../../app/(tabs)/today/index';
import { ThemeProvider } from '../../theme';
import { paramsMock, resetRouterMock, routerMock } from './mockRouter';

jest.mock('expo-router', () => jest.requireActual('./mockRouter').mockExpoRouter());
// jest-expo stubs the native module, which has no UUID to give; one per call is all these tests need.
let mockUuidCount = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockUuidCount}` }));

const renderRoute = (node: React.ReactElement, api = new FixtureApi()) =>
  render(
    <ThemeProvider scheme="light">
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
        }
      >
        <ApiProvider api={api}>{node}</ApiProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );

const openMontyCheckIn = async () => {
  await fireEvent.press(await screen.findByRole('button', { name: 'Check in' }));
  return screen.findByText("Is the top of Monty's soil dry?");
};

describe('Today route', () => {
  beforeEach(() => {
    resetRouterMock();
    mockUuidCount = 0;
  });

  it('shows the day from the fixture API, with the avatar letter from the profile', async () => {
    await renderRoute(<TodayRoute />);
    expect(await screen.findByText('Saturday 3 October')).toBeTruthy();
    expect(await screen.findByText('A')).toBeTruthy();
    expect(screen.getByText('4th of 20')).toBeTruthy();
  });

  it('wires the avatar, the streak tiles, the league tile and the scan routes', async () => {
    await renderRoute(<TodayRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Profile' }));
    expect(routerMock.push).toHaveBeenCalledWith('/profile');
    await fireEvent.press(screen.getByRole('button', { name: /^Streaks\./ }));
    expect(routerMock.push).toHaveBeenCalledWith('/today/streaks');
    await fireEvent.press(screen.getByRole('button', { name: /^League/ }));
    expect(routerMock.navigate).toHaveBeenCalledWith('/leagues');
  });

  it('"Scan a plant" and "Scan your plant label" on the empty state', async () => {
    await renderRoute(<TodayRoute />, new FixtureApi({ scenario: 'empty' as FixtureScenario }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Scan your plant label' }));
    expect(routerMock.push).toHaveBeenCalledWith('/camera?mode=label');
    await fireEvent.press(screen.getByRole('button', { name: 'Scan a plant' }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/camera'));
  });

  it('checks in: dry says to water, damp says when to look again', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'checkIn');
    await renderRoute(<TodayRoute />, api);
    await openMontyCheckIn();
    await fireEvent.press(screen.getByRole('button', { name: 'No, still damp' }));
    expect(await screen.findByText(/^Good\. We'll check again on /)).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toMatchObject({ plantId: 'monty', soilDry: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByText(/^Good\. We'll check again/)).toBeNull());
  });

  it('a dry answer offers the watering task', async () => {
    await renderRoute(<TodayRoute />);
    await openMontyCheckIn();
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, dry' }));
    expect(await screen.findByText('Time to water Monty.')).toBeTruthy();
  });

  it('offline, a check-in is saved and says so', async () => {
    await renderRoute(<TodayRoute />, new FixtureApi({ scenario: 'offline' as FixtureScenario }));
    await openMontyCheckIn();
    await fireEvent.press(screen.getByRole('button', { name: 'No, still damp' }));
    expect(
      await screen.findByText("You're offline. Saved, and it will sync when you're back."),
    ).toBeTruthy();
  });

  it('a rejected check-in resets the sheet, shows the error, and the retry reuses the clientId', async () => {
    const api = new FixtureApi();
    const real = api.checkIn.bind(api);
    const spy = jest
      .spyOn(api, 'checkIn')
      .mockRejectedValueOnce(new Error('network'))
      .mockImplementation(real);
    await renderRoute(<TodayRoute />, api);
    await openMontyCheckIn();
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, dry' }));

    expect(await screen.findByText("Couldn't save your check-in. Try again.")).toBeTruthy();
    // Back on the question, with the answers live again.
    expect(screen.getByText("Is the top of Monty's soil dry?")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, dry' }));
    expect(await screen.findByText('Time to water Monty.')).toBeTruthy();

    expect(spy).toHaveBeenCalledTimes(2);
    const [first, second] = spy.mock.calls.map((c) => c[0]);
    expect(second!.clientId).toBe(first!.clientId);
    expect(first!.clientId).toBe('uuid-1');
  });

  it('a reopened sheet is a new check-in with its own clientId', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'checkIn');
    await renderRoute(<TodayRoute />, api);
    await openMontyCheckIn();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await openMontyCheckIn();
    await fireEvent.press(screen.getByRole('button', { name: 'No, still damp' }));
    await screen.findByText(/^Good\. We'll check again on /);
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0].clientId).toBe('uuid-2');
  });

  it('opens the sheet that Streaks asked for', async () => {
    paramsMock.current = { checkIn: 't-monty' };
    await renderRoute(<TodayRoute />);
    expect(await screen.findByText("Is the top of Monty's soil dry?")).toBeTruthy();
    expect(routerMock.setParams).toHaveBeenCalledWith({ checkIn: undefined });
  });

  it('a task that is not a check opens its plant', async () => {
    await renderRoute(<TodayRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: /Water Lily/ }));
    expect(routerMock.push).toHaveBeenCalledWith('/plants/lily');
  });
});

describe('Streaks route', () => {
  beforeEach(() => resetRouterMock());

  it('shows the streak and goes back', async () => {
    await renderRoute(<StreaksRoute />);
    expect(await screen.findByText('Streaks')).toBeTruthy();
    expect(screen.getByText('3 weeks')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(routerMock.back).toHaveBeenCalled();
  });

  it('with no history to go back to, goes to Today', async () => {
    routerMock.canGoBack.mockReturnValue(false);
    await renderRoute(<StreaksRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Back to Today' }));
    expect(routerMock.replace).toHaveBeenCalledWith('/today');
  });
});
