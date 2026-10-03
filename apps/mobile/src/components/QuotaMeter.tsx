import {
  colors,
  formatResetDate,
  quotaLeft,
  quotaMeterLabel,
  type QuotaState,
} from '@tendril/core';
import HeartPulse from 'lucide-react-native/icons/heart-pulse';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText, useTheme } from '../theme';
import { Card } from './Card';
import { DECORATIVE } from './decorative';
import { ScanCameraIcon } from './icons';

export interface QuotaMeterProps {
  quota: QuotaState;
  /** `bar` is the Today header meter (4a), `card` the Today tile (2e), `pill` the camera's (2b). */
  variant?: 'bar' | 'card' | 'pill';
  style?: StyleProp<ViewStyle>;
}

// The camera is dark in both schemes: its pill uses the dark tokens, like the status bar over photos.
const ON_PHOTO = colors.light.surface;
const CAMERA = colors.dark;

const HEADING = { identification: 'Identifications', diagnosis: 'Diagnoses' } as const;

/**
 * How many identifications or diagnoses are left this month. Reads "7 of 10 left this month"; a
 * press on any variant shows when it resets. The fill is what is left, so it drains as you use it.
 */
export function QuotaMeter({ quota, variant = 'bar', style }: QuotaMeterProps) {
  const { c } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const left = quotaLeft(quota);
  const fraction = quota.limit > 0 ? Math.min(1, left / quota.limit) : 0;
  const month = quotaMeterLabel(quota);
  const reset = `Resets ${formatResetDate(quota.resetsOn)}`;
  const tile = `${left} of ${quota.limit} left`;
  const spoken = variant === 'card' ? `${HEADING[quota.kind]}, ${tile}` : month;
  const toggle = () => setRevealed((r) => !r);
  const press = {
    accessibilityRole: 'button',
    accessibilityLabel: revealed ? `${spoken}. ${reset}` : spoken,
    accessibilityHint: 'Shows when it resets',
    accessibilityState: { expanded: revealed },
    onPress: toggle,
  } as const;

  if (variant === 'pill') {
    return (
      <Pressable
        {...press}
        hitSlop={{ top: 4, bottom: 4 }}
        style={[styles.pill, { backgroundColor: c.photoButton }, style]}
      >
        <Bar
          fraction={fraction}
          width={40}
          height={4}
          track={CAMERA.textPrimary}
          trackOpacity={0.3}
          fill={CAMERA.primary}
        />
        <View style={styles.pillText}>
          <AppText variant="caption" color={ON_PHOTO}>
            {month}
          </AppText>
          {revealed ? (
            <AppText variant="caption" color={ON_PHOTO}>
              {reset}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    );
  }

  if (variant === 'card') {
    return (
      <Pressable {...press} style={style}>
        <Card padding={14} gap={6}>
          <View style={styles.heading}>
            {quota.kind === 'diagnosis' ? (
              <HeartPulse {...DECORATIVE} size={18} color={c.primary} strokeWidth={2} />
            ) : (
              <ScanCameraIcon size={18} color={c.primary} />
            )}
            <AppText variant="caption" color="textSecondary">
              {HEADING[quota.kind]}
            </AppText>
          </View>
          <AppText variant="heading">{tile}</AppText>
          <Bar
            fraction={fraction}
            height={6}
            track={c.primaryTint}
            fill={c.primary}
            style={styles.tileBar}
          />
          {revealed ? (
            <AppText variant="caption" color="textSecondary">
              {reset}
            </AppText>
          ) : null}
        </Card>
      </Pressable>
    );
  }

  return (
    // A 32 pt block; the slop brings its touch target to 44.
    <Pressable {...press} hitSlop={{ top: 6, bottom: 6 }} style={[styles.bar, style]}>
      <AppText variant="caption" color="textSecondary">
        {month}
      </AppText>
      <Bar fraction={fraction} height={8} track={c.primaryTint} fill={c.primary} />
      {revealed ? (
        <AppText variant="caption" color="textSecondary">
          {reset}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** A rounded track with a fill for the fraction left. Decorative: the label carries the numbers. */
function Bar({
  fraction,
  height,
  width,
  track,
  trackOpacity = 1,
  fill,
  style,
}: {
  fraction: number;
  height: number;
  width?: number;
  track: string;
  trackOpacity?: number;
  fill: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ height, width, borderRadius: height / 2 }, styles.track, style]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: track, opacity: trackOpacity }]} />
      <View
        style={{ width: `${Math.round(fraction * 100)}%`, height: '100%', backgroundColor: fill }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: 6 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileBar: { marginTop: 6 },
  track: { overflow: 'hidden' },
  pillText: { flexShrink: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 36,
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
});
