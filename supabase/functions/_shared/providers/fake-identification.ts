import { ApiError } from '../errors.ts';
import type {
  IdentificationProvider,
  IdentificationResult,
  IdentifyInput,
  ProviderSuggestion,
} from './identification.ts';

export type FakeScenario =
  'very_likely' | 'likely' | 'not_sure' | 'not_a_plant' | 'orchid' | 'error';
const SCENARIOS: readonly FakeScenario[] = [
  'very_likely',
  'likely',
  'not_sure',
  'not_a_plant',
  'orchid',
  'error',
];

function suggestion(
  id: string,
  scientificName: string,
  commonName: string,
  probability: number,
  genus: string,
  gbifId: number,
  family = 'Araceae',
): ProviderSuggestion {
  return {
    providerEntityId: id,
    scientificName,
    commonNames: [commonName],
    probability,
    gbifId,
    family,
    genus,
    watering: { min: 2, max: 3 },
    light: 'Bright indirect light; tolerates low light.',
    imageUrl: null,
    similarImageUrl: null,
  };
}

/** The scenario named by the caller, if it is one we know. */
function scenarioFrom(name: string | undefined): FakeScenario | null {
  return SCENARIOS.find((s) => s === name) ?? null;
}

const PROBS: Record<'very_likely' | 'likely' | 'not_sure' | 'orchid', [number, number]> = {
  very_likely: [0.94, 0.03],
  likely: [0.71, 0.22],
  not_sure: [0.41, 0.32],
  orchid: [0.93, 0.04],
};

/** Deterministic provider for local work; the scenario can be chosen per request via `IdentifyInput.scenario`. */
export function fakeIdentificationProvider(
  scenario: FakeScenario = 'very_likely',
): IdentificationProvider {
  return {
    identify(input: IdentifyInput): Promise<IdentificationResult> {
      const s = scenarioFrom(input.scenario) ?? scenario;
      if (s === 'error') {
        return Promise.reject(
          new ApiError('provider_unavailable', 'Identification is unavailable.'),
        );
      }
      const notPlant = s === 'not_a_plant';
      const [a, b] = PROBS[notPlant ? 'very_likely' : s];
      if (s === 'orchid') {
        return Promise.resolve({
          accessToken: 'fake-orchid',
          isPlant: true,
          isPlantProbability: 0.98,
          suggestions: [
            suggestion(
              'fake-early-purple-orchid',
              'Orchis mascula',
              'early purple orchid',
              PROBS.orchid[0],
              'Orchis',
              2850000,
              'Orchidaceae',
            ),
          ],
          diagnosis: [],
          raw: { fake: true, scenario: s },
        });
      }
      return Promise.resolve({
        accessToken: `fake-${s}`,
        isPlant: !notPlant,
        isPlantProbability: notPlant ? 0.04 : 0.98,
        suggestions: notPlant
          ? []
          : [
              suggestion(
                'fake-peace-lily',
                'Spathiphyllum',
                'peace lily',
                a,
                'Spathiphyllum',
                2868323,
              ),
              suggestion(
                'fake-flamingo-flower',
                'Anthurium andraeanum',
                'flamingo flower',
                b,
                'Anthurium',
                2868210,
              ),
            ],
        diagnosis: input.health
          ? [
              {
                name: 'overwatering',
                probability: 0.72,
                description: 'Too much water keeps the roots wet.',
                treatment: ['Water only when the top of the soil is dry'],
                cause: 'Watering too often or poor drainage',
              },
            ]
          : [],
        raw: { fake: true, scenario: s },
      });
    },
    feedback(): Promise<void> {
      return Promise.resolve();
    },
  };
}
