import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { readAgeBlock, writeAgeBlock } from './ageBlockStore';

export type SessionStatus = 'loading' | 'signed_out' | 'onboarding' | 'ready';
export type SignInMethod = 'apple' | 'google' | 'email';

export interface Session {
  status: SessionStatus;
  /** True once the person has said they're under 13. Persisted: it survives restarts. */
  ageBlocked: boolean;
  signIn(method: SignInMethod, email?: string): Promise<void>;
  completeOnboarding(): void;
  blockForAge(): void;
  signOut(): void;
}

const SessionContext = createContext<Session | null>(null);

/**
 * What survives between launches. Async because Phase 2's Supabase session restore will be, so
 * every caller already waits for it.
 */
async function restoreSession(): Promise<{ status: SessionStatus; ageBlocked: boolean }> {
  return {
    ageBlocked: readAgeBlock(),
    // Dev and catalog runs skip onboarding and start with the app open.
    status: process.env.EXPO_PUBLIC_FIXTURE_SKIP_ONBOARDING === '1' ? 'ready' : 'signed_out',
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
  const completeOnboarding = useCallback(() => {
    setStatus((s) => (s === 'onboarding' ? 'ready' : s));
  }, []);
  const blockForAge = useCallback(() => {
    writeAgeBlock();
    setAgeBlocked(true);
  }, []);
  const signOut = useCallback(() => setStatus('signed_out'), []);

  const value = useMemo<Session>(
    () => ({ status, ageBlocked, signIn, completeOnboarding, blockForAge, signOut }),
    [status, ageBlocked, signIn, completeOnboarding, blockForAge, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
