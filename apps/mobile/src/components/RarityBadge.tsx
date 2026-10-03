import type { RarityTier } from '@tendril/core';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText, useTheme } from '../theme';
import { FlowerIcon, LeafIcon } from './icons';

const LEAVES: Record<Exclude<RarityTier, 'legendary'>, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
};
const WORD: Record<RarityTier, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  legendary: 'Legendary',
};

export interface RarityBadgeProps {
  tier: RarityTier;
  style?: StyleProp<ViewStyle>;
}

/** Leaf count plus the word (4ab, 4al): one, two or three leaves, and a flower for legendary. */
export function RarityBadge({ tier, style }: RarityBadgeProps) {
  const { c, rarity } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Rarity: ${WORD[tier]}`}
      style={[styles.badge, { backgroundColor: rarity[tier] }, style]}
    >
      <View style={styles.marks}>
        {tier === 'legendary' ? (
          <FlowerIcon size={14} color={c.onChip} />
        ) : (
          Array.from({ length: LEAVES[tier] }, (_, i) => (
            <LeafIcon key={i} size={14} color={c.onChip} />
          ))
        )}
      </View>
      <AppText variant="caption" color="onChip">
        {WORD[tier]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 28,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 999,
  },
  marks: { flexDirection: 'row', gap: 1 },
});
