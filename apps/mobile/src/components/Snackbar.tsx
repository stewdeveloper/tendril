import { radius, shadows, typeScale } from '@tendril/core';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { AppText, fontFamilyFor, useTheme } from '../theme';
import { useInsets } from './useInsets';

// The word is 21 pt tall; the slop takes its touch target to 49 x 52 without changing the layout.
const UNDO_SLOP = { top: 14, bottom: 14, left: 8, right: 8 };

export interface SnackbarProps {
  text: string;
  onUndo?: () => void;
  /**
   * True where the screen's content ends at the in-flow tab bar, so 16 pt above the content is 16
   * pt above the bar (106 on an iPhone 16). Without a bar it floats 16 pt above the bottom safe area.
   */
  withTabBar?: boolean;
  /** Overrides the computed distance from the bottom of the container, for strips on the component sheet. */
  bottomOffset?: number;
}

const GAP = 16;

/** A transient confirmation that floats over the screen with an optional Undo. */
export function Snackbar({ text, onUndo, withTabBar = false, bottomOffset }: SnackbarProps) {
  const { c } = useTheme();
  const inset = useInsets().bottom;
  const bottom = bottomOffset ?? GAP + (withTabBar ? 0 : inset);
  const webRole = Platform.OS === 'web' ? { role: 'status' as const } : null;
  return (
    <View
      {...webRole}
      accessibilityLiveRegion="polite"
      // The inverse of the page: ink background, surface-coloured text (white in light mode).
      style={[styles.bar, { bottom, backgroundColor: c.textPrimary }]}
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
    boxShadow: shadows.floating,
  },
  text: { flex: 1 },
  undoText: { fontFamily: fontFamilyFor(typeScale.bodyStrong), textDecorationLine: 'underline' },
});
