/// <reference types="node" />
import { render, screen } from '@testing-library/react-native';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiProvider } from '../../api/ApiProvider';
import { FixtureApi, type FixtureScenario } from '../../api/fixture/FixtureApi';
import { ThemeProvider } from '../../theme';
import { resetRouterMock } from './mockRouter';

jest.mock('expo-router', () => jest.requireActual('./mockRouter').mockExpoRouter());

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

/**
 * A route is a placeholder until its file stops importing `PlaceholderScreen`. The placeholder
 * text is asserted only for those; a built screen has its own route test, which it adds when it
 * replaces the placeholder.
 */
const rendersPlaceholder = (route: string) =>
  /\bPlaceholderScreen\b.*\bfrom\b/.test(readFileSync(join(APP, `${route}.tsx`), 'utf8'));

const wrap = (ui: React.ReactElement, scenario?: FixtureScenario) =>
  render(
    <ThemeProvider scheme="light">
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
        }
      >
        <ApiProvider api={new FixtureApi({ scenario })}>{ui}</ApiProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  );

describe('route tree', () => {
  beforeEach(() => resetRouterMock());

  it.each(ROUTE_FILES)(
    'has a route file at %s, with a placeholder while it is unbuilt',
    async (route) => {
      expect(existsSync(join(APP, `${route}.tsx`))).toBe(true);
      const Screen = jest.requireActual(join(APP, route)).default;
      expect(typeof Screen).toBe('function');
      if (!rendersPlaceholder(route)) return;
      await wrap(<Screen />);
      // Tab screens read the profile for their avatar letter; a plant's page is a stack screen.
      if (/^\(tabs\)\/(?!plants\/\[id\])/.test(route))
        expect(await screen.findByText('A')).toBeTruthy();
      expect(screen.getByRole('header')).toBeTruthy();
      expect(screen.getByText(/^(Design frames: |No design frame)/)).toBeTruthy();
    },
  );

  it('detects a placeholder by its import, not by its route name', () => {
    expect(rendersPlaceholder('scan/[id]/index')).toBe(true);
    expect(rendersPlaceholder('index')).toBe(false);
    expect(rendersPlaceholder('_layout')).toBe(false);
  });

  it('sends the Scan tab on to the camera under the identification cap', async () => {
    const Scan = jest.requireActual(join(APP, '(tabs)/scan')).default;
    await wrap(<Scan />);
    expect(await screen.findByText('redirect:/camera')).toBeTruthy();
  });

  it('keeps the Scan tab on its own screen at the cap, with no redirect', async () => {
    const Scan = jest.requireActual(join(APP, '(tabs)/scan')).default;
    await wrap(<Scan />, 'limit_free');
    expect(await screen.findByText('A')).toBeTruthy();
    expect(screen.queryByText(/^redirect:/)).toBeNull();
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
