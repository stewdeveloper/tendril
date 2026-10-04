import { colors, radius } from '@tendril/core';
import X from 'lucide-react-native/icons/x';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { withAlpha } from '../../components/colorAlpha';
import { useInsets } from '../../components/useInsets';
import { ThemeProvider, useTheme } from '../../theme';

/** White over the camera in both schemes, like the back circle over a hero photo. */
export const ON_CAMERA = colors.light.surface;
/** Dark ink for text on a white chip over the camera. */
export const INK_ON_CAMERA = colors.light.textPrimary;

const CORNER = 36;
const FINDER = 240;

export interface CameraStageProps {
  /** The live camera, or a placeholder. Fills the screen, behind everything else. */
  preview: ReactNode;
  /** The controls over the top of the picture: the close button and whatever sits beside it. */
  top: ReactNode;
  /** The sheet at the bottom: the shutter and tray, or the label hint. */
  panel: ReactNode;
}

/**
 * The camera chrome (2b): the picture full bleed, a dimming band at the top so white controls
 * read, four viewfinder corners, and a dark panel rounded at its top corners. The camera is dark
 * in both schemes, so everything inside is drawn under the dark theme whatever the app is set to.
 */
export function CameraStage(props: CameraStageProps) {
  return (
    <ThemeProvider scheme="dark">
      <Stage {...props} />
    </ThemeProvider>
  );
}

function Stage({ preview, top, panel }: CameraStageProps) {
  const { c } = useTheme();
  const insets = useInsets();
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <View style={StyleSheet.absoluteFill}>{preview}</View>
      <View
        pointerEvents="none"
        style={[styles.dim, { backgroundColor: withAlpha(c.background, 0.5) }]}
      />
      <View style={[styles.top, { paddingTop: insets.top + 1 }]}>{top}</View>
      <View pointerEvents="none" style={styles.finder}>
        <ViewfinderCorners />
      </View>
      <View
        style={[
          styles.panel,
          { backgroundColor: c.background, paddingBottom: Math.max(16, insets.bottom) },
        ]}
      >
        {panel}
      </View>
    </View>
  );
}

/** The 44 pt close circle (2b). */
export function CloseCircle({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      onPress={onPress}
      style={[styles.close, { backgroundColor: c.photoButton }]}
    >
      <X size={24} color={ON_CAMERA} strokeWidth={2} />
    </Pressable>
  );
}

/** Four white corner marks around a 240 pt square, where the plant or the code goes. */
function ViewfinderCorners() {
  const edge = { borderColor: ON_CAMERA, borderWidth: 0 };
  const side = 3;
  return (
    <View style={styles.corners}>
      <View
        style={[
          styles.corner,
          edge,
          { top: 0, left: 0, borderTopWidth: side, borderLeftWidth: side, borderTopLeftRadius: 16 },
        ]}
      />
      <View
        style={[
          styles.corner,
          edge,
          {
            top: 0,
            right: 0,
            borderTopWidth: side,
            borderRightWidth: side,
            borderTopRightRadius: 16,
          },
        ]}
      />
      <View
        style={[
          styles.corner,
          edge,
          {
            bottom: 0,
            left: 0,
            borderBottomWidth: side,
            borderLeftWidth: side,
            borderBottomLeftRadius: 16,
          },
        ]}
      />
      <View
        style={[
          styles.corner,
          edge,
          {
            bottom: 0,
            right: 0,
            borderBottomWidth: side,
            borderRightWidth: side,
            borderBottomRightRadius: 16,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: { position: 'absolute', top: 0, left: 0, right: 0, height: 176 },
  // In flow so the content below it can never be covered; the picture and corners are behind.
  top: { paddingHorizontal: 16 },
  // Fills the space between the controls and the panel and centres the corners in it, with the
  // 8 pt drop the frame has.
  finder: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8 },
  corners: { width: FINDER, height: FINDER },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
  panel: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 16,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
