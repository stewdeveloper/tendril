import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaFrame, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CatalogFrame } from './CatalogFrame';

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
