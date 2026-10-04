import {
  cameraCopy,
  copy,
  healthToggleLine,
  trayCount,
  type Organ,
  type QuotaState,
} from '@tendril/core';
import Flower from 'lucide-react-native/icons/flower';
import HeartPulse from 'lucide-react-native/icons/heart-pulse';
import ImageGlyph from 'lucide-react-native/icons/image';
import Info from 'lucide-react-native/icons/info';
import Leaf from 'lucide-react-native/icons/leaf';
import Sprout from 'lucide-react-native/icons/sprout';
import type { ComponentType, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { PhotoSlot } from '../../components/PhotoSlot';
import { QuotaMeter } from '../../components/QuotaMeter';
import { withAlpha } from '../../components/colorAlpha';
import { AppText, useTheme } from '../../theme';
import { CameraStage, CloseCircle, INK_ON_CAMERA, ON_CAMERA } from './CameraParts';

export const MAX_PHOTOS = 5;

export interface CameraScreenProps {
  /** The live camera, or a placeholder in the catalog. */
  preview: ReactNode;
  /** The identification quota, shown as the pill at the top. */
  quota: QuotaState;
  organ: Organ;
  /** The tray: the URIs of the photos taken so far, at most five. An empty string draws a placeholder (the catalog). */
  photos: string[];
  /** "Check its health" is on: the identify also spends a diagnosis. */
  healthCheck: boolean;
  diagnosisQuota: QuotaState;
  /** Identifying is in flight. */
  busy?: boolean;
  /** What went wrong, in words, in place of the gallery note. */
  error?: string | null;
  onOrgan: (organ: Organ) => void;
  onShutter: () => void;
  onRemovePhoto: (index: number) => void;
  onGallery: () => void;
  onToggleHealth: (on: boolean) => void;
  onIdentify: () => void;
  onClose: () => void;
}

const ORGANS: {
  value: Organ;
  label: string;
  Icon: ComponentType<{ size: number; color: string; strokeWidth: number }>;
}[] = [
  { value: 'leaf', label: cameraCopy.organLeaf, Icon: Leaf },
  { value: 'flower', label: cameraCopy.organFlower, Icon: Flower },
  { value: 'whole', label: cameraCopy.organWhole, Icon: Sprout },
];

/**
 * The camera (2b), always dark: the quota pill and organ chips over the picture, a tray of up to
 * five photos, the shutter, Identify (off until there is a photo), the health toggle and the
 * gallery note. Props only: the route owns the camera, the picker and the API.
 */
export function CameraScreen(props: CameraScreenProps) {
  const { photos, healthCheck, diagnosisQuota, busy = false, error } = props;
  const full = photos.length >= MAX_PHOTOS;
  return (
    <CameraStage
      preview={props.preview}
      top={
        <>
          <View style={styles.topRow}>
            <CloseCircle onPress={props.onClose} />
            <QuotaMeter quota={props.quota} variant="pill" />
            <View style={styles.balance} />
          </View>
          <View accessibilityRole="radiogroup" style={styles.chips}>
            {ORGANS.map(({ value, label, Icon }) => (
              <OrganChip
                key={value}
                label={label}
                selected={props.organ === value}
                Icon={Icon}
                onPress={() => props.onOrgan(value)}
              />
            ))}
          </View>
        </>
      }
      panel={
        <>
          <Tray photos={photos} onRemove={props.onRemovePhoto} />
          <View style={styles.controls}>
            <View style={styles.side}>
              <GalleryButton onPress={props.onGallery} />
            </View>
            <Shutter disabled={full} onPress={props.onShutter} />
            <View style={[styles.side, styles.sideEnd]}>
              <Button
                compact
                label={cameraCopy.identify}
                disabled={photos.length === 0}
                loading={busy}
                onPress={props.onIdentify}
              />
            </View>
          </View>
          <HealthToggle on={healthCheck} quota={diagnosisQuota} onChange={props.onToggleHealth} />
          {error ? (
            <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
              {error}
            </AppText>
          ) : (
            <GalleryNote />
          )}
        </>
      }
    />
  );
}

function OrganChip({
  label,
  selected,
  Icon,
  onPress,
}: {
  label: string;
  selected: boolean;
  Icon: ComponentType<{ size: number; color: string; strokeWidth: number }>;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const fg = selected ? INK_ON_CAMERA : ON_CAMERA;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: ON_CAMERA }
          : {
              backgroundColor: c.photoButton,
              borderColor: withAlpha(ON_CAMERA, 0.7),
              borderWidth: 1.5,
            },
      ]}
    >
      {selected ? <Icon size={18} color={fg} strokeWidth={2} /> : null}
      <AppText variant="caption" color={fg}>
        {label}
      </AppText>
    </Pressable>
  );
}

