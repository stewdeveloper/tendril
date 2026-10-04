import { useRouter } from 'expo-router';
import { WelcomeScreen } from '../../screens/onboarding/WelcomeScreen';

export default function WelcomeRoute() {
  const router = useRouter();
  // Scanning a label needs an account to adopt the plant into, so it starts the same way.
  return (
    <WelcomeScreen
      onGetStarted={() => router.push('/age')}
      onScanLabel={() => router.push('/age')}
    />
  );
}
