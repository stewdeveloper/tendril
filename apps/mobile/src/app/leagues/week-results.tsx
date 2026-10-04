import { useRouter } from 'expo-router';
import { useWeekResult } from '../../api/hooks';
import { WeekResultsScreen } from '../../screens/leagues/WeekResultsScreen';

/** The week's result. Continue goes back to the Leagues tab, whether or not the result loaded. */
export default function WeekResultsRoute() {
  const router = useRouter();
  const week = useWeekResult();
  return (
    <WeekResultsScreen
      result={week.data ?? null}
      failed={week.isError}
      onContinue={() => router.navigate('/leagues')}
    />
  );
}
