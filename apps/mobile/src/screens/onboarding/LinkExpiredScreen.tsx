import { linkExpiredLine, onboardingCopy } from '@tendril/core';
import Clock from 'lucide-react-native/icons/clock';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components';
import { DECORATIVE } from '../../components/decorative';
import { AppText, useTheme } from '../../theme';
import { OnboardingPage } from './OnboardingPage';
import { OnboardingBack } from './OnboardingProgress';

export interface LinkExpiredScreenProps {
  email: string;
  onSendNew: () => void;
  onUseDifferent: () => void;
  onBack: () => void;
  /** True while a fresh link is going out. */
  sending?: boolean;
}

/** "This link has expired" (3f): the link is single-use and lasts 15 minutes. */
export function LinkExpiredScreen({
  email,
  onSendNew,
  onUseDifferent,
  onBack,
  sending = false,
}: LinkExpiredScreenProps) {
  const { c } = useTheme();
  const line = linkExpiredLine(email);
  return (
    <OnboardingPage gap={20}>
      <OnboardingBack onBack={onBack} />
      <View style={[styles.circle, { backgroundColor: c.primaryTint }]}>
        <Clock {...DECORATIVE} size={32} color={c.primary} strokeWidth={2} />
      </View>
      <AppText variant="title" accessibilityRole="header">
        {onboardingCopy.linkExpiredTitle}
      </AppText>
      <AppText variant="body" lines="body-24">
        {line}
      </AppText>
      <View style={styles.spacer} />
      <View style={styles.actions}>
        <Button label="Send a new link" loading={sending} onPress={onSendNew} />
        <Button label="Use a different email" variant="text" onPress={onUseDifferent} />
      </View>
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
  },
  spacer: { flex: 1 },
  actions: { gap: 8 },
});
