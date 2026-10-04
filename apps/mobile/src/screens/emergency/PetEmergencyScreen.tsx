import { emergencyBody, emergencyCopy, bandFor, likelyMatchNote } from '@tendril/core';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { BackBar, Button, Note, VerdictChip } from '../../components';
import { useInsets } from '../../components/useInsets';
import { telUrl } from '../../lib/links';
import { AppText, useTheme } from '../../theme';
import type { EmergencyInfo } from '../../api/types';

export interface PetEmergencyScreenProps {
  /** Null while it loads or when the lookup failed: the screen then offers only the safe actions. */
  info: EmergencyInfo | null;
  /** Shows a spinner where the toxicity goes. Only with no `info`. */
  loading?: boolean;
  /** What the back row calls the screen it returns to: the plant's nickname or the species name. */
  backLabel?: string;
  onCallVet: () => void;
  onCallPoisonLine: () => void;
  onFindVet: () => void;
  onSaveVet: () => void;
  onBack: () => void;
}

/**
 * "If Miso ate peace lily" (4bh, 4bi): what the data says, then the calls, low on the screen where
 * a thumb reaches. The vet comes first. There are no timers and no countdowns; the screen stays as
 * calm as the facts allow. A number with no digits to dial gets no call button. With nothing known
 * yet, or nothing found, the way to a vet is still here.
 */
export function PetEmergencyScreen({
  info,
  loading = false,
  backLabel,
  onCallVet,
  onCallPoisonLine,
  onFindVet,
  onSaveVet,
  onBack,
}: PetEmergencyScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  const vet = info?.vet ?? null;
  const poisonLine = info?.poisonLine ?? null;
  const callableVet = vet != null && telUrl(vet.phone) != null;
  const callableLine = poisonLine != null && telUrl(poisonLine.phone) != null;
  const toxicity = info?.toxicity ?? null;
  const source = info
    ? emergencyCopy.sourceLine(toxicity?.sourceName ?? null, info.matchProbability)
    : null;
  const hedge =
    info?.matchProbability != null ? likelyMatchNote(bandFor(info.matchProbability)) : null;
  const note = !info
    ? emergencyCopy.callNearestVet
    : vet == null
      ? emergencyCopy.noVetNote
      : callableVet
        ? null
        : emergencyCopy.vetNoNumber(vet.name);
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: Math.max(42, insets.bottom + 8) },
        ]}
      >
        <View style={styles.back}>
          <BackBar
            label={backLabel ?? 'Back'}
            accessibilityLabel={backLabel ? undefined : 'Back'}
            onPress={onBack}
          />
        </View>
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          {info ? emergencyCopy.title(info.petName, info.speciesName) : emergencyCopy.fallbackTitle}
        </AppText>
        {info ? (
          <>
            <View style={styles.chip}>
              <VerdictChip animal={info.animal} severity={toxicity?.severity ?? 'unknown'} />
            </View>
            <AppText variant="body" lines="body-24">
              {emergencyBody({ animal: info.animal, petName: info.petName, toxicity })}
            </AppText>
            {source ? (
              <AppText variant="sub" color="textSecondary">
                {source}
              </AppText>
            ) : null}
            {hedge ? <Note text={hedge} /> : null}
          </>
        ) : loading ? (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Loading"
            style={styles.spinner}
          >
            <ActivityIndicator color={c.primary} />
          </View>
        ) : null}
        {note ? <Note text={note} /> : null}
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
                tight
                label={emergencyCopy.callPoisonLine(poisonLine.name, poisonLine.phone)}
                // Spoken with the plain number: the display string joins it with non-breaking
                // characters so it never wraps, and a screen reader reads those oddly.
                accessibilityLabel={`Call ${poisonLine.name} ${poisonLine.phone}`}
                variant="secondary"
                onPress={onCallPoisonLine}
              />
            </View>
            <AppText variant="sub" color="textSecondary">
              {poisonLine.note}
            </AppText>
          </>
        ) : null}
        {info && !callableVet ? (
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
  spinner: { alignItems: 'flex-start', minHeight: 44, justifyContent: 'center' },
  spacer: { flex: 1 },
  action: { marginTop: -8 },
});
