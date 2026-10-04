import { radius } from '@tendril/core';
import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';
import type { IconProps } from './icons';

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
  /** A 24 pt primary-coloured icon before the title (the care plan rows in 2d). */
  icon?: ComponentType<IconProps>;
  highlight?: boolean;
  onPress?: () => void;
}

export interface RowsCardProps {
  rows?: Row[];
  /** Rows that draw themselves (a `PlantCard` with `variant="row"`), after any `rows`. */
  children?: ReactNode;
}

/** A white card of rows with hairline dividers (4aq). Rows with `onPress` are buttons. */
export function RowsCard({ rows = [], children }: RowsCardProps) {
  const { c } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
      {rows.map((row) => (
        <RowView key={row.key} row={row} />
      ))}
      {children}
    </View>
  );
}

function RowView({ row }: { row: Row }) {
  const { c } = useTheme();
  const Icon = row.icon;
  const body: ReactNode = (
    <>
      {Icon ? (
        <View
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon size={24} color={c.primary} strokeWidth={2} />
        </View>
      ) : null}
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
