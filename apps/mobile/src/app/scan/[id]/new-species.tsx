import { resultCopy } from '@tendril/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { useOutcome, useScanResult } from '../../../api/hooks';
import { Button, EmptyState } from '../../../components';
import { useInsets } from '../../../components/useInsets';
import { useReduceMotion } from '../../../components/useReduceMotion';
import { NewSpeciesScreen } from '../../../screens/scan/NewSpeciesScreen';
import { useTheme } from '../../../theme';

/** A species new to the Plantdex (4ab to 4ae): what the find earned, then on to the next step. */
export default function NewSpeciesRoute() {
  const { id, plantId, speciesId } = useLocalSearchParams<{
    id: string;
    plantId?: string;
    speciesId?: string;
  }>();
  const router = useRouter();
  const { c } = useTheme();
  const insets = useInsets();
  const reduceMotion = useReduceMotion();
  const outcome = useOutcome(id);
  const scan = useScanResult(id);

  if (outcome.isError || scan.isError)
    // The save worked but its outcome cannot be read: say so and carry on, never a blank screen.
    return (
      <View style={[styles.fallback, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <EmptyState text={resultCopy.findSaved}>
          <Button
            label="Continue"
            onPress={() => router.replace(plantId ? `/plants/${plantId}` : '/collection')}
          />
        </EmptyState>
      </View>
    );
  // The species that was confirmed, else the top match.
  const suggestions = scan.data?.suggestions ?? [];
  const top = suggestions.find((s) => s.species.id === speciesId) ?? suggestions[0];
  if (!outcome.data || !top) return null;

  const completed = outcome.data.sets.find((s) => s.total > 0 && s.found >= s.total);
  const next = completed
    ? `/collection/sets/${completed.setId}/complete`
    : plantId
      ? `/plants/${plantId}`
      : '/collection?saved=1';
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style="dark" />
      <NewSpeciesScreen
        species={top.species}
        outcome={outcome.data}
        photoUri={scan.data?.photoUrls[0] ?? null}
        photoLabel={`Your photo: ${top.species.commonName.toLowerCase()}`}
        reduceMotion={reduceMotion}
        onContinue={() => router.replace(next)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fallback: { flex: 1, paddingHorizontal: 16 },
});
