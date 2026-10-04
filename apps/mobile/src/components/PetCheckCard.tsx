import {
  bandFor,
  confidenceLabel,
  effectiveSeverity,
  likelyMatchNote,
  petCheckLine,
  type Animal,
  type ConfidenceBand,
  type Pet,
  type ToxicityEntry,
} from '@tendril/core';
import Cat from 'lucide-react-native/icons/cat';
import Dog from 'lucide-react-native/icons/dog';
import PawPrint from 'lucide-react-native/icons/paw-print';
import Phone from 'lucide-react-native/icons/phone';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  /** Called with the pet that ate it; with several pets the card asks which one first. */
  onPetAte: (petId: string) => void;
  onSourcePress?: (url: string) => void;
  /**
   * `compact` is the plant detail's pet check (2d): one line per pet with its name and verdict, no
   * avatar, kind caption or names in the header, and no "Based on the match" footer, because the
   * plant is already the person's own.
   */
  variant?: 'full' | 'compact';
}

/**
 * On a match that is only likely, "no known toxicity" is not shown: it would reassure about a plant
 * that may be the wrong one. A toxic verdict still shows as it is.
 */
const hedge = (entry: ToxicityEntry | undefined, band: ConfidenceBand | null) =>
  entry && entry.severity === 'none' && band === 'likely' ? undefined : entry;

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
  variant = 'full',
}: PetCheckCardProps) {
  const { c } = useTheme();
  if (pets.length === 0) return null;
  const compact = variant === 'compact';
  const band = matchProbability == null ? null : bandFor(matchProbability);
  const note = band == null ? null : likelyMatchNote(band);
  const names = joinNames(pets);
  return (
    <Card gap={16}>
      <View style={styles.header}>
        <AppText variant="heading" accessibilityRole="header">
          Pet check
        </AppText>
        {names && !compact ? (
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
              // Not sure of the match: nothing is stated about the plant, so every row is Unknown
              // (2c). Never present data for a plant that may be the wrong one.
              band === 'not_sure' || pet.animal === 'other'
                ? undefined
                : hedge(
                    toxicity.find((t) => t.animal === pet.animal),
                    band,
                  )
            }
            onSourcePress={onSourcePress}
            compact={compact}
          />
        </Fragment>
      ))}
      {!compact && matchProbability != null && band != null ? (
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
      <PetAteAction pets={pets} speciesName={speciesName} onPetAte={onPetAte} />
    </Card>
  );
}

/**
 * "My pet ate this": calls through at once with a single pet, and with several asks which pet
 * first. The pet check card draws it, and so does label adoption (4o), which has no card.
 */
export function PetAteAction({
  pets,
  speciesName,
  onPetAte,
}: Pick<PetCheckCardProps, 'pets' | 'speciesName' | 'onPetAte'>) {
  const [choosing, setChoosing] = useState(false);
  if (pets.length === 0) return null;
  return (
    <>
      <Button
        label="My pet ate this"
        variant="secondary"
        icon={Phone}
        compact
        onPress={() => {
          const only = pets.length === 1 ? pets[0] : undefined;
          if (only) onPetAte(only.id);
          else setChoosing(true);
        }}
        accessibilityHint={`Gets help if a pet has eaten ${speciesName}`}
      />
      {choosing ? (
        <View style={styles.choose}>
          <AppText variant="caption" color="textSecondary" accessibilityRole="header">
            Which pet?
          </AppText>
          {pets.map((pet) => (
            <Button
              key={pet.id}
              label={pet.name?.trim() || YOUR[pet.animal]}
              variant="secondary"
              compact
              onPress={() => onPetAte(pet.id)}
            />
          ))}
        </View>
      ) : null}
    </>
  );
}

