import { collectionCopy, radius } from '@tendril/core';
import { StyleSheet, View } from 'react-native';
import type { FindsMapProps } from './FindsMap';
import { PhotoSlot } from './PhotoSlot';

/**
 * The web and catalog map (4am): react-native-maps has no web support, so this draws the design's
 * "Map with your exact pins" placeholder. It takes the native map's props and draws no pins.
 */
export function FindsMap({ height }: FindsMapProps) {
  return (
    <View style={[styles.card, { height }]}>
      <PhotoSlot label={collectionCopy.mapAlt} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, overflow: 'hidden' },
});
