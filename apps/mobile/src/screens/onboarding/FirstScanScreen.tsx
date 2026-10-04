import { onboardingCopy } from '@tendril/core';
import Lock from 'lucide-react-native/icons/lock';
import { StyleSheet, View } from 'react-native';
import { Button, LeafIcon, Note, ScanCameraIcon } from '../../components';
import { DECORATIVE } from '../../components/decorative';
import { AppText, useTheme } from '../../theme';
import { OnboardingPage } from './OnboardingPage';
import { OnboardingProgress } from './OnboardingProgress';

export interface FirstScanScreenProps {
  /** Show the "Home area skipped" note: they skipped step 4. */
  homeAreaSkipped: boolean;
  onAllowCamera: () => void;
  onNotNow: () => void;
  onBack: () => void;
}

/**
 * The camera primer before the first scan (3k): what to point it at, why it needs the camera and
 * that photos stay private. Built here rather than from `PermissionPrimer` because the frame puts
 * the note and the actions at the foot of the screen, below a spacer.
 */
export function FirstScanScreen({
  homeAreaSkipped,
  onAllowCamera,
  onNotNow,
  onBack,
}: FirstScanScreenProps) {
  const { c } = useTheme();
  const [fill, camera, privacy] = onboardingCopy.firstScanLines;
  const lines = [
    { icon: <LeafIcon size={22} color={c.primary} strokeWidth={2} />, text: fill },
    { icon: <ScanCameraIcon size={22} color={c.primary} strokeWidth={2} />, text: camera },
    {
      icon: <Lock {...DECORATIVE} size={22} color={c.primary} strokeWidth={2} />,
      text: privacy,
    },
  ];
  return (
    <OnboardingPage gap={20}>
      <OnboardingProgress step={5} onBack={onBack} />
      <View style={[styles.circle, { backgroundColor: c.primaryTint }]}>
        <ScanCameraIcon size={32} color={c.primary} />
      </View>
      <AppText variant="title" accessibilityRole="header">
        {onboardingCopy.firstScanTitle}
      </AppText>
      <View style={styles.lines}>
        {lines.map((line) => (
          <View key={line.text} style={styles.line}>
            {line.icon}
            <AppText variant="body" style={styles.lineText}>
              {line.text}
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.spacer} />
      {homeAreaSkipped ? <Note tone="dark" text={onboardingCopy.homeAreaSkipped} /> : null}
      <View style={styles.actions}>
        <Button label="Allow camera" onPress={onAllowCamera} />
        <Button label="Not now" variant="text" onPress={onNotNow} />
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
    marginTop: 24,
  },
  lines: { gap: 14 },
  line: { flexDirection: 'row', gap: 12 },
  lineText: { flex: 1, lineHeight: 23 },
  spacer: { flex: 1 },
  actions: { gap: 8 },
});
