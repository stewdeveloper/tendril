import type { Animal } from './toxicity.ts';
import type {
  CaptureSource,
  CareBasics,
  DiagnosisResult,
  IsoDate,
  LabelInfo,
  LeafState,
  Organ,
  Outcome,
  PlaceType,
  PlantSetup,
  PlantStatus,
  QuotaState,
  SpeciesRef,
  ToxicityEntry,
} from './domain.ts';

export type ApiErrorCode =
  | 'invalid_input'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'quota_exceeded'
  | 'provider_unavailable'
  | 'internal';
export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; details?: Record<string, unknown> };
}

export interface BootstrapRequest {
  ageConfirmed13Plus: true;
  timezone: string;
  countryCode: string;
  handle?: string;
  displayName?: string;
}
export interface BootstrapResponse {
  userId: string;
  handle: string;
  householdId: string;
}
export interface PetsRequest {
  householdId?: string;
  pets: { animal: Animal; name: string | null }[];
}
export interface VetRequest {
  householdId?: string;
  name: string;
  phone: string;
}
export interface HomeAreaRequest {
  lat: number;
  lng: number;
  radiusM: number;
}
export interface PushTokenRequest {
  token: string;
  platform: 'ios' | 'android';
}

export interface IdentifyRequest {
  photos: { path: string; organ: Organ }[];
  captureSource: CaptureSource;
  location: { lat: number; lng: number; accuracyM: number; mocked: boolean } | null;
  deviceTime: string;
  healthCheck: boolean;
}
export interface SuggestionDto {
  species: SpeciesRef;
  probability: number;
  referenceImageUrl: string | null;
}
export interface IdentifyResponse {
  observationId: string;
  state: 'identified' | 'not_a_plant';
  suggestions: SuggestionDto[];
  care: CareBasics | null;
  toxicity: ToxicityEntry[];
  diagnosis: DiagnosisResult | null;
  quota: QuotaState;
}

export interface ConfirmRequest {
  speciesId: string;
  action: 'add_plant' | 'log_find';
  placeType?: PlaceType;
  setup?: PlantSetup;
  householdId?: string;
}
export interface ConfirmResponse {
  plantId: string | null;
}
export type OutcomeResponse = Outcome;

export interface CreatePlantRequest {
  source: 'label_qr' | 'manual' | 'gift';
  labelCode?: string;
  speciesId?: string;
  setup: PlantSetup;
  householdId?: string;
  /** Makes a retry return the first plant instead of making another. */
  clientId?: string;
}
export interface CreatePlantResponse {
  plantId: string;
}
export interface PlantStatusRequest {
  status: PlantStatus;
  deathCause?: string;
}
export interface CheckInRequest {
  clientId: string;
  plantId: string;
  soilDry: boolean;
  leafStates: LeafState[];
  occurredAt: string;
  photoPath?: string;
}
export interface CheckInResponse {
  nextCheckOn: IsoDate;
  nextCheckWeekday: string;
  waterTaskCreated: boolean;
  streakDays: number;
}
export type LabelResponse = LabelInfo | null;
