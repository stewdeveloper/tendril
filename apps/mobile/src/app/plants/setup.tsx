import { plantsCopy, resultCopy, type PlantSetup } from '@tendril/core';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { confirmFailure, type ConfirmFailure } from '../../api/errors';
import {
  useAddPlant,
  useConfirmScan,
  useFetchOutcome,
  useLabel,
  useScanResult,
} from '../../api/hooks';
import { PlantSetupScreen } from '../../screens/plants/PlantSetupScreen';

type Source =
  | { source: 'label_qr'; labelCode: string }
  | { source: 'scan'; observationId: string; speciesId?: string };

const FAILURE_COPY: Record<ConfirmFailure, string> = {
  already_saved: resultCopy.alreadySaved,
  rejected: resultCopy.cannotSave,
  retry: plantsCopy.saveFailed,
};

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
    speciesId?: string;
  }>();
  if (params.source === 'label_qr' && params.labelCode)
    return <FromLabel source={{ source: 'label_qr', labelCode: params.labelCode }} />;
  if (params.source === 'scan' && params.observationId)
    return (
      <FromScan
        source={{
          source: 'scan',
          observationId: params.observationId,
          speciesId: params.speciesId,
        }}
      />
    );
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
  // The species the person chose on the result (either of the two on a likely match), else the top one.
  const suggestions = scan.data?.suggestions ?? [];
  const top = suggestions.find((s) => s.species.id === source.speciesId) ?? suggestions[0];
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
  const [failed, setFailed] = useState<ConfirmFailure | null>(null);
  // One save at a time across the whole confirm and outcome window, not just while the request is
  // pending; and none once the server has said it cannot work.
  const inFlight = useRef(false);
  const save = async (setup: PlantSetup) => {
    if (inFlight.current || failed === 'already_saved' || failed === 'rejected') return;
    inFlight.current = true;
    setFailed(null);
    try {
      router.replace(await persist(setup));
    } catch (e) {
      setFailed(confirmFailure(e));
    } finally {
      inFlight.current = false;
    }
  };
  return (
    <PlantSetupScreen
      speciesName={speciesName}
      initial={blank(speciesName)}
      saving={saving}
      error={failed ? FAILURE_COPY[failed] : null}
      onSave={save}
      onCancel={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
    />
  );
}
