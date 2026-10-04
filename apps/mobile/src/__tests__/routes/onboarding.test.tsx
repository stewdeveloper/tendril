import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';
import { ApiProvider } from '../../api/ApiProvider';
import { FixtureApi } from '../../api/fixture/FixtureApi';
import AgeRoute from '../../app/(onboarding)/age';
import FirstScanRoute from '../../app/(onboarding)/first-scan';
import HomeAreaRoute from '../../app/(onboarding)/home-area';
import LinkExpiredRoute from '../../app/(onboarding)/link-expired';
import LinkSentRoute from '../../app/(onboarding)/link-sent';
import PetsRoute from '../../app/(onboarding)/pets';
import SignInRoute from '../../app/(onboarding)/sign-in';
import WelcomeRoute from '../../app/(onboarding)/welcome';
import Index from '../../app/index';
import { SessionProvider, useSession, type Session } from '../../session/SessionProvider';
import { ThemeProvider } from '../../theme';
import { paramsMock, resetRouterMock, routerMock } from './mockRouter';

jest.mock('expo-router', () => jest.requireActual('./mockRouter').mockExpoRouter());
// The age block is stored for good, so it must not leak from one test to the next.
const mockBlockStore = { blocked: false };
jest.mock('../../session/ageBlockStore', () => ({
  readAgeBlock: () => mockBlockStore.blocked,
  writeAgeBlock: () => {
    mockBlockStore.blocked = true;
  },
}));

let session: Session;
function Probe() {
  const current = useSession();
  useEffect(() => {
    session = current;
  });
  return <Text>{`status:${current.status} blocked:${current.ageBlocked}`}</Text>;
}

