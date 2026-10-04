import { aoife } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../theme';
import { CheckInSheet, LeagueRow, PlanCard, PlantCard, PlantdexTile, TaskRow } from './index';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

describe('PlantCard', () => {
  it('shows nickname, species and the next check', async () => {
    await wrap(<PlantCard plant={aoife.plants[0]!} onPress={() => {}} />);
    expect(screen.getByText('Monty')).toBeTruthy();
    expect(screen.getByText('Swiss cheese plant')).toBeTruthy();
    expect(screen.getByText('Check today')).toBeTruthy();
  });
});

describe('TaskRow', () => {
  it('done tasks are struck through and not celebrated', async () => {
    const done = aoife.today.tasks.find((t) => t.status === 'done')!;
    await wrap(<TaskRow task={done} onPress={() => {}} />);
    expect(screen.getByText('Water Lily')).toBeTruthy();
    expect(screen.queryByText(/great|well done|nice/i)).toBeNull();
  });
  it('due task with a Check in action', async () => {
    const due = aoife.today.tasks.find((t) => t.status === 'due')!;
    const onCheck = jest.fn();
    await wrap(
      <TaskRow
        task={due}
        onPress={() => {}}
        primaryAction={{ label: 'Check in', onPress: onCheck }}
      />,
    );
    expect(screen.getByText("Time to check Monty's soil.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
    expect(onCheck).toHaveBeenCalled();
  });
});

describe('LeagueRow', () => {
  it('marks your row with You, not colour alone', async () => {
    await wrap(
      <LeagueRow
        row={{ rank: 4, handle: 'aoifegrows', points: 340, isYou: true, pending: false }}
      />,
    );
    expect(screen.getByText('You · @aoifegrows')).toBeTruthy();
  });
  it('shows pending points without accusation', async () => {
    await wrap(
      <LeagueRow row={{ rank: 3, handle: 'mossbank', points: 355, isYou: false, pending: true }} />,
    );
    expect(screen.getByText('Points pending review')).toBeTruthy();
  });
});

describe('PlantdexTile', () => {
  it('missing tiles read "Not found yet"', async () => {
    await wrap(<PlantdexTile species={null} found={false} setName="Irish hedgerow" />);
    expect(screen.getByLabelText('Not found yet')).toBeTruthy();
  });
});

describe('PlanCard', () => {
  it('the billed price is present and the card is a radio', async () => {
    await wrap(
      <PlanCard
        title="Yearly"
        tag="Best value"
        subtitle="$2.08 a month, billed yearly"
        price="$24.99"
        per="a year"
        selected
        onPress={() => {}}
      />,
    );
    expect(screen.getByRole('radio', { name: /Yearly/ })).toBeChecked();
    expect(screen.getByText('$24.99')).toBeTruthy();
  });
});

describe('CheckInSheet', () => {
  it('asks the soil question and reports the answer with leaf states', async () => {
    const onAnswer = jest.fn();
    await wrap(
      <CheckInSheet
        visible
        plantNickname="Monty"
        state="unanswered"
        onAnswer={onAnswer}
        onAddPhoto={() => {}}
        onClose={() => {}}
        onDone={() => {}}
      />,
    );
    expect(screen.getByText("Is the top of Monty's soil dry?")).toBeTruthy();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Yellowing' }));
    await fireEvent.press(screen.getByRole('button', { name: 'No, still damp' }));
    expect(onAnswer).toHaveBeenCalledWith(false, ['yellowing']);
  });
  it('answered No says when the next check is', async () => {
    await wrap(
      <CheckInSheet
        visible
        plantNickname="Monty"
        state="answered_no"
        nextCheckWeekday="Friday"
        streakDays={12}
        onAnswer={() => {}}
        onAddPhoto={() => {}}
        onClose={() => {}}
        onDone={() => {}}
      />,
    );
    expect(screen.getByText("Good. We'll check again on Friday.")).toBeTruthy();
    expect(screen.getByText('Your 12-day streak continues.')).toBeTruthy();
  });
  it('offline state says it was saved', async () => {
    await wrap(
      <CheckInSheet
        visible
        plantNickname="Monty"
        state="saved_offline"
        nextCheckWeekday="Friday"
        onAnswer={() => {}}
        onAddPhoto={() => {}}
        onClose={() => {}}
        onDone={() => {}}
      />,
    );
    expect(
      screen.getByText("You're offline. Saved, and it will sync when you're back."),
    ).toBeTruthy();
  });
});
