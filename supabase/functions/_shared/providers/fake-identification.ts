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
const MARKER = new TextEncoder().encode('TENDRIL_FAKE:');

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

function indexOf(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

/** Decodes the first image and looks for the ASCII marker `TENDRIL_FAKE:<scenario>` in its bytes. */
function scenarioFromImage(b64: string | undefined): FakeScenario | null {
  if (!b64) return null;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  const at = indexOf(bytes, MARKER);
  if (at < 0) return null;
  const rest = new TextDecoder('ascii').decode(bytes.subarray(at + MARKER.length, at + 64));
  const word = /^[a-z_]+/.exec(rest)?.[0];
  return SCENARIOS.find((s) => s === word) ?? null;
}

const PROBS: Record<'very_likely' | 'likely' | 'not_sure' | 'orchid', [number, number]> = {
  very_likely: [0.94, 0.03],
  likely: [0.71, 0.22],
  not_sure: [0.41, 0.32],
  orchid: [0.93, 0.04],
};

/** Deterministic provider for local work; the scenario can be chosen by a marker in the image. */
export function fakeIdentificationProvider(
  scenario: FakeScenario = 'very_likely',
): IdentificationProvider {
  return {
    identify(input: IdentifyInput): Promise<IdentificationResult> {
      const s = scenarioFromImage(input.imagesBase64[0]) ?? scenario;
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
