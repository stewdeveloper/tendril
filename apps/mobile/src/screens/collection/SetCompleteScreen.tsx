import { momentCopy, setCompleteLine } from '@tendril/core';
import { StyleSheet, View } from 'react-native';
import { BackBar } from '../../components/BackBar';
import { Button } from '../../components/Button';
import { TendrilDrawing } from '../../components/icons';
import { RarityBadge } from '../../components/RarityBadge';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';

export interface SetCompleteScreenProps {
  setName: string;
  total: number;
  onShare: () => void;
  onContinue: () => void;
  onBack: () => void;
}

/** A completed set (4al): the tendril drawing, the set's name, "Set complete: 6 of 6." and a Legendary badge. Props only. */
export function SetCompleteScreen({
  setName,
  total,
  onShare,
  onContinue,
  onBack,
}: SetCompleteScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: c.background,
          paddingTop: insets.top,
          paddingBottom: Math.max(42, insets.bottom + 8),
        },
      ]}
    >
      <View style={styles.back}>
        <BackBar label={momentCopy.setsBack} onPress={onBack} />
      </View>
      <View style={styles.flex} />
      <View style={styles.drawing}>
        <TendrilDrawing color={c.primary} />
      </View>
      <AppText variant="moment" accessibilityRole="header" style={styles.name}>
        {setName}
      </AppText>
      <AppText variant="body" lines="body-24">
        {setCompleteLine(total)}
      </AppText>
      <RarityBadge tier="legendary" style={styles.badge} />
      <View style={styles.flex} />
      <View style={styles.action}>
        <Button label={momentCopy.share} onPress={onShare} />
      </View>
      <View style={styles.action}>
        <Button label={momentCopy.continue} variant="text" onPress={onContinue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 16, gap: 18 },
  flex: { flex: 1 },
  back: { marginBottom: -6 },
  // 48 pt above, and the empty sentence's 16 pt gap plus 8 pt below, as in the frame.
  drawing: { alignItems: 'center', opacity: 0.35, paddingTop: 48, paddingBottom: 24 },
  name: { marginBottom: -10 },
  badge: { alignSelf: 'flex-start', marginBottom: -6 },
  action: { marginTop: -8 },
});
