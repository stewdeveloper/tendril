import { radius } from '@tendril/core';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';

export interface PlanCardProps {
  title: string;
  /** "Best value": smaller than the price, never the loudest thing on the card. */
  tag?: string;
  subtitle: string;
  /** The billed amount, the largest text on the card. */
  price: string;
  /** "a year", "a month". */
  per: string;
  selected: boolean;
  onPress: () => void;
}

const RADIO = 22;

/**
 * A subscription choice on the paywall (2g). The billed amount is Fraunces 28, the largest text;
 * the tag is a 13 pt caption. Selected cards are tinted with a 2 pt primary ring and a filled
 * radio, unselected ones are white with a 1.5 pt border. The ring is a real border and the
 * padding takes up the difference, so both states are the same size.
 */
export function PlanCard({ title, tag, subtitle, price, per, selected, onPress }: PlanCardProps) {
  const { c } = useTheme();
  const ring = selected ? 2 : 1.5;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={[title, tag, subtitle, `${price} ${per}`].filter(Boolean).join(', ')}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: selected ? c.primaryTint : c.surface,
          borderColor: selected ? c.primary : c.border,
          borderWidth: ring,
          paddingVertical: 14 - ring,
          paddingHorizontal: 16 - ring,
        },
      ]}
    >
      <View style={[styles.radio, { borderColor: selected ? c.primary : c.border }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: c.primary }]} /> : null}
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <AppText variant="bodyStrong">{title}</AppText>
          {tag ? (
            <AppText variant="caption" color="primary">
              {tag}
            </AppText>
          ) : null}
        </View>
        <AppText variant="caption" color="textSecondary">
          {subtitle}
        </AppText>
      </View>
      <View style={styles.price}>
        <AppText variant="title">{price}</AppText>
        <AppText variant="caption" color="textSecondary" style={styles.per}>
          {per}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The price wraps under the title when large text leaves no room beside it.
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 12,
    rowGap: 8,
    borderRadius: radius.card,
  },
  radio: {
    width: RADIO,
    height: RADIO,
    borderRadius: RADIO / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  text: { flex: 1, minWidth: 140 },
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 },
  price: { alignItems: 'flex-end', flexShrink: 0 },
  per: { textAlign: 'right' },
});
