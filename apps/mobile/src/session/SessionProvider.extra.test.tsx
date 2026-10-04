import { act, render, renderHook, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { resetAgeBlockForTests } from './ageBlockStore';
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

  it('never signs an age-blocked device in, and signing out keeps the block', async () => {
    const session = await setup();
    await act(() => session.current.blockForAge());
    await act(() => session.current.signIn('google'));
    expect(session.current).toMatchObject({ status: 'signed_out', ageBlocked: true });
    await act(() => session.current.signOut());
    expect(session.current.ageBlocked).toBe(true);
  });
});
