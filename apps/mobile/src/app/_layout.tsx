import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ApiProvider } from '../api/ApiProvider';
import { createApi } from '../api/createApi';
import { SessionProvider, useSession } from '../session/SessionProvider';
import { fontMap, ThemeProvider, useTheme } from '../theme';

SplashScreen.preventAutoHideAsync();

const api = createApi();
// The fixture API fails fast and on purpose (the error scenarios), so a failed query isn't retried.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

/**
 * Every route behind the `ready` guard: the tabs and each screen the tabs open. The rest of the
 * tree is not listed on purpose. `index` redirects, and `catalog` guards itself with
 * `catalogEnabled`, so it stays reachable at any point in the session.
 */
const APP_ROUTES = [
  '(tabs)',
  'plants/[id]/index',
  'plants/[id]/diagnosis',
  'plants/setup',
  'l/[code]',
  'camera',
  'scan/[id]/index',
  'scan/[id]/new-species',
  'collection/species/[id]',
  'collection/sets/[id]/complete',
  'leagues/add-friends',
  'leagues/week-results',
  'profile/index',
  'profile/public',
  'settings/index',
  'settings/household',
  'settings/home-area',
  'settings/notifications',
  'settings/account',
  'settings/delete-account',
  'paywall',
  'pet-emergency',
  'auth/callback',
] as const;

export default function RootLayout() {
  const [loaded, error] = useFonts(fontMap);
  // A font failure must not hang the app on the splash: fall back to system fonts.
  const fontsReady = loaded || error != null;
  if (!fontsReady) return null;
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ApiProvider api={api}>
            <SessionProvider>
              <RootStack />
            </SessionProvider>
          </ApiProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootStack() {
  const { status } = useSession();
  const { c } = useTheme();
  const loading = status === 'loading';
  // The splash stays up until fonts (above) and the session have both settled.
  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);
  if (loading) return null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
      <Stack.Protected guard={status === 'signed_out' || status === 'onboarding'}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'ready'}>
        {APP_ROUTES.map((name) => (
          <Stack.Screen key={name} name={name} />
        ))}
      </Stack.Protected>
    </Stack>
  );
}
