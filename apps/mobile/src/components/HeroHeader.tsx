import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { PhotoSlot } from './PhotoSlot';
import { useInsets } from './useInsets';

/** Photo-led screens (4o, 2d): the photo is 236 pt tall and the content sheet overlaps it from 212. */
export const HERO_PHOTO_HEIGHT = 236;
export const HERO_CONTENT_TOP = 212;

export interface HeroHeaderProps {
  photoUri?: string | null;
  /** What the photo shows ("Your photo: Monty"); the placeholder's caption when there is no photo. */
  photoLabel: string;
  /** The photo's opacity: 0.55 for a plant that was given away (4k). */
  opacity?: number;
  onBack: () => void;
  /** Buttons for the right of the top row (the "..." menu). Build them as 44 pt `photoButton` circles. */
  right?: ReactNode;
  /** Photo height when the screen uses a taller hero than the standard 236 (2d uses 300). */
  height?: number;
}

/**
 * The photo, a 112 pt top scrim for the status bar, and the back circle. It is absolutely
 * positioned at the top of the screen; the screen draws its content sheet (16 pt top radius) from
 * `HERO_CONTENT_TOP` over it.
 */
export function HeroHeader({
  photoUri,
  photoLabel,
  opacity = 1,
  onBack,
  right,
  height = HERO_PHOTO_HEIGHT,
}: HeroHeaderProps) {
  const { c } = useTheme();
  const insets = useInsets();
  // 60 pt on an iPhone 16 (59 pt inset), so the circle clears the Dynamic Island's row.
  const top = insets.top + 1;
  return (
    <View style={[styles.root, { height }]}>
      <View style={{ opacity }}>
        <PhotoSlot uri={photoUri} label={photoLabel} height={height} />
      </View>
      <View style={[styles.scrim, { backgroundColor: c.scrim }]} />
      <View style={[styles.buttons, { top }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={[styles.circle, { backgroundColor: c.photoButton }]}
        >
          <ChevronLeft size={24} color="#FFFFFF" strokeWidth={2} />
        </Pressable>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 112, pointerEvents: 'none' },
  buttons: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
