import type { DiagnosisResult } from '@tendril/core';
import { bandFor, diagnosisCopy } from '@tendril/core';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useApplyDiagnosis, useDiagnose, usePlant, useQuota } from '../../../api/hooks';
import { choosePhotos, takePhoto, type PickOutcome } from '../../../lib/pickPhotos';
import {
  DiagnosisPhotosScreen,
  MAX_DIAGNOSIS_PHOTOS,
} from '../../../screens/plants/DiagnosisPhotosScreen';
import { DiagnosisScreen } from '../../../screens/plants/DiagnosisScreen';

/** A result with a change to the plan, at a confidence worth acting on; anything else is "not sure". */
const isActionable = (result: DiagnosisResult) =>
  result.planChange != null && bandFor(result.probability) !== 'not_sure';

export default function DiagnosisRoute() {
  const router = useRouter();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const plant = usePlant(id);
  const quota = useQuota('diagnosis');
  const diagnose = useDiagnose();
  const apply = useApplyDiagnosis();
  const [photos, setPhotos] = useState<string[]>([]);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyFailed, setApplyFailed] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/plants/${id}`));

  if (!plant.data || !quota.data) return null;
  const name = plant.data.nickname;

  const take = (outcome: PickOutcome) => {
    if (outcome.status === 'denied') setError(diagnosisCopy.permissionDenied);
    else if (outcome.status === 'picked') {
      setError(null);
      setPhotos((have) => [...have, ...outcome.uris].slice(0, MAX_DIAGNOSIS_PHOTOS));
    }
  };

  const check = async () => {
    setError(null);
    try {
      setResult(await diagnose.mutateAsync({ plantId: id, photoUris: photos }));
    } catch (e) {
      // A month used up elsewhere: the quota says so, and the screen falls back to 4r.
      if (e instanceof Error && e.message === 'quota_exceeded') void quota.refetch();
      setError(diagnosisCopy.failed);
    }
  };

  const applyPlan = async () => {
    if (!result) return;
    setApplyFailed(false);
    try {
      await apply.mutateAsync(result.id);
      back();
    } catch {
      setApplyFailed(true);
    }
  };

  const startOver = () => {
    setResult(null);
    setPhotos([]);
    setError(null);
    setApplyFailed(false);
  };

  const shared = {
    photoLabel: 'Your photo',
    photoUri: photos[0],
    plantName: name,
    onApply: () => void applyPlan(),
    onRetake: startOver,
    onTryPremium: () => router.push('/paywall'),
    onNotNow: back,
    onBack: back,
  };

  if (result) {
    return (
      <DiagnosisScreen
        {...shared}
        state={isActionable(result) ? 'result' : 'not_sure'}
        result={result}
        applying={apply.isPending}
        applyFailed={applyFailed}
      />
    );
  }
  if (quota.data.used >= quota.data.limit) {
    return <DiagnosisScreen {...shared} state="used_up" quota={quota.data} />;
  }
  return (
    <DiagnosisPhotosScreen
      plantName={name}
      photos={photos}
      busy={diagnose.isPending}
      error={error}
      onTake={() => void takePhoto().then(take)}
      onChoose={() => void choosePhotos(MAX_DIAGNOSIS_PHOTOS - photos.length).then(take)}
      onRemove={(i) => setPhotos((have) => have.filter((_, at) => at !== i))}
      onCheck={() => void check()}
      onBack={back}
    />
  );
}
