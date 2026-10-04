import type {
  Badge,
  CareBasics,
  CareTask,
  CollectionSet,
  DayMark,
  Entitlement,
  FindListItem,
  Household,
  LabelInfo,
  LeagueBoard,
  Outcome,
  PlantdexEntry,
  PlantDetail,
  PlantSummary,
  Profile,
  ScanResult,
  SpeciesRef,
  Suggestion,
  ToxicityEntry,
  TodaySummary,
  WeekResult,
} from '../domain.ts';

/**
 * The UX brief's sample data: @aoifegrows, with Miso (cat) and Bran (dog).
 * Dates assume "today" is Saturday 3 October 2026, the day the design frames show.
 */

// Species. Ids are slugs. Every imageUrl is null so screens show their placeholder slots.

const swissCheesePlant: SpeciesRef = {
  id: 'swiss-cheese-plant',
  commonName: 'Swiss cheese plant',
  scientificName: 'Monstera deliciosa',
  rarity: 'common',
  sensitive: false,
  imageUrl: null,
};
const spiderPlant: SpeciesRef = {
  id: 'spider-plant',
  commonName: 'Spider plant',
  scientificName: 'Chlorophytum comosum',
  rarity: 'common',
  sensitive: false,
  imageUrl: null,
};
const peaceLily: SpeciesRef = {
  id: 'peace-lily',
  commonName: 'Peace lily',
  scientificName: 'Spathiphyllum',
  rarity: 'common',
  sensitive: false,
  imageUrl: null,
};
const flamingoFlower: SpeciesRef = {
  id: 'flamingo-flower',
  commonName: 'Flamingo flower',
  scientificName: 'Anthurium andraeanum',
  rarity: 'common',
  sensitive: false,
  imageUrl: null,
};
const easterLily: SpeciesRef = {
  id: 'easter-lily',
  commonName: 'Easter lily',
  scientificName: 'Lilium longiflorum',
  rarity: 'common',
  sensitive: false,
  imageUrl: null,
};
const bostonFern: SpeciesRef = {
  id: 'boston-fern',
  commonName: 'Boston fern',
  scientificName: 'Nephrolepis exaltata',
  rarity: 'common',
  sensitive: false,
  imageUrl: null,
};
const foxglove: SpeciesRef = {
  id: 'foxglove',
  commonName: 'Foxglove',
  scientificName: 'Digitalis purpurea',
  rarity: 'uncommon',
  sensitive: false,
  imageUrl: null,
};
const gorse: SpeciesRef = {
  id: 'gorse',
  commonName: 'Gorse',
  scientificName: 'Ulex europaeus',
  rarity: 'common',
  sensitive: false,
  imageUrl: null,
};
const primrose: SpeciesRef = {
  id: 'primrose',
  commonName: 'Primrose',
  scientificName: 'Primula vulgaris',
  rarity: 'common',
  sensitive: false,
  imageUrl: null,
};
const hawthorn: SpeciesRef = {
  id: 'hawthorn',
  commonName: 'Hawthorn',
  scientificName: 'Crataegus monogyna',
  rarity: 'common',
  sensitive: false,
  imageUrl: null,
};
const bluebell: SpeciesRef = {
  id: 'bluebell',
  commonName: 'Bluebell',
  scientificName: 'Hyacinthoides non-scripta',
  rarity: 'rare',
  sensitive: false,
  imageUrl: null,
};
const earlyPurpleOrchid: SpeciesRef = {
  id: 'early-purple-orchid',
  commonName: 'Early purple orchid',
  scientificName: 'Orchis mascula',
  rarity: 'rare',
  sensitive: true,
  imageUrl: null,
};

const species: Record<string, SpeciesRef> = {
  'swiss-cheese-plant': swissCheesePlant,
  'spider-plant': spiderPlant,
  'peace-lily': peaceLily,
  'flamingo-flower': flamingoFlower,
  'easter-lily': easterLily,
  'boston-fern': bostonFern,
  foxglove,
  gorse,
  primrose,
  hawthorn,
  bluebell,
  'early-purple-orchid': earlyPurpleOrchid,
};

