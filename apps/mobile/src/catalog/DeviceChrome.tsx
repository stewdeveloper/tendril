import { colors, type Scheme } from '@tendril/core';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

export interface DeviceChromeProps {
  scheme: Scheme;
  /** Status bar text colour: dark ink on light screens, white over photos and dark screens. */
  statusBar: 'dark' | 'light';
}

/**
 * iPhone 16 chrome copied from design/frames/2e.html: 54 pt status bar (9:41, signal, battery),
 * the 124x36 Dynamic Island and the 140x5 home indicator. Decorative only, so it ignores touches
 * and is hidden from screen readers.
 */
export function DeviceChrome({ scheme, statusBar }: DeviceChromeProps) {
  const ink = statusBar === 'light' ? colors.light.surface : colors.light.textPrimary;
  const indicator = scheme === 'dark' ? colors.dark.textPrimary : colors.light.textPrimary;
  return (
    <View
      testID="device-chrome"
      // aria-hidden is what react-native-web honours; the other two are the native equivalents.
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.root}
    >
      <View style={styles.island} />
      <View style={styles.statusBar}>
        <Text allowFontScaling={false} style={[styles.time, { color: ink }]}>
          9:41
        </Text>
        <View style={styles.icons}>
          <Svg width={18} height={12} viewBox="0 0 18 12">
            <Rect x={0} y={8} width={3} height={4} rx={1} fill={ink} />
            <Rect x={5} y={5.5} width={3} height={6.5} rx={1} fill={ink} />
            <Rect x={10} y={3} width={3} height={9} rx={1} fill={ink} />
            <Rect x={15} y={0} width={3} height={12} rx={1} fill={ink} />
          </Svg>
          <Svg width={27} height={13} viewBox="0 0 27 13">
            <Rect
              x={0.5}
              y={0.5}
              width={23}
              height={12}
              rx={3.5}
              fill="none"
              stroke={ink}
              opacity={0.45}
            />
            <Rect x={2} y={2} width={20} height={9} rx={2} fill={ink} />
          </Svg>
        </View>
      </View>
      <View style={[styles.homeIndicator, { backgroundColor: indicator }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // pointerEvents lives in style because react-native-web warns about the prop. zIndex keeps frame
  // sheets from painting over the chrome.
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 10,
  },
  island: {
    position: 'absolute',
    top: 11,
    left: '50%',
    marginLeft: -62,
    width: 124,
    height: 36,
    borderRadius: 20,
    // The physical cutout, not a theme colour.
    backgroundColor: '#000000',
    zIndex: 6,
  },
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 48,
    paddingRight: 30,
    zIndex: 5,
  },
  time: { fontFamily: 'Inter_600SemiBold', fontSize: 17, lineHeight: 17 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  homeIndicator: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    marginLeft: -70,
    width: 140,
    height: 5,
    borderRadius: 3,
    zIndex: 6,
  },
});
