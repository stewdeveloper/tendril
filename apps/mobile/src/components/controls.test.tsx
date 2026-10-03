import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../theme';
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
  it('TextField shows its label and value', async () => {
    await wrap(<TextField label="Handle" value="@siobhanplants" onChangeText={() => {}} focused />);
    expect(screen.getByText('Handle')).toBeTruthy();
    expect(screen.getByDisplayValue('@siobhanplants')).toBeTruthy();
  });
  it('Snackbar offers Undo', async () => {
    const onUndo = jest.fn();
    await wrap(<Snackbar text="Check-in saved." onUndo={onUndo} bottomOffset={106} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
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
});
