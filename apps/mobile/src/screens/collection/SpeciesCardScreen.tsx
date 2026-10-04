import {
  collectionCopy,
  copy,
  midSentenceName,
  petCheckLine,
  setProgressValue,
  type Animal,
  type Pet,
  type ToxicityEntry,
} from '@tendril/core';
import { StyleSheet, View } from 'react-native';
import { Button, Note, PetAteAction, RarityBadge, RowsCard, type Row } from '../../components';
import { AppText } from '../../theme';
import type { SpeciesCard } from '../../api/types';
import { PetVerdictChips, ResultFrame } from '../scan/ResultParts';

export interface SpeciesCardScreenProps {
  card: SpeciesCard;
  pets: Pet[];
  onBack: () => void;
  onSeeOnMap: () => void;
  /** The pet that ate it. The species is confirmed (it is in the Plantdex), so the emergency states its verdict outright. */
  onPetAte: (petId: string) => void;
}

/**
 * One plain line per kind of pet, as the pet check writes it. Pets whose verdict is still unknown
 * share one line, naming the first of them, as the frame does (4ai).
 */
function petLines(pets: Pet[], toxicity: ToxicityEntry[]): string[] {
  const kinds = [...new Set(pets.map((p): Animal => p.animal))];
  const lines: string[] = [];
  let unknownShown = false;
  for (const animal of kinds) {
    const entry = toxicity.find((t) => t.animal === animal);
    const pet = pets.find((p) => p.animal === animal)!;
    const line = petCheckLine({
      animal,
      severity: entry?.severity ?? 'unknown',
      summary: entry?.summary ?? null,
      sourceName: entry?.sourceName ?? null,
      petName: pet.name,
    });
    if (line.startsWith('Not reviewed')) {
      if (unknownShown) continue;
      unknownShown = true;
    }
    lines.push(line);
  }
  return lines;
}

/**
 * A species in the Plantdex (4ai): its names and rarity, the person's finds and sets, and what it
 * means for their pets. A sensitive species (4aj) shows no rarity, says its location is private and
 * has no map button. Props only.
 */
export function SpeciesCardScreen({
  card,
  pets,
  onBack,
  onSeeOnMap,
  onPetAte,
}: SpeciesCardScreenProps) {
  const { species } = card;
  const rows: Row[] = [
    { key: 'finds', title: collectionCopy.yourFinds, right: String(card.findsCount) },
    ...card.sets.map((s) => ({
      key: s.name,
      title: s.name,
      right: setProgressValue(s.found, s.total),
    })),
  ];
  return (
    <ResultFrame
      photoHeight={236}
      sheetTop={212}
      photoUri={species.imageUrl}
      photoLabel={`Your photo: ${midSentenceName(species.commonName)}`}
      leading="back"
      onLeading={onBack}
    >
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        {species.commonName}
      </AppText>
      <AppText variant="sci" color="textSecondary">
        {species.scientificName}
      </AppText>
      {species.sensitive ? null : <RarityBadge tier={species.rarity} style={styles.rarity} />}
      <RowsCard rows={rows} />
      {species.sensitive ? <Note text={copy.sensitiveSpecies} /> : null}
      <PetVerdictChips pets={pets} toxicity={card.toxicity} settled />
      {petLines(pets, card.toxicity).map((line) => (
        <AppText key={line} variant="sub" color="textSecondary">
          {line}
        </AppText>
      ))}
      <PetAteAction pets={pets} speciesName={species.commonName} onPetAte={onPetAte} />
      <View style={styles.spacer} />
      {species.sensitive ? null : (
        <View style={styles.pulled}>
          <Button label={collectionCopy.seeOnMap} variant="secondary" onPress={onSeeOnMap} />
        </View>
      )}
    </ResultFrame>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: -10 },
  // The rarity pill hugs the rows below it and keeps to its own width.
  rarity: { alignSelf: 'flex-start', marginBottom: -6 },
  spacer: { flex: 1 },
  pulled: { marginTop: -8 },
});
