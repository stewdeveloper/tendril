import { onboardingCopy } from '@tendril/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, MonthYearWheel, type MonthYear } from '../../components';
import { AppText, useTheme } from '../../theme';
import { OnboardingPage } from './OnboardingPage';
import { OnboardingProgress } from './OnboardingProgress';

export interface AgeScreenProps {
  /** The wheel's starting month and year. */
  initial?: MonthYear;
  /** The newest year the wheel offers: this year. */
  maxYear?: number;
  onContinue: (birth: MonthYear) => void;
  onBack: () => void;
}

/**
 * Month and year of birth (3b). It never says why it asks or what the limit is: whoever is under
 * it meets the stop (3c) only after Continue, and nothing here is kept but that the stop happened.
 */
export function AgeScreen({ initial, maxYear, onContinue, onBack }: AgeScreenProps) {
  const { c } = useTheme();
  const newest = maxYear ?? new Date().getFullYear();
  const [value, setValue] = useState<MonthYear>(initial ?? { year: newest - 25, month: 6 });
  return (
    <OnboardingPage>
      <OnboardingProgress step={1} onBack={onBack} />
      <View style={styles.text}>
        <AppText variant="title" accessibilityRole="header">
          {onboardingCopy.ageTitle}
        </AppText>
        <AppText variant="body" color={c.textSecondary} style={styles.line}>
          {onboardingCopy.ageLine}
        </AppText>
      </View>
      <MonthYearWheel value={value} onChange={setValue} maxYear={newest} />
      <View style={styles.spacer} />
      <Button label="Continue" onPress={() => onContinue(value)} />
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  text: { gap: 8 },
  line: { lineHeight: 23 },
  spacer: { flex: 1 },
});
