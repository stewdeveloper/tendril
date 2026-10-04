import type { BoardRow } from '@tendril/core';
import { StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';

export interface LeagueRowProps {
  row: BoardRow;
}

/**
 * One line of a league or friends board (4aq): rank, handle, points. Your own row reads "You" in
 * words as well as sitting on the primary tint, so colour is never the only signal. Held points
 * are named plainly, without blame. Rows share a card, so the divider is the card's concern.
 */
export function LeagueRow({ row }: LeagueRowProps) {
  const { c } = useTheme();
  const name = row.isYou ? `You · @${row.handle}` : `@${row.handle}`;
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={[
        `Rank ${row.rank}`,
        row.isYou ? `You, @${row.handle}` : `@${row.handle}`,
        `${row.points} points`,
        row.pending ? 'Points pending review' : null,
      ]
        .filter(Boolean)
        .join('. ')}
      style={[
        styles.row,
        {
          backgroundColor: row.isYou ? c.primaryTint : 'transparent',
          borderBottomColor: c.divider,
        },
      ]}
    >
      <AppText variant="bodyStrong" color="textSecondary" style={styles.rank}>
        {String(row.rank)}
      </AppText>
      <View style={styles.text}>
        <AppText variant="body">{name}</AppText>
        {row.pending ? (
          <AppText variant="sub" color="textSecondary" style={styles.subtitle}>
            Points pending review
          </AppText>
        ) : null}
      </View>
      <AppText
        variant="caption"
        color={row.isYou ? 'primary' : 'textSecondary'}
        style={styles.points}
      >
        {String(row.points)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  // The same row as RowsCard: 12/16 padding, a 28 pt rank column, the hairline under it.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 53,
    borderBottomWidth: 1,
  },
  rank: { width: 28 },
  text: { flex: 1, minWidth: 0 },
  subtitle: { lineHeight: 20 },
  points: { textAlign: 'right' },
});
