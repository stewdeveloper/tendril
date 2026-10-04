import { resultCopy, type PlaceType } from '@tendril/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useConfirmScan, useFetchOutcome, useHousehold, useScanResult } from '../../../api/hooks';
import { PermissionPrimer } from '../../../components';
import { useInsets } from '../../../components/useInsets';
import {
  locationAccess,
  markLocationPrimerShown,
  requestLocation,
  wasLocationPrimerShown,
} from '../../../lib/useLocationAccess';
import { ResultScreen } from '../../../screens/scan/ResultScreen';
import { useTheme } from '../../../theme';

interface LogFindState {
  placeType: PlaceType | null;
  locationOn: boolean;
}

/** A scan's result in all its states (2a, 2c, 4v to 4aa), and the "Log a find" sheet over it. */
export default function ScanResultRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const insets = useInsets();
  const scan = useScanResult(id);
  const household = useHousehold();
  const confirm = useConfirmScan();
  const fetchOutcome = useFetchOutcome();
  const saving = useRef(false);
  const [logFind, setLogFind] = useState<LogFindState | null>(null);
  const [primer, setPrimer] = useState(false);
  const [failed, setFailed] = useState(false);

  const result = scan.data;
  if (!result) return null;
  const top = result.suggestions[0];

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/today'));
  const toCamera = () => router.replace('/camera');
  const openSheet = (locationOn: boolean) => {
    setFailed(false);
    setLogFind({ placeType: null, locationOn });
  };

  const startLogFind = async () => {
    const current = await locationAccess();
    // The first time, say why before the system asks. After that the sheet opens straight away.
    if (current.status === 'undetermined' && !wasLocationPrimerShown()) setPrimer(true);
    else openSheet(current.status === 'granted');
  };
  const primerContinue = async () => {
    markLocationPrimerShown();
    setPrimer(false);
    openSheet((await requestLocation()).status === 'granted');
  };
  const primerNotNow = () => {
    markLocationPrimerShown();
    setPrimer(false);
    openSheet(false);
  };
  const turnOnLocation = async () => {
    const current = await locationAccess();
    if (current.status !== 'granted' && !current.canAskAgain) {
      void Linking.openSettings();
      return;
    }
    const next = await requestLocation();
    setLogFind((s) => (s ? { ...s, locationOn: next.status === 'granted' } : s));
  };

  const saveFind = async () => {
    if (!top || !logFind?.placeType || saving.current) return;
    saving.current = true;
    setFailed(false);
    try {
      await confirm.mutateAsync({
        observationId: result.observationId,
        speciesId: top.species.id,
        action: 'log_find',
        placeType: logFind.placeType,
      });
      // A species new to the Plantdex gets its moment; any other find goes to the Collection.
      const outcome = await fetchOutcome(result.observationId).catch(() => null);
      if (outcome?.newToPlantdex) router.replace(`/scan/${result.observationId}/new-species`);
      else router.replace('/collection?saved=1');
    } catch {
      setFailed(true);
    } finally {
      saving.current = false;
    }
  };

  const addPlant = () =>
    router.push({
      pathname: '/plants/setup',
      params: { source: 'scan', observationId: result.observationId },
    });

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ResultScreen
        result={result}
        pets={household.data?.pets ?? []}
        logFind={
          logFind
            ? {
                visible: true,
                placeType: logFind.placeType,
                locationOn: logFind.locationOn,
                saving: confirm.isPending,
                error: failed ? resultCopy.saveFindFailed : null,
              }
            : null
        }
        onClose={leave}
        onAddToPlants={addPlant}
        onLogFind={() => void startLogFind()}
        // Only the top match can be confirmed: setup reads the scan's top suggestion.
        onChoose={addPlant}
        onSourcePress={(url) => void Linking.openURL(url)}
        onRetake={toCamera}
        onRetry={() => void scan.refetch()}
        onPetAte={(petId) =>
          router.push({
            pathname: '/pet-emergency',
            params: { petId, speciesId: top?.species.id ?? '' },
          })
        }
        onPlaceType={(placeType) => setLogFind((s) => (s ? { ...s, placeType } : s))}
        onSaveFind={() => void saveFind()}
        onTurnOnLocation={() => void turnOnLocation()}
        onCloseLogFind={() => setLogFind(null)}
      />
      {primer ? (
        <View
          style={[styles.primer, { backgroundColor: c.background, paddingTop: insets.top + 24 }]}
        >
          <PermissionPrimer
            kind="location"
            continueLabel={resultCopy.allowLocation}
            onContinue={() => void primerContinue()}
            onNotNow={primerNotNow}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  primer: { ...StyleSheet.absoluteFill, zIndex: 10, paddingHorizontal: 16 },
});
