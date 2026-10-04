import { cameraCopy, colors, copy, radius } from '@tendril/core';
import { Image } from 'expo-image';
import X from 'lucide-react-native/icons/x';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { Note } from '../../components/Note';
import { PhotoSlot } from '../../components/PhotoSlot';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';
import { MAX_PHOTOS } from './CameraScreen';

export interface GalleryScreenProps {
  /** The URIs chosen so far, at most five. */
  photos: string[];
  busy?: boolean;
  error?: string | null;
  /** Opens the library. */
  onChoose: () => void;
  onRemovePhoto: (index: number) => void;
  onIdentify: () => void;
  onClose: () => void;
}

const AREA_HEIGHT = 300;
const GAP = 8;
// White over a photo in both schemes, like the back circle in HeroHeader.
const ON_PHOTO = colors.light.surface;

/**
 * Gallery only (4u): the way to identify when the camera is off. A 300 pt area shows the library
 * placeholder until photos are chosen, then the photos with room to add more up to five. Identify
 * stays off until there is one.
 */
export function GalleryScreen({
  photos,
  busy = false,
  error,
  onChoose,
  onRemovePhoto,
  onIdentify,
  onClose,
}: GalleryScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  const room = photos.length < MAX_PHOTOS;
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
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          {cameraCopy.galleryTitle}
        </AppText>
        <AppText variant="sub" color="textSecondary">
          {cameraCopy.gallerySub}
        </AppText>
        {photos.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cameraCopy.galleryAdd}
            onPress={onChoose}
            style={styles.area}
          >
            <PhotoSlot label="Photo library" height={AREA_HEIGHT} radius={radius.card} />
          </Pressable>
        ) : (
          <View style={styles.area}>
            <View style={styles.grid}>
              {photos.map((uri, i) => (
                <View key={`${uri}-${i}`} style={styles.cell}>
                  <Image
                    source={{ uri }}
                    contentFit="cover"
                    accessibilityLabel={`Photo ${i + 1}`}
                    style={[styles.thumb, { backgroundColor: c.primaryTint }]}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${cameraCopy.removePhoto} ${i + 1}`}
                    onPress={() => onRemovePhoto(i)}
                    disabled={busy}
                    style={[styles.remove, { backgroundColor: c.photoButton }]}
                  >
                    <X size={20} color={ON_PHOTO} strokeWidth={2} />
                  </Pressable>
                </View>
              ))}
              {room ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={cameraCopy.galleryAdd}
                  onPress={onChoose}
                  disabled={busy}
                  style={[styles.cell, styles.add, { borderColor: c.border }]}
                >
                  <AppText variant="sub" color="textSecondary">
                    {cameraCopy.galleryAdd}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
        <Note text={error ?? copy.galleryNote} />
        <View style={styles.spacer} />
        <View style={styles.action}>
          <Button
            label={cameraCopy.identify}
            disabled={photos.length === 0}
            loading={busy}
            onPress={onIdentify}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, gap: 18 },
  back: { marginBottom: -6 },
  title: { marginBottom: -10 },
  area: { height: AREA_HEIGHT, borderRadius: radius.card, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  // Three to a row across the 361 pt the screen leaves.
  cell: { width: 112, height: 112 },
  thumb: { width: 112, height: 112, borderRadius: 12 },
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
  add: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { flex: 1 },
  action: { marginTop: -8 },
});
