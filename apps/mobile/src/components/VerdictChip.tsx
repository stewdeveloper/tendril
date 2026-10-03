import {
  effectiveSeverity,
  verdictA11yLabel,
  verdictChipLabel,
  type Animal,
  type Severity,
} from '@tendril/core';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText, useTheme } from '../theme';
import { VerdictIcon } from './icons';

export interface VerdictChipProps {
  animal: Animal;
  severity: Severity;
  style?: StyleProp<ViewStyle>;
}

/**
 * "Cats: Moderate" (2a, 2c): icon, word and colour together, so the verdict never rests on colour
 * alone. Other pets are always unknown, whatever the data says; toxicity data covers cats and dogs.
 * The chip grows with the text size instead of clipping.
 */
export function VerdictChip({ animal, severity, style }: VerdictChipProps) {
  const { c, verdict } = useTheme();
  const shown = effectiveSeverity(animal, severity);
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={verdictA11yLabel(animal, severity)}
      style={[styles.chip, { backgroundColor: verdict[shown] }, style]}
    >
      <VerdictIcon severity={shown} size={18} color={c.onChip} />
      <AppText variant="caption" color="onChip" style={styles.text}>
        {verdictChipLabel(animal, severity)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 999,
    maxWidth: '100%',
  },
  text: { flexShrink: 1 },
});