// Toxicity. ASPCA content is paraphrased and each entry links to its page.
// "Unknown" means we have not reviewed the species yet. It never means safe.

const ASPCA_PLANTS =
  'https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants';

const unknownToxicity = (): ToxicityEntry[] => [
  {
    animal: 'cat',
    severity: 'unknown',
    summary: null,
    symptoms: null,
    sourceName: null,
    sourceUrl: null,
  },
  {
    animal: 'dog',
    severity: 'unknown',
    summary: null,
    symptoms: null,
    sourceName: null,
    sourceUrl: null,
  },
];

const spiderPlantToxicity: ToxicityEntry[] = (['cat', 'dog'] as const).map((animal) => ({
  animal,
  severity: 'none',
  summary: null,
  symptoms: null,
  sourceName: 'ASPCA',
  sourceUrl: `${ASPCA_PLANTS}/spider-plant`,
}));

const peaceLilySymptoms = 'Mouth irritation, drooling, vomiting and trouble swallowing.';
const peaceLilyToxicity: ToxicityEntry[] = [
  {
    animal: 'cat',
    severity: 'moderate',
    summary: 'Peace lily can irritate the mouth and cause drooling and vomiting.',
    symptoms: peaceLilySymptoms,
    sourceName: 'ASPCA',
    sourceUrl: `${ASPCA_PLANTS}/peace-lily`,
  },
  {
    animal: 'dog',
    severity: 'moderate',
    summary:
      'Peace lily can irritate the mouth and cause drooling, vomiting and trouble swallowing.',
    symptoms: peaceLilySymptoms,
    sourceName: 'ASPCA',
    sourceUrl: `${ASPCA_PLANTS}/peace-lily`,
  },
];

const easterLilyToxicity: ToxicityEntry[] = [
  {
    animal: 'cat',
    severity: 'severe',
    summary: 'Easter lily can cause kidney failure.',
    symptoms: null,
    sourceName: 'ASPCA',
    sourceUrl: `${ASPCA_PLANTS}/easter-lily`,
  },
  {
    animal: 'dog',
    severity: 'none',
    summary: null,
    symptoms: null,
    sourceName: 'ASPCA',
    sourceUrl: `${ASPCA_PLANTS}/easter-lily`,
  },
];

const speciesToxicity: Record<string, ToxicityEntry[]> = {
  'spider-plant': spiderPlantToxicity,
  'peace-lily': peaceLilyToxicity,
  'easter-lily': easterLilyToxicity,
  'swiss-cheese-plant': unknownToxicity(),
  bluebell: unknownToxicity(),
  'early-purple-orchid': unknownToxicity(),
};

// People and pets.

const profile: Profile = {
  handle: 'aoifegrows',
  displayName: 'Aoife',
  plantdexCount: 37,
  careStreakDays: 12,
  discoveryStreakWeeks: 3,
  badgesEarned: ['First find', 'Hedgerow half'],
};

const household: Household = {
  id: 'our-flat',
  name: 'Our flat',
  members: [{ name: 'Aoife', isYou: true }],
  pets: [
    { id: 'pet-miso', animal: 'cat', name: 'Miso' },
    { id: 'pet-bran', animal: 'dog', name: 'Bran' },
  ],
  vet: null,
};

const households: { id: string; name: string }[] = [
  { id: 'our-flat', name: 'Our flat' },
  { id: 'mams-house', name: 'Mam’s house' },
];

// My Plants.

const monty: PlantSummary = {
  id: 'monty',
  nickname: 'Monty',
  species: swissCheesePlant,
  room: 'Living room',
  status: 'alive',
  careState: 'due',
  nextCheckOn: '2026-10-03',
  pausedNote: null,
  photoUrl: null,
  statusOn: null,
};
const spidey: PlantSummary = {
  id: 'spidey',
  nickname: 'Spidey',
  species: spiderPlant,
  room: 'Kitchen',
  status: 'alive',
  careState: 'overdue',
  nextCheckOn: '2026-10-02',
  pausedNote: null,
  photoUrl: null,
  statusOn: null,
};
const lily: PlantSummary = {
  id: 'lily',
  nickname: 'Lily',
  species: peaceLily,
  room: 'Bedroom',
  status: 'alive',
  careState: 'ok',
  nextCheckOn: '2026-10-05',
  pausedNote: null,
  photoUrl: null,
  statusOn: null,
};

