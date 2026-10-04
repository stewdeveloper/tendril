import { useRouter } from 'expo-router';
import { Linking, Platform } from 'react-native';
import { PRIVACY_URL, TERMS_URL } from '../../lib/links';
import { useSession, type SignInMethod } from '../../session/SessionProvider';
import { SignInScreen } from '../../screens/onboarding/SignInScreen';

export default function SignInRoute() {
  const router = useRouter();
  const { signIn } = useSession();
  const continueWith = async (method: SignInMethod) => {
    await signIn(method);
    router.push('/pets');
  };
  return (
    <SignInScreen
      showApple={Platform.OS === 'ios'}
      onApple={() => void continueWith('apple')}
      onGoogle={() => void continueWith('google')}
      // The link is what signs them in: the next step is the check-your-email screen.
      onEmail={(email) => router.push({ pathname: '/link-sent', params: { email } })}
      onBack={() => router.back()}
      onTerms={() => void Linking.openURL(TERMS_URL)}
      onPrivacy={() => void Linking.openURL(PRIVACY_URL)}
    />
  );
}
