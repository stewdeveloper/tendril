import {
  aoife,
  plantdexCounts,
  QUOTA_LIMITS,
  type CareBasics,
  type CareTask,
  type CollectionSet,
  type DiagnosisResult,
  type Entitlement,
  type FindListItem,
  type Household,
  type IsoDate,
  type LeafState,
  type LeagueBoard,
  type LeagueStanding,
  type Outcome,
  type Pet,
  type PlaceType,
  type Plan,
  type PlantdexEntry,
  type PlantDetail,
  type PlantSetup,
  type PlantStatus,
  type PlantSummary,
  type QuotaKind,
  type QuotaState,
  type ScanResult,
  type SpeciesRef,
  type StreakSummary,
  type ToxicityEntry,
  type WeekResult,
} from '@tendril/core';
import { weekdayName } from '../../components/dates';
import type {
  CheckInResult,
  EmergencyInfo,
  IdentifyInput,
  SpeciesCard,
  TendrilApi,
} from '../types';

/** What a fixture world looks like. Each name drives one family of state frames. */
export type FixtureScenario =
  | 'default'
  | 'empty'
  | 'offline'
  | 'limit_free'
  | 'limit_premium'
  | 'not_a_plant'
  | 'not_sure'
  | 'likely'
  | 'error';

export interface FixtureApiOptions {
  /** Pretend network time per call. 0 in tests; the app passes 300 so loading states are seen. */
  latencyMs?: number;
  scenario?: FixtureScenario;
}

/**
 * "Today" in the fixture world: Saturday 3 October 2026, the day the design frames show. Every
 * date the API derives (next checks, history, find dates) counts from here, never the device clock,
 * so screens read the same on any day.
 */
export const FIXTURE_TODAY: IsoDate = '2026-10-03';

/** The free plan's basic schedule, and the 2-day recheck when the soil was still damp (spec §9). */
const CHECK_INTERVAL_DAYS = 7;
const DAMP_RECHECK_DAYS = 2;
const PREVIEW_DAYS = 7;

/** The identify result each scenario serves; every other scenario serves the 94% peace lily. */
const IDENTIFY_RESULT: Partial<Record<FixtureScenario, string>> = {
  offline: 'offline',
  error: 'error',
  not_a_plant: 'not-a-plant',
  not_sure: 'not-sure',
  likely: 'peace-lily-likely',
};

/** Scoring rules v1 (spec §8.3): new species by rarity, shop and home finds flat, repeats 2. */
const NEW_SPECIES_POINTS = { common: 10, uncommon: 40, rare: 80, legendary: 150 } as const;
const HOME_FIND_POINTS = 10;
const REPEAT_FIND_POINTS = 2;

/** The pre-made scans that come with a pre-made outcome (the new-species moment, frame 4ab). */
const PREMADE_OUTCOME: Record<string, string> = { 'obs-foxglove-find': 'foxglove-awarded' };

/** Accounts a search can find. Handles are exact-match only (spec §7). */
const KNOWN_HANDLES: Record<string, number> = {
  hedgehopper: 52,
  fernandfox: 44,
  mossbank: 31,
  greenwick: 27,
  lichenlou: 22,
  siobhanplants: 18,
};

