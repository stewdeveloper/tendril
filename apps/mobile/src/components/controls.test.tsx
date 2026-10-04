import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme';
import type { IconProps } from './icons';
import {
  EmptyState,
  Note,
  OptionPills,
  RowsCard,
  SegmentedControl,
  Snackbar,
  TextField,
} from './index';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);

describe('controls', () => {
  it('OptionPills marks the selected option and reports changes', async () => {
    const onChange = jest.fn();
    await wrap(
      <OptionPills
        options={[
          { value: 'bright', label: 'Bright' },
          { value: 'medium', label: 'Medium' },
        ]}
        value="medium"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Bright' }));
    expect(onChange).toHaveBeenCalledWith('bright');
  });
  it('OptionPills in multiple mode toggles values', async () => {
    const onChange = jest.fn();
    await wrap(
      <OptionPills
        multiple
        options={[
          { value: 'yellowing', label: 'Yellowing' },
          { value: 'spots', label: 'Spots' },
        ]}
        value={['spots']}
        onChange={onChange}
      />,
    );
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Yellowing' }));
    expect(onChange).toHaveBeenCalledWith(['spots', 'yellowing']);
  });
  it('SegmentedControl selects tabs', async () => {
    const onChange = jest.fn();
    await wrap(
      <SegmentedControl
        options={[
          { value: 'league', label: 'League' },
          { value: 'friends', label: 'Friends' },
        ]}
        value="league"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('tab', { name: 'League' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Friends' }));
    expect(onChange).toHaveBeenCalledWith('friends');
  });
  it('RowsCard renders lead, title, subtitle and right text; highlight uses the tint', async () => {
    await wrap(
      <RowsCard
        rows={[
          {
            key: 'you',
            lead: '4',
            title: 'You · @aoifegrows',
            right: '340',
            rightColor: 'primary',
            highlight: true,
          },
        ]}
      />,
    );
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('340')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('row-you').props.style)).toMatchObject({
      backgroundColor: '#E6F0EA',
    });
  });
  it('RowsCard rows can lead with a primary-coloured icon (2d)', async () => {
    const Icon = jest.fn((_: IconProps) => null);
    await wrap(<RowsCard rows={[{ key: 'a', title: 'Bright, indirect light', icon: Icon }]} />);
    expect(Icon.mock.calls[0]?.[0]).toMatchObject({ size: 24, color: '#2E6B4E', strokeWidth: 2 });
  });
  it('TextField shows its label and value', async () => {
    await wrap(<TextField label="Handle" value="@siobhanplants" onChangeText={() => {}} focused />);
    expect(screen.getByText('Handle')).toBeTruthy();
    expect(screen.getByDisplayValue('@siobhanplants')).toBeTruthy();
  });
  it('Snackbar offers Undo', async () => {
    const onUndo = jest.fn();
    await wrap(<Snackbar text="Check-in saved." onUndo={onUndo} withTabBar />);
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
  });
  it('Snackbar sits 16 pt above the in-flow tab bar, or above the bottom safe area without one', async () => {
    const inset = (ui: React.ReactElement) => (
      <SafeAreaInsetsContext.Provider value={{ top: 0, left: 0, right: 0, bottom: 34 }}>
        {ui}
      </SafeAreaInsetsContext.Provider>
    );
    const bottomOf = (name: string) =>
      (StyleSheet.flatten(screen.getByText(name).parent?.props.style) as { bottom: number }).bottom;
    await wrap(inset(<Snackbar text="With bar" withTabBar />));
    expect(bottomOf('With bar')).toBe(16);
    await wrap(inset(<Snackbar text="No bar" />));
    expect(bottomOf('No bar')).toBe(50);
  });
  it('Note and EmptyState render their sentence', async () => {
    await wrap(
      <>
        <Note text="This didn't use an identification." />
        <EmptyState text="No plants yet. Scan one, or scan the label it came with." />
      </>,
    );
    expect(screen.getByText("This didn't use an identification.")).toBeTruthy();
    expect(
      screen.getByText('No plants yet. Scan one, or scan the label it came with.'),
    ).toBeTruthy();
  });
  it('TextField announces its error and keeps it as the input hint', async () => {
    await wrap(
      <TextField
        label="Handle"
        value="@taken"
        onChangeText={() => {}}
        error="That handle is taken."
      />,
    );
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('That handle is taken.');
    expect(error.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByDisplayValue('@taken').props.accessibilityHint).toBe(
      'That handle is taken.',
    );
    expect(StyleSheet.flatten(screen.getByDisplayValue('@taken').props.style)).toMatchObject({
      borderColor: '#9B1C1C',
    });
  });
  it('TextField shows a title and a body for a structured error, announced together', async () => {
    await wrap(
      <TextField
        label="Town"
        value="Ballynahinchh"
        onChangeText={() => {}}
        focused
        error={{
          title: "We couldn't find that town",
          body: 'Check the spelling, or move the area on the map instead.',
        }}
      />,
    );
    expect(screen.getByText("We couldn't find that town")).toBeTruthy();
    expect(
      screen.getByText('Check the spelling, or move the area on the map instead.'),
    ).toBeTruthy();
    const alert = screen.getByRole('alert');
    expect(alert.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByDisplayValue('Ballynahinchh').props.accessibilityHint).toBe(
      "We couldn't find that town. Check the spelling, or move the area on the map instead.",
    );
    // A town that is not found is not a validation failure: the ring stays the focused primary.
    expect(StyleSheet.flatten(screen.getByDisplayValue('Ballynahinchh').props.style)).toMatchObject(
      {
        borderColor: '#2E6B4E',
      },
    );
  });
  it('TextField without an error has no alert', async () => {
    await wrap(<TextField label="Handle" value="@free" onChangeText={() => {}} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
