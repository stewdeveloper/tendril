import { plantsCopy, type PlantSetup } from '@tendril/core';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useAddPlant, useLabel, useScanResult } from '../../api/hooks';
import { PlantSetupScreen } from '../../screens/plants/PlantSetupScreen';

type Source = { source: 'label_qr'; labelCode: string } | { source: 'scan'; observationId: string };

/** Nothing is known yet about a new plant's room, pot or light: every answer starts as "Not sure". */
const blank = (nickname: string): PlantSetup => ({
  nickname,
  room: null,
  light: 'unknown',
  potMaterial: 'unknown',
  potSizeCm: null,
  drainage: 'unknown',
  indoor: true,
});

export default function PlantSetupRoute() {
  const params = useLocalSearchParams<{
    source?: string;
    labelCode?: string;
    observationId?: string;
  }>();
  if (params.source === 'label_qr' && params.labelCode)
    return <FromLabel source={{ source: 'label_qr', labelCode: params.labelCode }} />;
  if (params.source === 'scan' && params.observationId)
    return <FromScan source={{ source: 'scan', observationId: params.observationId }} />;
  return null;
}

function FromLabel({ source }: { source: Source & { source: 'label_qr' } }) {
  const label = useLabel(source.labelCode);
  if (label.data === undefined) return null;
  // A code we do not know, or one that was retired: the label page explains it (4p).
  if (label.data === null) return <Redirect href={`/l/${source.labelCode}`} />;
  return <Setup source={source} speciesName={label.data.species.commonName} />;
}

function FromScan({ source }: { source: Source & { source: 'scan' } }) {
  const scan = useScanResult(source.observationId);
  const top = scan.data?.suggestions[0];
  if (!top) return null;
  return <Setup source={source} speciesName={top.species.commonName} />;
}

function Setup({ source, speciesName }: { source: Source; speciesName: string }) {
  const router = useRouter();
  const addPlant = useAddPlant();
  const [failed, setFailed] = useState(false);
  const save = async (setup: PlantSetup) => {
    setFailed(false);
    try {
      const { plantId } = await addPlant.mutateAsync({ ...source, setup });
      router.replace(`/plants/${plantId}`);
    } catch {
      setFailed(true);
    }
  };
  return (
    <PlantSetupScreen
      speciesName={speciesName}
      initial={blank(speciesName)}
      saving={addPlant.isPending}
      error={failed ? plantsCopy.saveFailed : null}
      onSave={save}
      onCancel={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
    />
  );
}
