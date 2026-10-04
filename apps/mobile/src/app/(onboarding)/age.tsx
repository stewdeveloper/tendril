import { useRouter } from 'expo-router';
import { isAtLeast13 } from '@tendril/core';
import { useAppToday } from '../../api/hooks';
import { useSession } from '../../session/SessionProvider';
import { AgeScreen } from '../../screens/onboarding/AgeScreen';

/**
 * Month and year of birth. Under the limit, the screen only records that the device is blocked: the
 * onboarding layout's guard then removes every screen but the stop, so there is nothing to
 * navigate to and no way back. The date itself is never stored.
 */
export default function AgeRoute() {
  const router = useRouter();
  const { blockForAge } = useSession();
  const today = useAppToday();
  const now = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  return (
    <AgeScreen
      maxYear={now.year}
      onBack={() => router.back()}
      onContinue={(birth) => {
        if (isAtLeast13(birth, now)) router.push('/sign-in');
        else blockForAge();
      }}
    />
  );
}
