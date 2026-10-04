export interface ProviderSuggestion {
  providerEntityId: string;
  scientificName: string;
  commonNames: string[];
  probability: number;
  gbifId: number | null;
  family: string | null;
  genus: string | null;
  watering: { min: number; max: number } | null;
  light: string | null;
  imageUrl: string | null;
  similarImageUrl: string | null;
}

export interface ProviderDiagnosis {
  name: string;
  probability: number;
  description: string | null;
  treatment: string[];
  cause: string | null;
}

export interface IdentificationResult {
  accessToken: string;
  isPlant: boolean;
  isPlantProbability: number;
  suggestions: ProviderSuggestion[];
  diagnosis: ProviderDiagnosis[];
  raw: unknown;
}

export interface IdentifyInput {
  imagesBase64: string[];
  lat: number | null;
  lng: number | null;
  datetime: string;
  health: boolean;
  /** Local-only scenario for the fake provider (from the `x-tendril-fake` header); real providers ignore it. */
  scenario?: string;
}

export interface IdentificationProvider {
  identify(input: IdentifyInput): Promise<IdentificationResult>;
  feedback(accessToken: string, comment: string): Promise<void>;
}
