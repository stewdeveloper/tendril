import type {
  Badge,
  CaptureSource,
  CollectionSet,
  DiagnosisResult,
  Entitlement,
  FindListItem,
  Household,
  IsoDate,
  LabelInfo,
  LeafState,
  LeagueBoard,
  Organ,
  Outcome,
  Pet,
  PlaceType,
  PlantDetail,
  PlantdexEntry,
  PlantSetup,
  PlantStatus,
  PlantSummary,
  Profile,
  QuotaKind,
  QuotaState,
  ScanResult,
  Settings,
  SpeciesRef,
  StreakSummary,
  TodaySummary,
  ToxicityEntry,
  WeekResult,
} from '@tendril/core';

export interface CheckInResult {
  nextCheckOn: IsoDate;
  nextCheckWeekday: string;
  waterTaskCreated: boolean;
  streakDays: number;
  savedOffline: boolean;
}
export interface IdentifyInput {
  photoUris: string[];
  organs: Organ[];
  captureSource: CaptureSource;
  healthCheck: boolean;
}
export interface SpeciesCard {
  species: SpeciesRef;
  findsCount: number;
  sets: { name: string; found: number; total: number }[];
  toxicity: ToxicityEntry[];
}
export interface EmergencyInfo {
  petName: string;
  animal: 'cat' | 'dog' | 'other';
  speciesName: string;
  toxicity: ToxicityEntry | null;
  matchProbability: number | null;
  vet: { name: string; phone: string } | null;
  poisonLine: { name: string; phone: string; note: string } | null;
}

/**
 * Everything a screen can ask of the backend. `FixtureApi` implements it from the design's sample
 * data; Phase 2 implements it again over Supabase. Screens only ever see this interface.
 */
export interface TendrilApi {
  getToday(): Promise<TodaySummary>;
  getStreaks(): Promise<StreakSummary>;
  checkIn(input: {
    clientId: string;
    plantId: string;
    soilDry: boolean;
    leafStates: LeafState[];
    /** A local file path of the photo added to the check-in, from `preparePhoto`. */
    photoPath?: string;
  }): Promise<CheckInResult>;
  getHouseholds(): Promise<{ id: string; name: string }[]>;
  getPlants(householdId: string): Promise<PlantSummary[]>;
  getPlant(id: string): Promise<PlantDetail>;
  addPlant(input: {
    source: 'scan' | 'label_qr';
    observationId?: string;
    labelCode?: string;
    setup: PlantSetup;
  }): Promise<{ plantId: string }>;
  setPlantStatus(id: string, status: PlantStatus, deathCause?: string): Promise<void>;
  getLabel(code: string): Promise<LabelInfo | null>;
  getQuota(kind: QuotaKind): Promise<QuotaState>;
  identify(input: IdentifyInput): Promise<ScanResult>;
  getScanResult(observationId: string): Promise<ScanResult>;
  confirmScan(input: {
    observationId: string;
    speciesId: string;
    action: 'add_plant' | 'log_find';
    placeType?: PlaceType;
    setup?: PlantSetup;
  }): Promise<{ plantId: string | null }>;
  getOutcome(observationId: string): Promise<Outcome>;
  diagnose(input: { plantId: string; photoUris: string[] }): Promise<DiagnosisResult>;
  applyDiagnosis(diagnosisId: string): Promise<void>;
  getPlantdex(filter: 'all' | 'houseplant' | 'wild'): Promise<{
    entries: PlantdexEntry[];
    counts: { all: number; houseplants: number; wild: number };
  }>;
  getSpeciesCard(speciesId: string): Promise<SpeciesCard>;
  getSets(): Promise<CollectionSet[]>;
  getFinds(): Promise<FindListItem[]>;
  getBadges(): Promise<Badge[]>;
  getLeague(): Promise<LeagueBoard>;
  getFriends(): Promise<LeagueBoard>;
  findHandle(handle: string): Promise<{ handle: string; plantdexCount: number } | null>;
  sendFriendRequest(handle: string): Promise<void>;
  createInvite(): Promise<{ url: string }>;
  getWeekResult(): Promise<WeekResult>;
  getProfile(): Promise<Profile>;
  getHousehold(): Promise<Household>;
  savePets(pets: Omit<Pet, 'id'>[]): Promise<void>;
  getEntitlement(): Promise<Entitlement>;
  startPreview(): Promise<Entitlement>;
  getEmergency(input: {
    plantId?: string;
    speciesId?: string;
    petId: string;
  }): Promise<EmergencyInfo>;
  deleteAccount(): Promise<void>;
  getSettings(): Promise<Settings>;
  /** The home area is a point and a radius; finds inside it never appear publicly. */
  saveHomeArea(input: { lat: number; lng: number; radiusM: number }): Promise<void>;
  clearHomeArea(): Promise<void>;
  setReminders(on: boolean): Promise<void>;
}
