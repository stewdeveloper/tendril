import { render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';
import RootLayout from './app/_layout';

// The real SafeAreaProvider renders nothing until native insets arrive.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    Stack: () => <Text>stack</Text>,
    SplashScreen: { preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() },
  };
});

const mockUseFonts = useFonts as jest.Mock;

describe('RootLayout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows nothing and keeps the splash up while fonts load', async () => {
    mockUseFonts.mockReturnValue([false, null]);
    await render(<RootLayout />);
    expect(screen.queryByText('stack')).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it('renders the app and hides the splash once fonts are loaded', async () => {
    mockUseFonts.mockReturnValue([true, null]);
    await render(<RootLayout />);
    expect(screen.getByText('stack')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('does not hang on a font error: renders the app and hides the splash', async () => {
    mockUseFonts.mockReturnValue([false, new Error('font failed')]);
    await render(<RootLayout />);
    expect(screen.getByText('stack')).toBeTruthy();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });
});
