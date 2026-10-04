import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ActionSheetIOS, Platform, Text } from 'react-native';
import { ApiProvider } from '../../api/ApiProvider';
import { FixtureApi } from '../../api/fixture/FixtureApi';
import LabelRoute from '../../app/l/[code]';
import PlantDetailRoute from '../../app/(tabs)/plants/[id]/index';
import PlantsRoute from '../../app/(tabs)/plants/index';
import SetupRoute from '../../app/plants/setup';
import { TabBarVisibilityProvider, useTabBarHidden } from '../../components';
import { ThemeProvider } from '../../theme';
import { paramsMock, resetRouterMock, routerMock } from './mockRouter';

jest.mock('expo-router', () => jest.requireActual('./mockRouter').mockExpoRouter());

function BarProbe() {
  return <Text>{useTabBarHidden() ? 'bar:hidden' : 'bar:shown'}</Text>;
}

const renderRoute = (node: React.ReactElement, api = new FixtureApi()) =>
  render(
    <ThemeProvider scheme="light">
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
        }
      >
        <ApiProvider api={api}>
          <TabBarVisibilityProvider>
            <BarProbe />
            {node}
          </TabBarVisibilityProvider>
        </ApiProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );

beforeEach(() => resetRouterMock());

describe('My Plants route', () => {
  it('lists the household by room, opens a plant and the profile', async () => {
    await renderRoute(<PlantsRoute />);
    expect(await screen.findByText('Living room')).toBeTruthy();
    expect(await screen.findByText('A')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Spidey, Spider plant/ }));
    expect(routerMock.push).toHaveBeenCalledWith('/plants/spidey');
    await fireEvent.press(screen.getByRole('button', { name: 'Profile' }));
    expect(routerMock.push).toHaveBeenCalledWith('/profile');
  });

  it('the other household has no plants yet, and offers both scans', async () => {
    await renderRoute(<PlantsRoute />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Mam’s house' }));
    expect(
      await screen.findByText('No plants yet. Scan one, or scan the label it came with.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Scan a plant label' }));
    expect(routerMock.push).toHaveBeenCalledWith('/camera?mode=label');
    await fireEvent.press(screen.getByRole('button', { name: 'Scan a plant' }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/camera'));
  });

  it('"Add a plant" starts a scan', async () => {
    await renderRoute(<PlantsRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Add a plant' }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/camera'));
  });
});

