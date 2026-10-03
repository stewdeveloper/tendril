import { radius } from '@tendril/core';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';

export interface Row {
  key: string;
  title: string;
  subtitle?: string;
  /** Scientific names are set in italics. */
  subtitleItalic?: boolean;
  right?: string;
  rightColor?: 'textSecondary' | 'primary' | 'streak';
  /** A rank or index in a 28 pt column before the title. */
  lead?: string;
  highlight?: boolean;
  onPress?: () => void;
}

/** A white card of rows with hairline dividers (4aq). Rows with `onPress` are buttons. */
export function RowsCard({ rows }: { rows: Row[] }) {
  const { c } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
      {rows.map((row) => (
        <RowView key={row.key} row={row} />
      ))}
    </View>
  );
}

function RowView({ row }: { row: Row }) {
  const { c } = useTheme();
  const body: ReactNode = (
    <>
      {row.lead != null ? (
        <AppText variant="bodyStrong" color="textSecondary" style={styles.lead}>
          {row.lead}
        </AppText>
      ) : null}
      <View style={styles.text}>
        <AppText variant="body">{row.title}</AppText>
        {row.subtitle != null ? (
          <AppText
            variant={row.subtitleItalic ? 'sci' : 'sub'}
            color="textSecondary"
            style={styles.subtitle}
          >
            {row.subtitle}
          </AppText>
        ) : null}
      </View>
      {row.right != null ? (
        <AppText variant="caption" color={row.rightColor ?? 'textSecondary'} style={styles.right}>
          {row.right}
        </AppText>
      ) : null}
    </>
  );
  const style = [
    styles.row,
    {
      backgroundColor: row.highlight ? c.primaryTint : 'transparent',
      borderBottomColor: c.divider,
    },
  ];
  return row.onPress ? (
    <Pressable
      testID={`row-${row.key}`}
      accessibilityRole="button"
      onPress={row.onPress}
      style={({ pressed }) => [style, pressed && { backgroundColor: c.pressedOverlay }]}
    >
      {body}
    </Pressable>
  ) : (
    <View testID={`row-${row.key}`} style={style}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  // The frame's hairline is an outer box-shadow ring that takes no layout space. The 1 pt border
  // plus a -1 pt margin puts the ring in the same place and the rows in the same place.
  card: {
    margin: -1,
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    // The frame's 28 pt content minimum plus 24 pt of padding and the 1 pt divider.
    minHeight: 53,
    borderBottomWidth: 1,
  },
  lead: { width: 28 },
  text: { flex: 1, minWidth: 0 },
  subtitle: { lineHeight: 20 },
  right: { textAlign: 'right' },
});
