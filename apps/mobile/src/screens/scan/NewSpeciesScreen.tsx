import {
  momentCopy,
  noPointsReasonLine,
  plantdexSpecies,
  copy,
  motion,
  setProgressValue,
  type Outcome,
  type SpeciesRef,
} from '@tendril/core';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Note } from '../../components/Note';
import { PhotoSlot } from '../../components/PhotoSlot';
import { RarityBadge } from '../../components/RarityBadge';
import { RowsCard, type Row } from '../../components/RowsCard';
import { useInsets } from '../../components/useInsets';
import { AppText } from '../../theme';

export interface NewSpeciesScreenProps {
  species: SpeciesRef;
  outcome: Outcome;
  /** What the placeholder says when there is no photo ("Your photo: foxglove"). */
  photoLabel: string;
  photoUri?: string | null;
  /** The OS Reduce Motion setting: the card only fades. */
  reduceMotion: boolean;
  /** Says why the card only fades (the catalog's 4ac). The app never shows it. */
  showReduceMotionNote?: boolean;
  /** Draws the final state at once, with no entrance (the catalog, so captures do not race it). */
  settled?: boolean;
  onContinue: () => void;
}

// The JS driver: a 300 ms fade and scale of one card needs no native thread, and its values reach
// the rendered props, which the entrance and skip tests read.
const useNativeDriver = false;
// Under 1.5 s, and 250 ms is the app's base motion.
const ENTRANCE_MS = motion.slow;
const SCALE_FROM = 0.94;

/**
 * "New to your Plantdex" (4ab to 4ae): the photo, the species, its rarity and what the find earned.
 * The card scales and fades in over 300 ms; a tap anywhere skips that. With Reduce Motion it only
 * fades. Props only.
 */
export function NewSpeciesScreen({
  species,
  outcome,
  photoLabel,
  photoUri,
  reduceMotion,
  showReduceMotionNote = false,
  settled = false,
  onContinue,
}: NewSpeciesScreenProps) {
  const insets = useInsets();
  const [progress] = useState(() => new Animated.Value(settled ? 1 : 0));

  useEffect(() => {
    if (settled) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: ENTRANCE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, settled]);

  const skip = () => {
    progress.stopAnimation();
    progress.setValue(1);
  };

  const awarded = outcome.pointsStatus === 'awarded';
  const rows: Row[] = [
    { key: 'points', title: momentCopy.points, right: `+${outcome.points}`, rightColor: 'primary' },
    {
      key: 'plantdex',
      title: momentCopy.plantdex,
      right: plantdexSpecies(outcome.plantdexCount),
    },
    ...outcome.sets.map((s) => ({
      key: `set-${s.setId}`,
      title: s.name,
      right: setProgressValue(s.found, s.total),
    })),
  ];
  const noPoints =
    outcome.pointsStatus === 'held' ? copy.pointsHeld : noPointsReasonLine(outcome.noPointsReason);

  let detail: React.ReactNode = null;
  if (showReduceMotionNote)
    detail = (
      <AppText variant="sub" color="textSecondary">
        {momentCopy.reduceMotionNote}
      </AppText>
    );
  else if (awarded) detail = <RowsCard rows={rows} />;
  else if (noPoints) detail = <Note text={noPoints} />;

  const tall = awarded || showReduceMotionNote;
  const style = {
    opacity: progress,
    ...(reduceMotion
      ? null
      : {
          transform: [
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [SCALE_FROM, 1] }) },
          ],
        }),
  };

  return (
    <Pressable
      testID="moment-skip"
      accessible={false}
      importantForAccessibility="no"
      onPress={skip}
      style={styles.root}
    >
      <Animated.View
        testID="moment-card"
        style={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: Math.max(42, insets.bottom + 8) },
          style,
        ]}
      >
        <View style={styles.flex} />
        <View style={[styles.photo, { height: tall ? 260 : 220 }]}>
          <PhotoSlot
            uri={photoUri ?? species.imageUrl}
            label={photoLabel}
            height={tall ? 260 : 220}
            radius={16}
          />
        </View>
        {awarded && !showReduceMotionNote ? (
          <AppText variant="sub" color="textSecondary">
            {momentCopy.newToPlantdex}
          </AppText>
        ) : null}
        <AppText variant="moment" accessibilityRole="header" style={styles.name}>
          {species.commonName}
        </AppText>
        <AppText variant="sci" color="textSecondary">
          {species.scientificName}
        </AppText>
        <RarityBadge tier={species.rarity} style={styles.badge} />
        {detail}
        <View style={styles.flex} />
        <View style={styles.action}>
          <Button label={momentCopy.continue} onPress={onContinue} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, gap: 18 },
  flex: { flex: 1 },
  photo: { borderRadius: 16, overflow: 'hidden' },
  // The frame pulls the name 10 pt and the badge 6 pt closer to what follows, and Continue 8 pt.
  name: { marginBottom: -10 },
  badge: { alignSelf: 'flex-start', marginBottom: -6 },
  action: { marginTop: -8 },
});
