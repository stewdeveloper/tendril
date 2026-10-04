import { Redirect, useRouter } from 'expo-router';
import { useProfile, useQuota } from '../../api/hooks';
import { useScreenFocused } from '../../lib/useScreenFocused';
import { LimitSheet } from '../../screens/scan/LimitSheet';
import { ScanTabScreen } from '../../screens/scan/ScanTabScreen';

/**
 * The Scan tab's own screen is only ever reached at the identification cap (the tab button goes
 * to the camera otherwise, see `useStartScan`), where it shows the Scan header under "Limit
 * reached" (4af, 4ag). Reached under the cap, for example from a deep link, it sends the person
 * on to the camera.
 */
export default function ScanScreen() {
  const router = useRouter();
  const quota = useQuota('identification').data;
  const profile = useProfile();
  // The sheet belongs to the visit: a tab stays mounted, so it must not linger once the person
  // has gone to another tab.
  const focused = useScreenFocused();
  if (!quota) return null;
  if (quota.used < quota.limit) return <Redirect href="/camera" />;
  return (
    <>
      <ScanTabScreen
        avatarLetter={profile.data?.displayName.charAt(0).toUpperCase() ?? ''}
        onAvatar={() => router.push('/profile')}
      />
      <LimitSheet
        visible={focused}
        quota={quota}
        onTryPremium={() => router.push('/paywall')}
        onClose={() => router.navigate('/today')}
      />
    </>
  );
}
