import { Redirect } from 'expo-router';
import { useSession } from '../session/SessionProvider';

/** `/` sends the person to wherever their session says they belong. */
export default function Index() {
  const { status, ageBlocked } = useSession();
  if (status === 'ready') return <Redirect href="/today" />;
  return <Redirect href={ageBlocked ? '/age-stop' : '/welcome'} />;
}
