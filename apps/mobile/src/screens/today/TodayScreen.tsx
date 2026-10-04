import {
  allDoneToday,
  formatResetDate,
  freezeUsed,
  freezesHeldLine,
  leaguePointsLine,
  ordinal,
  quotaLeft,
  streakBroken,
  streakLastDay,
  taskDoneTitle,
  todayCopy,
  type IsoDate,
  type LeafState,
  type TodaySummary,
} from '@tendril/core';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  CheckInSheet,
  EmptyState,
  Note,
  QuotaMeter,
  RowsCard,
  ScreenHeader,
  Snackbar,
  StreakCounter,
  TaskRow,
  TrophyIcon,
  type CheckInSheetProps,
  type Row,
  type StreakState,
} from '../../components';
import { daysBetween, weekdayName } from '../../components/dates';
import { taskSubtitle } from '../../components/TaskRow';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';

/**
 * The check-in sheet as the screen is told about it: which task, and the sheet's own state. It
 * mirrors `CheckInSheetProps`, so a state that names the next check cannot be drawn without it.
 * `sheetKey` is bumped to start a fresh sheet (the answer latch clears) after a failed save.
 */
export type TodayCheckIn = {
  taskId: string;
  sheetKey?: number;
  streakDays?: number;
} & (
  | { state: 'unanswered'; nextCheckWeekday?: string }
  | { state: 'answered_yes'; nextCheckWeekday?: string; offline?: boolean }
  | { state: 'answered_no' | 'saved_offline'; nextCheckWeekday: string }
);

export interface TodayScreenProps {
  summary: TodaySummary;
  /** The calendar date "yesterday" and "tomorrow" are counted from. */
  today: IsoDate;
  avatarLetter: string;
  /** Null when no sheet is open. */
  checkIn: TodayCheckIn | null;
  /** A transient error line (a check-in that did not save). */
  error?: string | null;
  onOpenTask: (taskId: string) => void;
  onAnswer: (dry: boolean, leaves: LeafState[]) => void;
  onAddPhoto: () => void;
  onCloseCheckIn: () => void;
  onDone: () => void;
  onScan: () => void;
  onScanLabel: () => void;
  onOpenStreaks: () => void;
  onOpenLeague: () => void;
  onAvatar: () => void;
}

/** "Spidey, tomorrow": when the next check is, as a word. */
function whenWord(on: IsoDate, today: IsoDate): string {
  const ahead = daysBetween(today, on);
  if (ahead === 0) return 'today';
  if (ahead === 1) return 'tomorrow';
  return weekdayName(on) ?? on;
}

/** The line under the streak tiles: the nudge on the last day, or what a freeze or a break meant. */
function streakLine(streak: TodaySummary['streak']): string | null {
  switch (streak.careState) {
    case 'last_day':
      return streakLastDay(streak.careDays);
    case 'freeze_used':
      return freezeUsed(streak.careDays);
    case 'broken':
      return streak.lastBrokenLength != null ? streakBroken(streak.lastBrokenLength) : null;
    default:
      return null;
  }
}

const careState = (s: TodaySummary['streak']): StreakState =>
  s.careState === 'broken' ? 'broken' : s.careState === 'freeze_used' ? 'freeze_used' : 'active';

/**
 * Today (2e, 4a, 4b, and 4c to 4e behind the check-in sheet): what needs a check, both streaks, the
 * league and the identifications left. With no plants it offers the two ways to add one; with
 * everything done it settles into a short list. Props only: the route wires the hooks.
 */
export function TodayScreen(props: TodayScreenProps) {
  const { summary, checkIn, error } = props;
  const { c } = useTheme();
  const insets = useInsets();
  const allDone = summary.hasPlants && summary.tasks.every((t) => t.status === 'done');
  const mode = !summary.hasPlants ? 'empty' : allDone ? 'done' : 'full';
  const gap = mode === 'full' ? 20 : 18;

  const sheetTask = checkIn ? summary.tasks.find((t) => t.id === checkIn.taskId) : undefined;

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { gap, paddingTop: insets.top + 8, paddingBottom: mode === 'full' ? 32 : 24 },
        ]}
      >
        <ScreenHeader
          title={todayCopy.today}
          subtitle={mode === 'full' ? summary.dateLabel : undefined}
          avatarLetter={props.avatarLetter}
          onAvatarPress={props.onAvatar}
        />
        {mode === 'empty' ? <Empty {...props} /> : null}
        {mode === 'done' ? <AllDone {...props} /> : null}
        {mode === 'full' ? <Full {...props} /> : null}
      </ScrollView>
      {error ? <Snackbar text={error} withTabBar /> : null}
      {checkIn && sheetTask ? (
        <Sheet
          key={checkIn.sheetKey ?? 0}
          {...props}
          checkIn={checkIn}
          nickname={sheetTask.plantNickname}
        />
      ) : null}
    </View>
  );
}

function Sheet({
  checkIn,
  nickname,
  onAnswer,
  onAddPhoto,
  onCloseCheckIn,
  onDone,
}: TodayScreenProps & { checkIn: TodayCheckIn; nickname: string }) {
  const shared = {
    visible: true,
    plantNickname: nickname,
    onAnswer,
    onAddPhoto,
    onClose: onCloseCheckIn,
    onDone,
  };
  // `taskId` and `sheetKey` ride along; the sheet ignores them.
  const sheet: CheckInSheetProps = { ...shared, ...checkIn };
  return <CheckInSheet {...sheet} />;
}