const plants: PlantSummary[] = [monty, spidey, lily];

const plantDetails: Record<string, PlantDetail> = {
  monty: {
    ...monty,
    setup: {
      nickname: 'Monty',
      room: 'Living room',
      light: 'bright',
      potMaterial: 'plastic',
      potSizeCm: 24,
      drainage: 'yes',
      indoor: true,
    },
    matchProbability: 0.96,
    carePlan: [
      {
        icon: 'sprout',
        title: 'Check the soil every 7 days',
        detail: 'Basic schedule for this species',
      },
      { icon: 'sun', title: 'Bright, indirect light', detail: 'From your setup answers' },
      {
        icon: 'droplet',
        title: '24 cm plastic pot, drains',
        detail: 'Water only when the top is dry',
      },
    ],
    toxicity: unknownToxicity(),
    history: [
      { label: 'Soil not dry yet', on: '2026-09-30' },
      { label: 'Watered', on: '2026-09-26' },
      { label: 'Added from a scan', on: '2026-08-02' },
    ],
    deathCause: null,
  },
  'lily-given-away': {
    id: 'lily-given-away',
    nickname: 'Lily',
    species: peaceLily,
    room: null,
    status: 'given_away',
    careState: 'closed',
    nextCheckOn: null,
    pausedNote: null,
    photoUrl: null,
    setup: {
      nickname: 'Lily',
      room: null,
      light: 'unknown',
      potMaterial: 'unknown',
      potSizeCm: null,
      drainage: 'unknown',
      indoor: true,
    },
    matchProbability: null,
    carePlan: [],
    toxicity: peaceLilyToxicity,
    history: [
      { label: 'Given away', on: '2026-09-12' },
      { label: 'Watered', on: '2026-09-06' },
      { label: 'Added from a scan', on: '2026-06-03' },
    ],
    statusOn: '2026-09-12',
    deathCause: null,
  },
  'fern-dead': {
    id: 'fern-dead',
    nickname: 'Fern',
    species: bostonFern,
    room: null,
    status: 'dead',
    careState: 'closed',
    nextCheckOn: null,
    pausedNote: null,
    photoUrl: null,
    setup: {
      nickname: 'Fern',
      room: null,
      light: 'unknown',
      potMaterial: 'unknown',
      potSizeCm: null,
      drainage: 'unknown',
      indoor: true,
    },
    matchProbability: null,
    carePlan: [],
    toxicity: [],
    history: [
      { label: 'Died · too dry', on: '2026-08-20' },
      { label: 'Soil dry', on: '2026-08-14' },
    ],
    statusOn: '2026-08-20',
    deathCause: 'too dry',
  },
};

// Today.

const tasks: CareTask[] = [
  {
    id: 't-monty',
    plantId: 'monty',
    plantNickname: 'Monty',
    room: 'Living room',
    kind: 'check',
    dueOn: '2026-10-03',
    status: 'due',
    photoUrl: null,
  },
  {
    id: 't-spidey',
    plantId: 'spidey',
    plantNickname: 'Spidey',
    room: 'Kitchen',
    kind: 'check',
    dueOn: '2026-10-02',
    status: 'overdue',
    photoUrl: null,
  },
  {
    id: 't-lily-water',
    plantId: 'lily',
    plantNickname: 'Lily',
    room: 'Bedroom',
    kind: 'water',
    dueOn: '2026-10-03',
    status: 'done',
    photoUrl: null,
  },
];

/** 28 days, oldest first: the 16 days before the streak are empty, then 12 checked days. */
const calendar: DayMark[] = [
  ...Array.from({ length: 16 }, (): DayMark => 'empty'),
  ...Array.from({ length: 12 }, (): DayMark => 'checked'),
];

