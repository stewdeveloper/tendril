import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import { Pressable, StyleSheet } from 'react-native';
import { AppText, useTheme } from '../theme';

export interface BackBarProps {
  /** Where back goes: the previous screen's name ("Today", "Cancel"). */
  label: string;
  onPress: () => void;
  /** Overrides the spoken name, which is "Back to <label>": for a label that is not a place ("Cancel", "Back"). */
  accessibilityLabel?: string;
}

/** The in-screen back row (4f): a 24 pt chevron and the previous screen's name, 44 pt tall. */
export function BackBar({ label, onPress, accessibilityLabel }: BackBarProps) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Back to ${label}`}
      onPress={onPress}
      style={styles.bar}
    >
      <ChevronLeft size={24} color={c.textPrimary} strokeWidth={2} />
      <AppText variant="body" color="primary">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: 44,
    minWidth: 44,
  },
});
