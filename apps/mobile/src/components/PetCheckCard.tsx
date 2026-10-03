import {
  bandFor,
  confidenceLabel,
  likelyMatchNote,
  petCheckLine,
  type Animal,
  type Pet,
  type ToxicityEntry,
} from '@tendril/core';
import Cat from 'lucide-react-native/icons/cat';
import Dog from 'lucide-react-native/icons/dog';
import PawPrint from 'lucide-react-native/icons/paw-print';
import Phone from 'lucide-react-native/icons/phone';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppText, useTheme } from '../theme';
import { Button } from './Button';
import { Card } from './Card';
import { ConfidenceIcon } from './ConfidenceLabel';
import { DECORATIVE } from './decorative';
import { VerdictChip } from './VerdictChip';

export interface PetCheckCardProps {
  pets: Pet[];
  toxicity: ToxicityEntry[];
  /** The identification's probability; null where there is no match to depend on (plant detail). */
  matchProbability: number | null;
  speciesName: string;
  onPetAte: () => void;
  onSourcePress?: (url: string) => void;
}

const KIND: Record<Animal, string> = { cat: 'Cat', dog: 'Dog', other: 'Other pet' };
const YOUR: Record<Animal, string> = { cat: 'Your cat', dog: 'Your dog', other: 'Your pet' };

/** "Miso", "Miso and Bran", "Miso, Bran and Pip". Pets without a name are left out. */
function joinNames(pets: Pet[]): string {
  const names = pets.map((p) => p.name?.trim()).filter((n): n is string => !!n);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The pet check (2a): one row per household pet with a verdict chip, one plain line and its source,
 * then how sure the match is and the way to the emergency screen. It renders nothing without pets;
 * the caller hides the section.
 */
export function PetCheckCard({
  pets,
  toxicity,
  matchProbability,
  speciesName,
  onPetAte,
  onSourcePress,
}: PetCheckCardProps) {
  const { c } = useTheme();
  if (pets.length === 0) return null;
  const band = matchProbability == null ? null : bandFor(matchProbability);
  const note = band == null ? null : likelyMatchNote(band);
  const names = joinNames(pets);
  return (
    <Card gap={16}>
      <View style={styles.header}>
        <AppText variant="heading" accessibilityRole="header">
          Pet check
        </AppText>
        {names ? (
          <AppText variant="caption" color="textSecondary" style={styles.names}>
            {names}
          </AppText>
        ) : null}
      </View>
      {pets.map((pet, i) => (
        <Fragment key={pet.id}>
          {i > 0 ? <View style={[styles.divider, { backgroundColor: c.hairline }]} /> : null}
          <PetRow
            pet={pet}
            entry={
              pet.animal === 'other' ? undefined : toxicity.find((t) => t.animal === pet.animal)
            }
            onSourcePress={onSourcePress}
          />
        </Fragment>
      ))}
      {matchProbability != null && band != null ? (
        <View style={styles.match}>
          <View style={[styles.footer, { backgroundColor: c.primaryTint }]}>
            <ConfidenceIcon band={band} color={c.primary} />
            <AppText variant="caption" color="primary" style={styles.footerText}>
              {`Based on the match: ${confidenceLabel(matchProbability)}`}
            </AppText>
          </View>
          {note ? <AppText variant="sub">{note}</AppText> : null}
        </View>
      ) : null}
      <Button
        label="My pet ate this"
        variant="secondary"
        icon={Phone}
        compact
        onPress={onPetAte}
        accessibilityHint={`Gets help if a pet has eaten ${speciesName}`}
      />
    </Card>
  );
}

function PetRow({
  pet,
  entry,
  onSourcePress,
}: {
  pet: Pet;
  entry: ToxicityEntry | undefined;
  onSourcePress?: (url: string) => void;
}) {
  const { c } = useTheme();
  const Icon = pet.animal === 'cat' ? Cat : pet.animal === 'dog' ? Dog : PawPrint;
  const line = petCheckLine({
    animal: pet.animal,
    severity: entry?.severity ?? 'unknown',
    summary: entry?.summary ?? null,
    sourceName: entry?.sourceName ?? null,
    petName: pet.name,
  });
  return (
    <View style={styles.pet}>
      <View style={styles.petTop}>
        <View style={[styles.avatar, { backgroundColor: c.primaryTint }]}>
          <Icon {...DECORATIVE} size={22} color={c.primary} strokeWidth={2} />
        </View>
        <View style={styles.who}>
          <AppText variant="bodyStrong">{pet.name?.trim() || YOUR[pet.animal]}</AppText>
          <AppText variant="caption" color="textSecondary">
            {KIND[pet.animal]}
          </AppText>
        </View>
        <VerdictChip animal={pet.animal} severity={entry?.severity ?? 'unknown'} />
      </View>
      <PetLine
        line={line}
        sourceName={entry?.sourceName ?? null}
        sourceUrl={entry?.sourceUrl ?? null}
        onSourcePress={onSourcePress}
      />
    </View>
  );
}

/**
 * The plain line, with "Source: <name>." as an underlined link at its end (2a). The line already
 * ends that way for mild and moderate; for the others (no known toxicity, severe) the source is
 * added after it, so every row carries one. An inline link keeps the line's flow; WCAG 2.5.8
 * exempts targets inside a sentence from the minimum target size.
 */
function PetLine({
  line,
  sourceName,
  sourceUrl,
  onSourcePress,
}: {
  line: string;
  sourceName: string | null;
  sourceUrl: string | null;
  onSourcePress?: (url: string) => void;
}) {
  const { c } = useTheme();
  if (!sourceName) return <AppText variant="sub">{line}</AppText>;
  const tail = `Source: ${sourceName}.`;
  const head = line.endsWith(tail) ? line.slice(0, -tail.length) : `${line} `;
  return (
    <AppText variant="sub">
      {head}
      {'Source: '}
      {sourceUrl ? (
        <Text
          accessibilityRole="link"
          onPress={() => onSourcePress?.(sourceUrl)}
          style={[styles.link, { color: c.primary }]}
        >
          {sourceName}
        </Text>
      ) : (
        sourceName
      )}
      {'.'}
    </AppText>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  names: { flexShrink: 1, textAlign: 'right' },
  pet: { gap: 10 },
  petTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  who: { flex: 1, minWidth: 0 },
  divider: { height: 1 },
  match: { gap: 10 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  footerText: { flex: 1 },
  link: { textDecorationLine: 'underline' },
});
