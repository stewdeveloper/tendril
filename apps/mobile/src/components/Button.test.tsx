import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../theme';
import { Button } from './Button';

const wrap = (ui: React.ReactElement, scheme: 'light' | 'dark' = 'light') =>
  render(<ThemeProvider scheme={scheme}>{ui}</ThemeProvider>);

describe('Button', () => {
  it('fires onPress and exposes a button role', async () => {
    const onPress = jest.fn();
    await wrap(<Button label="Add to My Plants" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add to My Plants' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
  it('does not fire when disabled or loading, and says it is loading', async () => {
    const onPress = jest.fn();
    await wrap(
      <>
        <Button label="Continue" onPress={onPress} disabled />
        <Button label="Save" onPress={onPress} loading />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save, loading' }));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });
  it('danger uses the severe colour with chip text in dark mode', async () => {
    await wrap(<Button label="Delete account" onPress={() => {}} variant="danger" />, 'dark');
    const btn = screen.getByRole('button', { name: 'Delete account' });
    expect(StyleSheet.flatten(btn.props.style)).toMatchObject({ backgroundColor: '#F2A3A3' });
  });
  it('meets the 44 pt minimum and does not clip text', async () => {
    await wrap(
      <Button
        label="Call ASPCA Poison Control (888) 426-4435"
        onPress={() => {}}
        variant="secondary"
      />,
    );
    const btn = screen.getByRole('button');
    expect(StyleSheet.flatten(btn.props.style).minHeight).toBeGreaterThanOrEqual(52);
    expect(
      screen.getByText('Call ASPCA Poison Control (888) 426-4435').props.numberOfLines,
    ).toBeUndefined();
  });
  it('ink is the page ink with surface-coloured text, for Continue with Apple (3d)', async () => {
    await wrap(<Button label="Continue with Apple" onPress={() => {}} variant="ink" />);
    const btn = screen.getByRole('button', { name: 'Continue with Apple' });
    expect(StyleSheet.flatten(btn.props.style)).toMatchObject({ backgroundColor: '#1D2420' });
    expect(StyleSheet.flatten(screen.getByText('Continue with Apple').props.style)).toMatchObject({
      color: '#FFFFFF',
    });
  });
});
