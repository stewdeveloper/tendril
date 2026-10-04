import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '../session/SessionProvider';

/** `/` sends the person to wherever their session says they belong. */
export default function Index() {
  const { status, ageBlocked, destination, clearDestination } = useSession();
  // Once the redirect has been rendered the destination is spent: a later visit to `/` lands on
  // Today, not back on the first-scan camera.
  useEffect(() => {
    if (status === 'ready') clearDestination();
  }, [status, clearDestination]);
  if (status === 'ready') return <Redirect href={destination()} />;
  return <Redirect href={ageBlocked ? '/age-stop' : '/welcome'} />;
}
