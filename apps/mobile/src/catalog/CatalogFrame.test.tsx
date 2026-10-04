import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CatalogFrame } from './CatalogFrame';
import { TabScreenFrame } from './TabScreenFrame';

function Probe() {
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  return (
    <Text>{`insets ${insets.top}/${insets.bottom} frame ${frame.width}x${frame.height}`}</Text>
  );
}

describe('CatalogFrame', () => {
  it('serves the iPhone 16 safe-area insets and frame to its children', async () => {
    await render(
      <CatalogFrame entry={{ id: 'zz-insets', title: 'Insets', render: () => <Probe /> }} />,
    );
    expect(screen.getByText('insets 59/34 frame 393x852')).toBeTruthy();
  });

  it('draws device chrome that is hidden from assistive tech, inert and above the frame', async () => {
    await render(
      <CatalogFrame entry={{ id: 'zz-chrome', title: 'Chrome', render: () => <Text>x</Text> }} />,
    );
    const chrome = screen.getByTestId('device-chrome', { hidden: true });
    expect(chrome.props['aria-hidden']).toBe(true);
    expect(chrome.props.accessibilityElementsHidden).toBe(true);
    expect(chrome.props.importantForAccessibility).toBe('no-hide-descendants');
    // react-native-web warns about the pointerEvents prop, so it lives in style.
    expect(chrome.props.pointerEvents).toBeUndefined();
    expect(StyleSheet.flatten(chrome.props.style)).toMatchObject({
      position: 'absolute',
      top: 0,
      bottom: 0,
      pointerEvents: 'none',
      zIndex: expect.any(Number),
    });
  });
});

describe('TabScreenFrame', () => {
  it('puts the body above an in-flow 90 pt tab bar on the catalog device', async () => {
    await render(
      <CatalogFrame
        entry={{
          id: 'zz-tabs',
          title: 'Tabs',
          render: () => (
            <TabScreenFrame active="plants">
              <Text>body</Text>
            </TabScreenFrame>
          ),
        }}
      />,
    );
    expect(screen.getByText('body')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'My Plants' })).toBeSelected();
    const bar = StyleSheet.flatten(screen.getByTestId('tab-bar').props.style);
    // 56 + 34 of bottom inset, plus the 28 pt strip that overlaps the body.
    expect(bar.height).toBe(118);
    expect(bar.marginTop).toBe(-28);
  });
});
