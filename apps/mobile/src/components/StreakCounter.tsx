import { freezeUsed, streakLastDay } from '@tendril/core';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText, useTheme } from '../theme';
import { Card } from './Card';
import { FlameIcon } from './icons';

export type StreakState = 'active' | 'last_day' | 'freeze_used' | 'winter' | 'broken';

export interface StreakCounterProps {
  days: number;
  /** "day care streak", "week discovery streak". */
  label: string;
  state?: StreakState;
  /** `tile` is the Today tile (2e), `stat` the big number on the Streaks screen (4f). */
  size?: 'tile' | 'stat';
  style?: StyleProp<ViewStyle>;
}

/**
 * What a screen reader hears beyond the number: the same lines the screens show next to the
 * counter (2e, 4g), so the state is never colour or position alone.
 */
function stateLine(state: StreakState, days: number): string | null {
  switch (state) {
    case 'last_day':
      return streakLastDay(days);
    case 'freeze_used':
      return freezeUsed(days);
    case 'winter':
      return 'Winter mode is on.';
    default:
      return null;
  }
}

/**
 * Flame and number in the streak colour. A broken streak turns grey, never red: it is not a
 * failure to flag. The screens draw the last-day and freeze lines themselves (2e, 4g), so the
 * state shows here as colour and in the spoken label.
 */
export function StreakCounter({
  days,
  label,
  state = 'active',
  size = 'tile',
  style,
}: StreakCounterProps) {
  const { c } = useTheme();
  const stat = size === 'stat';
  const color = state === 'broken' ? c.textSecondary : c.streak;
  const line = stateLine(state, days);
  const content = (
    <>
      <FlameIcon size={stat ? 44 : 28} color={color} />
      <View style={styles.text}>
        <AppText variant={stat ? 'moment' : 'heading'} color={color}>
          {String(days)}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {label}
        </AppText>
      </View>
    </>
  );
  const a11y = {
    accessible: true,
    accessibilityRole: 'text',
    accessibilityLabel: line ? `${days} ${label}. ${line}` : `${days} ${label}`,
  } as const;
  return stat ? (
    <View {...a11y} style={[styles.stat, style]}>
      {content}
    </View>
  ) : (
    <Card {...a11y} padding={14} style={[styles.tile, style]}>
      {content}
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // A flex item shrinks in the design, so a long label wraps inside the tile.
  text: { flexShrink: 1 },
});