describe('Plant detail route', () => {
  beforeEach(() => {
    paramsMock.current = { id: 'monty' };
  });

  it('shows the plant from the API with the bar visible', async () => {
    await renderRoute(<PlantDetailRoute />);
    expect(await screen.findByText('Monty')).toBeTruthy();
    expect(screen.getByText('Very likely, 96%')).toBeTruthy();
    expect(screen.getByText('bar:shown')).toBeTruthy();
  });

  it('"My pet ate this" routes to the emergency screen with the pet and the plant', async () => {
    await renderRoute(<PlantDetailRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'My pet ate this' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Bran' }));
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/pet-emergency',
      params: { petId: 'pet-bran', plantId: 'monty' },
    });
  });

  it('"Check in" opens that plant\'s check on Today', async () => {
    await renderRoute(<PlantDetailRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Check in' }));
    expect(routerMock.navigate).toHaveBeenCalledWith({
      pathname: '/today',
      params: { checkIn: 't-monty' },
    });
  });

  it('back goes back, or to My Plants with nothing to go back to', async () => {
    await renderRoute(<PlantDetailRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
    expect(routerMock.back).toHaveBeenCalled();
    routerMock.canGoBack.mockReturnValue(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(routerMock.replace).toHaveBeenCalledWith('/plants');
  });

  describe('the "..." menu on iOS', () => {
    const choose = async (title: string) => {
      const [options, callback] = jest
        .mocked(ActionSheetIOS.showActionSheetWithOptions)
        .mock.calls.at(-1) as [
        { options: string[]; cancelButtonIndex?: number },
        (i: number) => void,
      ];
      await act(async () => callback(options.options.indexOf(title)));
    };
    beforeEach(() => {
      jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
    });

    it('offers died and given away, with a cancel', async () => {
      await renderRoute(<PlantDetailRoute />);
      await fireEvent.press(await screen.findByRole('button', { name: 'More' }));
      const [config] = jest.mocked(ActionSheetIOS.showActionSheetWithOptions).mock.calls.at(-1)!;
      expect(config.options).toEqual(['Mark as died', 'Given away', 'Cancel']);
      expect(config.cancelButtonIndex).toBe(2);
    });

    it('given away closes the plant and hides the tab bar', async () => {
      const api = new FixtureApi();
      const spy = jest.spyOn(api, 'setPlantStatus');
      await renderRoute(<PlantDetailRoute />, api);
      await fireEvent.press(await screen.findByRole('button', { name: 'More' }));
      await choose('Given away');
      expect(
        await screen.findByText('Given away on 3 October. Kept in your history.'),
      ).toBeTruthy();
      expect(spy).toHaveBeenCalledWith('monty', 'given_away', undefined);
      expect(await screen.findByText('bar:hidden')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Check in' })).toBeNull();
    });

    it('died asks what happened first, and the cause is optional', async () => {
      const api = new FixtureApi();
      const spy = jest.spyOn(api, 'setPlantStatus');
      await renderRoute(<PlantDetailRoute />, api);
      await fireEvent.press(await screen.findByRole('button', { name: 'More' }));
      await choose('Mark as died');
      expect(spy).not.toHaveBeenCalled();
      expect(await screen.findByText('What happened?')).toBeTruthy();
      await fireEvent.press(screen.getByRole('radio', { name: 'Too dry' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Mark as died' }));
      expect(
        await screen.findByText(
          'Marked as died on 3 October: too dry. We use this to give better advice.',
        ),
      ).toBeTruthy();
      expect(spy).toHaveBeenCalledWith('monty', 'dead', 'too dry');
      expect(await screen.findByText('bar:hidden')).toBeTruthy();
    });

    it('written words take the place of a pill, and no cause is allowed', async () => {
      const api = new FixtureApi();
      const spy = jest.spyOn(api, 'setPlantStatus');
      await renderRoute(<PlantDetailRoute />, api);
      await fireEvent.press(await screen.findByRole('button', { name: 'More' }));
      await choose('Mark as died');
      await fireEvent.press(await screen.findByRole('radio', { name: 'Pests' }));
      await fireEvent.changeText(screen.getByLabelText('Anything else? (optional)'), 'Mealybugs');
      await fireEvent.press(screen.getByRole('button', { name: 'Mark as died' }));
      await waitFor(() => expect(spy).toHaveBeenCalledWith('monty', 'dead', 'Mealybugs'));
    });

    it('no cause at all still marks it', async () => {
      const api = new FixtureApi();
      const spy = jest.spyOn(api, 'setPlantStatus');
      await renderRoute(<PlantDetailRoute />, api);
      await fireEvent.press(await screen.findByRole('button', { name: 'More' }));
      await choose('Mark as died');
      await fireEvent.press(await screen.findByRole('button', { name: 'Mark as died' }));
      await waitFor(() => expect(spy).toHaveBeenCalledWith('monty', 'dead', undefined));
      expect(
        await screen.findByText('Marked as died on 3 October. We use this to give better advice.'),
      ).toBeTruthy();
    });
  });

  it('off iOS the menu is a sheet of buttons', async () => {
    const replaced = jest.replaceProperty(Platform, 'OS', 'android');
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'setPlantStatus');
    await renderRoute(<PlantDetailRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'More' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Given away' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('monty', 'given_away', undefined));
    expect(await screen.findByText(/^Given away on /)).toBeTruthy();
    replaced.restore();
  });

  it('a plant that is already closed hides the bar from the start', async () => {
    paramsMock.current = { id: 'fern-dead' };
    await renderRoute(<PlantDetailRoute />);
    expect(await screen.findByText('Fern')).toBeTruthy();
    expect(await screen.findByText('bar:hidden')).toBeTruthy();
  });
});

describe('Label route', () => {
  it('"Add to my plants" opens setup for that label', async () => {
    paramsMock.current = { code: 'PL-0001' };
    await renderRoute(<LabelRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Add to my plants' }));
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/plants/setup',
      params: { source: 'label_qr', labelCode: 'PL-0001' },
    });
  });

  it('"My pet ate this" carries the species, not a plant', async () => {
    paramsMock.current = { code: 'PL-0001' };
    await renderRoute(<LabelRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'My pet ate this' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Miso' }));
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/pet-emergency',
      params: { petId: 'pet-miso', speciesId: 'peace-lily' },
    });
  });

  it('a code we do not know offers to scan the plant', async () => {
    paramsMock.current = { code: 'NOPE-9999' };
    await renderRoute(<LabelRoute />);
    expect(
      await screen.findByText("We don't know this label. The code may be retired."),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Scan the plant' }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/camera'));
  });
});

describe('Setup route', () => {
  it('saves a label plant with the label code, then opens it', async () => {
    paramsMock.current = { source: 'label_qr', labelCode: 'PL-0001' };
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'addPlant');
    await renderRoute(<SetupRoute />, api);
    expect(await screen.findByText('Set up Peace lily')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Bright' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    expect(spy.mock.calls.at(-1)![0]).toMatchObject({
      source: 'label_qr',
      labelCode: 'PL-0001',
      setup: { nickname: 'Peace lily', room: null, light: 'bright', drainage: 'unknown' },
    });
    const { plantId } = await spy.mock.results[0]!.value;
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith(`/plants/${plantId}`));
  });

  it('a save that fails stays on the form and says so', async () => {
    paramsMock.current = { source: 'label_qr', labelCode: 'PL-0001' };
    const api = new FixtureApi();
    jest.spyOn(api, 'addPlant').mockRejectedValue(new Error('network'));
    await renderRoute(<SetupRoute />, api);
    await fireEvent.press(await screen.findByRole('button', { name: 'Save' }));
    expect(await screen.findByText("Couldn't save your plant. Try again.")).toBeTruthy();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('cancel goes back', async () => {
    paramsMock.current = { source: 'label_qr', labelCode: 'PL-0001' };
    await renderRoute(<SetupRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel' }));
    expect(routerMock.back).toHaveBeenCalled();
  });
});
