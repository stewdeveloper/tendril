import { radius } from '@tendril/core';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';

export interface SegmentOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
}

/** A pill-shaped tab switch (4ah): 3 pt padding, 1 pt ring, 38 pt items. */
export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.track, { borderColor: c.border }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            // The item is 38 pt; the 3 pt of track above and below it makes the touch target 44.
            hitSlop={{ top: 3, bottom: 3 }}
            onPress={() => onChange(o.value)}
            style={[styles.item, { backgroundColor: selected ? c.primary : 'transparent' }]}
          >
            <AppText
              variant="caption"
              color={selected ? 'onPrimary' : 'textPrimary'}
              style={styles.label}
            >
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 3 - 1,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  item: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  label: { fontFamily: 'Inter_600SemiBold', textAlign: 'center' },
});