function PetRow({
  pet,
  entry: rawEntry,
  onSourcePress,
  compact,
}: {
  pet: Pet;
  entry: ToxicityEntry | undefined;
  onSourcePress?: (url: string) => void;
  compact: boolean;
}) {
  const { c } = useTheme();
  const Icon = pet.animal === 'cat' ? Cat : pet.animal === 'dog' ? Dog : PawPrint;
  // "No known toxicity" is a claim that needs a source behind it: without one the row is Unknown.
  const entry =
    rawEntry && rawEntry.severity === 'none' && !rawEntry.sourceName ? undefined : rawEntry;
  const line = petCheckLine({
    animal: pet.animal,
    severity: entry?.severity ?? 'unknown',
    summary: entry?.summary ?? null,
    sourceName: entry?.sourceName ?? null,
    petName: pet.name,
  });
  // An unreviewed row has no source to cite, whatever the entry holds.
  const source =
    entry?.sourceName && effectiveSeverity(pet.animal, entry.severity) !== 'unknown'
      ? { name: entry.sourceName, url: entry.sourceUrl }
      : null;
  return (
    <View style={styles.pet}>
      <View style={styles.petTop}>
        {compact ? null : (
          <View style={[styles.avatar, { backgroundColor: c.primaryTint }]}>
            <Icon {...DECORATIVE} size={22} color={c.primary} strokeWidth={2} />
          </View>
        )}
        <View style={styles.who}>
          <AppText variant="bodyStrong">{pet.name?.trim() || YOUR[pet.animal]}</AppText>
          {compact ? null : (
            <AppText variant="caption" color="textSecondary">
              {KIND[pet.animal]}
            </AppText>
          )}
        </View>
        <VerdictChip animal={pet.animal} severity={entry?.severity ?? 'unknown'} />
      </View>
      <PetLine line={line} source={source} onSourcePress={onSourcePress} />
    </View>
  );
}

interface Source {
  name: string;
  url: string | null;
}

/**
 * Core's line, word for word. Where it names the source ("Source: ASPCA." on mild and moderate,
 * "(ASPCA)" on no known toxicity) that name becomes the link, in place. A line that doesn't name it
 * (severe) stays untouched, so "Call your vet now." is the last thing read, and the source gets its
 * own small line below. The in-sentence link keeps the line's flow; WCAG 2.5.8 exempts targets
 * inside a sentence from the minimum target size. Without a handler or a url the source is plain
 * text, not a link.
 */
function PetLine({
  line,
  source,
  onSourcePress,
}: {
  line: string;
  source: Source | null;
  onSourcePress?: (url: string) => void;
}) {
  const { c } = useTheme();
  if (!source) return <AppText variant="sub">{line}</AppText>;
  const { url } = source;
  const open = url && onSourcePress ? () => onSourcePress(url) : null;
  const at = line.lastIndexOf(source.name);
  if (at >= 0) {
    return (
      <AppText variant="sub">
        {line.slice(0, at)}
        {open ? (
          <Text accessibilityRole="link" onPress={open} style={[styles.link, { color: c.primary }]}>
            {source.name}
          </Text>
        ) : (
          source.name
        )}
        {line.slice(at + source.name.length)}
      </AppText>
    );
  }
  return (
    <View style={styles.lineAndSource}>
      <AppText variant="sub">{line}</AppText>
      {open ? (
        // A line of its own, so it gets the full 44 pt target without moving anything.
        <Pressable
          accessibilityRole="link"
          onPress={open}
          hitSlop={{ top: 13, bottom: 13 }}
          style={styles.sourceLine}
        >
          <AppText variant="caption" color="primary" style={styles.link}>
            {`Source: ${source.name}`}
          </AppText>
        </Pressable>
      ) : (
        <AppText variant="caption" color="textSecondary">
          {`Source: ${source.name}`}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  names: { flexShrink: 1, textAlign: 'right' },
  pet: { gap: 10 },
  // Wraps at large text: the chip drops below the name instead of overflowing.
  petTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: 8,
    columnGap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  who: { flex: 1, minWidth: 120 },
  choose: { gap: 8 },
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
  lineAndSource: { gap: 4 },
  sourceLine: { alignSelf: 'flex-start' },
  link: { textDecorationLine: 'underline' },
});
