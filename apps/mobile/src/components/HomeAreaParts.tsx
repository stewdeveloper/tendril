import { shadows } from '@tendril/core';
import ChevronsLeftRight from 'lucide-react-native/icons/chevrons-left-right';
import { useEffect, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
} from 'react-native';
import { useTheme } from '../theme';
import { withAlpha } from './colorAlpha';
import { DECORATIVE } from './decorative';

/** The home area's radius, in metres. A 2 km circle is the default; 1 pt on the map is 20 m. */
export const DEFAULT_RADIUS_M = 2000;
export const MIN_RADIUS_M = 500;
export const MAX_RADIUS_M = 3000;
export const METRES_PER_POINT = 20;
const STEP_M = 250;

export interface MapCenter {
  lat: number;
  lng: number;
}

export const clampRadius = (m: number) => Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, m));

/** "2 km", "1.5 km". */
export const radiusLabel = (m: number) => `${Number((m / 1000).toFixed(2))} km`;

/**
 * The circle that marks the area on the web placeholder (3i): a tinted disc with a primary ring, the
 * centre dot, and the handle on the right edge.
 */
export function AreaOverlay({
  radiusM,
  onRadiusChange,
}: {
  radiusM: number;
  onRadiusChange?: (m: number) => void;
}) {
  const { c } = useTheme();
  const r = radiusM / METRES_PER_POINT;
  return (
    <>
      <View
        pointerEvents="none"
        style={[
          styles.circle,
          {
            width: r * 2,
            height: r * 2,
            marginTop: -r,
            marginLeft: -r,
            borderRadius: r,
            borderColor: c.primary,
            backgroundColor: withAlpha(c.primary, 0.16),
          },
        ]}
      />
      <CenterDot />
      <RadiusHandle radiusM={radiusM} onRadiusChange={onRadiusChange} />
    </>
  );
}

/** The 14 pt centre dot with its white ring. */
export function CenterDot() {
  const { c } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[styles.dot, { backgroundColor: c.primary, boxShadow: `0 0 0 3px ${c.surface}` }]}
    />
  );
}

/**
 * The 28 pt handle on the circle's right edge. Drag it sideways to resize the area; for screen
 * readers it is one adjustable control that steps by a quarter of a kilometre.
 */
export function RadiusHandle({
  radiusM,
  onRadiusChange,
}: {
  radiusM: number;
  onRadiusChange?: (m: number) => void;
}) {
  const { c } = useTheme();
  const start = useRef(radiusM);
  // The responder is created once, so it reads the latest props through a ref.
  const latest = useRef({ radiusM, onRadiusChange });
  useEffect(() => {
    latest.current = { radiusM, onRadiusChange };
  });
  // The responder is built once and reads the latest props through `latest` when a gesture moves,
  // never while rendering; the lint rule can't see that the refs are only touched in handlers.
  // eslint-disable-next-line react-hooks/refs
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // The map underneath must not take the drag from the handle.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        start.current = latest.current.radiusM;
      },
      onPanResponderMove: (_e: GestureResponderEvent, g) => {
        latest.current.onRadiusChange?.(clampRadius(start.current + g.dx * METRES_PER_POINT));
      },
    }),
  );
  const step = (e: AccessibilityActionEvent) => {
    const delta = e.nativeEvent.actionName === 'increment' ? STEP_M : -STEP_M;
    onRadiusChange?.(clampRadius(radiusM + delta));
  };
  return (
    <View
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Home area size"
      accessibilityValue={{ text: radiusLabel(radiusM) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={step}
      hitSlop={8}
      style={[
        styles.handle,
        {
          marginLeft: radiusM / METRES_PER_POINT - 14,
          backgroundColor: c.surface,
          boxShadow: `0 0 0 2.5px ${c.primary}, ${shadows.handle}`,
        },
      ]}
    >
      <ChevronsLeftRight {...DECORATIVE} size={16} color={c.primary} strokeWidth={2.4} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute', top: '50%', left: '50%', borderWidth: 2.5 },
  dot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 14,
    height: 14,
    marginTop: -7,
    marginLeft: -7,
    borderRadius: 7,
  },
  handle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