const today: TodaySummary = {
  dateLabel: 'Saturday 3 October',
  streak: {
    careDays: 12,
    careState: 'last_day',
    lastBrokenLength: null,
    discoveryWeeks: 3,
    freezesHeld: 1,
    winterMode: false,
    winterModeAvailable: false,
    calendar,
  },
  tasks,
  league: { rank: 4, of: 20, points: 340, daysLeft: 3 },
  identifications: {
    kind: 'identification',
    used: 3,
    limit: 10,
    resetsOn: '2026-11-01',
    plan: 'free',
  },
  hasPlants: true,
  nextCheck: { plantNickname: 'Spidey', on: '2026-10-04' },
};

// Scan results.

const peaceLilyCare: CareBasics = {
  light: 'Bright, indirect',
  soilCheck: 'Every 5 to 7 days',
  warmth: '18 to 27 °C',
};

const suggestion = (s: SpeciesRef, probability: number): Suggestion => ({
  species: s,
  probability,
  referenceImageUrl: null,
});

const peaceLilyResult = (key: string, top: number, other: number): ScanResult => ({
  observationId: `obs-${key}`,
  state: 'identified',
  photoUrls: [],
  suggestions: [suggestion(peaceLily, top), suggestion(flamingoFlower, other)],
  captureSource: 'camera',
  care: peaceLilyCare,
  toxicity: peaceLilyToxicity,
  diagnosis: null,
});

const nonIdentified = (key: string, state: 'not_a_plant' | 'offline' | 'error'): ScanResult => ({
  observationId: `obs-${key}`,
  state,
  photoUrls: [],
  suggestions: [],
  captureSource: 'camera',
  care: null,
  toxicity: [],
  diagnosis: null,
});

const scanResults: Record<string, ScanResult> = {
  'peace-lily-very-likely': peaceLilyResult('peace-lily-very-likely', 0.94, 0.03),
  'peace-lily-likely': peaceLilyResult('peace-lily-likely', 0.71, 0.22),
  // At 41% the pet check stays Unknown (frame 2c), whichever species is top of the list.
  'not-sure': {
    ...peaceLilyResult('not-sure', 0.41, 0.32),
    care: null,
    toxicity: unknownToxicity(),
  },
  'not-a-plant': nonIdentified('not-a-plant', 'not_a_plant'),
  offline: nonIdentified('offline', 'offline'),
  error: nonIdentified('error', 'error'),
  'foxglove-find': {
    observationId: 'obs-foxglove-find',
    state: 'identified',
    photoUrls: [],
    suggestions: [suggestion(foxglove, 0.92)],
    captureSource: 'camera',
    care: null,
    toxicity: [],
    diagnosis: null,
  },
};

const outcomes: Record<string, Outcome> = {
  'foxglove-awarded': {
    pointsStatus: 'awarded',
    points: 40,
    noPointsReason: null,
    newToPlantdex: true,
    plantdexCount: 38,
    sets: [{ setId: 'irish-hedgerow', name: 'Irish hedgerow', found: 5, total: 8 }],
  },
  'bluebell-held': {
    pointsStatus: 'held',
    points: 80,
    noPointsReason: null,
    newToPlantdex: true,
    plantdexCount: 38,
    sets: [],
  },
  'primrose-gallery': {
    pointsStatus: 'no_points',
    points: 0,
    noPointsReason: 'gallery',
    newToPlantdex: true,
    plantdexCount: 38,
    sets: [],
  },
};

// Collection.

const plantdex: PlantdexEntry[] = [
  { species: foxglove, category: 'wild', findsCount: 1, photoUrl: null },
  { species: bluebell, category: 'wild', findsCount: 2, photoUrl: null },
  { species: gorse, category: 'wild', findsCount: 1, photoUrl: null },
  { species: primrose, category: 'wild', findsCount: 1, photoUrl: null },
  { species: hawthorn, category: 'wild', findsCount: 1, photoUrl: null },
  { species: spiderPlant, category: 'houseplant', findsCount: 1, photoUrl: null },
  { species: peaceLily, category: 'houseplant', findsCount: 1, photoUrl: null },
  { species: swissCheesePlant, category: 'houseplant', findsCount: 1, photoUrl: null },
];

// The entries above are a sample; these are the stated totals the Plantdex tab shows.
export const plantdexCounts = { all: 37, houseplants: 21, wild: 16 } as const;

