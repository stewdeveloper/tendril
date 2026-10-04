import { cameraCopy, copy } from '@tendril/core';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Note } from '../../components/Note';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';

export interface CameraDeniedScreenProps {
  /** What to do about it, under the headline. Defaults to the plant-scanning sentence. */
  body?: string;
  onOpenSettings: () => void;
  /** Absent where photos from the gallery would not help (the label scanner): no button, no note. */
  onChooseGallery?: () => void;
  onClose: () => void;
}

/**
 * Camera access is off (4t). Plant photos can still come from the gallery, so that stays one tap
 * away; Settings is the way back to the camera.
 */
export function CameraDeniedScreen({
  body = cameraCopy.deniedBody,
  onOpenSettings,
  onChooseGallery,
  onClose,
}: CameraDeniedScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: Math.max(42, insets.bottom + 8) },
        ]}
      >
        <View style={styles.back}>
          <BackBar label="Close" accessibilityLabel="Close" onPress={onClose} />
        </View>
        <EmptyState text={cameraCopy.deniedTitle} />
        <AppText variant="body" lines="body-24">
          {body}
        </AppText>
        {onChooseGallery ? <Note text={copy.galleryNote} /> : null}
        <View style={styles.spacer} />
        <View style={styles.action}>
          <Button label={cameraCopy.openSettings} onPress={onOpenSettings} />
        </View>
        {onChooseGallery ? (
          <View style={styles.action}>
            <Button
              label={cameraCopy.chooseFromGallery}
              variant="secondary"
              onPress={onChooseGallery}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, gap: 18 },
  back: { marginBottom: -6 },
  spacer: { flex: 1 },
  action: { marginTop: -8 },
});
