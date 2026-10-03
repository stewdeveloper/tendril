import { radius } from '@tendril/core';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';

// The word is 21 pt tall; the slop takes its touch target to 49 x 52 without changing the layout.
const UNDO_SLOP = { top: 14, bottom: 14, left: 8, right: 8 };

export interface SnackbarProps {
  text: string;
  onUndo?: () => void;
  /** Distance from the bottom of the screen: 106 above the tab bar, 48 without one. */
  bottomOffset: number;
}

/** A transient confirmation that floats over the screen with an optional Undo. */
export function Snackbar({ text, onUndo, bottomOffset }: SnackbarProps) {
  const { c } = useTheme();
  const webRole = Platform.OS === 'web' ? { role: 'status' as const } : null;
  return (
    <View
      {...webRole}
      accessibilityLiveRegion="polite"
      // The inverse of the page: ink background, surface-coloured text (white in light mode).
      style={[styles.bar, { bottom: bottomOffset, backgroundColor: c.textPrimary }]}
    >
      <AppText variant="sub" color={c.surface} style={styles.text}>
        {text}
      </AppText>
      {onUndo ? (
        <Pressable accessibilityRole="button" onPress={onUndo} hitSlop={UNDO_SLOP}>
          <AppText variant="sub" color={c.surface} style={styles.undoText}>
            Undo
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.note,
    boxShadow: '0 8px 24px rgba(29, 36, 32, 0.25)',
  },
  text: { flex: 1 },
  undoText: { fontFamily: 'Inter_600SemiBold', textDecorationLine: 'underline' },
});