function Empty({ summary, onScan, onScanLabel }: TodayScreenProps) {
  return (
    <>
      <QuotaMeter quota={summary.identifications} variant="bar" />
      <EmptyState text={todayCopy.emptyLine} />
      {/* The frame pulls the buttons 8 pt closer to the sentence than the page's 18 pt rhythm. */}
      <View style={styles.actions}>
        <Button label={todayCopy.scanPlant} onPress={onScan} />
        <Button label={todayCopy.scanLabel} variant="secondary" onPress={onScanLabel} />
      </View>
    </>
  );
}

/** Both streaks, one press target for Streaks. */
function StreakTiles({
  summary,
  onOpenStreaks,
}: Pick<TodayScreenProps, 'summary' | 'onOpenStreaks'>) {
  const { streak } = summary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Streaks. ${streak.careDays} ${todayCopy.careStreakLabel}, ${streak.discoveryWeeks} ${todayCopy.discoveryStreakLabel}`}
      onPress={onOpenStreaks}
      style={styles.tiles}
    >
      <StreakCounter
        days={streak.careDays}
        label={todayCopy.careStreakLabel}
        state={careState(streak)}
        style={styles.flex}
      />
      <StreakCounter
        days={streak.discoveryWeeks}
        label={todayCopy.discoveryStreakLabel}
        state={streak.winterMode ? 'winter' : 'active'}
        style={styles.flex}
      />
    </Pressable>
  );
}

function Full(props: TodayScreenProps) {
  const { summary, today, onOpenTask, onOpenLeague } = props;
  const { c } = useTheme();
  const { streak, league } = summary;
  const line = streakLine(streak);
  const held = streak.freezesHeld > 0 ? freezesHeldLine(streak.freezesHeld) : null;
  return (
    <>
      <View style={styles.streaks}>
        <StreakTiles summary={summary} onOpenStreaks={props.onOpenStreaks} />
        {line || held ? (
          <View style={styles.streakLine}>
            <AppText variant="caption" color="textSecondary" style={styles.flex}>
              {line ?? ''}
            </AppText>
            {held ? (
              <AppText variant="caption" color="textSecondary">
                {held}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>
      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          {todayCopy.dueToday}
        </AppText>
        <Card padding={0}>
          <View style={styles.taskCard}>
            {summary.tasks.map((task, i) => {
              const checkNow =
                task.kind === 'check' && task.status === 'due' && task.dueOn <= today;
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={today}
                  last={i === summary.tasks.length - 1}
                  onPress={() => onOpenTask(task.id)}
                  primaryAction={
                    checkNow
                      ? { label: todayCopy.checkIn, onPress: () => onOpenTask(task.id) }
                      : undefined
                  }
                />
              );
            })}
          </View>
        </Card>
      </View>
      <View style={styles.tiles}>
        {league ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${todayCopy.league}, ${ordinal(league.rank)} of ${league.of}`}
            onPress={onOpenLeague}
            style={styles.flex}
          >
            <Card padding={14} gap={6}>
              <View style={styles.tileHeading}>
                <TrophyIcon size={18} color={c.primary} />
                <AppText variant="caption" color="textSecondary">
                  {todayCopy.league}
                </AppText>
              </View>
              <AppText variant="heading">{`${ordinal(league.rank)} of ${league.of}`}</AppText>
              <AppText variant="caption" color="textSecondary">
                {leaguePointsLine(league.points, league.daysLeft)}
              </AppText>
            </Card>
          </Pressable>
        ) : null}
        <QuotaMeter quota={summary.identifications} variant="card" style={styles.flex} />
      </View>
    </>
  );
}

function AllDone(props: TodayScreenProps) {
  const { summary, today, onOpenTask, onOpenLeague } = props;
  const { league, nextCheck } = summary;
  const taskRows: Row[] = summary.tasks.map((t) => ({
    key: t.id,
    title: taskDoneTitle(t.kind, t.plantNickname),
    subtitle: taskSubtitle(t, today),
    onPress: () => onOpenTask(t.id),
  }));
  const tiles: Row[] = [];
  if (league)
    tiles.push({
      key: 'league',
      title: todayCopy.league,
      subtitle: leaguePointsLine(league.points, league.daysLeft),
      right: `${ordinal(league.rank)} of ${league.of}`,
      onPress: onOpenLeague,
    });
  tiles.push({
    key: 'identifications',
    title: todayCopy.identifications,
    subtitle: `Resets ${formatResetDate(summary.identifications.resetsOn)}`,
    right: `${quotaLeft(summary.identifications)} of ${summary.identifications.limit} left`,
  });
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Streaks. ${summary.streak.careDays} ${todayCopy.careStreakLabel}`}
        onPress={props.onOpenStreaks}
        style={styles.self}
      >
        <StreakCounter
          size="stat"
          days={summary.streak.careDays}
          label={todayCopy.careStreakLabel}
          state={careState(summary.streak)}
        />
      </Pressable>
      {taskRows.length > 0 ? (
        <>
          <AppText variant="heading" accessibilityRole="header" style={styles.pulled}>
            {todayCopy.today}
          </AppText>
          <RowsCard rows={taskRows} />
        </>
      ) : null}
      <Note
        text={allDoneToday(
          nextCheck
            ? { plantNickname: nextCheck.plantNickname, when: whenWord(nextCheck.on, today) }
            : undefined,
        )}
      />
      <RowsCard rows={tiles} />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
  flex: { flex: 1 },
  self: { alignSelf: 'flex-start' },
  actions: { gap: 10, marginTop: -8 },
  tiles: { flexDirection: 'row', gap: 8 },
  streaks: { gap: 8 },
  streakLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
  },
  section: { gap: 12 },
  taskCard: { paddingVertical: 4, paddingHorizontal: 14 },
  tileHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // The heading hugs the card below it, as in the frame.
  pulled: { marginBottom: -6 },
});
