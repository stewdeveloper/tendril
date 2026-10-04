import { cameraCopy } from '@tendril/core';
import Info from 'lucide-react-native/icons/info';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Note } from '../../components/Note';
import { AppText, useTheme } from '../../theme';
import { CameraStage, CloseCircle } from './CameraParts';

export interface LabelScanScreenProps {
  /** The live camera, scanning for QR codes, or a placeholder in the catalog. */
  preview: ReactNode;
  /** The last code seen was not one of ours. */
  notTendrilLabel?: boolean;
  onClose: () => void;
}

/**
 * Scanning a plant label (no frame of its own: it follows the camera's chrome, 2b). The label's QR
 * code is read as soon as it is in view, so there is no shutter: just a hint, and a note when the
 * code is not a Tendril label.
 */
export function LabelScanScreen({
  preview,
  notTendrilLabel = false,
  onClose,
}: LabelScanScreenProps) {
  return (
    <CameraStage
      preview={preview}
      top={
        <View style={styles.topRow}>
          <CloseCircle onPress={onClose} />
        </View>
      }
      panel={
        <>
          <Hint />
          {notTendrilLabel ? <Note text={cameraCopy.notTendrilLabel} /> : null}
        </>
      }
    />
  );
}

function Hint() {
  const { c } = useTheme();
  return (
    <View style={styles.hint}>
      <Info size={16} color={c.textSecondary} strokeWidth={2} />
      <AppText variant="caption" color="textSecondary" style={styles.hintText}>
        {cameraCopy.labelHint}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hintText: { flex: 1 },
});
