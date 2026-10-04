import { colors, diagnosisCopy, photosCount, radius } from '@tendril/core';
import X from 'lucide-react-native/icons/x';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BackBar, Button, Note } from '../../components';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';

export const MAX_DIAGNOSIS_PHOTOS = 3;
const THUMB = 96;
// White over a photo in both schemes, like the back circle in HeroHeader.
const ON_PHOTO = colors.light.surface;

export interface DiagnosisPhotosScreenProps {
  plantName: string;
  /** The photo URIs picked so far, one to three. */
  photos: string[];
  /** Checking is in flight. */
  busy?: boolean;
  /** What went wrong, in words, or nothing. */
  error?: string | null;
  onTake: () => void;
  onChoose: () => void;
  onRemove: (index: number) => void;
  onCheck: () => void;
  onBack: () => void;
}

/**
 * The step before a diagnosis (no frame of its own): one to three photos of what worries the
 * person, from the camera or the library. The check stays off until there is a photo.
 */
export function DiagnosisPhotosScreen({
  plantName,
  photos,
  busy = false,
  error,
  onTake,
  onChoose,
  onRemove,
  onCheck,
  onBack,
}: DiagnosisPhotosScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  const full = photos.length >= MAX_DIAGNOSIS_PHOTOS;
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: Math.max(42, insets.bottom + 8) },
        ]}
      >
        <View style={styles.back}>
          <BackBar label={plantName} onPress={onBack} />
        </View>
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          {diagnosisCopy.photosTitle}
        </AppText>
        <AppText variant="body" lines="body-24">
          {diagnosisCopy.photosLine}
        </AppText>
        {photos.length > 0 ? (
          <View style={styles.thumbs}>
            {photos.map((uri, i) => (
              <View key={`${uri}-${i}`} style={styles.thumbSlot}>
                <Image
                  source={{ uri }}
                  contentFit="cover"
                  accessibilityLabel={`Photo ${i + 1}`}
                  style={[styles.thumb, { backgroundColor: c.primaryTint }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${diagnosisCopy.removePhoto} ${i + 1}`}
                  onPress={() => onRemove(i)}
                  disabled={busy}
                  style={[styles.remove, { backgroundColor: c.photoButton }]}
                >
                  <X size={20} color={ON_PHOTO} strokeWidth={2} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <AppText variant="sub" color="textSecondary">
          {photosCount(photos.length)}
        </AppText>
        {full ? <Note text={diagnosisCopy.photosFull} /> : null}
        {error ? <Note text={error} /> : null}
        <Button
          label={diagnosisCopy.takePhoto}
          variant="secondary"
          disabled={full || busy}
          onPress={onTake}
        />
        <Button
          label={diagnosisCopy.choosePhoto}
          variant="secondary"
          disabled={full || busy}
          onPress={onChoose}
        />
        <View style={styles.spacer} />
        <Button
          label={diagnosisCopy.check}
          disabled={photos.length === 0}
          loading={busy}
          onPress={onCheck}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, gap: 18 },
  back: { marginBottom: -6 },
  title: { marginBottom: -10 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  thumbSlot: { width: THUMB, height: THUMB },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.card },
  remove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { flex: 1 },
});
