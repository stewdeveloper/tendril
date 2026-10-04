import { motion, radius } from '@tendril/core';
import X from 'lucide-react-native/icons/x';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppText, useTheme } from '../theme';
import { useInsets } from './useInsets';
import { useReduceMotion } from './useReduceMotion';

export interface SheetPanelProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** A fixed height in pt, or 'auto' (the default) to fit the content. Either is capped to the screen. */
  height?: number | 'auto';
  /**
   * With `height: 'auto'`, a floor in pt: the sheet is at least this tall, and grows when the
   * content (or a larger text size) needs more, so the actions are never pushed out of reach.
   */
  minHeight?: number;
}

export interface SheetProps extends SheetPanelProps {
  visible: boolean;
}

const useNativeDriver = Platform.OS !== 'web';

/** Space kept between a full-height sheet and the top safe area. */
const TOP_GAP = 8;

/**
 * The sheet surface (4c): handle, a pinned title row with a Close button, and a scrolling body.
 * It sits in the normal flow, with no Modal and no animation, so `Sheet` and `SheetOverlay` can
 * each present it their own way. Never taller than the window minus the top inset, so a long body
 * scrolls under a title that stays in view.
 */
export function SheetPanel({
  title,
  onClose,
  children,
  height = 'auto',
  minHeight,
}: SheetPanelProps) {
  const { c } = useTheme();
  const insets = useInsets();
  const { height: windowHeight } = useWindowDimensions();
  const maxHeight = Math.max(0, windowHeight - insets.top - TOP_GAP);
  return (
    <View
      testID="sheet-panel"
      style={[
        styles.panel,
        {
          backgroundColor: c.surface,
          // 42 pt on an iPhone 16: the 34 pt home-indicator inset plus 8.
          paddingBottom: Math.max(42, insets.bottom + 8),
          height: height === 'auto' ? undefined : height,
          // Never above the cap: a short window must not push the title past the top.
          minHeight:
            height === 'auto' && minHeight != null ? Math.min(minHeight, maxHeight) : undefined,
          maxHeight,
        },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: c.border }]} />
      <View style={styles.titleRow}>
        <AppText variant="heading" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.close}
        >
          <X size={22} color={c.textSecondary} strokeWidth={2} />
        </Pressable>
      </View>
      <ScrollView
        testID="sheet-body"
        alwaysBounceVertical={false}
        keyboardShouldPersistTaps="handled"
        // The frame lays its content out with the same 18 pt rhythm as the panel itself. flexGrow
        // lets a `flex: 1` spacer in the content push the actions to the bottom of a fixed height.
        contentContainerStyle={styles.body}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * The sheet drawn inline in its parent: a `scrim` over the whole parent and the panel at its
 * bottom, with no Modal and no animation. The catalog frames use it so the device chrome stays
 * above the scrim, as in the design; the app uses `Sheet`.
 */
export function SheetOverlay(props: SheetPanelProps) {
  const { c } = useTheme();
  return (
    <View testID="sheet-overlay" accessibilityViewIsModal style={styles.overlay}>
      <Pressable
        testID="sheet-overlay-scrim"
        accessible={false}
        importantForAccessibility="no"
        onPress={props.onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}
      />
      <View style={styles.overlayPanel}>
        <SheetPanel {...props} />
      </View>
    </View>
  );
}

/**
 * A bottom sheet over a dimmed screen (4c). It is an RN Modal, so it covers the tab bar, Android
 * back closes it, and it works on web. It slides up over 250 ms, or fades in when the OS asks for
 * reduced motion.
 */
export function Sheet({ visible, onClose, ...panel }: SheetProps) {
  const { c } = useTheme();
  const reduceMotion = useReduceMotion();
  const { height: windowHeight } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) {
      // Closed means hidden: the next open must start from the bottom, not flash fully open.
      progress.setValue(0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.base,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, progress]);

  const slide = progress.interpolate({ inputRange: [0, 1], outputRange: [windowHeight, 0] });
  return (
    <Modal
      testID="sheet-modal"
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
          <Pressable
            testID="sheet-backdrop"
            accessible={false}
            importantForAccessibility="no"
            onPress={onClose}
            style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim }]}
          />
        </Animated.View>
        <Animated.View
          testID="sheet"
          style={{
            opacity: reduceMotion ? progress : 1,
            transform: reduceMotion ? [] : [{ translateY: slide }],
          }}
        >
          <SheetPanel {...panel} onClose={onClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  // Scrim 6 and panel 7 in the frame; the catalog's device chrome is 10, so it stays on top.
  overlay: { ...StyleSheet.absoluteFill, zIndex: 7 },
  overlayPanel: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  panel: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingTop: 8,
    paddingHorizontal: 16,
    gap: 18,
  },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', opacity: 0.6 },
  // Pulled up 8 so the title sits 10 pt below the handle, as in the frame.
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -8,
  },
  title: { flex: 1 },
  // 44 pt target; its right edge hangs 10 pt past the padding so the X lines up with the content edge.
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  body: { gap: 18, flexGrow: 1 },
});
