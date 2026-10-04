import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { ThemeProvider } from '../theme';
import { TabBar, TabBarView } from './TabBar';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

describe('TabBar', () => {
  it('always shows all five labels and marks the active tab', async () => {
    const onTab = jest.fn();
    const onScan = jest.fn();
    await render(
      <ThemeProvider scheme="light">
        <TabBarView active="today" onTab={onTab} onScan={onScan} />
      </ThemeProvider>,
    );
    for (const label of ['Today', 'My Plants', 'Scan', 'Collection', 'Leagues'])
      expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Today' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Leagues' }));
    expect(onTab).toHaveBeenCalledWith('leagues');
    await fireEvent.press(screen.getByRole('tab', { name: 'Scan' }));
    expect(onScan).toHaveBeenCalled();
    expect(onTab).not.toHaveBeenCalledWith('scan');
  });
});

describe('TabBar geometry', () => {
  it('keeps the raised Scan button inside its parent, for Android touch delivery', async () => {
    await render(
      <ThemeProvider scheme="light">
        <TabBarView active="today" onTab={jest.fn()} onScan={jest.fn()} />
      </ThemeProvider>,
    );
    const flat = (el: { props: { style?: unknown } }) =>
      StyleSheet.flatten(el.props.style as StyleProp<ViewStyle>) ?? {};
    const scan = flat(screen.getByRole('tab', { name: 'Scan' }));
    // The circle's top sits in the container (no negative offset), as do its 60 pt and its label.
    expect(scan.marginTop ?? 0).toBeGreaterThanOrEqual(0);
    const outer = flat(screen.getByTestId('tab-bar'));
    expect(outer.height).toBe(118);
    // Layout footprint is the 90 pt bar: the 28 pt raise is a negative margin on the container.
    expect(outer.marginTop).toBe(-28);
    expect(Number(scan.marginTop ?? 0) + 60 + 2 + 16).toBeLessThanOrEqual(outer.height as number);
    // The container and its row let touches outside the items through.
    expect(screen.getByTestId('tab-bar').props.pointerEvents).toBe('box-none');
  });
});

describe('TabBar (router state)', () => {
  const routes = [
    'today/index',
    'plants/index',
    'scan',
    'collection/index',
    'leagues/index',
    'today/streaks',
  ].map((name) => ({ key: `${name}-key`, name }));
  const setup = (focused: string, defaultPrevented = false) => {
    const navigation = {
      emit: jest.fn(() => ({ defaultPrevented })),
      navigate: jest.fn(),
    };
    const state = { routes, index: routes.findIndex((r) => r.name === focused) };
    const props = { state, navigation } as unknown as React.ComponentProps<typeof TabBar>;
    return {
      navigation,
      view: render(
        <ThemeProvider scheme="light">
          <TabBar {...props} />
        </ThemeProvider>,
      ),
    };
  };

  beforeEach(() => mockPush.mockClear());

  it('files the Streaks screen under Today', async () => {
    await setup('today/streaks').view;
    expect(screen.getByRole('tab', { name: 'Today' })).toBeSelected();
  });

  it('switches tabs through the navigator, with the tab press event', async () => {
    const { navigation, view } = setup('today/index');
    await view;
    await fireEvent.press(screen.getByRole('tab', { name: 'Collection' }));
    expect(navigation.emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'collection/index-key',
      canPreventDefault: true,
    });
    expect(navigation.navigate).toHaveBeenCalledWith('collection/index', undefined);
  });

  it('does not navigate when a listener prevents the press', async () => {
    const { navigation, view } = setup('today/index', true);
    await view;
    await fireEvent.press(screen.getByRole('tab', { name: 'My Plants' }));
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('pushes the camera for Scan instead of switching tabs', async () => {
    const { navigation, view } = setup('today/index');
    await view;
    await fireEvent.press(screen.getByRole('tab', { name: 'Scan' }));
    expect(mockPush).toHaveBeenCalledWith('/camera');
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
