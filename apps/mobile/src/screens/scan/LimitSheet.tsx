import { limitReachedBody, limitReachedTitle, type QuotaState } from '@tendril/core';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Sheet, SheetOverlay } from '../../components/Sheet';
import { AppText } from '../../theme';

export interface LimitSheetProps {
  /** The quota that ran out. Its plan decides whether Premium is offered. */
  quota: QuotaState;
  /** Shows or hides the `modal` presentation. `overlay` is drawn whenever it is mounted. */
  visible: boolean;
  onTryPremium: () => void;
  onClose: () => void;
  /** `modal` is the app's bottom sheet; `overlay` is drawn inline over the screen, for the catalog frames. */
  presentation?: 'modal' | 'overlay';
}

/** Panel heights from the frames, as floors: 452 pt with the upsell (4af), 372 pt without (4ag). */
const WITH_UPSELL_MIN_HEIGHT = 452;
const PREMIUM_MIN_HEIGHT = 372;

/**
 * "Limit reached" (4af, 4ag): when more arrive, and for a free person what Premium adds, with
 * "Try Premium" and "Not now". Premium at its own cap has nothing to upgrade to, so it gets the
 * reset date and "OK" alone, with no upsell.
 */
export function LimitSheet({
  quota,
  visible,
  onTryPremium,
  onClose,
  presentation = 'modal',
}: LimitSheetProps) {
  const premium = quota.plan === 'premium';
  const content = (
    <>
      <AppText variant="body" lines="body-24">
        {limitReachedBody(quota)}
      </AppText>
      <View style={styles.spacer} />
      {premium ? (
        <View style={styles.action}>
          <Button label="OK" onPress={onClose} />
        </View>
      ) : (
        <>
          <View style={styles.action}>
            <Button label="Try Premium" onPress={onTryPremium} />
          </View>
          <View style={styles.action}>
            <Button label="Not now" variant="text" onPress={onClose} />
          </View>
        </>
      )}
    </>
  );
  const panel = {
    title: limitReachedTitle(quota.kind, quota.plan, quota.limit),
    onClose,
    minHeight: premium ? PREMIUM_MIN_HEIGHT : WITH_UPSELL_MIN_HEIGHT,
    children: content,
  };
  if (presentation === 'overlay') return <SheetOverlay {...panel} />;
  return <Sheet visible={visible} {...panel} />;
}

const styles = StyleSheet.create({
  spacer: { flex: 1 },
  // The frame pulls each button 8 pt closer than the sheet's 18 pt rhythm.
  action: { marginTop: -8 },
});
