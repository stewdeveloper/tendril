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
 * Winter mode has no line on screen, so the spoken label carries it. The last-day and freeze lines
 * are drawn by the screens (2e, 4g) and would be announced twice if repeated here.
 */
function stateLine(state: StreakState): string | null {
  return state === 'winter' ? 'Winter mode is on.' : null;
}

/**
 * Flame and number in the streak colour. A broken streak turns grey, never red: it is not a
 * failure to flag. The screens draw the last-day and freeze lines themselves (2e, 4g), so those
 * states look like `active` here.
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
  const line = stateLine(state);
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
