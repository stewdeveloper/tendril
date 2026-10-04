/// <reference types="node" />
import { render, screen } from '@testing-library/react-native';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiProvider } from '../../api/ApiProvider';
import { FixtureApi } from '../../api/fixture/FixtureApi';
import { ThemeProvider } from '../../theme';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn(), canGoBack: () => true }),
}));

/** Spec §6.3's route list: one file each. */
const ROUTE_FILES = [
  '(onboarding)/welcome',
  '(onboarding)/age',
  '(onboarding)/age-stop',
  '(onboarding)/sign-in',
  '(onboarding)/link-sent',
  '(onboarding)/link-expired',
  '(onboarding)/pets',
  '(onboarding)/home-area',
  '(onboarding)/first-scan',
  '(tabs)/today/index',
  '(tabs)/plants/index',
  '(tabs)/plants/[id]/index',
  '(tabs)/scan',
  '(tabs)/collection/index',
  '(tabs)/leagues/index',
  'today/streaks',
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
];

const APP = join(__dirname, '../../app');
const wrap = (ui: React.ReactElement) =>
  render(
    <ThemeProvider scheme="light">
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
        }
      >
        <ApiProvider api={new FixtureApi()}>{ui}</ApiProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );

describe('route tree', () => {
  it.each(ROUTE_FILES)('has a placeholder screen at %s', async (route) => {
    expect(existsSync(join(APP, `${route}.tsx`))).toBe(true);
    const Screen = jest.requireActual(join(APP, route)).default;
    await wrap(<Screen />);
    // Tab screens read the profile for their avatar letter; a plant's page is a stack screen.
    if (/^\(tabs\)\/(?!plants\/\[id\])/.test(route))
      expect(await screen.findByText('A')).toBeTruthy();
    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.getByText(/^(Design frames: |No design frame)/)).toBeTruthy();
  });

  it('has the layouts, the index redirect and the catalog', () => {
    for (const f of [
      '_layout',
      '(onboarding)/_layout',
      '(tabs)/_layout',
      '(tabs)/plants/_layout',
      'index',
      'catalog/index',
    ]) {
      expect(existsSync(join(APP, `${f}.tsx`))).toBe(true);
    }
  });

  // expo-router makes a route of every file under src/app, so a test file there would ship as a screen.
  it('keeps test files out of src/app', () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [e.name],
      );
    expect(walk(APP).filter((name) => /\.(test|spec)\./.test(name))).toEqual([]);
  });
});
