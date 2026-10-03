import Bell from 'lucide-react-native/icons/bell';
import MapPin from 'lucide-react-native/icons/map-pin';
import { StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';
import { Button } from './Button';
import { DECORATIVE } from './decorative';
import { ScanCameraIcon } from './icons';

export type PermissionKind = 'camera' | 'location' | 'notifications';

const COPY: Record<PermissionKind, { title: string; line: string }> = {
  camera: {
    title: 'Use the camera',
    line: 'To photograph plants. Photos stay private unless you share one.',
  },
  location: {
    title: 'Use your location',
    line: 'To place your finds. Others only ever see an area, never a pin.',
  },
  notifications: {
    title: 'Care reminders',
    line: 'So we can tell you when to check the soil. We never send marketing.',
  },
};

export interface PermissionPrimerProps {
  kind: PermissionKind;
  /** Continue to the system prompt. */
  onContinue: () => void;
  /** "Not now" is always there. */
  onNotNow: () => void;
}

/**
 * Says why Tendril asks, before the system prompt (3k): a 72 pt tint circle with the permission's
 * icon, a Fraunces title, one line, then Continue and a text "Not now".
 */
export function PermissionPrimer({ kind, onContinue, onNotNow }: PermissionPrimerProps) {
  const { c } = useTheme();
  const { title, line } = COPY[kind];
  return (
    <View style={styles.root}>
      <View style={[styles.circle, { backgroundColor: c.primaryTint }]}>
        {kind === 'camera' ? (
          <ScanCameraIcon size={32} color={c.primary} />
        ) : kind === 'location' ? (
          <MapPin {...DECORATIVE} size={32} color={c.primary} strokeWidth={2} />
        ) : (
          <Bell {...DECORATIVE} size={32} color={c.primary} strokeWidth={2} />
        )}
      </View>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      <AppText variant="body" lines="body-24">
        {line}
      </AppText>
      <View style={styles.actions}>
        <Button label="Continue" onPress={onContinue} />
        <Button label="Not now" variant="text" onPress={onNotNow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 20 },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  actions: { gap: 8 },
});
