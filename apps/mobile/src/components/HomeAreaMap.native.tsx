import { radius } from '@tendril/core';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';
import { useTheme } from '../theme';
import { withAlpha } from './colorAlpha';
import type { HomeAreaMapProps } from './HomeAreaMap';
import { DEFAULT_RADIUS_M, METRES_PER_POINT, RadiusHandle, type MapCenter } from './HomeAreaParts';

export type { HomeAreaMapProps };

/** Metres in a degree of latitude. */
const METRES_PER_DEGREE = 111_320;
/** Dublin, until the person searches or moves the map. */
const DEFAULT_CENTER: MapCenter = { lat: 53.3498, lng: -6.2603 };
const SAME = 0.00005;

/**
 * The native map (3i): the area's circle and centre marker follow the map's centre once a pan settles
 * (zoom is fixed, so 1 pt is always 20 m), and the handle on the circle's edge resizes it. Search
 * results move the map through `center`.
 */
export function HomeAreaMap({
  radiusM = DEFAULT_RADIUS_M,
  onRadiusChange,
  center = DEFAULT_CENTER,
  onCenterChange,
  height,
  inactive = false,
}: HomeAreaMapProps) {
  const { c } = useTheme();
  const map = useRef<MapView>(null);
  const reported = useRef(center);
  const [width, setWidth] = useState(0);

  // A new centre from outside (a search result) moves the map; one the map itself reported does not.
  useEffect(() => {
    const moved =
      Math.abs(center.lat - reported.current.lat) > SAME ||
      Math.abs(center.lng - reported.current.lng) > SAME;
    if (!moved || width === 0) return;
    reported.current = center;
    map.current?.animateToRegion(regionFor(center, width, height), 300);
  }, [center, width, height]);

  return (
    <View
      style={[styles.card, { height, opacity: inactive ? 0.6 : 1 }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <MapView
          ref={map}
          style={StyleSheet.absoluteFill}
          initialRegion={regionFor(center, width, height)}
          zoomEnabled={false}
          zoomTapEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          showsUserLocation={false}
          onRegionChangeComplete={(r) => {
            reported.current = { lat: r.latitude, lng: r.longitude };
            onCenterChange?.(reported.current);
          }}
        >
          {inactive ? null : (
            <>
              <Circle
                center={{ latitude: center.lat, longitude: center.lng }}
                radius={radiusM}
                strokeWidth={2.5}
                strokeColor={c.primary}
                fillColor={withAlpha(c.primary, 0.16)}
              />
              <Marker
                coordinate={{ latitude: center.lat, longitude: center.lng }}
                pinColor={c.primary}
                tracksViewChanges={false}
                accessibilityLabel="Home area centre"
              />
            </>
          )}
        </MapView>
      ) : null}
      {inactive ? null : <RadiusHandle radiusM={radiusM} onRadiusChange={onRadiusChange} />}
    </View>
  );
}

/** A region whose scale is fixed at 20 m to the point, so the handle's pixels are metres. */
function regionFor(center: MapCenter, width: number, height: number): Region {
  const latitudeDelta = (height * METRES_PER_POINT) / METRES_PER_DEGREE;
  const longitudeDelta =
    (width * METRES_PER_POINT) / (METRES_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180));
  return { latitude: center.lat, longitude: center.lng, latitudeDelta, longitudeDelta };
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, overflow: 'hidden' },
});
