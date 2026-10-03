import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import { ThemeProvider } from '../theme';
import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('shows a title, content and a close button; close and backdrop each call onClose once', async () => {
    const onClose = jest.fn();
    await render(
      <ThemeProvider scheme="light">
        <Sheet visible title="Check-in" onClose={onClose}>
          <Text>{"Is the top of Monty's soil dry?"}</Text>
        </Sheet>
      </ThemeProvider>,
    );
    expect(screen.getByText('Check-in')).toBeTruthy();
    expect(screen.getByText("Is the top of Monty's soil dry?")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it('Android back (Modal onRequestClose) calls onClose', async () => {
    const onClose = jest.fn();
    await render(
      <ThemeProvider scheme="light">
        <Sheet visible title="Log a find" onClose={onClose}>
          <Text>x</Text>
        </Sheet>
      </ThemeProvider>,
    );
    await fireEvent(screen.getByTestId('sheet-modal'), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('renders nothing when not visible', async () => {
    await render(
      <ThemeProvider scheme="light">
        <Sheet visible={false} title="Hidden" onClose={() => {}}>
          <Text>x</Text>
        </Sheet>
      </ThemeProvider>,
    );
    expect(screen.queryByText('Hidden')).toBeNull();
  });
  it('slides up, or only fades when Reduce Motion is on', async () => {
    const reduce = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled');
    const sheet = (
      <ThemeProvider scheme="light">
        <Sheet visible title="Check-in" onClose={() => {}}>
          <Text>x</Text>
        </Sheet>
      </ThemeProvider>
    );
    const transformOf = () => StyleSheet.flatten(screen.getByTestId('sheet').props.style).transform;

    reduce.mockResolvedValue(false);
    const first = await render(sheet);
    expect(transformOf()).toEqual([{ translateY: expect.any(Number) }]);
    await first.unmount();

    reduce.mockResolvedValue(true);
    await render(sheet);
    await waitFor(() => expect(transformOf()).toEqual([]));
    reduce.mockRestore();
  });
});
