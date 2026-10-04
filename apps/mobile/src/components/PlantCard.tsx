import { radius, type IsoDate, type PlantSummary } from '@tendril/core';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';
import { dayMonth, daysBetween, deviceToday, sinceLabel, weekdayName } from './dates';

export interface PlantCardProps {
  plant: PlantSummary;
  onPress: () => void;
  /**
   * `card` (the default) is a card of its own with a lead (5e). `row` is one line of a RowsCard,
   * as My Plants draws it (4i): no lead, plain type, the frame's 12/16 padding and divider.
   */
  variant?: 'card' | 'row';
  /** The calendar date "yesterday" and "tomorrow" are counted from. Defaults to the device's date. */
  today?: IsoDate;
}

const LEAD = 44;

/** The right-hand line of a plant card, and whether it is the call to act (due, in `primary`). */
export function nextCheckText(
  plant: PlantSummary,
  today: IsoDate,
): { text: string; emphasis: boolean } {
  if (plant.status === 'dead') {
    const when = plant.statusOn ? dayMonth(plant.statusOn) : null;
    return { text: when ? `Died ${when}` : 'Died', emphasis: false };
  }
  if (plant.status === 'given_away') return { text: 'Given away', emphasis: false };
  switch (plant.careState) {
    case 'due':
      return { text: 'Check today', emphasis: true };
    case 'overdue': {
      const since = sinceLabel(plant.nextCheckOn, today);
      return { text: since ? `Since ${since}` : 'Overdue', emphasis: false };
    }
    case 'paused':
      return { text: plant.pausedNote ?? 'Paused', emphasis: false };
    case 'ok': {
      if (!plant.nextCheckOn) return { text: '', emphasis: false };
      // Tomorrow, then the weekday for the rest of this week, then the date.
      const ahead = daysBetween(today, plant.nextCheckOn);
      const text =
        ahead === 1
          ? 'Tomorrow'
          : ahead != null && ahead >= 2 && ahead <= 6
            ? (weekdayName(plant.nextCheckOn) ?? '')
            : (dayMonth(plant.nextCheckOn) ?? '');
      return { text, emphasis: false };
    }
    case 'closed':
      return { text: '', emphasis: false };
  }
}

/**
 * A plant in My Plants and Today. The `card` variant (5e) is a card of its own: a 44 pt photo or
 * initial, the nickname, the species in italics and when it is next checked. The `row` variant is
 * one line of a RowsCard exactly as frame 4i draws it. A plant that has died or been given away
 * stays in the list at 0.6 opacity, kept in the history.
 */
export function PlantCard({ plant, onPress, variant = 'card', today }: PlantCardProps) {
  const { c } = useTheme();
  const next = nextCheckText(plant, today ?? deviceToday());
  const dimmed = plant.status !== 'alive' ? 0.6 : 1;
  const label = [plant.nickname, plant.species.commonName, next.text].filter(Boolean).join(', ');
  const nextText = next.text ? (
    <AppText
      variant="caption"
      color={next.emphasis ? 'primary' : 'textSecondary'}
      style={styles.next}
    >
      {next.text}
    </AppText>
  ) : null;

  if (variant === 'row') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? c.pressedOverlay : 'transparent',
            borderBottomColor: c.divider,
            opacity: dimmed,
          },
        ]}
      >
        <View style={styles.text}>
          <AppText variant="body">{plant.nickname}</AppText>
          <AppText variant="sub" color="textSecondary" style={styles.species}>
            {plant.species.commonName}
          </AppText>
        </View>
        {nextText}
      </Pressable>
    );
  }

  const initial = Array.from(plant.nickname.trim())[0]?.toUpperCase() ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.hairline, opacity: dimmed },
      ]}
    >
      {({ pressed }) => (
        <>
          {pressed ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: c.pressedOverlay }]} />
          ) : null}
          <View style={[styles.lead, { backgroundColor: c.primaryTint }]}>
            {plant.photoUrl ? (
              <Image
                source={{ uri: plant.photoUrl }}
                contentFit="cover"
                accessibilityLabel={`Photo of ${plant.nickname}`}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <AppText variant="bodyStrong" color="primary" maxFontSizeMultiplier={1.3} aria-hidden>
                {initial}
              </AppText>
            )}
          </View>
          <View style={styles.text}>
            <AppText variant="bodyStrong">{plant.nickname}</AppText>
            <AppText variant="sci" color="textSecondary">
              {plant.species.commonName}
            </AppText>
          </View>
          {nextText}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The frame's hairline is an outer ring that takes no layout space: a 1 pt border and a -1 pt
  // margin put the ring in the same place (the same trick as Card and RowsCard).
  card: {
    margin: -1,
    borderWidth: 1,
    borderRadius: radius.card,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  // 4i, inside a RowsCard: the same row RowsCard draws (12/16 padding, 53 pt minimum, divider).
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 53,
    borderBottomWidth: 1,
  },
  lead: {
    width: LEAD,
    height: LEAD,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  species: { lineHeight: 20 },
  next: { textAlign: 'right', flexShrink: 1, maxWidth: '40%' },
});
