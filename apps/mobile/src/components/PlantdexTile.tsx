import { radius, type SpeciesRef } from '@tendril/core';
import CircleQuestionMark from 'lucide-react-native/icons/circle-question-mark';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';
import { DECORATIVE } from './decorative';
import { PhotoSlot } from './PhotoSlot';
import { RarityBadge } from './RarityBadge';

export interface PlantdexTileProps {
  /** Null for a species the person has not found: the tile is a silhouette. */
  species: SpeciesRef | null;
  found: boolean;
  /** The set a missing species belongs to, shown under "Not found yet". */
  setName?: string;
  /** The person's own photo; falls back to the species' reference image. */
  photoUrl?: string | null;
  onPress?: () => void;
}

const PHOTO_HEIGHT = 120;
const RING = 1.5;

/**
 * One species in the Plantdex grid (2f). Found: photo, common name, scientific name in italics and
 * the rarity badge. Missing: a silhouette that reads "Not found yet" and names its set. A sensitive
 * species says "Location private" in place of its scientific name and shows no rarity (4aj).
 */
export function PlantdexTile({ species, found, setName, photoUrl, onPress }: PlantdexTileProps) {
  const { c } = useTheme();
  if (!found || !species) {
    const missing = (
      <>
        {/* The frame's ring is an inset shadow, so the tinted top paints over it. Drawing it first
            and the content after gives the same stacking. */}
        <View pointerEvents="none" style={[styles.ring, { borderColor: c.border }]} />
        <View style={[styles.silhouette, { backgroundColor: c.primaryTint }]}>
          <CircleQuestionMark {...DECORATIVE} size={40} color={c.primary} strokeWidth={1.6} />
        </View>
        <View style={styles.missingText}>
          <AppText variant="bodyStrong">Not found yet</AppText>
          {setName ? (
            <AppText variant="sub" color="textSecondary" style={styles.line}>
              {setName}
            </AppText>
          ) : null}
        </View>
      </>
    );
    const silhouette = [styles.tile, { backgroundColor: c.background }];
    return onPress ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Not found yet"
        onPress={onPress}
        style={silhouette}
      >
        {({ pressed }) => (
          <>
            {missing}
            {pressed ? <PressedOverlay /> : null}
          </>
        )}
      </Pressable>
    ) : (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Not found yet"
        style={silhouette}
      >
        {missing}
      </View>
    );
  }
  const body = (
    <>
      <PhotoSlot
        uri={photoUrl ?? species.imageUrl}
        label={species.commonName}
        height={PHOTO_HEIGHT}
      />
      <View style={styles.foundText}>
        <View>
          <AppText variant="bodyStrong">{species.commonName}</AppText>
          {species.sensitive ? (
            <AppText variant="sub" color="textSecondary" style={styles.line}>
              Location private
            </AppText>
          ) : (
            <AppText variant="sci" color="textSecondary">
              {species.scientificName}
            </AppText>
          )}
        </View>
        {/* A sensitive species never shows its rarity (4aj). */}
        {species.sensitive ? null : <RarityBadge tier={species.rarity} />}
      </View>
    </>
  );
  const look = [styles.tile, styles.found, { backgroundColor: c.surface, borderColor: c.hairline }];
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={look}>
      {({ pressed }) => (
        <>
          {body}
          {pressed ? <PressedOverlay /> : null}
        </>
      )}
    </Pressable>
  ) : (
    <View style={look}>{body}</View>
  );
}

/** The pressed state: the shared overlay over the tile, as Button draws it, not a new fill. */
function PressedOverlay() {
  const { c } = useTheme();
  return <View style={[styles.pressed, { backgroundColor: c.pressedOverlay }]} />;
}

const styles = StyleSheet.create({
  pressed: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  tile: { borderRadius: radius.card, overflow: 'hidden' },
  // The hairline is an outer ring in the frame: a 1 pt border and a -1 pt margin keep the content
  // where the frame puts it, so a grid of tiles lines up (the same trick as Card).
  found: { margin: -1, borderWidth: 1 },
  ring: {
    ...StyleSheet.absoluteFill,
    borderWidth: RING,
    borderRadius: radius.card,
  },
  silhouette: {
    height: PHOTO_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foundText: {
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 6,
    alignItems: 'flex-start',
  },
  missingText: { paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12 },
  line: { lineHeight: 20 },
});
