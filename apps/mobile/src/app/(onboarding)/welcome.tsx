import { useRouter } from 'expo-router';
import { WelcomeScreen } from '../../screens/onboarding/WelcomeScreen';
import { useSession } from '../../session/SessionProvider';

export default function WelcomeRoute() {
  const router = useRouter();
  const { rememberDestination } = useSession();
  // Scanning a label needs an account to adopt the plant into, so it starts the same way, and
  // remembers to open the label scanner when onboarding is done.
  return (
    <WelcomeScreen
      onGetStarted={() => {
        rememberDestination(null);
        router.push('/age');
      }}
      onScanLabel={() => {
        rememberDestination('/camera?mode=label');
        router.push('/age');
      }}
    />
  );
}
