import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { ApiProvider } from '../../api/ApiProvider';
import { ApiError } from '../../api/errors';
import { FixtureApi } from '../../api/fixture/FixtureApi';
import ScanResultRoute from '../../app/scan/[id]/index';
import SetupRoute from '../../app/plants/setup';
import { resetLocationPrimer } from '../../lib/useLocationAccess';
import {
  getForegroundPermissionsAsync,
  requestForegroundPermissionsAsync,
  resetLocationMock,
} from '../../testing/expoLocationMock';
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

const open = (id: string) => {
  paramsMock.current = { id };
};

beforeEach(() => {
  resetRouterMock();
  resetLocationMock();
  resetLocationPrimer();
});

describe('Scan result route', () => {
  it('shows the result from the API', async () => {
    open('obs-peace-lily-very-likely');
    await renderRoute(<ScanResultRoute />);
    expect(await screen.findByText('Very likely, 94%')).toBeTruthy();
    expect(screen.getByText('Cats: Moderate')).toBeTruthy();
  });

  it('shows nothing it cannot back: the likely result asks to compare', async () => {
    open('obs-peace-lily-likely');
    await renderRoute(<ScanResultRoute />);
    expect(await screen.findByText('Flamingo flower')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to My Plants' })).toBeNull();
  });

  it('closing goes back, or to Today when there is nothing to go back to', async () => {
    open('obs-peace-lily-very-likely');
    await renderRoute(<ScanResultRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Close' }));
    expect(routerMock.back).toHaveBeenCalled();
  });

  it('Add to My Plants opens setup for this scan', async () => {
    open('obs-peace-lily-very-likely');
    await renderRoute(<ScanResultRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Add to My Plants' }));
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/plants/setup',
      params: {
        source: 'scan',
        observationId: 'obs-peace-lily-very-likely',
        speciesId: 'peace-lily',
      },
    });
  });

  it('"This is a peace lily" on a likely match also opens setup', async () => {
    open('obs-peace-lily-likely');
    await renderRoute(<ScanResultRoute />);
    await fireEvent.press(
      (await screen.findAllByRole('button', { name: 'This is a peace lily' })).at(-1)!,
    );
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/plants/setup',
      params: {
        source: 'scan',
        observationId: 'obs-peace-lily-likely',
        speciesId: 'peace-lily',
      },
    });
  });

  it('"My pet ate this" carries the pet and the species', async () => {
    open('obs-peace-lily-very-likely');
    await renderRoute(<ScanResultRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'My pet ate this' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Miso' }));
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/pet-emergency',
      params: { petId: 'pet-miso', speciesId: 'peace-lily', match: 0.94 },
    });
  });

  it('"My pet ate this" on a likely match carries the match, so the emergency screen hedges', async () => {
    open('obs-peace-lily-likely');
    await renderRoute(<ScanResultRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'My pet ate this' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Miso' }));
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/pet-emergency',
      params: { petId: 'pet-miso', speciesId: 'peace-lily', match: 0.71 },
    });
  });

  it('"My pet ate this" on a not sure match names no species: the vet-first fallback', async () => {
    open('obs-not-sure');
    await renderRoute(<ScanResultRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'My pet ate this' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Miso' }));
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/pet-emergency',
      params: { petId: 'pet-miso' },
    });
  });

  it('choosing the other match on a likely result sets up that species', async () => {
    open('obs-peace-lily-likely');
    await renderRoute(<ScanResultRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'This is a flamingo flower' }));
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/plants/setup',
      params: {
        source: 'scan',
        observationId: 'obs-peace-lily-likely',
        speciesId: 'flamingo-flower',
      },
    });
  });

  it('a result that cannot be loaded shows the error state, not a blank screen', async () => {
    open('obs-peace-lily-very-likely');
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'getScanResult').mockRejectedValue(new Error('network'));
    await renderRoute(<ScanResultRoute />, api);
    expect(await screen.findByText('Something went wrong')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(routerMock.back).toHaveBeenCalled();
  });

  it('not a plant: Try again goes back to the camera', async () => {
    open('obs-not-a-plant');
    await renderRoute(<ScanResultRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
    expect(routerMock.replace).toHaveBeenCalledWith('/camera');
  });

  it('error: Try again asks for the result again', async () => {
    open('obs-error');
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'getScanResult');
    await renderRoute(<ScanResultRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
  });

  it('not sure: Take a close photo goes back to the camera', async () => {
    open('obs-not-sure');
    await renderRoute(<ScanResultRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Take a close photo' }));
    expect(routerMock.replace).toHaveBeenCalledWith('/camera');
  });
});

