import {
  bandFor,
  confidenceA11yLabel,
  confidenceLabel,
  copy,
  likelyMatchNote,
  likelyResultLine,
  midSentenceName,
  resultCopy,
  thisIsLine,
  type PlaceType,
  type Pet,
  type ScanResult,
  type Suggestion,
} from '@tendril/core';
import Sprout from 'lucide-react-native/icons/sprout';
import Sun from 'lucide-react-native/icons/sun';
import Thermometer from 'lucide-react-native/icons/thermometer';
import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ConfidenceLabel } from '../../components/ConfidenceLabel';
import { DECORATIVE } from '../../components/decorative';
import { ScanCameraIcon } from '../../components/icons';
import { Note } from '../../components/Note';
import { PetAteAction, PetCheckCard } from '../../components/PetCheckCard';
import { PhotoSlot } from '../../components/PhotoSlot';
import { RowsCard } from '../../components/RowsCard';
import { AppText, useTheme } from '../../theme';
import { LogFindSheet } from './LogFindSheet';
import { HealthCheckCard, PetVerdictChips, ResultFrame } from './ResultParts';

export interface ResultScreenProps {
  result: ScanResult;
  pets: Pet[];
  /** The "Log a find" sheet (4z, 4aa); null while there is none. `placeType` is null until chosen. */
  logFind: {
    visible: boolean;
    placeType: PlaceType | null;
    locationOn: boolean;
    saving?: boolean;
    error?: string | null;
    /** The save cannot work again (already saved, or rejected): Save find stays off. */
    blocked?: boolean;
  } | null;
  /** `modal` is the app's sheet; `overlay` draws it inline over the screen, for the catalog frames. */
  presentation?: 'modal' | 'overlay';
  onClose: () => void;
  onAddToPlants: (speciesId: string) => void;
  onLogFind: () => void;
  onChoose: (speciesId: string) => void;
  onRetake: () => void;
  onRetry: () => void;
  onPetAte: (petId: string) => void;
  /** Opens a toxicity source's page. Without it the source is plain text. */
  onSourcePress?: (url: string) => void;
  onPlaceType: (placeType: PlaceType) => void;
  onSaveFind: () => void;
  onTurnOnLocation: () => void;
  onCloseLogFind: () => void;
}

/**
 * A scan's result (2a, 2c, 4v to 4y). What it shows depends on the state and on how sure the match
 * is: very likely is the full page with both actions; likely compares the top two and asks to
 * confirm; not sure asks for a better photo and shows nothing it cannot back; not a plant, offline
 * and an error each say so and say that no identification was used. Props only.
 */
export function ResultScreen(props: ResultScreenProps) {
  const { result, logFind, presentation } = props;
  const top = result.suggestions[0];
  let body;
  if (result.state === 'identified' && top) {
    const band = bandFor(top.probability);
    body =
      band === 'very_likely' ? (
        <VeryLikely {...props} top={top} />
      ) : band === 'likely' ? (
        <Likely {...props} top={top} />
      ) : (
        <NotSure {...props} />
      );
  } else {
    body = <Plain {...props} state={result.state === 'identified' ? 'error' : result.state} />;
  }
  return (
    <View style={styles.root}>
      {body}
      {logFind && top ? (
        <LogFindSheet
          visible={logFind.visible}
          placeType={logFind.placeType}
          locationOn={logFind.locationOn}
          saving={logFind.saving}
          error={logFind.error}
          blocked={logFind.blocked}
          presentation={presentation}
          onPlaceType={props.onPlaceType}
          onSave={props.onSaveFind}
          onTurnOnLocation={props.onTurnOnLocation}
          onClose={props.onCloseLogFind}
        />
      ) : null}
    </View>
  );
}