const SLOT = 52;

/** Five slots: a photo in each one taken (tap to remove it), a ring where there is room. */
function Tray({ photos, onRemove }: { photos: string[]; onRemove: (index: number) => void }) {
  const { c } = useTheme();
  return (
    <View style={styles.tray}>
      {Array.from({ length: MAX_PHOTOS }, (_, i) => {
        const uri = photos[i];
        if (uri == null) {
          return (
            <View key={i} style={[styles.slot, styles.emptySlot, { borderColor: c.border }]} />
          );
        }
        return (
          <Pressable
            key={`${uri}-${i}`}
            accessibilityRole="button"
            accessibilityLabel={`${cameraCopy.removePhoto} ${i + 1}`}
            accessibilityHint="Takes this photo out of the scan"
            onPress={() => onRemove(i)}
            style={styles.slot}
          >
            <PhotoSlot
              uri={uri || null}
              label={`Photo ${i + 1}`}
              width={SLOT}
              height={SLOT}
              radius={12}
              showLabel={false}
            />
            {i === 0 ? (
              <View pointerEvents="none" style={[styles.ring, { borderColor: c.primary }]} />
            ) : null}
          </Pressable>
        );
      })}
      <AppText variant="caption" color="textSecondary" style={styles.count}>
        {trayCount(photos.length)}
      </AppText>
    </View>
  );
}

function GalleryButton({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cameraCopy.gallery}
      onPress={onPress}
      style={styles.gallery}
    >
      <View style={[styles.galleryCircle, { backgroundColor: c.surface }]}>
        <ImageGlyph size={24} color={c.textPrimary} strokeWidth={2} />
      </View>
      <AppText variant="caption" color="textSecondary">
        {cameraCopy.gallery}
      </AppText>
    </Pressable>
  );
}

/** The 80 pt shutter: a ring around a solid disc. Off at five photos, the tray's limit. */
function Shutter({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={cameraCopy.takePhoto}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.shutter, { borderColor: c.textPrimary, opacity: disabled ? 0.4 : 1 }]}
    >
      <View style={[styles.disc, { backgroundColor: c.textPrimary }]} />
    </Pressable>
  );
}

/** "Check its health": a switch that adds a diagnosis to the scan. Off and disabled once the month's are used. */
function HealthToggle({
  on,
  quota,
  onChange,
}: {
  on: boolean;
  quota: QuotaState;
  onChange: (on: boolean) => void;
}) {
  const { c } = useTheme();
  const usedUp = quota.used >= quota.limit;
  const line = healthToggleLine(quota);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={cameraCopy.healthToggle}
      accessibilityHint={line}
      accessibilityState={{ checked: on && !usedUp, disabled: usedUp }}
      disabled={usedUp}
      onPress={() => onChange(!on)}
      style={[styles.toggle, { backgroundColor: c.surface, opacity: usedUp ? 0.4 : 1 }]}
    >
      <HeartPulse size={22} color={c.primary} strokeWidth={2} />
      <View style={styles.toggleText}>
        <AppText variant="body">{cameraCopy.healthToggle}</AppText>
        <AppText variant="caption" color="textSecondary">
          {line}
        </AppText>
      </View>
      <View style={[styles.track, { backgroundColor: on && !usedUp ? c.primary : c.border }]}>
        <View
          style={[styles.knob, { backgroundColor: c.textPrimary }, on && !usedUp && styles.knobOn]}
        />
      </View>
    </Pressable>
  );
}

function GalleryNote() {
  const { c } = useTheme();
  return (
    <View style={styles.note}>
      <Info size={16} color={c.textSecondary} strokeWidth={2} />
      <AppText variant="caption" color="textSecondary" style={styles.noteText}>
        {copy.galleryNote}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // Matches the close circle, so the pill sits in the middle.
  balance: { width: 44 },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tray: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slot: { width: SLOT, height: SLOT, borderRadius: 12 },
  emptySlot: { borderWidth: 1.5 },
  // The frame draws it as an outer 2 pt shadow, so it takes no room from the photo.
  ring: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 14,
    borderWidth: 2,
  },
  count: { flex: 1, textAlign: 'right' },
  controls: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1 },
  sideEnd: { alignItems: 'flex-end' },
  gallery: { alignItems: 'flex-start', gap: 4, minWidth: 48 },
  galleryCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disc: { width: 64, height: 64, borderRadius: 32 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  toggleText: { flex: 1 },
  track: { width: 51, height: 31, borderRadius: 999, justifyContent: 'center' },
  knob: { width: 27, height: 27, borderRadius: 14, marginLeft: 2 },
  knobOn: { marginLeft: 22 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  noteText: { flex: 1 },
});
