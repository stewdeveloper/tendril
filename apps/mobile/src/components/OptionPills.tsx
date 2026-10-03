import { radius } from '@tendril/core';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';

export interface PillOption {
  value: string;
  label: string;
}

export type OptionPillsProps = { options: PillOption[] } & (
  | { multiple?: false; value: string; onChange: (value: string) => void }
  | { multiple: true; value: string[]; onChange: (value: string[]) => void }
);

const RING = 1.5;

/** Wrapping choice pills (4m). Single choice reads as radios, multiple choice as checkboxes. */
export function OptionPills(props: OptionPillsProps) {
  const { c } = useTheme();
  const { options } = props;
  const isSelected = (v: string) => (props.multiple ? props.value.includes(v) : props.value === v);
  const choose = (v: string) => {
    if (!props.multiple) return props.onChange(v);
    props.onChange(
      props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v],
    );
  };
  return (
    <View style={styles.wrap} accessibilityRole={props.multiple ? undefined : 'radiogroup'}>
      {options.map((o) => {
        const selected = isSelected(o.value);
        return (
          <Pressable
            key={o.value}
            accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: selected }}
            onPress={() => choose(o.value)}
            style={[
              styles.pill,
              selected
                ? { backgroundColor: c.primaryTint, borderColor: c.primary }
                : { borderColor: c.border },
            ]}
          >
            <AppText variant="caption" color={selected ? 'primary' : 'textPrimary'}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    minHeight: 44,
    paddingHorizontal: 16 - RING,
    borderRadius: radius.pill,
    borderWidth: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
