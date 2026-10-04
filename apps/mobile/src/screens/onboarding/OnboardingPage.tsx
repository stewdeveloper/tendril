import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useInsets } from '../../components/useInsets';
import { useTheme } from '../../theme';

export interface OnboardingPageProps {
  children: ReactNode;
  /** Space between the blocks. 24 on the steps, 20 on the confirmations. */
  gap?: number;
  paddingHorizontal?: number;
  /** Centres the content vertically (the age stop, 3c). */
  centered?: boolean;
}

/**
 * The page every onboarding step sits on: the safe area at the top, 16 pt at the sides, and the
 * home indicator's inset plus 8 pt below. Scrolls when a large text size or a long list needs it,
 * and otherwise fills the screen so a `flex: 1` spacer can push the action to the bottom.
 */
export function OnboardingPage({
  children,
  gap = 24,
  paddingHorizontal = 16,
  centered = false,
}: OnboardingPageProps) {
  const { c } = useTheme();
  const insets = useInsets();
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            gap,
            paddingHorizontal,
            paddingTop: insets.top,
            paddingBottom: insets.bottom + 8,
            justifyContent: centered ? 'center' : 'flex-start',
          },
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1 },
});
