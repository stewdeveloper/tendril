import { act, render, renderHook, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { readAgeBlock, resetAgeBlockForTests, writeAgeBlock } from './ageBlockStore';
import { SessionProvider, useSession } from './SessionProvider';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SessionProvider>{children}</SessionProvider>
);
const setup = async () => {
  const hook = await renderHook(() => useSession(), { wrapper });
  await act(async () => {});
  return hook.result;
};

describe('SessionProvider flow', () => {
  beforeEach(() => {
    resetAgeBlockForTests();
    delete process.env.EXPO_PUBLIC_FIXTURE_SKIP_ONBOARDING;
  });
  afterAll(() => resetAgeBlockForTests());

  it('is loading until it has read the stored session, then signed out', async () => {
    function Status() {
      return <Text>{useSession().status}</Text>;
    }
    await render(
      <SessionProvider>
        <Status />
      </SessionProvider>,
    );
    // `await render` flushes effects, so the first thing a test can see is the settled state.
    expect(await screen.findByText('signed_out')).toBeTruthy();
  });

  it('signs in at once to onboarding, then onboarding completes to ready', async () => {
    const session = await setup();
    expect(session.current.status).toBe('signed_out');
    await act(() => session.current.signIn('email', 'aoife@example.com'));
    expect(session.current.status).toBe('onboarding');
    await act(() => session.current.completeOnboarding());
    expect(session.current.status).toBe('ready');
  });

  it('only completes onboarding from onboarding', async () => {
    const session = await setup();
    await act(() => session.current.completeOnboarding());
    expect(session.current.status).toBe('signed_out');
  });

  it('signing out returns to signed out', async () => {
    const session = await setup();
    await act(() => session.current.signIn('apple'));
    await act(() => session.current.completeOnboarding());
    await act(() => session.current.signOut());
    expect(session.current.status).toBe('signed_out');
  });

  it('starts ready when the fixture skips onboarding', async () => {
    process.env.EXPO_PUBLIC_FIXTURE_SKIP_ONBOARDING = '1';
    const session = await setup();
    expect(session.current.status).toBe('ready');
  });

  it('ignores the skip flag outside dev unless the fixture API is active', async () => {
    process.env.EXPO_PUBLIC_FIXTURE_SKIP_ONBOARDING = '1';
    process.env.EXPO_PUBLIC_API_MODE = 'supabase';
    const g = globalThis as { __DEV__?: boolean };
    const dev = g.__DEV__;
    try {
      g.__DEV__ = false;
      expect((await setup()).current.status).toBe('signed_out');
      g.__DEV__ = true;
      expect((await setup()).current.status).toBe('ready');
    } finally {
      g.__DEV__ = dev;
      delete process.env.EXPO_PUBLIC_API_MODE;
    }
  });

  it('never signs an age-blocked device in, and signing out keeps the block', async () => {
    const session = await setup();
    await act(() => session.current.blockForAge());
    await act(() => session.current.signIn('google'));
    expect(session.current).toMatchObject({ status: 'signed_out', ageBlocked: true });
    await act(() => session.current.signOut());
    expect(session.current.ageBlocked).toBe(true);
  });
});

describe('age block on web storage', () => {
  type G = { localStorage?: unknown };
  const store = new Map<string, string>();
  const stub = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  afterEach(() => {
    delete (globalThis as G).localStorage;
    store.clear();
    resetAgeBlockForTests();
  });

  it('writes through globalThis.localStorage and reads it back after a restart', () => {
    (globalThis as G).localStorage = stub;
    resetAgeBlockForTests();
    writeAgeBlock();
    expect(store.get('tendril.ageBlocked')).toBe('1');
    // A fresh page load: the in-memory copy is gone, the storage is not.
    resetAgeBlockForTests();
    store.set('tendril.ageBlocked', '1');
    expect(readAgeBlock()).toBe(true);
  });

  it('holds for the session when localStorage throws', () => {
    (globalThis as G).localStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    resetAgeBlockForTests();
    expect(readAgeBlock()).toBe(false);
    writeAgeBlock();
    expect(readAgeBlock()).toBe(true);
  });
});
