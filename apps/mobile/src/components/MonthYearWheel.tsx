import { radius } from '@tendril/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { AppText, useTheme } from '../theme';

export interface MonthYear {
  year: number;
  /** 1 to 12. */
  month: number;
}

export interface MonthYearWheelProps {
  value: MonthYear;
  onChange: (value: MonthYear) => void;
  /** The newest year offered, normally this year. */
  maxYear: number;
  /** The oldest year offered. Defaults to 1920. */
  minYear?: number;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const ROW = 44;
const HEIGHT = 220;
/** Two rows above and two below the selected one are visible (3b). */
const PAD = (HEIGHT - ROW) / 2;

/**
 * The month and year picker of 3b: two snapping columns in a card, the selected row in a tint band,
 * the rows two steps out faded. Each column is a single adjustable control for screen readers
 * (swipe up and down to change it), announcing the selected month or year.
 */
export function MonthYearWheel({ value, onChange, maxYear, minYear = 1920 }: MonthYearWheelProps) {
  const { c } = useTheme();
  const years = Array.from({ length: Math.max(0, maxYear - minYear + 1) }, (_, i) => minYear + i);
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.hairline }]}>
      <View pointerEvents="none" style={[styles.band, { backgroundColor: c.primaryTint }]} />
      <Column
        label="Month"
        items={MONTHS}
        index={value.month - 1}
        flex={1.4}
        onIndex={(i) => onChange({ ...value, month: i + 1 })}
      />
      <Column
        label="Year"
        items={years.map(String)}
        index={Math.max(0, years.indexOf(value.year))}
        flex={1}
        onIndex={(i) => onChange({ ...value, year: years[i] ?? value.year })}
      />
    </View>
  );
}

interface ColumnProps {
  label: string;
  items: string[];
  index: number;
  flex: number;
  onIndex: (index: number) => void;
}

function Column({ label, items, index, flex, onIndex }: ColumnProps) {
  const { c } = useTheme();
  const list = useRef<FlatList<string>>(null);
  // What is under the band while scrolling, so the fade follows the finger; `index` is the value.
  const [shown, setShown] = useState(index);
  // `contentOffset` places native lists at once but is ignored on web, so the start is set here too.
  useEffect(() => {
    list.current?.scrollToOffset({ offset: index * ROW, animated: false });
    // Only the first placement: after that the list itself is the source of the index.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const clampIndex = (next: number) => Math.min(items.length - 1, Math.max(0, next));
  // The highlight follows the scroll; the value is committed once it comes to rest.
  const settle = (next: number) => {
    const clamped = clampIndex(next);
    setShown(clamped);
    if (clamped !== index) onIndex(clamped);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setShown(clampIndex(Math.round(e.nativeEvent.contentOffset.y / ROW)));
  const onRest = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    settle(Math.round(e.nativeEvent.contentOffset.y / ROW));
  const step = useCallback(
    (e: AccessibilityActionEvent) => {
      const next = index + (e.nativeEvent.actionName === 'increment' ? 1 : -1);
      const clamped = Math.min(items.length - 1, Math.max(0, next));
      list.current?.scrollToOffset({ offset: clamped * ROW, animated: true });
      settle(clamped);
    },
    // `settle` closes over `index` and `items`, which are in the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, items.length, onIndex],
  );
  return (
    <View
      style={{ flex }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[index] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={step}
    >
      <FlatList
        ref={list}
        data={items}
        keyExtractor={(item) => item}
        getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
        contentOffset={{ x: 0, y: index * ROW }}
        contentContainerStyle={{ paddingVertical: PAD }}
        snapToInterval={ROW}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={onRest}
        onScrollEndDrag={onRest}
        initialNumToRender={items.length > 30 ? 12 : items.length}
        renderItem={({ item, index: i }) => {
          const distance = Math.abs(i - shown);
          return (
            <View style={styles.row}>
              <AppText
                variant={distance === 0 ? 'bodyStrong' : 'body'}
                color={distance === 0 ? c.textPrimary : c.textSecondary}
                style={[styles.text, { opacity: distance >= 2 ? 0.5 : 1 }]}
              >
                {item}
              </AppText>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // The frame's ring is an outer shadow: the 1 pt border takes a -1 margin, as Card does.
    height: HEIGHT + 2,
    margin: -1,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  band: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: PAD,
    height: ROW,
    borderRadius: 10,
  },
  row: { height: ROW, alignItems: 'center', justifyContent: 'center' },
  text: { lineHeight: ROW, textAlign: 'center' },
});
