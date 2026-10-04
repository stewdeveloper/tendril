import { collectionCopy, radius, type FindListItem } from '@tendril/core';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, type Region } from 'react-native-maps';
import { useTheme } from '../theme';
import { findPins, type FindPin } from './findsMapPins';

export interface FindsMapProps {
  /** The person's own finds. The map decides which can be pinned. */
  finds: FindListItem[];
  height: number;
}

/** Dublin, until there is a pin to look at. */
const DEFAULT_REGION: Region = {
  latitude: 53.3498,
  longitude: -6.2603,
  latitudeDelta: 0.2,
  longitudeDelta: 0.2,
};
/** The smallest span, so a single pin is not a street-level zoom. */
const MIN_DELTA = 0.02;

/** A region that holds every pin with some air around it. */
function regionFor(pins: FindPin[]): Region {
  if (pins.length === 0) return DEFAULT_REGION;
  const lats = pins.map((p) => p.latitude);
  const lngs = pins.map((p) => p.longitude);
  const [minLat, maxLat] = [Math.min(...lats), Math.max(...lats)];
  const [minLng, maxLng] = [Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, MIN_DELTA),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, MIN_DELTA),
  };
}

/**
 * The native finds map (4am): an exact pin for each of the person's own finds that is not a
 * sensitive species. Only they see it, which is why exact coordinates are fine here. The web and
 * catalog map is `FindsMap.web.tsx`; both take the same props.
 */
export function FindsMap({ finds, height }: FindsMapProps) {
  const { c } = useTheme();
  const pins = useMemo(() => findPins(finds), [finds]);
  const region = useMemo(() => regionFor(pins), [pins]);
  return (
    <View
      accessibilityLabel={collectionCopy.mapAlt}
      style={[styles.card, { height, backgroundColor: c.primaryTint }]}
    >
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        showsUserLocation={false}
      >
        {pins.map((p) => (
          <Marker
            key={p.observationId}
            testID={`find-pin-${p.observationId}`}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            pinColor={c.primary}
            tracksViewChanges={false}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, overflow: 'hidden' },
});