describe('Log a find', () => {
  beforeEach(() => open('obs-foxglove-find'));

  it('asks about location the first time, then opens the sheet with the place unchosen', async () => {
    await renderRoute(<ScanResultRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Log a find' }));
    expect(await screen.findByText('Use your location')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Allow location' }));
    expect(await screen.findByText('Where was it?')).toBeTruthy();
    expect(requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Save find' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Turn on location' })).toBeNull();
  });

  it('Not now still opens the sheet, and says location is off', async () => {
    await renderRoute(<ScanResultRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Log a find' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Not now' }));
    expect(
      await screen.findByText('Location is off. This find goes in your Plantdex without points.'),
    ).toBeTruthy();
    expect(requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('does not ask again once it has asked', async () => {
    await renderRoute(<ScanResultRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Log a find' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Not now' }));
    // The screen's own Close sits behind the sheet's, which is the last in the tree.
    await fireEvent.press((await screen.findAllByRole('button', { name: 'Close' })).at(-1)!);
    await fireEvent.press(screen.getByRole('button', { name: 'Log a find' }));
    expect(await screen.findByText('Where was it?')).toBeTruthy();
    expect(screen.queryByText('Use your location')).toBeNull();
  });

  const openSheet = async () => {
    getForegroundPermissionsAsync.mockResolvedValue({
      granted: true,
      status: 'granted',
      canAskAgain: true,
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Log a find' }));
    await screen.findByText('Where was it?');
  };

  it('saves a find with the place chosen, then goes to the new species screen', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'confirmScan');
    await renderRoute(<ScanResultRoute />, api);
    await openSheet();
    await fireEvent.press(screen.getByRole('radio', { name: 'Garden or park' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({
        observationId: 'obs-foxglove-find',
        speciesId: 'foxglove',
        action: 'log_find',
        placeType: 'garden_park',
      }),
    );
    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith('/scan/obs-foxglove-find/new-species'),
    );
  });

  it('a find that is not new goes to the Collection with a saved note', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'getOutcome').mockResolvedValue({
      pointsStatus: 'awarded',
      points: 10,
      noPointsReason: null,
      newToPlantdex: false,
      plantdexCount: 37,
      sets: [],
    });
    await renderRoute(<ScanResultRoute />, api);
    await openSheet();
    await fireEvent.press(screen.getByRole('radio', { name: 'Wild' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/collection?saved=1'));
  });

  it('a save that fails stays on the sheet and says so', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'confirmScan').mockRejectedValue(new Error('network'));
    await renderRoute(<ScanResultRoute />, api);
    await openSheet();
    await fireEvent.press(screen.getByRole('radio', { name: 'Shop' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
    expect(await screen.findByText("Couldn't save your find. Try again.")).toBeTruthy();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('an already-saved find is a success: it goes where a save goes', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'confirmScan').mockRejectedValue(new ApiError(409, 'already_confirmed'));
    await renderRoute(<ScanResultRoute />, api);
    await openSheet();
    await fireEvent.press(screen.getByRole('radio', { name: 'Shop' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith('/scan/obs-foxglove-find/new-species'),
    );
    expect(screen.queryByText("This one's already saved.")).toBeNull();
  });

  it('an already-saved find that is not new goes to the Collection', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'confirmScan').mockRejectedValue(new ApiError(409, 'already_confirmed'));
    jest.spyOn(api, 'getOutcome').mockResolvedValue({
      pointsStatus: 'awarded',
      points: 10,
      noPointsReason: null,
      newToPlantdex: false,
      plantdexCount: 37,
      sets: [],
    });
    await renderRoute(<ScanResultRoute />, api);
    await openSheet();
    await fireEvent.press(screen.getByRole('radio', { name: 'Shop' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/collection?saved=1'));
  });

  it('an already-saved find whose outcome cannot be read says so and offers no retry', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'confirmScan').mockRejectedValue(new ApiError(409, 'already_confirmed'));
    jest.spyOn(api, 'getOutcome').mockRejectedValue(new Error('network'));
    await renderRoute(<ScanResultRoute />, api);
    await openSheet();
    await fireEvent.press(screen.getByRole('radio', { name: 'Shop' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
    expect(await screen.findByText("This one's already saved.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save find' })).toBeDisabled();
  });

  it('a rejected result says to scan again, and the button scans again', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'confirmScan').mockRejectedValue(new ApiError(400, 'not_identified'));
    await renderRoute(<ScanResultRoute />, api);
    await openSheet();
    await fireEvent.press(screen.getByRole('radio', { name: 'Shop' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save find' }));
    expect(await screen.findByText("We can't save this result. Try scanning again.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save find' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Scan again' }));
    expect(routerMock.replace).toHaveBeenCalledWith('/camera');
  });

  it('Turn on location asks the system, and opens settings once it cannot ask again', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'denied',
      canAskAgain: false,
    });
    await renderRoute(<ScanResultRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Log a find' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Turn on location' }));
    expect(openSettings).toHaveBeenCalled();
  });
});

describe('Setup route, from a scan', () => {
  beforeEach(() => {
    paramsMock.current = { source: 'scan', observationId: 'obs-peace-lily-very-likely' };
  });

  it('confirms the scan as a new plant with no place type, then opens the plant', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'confirmScan');
    jest.spyOn(api, 'getOutcome').mockResolvedValue({
      pointsStatus: 'awarded',
      points: 10,
      noPointsReason: null,
      newToPlantdex: false,
      plantdexCount: 37,
      sets: [],
    });
    await renderRoute(<SetupRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    const input = spy.mock.calls[0]![0];
    expect(input).toMatchObject({
      observationId: 'obs-peace-lily-very-likely',
      speciesId: 'peace-lily',
      action: 'add_plant',
    });
    expect(input.placeType).toBeUndefined();
    const { plantId } = await spy.mock.results[0]!.value;
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith(`/plants/${plantId}`));
  });

  it('goes to the new species screen when the species is new to the Plantdex', async () => {
    await renderRoute(<SetupRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith(
        expect.stringMatching(/^\/scan\/obs-peace-lily-very-likely\/new-species\?plantId=.+/),
      ),
    );
  });

  it('sets up the species chosen, not always the top match', async () => {
    paramsMock.current = {
      source: 'scan',
      observationId: 'obs-peace-lily-likely',
      speciesId: 'flamingo-flower',
    };
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'confirmScan');
    await renderRoute(<SetupRoute />, api);
    expect(await screen.findByText('Set up Flamingo flower')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ speciesId: 'flamingo-flower', action: 'add_plant' }),
      ),
    );
  });

  it('a second press while the outcome is still being read saves nothing twice', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'confirmScan');
    const outcome = await api.getOutcome('obs-foxglove-find');
    let release: () => void = () => {};
    jest
      .spyOn(api, 'getOutcome')
      .mockImplementation(() => new Promise((resolve) => (release = () => resolve(outcome))));
    await renderRoute(<SetupRoute />, api);
    const save = await screen.findByRole('button', { name: 'Save' });
    // Not awaited: the press only settles once the outcome arrives.
    void fireEvent.press(save);
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(api.getOutcome).toHaveBeenCalled());
    void fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await new Promise((r) => setTimeout(r, 50));
    expect(spy).toHaveBeenCalledTimes(1);
    release();
  });

  it('an already-saved scan is a success: a new species goes to its moment', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'confirmScan').mockRejectedValue(new ApiError(409, 'already_confirmed'));
    jest.spyOn(api, 'getOutcome').mockResolvedValue({
      pointsStatus: 'awarded',
      points: 40,
      noPointsReason: null,
      newToPlantdex: true,
      plantdexCount: 38,
      sets: [],
    });
    await renderRoute(<SetupRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(routerMock.replace).toHaveBeenCalledWith(
        '/scan/obs-peace-lily-very-likely/new-species',
      ),
    );
    expect(screen.queryByText("This one's already saved.")).toBeNull();
  });

  it('an already-saved scan that is not new goes to My Plants', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'confirmScan').mockRejectedValue(new ApiError(409, 'already_confirmed'));
    jest.spyOn(api, 'getOutcome').mockResolvedValue({
      pointsStatus: 'awarded',
      points: 10,
      noPointsReason: null,
      newToPlantdex: false,
      plantdexCount: 37,
      sets: [],
    });
    await renderRoute(<SetupRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/plants'));
  });

  it('an already-saved scan whose outcome cannot be read says so, and Save is visibly off', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'confirmScan').mockRejectedValue(new ApiError(409, 'already_confirmed'));
    jest.spyOn(api, 'getOutcome').mockRejectedValue(new Error('network'));
    await renderRoute(<SetupRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText("This one's already saved.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('a rejected scan says to scan again, and the button scans again', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'confirmScan').mockRejectedValue(new ApiError(400, 'invalid_species'));
    await renderRoute(<SetupRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText("We can't save this result. Try scanning again.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Scan again' }));
    expect(routerMock.replace).toHaveBeenCalledWith('/camera');
  });

  it('a save that fails stays on the form', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'confirmScan').mockRejectedValue(new Error('network'));
    await renderRoute(<SetupRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText("Couldn't save your plant. Try again.")).toBeTruthy();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });
});
