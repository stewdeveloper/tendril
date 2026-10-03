import { radius } from '@tendril/core';
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { AppText, useTheme } from '../theme';

export interface TextFieldProps extends Pick<
  TextInputProps,
  | 'autoCapitalize'
  | 'autoComplete'
  | 'autoCorrect'
  | 'keyboardType'
  | 'returnKeyType'
  | 'secureTextEntry'
  | 'textContentType'
  | 'onSubmitEditing'
> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Forces the focused look (the catalog frames show it without a real focus). */
  focused?: boolean;
  /** A message for the field. It turns the ring to the danger colour and is read out with it. */
  error?: string;
}

/** A labelled single-line field (4au): 52 pt, radius 12, 1.5 pt ring that becomes 2 pt primary. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  focused,
  error,
  ...input
}: TextFieldProps) {
  const { c } = useTheme();
  const [hasFocus, setHasFocus] = useState(false);
  const active = focused || hasFocus;
  const ring = active ? 2 : 1.5;
  const ringColor = error ? c.danger : active ? c.primary : c.border;
  return (
    <View style={styles.field}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <TextInput
        {...input}
        accessibilityLabel={label}
        aria-invalid={error ? true : undefined}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textSecondary}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        style={[
          styles.input,
          {
            backgroundColor: c.surface,
            color: c.textPrimary,
            borderColor: ringColor,
            borderWidth: ring,
            // The design's ring is an inset shadow, so the text stays 16 pt from the edge.
            paddingHorizontal: 16 - ring,
          },
        ]}
      />
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  input: {
    minHeight: 52,
    borderRadius: radius.input,
    fontFamily: 'Inter_400Regular',
    fontSize: 17,
  },
});
