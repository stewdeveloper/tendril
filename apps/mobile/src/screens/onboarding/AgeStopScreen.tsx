import { onboardingCopy } from '@tendril/core';
import { StyleSheet, View } from 'react-native';
import { TendrilCurlDrawing } from '../../components';
import { AppText, useTheme } from '../../theme';
import { OnboardingPage } from './OnboardingPage';

/**
 * Shown to anyone who is under the limit (3c). There is no back button and no action: the app has
 * nothing more to offer this device, and it is never told why.
 */
export function AgeStopScreen() {
  const { c } = useTheme();
  return (
    <OnboardingPage centered gap={20} paddingHorizontal={24}>
      <View style={styles.art}>
        <TendrilCurlDrawing size={120} color={c.primary} strokeWidth={3} />
      </View>
      <AppText variant="title" accessibilityRole="header">
        {onboardingCopy.ageStopTitle}
      </AppText>
      <AppText variant="body" lines="body-24">
        {onboardingCopy.ageStopLine}
      </AppText>
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  art: { opacity: 0.35, alignSelf: 'flex-start' },
});
