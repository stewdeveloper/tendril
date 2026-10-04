import { ApiError } from '../errors.ts';
import type {
  IdentificationResult,
  ProviderDiagnosis,
  ProviderSuggestion,
} from './identification.ts';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x !== '') : [];

const malformed = () => new ApiError('provider_unavailable', 'Identification is unavailable.');

function mapSuggestion(s: unknown): ProviderSuggestion | null {
  if (!isObj(s)) return null;
  const name = str(s.name);
  const probability = num(s.probability);
  if (name === null || probability === null) return null;
  const d = isObj(s.details) ? s.details : {};
  const tax = isObj(d.taxonomy) ? d.taxonomy : {};
  const w = isObj(d.watering) ? d.watering : null;
  const min = w ? num(w.min) : null;
  const max = w ? num(w.max) : null;
  const image = isObj(d.image) ? str(d.image.value) : null;
  const similar = Array.isArray(s.similar_images) ? s.similar_images[0] : undefined;
  return {
    providerEntityId: str(s.id) ?? str(d.entity_id) ?? name,
    scientificName: name,
    commonNames: strings(d.common_names),
    probability,
    gbifId: num(d.gbif_id),
    family: str(tax.family),
    genus: str(tax.genus),
    watering: min !== null && max !== null ? { min, max } : null,
    light: str(d.best_light_condition),
    imageUrl: image,
    similarImageUrl: isObj(similar) ? (str(similar.url_small) ?? str(similar.url)) : null,
  };
}

function treatments(t: unknown): string[] {
  if (typeof t === 'string') return t === '' ? [] : [t];
  if (Array.isArray(t)) return strings(t);
  if (!isObj(t)) return [];
  return Object.values(t).flatMap((v) => (typeof v === 'string' ? (v ? [v] : []) : strings(v)));
}

function mapDiagnosis(s: unknown): ProviderDiagnosis | null {
  if (!isObj(s)) return null;
  const name = str(s.name);
  const probability = num(s.probability);
  if (name === null || probability === null) return null;
  const d = isObj(s.details) ? s.details : {};
  return {
    name,
    probability,
    description: str(d.description),
    treatment: treatments(d.treatment),
    cause: str(d.cause),
  };
}

const byProbability = <T extends { probability: number }>(a: T, b: T) =>
  b.probability - a.probability;

/** Pure: maps a Plant.id v3 identification body. Never invents taxonomy; absent means null. */
export function mapPlantIdResponse(json: unknown): IdentificationResult {
  if (!isObj(json) || !isObj(json.result) || !isObj(json.result.is_plant)) throw malformed();
  const token = str(json.access_token);
  const isPlant = json.result.is_plant;
  if (token === null || typeof isPlant.binary !== 'boolean') throw malformed();
  const cls = isObj(json.result.classification) ? json.result.classification : {};
  const disease = isObj(json.result.disease) ? json.result.disease : {};
  const suggestions = (Array.isArray(cls.suggestions) ? cls.suggestions : [])
    .map(mapSuggestion)
    .filter((s): s is ProviderSuggestion => s !== null)
    .sort(byProbability)
    .slice(0, 5);
  const diagnosis = (Array.isArray(disease.suggestions) ? disease.suggestions : [])
    .map(mapDiagnosis)
    .filter((d): d is ProviderDiagnosis => d !== null)
    .sort(byProbability);
  return {
    accessToken: token,
    isPlant: isPlant.binary,
    isPlantProbability: num(isPlant.probability) ?? (isPlant.binary ? 1 : 0),
    suggestions,
    diagnosis,
    raw: json,
  };
}