const missing = (count: number): CollectionSet['tiles'] =>
  Array.from({ length: count }, () => ({ species: null, found: false }));

const sets: CollectionSet[] = [
  {
    id: 'irish-hedgerow',
    name: 'Irish hedgerow',
    preview: 'Foxglove, gorse, primrose, hawthorn…',
    found: 4,
    total: 8,
    tiles: [
      ...[foxglove, gorse, primrose, hawthorn].map((s) => ({ species: s, found: true })),
      ...missing(4),
    ],
  },
  {
    id: 'easy-care-houseplants',
    name: 'Easy-care houseplants',
    preview: 'Spider plant, peace lily, Swiss cheese plant',
    found: 3,
    total: 6,
    tiles: [
      ...[spiderPlant, peaceLily, swissCheesePlant].map((s) => ({ species: s, found: true })),
      ...missing(3),
    ],
  },
];

const finds: FindListItem[] = [
  {
    observationId: 'obs-find-foxglove',
    species: foxglove,
    placeType: 'wild',
    foundOn: '2026-09-28',
    lat: 53.3011,
    lng: -6.2412,
  },
  {
    observationId: 'obs-find-gorse',
    species: gorse,
    placeType: 'wild',
    foundOn: '2026-09-21',
    lat: 53.2897,
    lng: -6.1823,
  },
  {
    observationId: 'obs-find-primrose',
    species: primrose,
    placeType: 'garden_park',
    foundOn: '2026-04-02',
    lat: 53.3498,
    lng: -6.2603,
  },
];

const badges: Badge[] = [
  {
    id: 'first-find',
    name: 'First find',
    description: 'Log your first wild find',
    earned: true,
    progress: null,
  },
  {
    id: 'hedgerow-half',
    name: 'Hedgerow half',
    description: 'Find 4 of the Irish hedgerow set',
    earned: true,
    progress: null,
  },
  {
    id: 'month-of-care',
    name: 'Month of care',
    description: 'Hold a 30-day care streak',
    earned: false,
    progress: { current: 12, target: 30 },
  },
  {
    id: 'bluebell-wood',
    name: 'Bluebell wood',
    description: 'Find bluebell in 3 places',
    earned: false,
    progress: { current: 1, target: 3 },
  },
];

// Leagues.

const row = (rank: number, handle: string, points: number, isYou = false) => ({
  rank,
  handle,
  points,
  isYou,
  pending: false,
});

const league: LeagueBoard = {
  size: 20,
  daysLeft: 3,
  resetsOn: 'Monday',
  joined: true,
  rows: [
    row(1, 'hedgehopper', 520),
    row(2, 'fernandfox', 410),
    row(3, 'mossbank', 355),
    row(4, 'aoifegrows', 340, true),
    row(5, 'greenwick', 290),
    row(6, 'lichenlou', 275),
  ],
};

const friends: LeagueBoard = {
  size: 3,
  daysLeft: 3,
  resetsOn: 'Monday',
  joined: true,
  rows: [row(1, 'fernandfox', 410), row(2, 'aoifegrows', 340, true), row(3, 'siobhanplants', 120)],
};

const weekResult: WeekResult = {
  rank: 4,
  of: 20,
  points: 340,
  bestFind: { name: 'Foxglove', rarity: 'uncommon' },
};

const entitlement: Entitlement = {
  plan: 'free',
  source: null,
  activeUntil: null,
  previewUsed: false,
};

// Plant label (QR) adoption, frame 4o.

const label: LabelInfo = {
  code: 'PL-0001',
  species: peaceLily,
  growerName: 'Greenhouse Growers',
  care: peaceLilyCare,
  careLines: ['Bright, indirect light', 'Check the soil every 5 to 7 days'],
  toxicity: peaceLilyToxicity,
};

export const aoife = {
  profile,
  household,
  households,
  species,
  speciesToxicity,
  plants,
  plantDetails,
  today,
  scanResults,
  outcomes,
  plantdex,
  sets,
  finds,
  badges,
  league,
  friends,
  weekResult,
  entitlement,
  label,
};