const app = (api: FixtureApi, children: React.ReactNode) => (
  <ThemeProvider scheme="light">
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
    >
      <ApiProvider api={api}>
        <SessionProvider>
          <Probe />
          {children}
        </SessionProvider>
      </ApiProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

async function renderRoute(node: React.ReactNode, api = new FixtureApi()) {
  const view = await render(app(api, node));
  await screen.findByText(/status:signed_out/);
  return { api, view };
}

describe('onboarding routes', () => {
  beforeEach(() => {
    resetRouterMock();
    mockBlockStore.blocked = false;
  });

  it('welcome starts the age step', async () => {
    await renderRoute(<WelcomeRoute />);
    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));
    expect(routerMock.push).toHaveBeenCalledWith('/age');
  });

  describe('age', () => {
    // The fixture's today is 3 October 2026.
    const enter = async (year: number, month: number) => {
      await renderRoute(<AgeRoute />);
      const set = async (label: string, value: number, from: number) => {
        const column = screen.getByRole('adjustable', { name: label });
        const step = value > from ? 'increment' : 'decrement';
        for (let i = 0; i < Math.abs(value - from); i++) {
          await fireEvent(column, 'accessibilityAction', { nativeEvent: { actionName: step } });
        }
      };
      return { set, year, month };
    };

    it('lets someone clearly over the limit on to sign in', async () => {
      const { set } = await enter(2013, 9);
      // The wheel starts 25 years back (2001, June): 2013 is 12 steps forward, September 3.
      await set('Year', 2013, 2001);
      await set('Month', 9, 6);
      await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
      expect(routerMock.push).toHaveBeenCalledWith('/sign-in');
      expect(session.ageBlocked).toBe(false);
    });

    it('blocks the device in the 13th-birthday month, and only records it: the guard does the rest', async () => {
      const { set } = await enter(2013, 10);
      await set('Year', 2013, 2001);
      await set('Month', 10, 6);
      await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
      await waitFor(() => expect(session.ageBlocked).toBe(true));
      expect(routerMock.push).not.toHaveBeenCalled();
      expect(routerMock.replace).not.toHaveBeenCalled();
      expect(mockBlockStore.blocked).toBe(true);
    });
  });

  describe('sign in', () => {
    it('Google signs in and goes on to pets', async () => {
      await renderRoute(<SignInRoute />);
      await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
      await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/pets'));
      expect(session.status).toBe('onboarding');
    });

    it('email goes to the link-sent screen with the address, and does not sign in yet', async () => {
      await renderRoute(<SignInRoute />);
      await fireEvent.changeText(
        screen.getByPlaceholderText('you@example.com'),
        'aoife@example.com',
      );
      await fireEvent.press(screen.getByRole('button', { name: 'Email me a sign-in link' }));
      expect(routerMock.push).toHaveBeenCalledWith({
        pathname: '/link-sent',
        params: { email: 'aoife@example.com' },
      });
      expect(session.status).toBe('signed_out');
    });
  });

  it('link sent: Open Mail completes the fixture sign-in and goes on to pets', async () => {
    paramsMock.current = { email: 'aoife@example.com' };
    await renderRoute(<LinkSentRoute />);
    expect(screen.getByText('aoife@example.com')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Mail' }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/pets'));
    expect(session.status).toBe('onboarding');
  });

  it('link sent: Send it again confirms with a message', async () => {
    paramsMock.current = { email: 'aoife@example.com' };
    await renderRoute(<LinkSentRoute />);
    await fireEvent.press(screen.getByRole('button', { name: 'Send it again' }));
    expect(screen.getByText('Sent again. Check your email.')).toBeTruthy();
  });

  it('link expired: a new link goes back to link-sent, another address to sign-in', async () => {
    paramsMock.current = { email: 'aoife@example.com' };
    await renderRoute(<LinkExpiredRoute />);
    await fireEvent.press(screen.getByRole('button', { name: 'Send a new link' }));
    expect(routerMock.replace).toHaveBeenCalledWith({
      pathname: '/link-sent',
      params: { email: 'aoife@example.com' },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Use a different email' }));
    expect(routerMock.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('pets save through the API, then go on to the home area', async () => {
    const api = new FixtureApi();
    const savePets = jest.spyOn(api, 'savePets');
    await renderRoute(<PetsRoute />, api);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Cat' }));
    await fireEvent.changeText(screen.getByLabelText('Cat name'), 'Miso');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/home-area'));
    expect(savePets).toHaveBeenCalledWith([{ animal: 'cat', name: 'Miso' }]);
  });

  it('pets that fail to save stay put and say so', async () => {
    const api = new FixtureApi();
    jest.spyOn(api, 'savePets').mockRejectedValue(new Error('offline'));
    await renderRoute(<PetsRoute />, api);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText("Couldn't save your pets. Try again.")).toBeTruthy();
    expect(routerMock.push).not.toHaveBeenCalled();
  });

  describe('home area', () => {
    it('finds a town, then saves the area and goes to the first scan without the note', async () => {
      const api = new FixtureApi();
      const saveHomeArea = jest.spyOn(api, 'saveHomeArea');
      await renderRoute(<HomeAreaRoute />, api);
      // Nothing is picked yet, so Save does nothing.
      await fireEvent.press(screen.getByRole('button', { name: 'Save area' }));
      expect(saveHomeArea).not.toHaveBeenCalled();
      await fireEvent.changeText(screen.getByPlaceholderText('Search for a town'), 'Ballynahinch');
      await fireEvent(screen.getByDisplayValue('Ballynahinch'), 'submitEditing');
      await fireEvent.press(screen.getByRole('button', { name: 'Save area' }));
      await waitFor(() => expect(routerMock.push).toHaveBeenCalledWith('/first-scan'));
      expect(saveHomeArea).toHaveBeenCalledWith({ lat: 54.4026, lng: -5.9163, radiusM: 2000 });
    });

    it('a misspelt town shows the not-found card and cannot be saved', async () => {
      const api = new FixtureApi();
      const saveHomeArea = jest.spyOn(api, 'saveHomeArea');
      await renderRoute(<HomeAreaRoute />, api);
      await fireEvent.changeText(screen.getByPlaceholderText('Search for a town'), 'Ballynahinchh');
      await fireEvent(screen.getByDisplayValue('Ballynahinchh'), 'submitEditing');
      expect(await screen.findByText("We couldn't find that town")).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Save area' }));
      expect(saveHomeArea).not.toHaveBeenCalled();
    });

    it('Skip goes to the first scan and tells it the area was skipped', async () => {
      await renderRoute(<HomeAreaRoute />);
      await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));
      expect(routerMock.push).toHaveBeenCalledWith({
        pathname: '/first-scan',
        params: { homeArea: 'skipped' },
      });
    });
  });

  describe('first scan (G4: the real session, onboarding to ready)', () => {
    /** The destination the session holds at the moment the screen replaces the route with `/`. */
    const destinationAtReplace: string[] = [];
    beforeEach(() => {
      destinationAtReplace.length = 0;
      routerMock.replace.mockImplementation(() => destinationAtReplace.push(session.destination()));
    });

    const finishFrom = async (button: string) => {
      const { view, api } = await renderRoute(<FirstScanRoute />);
      await act(async () => session.signIn('apple'));
      expect(session.status).toBe('onboarding');
      await fireEvent.press(screen.getByRole('button', { name: button }));
      return { view, api };
    };

    it('Allow camera readies the session for the camera, and / redirects there', async () => {
      const { view, api } = await finishFrom('Allow camera');
      expect(session.status).toBe('ready');
      expect(routerMock.replace).toHaveBeenCalledWith('/');
      // The destination was stored before the navigation, not after it.
      expect(destinationAtReplace).toEqual(['/camera']);
      await view.rerender(app(api, <Index />));
      expect(await screen.findByText('redirect:/camera')).toBeTruthy();
    });

    it('Not now readies the session for Today, and / redirects there', async () => {
      const { view, api } = await finishFrom('Not now');
      expect(session.status).toBe('ready');
      expect(destinationAtReplace).toEqual(['/today']);
      await view.rerender(app(api, <Index />));
      expect(await screen.findByText('redirect:/today')).toBeTruthy();
    });

    it('shows the skipped note only when the home area was skipped', async () => {
      paramsMock.current = { homeArea: 'skipped' };
      await renderRoute(<FirstScanRoute />);
      expect(screen.getByText(/Home area skipped/)).toBeTruthy();
    });

    it('has no note when the area was saved', async () => {
      await renderRoute(<FirstScanRoute />);
      expect(screen.queryByText(/Home area skipped/)).toBeNull();
    });
  });
});
