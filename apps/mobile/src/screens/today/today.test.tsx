import { aoife, type StreakSummary } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme';
import { StreaksScreen } from './StreaksScreen';
import { TodayScreen, type TodayScreenProps } from './TodayScreen';

const noop = () => {};
const TODAY = '2026-10-03';
const handlers = {
  today: TODAY,
  avatarLetter: 'A',
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
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);
const today = (props: Partial<TodayScreenProps> = {}) =>
  wrap(<TodayScreen summary={aoife.today} checkIn={null} {...handlers} {...props} />);

const monty = aoife.today.tasks[0]!;
const lily = aoife.today.tasks[2]!;
const allDone = {
  ...aoife.today,
  tasks: [
    { ...monty, status: 'done' as const },
    { ...lily, status: 'done' as const },
  ],
};

describe('TodayScreen', () => {
  it('shows tasks, both streaks, league rank and identifications left', async () => {
    await today();
    expect(screen.getByText('Saturday 3 October')).toBeTruthy();
    expect(screen.getByText('Your 12-day streak needs one check-in today.')).toBeTruthy();
    expect(screen.getByText('1 freeze held')).toBeTruthy();
    expect(screen.getByText("Time to check Monty's soil.")).toBeTruthy();
    expect(screen.getByText('4th of 20')).toBeTruthy();
    expect(screen.getByText('340 points · 3 days left')).toBeTruthy();
    expect(screen.getByText('7 of 10 left')).toBeTruthy();
  });

  it('puts "Check in" on the due check only, and opens the task from it', async () => {
    const onOpenTask = jest.fn();
    await today({ onOpenTask });
    expect(screen.getAllByRole('button', { name: 'Check in' })).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
    expect(onOpenTask).toHaveBeenCalledWith('t-monty');
  });

  it('routes the streak tiles, the league tile and the avatar', async () => {
    const onOpenStreaks = jest.fn();
    const onOpenLeague = jest.fn();
    const onAvatar = jest.fn();
    await today({ onOpenStreaks, onOpenLeague, onAvatar });
    await fireEvent.press(screen.getByRole('button', { name: /^Streaks\./ }));
    await fireEvent.press(screen.getByRole('button', { name: /^League/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Profile' }));
    expect(onOpenStreaks).toHaveBeenCalled();
    expect(onOpenLeague).toHaveBeenCalled();
    expect(onAvatar).toHaveBeenCalled();
  });

  it('empty state offers both scan routes', async () => {
    const onScan = jest.fn();
    const onScanLabel = jest.fn();
    await today({
      summary: { ...aoife.today, hasPlants: false, tasks: [] },
      onScan,
      onScanLabel,
    });
    expect(
      screen.getByText("Add your first plant and we'll tell you when to check its soil."),
    ).toBeTruthy();
    expect(screen.getByText('7 of 10 left this month')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Scan a plant' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Scan your plant label' }));
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScanLabel).toHaveBeenCalledTimes(1);
  });

  it('all done says so and names the next check by its day', async () => {
    await today({ summary: allDone });
    expect(screen.getByText("Checked Monty's soil")).toBeTruthy();
    expect(screen.getByText('Watered Lily')).toBeTruthy();
    expect(screen.getByText('All done for today. Next check: Spidey, tomorrow.')).toBeTruthy();
    expect(screen.getByText('4th of 20')).toBeTruthy();
    expect(screen.getByText('Resets 1 November')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check in' })).toBeNull();
    expect(screen.queryByText(/great|well done|nice|!/i)).toBeNull();
  });

  it('names a weekday when the next check is further out', async () => {
    await today({
      summary: { ...allDone, nextCheck: { plantNickname: 'Spidey', on: '2026-10-09' } },
    });
    expect(screen.getByText('All done for today. Next check: Spidey, Friday.')).toBeTruthy();
  });

  it('answer buttons are disabled while an answer is pending (no double check-ins)', async () => {
    const onAnswer = jest.fn();
    await today({ checkIn: { taskId: 't-monty', state: 'unanswered' }, onAnswer });
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, dry' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, dry' }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('a new sheetKey clears the latch so the answer works again', async () => {
    const onAnswer = jest.fn();
    const props = { summary: aoife.today, onAnswer };
    const view = await today({
      ...props,
      checkIn: { taskId: 't-monty', state: 'unanswered', sheetKey: 0 },
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, dry' }));
    await view.rerender(
      <ThemeProvider scheme="light">
        <TodayScreen
          {...handlers}
          {...props}
          checkIn={{ taskId: 't-monty', state: 'unanswered', sheetKey: 1 }}
        />
      </ThemeProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, dry' }));
    expect(onAnswer).toHaveBeenCalledTimes(2);
  });

  it('shows the answered state with the next check day', async () => {
    await today({
      checkIn: {
        taskId: 't-monty',
        state: 'answered_no',
        nextCheckWeekday: 'Friday',
        streakDays: 12,
      },
    });
    expect(screen.getByText("Good. We'll check again on Friday.")).toBeTruthy();
    expect(screen.getByText('Your 12-day streak continues.')).toBeTruthy();
  });

  it('shows an error line', async () => {
    await today({ error: "Couldn't save your check-in. Try again." });
    expect(screen.getByText("Couldn't save your check-in. Try again.")).toBeTruthy();
  });
});

const streakOf = (over: Partial<StreakSummary> = {}): StreakSummary => ({
  ...aoife.today.streak,
  ...over,
});
const streaks = (
  streak: StreakSummary,
  extra: Partial<React.ComponentProps<typeof StreaksScreen>> = {},
) =>
  wrap(
    <StreaksScreen
      streak={streak}
      onBack={noop}
      onInvite={noop}
      onCheckInFirst={noop}
      {...extra}
    />,
  );

describe('StreaksScreen', () => {
  it('shows the count, the calendar and the three rows', async () => {
    const onInvite = jest.fn();
    await streaks(streakOf(), { onInvite });
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getAllByLabelText('Checked in')).toHaveLength(12);
    expect(screen.getByText('3 weeks')).toBeTruthy();
    expect(screen.getByText('1 held')).toBeTruthy();
    expect(screen.getByText('Off')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Invite a friend to earn a freeze' }));
    expect(onInvite).toHaveBeenCalled();
  });

  it('goes back to Today', async () => {
    const onBack = jest.fn();
    await streaks(streakOf(), { onBack });
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Today' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('winter mode is a plain row until the API exists, and toggles once it does', async () => {
    const view = await streaks(streakOf({ winterModeAvailable: true }));
    expect(screen.queryByTestId('row-winter')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Winter mode/ })).toBeNull();
    await view.unmount();
    const onToggleWinter = jest.fn();
    await streaks(streakOf({ winterModeAvailable: true }), { onToggleWinter });
    await fireEvent.press(screen.getByRole('button', { name: /Winter mode/ }));
    expect(onToggleWinter).toHaveBeenCalledWith(true);
  });

  it('a freeze that saved the day is a calm note, with the freezes row only', async () => {
    await streaks(streakOf({ careState: 'freeze_used', freezesHeld: 0 }));
    expect(screen.getByText('A freeze kept your 12-day streak going.')).toBeTruthy();
    expect(screen.getByText('0 held')).toBeTruthy();
    expect(screen.getByText('Invite a friend to earn another')).toBeTruthy();
    expect(screen.queryByText('Discovery streak')).toBeNull();
  });

  it('broken streak is grey and blame-free', async () => {
    const onCheckInFirst = jest.fn();
    await streaks(streakOf({ careDays: 0, careState: 'broken', lastBrokenLength: 16 }), {
      onCheckInFirst,
      checkInNickname: 'Monty',
    });
    expect(
      screen.getByText('Your last streak ran 16 days. Any check-in starts a new one.'),
    ).toBeTruthy();
    expect(screen.queryByText(/lost|failed|missed out/i)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Check in on Monty' }));
    expect(onCheckInFirst).toHaveBeenCalled();
  });
});
