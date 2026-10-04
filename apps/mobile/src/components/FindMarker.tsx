import { colors } from '@tendril/core';
import { StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';

export type FindMarkerKind = 'exact' | 'area' | 'hidden';

export interface FindMarkerProps {
  kind: FindMarkerKind;
}

const DOT = 16;
const DOT_RING = 3;
const AREA = 80;
const AREA_RING = 2.5;
/** The pin's ring is white on a map photo in both schemes, as HeroHeader's on-photo controls are. */
const ON_MAP = colors.light.surface;

/** A primary colour at 16%: the shared area's fill (3i). The tokens are 6-digit hex. */
function tint(hex: string): string {
  return `${hex}29`;
}

/**
 * How a find sits on the map. Exact: a 16 pt dot with a white ring, which only the owner sees.
 * Area: an 80 pt circle at 16% primary with a primary ring, the most anything shared shows.
 * Hidden: no mark at all, only the caption that says why.
 */
export function FindMarker({ kind }: FindMarkerProps) {
  const { c } = useTheme();
  if (kind === 'hidden') {
    return (
      <AppText variant="caption" color="textSecondary">
        Hidden: near home or sensitive
      </AppText>
    );
  }
  if (kind === 'exact') {
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Exact location, only you see it"
        // The ring is a border, so the 16 pt dot sits inside a 22 pt box.
        style={[styles.dot, { backgroundColor: c.primary, borderColor: ON_MAP }]}
      />
    );
  }
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Shared area"
      style={[styles.area, { backgroundColor: tint(c.primary), borderColor: c.primary }]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: DOT + DOT_RING * 2,
    height: DOT + DOT_RING * 2,
    borderRadius: (DOT + DOT_RING * 2) / 2,
    borderWidth: DOT_RING,
  },
  area: {
    width: AREA,
    height: AREA,
    borderRadius: AREA / 2,
    borderWidth: AREA_RING,
  },
});
