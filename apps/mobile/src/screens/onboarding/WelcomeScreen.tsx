import { onboardingCopy } from '@tendril/core';
import QrCode from 'lucide-react-native/icons/qr-code';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, PhotoSlot } from '../../components';
import { withAlpha } from '../../components/colorAlpha';
import { useInsets } from '../../components/useInsets';
import { AppText, ThemeProvider, useTheme } from '../../theme';

export interface WelcomeScreenProps {
  onGetStarted: () => void;
  onScanLabel: () => void;
  /** The full-bleed photo. A placeholder until the launch photo is chosen. */
  photoUri?: string | null;
}

/** The welcome screen (3a). Always dark, whatever the phone's setting: it sits on a photo. */
export function WelcomeScreen(props: WelcomeScreenProps) {
  return (
    <ThemeProvider scheme="dark">
      <Welcome {...props} />
    </ThemeProvider>
  );
}

function Welcome({ onGetStarted, onScanLabel, photoUri }: WelcomeScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  const [height, setHeight] = useState(852);
  return (
    <View
      style={[styles.root, { backgroundColor: c.background }]}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      <View style={StyleSheet.absoluteFill}>
        <PhotoSlot uri={photoUri} label="Plant photo, full bleed" height={height} />
      </View>
      {/* The status bar's scrim: the clock and battery never sit on the bare photo. */}
      <View
        pointerEvents="none"
        style={[
          styles.statusScrim,
          { height: Math.min(insets.top, 54), backgroundColor: withAlpha(c.background, 0.4) },
        ]}
      />
      <View
        style={[
          styles.card,
          { backgroundColor: withAlpha(c.background, 0.82), paddingBottom: insets.bottom + 12 },
        ]}
      >
        <View style={styles.text}>
          <AppText variant="moment" accessibilityRole="header">
            Tendril
          </AppText>
          <AppText variant="body" style={styles.line}>
            {onboardingCopy.welcomeLine}
          </AppText>
        </View>
        <View style={styles.actions}>
          <Button label="Get started" onPress={onGetStarted} />
          <Button
            label="Scan your plant label"
            variant="outline"
            icon={QrCode}
            onPress={onScanLabel}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  statusScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 28,
    paddingHorizontal: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    gap: 20,
  },
  text: { gap: 8 },
  line: { lineHeight: 23 },
  actions: { gap: 10 },
});
