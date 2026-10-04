import { Redirect } from 'expo-router';
import { useQuota } from '../../api/hooks';
import { PlaceholderScreen } from '../../screens/PlaceholderScreen';

/**
 * The Scan tab's own screen is only ever reached at the identification cap (the tab button goes
 * to the camera otherwise, see `useStartScan`), where it shows "Limit reached". Reached under the
 * cap, for example from a deep link, it sends the person on to the camera.
 */
export default function ScanScreen() {
  const quota = useQuota('identification').data;
  if (quota && quota.used < quota.limit) return <Redirect href="/camera" />;
  return <PlaceholderScreen title="Scan" frames="4af, 4ag" kind="tab" />;
}
