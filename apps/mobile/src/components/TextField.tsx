import { radius, shadows, typeScale } from '@tendril/core';
import CircleX from 'lucide-react-native/icons/circle-x';
import MapPin from 'lucide-react-native/icons/map-pin';
import Search from 'lucide-react-native/icons/search';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { AppText, fontFamilyFor, useTheme } from '../theme';
import { Card } from './Card';
import { DECORATIVE } from './decorative';

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
  | 'maxLength'
> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Forces the focused look (the catalog frames show it without a real focus). */
  focused?: boolean;
  /**
   * A message for the field, announced when it appears (alert role, polite live region) and kept as
   * the input's accessibility hint. A string is a validation message under the field and turns the
   * ring to the danger colour. `{ title, body }` is a softer "not found" card with a title and a
   * line of help (3j); the ring keeps its normal colour.
   */
  error?: FieldError;
  /**
   * `search` is the town search (3i, 3j): the label is not drawn (it stays as the accessible name),
   * a magnifier leads the text and a clear button trails it once there is some.
   */
  variant?: 'default' | 'search';
}

export type FieldError = string | { title: string; body: string };

/** A labelled single-line field (4au): 52 pt, radius 12, 1.5 pt ring that becomes 2 pt primary. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  focused,
  error,
  variant = 'default',
  ...input
}: TextFieldProps) {
  const { c } = useTheme();
  const [hasFocus, setHasFocus] = useState(false);
  const active = focused || hasFocus;
  const ring = active ? 2 : 1.5;
  const card = typeof error === 'object' ? error : null;
  const text = typeof error === 'string' && error ? error : null;
  const message = card ? `${card.title}. ${card.body}` : (text ?? undefined);
  const ringColor = text ? c.danger : active ? c.primary : c.border;
  const search = variant === 'search';
  const inputProps = {
    ...input,
    accessibilityLabel: label,
    accessibilityHint: message,
    'aria-invalid': message ? true : undefined,
    value,
    onChangeText,
    placeholder,
    placeholderTextColor: c.textSecondary,
    onFocus: () => setHasFocus(true),
    onBlur: () => setHasFocus(false),
  };
  return (
    <View style={styles.field}>
      {search ? null : (
        <AppText variant="caption" color="textSecondary">
          {label}
        </AppText>
      )}
      {search ? (
        <View
          style={[
            styles.search,
            { backgroundColor: c.surface, borderColor: ringColor, borderWidth: ring },
          ]}
        >
          <Search {...DECORATIVE} size={20} color={c.textSecondary} strokeWidth={2} />
          <TextInput {...inputProps} style={[styles.searchInput, { color: c.textPrimary }]} />
          {value ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={12}
              onPress={() => onChangeText('')}
              style={styles.clear}
            >
              <CircleX {...DECORATIVE} size={20} color={c.textSecondary} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <TextInput
          {...inputProps}
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
      )}
      {card ? (
        <Card
          accessible
          role="alert"
          accessibilityLiveRegion="polite"
          style={[styles.card, { boxShadow: shadows.popover }]}
          gap={12}
        >
          <MapPin {...DECORATIVE} size={22} color={c.textSecondary} strokeWidth={2} />
          <View style={styles.cardText}>
            <AppText variant="bodyStrong">{card.title}</AppText>
            <AppText variant="sub" color="textSecondary">
              {card.body}
            </AppText>
          </View>
        </Card>
      ) : text ? (
        <AppText variant="caption" color="danger" role="alert" accessibilityLiveRegion="polite">
          {text}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  card: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
  cardText: { flex: 1, gap: 4 },
  search: {
    minHeight: 52,
    borderRadius: radius.input,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    alignSelf: 'stretch',
    fontFamily: fontFamilyFor(typeScale.body),
    fontSize: typeScale.body.size,
  },
  clear: { minWidth: 20, minHeight: 20 },
  input: {
    minHeight: 52,
    borderRadius: radius.input,
    fontFamily: fontFamilyFor(typeScale.body),
    fontSize: typeScale.body.size,
  },
});