/** 2a: the species, the pet check, the care basics and the other possibilities. */
function VeryLikely({ result, pets, top, ...on }: ResultScreenProps & { top: Suggestion }) {
  const { species } = top;
  return (
    <ResultFrame
      photoHeight={280}
      sheetTop={256}
      photoUri={result.photoUrls[0] ?? null}
      photoUrls={result.photoUrls}
      photoLabel={`Your photo: ${midSentenceName(species.commonName)}`}
      leading="close"
      onLeading={on.onClose}
      gap={24}
      footer={
        <View style={styles.footer}>
          <View style={styles.footerLog}>
            <Button label={resultCopy.logFind} variant="secondary" onPress={on.onLogFind} />
          </View>
          <View style={styles.footerAdd}>
            <Button label={resultCopy.addToMyPlants} onPress={() => on.onAddToPlants(species.id)} />
          </View>
        </View>
      }
    >
      <View style={styles.heading}>
        <ConfidenceLabel probability={top.probability} />
        <View style={styles.names}>
          <AppText variant="title" accessibilityRole="header">
            {species.commonName}
          </AppText>
          <AppText variant="sci" color="textSecondary">
            {species.scientificName}
          </AppText>
        </View>
      </View>
      <PetCheckCard
        pets={pets}
        toxicity={result.toxicity}
        matchProbability={top.probability}
        speciesName={species.commonName}
        onPetAte={on.onPetAte}
        onSourcePress={on.onSourcePress}
      />
      {result.diagnosis ? <HealthCheckCard diagnosis={result.diagnosis} /> : null}
      {result.care ? (
        <View style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">
            {resultCopy.careBasics}
          </AppText>
          <View style={styles.tiles}>
            <CareTile icon={Sun} label={resultCopy.careLight} value={result.care.light} />
            <CareTile icon={Sprout} label={resultCopy.careSoil} value={result.care.soilCheck} />
            {result.care.warmth ? (
              <CareTile
                icon={Thermometer}
                label={resultCopy.careWarmth}
                value={result.care.warmth}
              />
            ) : null}
          </View>
        </View>
      ) : null}
      {result.suggestions.length > 1 ? (
        <View style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">
            {resultCopy.otherPossibilities}
          </AppText>
          {result.suggestions.slice(1).map((s) => (
            <Card key={s.species.id} padding={12}>
              <View style={styles.alt}>
                <PhotoSlot
                  uri={s.referenceImageUrl}
                  label={`Reference: ${midSentenceName(s.species.commonName)}`}
                  width={56}
                  height={56}
                  radius={12}
                  showLabel={false}
                />
                <View style={styles.grow}>
                  <AppText variant="bodyStrong">{s.species.commonName}</AppText>
                  <AppText variant="sci" color="textSecondary">
                    {s.species.scientificName}
                  </AppText>
                </View>
                <AppText
                  variant="caption"
                  color="textSecondary"
                  accessibilityLabel={confidenceA11yLabel(s.probability)}
                  style={styles.altRight}
                >
                  {confidenceLabel(s.probability).replace(', ', ',\n')}
                </AppText>
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </ResultFrame>
  );
}

function CareTile({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  value: string;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.tile}>
      <Card padding={12} gap={8}>
        <View {...DECORATIVE}>
          <Icon size={24} color={c.primary} strokeWidth={2} />
        </View>
        <View>
          <AppText variant="caption" color="textSecondary">
            {label}
          </AppText>
          <AppText variant="sub" style={styles.tileValue}>
            {value}
          </AppText>
        </View>
      </Card>
    </View>
  );
}

/** 4v: the top two side by side, with the pet verdicts held back behind a note, and one way to go on. */
function Likely({ result, pets, top, ...on }: ResultScreenProps & { top: Suggestion }) {
  const { species } = top;
  const percent = Math.round(top.probability * 100);
  const note = likelyMatchNote(bandFor(top.probability));
  return (
    <ResultFrame
      photoHeight={236}
      sheetTop={212}
      photoUri={result.photoUrls[0] ?? null}
      photoUrls={result.photoUrls}
      photoLabel="Your photo"
      leading="back"
      onLeading={on.onClose}
    >
      <ConfidenceLabel probability={top.probability} compact style={styles.pill} />
      <AppText variant="body" lines="body-24">
        {likelyResultLine(species.commonName, percent)}
      </AppText>
      <RowsCard
        rows={result.suggestions.slice(0, 2).map((s) => ({
          key: s.species.id,
          title: s.species.commonName,
          subtitle: s.species.scientificName,
          subtitleItalic: true,
          right: confidenceLabel(s.probability),
          accessibilityLabel: thisIsLine(s.species.commonName),
          onPress: () => on.onChoose(s.species.id),
        }))}
      />
      <PetVerdictChips pets={pets} toxicity={result.toxicity} settled reassure={false} />
      {note ? <Note text={note} /> : null}
      {result.diagnosis ? <HealthCheckCard diagnosis={result.diagnosis} /> : null}
      <PetAteAction pets={pets} speciesName={species.commonName} onPetAte={on.onPetAte} />
      <View style={styles.pull}>
        <Button label={thisIsLine(species.commonName)} onPress={() => on.onChoose(species.id)} />
      </View>
    </ResultFrame>
  );
}

/** 2c: not sure. Asks for a close photo, lists the closest matches, and every verdict stays Unknown. */
function NotSure({ result, pets, ...on }: ResultScreenProps) {
  const top = result.suggestions[0]!;
  const note = likelyMatchNote(bandFor(top.probability));
  return (
    <ResultFrame
      photoHeight={220}
      sheetTop={196}
      photoUri={result.photoUrls[0] ?? null}
      photoUrls={result.photoUrls}
      photoLabel="Your photo"
      leading="close"
      onLeading={on.onClose}
      gap={24}
      footer={
        <Button label={resultCopy.takeClosePhoto} icon={ScanCameraIcon} onPress={on.onRetake} />
      }
    >
      <View style={styles.heading}>
        <ConfidenceLabel probability={top.probability} />
        <AppText variant="title" accessibilityRole="header">
          {resultCopy.notSureTitle}
        </AppText>
        <AppText variant="body" lines="body-24">
          {copy.notSure}
        </AppText>
      </View>
      <View style={styles.section}>
        <AppText variant="heading" accessibilityRole="header">
          {resultCopy.closestMatches}
        </AppText>
        <View style={styles.tiles}>
          {result.suggestions.slice(0, 2).map((s) => (
            <View key={s.species.id} style={styles.tile}>
              <Card padding={0} style={styles.matchCard}>
                <PhotoSlot
                  uri={s.referenceImageUrl}
                  label={`Reference: ${midSentenceName(s.species.commonName)}`}
                  height={120}
                />
                <View style={styles.matchText}>
                  <AppText variant="bodyStrong">{s.species.commonName}</AppText>
                  <AppText variant="sci" color="textSecondary">
                    {s.species.scientificName}
                  </AppText>
                  <AppText
                    variant="caption"
                    color="textSecondary"
                    accessibilityLabel={confidenceA11yLabel(s.probability)}
                    style={styles.matchLabel}
                  >
                    {confidenceLabel(s.probability)}
                  </AppText>
                </View>
              </Card>
            </View>
          ))}
        </View>
      </View>
      <Card gap={14}>
        <AppText variant="heading" accessibilityRole="header">
          {resultCopy.petCheck}
        </AppText>
        <PetVerdictChips pets={pets} toxicity={[]} settled={false} />
        {note ? <AppText variant="sub">{note}</AppText> : null}
        <PetAteAction pets={pets} speciesName={top.species.commonName} onPetAte={on.onPetAte} />
      </Card>
    </ResultFrame>
  );
}

/** 4w, 4x, 4y: no plant found, offline, or an error. */
function Plain({
  result,
  state,
  ...on
}: ResultScreenProps & { state: 'not_a_plant' | 'offline' | 'error' }) {
  const text = {
    not_a_plant: { title: resultCopy.notAPlantTitle, body: copy.notAPlant },
    offline: { title: resultCopy.offlineTitle, body: resultCopy.offlineBody },
    error: { title: resultCopy.errorTitle, body: resultCopy.errorBody },
  }[state];
  return (
    <ResultFrame
      photoHeight={236}
      sheetTop={212}
      photoUri={result.photoUrls[0] ?? null}
      photoLabel="Your photo"
      leading="back"
      onLeading={on.onClose}
    >
      <AppText variant="title" accessibilityRole="header" style={styles.pullTitle}>
        {text.title}
      </AppText>
      <AppText variant="body" lines="body-24">
        {text.body}
      </AppText>
      {state === 'not_a_plant' ? <Note text={resultCopy.noIdentificationUsed} /> : null}
      <View style={styles.spacer} />
      {state === 'offline' ? (
        <View style={styles.pull}>
          <Button label={resultCopy.ok} onPress={on.onClose} />
        </View>
      ) : (
        <>
          <View style={styles.pull}>
            <Button
              label={resultCopy.tryAgain}
              onPress={state === 'error' ? on.onRetry : on.onRetake}
            />
          </View>
          {state === 'error' ? (
            <View style={styles.pull}>
              <Button label={resultCopy.close} variant="text" onPress={on.onClose} />
            </View>
          ) : null}
        </>
      )}
    </ResultFrame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heading: { alignItems: 'flex-start', gap: 8 },
  names: { gap: 2 },
  section: { gap: 12 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, minWidth: 0 },
  tileValue: { lineHeight: 20 },
  alt: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  altRight: { textAlign: 'right' },
  matchCard: { flex: 1, overflow: 'hidden' },
  matchText: { paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12, gap: 2 },
  matchLabel: { marginTop: 4 },
  footer: { flexDirection: 'row', gap: 12 },
  footerLog: { flex: 1 },
  footerAdd: { flex: 1.5 },
  // The frames pull the pill, the title and the last buttons 8 to 10 pt closer than the 18 pt rhythm.
  pill: { alignSelf: 'flex-start', marginBottom: -8 },
  pull: { marginTop: -8 },
  pullTitle: { marginBottom: -10 },
  spacer: { flex: 1 },
});
