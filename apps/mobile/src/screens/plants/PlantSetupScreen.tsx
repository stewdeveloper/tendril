import {
  plantsCopy,
  setupTitle,
  type Drainage,
  type LightLevel,
  type PlantSetup,
  type PotMaterial,
} from '@tendril/core';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BackBar, Button, Note, OptionPills, TextField } from '../../components';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';

export interface PlantSetupScreenProps {
  speciesName: string;
  initial: PlantSetup;
  /** A line under the save button when saving failed. */
  error?: string | null;
  saving?: boolean;
  onSave: (setup: PlantSetup) => void;
  onCancel: () => void;
}

const NOT_SURE = { value: 'unknown', label: plantsCopy.notSure } as const;
const LIGHT = [
  { value: 'bright', label: 'Bright' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  NOT_SURE,
];
const POT = [
  { value: 'plastic', label: 'Plastic' },
  { value: 'terracotta', label: 'Terracotta' },
  { value: 'ceramic', label: 'Ceramic' },
  NOT_SURE,
];
const DRAINAGE = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, NOT_SURE];

/**
 * Add-plant setup (4m, 4n): a nickname and three quick questions, each with "Not sure" as a fair
 * answer. Room is not asked here; it stays empty until it is set elsewhere. Props only.
 */
export function PlantSetupScreen({
  speciesName,
  initial,
  error,
  saving,
  onSave,
  onCancel,
}: PlantSetupScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  const [setup, setSetup] = useState(initial);
  const unsure =
    setup.light === 'unknown' || setup.potMaterial === 'unknown' || setup.drainage === 'unknown';
  const nickname = setup.nickname.trim();
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: Math.max(42, insets.bottom + 8) },
        ]}
      >
        <View style={styles.back}>
          <BackBar
            label={plantsCopy.cancel}
            accessibilityLabel={plantsCopy.cancel}
            onPress={onCancel}
          />
        </View>
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          {setupTitle(initial.nickname.trim() || speciesName)}
        </AppText>
        <TextField
          label={plantsCopy.nickname}
          value={setup.nickname}
          onChangeText={(nickname) => setSetup({ ...setup, nickname })}
          autoCapitalize="words"
        />
        <Question title={plantsCopy.lightTitle}>
          <OptionPills
            options={LIGHT}
            value={setup.light}
            onChange={(light) => setSetup({ ...setup, light: light as LightLevel })}
          />
        </Question>
        <Question title={plantsCopy.potTitle}>
          <OptionPills
            options={POT}
            value={setup.potMaterial}
            onChange={(potMaterial) =>
              setSetup({ ...setup, potMaterial: potMaterial as PotMaterial })
            }
          />
        </Question>
        <Question title={plantsCopy.drainsTitle}>
          <OptionPills
            options={DRAINAGE}
            value={setup.drainage}
            onChange={(drainage) => setSetup({ ...setup, drainage: drainage as Drainage })}
          />
        </Question>
        {unsure ? <Note text={plantsCopy.notSureNote} /> : null}
        <View style={styles.spacer} />
        <View style={styles.save}>
          <Button
            label={plantsCopy.save}
            loading={saving}
            disabled={nickname === ''}
            onPress={() => nickname && onSave({ ...setup, nickname })}
          />
        </View>
        {error ? (
          <AppText variant="sub" color="danger" accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Question({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <AppText variant="heading" accessibilityRole="header" style={styles.question}>
        {title}
      </AppText>
      {children}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, gap: 18 },
  back: { marginBottom: -6 },
  title: { marginBottom: -10 },
  question: { marginBottom: -6 },
  spacer: { flex: 1 },
  save: { marginTop: -8 },
});