const LIGHT_TITLE = {
  bright: 'Bright, indirect light',
  medium: 'Medium light',
  low: 'Low light',
  unknown: 'Bright, indirect light',
} as const;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function addDays(iso: IsoDate, days: number): IsoDate {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

const notFound = (what: string) => new Error(`not_found: ${what}`);

/** Everything a mutation can change. Rebuilt from the `aoife` fixture whenever the scenario changes. */
interface WorldData {
  plants: PlantSummary[];
  details: Record<string, PlantDetail>;
  tasks: CareTask[];
  streak: StreakSummary;
  standing: LeagueStanding | null;
  league: LeagueBoard;
  friends: LeagueBoard;
  weekResult: WeekResult;
  nextCheck: { plantNickname: string; on: IsoDate } | null;
  quota: Record<QuotaKind, QuotaState>;
  entitlement: Entitlement;
  household: Household;
  profile: typeof aoife.profile;
  plantdex: PlantdexEntry[];
  counts: { all: number; houseplants: number; wild: number };
  sets: CollectionSet[];
  badges: typeof aoife.badges;
  finds: FindListItem[];
  scans: Record<string, ScanResult>;
  outcomes: Record<string, Outcome>;
  /** Hands out ids (`obs-4`, `plant-5`) so every created thing is unique within a world. */
  counter: number;
}
interface World extends WorldData {
  checkIns: Map<string, CheckInResult>;
  diagnoses: Map<string, { plantId: string; result: DiagnosisResult }>;
}

function createWorld(scenario: FixtureScenario): World {
  const empty = scenario === 'empty';
  const premium = scenario === 'limit_premium';
  const atCap = scenario === 'limit_free' || premium;
  const plan: Plan = premium ? 'premium' : 'free';
  const quotaFor = (kind: QuotaKind): QuotaState => {
    const limit = QUOTA_LIMITS[plan][kind];
    const used = atCap
      ? limit
      : empty || kind === 'diagnosis'
        ? 0
        : aoife.today.identifications.used;
    return { kind, used, limit, resetsOn: aoife.today.identifications.resetsOn, plan };
  };
  const entitlement: Entitlement = premium
    ? { plan: 'premium', source: 'store', activeUntil: '2027-09-20', previewUsed: false }
    : clone(aoife.entitlement);
  const noBoard = (board: LeagueBoard): LeagueBoard => ({ ...board, joined: false, rows: [] });
  const noStreak: StreakSummary = {
    ...aoife.today.streak,
    careDays: 0,
    careState: 'active',
    discoveryWeeks: 0,
    freezesHeld: 0,
    calendar: aoife.today.streak.calendar.map(() => 'empty'),
  };
  const data: WorldData = clone({
    plants: empty ? [] : aoife.plants,
    details: empty ? {} : aoife.plantDetails,
    tasks: empty ? [] : aoife.today.tasks,
    streak: empty ? noStreak : aoife.today.streak,
    standing: empty ? null : aoife.today.league,
    league: empty ? noBoard(aoife.league) : aoife.league,
    friends: empty ? noBoard(aoife.friends) : aoife.friends,
    weekResult: empty ? { rank: null, of: null, points: 0, bestFind: null } : aoife.weekResult,
    nextCheck: empty ? null : aoife.today.nextCheck,
    quota: { identification: quotaFor('identification'), diagnosis: quotaFor('diagnosis') },
    entitlement,
    household: aoife.household,
    profile: empty
      ? {
          ...aoife.profile,
          plantdexCount: 0,
          careStreakDays: 0,
          discoveryStreakWeeks: 0,
          badgesEarned: [],
        }
      : aoife.profile,
    plantdex: empty ? [] : aoife.plantdex,
    counts: empty ? { all: 0, houseplants: 0, wild: 0 } : plantdexCounts,
    sets: empty
      ? aoife.sets.map((s) => ({
          ...s,
          found: 0,
          tiles: s.tiles.map(() => ({ species: null, found: false })),
        }))
      : aoife.sets,
    badges: empty
      ? aoife.badges.map((b) => ({
          ...b,
          earned: false,
          progress: b.progress && { ...b.progress, current: 0 },
        }))
      : aoife.badges,
    finds: empty ? [] : aoife.finds,
    scans: {},
    outcomes: {},
    counter: 0,
  });
  for (const plant of data.plants) {
    data.details[plant.id] ??= detailFromSummary(plant);
  }
  // Maps don't survive the JSON clone, so they are added after it.
  return { ...data, checkIns: new Map(), diagnoses: new Map() };
}

/**
 * The in-memory backend behind the app until Phase 2 swaps in Supabase. It starts from the `aoife`
 * fixture (@aoifegrows with Miso and Bran) and keeps its own copy, so a check-in or a new plant
 * changes what later reads return. Calls return copies, so a screen can't mutate the world.
 */
export class FixtureApi implements TendrilApi {
  latencyMs: number;
  private scenario: FixtureScenario;
  private world: World;

  constructor({ latencyMs = 0, scenario = 'default' }: FixtureApiOptions = {}) {
    this.latencyMs = latencyMs;
    this.scenario = scenario;
    this.world = createWorld(scenario);
  }

  /** Switches to a fresh world for the scenario. Earlier mutations are discarded. */
  setScenario(name: FixtureScenario): void {
    this.scenario = name;
    this.world = createWorld(name);
  }

  private async run<T>(read: () => T): Promise<T> {
    if (this.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    return read();
  }

  getToday() {
    return this.run(() => {
      const w = this.world;
      return clone({
        ...aoife.today,
        streak: w.streak,
        tasks: w.tasks,
        league: w.standing,
        identifications: w.quota.identification,
        hasPlants: w.plants.some((p) => p.status === 'alive'),
        nextCheck: w.nextCheck,
      });
    });
  }

  getStreaks() {
    return this.run(() => clone(this.world.streak));
  }

  checkIn(input: {
    clientId: string;
    plantId: string;
    soilDry: boolean;
    leafStates: LeafState[];
  }): Promise<CheckInResult> {
    return this.run(() => {
      const w = this.world;
      const seen = w.checkIns.get(input.clientId);
      if (seen) return clone(seen);
      const plant = this.summary(input.plantId);
      const offline = this.scenario === 'offline';
      const nextCheckOn = addDays(
        FIXTURE_TODAY,
        input.soilDry ? CHECK_INTERVAL_DAYS : DAMP_RECHECK_DAYS,
      );

      this.patchPlant(plant.id, {
        nextCheckOn,
        ...(plant.careState === 'paused' ? {} : { careState: 'ok' }),
      });
      this.pushHistory(plant.id, input.soilDry ? 'Soil dry' : 'Soil not dry yet');
      for (const t of w.tasks) {
        if (t.plantId === plant.id && t.kind === 'check') t.status = 'done';
      }
      // Offline, the server makes the watering task when the check-in syncs.
      const waterTaskCreated = input.soilDry && !offline;
      if (waterTaskCreated) {
        w.tasks.push({
          id: `t-${plant.id}-water-${++w.counter}`,
          plantId: plant.id,
          plantNickname: plant.nickname,
          room: plant.room,
          kind: 'water',
          dueOn: FIXTURE_TODAY,
          status: 'due',
          photoUrl: null,
        });
      }
      this.countCareDay();
      this.refreshNextCheck();

      const result: CheckInResult = {
        nextCheckOn,
        nextCheckWeekday: weekdayName(nextCheckOn) ?? '',
        waterTaskCreated,
        streakDays: w.streak.careDays,
        savedOffline: offline,
      };
      w.checkIns.set(input.clientId, result);
      return clone(result);
    });
  }

  getHouseholds() {
    return this.run(() => clone(aoife.households));
  }

  getPlants(householdId: string) {
    return this.run(() => clone(householdId === aoife.household.id ? this.world.plants : []));
  }

  getPlant(id: string) {
    return this.run(() => {
      const detail = this.world.details[id];
      if (!detail) throw notFound(`plant ${id}`);
      return clone(detail);
    });
  }

  addPlant(input: {
    source: 'scan' | 'label_qr';
    observationId?: string;
    labelCode?: string;
    setup: PlantSetup;
  }) {
    return this.run(() => {
      if (input.source === 'label_qr') {
        const label = this.labelFor(input.labelCode ?? '');
        if (!label) throw notFound(`label ${input.labelCode}`);
        const plantId = this.createPlant({
          species: label.species,
          setup: input.setup,
          care: label.care,
          toxicity: label.toxicity,
          matchProbability: null,
          origin: 'Added from a label',
        });
        return { plantId };
      }
      const scan = this.scanFor(input.observationId ?? '');
      const top = scan.suggestions[0];
      if (!top) throw notFound(`species for ${scan.observationId}`);
      const plantId = this.createPlant({
        species: top.species,
        setup: input.setup,
        care: scan.care,
        toxicity: scan.toxicity,
        matchProbability: top.probability,
        origin: 'Added from a scan',
      });
      return { plantId };
    });
  }

  setPlantStatus(id: string, status: PlantStatus, deathCause?: string) {
    return this.run(() => {
      const w = this.world;
      this.summary(id);
      const open = status === 'alive';
      this.patchPlant(id, {
        status,
        careState: open ? 'ok' : 'closed',
        nextCheckOn: open ? addDays(FIXTURE_TODAY, CHECK_INTERVAL_DAYS) : null,
        statusOn: open ? null : FIXTURE_TODAY,
      });
      const cause = status === 'dead' ? (deathCause ?? null) : null;
      const detail = w.details[id];
      if (detail) detail.deathCause = cause;
      this.pushHistory(
        id,
        status === 'dead'
          ? cause
            ? `Died · ${cause}`
            : 'Died'
          : status === 'given_away'
            ? 'Given away'
            : 'Back in care',
      );
      if (!open) w.tasks = w.tasks.filter((t) => t.plantId !== id);
      this.refreshNextCheck();
    });
  }

  getLabel(code: string) {
    return this.run(() => clone(this.labelFor(code)));
  }

  getQuota(kind: QuotaKind) {
    return this.run(() => clone(this.world.quota[kind]));
  }

  identify(input: IdentifyInput) {
    return this.run(() => {
      const w = this.world;
      const id = IDENTIFY_RESULT[this.scenario] ?? 'peace-lily-very-likely';
      const base = aoife.scanResults[id]!;
      // The server refuses at the cap before it spends a call (spec §8.4).
      if (w.quota.identification.used >= w.quota.identification.limit)
        throw new Error('quota_exceeded');
      if (
        input.healthCheck &&
        base.state === 'identified' &&
        w.quota.diagnosis.used >= w.quota.diagnosis.limit
      ) {
        throw new Error('quota_exceeded');
      }
      const result: ScanResult = {
        ...clone(base),
        observationId: `obs-${++w.counter}`,
        photoUrls: [...input.photoUris],
        captureSource: input.captureSource,
      };
      // A result that isn't an identification doesn't use one ("This didn't use an identification").
      if (result.state === 'identified') {
        w.quota.identification.used += 1;
        if (input.healthCheck) {
          w.quota.diagnosis.used += 1;
          result.diagnosis = this.diagnosisFor(result.observationId);
        }
      }
      w.scans[result.observationId] = result;
      return clone(result);
    });
  }

  getScanResult(observationId: string) {
    return this.run(() => clone(this.scanFor(observationId)));
  }

  confirmScan(input: {
    observationId: string;
    speciesId: string;
    action: 'add_plant' | 'log_find';
    placeType?: PlaceType;
    setup?: PlantSetup;
  }) {
    return this.run(() => {
      const w = this.world;
      const scan = this.scanFor(input.observationId);
      const suggestion = scan.suggestions.find((s) => s.species.id === input.speciesId);
      const species = suggestion?.species ?? aoife.species[input.speciesId];
      if (!species) throw notFound(`species ${input.speciesId}`);

      const adding = input.action === 'add_plant';
      const entry = w.plantdex.find((e) => e.species.id === species.id);
      const premade = premadeOutcome(scan.observationId);
      // The pre-made foxglove scan is the "new to your Plantdex" demo, though the sample list
      // already shows a foxglove.
      const isNew = premade ? premade.newToPlantdex : !entry;
      if (entry) {
        if (!adding) entry.findsCount += 1;
      } else {
        w.plantdex.push({
          species: clone(species),
          category: adding ? 'houseplant' : 'wild',
          findsCount: adding ? 0 : 1,
          photoUrl: null,
        });
      }
      if (isNew) {
        w.counts.all += 1;
        if (adding) w.counts.houseplants += 1;
        else w.counts.wild += 1;
      }

      let plantId: string | null = null;
      if (adding) {
        plantId = this.createPlant({
          species,
          setup: input.setup ?? defaultSetup(species),
          care: scan.care,
          toxicity: scan.toxicity,
          matchProbability: suggestion?.probability ?? null,
          origin: 'Added from a scan',
        });
      } else {
        w.finds.unshift({
          observationId: scan.observationId,
          species: clone(species),
          placeType: input.placeType ?? 'wild',
          foundOn: FIXTURE_TODAY,
          lat: null,
          lng: null,
        });
      }

      // Adding a plant counts as a home find. Gallery photos are identified but earn nothing.
      const place = adding ? 'shop' : (input.placeType ?? 'wild');
      const gallery = scan.captureSource === 'gallery';
      const points = gallery
        ? 0
        : !isNew
          ? REPEAT_FIND_POINTS
          : place === 'shop'
            ? HOME_FIND_POINTS
            : NEW_SPECIES_POINTS[species.rarity];
      w.outcomes[scan.observationId] = premade
        ? clone(premade)
        : {
            pointsStatus: gallery ? 'no_points' : 'awarded',
            points,
            noPointsReason: gallery ? 'gallery' : null,
            newToPlantdex: isNew,
            plantdexCount: w.counts.all,
            sets: [],
          };
      return { plantId };
    });
  }

  getOutcome(observationId: string) {
    return this.run(() => {
      const found =
        this.world.outcomes[observationId] ??
        premadeOutcome(observationId) ??
        aoife.outcomes[observationId.replace(/^obs-/, '')];
      if (!found) throw notFound(`outcome ${observationId}`);
      return clone(found);
    });
  }

  diagnose(input: { plantId: string; photoUris: string[] }) {
    return this.run(() => {
      const w = this.world;
      this.summary(input.plantId);
      if (w.quota.diagnosis.used >= w.quota.diagnosis.limit) throw new Error('quota_exceeded');
      const result = this.diagnosisFor(`diag-${++w.counter}`, input.plantId);
      // A "not sure" result doesn't use the month's diagnosis (frame 4s).
      if (result.planChange) w.quota.diagnosis.used += 1;
      return clone(result);
    });
  }

  applyDiagnosis(diagnosisId: string) {
    return this.run(() => {
      const w = this.world;
      const found = w.diagnoses.get(diagnosisId);
      if (!found) throw notFound(`diagnosis ${diagnosisId}`);
      if (!found.result.planChange) return;
      // Overwatering pauses watering until two dry checks in a row.
      this.patchPlant(found.plantId, { careState: 'paused', pausedNote: '0 of 2 dry checks' });
      this.pushHistory(found.plantId, `Diagnosis applied: ${found.result.conditionName}`);
    });
  }

  getPlantdex(filter: 'all' | 'houseplant' | 'wild') {
    return this.run(() => {
      const { plantdex, counts } = this.world;
      return clone({
        entries: filter === 'all' ? plantdex : plantdex.filter((e) => e.category === filter),
        counts,
      });
    });
  }

  getSpeciesCard(speciesId: string): Promise<SpeciesCard> {
    return this.run(() => {
      const w = this.world;
      const entry = w.plantdex.find((e) => e.species.id === speciesId);
      const species = entry?.species ?? aoife.species[speciesId];
      if (!species) throw notFound(`species ${speciesId}`);
      return clone({
        species,
        findsCount: entry?.findsCount ?? 0,
        sets: w.sets
          .filter((s) => s.tiles.some((t) => t.species?.id === speciesId))
          .map(({ name, found, total }) => ({ name, found, total })),
        toxicity: aoife.speciesToxicity[speciesId] ?? [],
      });
    });
  }

  getSets() {
    return this.run(() => clone(this.world.sets));
  }

  getFinds() {
    return this.run(() => clone(this.world.finds));
  }

  getBadges() {
    return this.run(() => clone(this.world.badges));
  }

  getLeague() {
    return this.run(() => clone(this.world.league));
  }

  getFriends() {
    return this.run(() => clone(this.world.friends));
  }

  findHandle(handle: string) {
    return this.run(() => {
      const key = normaliseHandle(handle);
      const plantdexCount = KNOWN_HANDLES[key];
      return plantdexCount === undefined ? null : { handle: key, plantdexCount };
    });
  }

  sendFriendRequest(handle: string) {
    return this.run(() => {
      const key = normaliseHandle(handle);
      if (KNOWN_HANDLES[key] === undefined) throw notFound(`handle ${key}`);
      const { friends } = this.world;
      if (friends.rows.some((r) => r.handle === key)) return;
      friends.joined = true;
      friends.rows.push({
        rank: friends.rows.length + 1,
        handle: key,
        points: 0,
        isYou: false,
        pending: true,
      });
    });
  }

  createInvite() {
    return this.run(() => ({ url: 'https://tendril.app/i/aoife-7k2q' }));
  }

  getWeekResult() {
    return this.run(() => clone(this.world.weekResult));
  }

  getProfile() {
    return this.run(() => {
      const w = this.world;
      return clone({
        ...w.profile,
        plantdexCount: w.counts.all,
        careStreakDays: w.streak.careDays,
      });
    });
  }

  getHousehold() {
    return this.run(() => clone(this.world.household));
  }

  savePets(pets: Omit<Pet, 'id'>[]) {
    return this.run(() => {
      const w = this.world;
      w.household.pets = pets.map((p) => ({ ...p, id: `pet-${++w.counter}` }));
    });
  }

  getEntitlement() {
    return this.run(() => clone(this.world.entitlement));
  }

  startPreview() {
    return this.run(() => {
      const w = this.world;
      // One preview per account (spec §8.4).
      if (w.entitlement.previewUsed || w.entitlement.plan === 'premium')
        throw new Error('preview_unavailable');
      w.entitlement = {
        plan: 'premium',
        source: 'preview',
        activeUntil: addDays(FIXTURE_TODAY, PREVIEW_DAYS),
        previewUsed: true,
      };
      for (const kind of ['identification', 'diagnosis'] as const) {
        w.quota[kind] = { ...w.quota[kind], plan: 'premium', limit: QUOTA_LIMITS.premium[kind] };
      }
      return clone(w.entitlement);
    });
  }

  getEmergency(input: {
    plantId?: string;
    speciesId?: string;
    petId: string;
  }): Promise<EmergencyInfo> {
    return this.run(() => {
      const w = this.world;
      const pet = w.household.pets.find((p) => p.id === input.petId);
      if (!pet) throw notFound(`pet ${input.petId}`);
      const detail = input.plantId ? w.details[input.plantId] : undefined;
      const species =
        detail?.species ?? (input.speciesId ? aoife.species[input.speciesId] : undefined);
      if (!species)
        throw notFound(`species for ${input.plantId ?? input.speciesId ?? 'emergency'}`);
      const entries: ToxicityEntry[] = detail?.toxicity ?? aoife.speciesToxicity[species.id] ?? [];
      return clone({
        petName: pet.name ?? (pet.animal === 'other' ? 'your pet' : `your ${pet.animal}`),
        animal: pet.animal,
        speciesName: species.commonName.toLowerCase(),
        // Toxicity data covers cats and dogs only; other animals stay unknown.
        toxicity:
          pet.animal === 'other' ? null : (entries.find((e) => e.animal === pet.animal) ?? null),
        matchProbability: detail?.matchProbability ?? null,
        vet: w.household.vet,
        // Ireland has no confirmed poison line yet, so the vet is the only number (frame 4bi).
        poisonLine: null,
      });
    });
  }

  deleteAccount() {
    return this.run(() => {
      this.world = createWorld('empty');
    });
  }

  // Internals. They run inside `run`, so a throw becomes a rejected promise.

  private summary(id: string): PlantSummary {
    const plant = this.world.plants.find((p) => p.id === id);
    if (!plant) throw notFound(`plant ${id}`);
    return plant;
  }

  /** Applies a change to a plant's list entry and its detail together. */
  private patchPlant(id: string, patch: Partial<PlantSummary>) {
    Object.assign(this.summary(id), patch);
    const detail = this.world.details[id];
    if (detail) Object.assign(detail, patch);
  }

  private pushHistory(id: string, label: string) {
    this.world.details[id]?.history.unshift({ label, on: FIXTURE_TODAY });
  }

  /** Any check-in extends the care streak. The fixture's 12 days already end today, so the count stays. */
  private countCareDay() {
    const s = this.world.streak;
    if (s.careDays === 0) {
      s.careDays = 1;
      s.calendar = [...s.calendar.slice(1), 'checked'];
    } else if (s.careState === 'last_day') {
      s.careState = 'active';
    }
  }

  /** The soonest check still ahead of today, for "Next check: Spidey, tomorrow." */
  private refreshNextCheck() {
    const upcoming = this.world.plants
      .filter((p) => p.status === 'alive' && p.nextCheckOn != null && p.nextCheckOn > FIXTURE_TODAY)
      .sort((a, b) => (a.nextCheckOn ?? '').localeCompare(b.nextCheckOn ?? ''))[0];
    this.world.nextCheck = upcoming
      ? { plantNickname: upcoming.nickname, on: upcoming.nextCheckOn! }
      : null;
  }

  private createPlant(args: {
    species: SpeciesRef;
    setup: PlantSetup;
    care: CareBasics | null;
    toxicity: ToxicityEntry[];
    matchProbability: number | null;
    origin: string;
  }): string {
    const w = this.world;
    const { species, setup } = args;
    const summary: PlantSummary = {
      id: `plant-${++w.counter}`,
      nickname: setup.nickname,
      species: clone(species),
      room: setup.room,
      status: 'alive',
      careState: 'ok',
      nextCheckOn: addDays(FIXTURE_TODAY, CHECK_INTERVAL_DAYS),
      pausedNote: null,
      photoUrl: null,
      statusOn: null,
    };
    const detail: PlantDetail = {
      ...summary,
      setup: clone(setup),
      matchProbability: args.matchProbability,
      carePlan: [
        {
          icon: 'sprout',
          title: `Check the soil every ${CHECK_INTERVAL_DAYS} days`,
          detail: 'Basic schedule for this species',
        },
        {
          icon: 'sun',
          title:
            setup.light === 'unknown' && args.care ? args.care.light : LIGHT_TITLE[setup.light],
          detail: 'From your setup answers',
        },
        ...(setup.potMaterial !== 'unknown' && setup.potSizeCm != null
          ? [
              {
                icon: 'droplet' as const,
                title: `${setup.potSizeCm} cm ${setup.potMaterial} pot${setup.drainage === 'yes' ? ', drains' : ''}`,
                detail: 'Water only when the top is dry',
              },
            ]
          : []),
      ],
      toxicity: clone(args.toxicity),
      history: [{ label: args.origin, on: FIXTURE_TODAY }],
      deathCause: null,
    };
    w.plants.push(summary);
    w.details[summary.id] = detail;
    this.refreshNextCheck();
    return summary.id;
  }

  private labelFor(code: string) {
    return code.trim().toUpperCase() === aoife.label.code ? aoife.label : null;
  }

  private scanFor(observationId: string): ScanResult {
    const found =
      this.world.scans[observationId] ??
      Object.values(aoife.scanResults).find((r) => r.observationId === observationId);
    if (!found) throw notFound(`scan ${observationId}`);
    return found;
  }

  /** Frame 4q's overwatering result, or frame 4s's "not sure" when the scenario says so. */
  private diagnosisFor(id: string, plantId?: string): DiagnosisResult {
    const result: DiagnosisResult =
      this.scenario === 'not_sure'
        ? {
            id,
            conditionName: 'Not sure yet',
            probability: 0.34,
            explanation: 'Try a close photo of one affected leaf, in daylight.',
            planChange: null,
          }
        : {
            id,
            conditionName: 'Overwatering',
            probability: 0.72,
            explanation: 'Yellow lower leaves and soft stems often mean the roots are staying wet.',
            planChange: { title: 'Pause watering', detail: 'Until two dry checks in a row' },
          };
    if (plantId) this.world.diagnoses.set(id, { plantId, result });
    return result;
  }
}

function premadeOutcome(observationId: string): Outcome | undefined {
  const key = PREMADE_OUTCOME[observationId];
  return key ? aoife.outcomes[key] : undefined;
}

/** A detail for a plant the fixture lists but has no hand-made detail for (Spidey, Lily). */
function detailFromSummary(plant: PlantSummary): PlantDetail {
  return {
    ...plant,
    setup: { ...defaultSetup(plant.species), nickname: plant.nickname, room: plant.room },
    matchProbability: null,
    carePlan: [
      {
        icon: 'sprout',
        title: `Check the soil every ${CHECK_INTERVAL_DAYS} days`,
        detail: 'Basic schedule for this species',
      },
    ],
    toxicity: aoife.speciesToxicity[plant.species.id] ?? [],
    history: [],
    deathCause: null,
  };
}

function defaultSetup(species: SpeciesRef): PlantSetup {
  return {
    nickname: species.commonName,
    room: null,
    light: 'unknown',
    potMaterial: 'unknown',
    potSizeCm: null,
    drainage: 'unknown',
    indoor: true,
  };
}

function normaliseHandle(handle: string): string {
  return handle.trim().replace(/^@/, '').toLowerCase();
}
