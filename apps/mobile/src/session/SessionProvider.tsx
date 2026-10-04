import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { readAgeBlock, writeAgeBlock } from './ageBlockStore';

export type SessionStatus = 'loading' | 'signed_out' | 'onboarding' | 'ready';
export type SignInMethod = 'apple' | 'google' | 'email';

/** Where a ready session lands after onboarding: the camera for a first scan, otherwise Today. */
export type Destination = '/camera' | '/today';

export interface Session {
  status: SessionStatus;
  /** True once the person has said they're under 13. Persisted: it survives restarts. */
  ageBlocked: boolean;
  signIn(method: SignInMethod, email?: string): Promise<void>;
  /** Finishes onboarding and remembers where `/` should send the person next (default Today). */
  completeOnboarding(then?: Destination): void;
  /** Where `/` sends a ready session. Reading it changes nothing; `clearDestination` resets it. */
  destination(): Destination;
  clearDestination(): void;
  blockForAge(): void;
  signOut(): void;
}

const SessionContext = createContext<Session | null>(null);

/**
 * What survives between launches. Async because Phase 2's Supabase session restore will be, so
 * every caller already waits for it.
 */
function skipsOnboarding(): boolean {
  if (process.env.EXPO_PUBLIC_FIXTURE_SKIP_ONBOARDING !== '1') return false;
  const fixtureApi = process.env.EXPO_PUBLIC_API_MODE !== 'supabase';
  return __DEV__ || fixtureApi;
}

async function restoreSession(): Promise<{ status: SessionStatus; ageBlocked: boolean }> {
  return {
    ageBlocked: readAgeBlock(),
    // Dev and catalog runs skip onboarding and start with the app open. A release build on the
    // real backend never honours the flag, even if it was baked in by mistake.
    status: skipsOnboarding() ? 'ready' : 'signed_out',
  };
}

/**
 * Where the session stands. In fixture mode a sign-in succeeds at once and leads to onboarding;
 * Phase 2 swaps the internals for Supabase auth and its async session restore, which is why a
 * session starts `loading` (the splash screen stays up until it settles).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [ageBlocked, setAgeBlocked] = useState(false);
  // A ref, not state: it is read when `/` renders and cleared afterwards, and neither may re-render.
  const destinationRef = useRef<Destination>('/today');
  const statusRef = useRef(status);
  statusRef.current = status;

  useEffect(() => {
    let cancelled = false;
    void restoreSession().then((restored) => {
      if (cancelled) return;
      setAgeBlocked(restored.ageBlocked);
      setStatus(restored.status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(
    async (_method: SignInMethod, _email?: string) => {
      // An age-blocked device never signs in, whatever the screens do.
      if (ageBlocked) return;
      setStatus((s) => (s === 'signed_out' ? 'onboarding' : s));
    },
    [ageBlocked],
  );
  const completeOnboarding = useCallback((then: Destination = '/today') => {
    if (statusRef.current !== 'onboarding') return;
    destinationRef.current = then;
    setStatus('ready');
  }, []);
  const destination = useCallback(() => destinationRef.current, []);
  const clearDestination = useCallback(() => {
    destinationRef.current = '/today';
  }, []);
  const blockForAge = useCallback(() => {
    writeAgeBlock();
    setAgeBlocked(true);
  }, []);
  const signOut = useCallback(() => {
    destinationRef.current = '/today';
    setStatus('signed_out');
  }, []);

  const value = useMemo<Session>(
    () => ({
      status,
      ageBlocked,
      signIn,
      completeOnboarding,
      destination,
      clearDestination,
      blockForAge,
      signOut,
    }),
    [
      status,
      ageBlocked,
      signIn,
      completeOnboarding,
      destination,
      clearDestination,
      blockForAge,
      signOut,
    ],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
