import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinkExpiredScreen } from '../../screens/onboarding/LinkExpiredScreen';

/** Where an expired or already-used sign-in link lands, with the address it was sent to. */
export default function LinkExpiredRoute() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const address = (Array.isArray(email) ? email[0] : email) ?? '';
  return (
    <LinkExpiredScreen
      email={address}
      onSendNew={() => router.replace({ pathname: '/link-sent', params: { email: address } })}
      onUseDifferent={() => router.replace('/sign-in')}
      onBack={() => router.back()}
    />
  );
}
