import { onboardingCopy } from '@tendril/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { Snackbar } from '../../components';
import { useSession } from '../../session/SessionProvider';
import { LinkSentScreen } from '../../screens/onboarding/LinkSentScreen';

const FIRST = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default function LinkSentRoute() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const { signIn } = useSession();
  const [resent, setResent] = useState(false);
  useEffect(() => {
    if (!resent) return;
    const timer = setTimeout(() => setResent(false), 3000);
    return () => clearTimeout(timer);
  }, [resent]);
  const address = FIRST(email);
  const openMail = async () => {
    // Phase 2B Task 8: in supabase mode the sign-in link is sent by the backend (signIn('email')).
    if (process.env.EXPO_PUBLIC_API_MODE !== 'supabase') {
      // The fixture has no inbox: opening the mail app stands in for tapping the link in it.
      await signIn('email', address);
      router.push('/pets');
      return;
    }
    try {
      await Linking.openURL('message://');
    } catch {
      // No mail app to open: the link is still in their inbox.
    }
  };
  return (
    <>
      <LinkSentScreen
        email={address}
        onOpenMail={() => void openMail()}
        // Phase 2B Task 8: "Send it again" asks the backend for a fresh link here.
        onResend={() => setResent(true)}
        onBack={() => router.back()}
      />
      {resent ? <Snackbar text={onboardingCopy.linkResent} /> : null}
    </>
  );
}
