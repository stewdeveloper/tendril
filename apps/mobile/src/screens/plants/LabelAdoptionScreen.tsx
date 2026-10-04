import {
  fromLabelLine,
  midSentenceName,
  petCheckLine,
  plantsCopy,
  radius,
  type Animal,
  type LabelInfo,
  type Pet,
  type Severity,
  type ToxicityEntry,
} from '@tendril/core';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  BackBar,
  Button,
  EmptyState,
  HeroHeader,
  PetAteAction,
  RowsCard,
  VerdictChip,
} from '../../components';
import { useInsets } from '../../components/useInsets';
import { HERO_CONTENT_TOP } from '../../components/HeroHeader';
import { AppText, useTheme } from '../../theme';

export interface LabelAdoptionScreenProps {
  /** Null for a code we do not know, or one that has been retired (4p). */
  label: LabelInfo | null;
  pets: Pet[];
  onAdd: () => void;
  onScanPlant: () => void;
  onBack: () => void;
  onPetAte: (petId: string) => void;
}

const ANIMALS: Animal[] = ['cat', 'dog'];

// "No known toxicity" is a claim that needs a source behind it: without one it reads Unknown.
const severityOf = (entry: ToxicityEntry | undefined): Severity =>
  entry && !(entry.severity === 'none' && !entry.sourceName) ? entry.severity : 'unknown';

/**
 * A plant label's page (4o), reached by scanning its QR code: the species, who grew it, the pet
 * verdicts and the care basics, and a way to add it with no photo identification. An unknown code
 * (4p) says so and offers to scan the plant itself. Props only.
 */
export function LabelAdoptionScreen(props: LabelAdoptionScreenProps) {
  return props.label ? <Known {...props} label={props.label} /> : <Unknown {...props} />;
}

function Known({
  label,
  pets,
  onAdd,
  onBack,
  onPetAte,
}: LabelAdoptionScreenProps & { label: LabelInfo }) {
  const { c } = useTheme();
  const insets = useInsets();
  const { species } = label;
  const entry = (animal: Animal) => label.toxicity.find((t) => t.animal === animal);
  // The line under the chips speaks for the first pet's animal, else for cats.
  const first = pets.find((p) => p.animal === 'cat' || p.animal === 'dog')?.animal ?? 'cat';
  const lineEntry = entry(first);
  const line = petCheckLine({
    animal: first,
    severity: severityOf(lineEntry),
    summary: lineEntry?.summary ?? null,
    sourceName: lineEntry?.sourceName ?? null,
    petName: null,
  });
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <HeroHeader
        photoUri={species.imageUrl}
        photoLabel={`Grower photo: ${midSentenceName(species.commonName)}`}
        onBack={onBack}
      />
      <View style={[styles.sheet, { top: HERO_CONTENT_TOP, backgroundColor: c.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(42, insets.bottom + 8) },
          ]}
        >
          <AppText variant="title" accessibilityRole="header" style={styles.title}>
            {species.commonName}
          </AppText>
          <AppText variant="sci" color="textSecondary">
            {species.scientificName}
          </AppText>
          <AppText variant="sub" color="textSecondary">
            {fromLabelLine(label.growerName)}
          </AppText>
          <View style={styles.chips}>
            {ANIMALS.map((animal) => (
              <VerdictChip key={animal} animal={animal} severity={severityOf(entry(animal))} />
            ))}
          </View>
          <AppText variant="sub" color="textSecondary">
            {line}
          </AppText>
          <RowsCard rows={label.careLines.map((text, i) => ({ key: `care-${i}`, title: text }))} />
          <PetAteAction pets={pets} speciesName={species.commonName} onPetAte={onPetAte} />
          <View style={styles.spacer} />
          <View style={styles.add}>
            <Button label={plantsCopy.addToMyPlants} onPress={onAdd} />
          </View>
          <AppText variant="sub" color="textSecondary">
            {plantsCopy.noIdentificationUsed}
          </AppText>
        </ScrollView>
      </View>
    </View>
  );
}

function Unknown({ onBack, onScanPlant }: LabelAdoptionScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.plain,
          { paddingTop: insets.top, paddingBottom: Math.max(42, insets.bottom + 8) },
        ]}
      >
        <View style={styles.back}>
          <BackBar label="Back" accessibilityLabel="Back" onPress={onBack} />
        </View>
        <EmptyState text={plantsCopy.labelUnknown} />
        <AppText variant="body" lines="body-24">
          {plantsCopy.labelUnknownBody}
        </AppText>
        <View style={styles.spacer} />
        <View style={styles.add}>
          <Button label={plantsCopy.scanThePlant} onPress={onScanPlant} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    overflow: 'hidden',
    zIndex: 4,
  },
  content: { flexGrow: 1, paddingTop: 20, paddingHorizontal: 16, gap: 18 },
  plain: { flexGrow: 1, paddingHorizontal: 16, gap: 18 },
  title: { marginBottom: -10 },
  back: { marginBottom: -6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  spacer: { flex: 1 },
  add: { marginTop: -8 },
});
