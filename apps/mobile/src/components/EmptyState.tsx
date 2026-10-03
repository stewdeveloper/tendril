import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';
import { TendrilDrawing } from './icons';

export interface EmptyStateProps {
  text: string;
  /** Actions that belong with the sentence. They sit below it, inside the same centred stack. */
  children?: ReactNode;
}

/** The tendril line drawing over one centred sentence (4a). */
export function EmptyState({ text, children }: EmptyStateProps) {
  const { c } = useTheme();
  return (
    <View style={styles.stack}>
      <View style={styles.drawing}>
        <TendrilDrawing color={c.primary} />
      </View>
      <AppText variant="body" lines="body-24" style={styles.text}>
        {text}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  drawing: { opacity: 0.35 },
  text: { textAlign: 'center', maxWidth: 280 },
});
