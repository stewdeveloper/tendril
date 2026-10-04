import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { ApiProvider } from '../../api/ApiProvider';
import { FixtureApi } from '../../api/fixture/FixtureApi';
import SetCompleteRoute from '../../app/collection/sets/[id]/complete';
import NewSpeciesRoute from '../../app/scan/[id]/new-species';
import { ThemeProvider } from '../../theme';
import { paramsMock, resetRouterMock, routerMock } from './mockRouter';

jest.mock('expo-router', () => jest.requireActual('./mockRouter').mockExpoRouter());

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

beforeEach(() => resetRouterMock());

describe('New species route', () => {
  it('shows what the find earned, and Continue goes to the Collection', async () => {
    paramsMock.current = { id: 'obs-foxglove-find' };
    await renderRoute(<NewSpeciesRoute />);
    expect(await screen.findByText('New to your Plantdex')).toBeTruthy();
    expect(screen.getByText('+40')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(routerMock.replace).toHaveBeenCalledWith('/collection?saved=1');
  });

  it('Continue opens the plant when one was just added', async () => {
    paramsMock.current = { id: 'obs-foxglove-find', plantId: 'plant-9' };
    await renderRoute(<NewSpeciesRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Continue' }));
    expect(routerMock.replace).toHaveBeenCalledWith('/plants/plant-9');
  });

  it('Continue goes to the set-complete screen when the find completed a set', async () => {
    paramsMock.current = { id: 'obs-foxglove-find', plantId: 'plant-9' };
    const api = new FixtureApi();
    const outcome = await api.getOutcome('obs-foxglove-find');
    jest.spyOn(api, 'getOutcome').mockResolvedValue({
      ...outcome,
      sets: [{ setId: 'easy-care-houseplants', name: 'Easy-care houseplants', found: 6, total: 6 }],
    });
    await renderRoute(<NewSpeciesRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Continue' }));
    expect(routerMock.replace).toHaveBeenCalledWith(
      '/collection/sets/easy-care-houseplants/complete',
    );
  });

  it('an outcome that cannot be loaded still shows something, and Continue works', async () => {
    paramsMock.current = { id: 'obs-foxglove-find' };
    const api = new FixtureApi();
    jest.spyOn(api, 'getOutcome').mockRejectedValue(new Error('network'));
    await renderRoute(<NewSpeciesRoute />, api);
    expect(await screen.findByText('Find saved')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(routerMock.replace).toHaveBeenCalledWith('/collection');
  });
});

describe('Set complete route', () => {
  it('names the set, shares through the system sheet, and Continue goes to the Collection', async () => {
    paramsMock.current = { id: 'easy-care-houseplants' };
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'dismissedAction' });
    await renderRoute(<SetCompleteRoute />);
    expect(await screen.findByText('Easy-care houseplants')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
    expect(share).toHaveBeenCalledWith({
      message: expect.stringContaining('Easy-care houseplants'),
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(routerMock.replace).toHaveBeenCalledWith('/collection');
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Sets' }));
    await waitFor(() => expect(routerMock.back).toHaveBeenCalled());
  });

  it('a set that is not found goes to the Collection', async () => {
    paramsMock.current = { id: 'nope' };
    await renderRoute(<SetCompleteRoute />);
    expect(await screen.findByText('redirect:/collection')).toBeTruthy();
  });
});
