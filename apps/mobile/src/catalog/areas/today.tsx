import { aoife, type DayMark, type StreakSummary, type TodaySummary } from '@tendril/core';
import { FIXTURE_TODAY } from '../../api/fixtureDate';
import { CheckInSheet, type CheckInSheetProps } from '../../components';
import { StreaksScreen } from '../../screens/today/StreaksScreen';
import { TodayScreen } from '../../screens/today/TodayScreen';
import { registerFrame } from '../registry';
import { TabScreenFrame } from '../TabScreenFrame';

/** Frames 2e and 4a to 4h: Today, the check-in sheet over it, and Streaks. */

const noop = () => {};
const handlers = {
  today: FIXTURE_TODAY,
  avatarLetter: 'A',
  checkIn: null,
  onOpenTask: noop,
  onAnswer: noop,
  onAddPhoto: noop,
  onCloseCheckIn: noop,
  onDone: noop,
  onScan: noop,
  onScanLabel: noop,
  onOpenStreaks: noop,
  onOpenLeague: noop,
  onAvatar: noop,
} as const;

const base = aoife.today;
const [monty, spidey, lily] = base.tasks as [
  (typeof base.tasks)[number],
  (typeof base.tasks)[number],
  (typeof base.tasks)[number],
];

const today = (summary: TodaySummary) => (
  <TabScreenFrame active="today">
    <TodayScreen {...handlers} summary={summary} />
  </TabScreenFrame>
);

registerFrame({
  id: '2e',
  title: 'Today · tasks, both streaks, league rank, identifications left',
  render: () => today(base),
});

registerFrame({
  id: '4a',
  title: 'Today · no plants yet',
  render: () => today({ ...base, hasPlants: false, tasks: [], league: null }),
});

registerFrame({
  id: '4b',
  title: 'Today · all done today',
  render: () =>
    today({
      ...base,
      streak: { ...base.streak, careState: 'active' },
      tasks: [
        { ...monty, status: 'done' },
        { ...lily, status: 'done' },
      ],
    }),
});

// The check-in frames show the sheet over Today, with Spidey's check due tomorrow. The sheet is
// drawn as an overlay over the whole device, tab bar included, as in the design.
const behindSheet: TodaySummary = {
  ...base,
  tasks: [monty, { ...spidey, status: 'due', dueOn: '2026-10-04' }],
};
type SheetState<P> = P extends unknown
  ? Omit<P, 'visible' | 'presentation' | 'plantNickname'>
  : never;
const withSheet = (sheet: SheetState<CheckInSheetProps>) => (
  <>
    {today(behindSheet)}
    <CheckInSheet
      {...(sheet as CheckInSheetProps)}
      visible
      plantNickname="Monty"
      presentation="overlay"
    />
  </>
);
const sheetHandlers = { onAnswer: noop, onAddPhoto: noop, onClose: noop, onDone: noop };

registerFrame({
  id: '4c',
  title: 'Check-in sheet · unanswered',
  render: () => withSheet({ ...sheetHandlers, state: 'unanswered' }),
});
registerFrame({
  id: '4d',
  title: 'Check-in sheet · answered No',
  render: () =>
    withSheet({
      ...sheetHandlers,
      state: 'answered_no',
      nextCheckWeekday: 'Friday',
      streakDays: 12,
    }),
});
registerFrame({
  id: '4e',
  title: 'Check-in sheet · saved offline',
  render: () => withSheet({ ...sheetHandlers, state: 'saved_offline', nextCheckWeekday: 'Friday' }),
});

// The calendar reads oldest first. The frames draw a run of checked days from the start of the grid.
const marks = (run: DayMark[]): DayMark[] => [
  ...run,
  ...Array.from({ length: 28 - run.length }, (): DayMark => 'empty'),
];
const days = (n: number, mark: DayMark): DayMark[] => Array.from({ length: n }, () => mark);
const streak = (over: Partial<StreakSummary>): StreakSummary => ({
  ...base.streak,
  careState: 'active',
  ...over,
});
const streaks = (s: StreakSummary, nickname?: string) => (
  <StreaksScreen
    streak={s}
    checkInNickname={nickname}
    onBack={noop}
    onInvite={noop}
    onCheckInFirst={noop}
  />
);

registerFrame({
  id: '4f',
  title: 'Streaks',
  render: () => streaks(streak({ calendar: marks(days(12, 'checked')) })),
});
registerFrame({
  id: '4g',
  title: 'Streaks · freeze used',
  render: () =>
    streaks(
      streak({
        careState: 'freeze_used',
        freezesHeld: 0,
        calendar: marks([...days(11, 'checked'), 'freeze', 'checked']),
      }),
    ),
});
registerFrame({
  id: '4h',
  title: 'Streaks · broken, without blame',
  render: () =>
    streaks(
      streak({
        careDays: 0,
        careState: 'broken',
        lastBrokenLength: 16,
        calendar: marks(days(16, 'missed')),
      }),
      'Monty',
    ),
});
