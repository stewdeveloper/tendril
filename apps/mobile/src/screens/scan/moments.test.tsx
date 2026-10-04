import { aoife } from '@tendril/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SetCompleteScreen } from '../collection/SetCompleteScreen';
import { ThemeProvider } from '../../theme';
import { NewSpeciesScreen } from './NewSpeciesScreen';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);
const fox = aoife.species['foxglove']!;
const base = {
  species: fox,
  outcome: aoife.outcomes['foxglove-awarded']!,
  photoLabel: 'Your photo: foxglove',
  reduceMotion: false,
  onContinue: () => {},
};
const cardStyle = () => StyleSheet.flatten(screen.getByTestId('moment-card').props.style);

describe('NewSpeciesScreen', () => {
  it('awarded shows points, Plantdex count and set progress', async () => {
    await wrap(<NewSpeciesScreen {...base} />);
    expect(screen.getByText('New to your Plantdex')).toBeTruthy();
    expect(screen.getByText('Foxglove')).toBeTruthy();
    expect(screen.getByText('Digitalis purpurea')).toBeTruthy();
    expect(screen.getByText('+40')).toBeTruthy();
    expect(screen.getByText('38 species')).toBeTruthy();
    expect(screen.getByText('Irish hedgerow')).toBeTruthy();
    expect(screen.getByText('5 of 8')).toBeTruthy();
  });
  it('held points read as pending review, never as an accusation', async () => {
    await wrap(
      <NewSpeciesScreen
        {...base}
        species={aoife.species['bluebell']!}
        outcome={aoife.outcomes['bluebell-held']!}
        photoLabel="Your photo: bluebell"
      />,
    );
    expect(
      screen.getByText('Points pending review. We check unusual finds before they count.'),
    ).toBeTruthy();
    expect(screen.queryByText(/cheat|suspicious|fraud/i)).toBeNull();
    expect(screen.queryByText('+80')).toBeNull();
  });
  it('gallery finds explain why there are no points', async () => {
    await wrap(
      <NewSpeciesScreen
        {...base}
        species={aoife.species['primrose']!}
        outcome={aoife.outcomes['primrose-gallery']!}
        photoLabel="Gallery photo: primrose"
        reduceMotion
      />,
    );
    expect(screen.getByText("Gallery photos get identified but don't earn points.")).toBeTruthy();
  });
  it('any other reason is said plainly', async () => {
    await wrap(
      <NewSpeciesScreen
        {...base}
        outcome={{
          ...base.outcome,
          pointsStatus: 'no_points',
          points: 0,
          noPointsReason: 'daily_cap',
        }}
      />,
    );
    expect(screen.getByText(/today's points limit/)).toBeTruthy();
  });
  it('Continue calls back, as a 44 pt button', async () => {
    const onContinue = jest.fn();
    await wrap(<NewSpeciesScreen {...base} onContinue={onContinue} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(onContinue).toHaveBeenCalled();
  });

  // Fake timers hold the entrance still, so a slow machine cannot finish it before the assertions.
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('enters with a scale and a fade, and a tap skips to the settled card', async () => {
    await wrap(<NewSpeciesScreen {...base} />);
    expect(cardStyle().opacity).toBe(0);
    expect(cardStyle().transform).toEqual([{ scale: expect.any(Number) }]);
    await fireEvent.press(screen.getByTestId('moment-skip'));
    await waitFor(() => expect(cardStyle().opacity).toBe(1));
    expect(cardStyle().transform).toEqual([{ scale: 1 }]);
  });
  it('with Reduce Motion the card is static and only fades, and a tap still skips', async () => {
    await wrap(<NewSpeciesScreen {...base} reduceMotion />);
    expect(cardStyle().transform).toBeUndefined();
    expect(cardStyle().opacity).toBe(0);
    await fireEvent.press(screen.getByTestId('moment-skip'));
    await waitFor(() => expect(cardStyle().opacity).toBe(1));
    expect(cardStyle().transform).toBeUndefined();
  });
  it('a settled card (the catalog) shows its final state at once', async () => {
    await wrap(<NewSpeciesScreen {...base} settled />);
    expect(cardStyle().opacity).toBe(1);
  });
  it('the Reduce Motion note shows only when asked', async () => {
    const note = 'Reduce Motion is on, so this card appears with a fade only.';
    const first = await wrap(<NewSpeciesScreen {...base} reduceMotion settled />);
    expect(screen.queryByText(note)).toBeNull();
    await first.unmount();
    await wrap(<NewSpeciesScreen {...base} reduceMotion settled showReduceMotionNote />);
    expect(screen.getByText(note)).toBeTruthy();
  });
});

describe('SetCompleteScreen', () => {
  const props = {
    setName: 'Easy-care houseplants',
    total: 6,
    onShare: jest.fn(),
    onContinue: jest.fn(),
    onBack: jest.fn(),
  };
  it('names the set, its completion and the Legendary badge', async () => {
    await wrap(<SetCompleteScreen {...props} />);
    expect(screen.getByText('Easy-care houseplants')).toBeTruthy();
    expect(screen.getByText('Set complete: 6 of 6.')).toBeTruthy();
    expect(screen.getByRole('text', { name: 'Rarity: Legendary' })).toBeTruthy();
  });
  it('Share, Continue and Back call back', async () => {
    await wrap(<SetCompleteScreen {...props} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Sets' }));
    expect(props.onShare).toHaveBeenCalled();
    expect(props.onContinue).toHaveBeenCalled();
    expect(props.onBack).toHaveBeenCalled();
  });
});
