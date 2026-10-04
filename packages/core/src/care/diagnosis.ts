import type { DiagnosisResult } from '../domain.ts';
import type { CareState } from './state.ts';

export type DiagnosisEffect =
  | { kind: 'pause_watering'; dryChecksNeeded: 2 }
  | { kind: 'boost'; factor: 0.8; cycles: 2 }
  | { kind: 'advice_only' };

/**
 * Condition names that change the schedule. The first of each set is Plant.id v3's own name
 * (`result.disease.suggestions[].name` from `/api/v3/health_assessment`, or from identification with
 * `health`); the rest are the plan's names, which the fake provider uses. Every other condition,
 * including Plant.id's other watering-related ones ("dry air", "root damage", "watering on the leaves",
 * "inappropriate leaf rosette watering"), gives advice only: none of them says how often to water.
 */
const PAUSE_DRY_CHECKS = 2;
const BOOST_FACTOR = 0.8;
const BOOST_CYCLES = 2;

const OVERWATERING = new Set(['water excess or uneven watering', 'overwatering', 'root rot']);
const UNDERWATERING = new Set(['water deficiency', 'underwatering', 'dehydration', 'water stress']);

/** The schedule change a diagnosed condition calls for. Whole names only, ignoring case and spacing. */
export function diagnosisEffect(conditionName: string): DiagnosisEffect {
  const name =
    typeof conditionName === 'string'
      ? conditionName.trim().toLowerCase().replace(/\s+/g, ' ')
      : '';
  if (OVERWATERING.has(name)) return { kind: 'pause_watering', dryChecksNeeded: PAUSE_DRY_CHECKS };
  if (UNDERWATERING.has(name)) return { kind: 'boost', factor: BOOST_FACTOR, cycles: BOOST_CYCLES };
  return { kind: 'advice_only' };
}

/**
 * The state with the effect applied, on Free and Premium alike. Applying the same effect again gives
 * the same state. Overwatering and underwatering cancel each other: the latest diagnosis wins. The
 * numbers come from the kind alone, never from the effect's fields, so a stored effect read back from
 * JSON with missing or odd fields still applies exactly as designed.
 */
export function applyEffect(state: CareState, effect: DiagnosisEffect): CareState {
  switch (effect.kind) {
    case 'pause_watering':
      return {
        ...state,
        pause: { reason: 'overwatering', dryChecksNeeded: PAUSE_DRY_CHECKS },
        boost: null,
      };
    case 'boost':
      return { ...state, boost: { factor: BOOST_FACTOR, cyclesLeft: BOOST_CYCLES }, pause: null };
    default:
      return state; // advice only, or an effect this version does not know
  }
}

/** The "plan change" lines on the diagnosis result; null when the schedule stays as it is. */
export function planChangeCopy(effect: DiagnosisEffect): DiagnosisResult['planChange'] {
  switch (effect.kind) {
    case 'pause_watering':
      return { title: 'Pause watering', detail: 'Until two dry checks in a row' };
    case 'boost':
      return { title: 'Check sooner', detail: 'For the next two checks' };
    default:
      return null;
  }
}
