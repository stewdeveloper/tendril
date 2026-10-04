import { todayCopy, type LeafState } from '@tendril/core';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAppToday, useCheckIn, useProfile, useToday } from '../../../api/hooks';
import { useStartScan } from '../../../components';
import { TodayScreen, type TodayCheckIn } from '../../../screens/today/TodayScreen';

/** The open check-in sheet. The `clientId` is made once per opened sheet, so a retry reuses it. */
type Sheet = { clientId: string; plantId: string } & TodayCheckIn;

const ERROR_MS = 5000;

const newSheet = (taskId: string, plantId: string): Sheet => ({
  taskId,
  plantId,
  clientId: randomUUID(),
  sheetKey: 0,
  state: 'unanswered',
});

export default function TodayRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ checkIn?: string }>();
  const today = useToday();
  const profile = useProfile();
  const appToday = useAppToday();
  const checkIn = useCheckIn();
  const startScan = useStartScan();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [failed, setFailed] = useState(false);

  const tasks = today.data?.tasks;
  const open = (taskId: string) => {
    const task = tasks?.find((t) => t.id === taskId);
    if (!task) return;
    if (task.kind === 'check' && task.status !== 'done') {
      setFailed(false);
      setSheet(newSheet(taskId, task.plantId));
    } else {
      router.push(`/plants/${task.plantId}`);
    }
  };

  // "Check in on Monty" on Streaks (4h) arrives here asking for that task's sheet. Handled while
  // rendering, once per request, so there is no frame without the sheet.
  const wanted = params.checkIn;
  const [handled, setHandled] = useState<string | undefined>();
  if (!wanted && handled) setHandled(undefined);
  if (wanted && wanted !== handled && tasks) {
    setHandled(wanted);
    const task = tasks.find((t) => t.id === wanted);
    if (task && task.kind === 'check' && task.status !== 'done')
      setSheet(newSheet(wanted, task.plantId));
  }
  useEffect(() => {
    if (wanted) router.setParams({ checkIn: undefined });
  }, [wanted, router]);

  useEffect(() => {
    if (!failed) return;
    const timer = setTimeout(() => setFailed(false), ERROR_MS);
    return () => clearTimeout(timer);
  }, [failed]);

  const answer = async (dry: boolean, leaves: LeafState[]) => {
    if (!sheet) return;
    const { clientId, plantId } = sheet;
    try {
      const result = await checkIn.mutateAsync({
        clientId,
        plantId,
        soilDry: dry,
        leafStates: leaves,
      });
      setSheet((current) => {
        if (!current || current.clientId !== clientId) return current;
        const next = { clientId, plantId, taskId: current.taskId, sheetKey: current.sheetKey };
        const streakDays = result.streakDays;
        if (dry && !result.savedOffline)
          return {
            ...next,
            streakDays,
            state: 'answered_yes',
            nextCheckWeekday: result.nextCheckWeekday,
          };
        return {
          ...next,
          streakDays,
          state: result.savedOffline ? 'saved_offline' : 'answered_no',
          nextCheckWeekday: result.nextCheckWeekday,
        };
      });
    } catch {
      // Back to the question, as a fresh sheet so both answers work again. Same clientId, so if the
      // first attempt did reach the server the retry is not a second check-in.
      setSheet((current) =>
        current && current.clientId === clientId
          ? {
              clientId,
              plantId,
              taskId: current.taskId,
              sheetKey: (current.sheetKey ?? 0) + 1,
              state: 'unanswered',
            }
          : current,
      );
      setFailed(true);
    }
  };

  if (!today.data) return null;
  return (
    <TodayScreen
      summary={today.data}
      today={appToday}
      avatarLetter={profile.data?.displayName.charAt(0).toUpperCase() ?? ''}
      checkIn={sheet}
      error={failed ? todayCopy.checkInFailed : null}
      onOpenTask={open}
      onAnswer={answer}
      onAddPhoto={() => {}}
      onCloseCheckIn={() => setSheet(null)}
      onDone={() => setSheet(null)}
      onScan={startScan}
      onScanLabel={() => router.push('/camera?mode=label')}
      onOpenStreaks={() => router.push('/today/streaks')}
      onOpenLeague={() => router.navigate('/leagues')}
      onAvatar={() => router.push('/profile')}
    />
  );
}
