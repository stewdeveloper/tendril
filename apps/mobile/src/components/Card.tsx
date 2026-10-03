import { radius } from '@tendril/core';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '../theme';

export interface CardProps extends Omit<ViewProps, 'children'> {
  children: ReactNode;
  /** 16 for the big cards (2a), 14 for the Today tiles (2e). */
  padding?: number;
  gap?: number;
}

/**
 * The design's white card: radius 16 with a 1 pt hairline ring. The frames draw the ring as an
 * outer box-shadow that takes no layout space, so the 1 pt border carries a -1 pt margin (the
 * same trick as RowsCard) and the content lands where the frame puts it.
 */
export function Card({ children, padding = 16, gap, style, ...rest }: CardProps) {
  const { c } = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.hairline, padding, gap },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { margin: -1, borderWidth: 1, borderRadius: radius.card },
});
