import { radius } from '@tendril/core';
import { useEffect, useState, type ComponentType } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';
import type { IconProps } from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  /** An icon component (a lucide icon or one from icons.tsx), drawn 20 pt in the label colour. */
  icon?: ComponentType<IconProps>;
  /** 48 pt tall instead of 52: the buttons inside cards (the pet check in 2a, "Check in" in 2e). */
  compact?: boolean;
  /** Draws the pressed state without a touch, for the component sheet (5o). */
  previewPressed?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

const RING = 1.5;
const SPINNER = 20;

/**
 * Style tile buttons (4bj and every frame's action): 52 pt tall, radius 14, label Inter 600 17.
 * The ring is a real border (transparent on the filled variants) so the layout is identical
 * across variants. It grows with text scaling instead of clipping.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon: Icon,
  compact = false,
  previewPressed = false,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { c } = useTheme();
  const look = {
    primary: { bg: c.primary, fg: c.onPrimary, ring: 'transparent' },
    secondary: { bg: 'transparent', fg: c.primary, ring: c.primary },
    text: { bg: 'transparent', fg: c.primary, ring: 'transparent' },
    danger: { bg: c.danger, fg: c.onChip, ring: 'transparent' },
  }[variant];
  const inert = disabled || loading;
  const baseLabel = accessibilityLabel ?? label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading ? `${baseLabel}, loading` : accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inert, busy: loading }}
      disabled={inert}
      onPress={onPress}
      style={[
        styles.base,
        compact && styles.compact,
        {
          backgroundColor: look.bg,
          borderColor: look.ring,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      {({ pressed }) => (
        <>
          {(pressed || previewPressed) && !inert ? (
            <View style={[styles.overlay, { backgroundColor: c.pressedOverlay }]} />
          ) : null}
          <View style={[styles.content, loading && styles.hidden]}>
            {Icon ? <Icon size={SPINNER} color={look.fg} /> : null}
            <AppText variant="bodyStrong" color={look.fg} style={styles.label}>
              {label}
            </AppText>
          </View>
          {loading ? <Spinner color={look.fg} /> : null}
        </>
      )}
    </Pressable>
  );
}

/** A 20 pt ring with a gap in it that turns, in the label colour. */
function Spinner({ color }: { color: string }) {
  const [turn] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(turn, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [turn]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={styles.spinnerSlot}>
      <Animated.View
        style={[
          styles.spinner,
          // After borderColor, so the gap is not painted over by the shorthand.
          { borderColor: color, borderTopColor: 'transparent', transform: [{ rotate }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.button,
    borderWidth: RING,
    paddingHorizontal: 16 - RING,
    paddingVertical: 12 - RING,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  compact: { minHeight: 48 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  hidden: { opacity: 0 },
  overlay: { ...StyleSheet.absoluteFill, pointerEvents: 'none' },
  label: { textAlign: 'center', flexShrink: 1 },
  spinnerSlot: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  spinner: {
    width: SPINNER,
    height: SPINNER,
    borderRadius: SPINNER / 2,
    borderWidth: 2.5,
  },
});
