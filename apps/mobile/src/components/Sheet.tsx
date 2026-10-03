import { motion, radius } from '@tendril/core';
import X from 'lucide-react-native/icons/x';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppText, useTheme } from '../theme';
import { useInsets } from './useInsets';
import { useReduceMotion } from './useReduceMotion';

export interface SheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** A fixed height in pt, or 'auto' (the default) to fit the content. */
  height?: number | 'auto';
}

const useNativeDriver = Platform.OS !== 'web';

/**
 * A bottom sheet over a dimmed screen (4c). It is an RN Modal, so it covers the tab bar, Android
 * back closes it, and it works on web. It slides up over 250 ms, or fades in when the OS asks for
 * reduced motion.
 */
export function Sheet({ visible, title, onClose, children, height = 'auto' }: SheetProps) {
  const { c } = useTheme();
  const insets = useInsets();
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
          style={[
            styles.sheet,
            {
              backgroundColor: c.surface,
              // 42 pt on an iPhone 16: the 34 pt home-indicator inset plus 8.
              paddingBottom: Math.max(42, insets.bottom + 8),
              height: height === 'auto' ? undefined : height,
              opacity: reduceMotion ? progress : 1,
              transform: reduceMotion ? [] : [{ translateY: slide }],
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          <View style={styles.titleRow}>
            <AppText variant="heading" style={styles.title}>
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
          <View style={[styles.body, height !== 'auto' && styles.fill]}>{children}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
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
  // The frame lays its content out with the same 18 pt rhythm as the sheet itself.
  body: { gap: 18 },
  fill: { flex: 1 },
});
