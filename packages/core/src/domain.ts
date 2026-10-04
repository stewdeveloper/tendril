import type { Animal, RarityTier, Severity } from './toxicity.ts';

/** Calendar date, YYYY-MM-DD, in the user's timezone. */
export type IsoDate = string;
export type Plan = 'free' | 'premium';
export type QuotaKind = 'identification' | 'diagnosis';
export type Organ = 'leaf' | 'flower' | 'whole';
export type CaptureSource = 'camera' | 'gallery';
export type PlaceType = 'shop' | 'garden_park' | 'wild';
export type LightLevel = 'bright' | 'medium' | 'low' | 'unknown';
export type PotMaterial = 'plastic' | 'terracotta' | 'ceramic' | 'unknown';
export type Drainage = 'yes' | 'no' | 'unknown';
export type PlantStatus = 'alive' | 'dead' | 'given_away';
export type PlantSource = 'scan' | 'label_qr' | 'gift' | 'manual';
export type LeafState = 'healthy' | 'yellowing' | 'drooping' | 'brown_tips' | 'spots';
export type PointsStatus = 'none' | 'processing' | 'awarded' | 'held' | 'no_points';
export type NoPointsReason =
  'gallery' | 'integrity' | 'time_skew' | 'location_off' | 'duplicate' | 'daily_cap';

export interface Pet {
  id: string;
  animal: Animal;
  name: string | null;
}
export interface Vet {
  name: string;
  phone: string;
}

export interface SpeciesRef {
  id: string;
  commonName: string;
  scientificName: string;
  rarity: RarityTier;
  sensitive: boolean;
  imageUrl: string | null;
}

export interface ToxicityEntry {
  animal: 'cat' | 'dog';
  severity: Severity;
  summary: string | null;
  symptoms: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
}

export interface CareBasics {
  light: string;
  soilCheck: string;
  warmth: string | null;
}

export interface QuotaState {
  kind: QuotaKind;
  used: number;
  limit: number;
  resetsOn: IsoDate;
  plan: Plan;
}

export interface PlantSetup {
  nickname: string;
  room: string | null;
  light: LightLevel;
  potMaterial: PotMaterial;
  potSizeCm: number | null;
  drainage: Drainage;
  indoor: boolean;
}

export type PlantCareState = 'due' | 'overdue' | 'ok' | 'paused' | 'closed';

export interface PlantSummary {
  id: string;
  nickname: string;
  species: SpeciesRef;
  room: string | null;
  status: PlantStatus;
  careState: PlantCareState;
  nextCheckOn: IsoDate | null;
  /** e.g. "1 of 2 dry checks" while watering is paused by a diagnosis. */
  pausedNote: string | null;
  photoUrl: string | null;
  /** The day a plant died or was given away, for "Died 20 Aug" on its card; null while it is alive. */
  statusOn: IsoDate | null;
}

export interface CarePlanLine {
  icon: 'sprout' | 'sun' | 'droplet' | 'thermometer';
  title: string;
  detail: string;
}
export interface HistoryEntry {
  label: string;
  on: IsoDate;
}

export interface PlantDetail extends PlantSummary {
  setup: PlantSetup;
  matchProbability: number | null;
  carePlan: CarePlanLine[];
  toxicity: ToxicityEntry[];
  history: HistoryEntry[];
  deathCause: string | null;
}

export type TaskKind = 'check' | 'water';
export interface CareTask {
  id: string;
  plantId: string;
  plantNickname: string;
  room: string | null;
  kind: TaskKind;
  dueOn: IsoDate;
  status: 'due' | 'overdue' | 'done';
  photoUrl: string | null;
}

export type DayMark = 'checked' | 'freeze' | 'missed' | 'empty';
export interface StreakSummary {
  careDays: number;
  careState: 'active' | 'last_day' | 'freeze_used' | 'broken';
  lastBrokenLength: number | null;
  discoveryWeeks: number;
  freezesHeld: number;
  winterMode: boolean;
  winterModeAvailable: boolean;
  /** Last 28 days, oldest first. */
  calendar: DayMark[];
}

export interface LeagueStanding {
  rank: number;
  of: number;
  points: number;
  daysLeft: number;
}

export interface TodaySummary {
  dateLabel: string;
  streak: StreakSummary;
  tasks: CareTask[];
  league: LeagueStanding | null;
  identifications: QuotaState;
  hasPlants: boolean;
  nextCheck: { plantNickname: string; on: IsoDate } | null;
}

export interface Suggestion {
  species: SpeciesRef;
  probability: number;
  referenceImageUrl: string | null;
}

export type ResultState = 'identified' | 'not_a_plant' | 'offline' | 'error';
export interface DiagnosisResult {
  id: string;
  conditionName: string;
  probability: number;
  explanation: string;
  planChange: { title: string; detail: string } | null;
}

export interface ScanResult {
  observationId: string;
  state: ResultState;
  photoUrls: string[];
  suggestions: Suggestion[];
  captureSource: CaptureSource;
  care: CareBasics | null;
  toxicity: ToxicityEntry[];
  diagnosis: DiagnosisResult | null;
}

export interface SetProgress {
  setId: string;
  name: string;
  found: number;
  total: number;
}
export interface Outcome {
  pointsStatus: PointsStatus;
  points: number;
  noPointsReason: NoPointsReason | null;
  newToPlantdex: boolean;
  plantdexCount: number;
  sets: SetProgress[];
}

export interface PlantdexEntry {
  species: SpeciesRef;
  category: 'houseplant' | 'wild';
  findsCount: number;
  photoUrl: string | null;
}
export interface CollectionSet {
  id: string;
  name: string;
  preview: string;
  found: number;
  total: number;
  tiles: { species: SpeciesRef | null; found: boolean }[];
}
export interface FindListItem {
  observationId: string;
  species: SpeciesRef;
  placeType: PlaceType;
  foundOn: IsoDate;
  lat: number | null;
  lng: number | null;
}
export interface Badge {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  progress: { current: number; target: number } | null;
}

export interface BoardRow {
  rank: number;
  handle: string;
  points: number;
  isYou: boolean;
  pending: boolean;
}
export interface LeagueBoard {
  daysLeft: number;
  resetsOn: string;
  rows: BoardRow[];
  joined: boolean;
}
export interface WeekResult {
  rank: number | null;
  of: number | null;
  points: number;
  bestFind: { name: string; rarity: RarityTier } | null;
}

export interface Profile {
  handle: string;
  displayName: string;
  plantdexCount: number;
  careStreakDays: number;
  discoveryStreakWeeks: number;
  badgesEarned: string[];
}

export interface Entitlement {
  plan: Plan;
  source: 'preview' | 'store' | null;
  activeUntil: IsoDate | null;
  previewUsed: boolean;
}

export interface Household {
  id: string;
  name: string;
  members: { name: string; isYou: boolean }[];
  pets: Pet[];
  vet: Vet | null;
}

export interface LabelInfo {
  code: string;
  species: SpeciesRef;
  growerName: string;
  care: CareBasics;
  careLines: string[];
  toxicity: ToxicityEntry[];
}
