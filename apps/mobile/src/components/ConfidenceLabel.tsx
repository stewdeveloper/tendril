import { bandFor, confidenceA11yLabel, confidenceLabel, type ConfidenceBand } from '@tendril/core';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleDashed from 'lucide-react-native/icons/circle-dashed';
import CircleQuestionMark from 'lucide-react-native/icons/circle-question-mark';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText, useTheme } from '../theme';
import { DECORATIVE } from './decorative';

const RING = 1.5;

/** The band's shape: a check (very likely), a dashed circle (likely) or a question mark (not sure). */
export function ConfidenceIcon({
  band,
  size = 16,
  color,
}: {
  band: ConfidenceBand;
  size?: number;
  color: string;
}) {
  const Icon =
    band === 'very_likely' ? CircleCheck : band === 'likely' ? CircleDashed : CircleQuestionMark;
  return <Icon {...DECORATIVE} size={size} color={color} strokeWidth={2} />;
}

export interface ConfidenceLabelProps {
  probability: number;
  /** No leading icon and 10 pt on both sides (the diagnosis result, 4q). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The word first, then the percentage, never a bare number (2a, 2c). Very likely and likely sit on
 * the primary tint; not sure is an outline in grey. The ring is a real border (transparent on the
 * tinted pills) so all three have identical geometry.
 */
export function ConfidenceLabel({ probability, compact = false, style }: ConfidenceLabelProps) {
  const { c } = useTheme();
  const band = bandFor(probability);
  const unsure = band === 'not_sure';
  const fg = unsure ? c.textSecondary : c.primary;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={confidenceA11yLabel(probability)}
      style={[
        styles.pill,
        {
          backgroundColor: unsure ? 'transparent' : c.primaryTint,
          borderColor: unsure ? c.border : 'transparent',
          paddingLeft: (compact ? 10 : 8) - RING,
        },
        style,
      ]}
    >
      {compact ? null : <ConfidenceIcon band={band} color={fg} />}
      <AppText variant="caption" color={fg}>
        {confidenceLabel(probability)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 28,
    paddingRight: 10 - RING,
    borderRadius: 999,
    borderWidth: RING,
  },
});
