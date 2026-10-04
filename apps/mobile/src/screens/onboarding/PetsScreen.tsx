import { onboardingCopy, radius, typeScale, type Animal } from '@tendril/core';
import Ban from 'lucide-react-native/icons/ban';
import Cat from 'lucide-react-native/icons/cat';
import Check from 'lucide-react-native/icons/check';
import Dog from 'lucide-react-native/icons/dog';
import Info from 'lucide-react-native/icons/info';
import PawPrint from 'lucide-react-native/icons/paw-print';
import Plus from 'lucide-react-native/icons/plus';
import { useRef, useState, type ComponentType } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, Card } from '../../components';
import { DECORATIVE } from '../../components/decorative';
import { AppText, fontFamilyFor, useTheme } from '../../theme';
import { OnboardingPage } from './OnboardingPage';
import { OnboardingProgress } from './OnboardingProgress';

export interface PetDraft {
  animal: Animal;
  name: string | null;
}

export interface PetsScreenProps {
  initial?: { animal: Animal; name: string | null }[];
  /** Starts with "None" ticked (the catalog's 3h). */
  initialNone?: boolean;
  /** The pets to save: empty for "None". Blank names are saved as null. */
  onContinue: (pets: PetDraft[]) => void;
  onBack: () => void;
  /** True while the pets are saving. */
  saving?: boolean;
  /** Forces the focused ring on one name field, for the catalog (3g shows the dog's). */
  focusedRow?: number;
}

type Row = { id: number; animal: Animal; name: string };
type IconComponent = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const TILES: { key: Animal | 'none'; label: string; icon: IconComponent }[] = [
  { key: 'cat', label: 'Cat', icon: Cat },
  { key: 'dog', label: 'Dog', icon: Dog },
  { key: 'other', label: 'Other', icon: PawPrint },
  { key: 'none', label: 'None', icon: Ban },
];
const PREFIX: Record<Animal, string> = { cat: 'Cat', dog: 'Dog', other: 'Other' };
const NOUN: Record<Animal, string> = { cat: 'cat', dog: 'dog', other: 'pet' };
const ORDER: Animal[] = ['cat', 'dog', 'other'];
const MAX_PETS = 6;

/**
 * Who lives with you (3g, 3h): tiles for cat, dog, other and none, then an optional name for each
 * pet. "None" clears the rest, and picking an animal clears "None".
 */
