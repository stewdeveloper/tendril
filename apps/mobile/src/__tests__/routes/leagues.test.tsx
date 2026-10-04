import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { ApiProvider } from '../../api/ApiProvider';
import { FixtureApi } from '../../api/fixture/FixtureApi';
import LeaguesRoute from '../../app/(tabs)/leagues/index';
import AddFriendsRoute from '../../app/leagues/add-friends';
import WeekResultsRoute from '../../app/leagues/week-results';
import { ThemeProvider } from '../../theme';
import { resetRouterMock, routerMock } from './mockRouter';

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

beforeEach(() => {
  resetRouterMock();
  jest.restoreAllMocks();
});

describe('Leagues route', () => {
  it('shows this week from the API, with the friends board one tab away', async () => {
    await renderRoute(<LeaguesRoute />);
    expect(await screen.findByText('3 days left · resets Monday')).toBeTruthy();
    expect(screen.getByText('You · @aoifegrows')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Friends' }));
    expect(screen.getByText('@siobhanplants')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add friends' }));
    expect(routerMock.push).toHaveBeenCalledWith('/leagues/add-friends');
    await fireEvent.press(screen.getByRole('button', { name: 'Profile' }));
    expect(routerMock.push).toHaveBeenCalledWith('/profile');
  });

  it('before any points: Scan a plant starts a scan', async () => {
    await renderRoute(<LeaguesRoute />, new FixtureApi({ scenario: 'empty' }));
    expect(await screen.findByText(/^Log a find to join this week’s board/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Scan a plant' }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/camera'));
  });
});

describe('Add friends route', () => {
  const search = async (text: string) => {
    await fireEvent.changeText(await screen.findByLabelText('Handle'), text);
    await fireEvent(screen.getByLabelText('Handle'), 'submitEditing');
  };

  it('searches on submit with a normalised handle, never per keystroke', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'findHandle');
    await renderRoute(<AddFriendsRoute />, api);
    await fireEvent.changeText(await screen.findByLabelText('Handle'), '  @SiobhanPlants ');
    expect(spy).not.toHaveBeenCalled();
    await fireEvent(screen.getByLabelText('Handle'), 'submitEditing');
    await waitFor(() => expect(spy).toHaveBeenCalledWith('siobhanplants'));
    expect(await screen.findByRole('button', { name: 'Add @siobhanplants' })).toBeTruthy();
  });

  it('an empty submit searches nothing', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'findHandle');
    await renderRoute(<AddFriendsRoute />, api);
    await search('  @ ');
    expect(spy).not.toHaveBeenCalled();
  });

  it('an unknown handle says so and offers the invite', async () => {
    await renderRoute(<AddFriendsRoute />);
    await search('@nobodyhere');
    expect(
      await screen.findByText(
        'No one has that handle. Check the spelling, or send an invite link.',
      ),
    ).toBeTruthy();
  });

  it('your own handle is "That\'s you." with no Add', async () => {
    await renderRoute(<AddFriendsRoute />);
    await search('@aoifegrows');
    expect(await screen.findByText("That's you.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Add @/ })).toBeNull();
  });

  it('Add sends one request, then reads Requested', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'sendFriendRequest');
    await renderRoute(<AddFriendsRoute />, api);
    await search('@siobhanplants');
    const add = await screen.findByRole('button', { name: 'Add @siobhanplants' });
    await fireEvent.press(add);
    await fireEvent.press(add);
    expect(await screen.findByRole('button', { name: 'Requested' })).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('siobhanplants');
  });

  it('a failed request shows a snackbar and can be retried', async () => {
    const api = new FixtureApi();
    const spy = jest.spyOn(api, 'sendFriendRequest').mockRejectedValueOnce(new Error('offline'));
    await renderRoute(<AddFriendsRoute />, api);
    await search('@siobhanplants');
    await fireEvent.press(await screen.findByRole('button', { name: 'Add @siobhanplants' }));
    expect(await screen.findByText("Couldn't send that request. Try again.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add @siobhanplants' }));
    expect(await screen.findByRole('button', { name: 'Requested' })).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('Send invite link shares the link once while the sheet is open', async () => {
    const api = new FixtureApi();
    const create = jest.spyOn(api, 'createInvite');
    const share = jest.spyOn(Share, 'share').mockReturnValue(new Promise(() => {}));
    await renderRoute(<AddFriendsRoute />, api);
    const button = await screen.findByRole('button', { name: 'Send invite link' });
    await fireEvent.press(button);
    await fireEvent.press(button);
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    expect(share.mock.calls[0]![0]).toMatchObject({
      message: expect.stringContaining('https://tendril.app/i/aoife-7k2q'),
    });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('a dismissed share sheet is silent and the button works again', async () => {
    const share = jest.spyOn(Share, 'share').mockRejectedValue(new Error('dismissed'));
    await renderRoute(<AddFriendsRoute />);
    const button = await screen.findByRole('button', { name: 'Send invite link' });
    await fireEvent.press(button);
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    await fireEvent.press(button);
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Couldn't/)).toBeNull();
  });

  it('back goes to the Friends board', async () => {
    await renderRoute(<AddFriendsRoute />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Back to Friends' }));
    expect(routerMock.back).toHaveBeenCalled();
  });
});

describe('Week results route', () => {
  it('shows the rank and Continue returns to the Leagues tab', async () => {
    await renderRoute(<WeekResultsRoute />);
    expect(await screen.findByText('4th of 20')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(routerMock.navigate).toHaveBeenCalledWith('/leagues');
  });

  it('a quiet week on the empty scenario', async () => {
    await renderRoute(<WeekResultsRoute />, new FixtureApi({ scenario: 'empty' }));
    expect(await screen.findByText('A quiet week')).toBeTruthy();
  });

  it('a failed load is a calm fallback with Continue, never blank', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'getWeekResult').mockRejectedValue(new Error('offline'));
    await renderRoute(<WeekResultsRoute />, api);
    expect(await screen.findByText(/We couldn't load your week's results/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(routerMock.navigate).toHaveBeenCalledWith('/leagues');
  });
});
