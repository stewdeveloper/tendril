import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession } from '../../session/SessionProvider';
import { FirstScanScreen } from '../../screens/onboarding/FirstScanScreen';

/**
 * The last step. Finishing onboarding makes the session ready, which swaps the onboarding screens
 * for the app, so the navigation goes through `/`: it sends a ready session to the destination
 * stored here, the camera for "Allow camera" and Today for "Not now".
 */
export default function FirstScanRoute() {
  const router = useRouter();
  const { homeArea } = useLocalSearchParams<{ homeArea?: string }>();
  const { completeOnboarding } = useSession();
  const finish = (then: '/camera' | '/today') => {
    completeOnboarding(then);
    router.replace('/');
  };
  return (
    <FirstScanScreen
      homeAreaSkipped={homeArea === 'skipped'}
      onAllowCamera={() => finish('/camera')}
      onNotNow={() => finish('/today')}
      onBack={() => router.back()}
    />
  );
}
