import { Image } from 'expo-image';
import ImageGlyph from 'lucide-react-native/icons/image';
import { StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';

export interface PhotoSlotProps {
  uri?: string | null;
  /** What the photo shows ("Your photo: peace lily"). Shown on the placeholder, read as the alt text. */
  label: string;
  height: number;
  radius?: number;
  /** A fixed width in pt for the small lead slots (44 to 52 pt). Defaults to the parent's width. */
  width?: number;
  /** Draw `label` on the placeholder (default). The small slots show the icon alone, as in 2e. */
  showLabel?: boolean;
}

/**
 * A photo, or the design's `image-slot` placeholder when there is none: a faint grey fill, a
 * dashed ring and an image icon over the label (design/claude-design/image-slot.js).
 */
export function PhotoSlot({
  uri,
  label,
  height,
  radius = 0,
  width,
  showLabel = true,
}: PhotoSlotProps) {
  const { c } = useTheme();
  const frame = { height, borderRadius: radius, ...(width != null ? { width } : null) };
  if (uri) {
    return (
      <View style={[styles.frame, frame]}>
        <Image
          source={{ uri }}
          contentFit="cover"
          accessibilityLabel={label}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.frame, frame]}
    >
      <View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: c.border }]} />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.ring,
          { borderColor: c.textPrimary, borderRadius: radius },
        ]}
      />
      <View style={styles.center}>
        <View style={styles.glyph}>
          <ImageGlyph size={showLabel ? 28 : 24} color={c.textPrimary} strokeWidth={1.6} />
        </View>
        {showLabel ? (
          <AppText variant="caption" style={styles.caption}>
            {label}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', overflow: 'hidden' },
  fill: { opacity: 0.08 },
  ring: { borderWidth: 1.5, borderStyle: 'dashed', opacity: 0.35 },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
  },
  glyph: { opacity: 0.45 },
  caption: { textAlign: 'center', maxWidth: '90%', opacity: 0.75 },
});
