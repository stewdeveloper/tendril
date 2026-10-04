import { render, screen } from '@testing-library/react-native';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import RootLayout from '../../app/_layout';
import { useSession, type SessionStatus } from '../../session/SessionProvider';

// The real SafeAreaProvider renders nothing until native insets arrive.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
// A stack that lists the screens it is given, and drops those behind a closed guard.
jest.mock('expo-router', () => ({
  ...jest.requireActual('./mockRouter').mockExpoRouter(),
  SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
}));
// The session's own behaviour is tested in SessionProvider.test; here the status is set directly.
jest.mock('../../session/SessionProvider', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: jest.fn(),
}));

const mockUseFonts = useFonts as jest.Mock;
const mockUseSession = useSession as jest.Mock;
const withStatus = (status: SessionStatus) => mockUseSession.mockReturnValue({ status });

const APP = join(__dirname, '../../app');
/** Every route file in src/app, named as the root navigator names it. */
function routeNames(dir = APP): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return routeNames(path);
    if (!entry.name.endsWith('.tsx') || entry.name.startsWith('_layout')) return [];
    return [relative(APP, path).replace(/\.tsx$/, '')];
  });
}
const shownScreens = () =>
  screen.queryAllByText(/^screen:/).map((n) => String(n.props.children).slice(7));

describe('RootLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFonts.mockReturnValue([true, null]);
    withStatus('signed_out');
  });

  it('shows nothing and keeps the splash up while fonts load', async () => {
    mockUseFonts.mockReturnValue([false, null]);
    await render(<RootLayout />);
    expect(shownScreens()).toEqual([]);
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('keeps the splash up while the session loads', async () => {
    withStatus('loading');
    await render(<RootLayout />);
    expect(shownScreens()).toEqual([]);
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('does not hang on a font error: renders the app and hides the splash', async () => {
    mockUseFonts.mockReturnValue([false, new Error('font failed')]);
    await render(<RootLayout />);
    expect(shownScreens()).toEqual(['(onboarding)']);
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it.each<SessionStatus>(['signed_out', 'onboarding'])(
    'shows only onboarding when %s, and hides the splash',
    async (status) => {
      withStatus(status);
      await render(<RootLayout />);
      expect(shownScreens()).toEqual(['(onboarding)']);
      expect(SplashScreen.hideAsync).toHaveBeenCalled();
    },
  );

  it('shows the tabs and every app screen, and no onboarding, once ready', async () => {
    withStatus('ready');
    await render(<RootLayout />);
    const shown = shownScreens();
    expect(shown).toContain('(tabs)');
    expect(shown).not.toContain('(onboarding)');
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('guards exactly the route files that are not onboarding, the index redirect or the catalog', async () => {
    withStatus('ready');
    await render(<RootLayout />);
    const files = routeNames();
    const guarded = files.filter(
      (f) =>
        !f.startsWith('(onboarding)/') &&
        !f.startsWith('(tabs)/') &&
        !f.startsWith('catalog/') &&
        f !== 'index',
    );
    expect(shownScreens().sort()).toEqual(['(tabs)', ...guarded].sort());
  });
});
