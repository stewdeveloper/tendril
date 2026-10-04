import { aoife, type DiagnosisResult, type QuotaState } from '@tendril/core';
import type { EmergencyInfo } from '../../api/types';
import { PetEmergencyScreen } from '../../screens/emergency/PetEmergencyScreen';
import { DiagnosisScreen } from '../../screens/plants/DiagnosisScreen';
import { registerFrame } from '../registry';

/** Frames 4q to 4s (diagnosis) and 4bh, 4bi (pet emergency). */

const noop = () => {};
const diagnosis = (
  state: 'result' | 'not_sure' | 'used_up',
  photoLabel: string,
  result?: DiagnosisResult,
  quota?: QuotaState,
) => (
  <DiagnosisScreen
    state={state}
    result={result}
    quota={quota}
    photoLabel={photoLabel}
    plantName="Monty"
    onApply={noop}
    onRetake={noop}
    onTryPremium={noop}
    onNotNow={noop}
    onBack={noop}
  />
);

registerFrame({
  id: '4q',
  title: 'Diagnosis · overwatering, 72%',
  statusBar: 'light',
  render: () =>
    diagnosis('result', 'Your photo: yellow leaves', {
      id: 'diag-1',
      conditionName: 'Overwatering',
      probability: 0.72,
      explanation: 'Yellow lower leaves and soft stems often mean the roots are staying wet.',
      planChange: { title: 'Pause watering', detail: 'Until two dry checks in a row' },
    }),
});

registerFrame({
  id: '4r',
  title: 'Diagnosis · used up this month',
  render: () =>
    diagnosis('used_up', 'Your photo', undefined, {
      kind: 'diagnosis',
      used: 1,
      limit: 1,
      resetsOn: '2026-11-01',
      plan: 'free',
    }),
});

registerFrame({
  id: '4s',
  title: 'Diagnosis · not sure',
  statusBar: 'light',
  render: () =>
    diagnosis('not_sure', 'Your photo', {
      id: 'diag-2',
      conditionName: 'Not sure yet',
      probability: 0.34,
      explanation: 'Try a close photo of one affected leaf, in daylight.',
      planChange: null,
    }),
});

const catToxicity = aoife.speciesToxicity['peace-lily']!.find((e) => e.animal === 'cat')!;
const misoAtePeaceLily: EmergencyInfo = {
  petName: 'Miso',
  animal: 'cat',
  speciesName: 'peace lily',
  // The frame's sentence; the fixture's cat entry is shorter.
  toxicity: {
    ...catToxicity,
    summary:
      'Peace lily can irritate the mouth and cause drooling, vomiting and trouble swallowing.',
  },
  matchProbability: 0.94,
  vet: { name: 'Riverside Vets', phone: '01 555 0100' },
  poisonLine: {
    name: 'ASPCA Poison Control',
    phone: '(888) 426-4435',
    note: 'Open 24 hours. A fee may apply.',
  },
};
const emergency = (info: EmergencyInfo) => (
  <PetEmergencyScreen
    info={info}
    backLabel="Lily"
    onCallVet={noop}
    onCallPoisonLine={noop}
    onFindVet={noop}
    onSaveVet={noop}
    onBack={noop}
  />
);

registerFrame({
  id: '4bh',
  title: 'Pet emergency · US, vet and ASPCA line',
  render: () => emergency(misoAtePeaceLily),
});

registerFrame({
  id: '4bi',
  title: 'Pet emergency · no vet saved, no poison line',
  render: () =>
    emergency({ ...misoAtePeaceLily, matchProbability: null, vet: null, poisonLine: null }),
});
