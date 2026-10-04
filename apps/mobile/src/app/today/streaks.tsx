import { useRouter } from 'expo-router';
import { useStreaks, useToday } from '../../api/hooks';
import { StreaksScreen } from '../../screens/today/StreaksScreen';

export default function StreaksRoute() {
  const router = useRouter();
  const streaks = useStreaks();
  const today = useToday();
  const due = today.data?.tasks.find((t) => t.kind === 'check' && t.status !== 'done');
  if (!streaks.data) return null;
  return (
    <StreaksScreen
      streak={streaks.data}
      checkInNickname={due?.plantNickname}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
      onInvite={() => router.push('/leagues/add-friends')}
      onCheckInFirst={() =>
        router.navigate({ pathname: '/today', params: due ? { checkIn: due.id } : {} })
      }
    />
  );
}
