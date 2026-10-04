import { aoife, type CareTask, type PlantSummary } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../theme';
import { dayMonth, daysBetween, deviceToday, sinceLabel, weekdayName } from './dates';
import {
  Button,
  CheckInSheet,
  type CheckInSheetProps,
  FindMarker,
  LeagueRow,
  PhotoSlot,
  PlanCard,
  PlantCard,
  PlantdexTile,
  RowsCard,
  TaskRow,
} from './index';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);
const TODAY = '2026-10-03';
const [monty, spidey, lily] = aoife.plants as [PlantSummary, PlantSummary, PlantSummary];
const [dueTask, overdueTask, doneTask] = aoife.today.tasks as [CareTask, CareTask, CareTask];
const noop = () => {};

describe('dates', () => {
  it('names the weekday of a calendar date, not of the device timezone', () => {
    expect(weekdayName('2026-10-05')).toBe('Monday');
    expect(weekdayName('2026-10-03')).toBe('Saturday');
    expect(weekdayName('1970-01-01')).toBe('Thursday');
    expect(weekdayName('not a date')).toBeNull();
  });
  it('formats day and month, counts days and reads "yesterday"', () => {
    expect(dayMonth('2026-08-20')).toBe('20 Aug');
    expect(dayMonth('2026-12-01')).toBe('1 Dec');
    expect(daysBetween('2026-09-30', '2026-10-03')).toBe(3);
    expect(daysBetween('2026-10-03', '2026-10-02')).toBe(-1);
    expect(daysBetween('2026-10-03', 'x')).toBeNull();
    expect(sinceLabel('2026-10-02', TODAY)).toBe('yesterday');
    expect(sinceLabel('2026-09-28', TODAY)).toBe('28 Sep');
    expect(sinceLabel('2026-10-03', TODAY)).toBeNull();
    expect(sinceLabel('2026-10-09', TODAY)).toBeNull();
    expect(sinceLabel(null, TODAY)).toBeNull();
  });
  it('reads the device date from its local calendar', () => {
    expect(deviceToday(new Date(2026, 9, 3, 23, 59))).toBe('2026-10-03');
    expect(deviceToday(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});

describe('PlantCard states', () => {
  it('due is the only call to act, in the primary colour', async () => {
    await wrap(<PlantCard plant={monty} today={TODAY} onPress={noop} />);
    expect(StyleSheet.flatten(screen.getByText('Check today').props.style)).toMatchObject({
      color: '#2E6B4E',
    });
  });
  it('overdue says since yesterday, or since the date', async () => {
    const { unmount } = await wrap(<PlantCard plant={spidey} today={TODAY} onPress={noop} />);
    expect(screen.getByText('Since yesterday')).toBeTruthy();
    await unmount();
    await wrap(
      <PlantCard plant={{ ...spidey, nextCheckOn: '2026-09-28' }} today={TODAY} onPress={noop} />,
    );
    expect(screen.getByText('Since 28 Sep')).toBeTruthy();
  });
  it('all good names the weekday and paused shows the note', async () => {
    const { unmount } = await wrap(<PlantCard plant={lily} today={TODAY} onPress={noop} />);
    expect(screen.getByText('Monday')).toBeTruthy();
    await unmount();
    const paused: PlantSummary = { ...lily, careState: 'paused', pausedNote: '1 of 2 dry checks' };
    await wrap(<PlantCard plant={paused} today={TODAY} onPress={noop} />);
    expect(screen.getByText('1 of 2 dry checks')).toBeTruthy();
  });
  it('dead and given away stay in the list at 0.6 opacity', async () => {
    const dead = aoife.plantDetails['fern-dead']!;
    const { unmount } = await wrap(<PlantCard plant={dead} onPress={noop} />);
    expect(screen.getByText('Died 20 Aug')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByRole('button').props.style).opacity).toBe(0.6);
    await unmount();
    const away = aoife.plantDetails['lily-given-away']!;
    await wrap(<PlantCard plant={away} onPress={noop} />);
    expect(screen.getByText('Given away')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByRole('button').props.style).opacity).toBe(0.6);
  });
  it('a summary without a date still says the plant died', async () => {
    await wrap(
      <PlantCard plant={{ ...monty, status: 'dead', careState: 'closed' }} onPress={noop} />,
    );
    expect(screen.getByText('Died')).toBeTruthy();
  });
  it('leads with the initial when there is no photo, and opens on press', async () => {
    const onPress = jest.fn();
    await wrap(<PlantCard plant={monty} today={TODAY} onPress={onPress} />);
    expect(screen.getByText('M', { hidden: true })).toBeTruthy();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Monty, Swiss cheese plant, Check today' }),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('shows the photo when there is one, with the species in italics', async () => {
    await wrap(
      <PlantCard plant={{ ...monty, photoUrl: 'https://example.test/m.jpg' }} onPress={noop} />,
    );
    expect(screen.queryByText('M', { hidden: true })).toBeNull();
    expect(StyleSheet.flatten(screen.getByText('Swiss cheese plant').props.style)).toMatchObject({
      fontFamily: 'Inter_400Regular_Italic',
    });
  });
});

describe('PlantCard next check', () => {
  it('an all-good plant checked tomorrow says Tomorrow, otherwise the weekday (4i)', async () => {
    const { unmount } = await wrap(<PlantCard plant={lily} today="2026-10-04" onPress={noop} />);
    expect(screen.getByText('Tomorrow')).toBeTruthy();
    await unmount();
    await wrap(<PlantCard plant={lily} today="2026-10-02" onPress={noop} />);
    expect(screen.getByText('Monday')).toBeTruthy();
    expect(screen.queryByText('Tomorrow')).toBeNull();
  });
  it('takes a plain summary: the closing date comes from statusOn', async () => {
    const dead: PlantSummary = {
      ...monty,
      status: 'dead',
      careState: 'closed',
      statusOn: '2026-08-20',
    };
    await wrap(<PlantCard plant={dead} onPress={noop} />);
    expect(screen.getByText('Died 20 Aug')).toBeTruthy();
  });
});

describe('PlantCard row variant (4i)', () => {
  const flat = (el: { props: { style?: unknown } }) =>
    StyleSheet.flatten(el.props.style as never) as Record<string, unknown>;

  it('is the frame row: no lead, plain type, 12/16 padding and a divider', async () => {
    await wrap(<PlantCard plant={monty} variant="row" today={TODAY} onPress={noop} />);
    expect(screen.queryByText('M', { hidden: true })).toBeNull();
    expect(flat(screen.getByText('Monty'))).toMatchObject({
      fontFamily: 'Inter_400Regular',
      fontSize: 17,
    });
    expect(flat(screen.getByText('Swiss cheese plant'))).toMatchObject({
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      lineHeight: 20,
      color: '#56605A',
    });
    expect(flat(screen.getByText('Check today'))).toMatchObject({
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      color: '#2E6B4E',
    });
    expect(flat(screen.getByRole('button'))).toMatchObject({
      paddingVertical: 12,
      paddingHorizontal: 16,
      minHeight: 53,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(127,137,131,0.18)',
      backgroundColor: 'transparent',
    });
  });
  it('shows Tomorrow in the secondary colour and opens on press', async () => {
    const onPress = jest.fn();
    await wrap(<PlantCard plant={lily} variant="row" today="2026-10-04" onPress={onPress} />);
    expect(flat(screen.getByText('Tomorrow'))).toMatchObject({ color: '#56605A' });
    await fireEvent.press(screen.getByRole('button', { name: 'Lily, Peace lily, Tomorrow' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('sits inside a RowsCard next to its own rows, and dims a closed plant', async () => {
    const away = aoife.plantDetails['lily-given-away']!;
    await wrap(
      <RowsCard rows={[{ key: 'a', title: 'Plain row' }]}>
        <PlantCard plant={monty} variant="row" today={TODAY} onPress={noop} />
        <PlantCard plant={away} variant="row" today={TODAY} onPress={noop} />
      </RowsCard>,
    );
    expect(screen.getByText('Plain row')).toBeTruthy();
    expect(screen.getByText('Monty')).toBeTruthy();
    expect(screen.getByText('Given away')).toBeTruthy();
    expect(flat(screen.getByRole('button', { name: /Given away/ })).opacity).toBe(0.6);
    expect(flat(screen.getByRole('button', { name: /Check today/ })).opacity).toBe(1);
  });
});

describe('TaskRow states', () => {
  it('titles and subtitles follow the task', async () => {
    const { unmount } = await wrap(<TaskRow task={dueTask} today={TODAY} onPress={noop} />);
    expect(screen.getByText('Living room · due today')).toBeTruthy();
    await unmount();
    const o = await wrap(<TaskRow task={overdueTask} today={TODAY} onPress={noop} />);
    expect(screen.getByText("Check Spidey's soil")).toBeTruthy();
    expect(screen.getByText('Kitchen · overdue since yesterday')).toBeTruthy();
    await o.unmount();
    await wrap(
      <TaskRow
        task={{ ...overdueTask, dueOn: '2026-09-28', room: null }}
        today={TODAY}
        onPress={noop}
      />,
    );
    expect(screen.getByText('overdue since 28 Sep')).toBeTruthy();
  });
  it('a done task is struck through, checked, faded and not celebrated', async () => {
    await wrap(<TaskRow task={doneTask} today={TODAY} onPress={noop} />);
    expect(StyleSheet.flatten(screen.getByText('Water Lily').props.style)).toMatchObject({
      textDecorationLine: 'line-through',
      color: '#56605A',
    });
    expect(screen.getByText('Bedroom · done')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check in' })).toBeNull();
    expect(screen.queryByText(/great|well done|nice|streak|!/i)).toBeNull();
  });
  it('the row opens on press and the action is a separate button', async () => {
    const onPress = jest.fn();
    const onCheck = jest.fn();
    await wrap(
      <TaskRow
        task={dueTask}
        today={TODAY}
        onPress={onPress}
        primaryAction={{ label: 'Check in', onPress: onCheck }}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: /Time to check Monty's soil/ }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onCheck).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
    expect(onCheck).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('the last row of a card has no divider', async () => {
    const { unmount } = await wrap(<TaskRow task={dueTask} today={TODAY} onPress={noop} />);
    const divided = screen.getByRole('button').parent!;
    expect(StyleSheet.flatten(divided.props.style).borderBottomWidth).toBe(1);
    await unmount();
    await wrap(<TaskRow task={dueTask} today={TODAY} onPress={noop} last />);
    expect(
      StyleSheet.flatten(screen.getByRole('button').parent!.props.style).borderBottomWidth,
    ).toBe(0);
  });
});

describe('LeagueRow states', () => {
  it('others read @handle with their points and no pending line', async () => {
    await wrap(
      <LeagueRow
        row={{ rank: 1, handle: 'hedgehopper', points: 520, isYou: false, pending: false }}
      />,
    );
    expect(screen.getByText('@hedgehopper')).toBeTruthy();
    expect(screen.getByText('520')).toBeTruthy();
    expect(screen.queryByText('Points pending review')).toBeNull();
  });
  it('your row sits on the primary tint with primary points, and says so aloud', async () => {
    await wrap(
      <LeagueRow
        row={{ rank: 4, handle: 'aoifegrows', points: 340, isYou: true, pending: false }}
      />,
    );
    const row = screen.getByLabelText('Rank 4. You, @aoifegrows. 340 points');
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ backgroundColor: '#E6F0EA' });
    expect(StyleSheet.flatten(screen.getByText('340').props.style)).toMatchObject({
      color: '#2E6B4E',
    });
  });
  it('held points are named plainly and keep their number', async () => {
    await wrap(
      <LeagueRow row={{ rank: 3, handle: 'mossbank', points: 355, isYou: false, pending: true }} />,
    );
    expect(
      screen.getByLabelText('Rank 3. @mossbank. 355 points. Points pending review'),
    ).toBeTruthy();
    expect(screen.getByText('355')).toBeTruthy();
    expect(screen.queryByText(/cheat|suspicious|flagged|fraud/i)).toBeNull();
  });
});

/** The tile's name line: the placeholder photo repeats the name in a caption, as the design does. */
const boldTexts = (name: string) =>
  screen
    .getAllByText(name)
    .filter((el) => StyleSheet.flatten(el.props.style).fontFamily === 'Inter_600SemiBold');

describe('PlantdexTile states', () => {
  const foxglove = aoife.species['foxglove']!;
  const orchid = aoife.species['early-purple-orchid']!;
  it('found shows the names and the rarity', async () => {
    await wrap(<PlantdexTile species={foxglove} found />);
    expect(boldTexts('Foxglove')).toHaveLength(1);
    expect(screen.getByText('Digitalis purpurea')).toBeTruthy();
    expect(screen.getByLabelText('Rarity: Uncommon')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText('Digitalis purpurea').props.style)).toMatchObject({
      fontFamily: 'Inter_400Regular_Italic',
    });
  });
  it('found opens on press', async () => {
    const onPress = jest.fn();
    await wrap(<PlantdexTile species={foxglove} found onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('a sensitive species says its location is private', async () => {
    await wrap(<PlantdexTile species={orchid} found />);
    expect(screen.getByText('Location private')).toBeTruthy();
    expect(screen.queryByText('Digitalis purpurea')).toBeNull();
    // 4aj: a sensitive species shows no rarity.
    expect(screen.queryByLabelText(/Rarity/)).toBeNull();
    expect(boldTexts('Early purple orchid')).toHaveLength(1);
  });
  it('missing names its set and never shows a species', async () => {
    await wrap(<PlantdexTile species={null} found={false} setName="Irish hedgerow" />);
    expect(screen.getByText('Not found yet')).toBeTruthy();
    expect(screen.getByText('Irish hedgerow')).toBeTruthy();
    expect(screen.queryByLabelText(/Rarity/)).toBeNull();
  });
  it('a species marked found but not given reads as missing', async () => {
    await wrap(<PlantdexTile species={null} found setName="Irish hedgerow" />);
    expect(screen.getByLabelText('Not found yet')).toBeTruthy();
  });
  it('a missing tile can still be opened, and keeps its label', async () => {
    const onPress = jest.fn();
    await wrap(<PlantdexTile species={null} found={false} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Not found yet' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('FindMarker', () => {
  it('exact and area are marks; hidden is only its caption', async () => {
    const { unmount } = await wrap(<FindMarker kind="exact" />);
    expect(screen.getByLabelText('Exact location, only you see it')).toBeTruthy();
    await unmount();
    const a = await wrap(<FindMarker kind="area" />);
    expect(screen.getByLabelText('Shared area')).toBeTruthy();
    await a.unmount();
    await wrap(<FindMarker kind="hidden" />);
    expect(screen.getByText('Hidden: near home or sensitive')).toBeTruthy();
    expect(screen.queryByRole('image')).toBeNull();
  });
  it('the dot is 16 pt inside a white ring and the area is 80 pt at 16% primary', async () => {
    const { unmount } = await wrap(<FindMarker kind="exact" />);
    expect(StyleSheet.flatten(screen.getByRole('image').props.style)).toMatchObject({
      width: 22,
      height: 22,
      borderWidth: 3,
      borderColor: '#FFFFFF',
      backgroundColor: '#2E6B4E',
    });
    await unmount();
    await wrap(<FindMarker kind="area" />);
    expect(StyleSheet.flatten(screen.getByRole('image').props.style)).toMatchObject({
      width: 80,
      height: 80,
      borderColor: '#2E6B4E',
      backgroundColor: '#2E6B4E29',
    });
  });
});

describe('PlanCard states', () => {
  it('unselected is a radio that is not checked, and a press chooses it', async () => {
    const onPress = jest.fn();
    await wrap(
      <PlanCard
        title="Monthly"
        subtitle="Billed monthly"
        price="$4.99"
        per="a month"
        selected={false}
        onPress={onPress}
      />,
    );
    const radio = screen.getByRole('radio', { name: /Monthly/ });
    expect(radio).not.toBeChecked();
    await fireEvent.press(radio);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('the price is the largest text and the tag is smaller', async () => {
    await wrap(
      <PlanCard
        title="Yearly"
        tag="Best value"
        subtitle="s"
        price="$24.99"
        per="a year"
        selected
        onPress={noop}
      />,
    );
    const price = StyleSheet.flatten(screen.getByText('$24.99').props.style);
    const tag = StyleSheet.flatten(screen.getByText('Best value').props.style);
    const title = StyleSheet.flatten(screen.getByText('Yearly').props.style);
    expect(price).toMatchObject({ fontSize: 28, fontFamily: 'Fraunces_600SemiBold' });
    expect(tag.fontSize).toBe(13);
    expect(tag.color).toBe('#2E6B4E');
    expect(price.fontSize).toBeGreaterThan(title.fontSize!);
    expect(price.fontSize).toBeGreaterThan(tag.fontSize!);
  });
  it('selected is tinted with a 2 pt primary ring; unselected is white with a 1.5 pt border', async () => {
    const { unmount } = await wrap(
      <PlanCard title="Yearly" subtitle="s" price="$24.99" per="a year" selected onPress={noop} />,
    );
    expect(StyleSheet.flatten(screen.getByRole('radio').props.style)).toMatchObject({
      backgroundColor: '#E6F0EA',
      borderColor: '#2E6B4E',
      borderWidth: 2,
    });
    await unmount();
    await wrap(
      <PlanCard
        title="Monthly"
        subtitle="s"
        price="$4.99"
        per="a month"
        selected={false}
        onPress={noop}
      />,
    );
    expect(StyleSheet.flatten(screen.getByRole('radio').props.style)).toMatchObject({
      backgroundColor: '#FFFFFF',
      borderColor: '#7F8983',
      borderWidth: 1.5,
    });
  });
  it('reads the billed amount aloud with the plan', async () => {
    await wrap(
      <PlanCard
        title="Yearly"
        tag="Best value"
        subtitle="$2.08 a month, billed yearly"
        price="$24.99"
        per="a year"
        selected
        onPress={noop}
      />,
    );
    expect(
      screen.getByLabelText('Yearly, Best value, $2.08 a month, billed yearly, $24.99 a year'),
    ).toBeTruthy();
  });
});

const sheet = (over: Record<string, unknown> = {}) => (
  <CheckInSheet
    {...({
      visible: true,
      plantNickname: 'Monty',
      state: 'unanswered',
      onAnswer: noop,
      onAddPhoto: noop,
      onClose: noop,
      onDone: noop,
      ...over,
    } as CheckInSheetProps)}
  />
);

describe('CheckInSheet states', () => {
  it('Yes, dry reports true with no leaves by default', async () => {
    const onAnswer = jest.fn();
    await wrap(sheet({ onAnswer }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, dry' }));
    expect(onAnswer).toHaveBeenCalledWith(true, []);
  });
  it('offers the five leaf states as checkboxes and reports them in the order picked', async () => {
    const onAnswer = jest.fn();
    await wrap(sheet({ onAnswer }));
    expect(screen.getAllByRole('checkbox').map((c) => c.props.accessibilityState?.checked)).toEqual(
      [false, false, false, false, false],
    );
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Brown tips' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Spots' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Healthy' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Spots' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, dry' }));
    expect(onAnswer).toHaveBeenCalledWith(true, ['brown_tips', 'healthy']);
  });
  it('shows the instructions, the optional caption and the photo button', async () => {
    const onAddPhoto = jest.fn();
    await wrap(sheet({ onAddPhoto }));
    expect(screen.getByText('Push a finger in up to the first knuckle.')).toBeTruthy();
    expect(screen.getByText('How do the leaves look? (optional)')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }));
    expect(onAddPhoto).toHaveBeenCalledTimes(1);
  });
  it('a double tap records one check-in, until the state moves on', async () => {
    const onAnswer = jest.fn();
    const view = await wrap(sheet({ onAnswer }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, dry' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Yes, dry' }));
    await fireEvent.press(screen.getByRole('button', { name: 'No, still damp' }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Yes, dry' })).toBeDisabled();
    await view.rerender(
      <ThemeProvider scheme="light">{sheet({ onAnswer, state: 'answered_yes' })}</ThemeProvider>,
    );
    await view.rerender(<ThemeProvider scheme="light">{sheet({ onAnswer })}</ThemeProvider>);
    await fireEvent.press(screen.getByRole('button', { name: 'No, still damp' }));
    expect(onAnswer).toHaveBeenCalledTimes(2);
  });
  it('picking leaves does not call back until an answer is given', async () => {
    const onAnswer = jest.fn();
    await wrap(sheet({ onAnswer }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Drooping' }));
    expect(onAnswer).not.toHaveBeenCalled();
  });
  it('answered Yes adds a watering task and does not celebrate', async () => {
    const onDone = jest.fn();
    await wrap(sheet({ state: 'answered_yes', onDone }));
    expect(screen.getByText('Time to water Monty.')).toBeTruthy();
    expect(screen.getByText("We've added a watering task for today.")).toBeTruthy();
    expect(screen.queryByText(/great|well done|nice|streak|!/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Yes, dry' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
  it('answered No names the streak only when there is one', async () => {
    const { unmount } = await wrap(sheet({ state: 'answered_no', nextCheckWeekday: 'Friday' }));
    expect(screen.queryByText(/streak/)).toBeNull();
    await unmount();
    await wrap(sheet({ state: 'answered_no', nextCheckWeekday: 'Friday', streakDays: 12 }));
    expect(screen.getByText('Your 12-day streak continues.')).toBeTruthy();
  });
  it('offline keeps the same title and adds the sync note', async () => {
    const onDone = jest.fn();
    await wrap(sheet({ state: 'saved_offline', nextCheckWeekday: 'Friday', onDone }));
    expect(screen.getByText("Good. We'll check again on Friday.")).toBeTruthy();
    expect(screen.queryByText(/streak/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
  it('says the weekday in the two states that name the next check, and the type insists on it', () => {
    const base = { visible: true, plantNickname: 'Monty', onAnswer: noop } as const;
    const handlers = { onAddPhoto: noop, onClose: noop, onDone: noop };
    // @ts-expect-error answered_no names the next check, so it needs the weekday
    const noDay = <CheckInSheet {...base} {...handlers} state="answered_no" />;
    // @ts-expect-error so does saved_offline
    const noDayOffline = <CheckInSheet {...base} {...handlers} state="saved_offline" />;
    expect([noDay, noDayOffline]).toHaveLength(2);
    // The question and the watering state do not.
    expect(<CheckInSheet {...base} {...handlers} state="unanswered" />).toBeTruthy();
    expect(<CheckInSheet {...base} {...handlers} state="answered_yes" />).toBeTruthy();
  });
  it('closes from the sheet header', async () => {
    const onClose = jest.fn();
    await wrap(sheet({ onClose }));
    expect(screen.getByText('Check-in')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('CheckInSheet presentation', () => {
  it('modal (the default) is a Modal and hides when not visible', async () => {
    const { unmount } = await wrap(sheet());
    expect(screen.getByTestId('sheet-modal')).toBeTruthy();
    await unmount();
    await wrap(sheet({ visible: false }));
    expect(screen.queryByText("Is the top of Monty's soil dry?")).toBeNull();
  });
  it('overlay draws the scrim and panel inline and ignores visible', async () => {
    await wrap(sheet({ presentation: 'overlay', visible: false }));
    expect(screen.getByTestId('sheet-overlay')).toBeTruthy();
    expect(screen.queryByTestId('sheet-modal')).toBeNull();
    expect(screen.getByText("Is the top of Monty's soil dry?")).toBeTruthy();
  });
  it('inline is the bare panel in the flow', async () => {
    await wrap(sheet({ presentation: 'inline', visible: false }));
    expect(screen.getByTestId('sheet-panel')).toBeTruthy();
    expect(screen.queryByTestId('sheet-modal')).toBeNull();
    expect(screen.queryByTestId('sheet-overlay')).toBeNull();
  });
  it('the sheet is at least as tall as the frame and never a fixed height that could clip', async () => {
    await wrap(sheet({ presentation: 'overlay' }));
    expect(StyleSheet.flatten(screen.getByTestId('sheet-panel').props.style)).toMatchObject({
      minHeight: 522,
    });
    expect(
      StyleSheet.flatten(screen.getByTestId('sheet-panel').props.style).height,
    ).toBeUndefined();
  });
  it('answered states use the 382 pt floor', async () => {
    await wrap(
      sheet({ presentation: 'overlay', state: 'answered_no', nextCheckWeekday: 'Friday' }),
    );
    expect(StyleSheet.flatten(screen.getByTestId('sheet-panel').props.style)).toMatchObject({
      minHeight: 382,
    });
  });
});

describe('shared pieces the new components lean on', () => {
  it('PhotoSlot draws a small slot with its own width and no caption', async () => {
    await wrap(
      <PhotoSlot label="Photo of Monty" width={52} height={52} radius={12} showLabel={false} />,
    );
    expect(screen.queryByText('Photo of Monty')).toBeNull();
    const slot = screen.getByLabelText('Photo of Monty');
    expect(StyleSheet.flatten(slot.props.style)).toMatchObject({
      width: 52,
      height: 52,
      borderRadius: 12,
    });
  });
  it('PhotoSlot keeps its caption and full width by default', async () => {
    await wrap(<PhotoSlot label="Foxglove" height={120} />);
    expect(screen.getByText('Foxglove')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByLabelText('Foxglove').props.style).width).toBe('100%');
  });
  it('Button previewPressed draws the pressed overlay without a touch', async () => {
    const { unmount } = await wrap(<Button label="Add" onPress={noop} />);
    const overlay = '"backgroundColor":"rgba(29,36,32,0.22)"';
    expect(JSON.stringify(screen.toJSON())).not.toContain(overlay);
    await unmount();
    await wrap(<Button label="Add" onPress={noop} previewPressed />);
    expect(JSON.stringify(screen.toJSON())).toContain(overlay);
  });
  it('a disabled Button never shows the pressed overlay', async () => {
    await wrap(<Button label="Add" onPress={noop} previewPressed disabled />);
    expect(JSON.stringify(screen.toJSON())).not.toContain('rgba(29,36,32,0.22)');
  });
});
