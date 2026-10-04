import { placeTypeOptions, resultCopy, type PlaceType } from '@tendril/core';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Note } from '../../components/Note';
import { OptionPills } from '../../components/OptionPills';
import { Sheet, SheetOverlay } from '../../components/Sheet';
import { AppText } from '../../theme';

export interface LogFindSheetProps {
  /** Shows or hides the `modal` presentation. `overlay` is drawn whenever it is mounted. */
  visible: boolean;
  /** Where the find was. Null until the person chooses: nothing is preselected. */
  placeType: PlaceType | null;
  /** The location permission is on. Off, the find goes in the Plantdex without points. */
  locationOn: boolean;
  /** Saving is in flight. */
  saving?: boolean;
  /** What went wrong saving, in words. */
  error?: string | null;
  /** Save find stays off (the save cannot be confirmed as already done). */
  blocked?: boolean;
  /** The server cannot save this result: the action becomes Scan again. */
  rejected?: boolean;
  onPlaceType: (placeType: PlaceType) => void;
  onSave: () => void;
  /** Rejected: goes back to the camera. */
  onScanAgain?: () => void;
  onTurnOnLocation: () => void;
  onClose: () => void;
  /** `modal` is the app's bottom sheet; `overlay` is drawn inline over the screen, for the catalog frames. */
  presentation?: 'modal' | 'overlay';
}

/** Panel heights from the frames, as floors: 4z (location on) is 492 pt tall, 4aa 472 pt. */
const MIN_HEIGHT = 492;
const MIN_HEIGHT_LOCATION_OFF = 472;

/**
 * "Log a find" (4z, 4aa): where the find was, then Save find. The place is required, because the
 * server rejects a find without one, so Save find stays off until a pill is chosen. With location
 * off the note says the find earns no points, and Turn on location is offered.
 */
export function LogFindSheet({
  visible,
  placeType,
  locationOn,
  saving = false,
  error,
  blocked = false,
  rejected = false,
  onPlaceType,
  onSave,
  onScanAgain,
  onTurnOnLocation,
  onClose,
  presentation = 'modal',
}: LogFindSheetProps) {
  const content = (
    <>
      <AppText variant="caption" color="textSecondary" style={styles.label}>
        {resultCopy.whereWasIt}
      </AppText>
      <OptionPills
        options={[...placeTypeOptions]}
        value={placeType ?? ''}
        onChange={(v) => onPlaceType(v as PlaceType)}
      />
      <Note text={locationOn ? resultCopy.pointsNote : resultCopy.locationOffNote} />
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
      <View style={styles.spacer} />
      <View style={styles.action}>
        {rejected ? (
          <Button label={resultCopy.scanAgain} onPress={() => onScanAgain?.()} />
        ) : (
          <Button
            label={resultCopy.saveFind}
            disabled={placeType == null || blocked}
            loading={saving}
            onPress={onSave}
          />
        )}
      </View>
      {locationOn ? null : (
        <View style={styles.action}>
          <Button label={resultCopy.turnOnLocation} variant="text" onPress={onTurnOnLocation} />
        </View>
      )}
    </>
  );
  const panel = {
    title: resultCopy.logFind,
    onClose,
    minHeight: locationOn ? MIN_HEIGHT : MIN_HEIGHT_LOCATION_OFF,
    children: content,
  };
  if (presentation === 'overlay') return <SheetOverlay {...panel} />;
  return <Sheet visible={visible} {...panel} />;
}

const styles = StyleSheet.create({
  // The frame pulls the label 8 pt up to the pills and each button 8 pt closer than the 18 pt rhythm.
  label: { marginBottom: -8 },
  spacer: { flex: 1 },
  action: { marginTop: -8 },
});
