import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, StyleSheet, Text } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme';
import { Sheet, SheetOverlay, SheetPanel } from './index';

interface Node {
  type: string;
  children?: (Node | string)[] | null;
}

/** Every host element type in the rendered tree. */
function hostTypes(node: Node | Node[] | string | null, out = new Set<string>()): Set<string> {
  if (node == null || typeof node === 'string') return out;
  if (Array.isArray(node)) {
    node.forEach((n) => hostTypes(n, out));
    return out;
  }
  out.add(node.type);
  node.children?.forEach((n) => hostTypes(n, out));
  return out;
}

const withInsets = (ui: React.ReactElement, top = 59) => (
  <ThemeProvider scheme="light">
    <SafeAreaInsetsContext.Provider value={{ top, bottom: 34, left: 0, right: 0 }}>
      {ui}
    </SafeAreaInsetsContext.Provider>
  </ThemeProvider>
);

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
    // RN's jest setup makes this a jest.fn, so restore its resolved-false default by hand.
    reduce.mockResolvedValue(false);
  });
});

describe('SheetPanel and SheetOverlay', () => {
  it('SheetOverlay draws the scrim and the panel inline, with no Modal', async () => {
    const onClose = jest.fn();
    await render(
      <ThemeProvider scheme="light">
        <SheetOverlay title="Check-in" onClose={onClose} height={522}>
          <Text>Is the top of the soil dry?</Text>
        </SheetOverlay>
      </ThemeProvider>,
    );
    expect(screen.getByText('Check-in')).toBeTruthy();
    expect(screen.getByText('Is the top of the soil dry?')).toBeTruthy();
    expect(hostTypes(screen.toJSON() as never).has('Modal')).toBe(false);
    expect(StyleSheet.flatten(screen.getByTestId('sheet-overlay-scrim').props.style)).toMatchObject(
      {
        backgroundColor: 'rgba(18,23,20,0.45)',
      },
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await fireEvent.press(screen.getByTestId('sheet-overlay-scrim'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Sheet, by contrast, is a Modal', async () => {
    await render(
      <ThemeProvider scheme="light">
        <Sheet visible title="Check-in" onClose={() => {}}>
          <Text>x</Text>
        </Sheet>
      </ThemeProvider>,
    );
    expect(hostTypes(screen.toJSON() as never).has('Modal')).toBe(true);
  });

  it('keeps the title outside a scrolling body', async () => {
    await render(
      <ThemeProvider scheme="light">
        <SheetPanel title="Check-in" onClose={() => {}}>
          <Text>Long content</Text>
        </SheetPanel>
      </ThemeProvider>,
    );
    const body = screen.getByTestId('sheet-body');
    expect(body.type).toBe('RCTScrollView');
    expect(within(body).getByText('Long content')).toBeTruthy();
    expect(within(body).queryByText('Check-in')).toBeNull();
    expect(within(body).queryByRole('button', { name: 'Close' })).toBeNull();
    expect(screen.getByRole('header', { name: 'Check-in' })).toBeTruthy();
  });

  it.each([['auto' as const], [2000]])(
    'never grows past the window minus the top inset (height %s)',
    async (height) => {
      await render(
        withInsets(
          <SheetPanel title="Check-in" onClose={() => {}} height={height}>
            <Text>x</Text>
          </SheetPanel>,
        ),
      );
      const style = StyleSheet.flatten(screen.getByTestId('sheet-panel').props.style);
      expect(style.maxHeight).toBe(Dimensions.get('window').height - 59 - 8);
    },
  );

  it('passes a fixed height through below the cap', async () => {
    await render(
      withInsets(
        <SheetPanel title="Check-in" onClose={() => {}} height={522}>
          <Text>x</Text>
        </SheetPanel>,
      ),
    );
    expect(StyleSheet.flatten(screen.getByTestId('sheet-panel').props.style)).toMatchObject({
      height: 522,
    });
  });

  it('a minHeight is a floor for an auto-height sheet, and does not fix the height', async () => {
    await render(
      withInsets(
        <SheetPanel title="Check-in" onClose={() => {}} minHeight={382}>
          <Text>x</Text>
        </SheetPanel>,
      ),
    );
    const style = StyleSheet.flatten(screen.getByTestId('sheet-panel').props.style);
    expect(style.minHeight).toBe(382);
    expect(style.height).toBeUndefined();
  });

  it('clamps minHeight to the cap, so a short window never pushes the title off the top', async () => {
    await render(
      withInsets(
        <SheetPanel title="Check-in" onClose={() => {}} minHeight={100000}>
          <Text>x</Text>
        </SheetPanel>,
      ),
    );
    const style = StyleSheet.flatten(screen.getByTestId('sheet-panel').props.style);
    expect(style.minHeight).toBe(Dimensions.get('window').height - 59 - 8);
    expect(style.minHeight).toBe(style.maxHeight);
  });

  it('ignores minHeight when the height is fixed', async () => {
    await render(
      withInsets(
        <SheetPanel title="Check-in" onClose={() => {}} height={300} minHeight={382}>
          <Text>x</Text>
        </SheetPanel>,
      ),
    );
    const style = StyleSheet.flatten(screen.getByTestId('sheet-panel').props.style);
    expect(style.height).toBe(300);
    expect(style.minHeight).toBeUndefined();
  });
});
