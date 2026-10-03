import { typeScale, type ColorTokens, type TypeVariant } from '@tendril/core';
import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { fontFamilyFor } from './fonts';
import { useTheme } from './ThemeProvider';

export interface AppTextProps extends Omit<TextProps, 'style'> {
  variant: TypeVariant;
  /** A theme colour name, or a literal colour for on-photo and on-chip text. */
  color?: keyof ColorTokens | (string & {});
  /** Body copy blocks use a 24 pt line height (design frames' "body" blocks). */
  lines?: 'body-24';
  style?: StyleProp<TextStyle>;
}

export function AppText({ variant, color = 'textPrimary', lines, style, ...rest }: AppTextProps) {
  const { c } = useTheme();
  const t = typeScale[variant];
  const resolved = (c as unknown as Record<string, string>)[color] ?? color;
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: fontFamilyFor(t),
          fontSize: t.size,
          lineHeight: lines === 'body-24' ? 24 : t.lineHeight,
          color: resolved,
        },
        style,
      ]}
    />
  );
}