export function PetsScreen({
  initial = [],
  initialNone = false,
  onContinue,
  onBack,
  saving,
  focusedRow,
}: PetsScreenProps) {
  const { c } = useTheme();
  const nextId = useRef(initial.length);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((p, i) => ({ id: i, animal: p.animal, name: p.name ?? '' })),
  );
  const [none, setNone] = useState(initialNone);
  const has = (animal: Animal) => rows.some((r) => r.animal === animal);
  const toggle = (key: Animal | 'none') => {
    if (key === 'none') {
      setRows([]);
      setNone(true);
      return;
    }
    setNone(false);
    setRows((current) => {
      if (current.some((r) => r.animal === key)) return current.filter((r) => r.animal !== key);
      // Rows stay grouped cat, dog, other whatever order they were picked in.
      return [...current, { id: nextId.current++, animal: key, name: '' }].sort(
        (a, b) => ORDER.indexOf(a.animal) - ORDER.indexOf(b.animal),
      );
    });
  };
  const rename = (id: number, name: string) =>
    setRows((current) => current.map((r) => (r.id === id ? { ...r, name } : r)));
  const addAnother = (animal: Animal) =>
    setRows((current) => {
      const last = current.map((r) => r.animal).lastIndexOf(animal);
      const next = [...current];
      next.splice(last + 1, 0, { id: nextId.current++, animal, name: '' });
      return next;
    });
  const lastAnimal = rows.length > 0 ? rows[rows.length - 1]!.animal : null;
  // There is no remove control, so a blank extra row is a mis-tap: keep a blank name only on the
  // first row of its animal (the animal was ticked), and drop the rest.
  const submit = () => {
    const seen = new Set<Animal>();
    const pets: PetDraft[] = [];
    for (const r of rows) {
      const name = r.name.trim();
      const first = !seen.has(r.animal);
      seen.add(r.animal);
      if (name || first) pets.push({ animal: r.animal, name: name || null });
    }
    onContinue(pets);
  };
  return (
    <OnboardingPage gap={20}>
      <OnboardingProgress step={3} onBack={onBack} />
      <View style={styles.text}>
        <AppText variant="title" accessibilityRole="header">
          {onboardingCopy.petsTitle}
        </AppText>
        <AppText variant="body" color={c.textSecondary} style={styles.line}>
          {onboardingCopy.petsLine}
        </AppText>
      </View>
      <View style={styles.grid}>
        {TILES.map(({ key, label, icon: Icon }) => {
          const selected = key === 'none' ? none : has(key);
          return (
            <Pressable
              key={key}
              accessibilityRole="checkbox"
              accessibilityLabel={label}
              accessibilityState={{ checked: selected }}
              onPress={() => toggle(key)}
              style={[
                styles.tile,
                selected
                  ? {
                      backgroundColor: c.primaryTint,
                      borderColor: c.primary,
                      borderWidth: 2,
                      paddingHorizontal: 12,
                    }
                  : {
                      backgroundColor: c.surface,
                      borderColor: c.border,
                      borderWidth: 1.5,
                      paddingHorizontal: 12.5,
                    },
              ]}
            >
              <Icon
                {...DECORATIVE}
                size={26}
                color={selected ? c.primary : c.textSecondary}
                strokeWidth={2}
              />
              <AppText variant="bodyStrong" style={styles.tileLabel}>
                {label}
              </AppText>
              {selected ? (
                <Check {...DECORATIVE} size={22} color={c.primary} strokeWidth={2.4} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {rows.length > 0 ? (
        <View style={styles.names}>
          <AppText variant="caption" color={c.textSecondary}>
            {onboardingCopy.namesOptional}
          </AppText>
          {rows.map((row, i) => {
            const same = rows.filter((r) => r.animal === row.animal);
            const label =
              same.length > 1
                ? `${PREFIX[row.animal]} ${same.indexOf(row) + 1} name`
                : `${PREFIX[row.animal]} name`;
            return (
              <NameRow
                key={row.id}
                prefix={PREFIX[row.animal]}
                label={label}
                value={row.name}
                onChangeText={(text) => rename(row.id, text)}
                focused={focusedRow === i}
              />
            );
          })}
          {lastAnimal && rows.length < MAX_PETS ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add another ${NOUN[lastAnimal]}`}
              onPress={() => addAnother(lastAnimal)}
              style={styles.add}
            >
              <Plus {...DECORATIVE} size={20} color={c.primary} strokeWidth={2} />
              <AppText variant="bodyStrong" color="primary">
                Add another {NOUN[lastAnimal]}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {none ? (
        <Card padding={14} gap={10} style={styles.note}>
          <View style={styles.noteIcon}>
            <Info {...DECORATIVE} size={20} color={c.primary} strokeWidth={2} />
          </View>
          <AppText variant="sub" style={styles.noteText}>
            {onboardingCopy.petsNone}
          </AppText>
        </Card>
      ) : null}
      <View style={styles.spacer} />
      <Button label="Continue" loading={saving} onPress={submit} />
    </OnboardingPage>
  );
}

function NameRow({
  prefix,
  label,
  value,
  onChangeText,
  focused,
}: {
  prefix: string;
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  focused: boolean;
}) {
  const { c } = useTheme();
  const [hasFocus, setHasFocus] = useState(false);
  const active = focused || hasFocus;
  return (
    <View
      style={[
        styles.nameRow,
        {
          backgroundColor: c.surface,
          borderColor: active ? c.primary : c.border,
          borderWidth: active ? 2 : 1.5,
          paddingHorizontal: 16 - (active ? 2 : 1.5),
        },
      ]}
    >
      <AppText variant="body" color={c.textSecondary} style={styles.prefix}>
        {prefix}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder="Name"
        placeholderTextColor={c.textSecondary}
        autoCapitalize="words"
        autoCorrect={false}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
        style={[
          styles.nameInput,
          { color: c.textPrimary, fontFamily: fontFamilyFor(typeScale.body) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  text: { gap: 8 },
  line: { lineHeight: 23 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    // Two to a row: half the width less half the gap.
    flexBasis: '48%',
    flexGrow: 1,
    height: 72,
    borderRadius: radius.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tileLabel: { flex: 1 },
  names: { gap: 10 },
  nameRow: {
    height: 52,
    borderRadius: radius.input,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  prefix: { width: 36 },
  nameInput: { flex: 1, fontSize: typeScale.body.size, alignSelf: 'stretch' },
  add: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  note: { flexDirection: 'row', alignItems: 'flex-start' },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1 },
  spacer: { flex: 1 },
});
