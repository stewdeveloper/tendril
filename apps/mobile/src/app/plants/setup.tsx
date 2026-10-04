import { plantsCopy, type PlantSetup } from '@tendril/core';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  useAddPlant,
  useConfirmScan,
  useFetchOutcome,
  useLabel,
  useScanResult,
} from '../../api/hooks';
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
  return <LabelSetup source={source} speciesName={label.data.species.commonName} />;
}

function FromScan({ source }: { source: Source & { source: 'scan' } }) {
  const scan = useScanResult(source.observationId);
  const top = scan.data?.suggestions[0];
  if (!top) return null;
  return (
    <ScanSetup source={source} speciesId={top.species.id} speciesName={top.species.commonName} />
  );
}

function LabelSetup({
  source,
  speciesName,
}: {
  source: Source & { source: 'label_qr' };
  speciesName: string;
}) {
  const addPlant = useAddPlant();
  return (
    <Setup
      speciesName={speciesName}
      saving={addPlant.isPending}
      save={async (setup) => {
        const { plantId } = await addPlant.mutateAsync({ ...source, setup });
        return `/plants/${plantId}`;
      }}
    />
  );
}

/**
 * A scan's plant is confirmed through the scan (so the identification has its outcome), with no
 * place type: the server makes it a home plant. A species new to the Plantdex gets its moment first.
 */
function ScanSetup({
  source,
  speciesId,
  speciesName,
}: {
  source: Source & { source: 'scan' };
  speciesId: string;
  speciesName: string;
}) {
  const confirm = useConfirmScan();
  const fetchOutcome = useFetchOutcome();
  return (
    <Setup
      speciesName={speciesName}
      saving={confirm.isPending}
      save={async (setup) => {
        const { plantId } = await confirm.mutateAsync({
          observationId: source.observationId,
          speciesId,
          action: 'add_plant',
          setup,
        });
        const outcome = await fetchOutcome(source.observationId).catch(() => null);
        return outcome?.newToPlantdex
          ? `/scan/${source.observationId}/new-species`
          : `/plants/${plantId}`;
      }}
    />
  );
}

function Setup({
  speciesName,
  saving,
  save: persist,
}: {
  speciesName: string;
  saving: boolean;
  /** Saves the plant and says where to go next. */
  save: (setup: PlantSetup) => Promise<string>;
}) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const save = async (setup: PlantSetup) => {
    setFailed(false);
    try {
      router.replace(await persist(setup));
    } catch {
      setFailed(true);
    }
  };
  return (
    <PlantSetupScreen
      speciesName={speciesName}
      initial={blank(speciesName)}
      saving={saving}
      error={failed ? plantsCopy.saveFailed : null}
      onSave={save}
      onCancel={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
    />
  );
}
