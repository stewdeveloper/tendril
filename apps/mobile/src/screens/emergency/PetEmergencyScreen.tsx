import { emergencyCopy, petCheckLine } from '@tendril/core';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BackBar, Button, Note, VerdictChip } from '../../components';
import { useInsets } from '../../components/useInsets';
import { telUrl } from '../../lib/links';
import { AppText, useTheme } from '../../theme';
import type { EmergencyInfo } from '../../api/types';

export interface PetEmergencyScreenProps {
  info: EmergencyInfo;
  /** What the back row calls the screen it returns to: the plant's nickname or the species name. */
  backLabel: string;
  onCallVet: () => void;
  onCallPoisonLine: () => void;
  onFindVet: () => void;
  onSaveVet: () => void;
  onBack: () => void;
}

/**
 * "If Miso ate peace lily" (4bh, 4bi): what the data says, then the calls, low on the screen where
 * a thumb reaches. The vet comes first. There are no timers and no countdowns; the screen stays as
 * calm as the facts allow. A number with no digits to dial gets no call button.
 */
export function PetEmergencyScreen({
  info,
  backLabel,
  onCallVet,
  onCallPoisonLine,
  onFindVet,
  onSaveVet,
  onBack,
}: PetEmergencyScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  const { toxicity, vet, poisonLine } = info;
  const callableVet = vet != null && telUrl(vet.phone) != null;
  const callableLine = poisonLine != null && telUrl(poisonLine.phone) != null;
  const body =
    toxicity?.summary ??
    toxicity?.symptoms ??
    petCheckLine({
      animal: info.animal,
      severity: toxicity?.severity ?? 'unknown',
      summary: null,
      sourceName: toxicity?.sourceName ?? null,
      petName: info.petName,
    });
  const source = emergencyCopy.sourceLine(toxicity?.sourceName ?? null, info.matchProbability);
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: Math.max(42, insets.bottom + 8) },
        ]}
      >
        <View style={styles.back}>
          <BackBar label={backLabel} onPress={onBack} />
        </View>
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          {emergencyCopy.title(info.petName, info.speciesName)}
        </AppText>
        <View style={styles.chip}>
          <VerdictChip animal={info.animal} severity={toxicity?.severity ?? 'unknown'} />
        </View>
        <AppText variant="body" lines="body-24">
          {body}
        </AppText>
        {source ? (
          <AppText variant="sub" color="textSecondary">
            {source}
          </AppText>
        ) : null}
        {vet == null ? <Note text={emergencyCopy.noVetNote} /> : null}
        <View style={styles.spacer} />
        {callableVet ? (
          <View style={styles.action}>
            <Button label={emergencyCopy.callVet} onPress={onCallVet} />
          </View>
        ) : (
          <View style={styles.action}>
            <Button label={emergencyCopy.findVet} onPress={onFindVet} />
          </View>
        )}
        {callableLine ? (
          <>
            <View style={styles.action}>
              <Button
                label={emergencyCopy.callPoisonLine(poisonLine.name, poisonLine.phone)}
                variant="secondary"
                onPress={onCallPoisonLine}
              />
            </View>
            <AppText variant="sub" color="textSecondary">
              {poisonLine.note}
            </AppText>
          </>
        ) : null}
        {vet == null ? (
          <View style={styles.action}>
            <Button label={emergencyCopy.saveVet} variant="text" onPress={onSaveVet} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, gap: 18 },
  back: { marginBottom: -6 },
  title: { marginBottom: -10 },
  chip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spacer: { flex: 1 },
  action: { marginTop: -8 },
});
