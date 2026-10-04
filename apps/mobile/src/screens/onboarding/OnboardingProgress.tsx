import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DECORATIVE } from '../../components/decorative';
import { useTheme } from '../../theme';

export interface OnboardingProgressProps {
  step: 1 | 2 | 3 | 4 | 5;
  onBack?: () => void;
  /** What sits in the 44 pt slot on the right, such as "Skip". Empty by default. */
  right?: ReactNode;
}

/** The top row of the onboarding steps (3b): back chevron, five 4 pt segments, a 44 pt right slot. */
export function OnboardingProgress({ step, onBack, right }: OnboardingProgressProps) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      <OnboardingBack onBack={onBack} />
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${step} of 5`}
        accessibilityValue={{ min: 1, max: 5, now: step }}
        style={styles.segments}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <View
            key={n}
            style={[styles.segment, { backgroundColor: n <= step ? c.primary : c.primaryTint }]}
          />
        ))}
      </View>
      <View style={[styles.slot, styles.right]}>{right}</View>
    </View>
  );
}

/** The 44 pt back chevron on its own: the confirmation screens (3e, 3f) have no progress bar. */
export function OnboardingBack({ onBack }: { onBack?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={styles.slot}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.slot}
        >
          <ChevronLeft {...DECORATIVE} size={24} color={c.textPrimary} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 44 },
  slot: { width: 44, height: 44, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  segments: { flex: 1, flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
});
