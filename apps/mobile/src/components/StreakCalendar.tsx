import type { DayMark } from '@tendril/core';
import { StyleSheet, View } from 'react-native';
import { useTheme, type Theme } from '../theme';
import { Card } from './Card';
import { FreezeIcon } from './icons';

const COLUMNS = 7;
const RING = 2;

const LABEL: Record<DayMark, string> = {
  checked: 'Checked in',
  freeze: 'Freeze used',
  missed: 'Missed',
  empty: 'No check-in',
};

function look({ c }: Theme, mark: DayMark): { fill: string; ring: string } {
  switch (mark) {
    case 'checked':
      return { fill: c.streak, ring: 'transparent' };
    case 'freeze':
      return { fill: c.primaryTint, ring: c.primary };
    case 'missed':
      return { fill: c.border, ring: 'transparent' };
    case 'empty':
      return { fill: c.surface, ring: c.border };
  }
}

/**
 * The check-in calendar (4f, 4g, 4h): a card of round days, seven to a row, oldest first. Checked
 * days are the streak colour, a freeze is the tint with a primary ring and the freeze glyph,
 * missed days are grey, and days with no check-in yet are an empty ring.
 */
export function StreakCalendar({ marks }: { marks: DayMark[] }) {
  const theme = useTheme();
  const rows: DayMark[][] = [];
  for (let i = 0; i < marks.length; i += COLUMNS) rows.push(marks.slice(i, i + COLUMNS));
  return (
    <Card padding={14} gap={8}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: COLUMNS }, (_, i) => {
            const mark = row[i];
            if (!mark) return <View key={i} style={styles.cell} />;
            const { fill, ring } = look(theme, mark);
            return (
              <View
                key={i}
                accessible
                accessibilityRole="image"
                accessibilityLabel={LABEL[mark]}
                style={[styles.cell, styles.day, { backgroundColor: fill, borderColor: ring }]}
              >
                {mark === 'freeze' ? <FreezeIcon size={16} color={theme.c.primary} /> : null}
              </View>
            );
          })}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, aspectRatio: 1 },
  day: { borderRadius: 999, borderWidth: RING, alignItems: 'center', justifyContent: 'center' },
});
