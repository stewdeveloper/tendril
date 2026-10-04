import { linkSentLine, onboardingCopy } from '@tendril/core';
import Mail from 'lucide-react-native/icons/mail';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components';
import { DECORATIVE } from '../../components/decorative';
import { AppText, useTheme } from '../../theme';
import { OnboardingPage } from './OnboardingPage';
import { OnboardingBack } from './OnboardingProgress';

export interface LinkSentScreenProps {
  email: string;
  onOpenMail: () => void;
  onResend: () => void;
  onBack: () => void;
  /** True while a fresh link is going out. */
  resending?: boolean;
}

/** "Check your email" (3e). The address is set bold inside the sentence. */
export function LinkSentScreen({
  email,
  onOpenMail,
  onResend,
  onBack,
  resending = false,
}: LinkSentScreenProps) {
  const { c } = useTheme();
  const line = linkSentLine(email);
  const [before, after] = line.split(email) as [string, string];
  return (
    <OnboardingPage gap={20}>
      <OnboardingBack onBack={onBack} />
      <View style={[styles.circle, { backgroundColor: c.primaryTint }]}>
        <Mail {...DECORATIVE} size={32} color={c.primary} strokeWidth={2} />
      </View>
      <AppText variant="title" accessibilityRole="header">
        {onboardingCopy.linkSentTitle}
      </AppText>
      <AppText variant="body" lines="body-24">
        {before}
        <AppText variant="bodyStrong" lines="body-24">
          {email}
        </AppText>
        {after}
      </AppText>
      <View style={styles.spacer} />
      <View style={styles.actions}>
        <Button label="Open Mail" onPress={onOpenMail} />
        <Button label="Send it again" variant="text" loading={resending} onPress={onResend} />
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
