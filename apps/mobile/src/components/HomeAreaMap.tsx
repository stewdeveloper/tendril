import { radius } from '@tendril/core';
import { StyleSheet, View } from 'react-native';
import { AreaOverlay, DEFAULT_RADIUS_M, type MapCenter } from './HomeAreaParts';
import { PhotoSlot } from './PhotoSlot';

export interface HomeAreaMapProps {
  /** The area's radius in metres. */
  radiusM?: number;
  onRadiusChange?: (radiusM: number) => void;
  /** The area's centre. The placeholder has no tiles, so it is only used by the native map. */
  center?: MapCenter;
  onCenterChange?: (center: MapCenter) => void;
  height: number;
  /** Faded, with no circle: the map while the town search has failed (3j). */
  inactive?: boolean;
}

/**
 * The web and catalog map (3i, 3j): react-native-maps has no web support, so this draws the
 * design's "Map tiles" placeholder with the area circle, centre dot and handle over it. The native
 * map is `HomeAreaMap.native.tsx`; both take the same props.
 */
export function HomeAreaMap({
  radiusM = DEFAULT_RADIUS_M,
  onRadiusChange,
  height,
  inactive = false,
}: HomeAreaMapProps) {
  return (
    <View style={[styles.card, { height, opacity: inactive ? 0.6 : 1 }]}>
      <PhotoSlot label="Map tiles" height={height} />
      {inactive ? null : <AreaOverlay radiusM={radiusM} onRadiusChange={onRadiusChange} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, overflow: 'hidden' },
});
