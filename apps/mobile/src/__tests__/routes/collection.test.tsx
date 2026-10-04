import { aoife, type FindListItem } from '@tendril/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking, Share } from 'react-native';
import { ApiProvider } from '../../api/ApiProvider';
import { FixtureApi } from '../../api/fixture/FixtureApi';
import CollectionRoute from '../../app/(tabs)/collection/index';
import SpeciesCardRoute from '../../app/collection/species/[id]';
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

const granted = { granted: true, status: 'granted', canAskAgain: true };
const denied = { granted: false, status: 'denied', canAskAgain: false };

beforeEach(() => {
  resetRouterMock();
  resetLocationMock();
  resetLocationPrimer();
  jest.restoreAllMocks();
});

describe('Collection route', () => {
  it('shows the Plantdex from the API, with the avatar letter', async () => {
    await renderRoute(<CollectionRoute />);
    expect(await screen.findByText('All · 37')).toBeTruthy();
    expect(screen.getAllByText('Foxglove').length).toBeGreaterThan(0);
    expect(screen.getByText('A')).toBeTruthy();
  });

  it('a filter refetches the Plantdex for that filter', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'getPlantdex');
    await renderRoute(<CollectionRoute />, api);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Wild · 16' }));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('wild'));
  });

  it('a tile opens its species card, the avatar opens the profile, Scan a plant scans', async () => {
    await renderRoute(<CollectionRoute />, new FixtureApi({ scenario: 'empty' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Scan a plant' }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/camera'));
    await fireEvent.press(screen.getByRole('button', { name: 'Profile' }));
    expect(routerMock.push).toHaveBeenCalledWith('/profile');
  });

  it('a found tile opens its species card', async () => {
    await renderRoute(<CollectionRoute />);
    await screen.findByText('All · 37');
    await fireEvent.press(screen.getAllByText('Bluebell')[0]!);
    expect(routerMock.push).toHaveBeenCalledWith('/collection/species/bluebell');
  });

  it('after a saved find: shows "Find saved" and clears the param', async () => {
    paramsMock.current = { saved: '1' };
    await renderRoute(<CollectionRoute />);
    expect(await screen.findByText('Find saved')).toBeTruthy();
    expect(routerMock.setParams).toHaveBeenCalledWith({ saved: undefined });
  });

  it('shows no snackbar without the param', async () => {
    await renderRoute(<CollectionRoute />);
    await screen.findByText('All · 37');
    expect(screen.queryByText('Find saved')).toBeNull();
  });

  it('"See finds on the map" arrives on the Map segment', async () => {
    paramsMock.current = { segment: 'map' };
    getForegroundPermissionsAsync.mockResolvedValue(granted);
    await renderRoute(<CollectionRoute />);
    expect(await screen.findByText(/^Only you see exact pins/)).toBeTruthy();
    expect(routerMock.setParams).toHaveBeenCalledWith({ segment: undefined });
  });

  describe('Map and location', () => {
    const openMap = async (api = new FixtureApi()) => {
      await renderRoute(<CollectionRoute />, api);
      await fireEvent.press(await screen.findByRole('tab', { name: 'Map' }));
    };

    it('without permission: the list, and Turn on location asks after the primer', async () => {
      await openMap();
      expect(
        await screen.findByText('Location is off, so your finds show as a list.'),
      ).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Turn on location' }));
      expect(await screen.findByText('Use your location')).toBeTruthy();
      getForegroundPermissionsAsync.mockResolvedValue(granted);
      await fireEvent.press(screen.getByRole('button', { name: 'Allow location' }));
      expect(await screen.findByText(/^Only you see exact pins/)).toBeTruthy();
      expect(requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    });

    it('with permission: the map, with no list-only note', async () => {
      getForegroundPermissionsAsync.mockResolvedValue(granted);
      await openMap();
      expect(await screen.findByText(/^Only you see exact pins/)).toBeTruthy();
      expect(screen.queryByText('Location is off, so your finds show as a list.')).toBeNull();
    });

    it('when the system will not ask again, Turn on location opens settings', async () => {
      const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
      getForegroundPermissionsAsync.mockResolvedValue(denied);
      await openMap();
      await fireEvent.press(await screen.findByRole('button', { name: 'Turn on location' }));
      await waitFor(() => expect(openSettings).toHaveBeenCalled());
      expect(requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('a sensitive find shows "Location private" and gets no pin', async () => {
      const hidden: FindListItem = {
        observationId: 'obs-orchid',
        species: aoife.species['early-purple-orchid']!,
        placeType: 'wild',
        foundOn: '2026-10-01',
        lat: 53.1,
        lng: -6.1,
      };
      const api = new FixtureApi();
      jest.spyOn(api, 'getFinds').mockResolvedValue([hidden, ...aoife.finds]);
      getForegroundPermissionsAsync.mockResolvedValue(granted);
      await openMap(api);
      expect(await screen.findByText('Location private')).toBeTruthy();
      expect(screen.getByText('Early purple orchid')).toBeTruthy();
      expect(screen.queryByTestId('find-pin-obs-orchid')).toBeNull();
      expect(screen.getByTestId('find-pin-obs-find-foxglove')).toBeTruthy();
    });
  });

  describe('Badges', () => {
    it('Share a badge shares the latest earned badge, and a dismissed sheet is not an error', async () => {
      const share = jest.spyOn(Share, 'share').mockRejectedValue(new Error('dismissed'));
      await renderRoute(<CollectionRoute />);
      await fireEvent.press(await screen.findByRole('tab', { name: 'Badges' }));
      await fireEvent.press(await screen.findByRole('button', { name: 'Share a badge' }));
      expect(share).toHaveBeenCalledWith({
        message: 'I earned the Hedgerow half badge in Tendril.',
      });
    });
  });
});

describe('Species card route', () => {
  const open = (id: string) => {
    paramsMock.current = { id };
  };

  it('shows the card from the API', async () => {
    open('bluebell');
    await renderRoute(<SpeciesCardRoute />);
    expect(await screen.findByText('Hyacinthoides non-scripta')).toBeTruthy();
    expect(screen.getByText('Cats: Unknown')).toBeTruthy();
  });

  it('See finds on the map goes to the Collection map', async () => {
    open('bluebell');
    await renderRoute(<SpeciesCardRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'See finds on the map' }));
    expect(routerMock.navigate).toHaveBeenCalledWith('/collection?segment=map');
  });

  it('a sensitive species has no map link', async () => {
    open('early-purple-orchid');
    await renderRoute(<SpeciesCardRoute />);
    expect(await screen.findByText('Orchis mascula')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'See finds on the map' })).toBeNull();
  });

  it('My pet ate this opens the emergency with the species and no match', async () => {
    open('bluebell');
    await renderRoute(<SpeciesCardRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'My pet ate this' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Miso' }));
    expect(routerMock.push).toHaveBeenCalledWith({
      pathname: '/pet-emergency',
      params: { petId: 'pet-miso', speciesId: 'bluebell' },
    });
  });

  it('Back goes back, or to the Collection when there is nothing to go back to', async () => {
    open('bluebell');
    routerMock.canGoBack.mockReturnValue(false);
    await renderRoute(<SpeciesCardRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Back' }));
    expect(routerMock.replace).toHaveBeenCalledWith('/collection');
  });

  it('an unknown species goes back to the Collection', async () => {
    open('nope');
    await renderRoute(<SpeciesCardRoute />);
    expect(await screen.findByText('redirect:/collection')).toBeTruthy();
  });
});
