import { onboardingCopy } from '@tendril/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppleIcon, Button, TextField, type IconProps } from '../../components';
import { AppText, useTheme } from '../../theme';
import { OnboardingPage } from './OnboardingPage';
import { OnboardingProgress } from './OnboardingProgress';

export interface SignInScreenProps {
  /** "Continue with Apple" is offered on iOS only (and always in the catalog). */
  showApple: boolean;
  onApple: () => void;
  onGoogle: () => void;
  /** The address, trimmed, when "Email me a sign-in link" is pressed. */
  onEmail: (email: string) => void;
  onBack: () => void;
  onTerms?: () => void;
  onPrivacy?: () => void;
  /** Pre-fills the email field (the catalog shows it empty). */
  initialEmail?: string;
  /** True while the link is being sent. */
  sending?: boolean;
}

/** The ring-and-G mark of "Continue with Google" (3d). */
function GoogleMark({ size = 20, color }: IconProps) {
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.google, { width: size, height: size, borderColor: color }]}
    >
      <AppText variant="caption" color={color} style={styles.googleG}>
        G
      </AppText>
    </View>
  );
}

/** Sign in (3d): Apple, Google, or an emailed link. The terms line sits at the foot. */
export function SignInScreen({
  showApple,
  onApple,
  onGoogle,
  onEmail,
  onBack,
  onTerms,
  onPrivacy,
  initialEmail = '',
  sending = false,
}: SignInScreenProps) {
  const { c } = useTheme();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const submit = () => {
    const trimmed = email.trim();
    // Only enough of a check to catch a slip: the link itself is the proof the address is real.
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) return setError(onboardingCopy.emailRequired);
    setError(null);
    onEmail(trimmed);
  };
  return (
    <OnboardingPage>
      <OnboardingProgress step={2} onBack={onBack} />
      <View style={styles.text}>
        <AppText variant="title" accessibilityRole="header">
          {onboardingCopy.signInTitle}
        </AppText>
        <AppText variant="body" color={c.textSecondary} style={styles.line}>
          {onboardingCopy.signInLine}
        </AppText>
      </View>
      <View style={styles.group}>
        {showApple ? (
          <Button label="Continue with Apple" variant="ink" icon={AppleIcon} onPress={onApple} />
        ) : null}
        <Button
          label="Continue with Google"
          accessibilityLabel="Continue with Google"
          variant="neutral"
          icon={GoogleMark}
          onPress={onGoogle}
        />
      </View>
      <View style={styles.divider}>
        <View style={[styles.rule, { backgroundColor: c.border, opacity: 0.4 }]} />
        <AppText variant="caption" color={c.textSecondary}>
          {onboardingCopy.orUseEmail}
        </AppText>
        <View style={[styles.rule, { backgroundColor: c.border, opacity: 0.4 }]} />
      </View>
      <View style={styles.group}>
        <TextField
          label="Email"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            setError(null);
          }}
          error={error ?? undefined}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={submit}
        />
        <Button
          label="Email me a sign-in link"
          variant="secondary"
          loading={sending}
          onPress={submit}
        />
      </View>
      <View style={styles.spacer} />
      <AppText variant="caption" color={c.textSecondary} style={styles.terms}>
        By continuing you agree to the{' '}
        <AppText
          variant="caption"
          color="primary"
          style={styles.link}
          onPress={onTerms}
          role="link"
        >
          Terms of Use
        </AppText>{' '}
        and{' '}
        <AppText
          variant="caption"
          color="primary"
          style={styles.link}
          onPress={onPrivacy}
          role="link"
        >
          Privacy Policy
        </AppText>
        .
      </AppText>
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  text: { gap: 8 },
  line: { lineHeight: 23 },
  group: { gap: 10 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { flex: 1, height: 1 },
  spacer: { flex: 1 },
  terms: { textAlign: 'center' },
  link: { textDecorationLine: 'underline' },
  google: { borderWidth: 2, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  googleG: { fontWeight: '700', fontSize: 12, lineHeight: 16 },
});
