import { radius, type IsoDate, type PlantSummary } from '@tendril/core';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';
import { dayMonth, deviceToday, sinceLabel, weekdayName } from './dates';

/** What My Plants and Today need to draw a card. A PlantDetail passes too: it carries `statusOn`. */
export type PlantCardPlant = PlantSummary & { statusOn?: IsoDate | null };

export interface PlantCardProps {
  plant: PlantCardPlant;
  onPress: () => void;
  /** The calendar date "yesterday" is counted from. Defaults to the device's date. */
  today?: IsoDate;
}

const LEAD = 44;

/** The right-hand line of a plant card, and whether it is the call to act (due, in `primary`). */
export function nextCheckText(
  plant: PlantCardPlant,
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
    case 'ok':
      return {
        text: (plant.nextCheckOn && weekdayName(plant.nextCheckOn)) || '',
        emphasis: false,
      };
    case 'closed':
      return { text: '', emphasis: false };
  }
}

/**
 * A plant in My Plants and Today (4i): a 44 pt photo or initial, the nickname, the species in
 * italics and when it is next checked. A plant that has died or been given away stays in the list
 * at 0.6 opacity, kept in the history.
 */
export function PlantCard({ plant, onPress, today }: PlantCardProps) {
  const { c } = useTheme();
  const next = nextCheckText(plant, today ?? deviceToday());
  const closed = plant.status !== 'alive';
  const initial = Array.from(plant.nickname.trim())[0]?.toUpperCase() ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[plant.nickname, plant.species.commonName, next.text]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.hairline, opacity: closed ? 0.6 : 1 },
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
              <AppText variant="bodyStrong" color="primary" aria-hidden>
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
          {next.text ? (
            <AppText
              variant="caption"
              color={next.emphasis ? 'primary' : 'textSecondary'}
              style={styles.next}
            >
              {next.text}
            </AppText>
          ) : null}
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
  lead: {
    width: LEAD,
    height: LEAD,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  next: { textAlign: 'right', flexShrink: 1, maxWidth: '40%' },
});
