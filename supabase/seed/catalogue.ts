// The seed catalogue: the source data that `build.ts` turns into `supabase/seed.sql`.
//
// Plain data only. Names and rarity for the plants in the UX brief come from the `aoife` fixture, so the seeded
// database and the design frames cannot drift apart without `build.ts` noticing.
//
// Toxicity rules:
// - Every row is `seed_pending_vet`. Nothing here has been reviewed by a vet.
// - A species with no rows reads as Unknown in the app. "None" (no known toxicity) is only seeded where ASPCA lists
//   the plant as non-toxic, and it always carries the ASPCA page it came from.
// - ASPCA content is all rights reserved, so the summaries and symptoms below are paraphrased, never copied.

import { aoife } from '../../packages/core/src/fixtures/aoife.ts';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Animal = 'cat' | 'dog';
export type Severity = 'none' | 'mild' | 'moderate' | 'severe';

export interface Care {
  /** 1 (let it dry out) to 3 (keep it moist). The average drives the default soil-check interval. */
  wateringMin: number;
  wateringMax: number;
  light: string;
  /** Only set where the label demo needs a species-specific interval; otherwise derived from watering. */
  checkIntervalDays?: number;
  warmth?: string;
}

export interface SpeciesSeed {
  slug: string;
  commonName: string;
  scientificName: string;
  family: string;
  genus: string;
  rarity: Rarity;
  /** Present for houseplants (`is_houseplant = true`), absent for wild plants. */
  care: Care | null;
}

export interface ToxicitySeed {
  animal: Animal;
  severity: Severity;
  summary: string | null;
  symptoms: string | null;
  sourceName: string;
  sourceUrl: string;
}

export interface SensitiveTaxonSeed {
  rank: 'species' | 'genus' | 'family';
  taxon: string;
  reason: string;
  source: string;
}

export interface PartnerSeed {
  id: string;
  name: string;
  kind: 'grower' | 'garden_centre';
  contactEmail: string;
}

export interface QrCodeSeed {
  code: string;
  partnerId: string;
  speciesSlug: string;
  cultivar: string | null;
}

export interface SetSeed {
  id: string;
  name: string;
  speciesSlugs: string[];
}

/** Names come from the fixture for the UX brief's plants, so a rename there fails the build instead of drifting. */
function fixtureNames(slug: string): { commonName: string; scientificName: string } {
  const ref = aoife.species[slug];
  if (!ref) throw new Error(`aoife fixture has no species "${slug}"`);
  return { commonName: ref.commonName, scientificName: ref.scientificName };
}

function species(
  slug: string,
  names: { commonName: string; scientificName: string },
  family: string,
  options: { rarity?: Rarity; care?: Care } = {},
): SpeciesSeed {
  return {
    slug,
    ...names,
    family,
    genus: names.scientificName.split(' ')[0],
    rarity: options.rarity ?? 'common',
    care: options.care ?? null,
  };
}

const named = (commonName: string, scientificName: string) => ({ commonName, scientificName });

const care = (wateringMin: number, wateringMax: number, light: string): Care => ({
  wateringMin,
  wateringMax,
  light,
});

const BRIGHT_INDIRECT = 'Bright, indirect';
const MEDIUM_BRIGHT_INDIRECT = 'Medium to bright, indirect';
const MEDIUM_INDIRECT = 'Medium, indirect';

export const speciesSeeds: SpeciesSeed[] = [
  // The UX brief's sample plants (the `aoife` fixture).
  species('swiss-cheese-plant', fixtureNames('swiss-cheese-plant'), 'Araceae', {
    care: care(2, 2, BRIGHT_INDIRECT),
  }),
  species('spider-plant', fixtureNames('spider-plant'), 'Asparagaceae', {
    care: care(2, 2, BRIGHT_INDIRECT),
  }),
  species('peace-lily', fixtureNames('peace-lily'), 'Araceae', {
    // The demo label (PL-0001) shows these values.
    care: {
      ...care(2, 3, BRIGHT_INDIRECT),
      checkIntervalDays: 6,
      warmth: aoife.label.care.warmth ?? undefined,
    },
  }),
  species('flamingo-flower', fixtureNames('flamingo-flower'), 'Araceae', {
    care: care(2, 2, BRIGHT_INDIRECT),
  }),
  species('easter-lily', fixtureNames('easter-lily'), 'Liliaceae', {
    care: care(2, 2, BRIGHT_INDIRECT),
  }),
  species('boston-fern', fixtureNames('boston-fern'), 'Nephrolepidaceae', {
    care: care(2, 2, MEDIUM_INDIRECT),
  }),
  species('foxglove', fixtureNames('foxglove'), 'Plantaginaceae', { rarity: 'uncommon' }),
  species('gorse', fixtureNames('gorse'), 'Fabaceae'),
  species('primrose', fixtureNames('primrose'), 'Primulaceae'),
  species('hawthorn', fixtureNames('hawthorn'), 'Rosaceae'),
  species('bluebell', fixtureNames('bluebell'), 'Asparagaceae', { rarity: 'rare' }),
  species('early-purple-orchid', fixtureNames('early-purple-orchid'), 'Orchidaceae', {
    rarity: 'rare',
  }),

  // More houseplants.
  species('snake-plant', named('Snake plant', 'Dracaena trifasciata'), 'Asparagaceae', {
    care: care(1, 1, 'Low to bright, indirect'),
  }),
  species('golden-pothos', named('Golden pothos', 'Epipremnum aureum'), 'Araceae', {
    care: care(2, 2, MEDIUM_BRIGHT_INDIRECT),
  }),
  species('aloe', named('Aloe', 'Aloe vera'), 'Asphodelaceae', {
    care: care(1, 1, 'Bright, some direct sun'),
  }),
  species('jade-plant', named('Jade plant', 'Crassula ovata'), 'Crassulaceae', {
    care: care(1, 1, 'Bright, some direct sun'),
  }),
  species('zz-plant', named('ZZ plant', 'Zamioculcas zamiifolia'), 'Araceae', {
    care: care(1, 1, 'Low to medium'),
  }),
  species('parlor-palm', named('Parlor palm', 'Chamaedorea elegans'), 'Arecaceae', {
    care: care(2, 2, MEDIUM_INDIRECT),
  }),
  species('calathea', named('Calathea', 'Goeppertia'), 'Marantaceae', {
    care: care(2, 2, MEDIUM_INDIRECT),
  }),
  species('african-violet', named('African violet', 'Saintpaulia'), 'Gesneriaceae', {
    care: care(2, 2, BRIGHT_INDIRECT),
  }),
  species('english-ivy', named('English ivy', 'Hedera helix'), 'Araliaceae', {
    care: care(2, 2, MEDIUM_BRIGHT_INDIRECT),
  }),
  species(
    'heartleaf-philodendron',
    named('Heartleaf philodendron', 'Philodendron hederaceum'),
    'Araceae',
    { care: care(2, 2, MEDIUM_BRIGHT_INDIRECT) },
  ),
  species('dieffenbachia', named('Dieffenbachia', 'Dieffenbachia'), 'Araceae', {
    care: care(2, 2, MEDIUM_BRIGHT_INDIRECT),
  }),
  species('sago-palm', named('Sago palm', 'Cycas revoluta'), 'Cycadaceae', {
    care: care(2, 2, 'Bright'),
  }),
  species('poinsettia', named('Poinsettia', 'Euphorbia pulcherrima'), 'Euphorbiaceae', {
    care: care(2, 2, BRIGHT_INDIRECT),
  }),
  species('christmas-cactus', named('Christmas cactus', 'Schlumbergera'), 'Cactaceae', {
    care: care(2, 2, BRIGHT_INDIRECT),
  }),
  species('moth-orchid', named('Moth orchid', 'Phalaenopsis'), 'Orchidaceae', {
    care: care(2, 2, BRIGHT_INDIRECT),
  }),
  species('rubber-plant', named('Rubber plant', 'Ficus elastica'), 'Moraceae', {
    care: care(2, 2, BRIGHT_INDIRECT),
  }),
  species('fiddle-leaf-fig', named('Fiddle leaf fig', 'Ficus lyrata'), 'Moraceae', {
    care: care(2, 2, BRIGHT_INDIRECT),
  }),

  // More wild plants.
  species('blackthorn', named('Blackthorn', 'Prunus spinosa'), 'Rosaceae'),
  species('dog-rose', named('Dog rose', 'Rosa canina'), 'Rosaceae'),
  species('honeysuckle', named('Honeysuckle', 'Lonicera periclymenum'), 'Caprifoliaceae'),
];

// Toxicity. Keyed by species slug. Species that are not keyed here get no rows, which the app shows as Unknown:
// ZZ plant, rubber plant, fiddle leaf fig, bluebell, gorse, blackthorn, dog rose, honeysuckle, flamingo flower and
// early purple orchid.

const SOURCE_NAME = 'ASPCA';
const ASPCA_PLANTS =
  'https://www.aspca.org/pet-care/aspca-poison-control/toxic-and-non-toxic-plants';
const ANIMALS: readonly Animal[] = ['cat', 'dog'];

/** `page` is the ASPCA page slug, which is not always ours (the moth orchid is "phalaenopsis-orchid"). */
function rows(
  page: string,
  severity: Severity,
  summary: string | null,
  symptoms: string | null,
  animals: readonly Animal[] = ANIMALS,
): ToxicitySeed[] {
  return animals.map((animal) => ({
    animal,
    severity,
    summary,
    symptoms,
    sourceName: SOURCE_NAME,
    sourceUrl: `${ASPCA_PLANTS}/${page}`,
  }));
}

/** ASPCA lists the plant as non-toxic to cats and dogs. */
const nonToxic = (page: string) => rows(page, 'none', null, null);

const CALCIUM_OXALATE_SYMPTOMS = 'Mouth irritation, drooling, vomiting and trouble swallowing.';
const calciumOxalate = (page: string, name: string, symptoms = CALCIUM_OXALATE_SYMPTOMS) =>
  rows(
    page,
    'moderate',
    `${name} can irritate the mouth and cause drooling, vomiting and trouble swallowing.`,
    symptoms,
  );

/** The peace lily summaries are the fixture's own, so the demo label and the database say the same words. */
function peaceLilyRows(): ToxicitySeed[] {
  const entries = aoife.speciesToxicity['peace-lily'];
  if (!entries) throw new Error('aoife fixture has no peace lily toxicity');
  return entries.map((entry) => {
    if (entry.severity === 'unknown') throw new Error('fixture peace lily toxicity is unknown');
    return {
      animal: entry.animal,
      severity: entry.severity,
      summary: entry.summary,
      symptoms: entry.symptoms,
      sourceName: SOURCE_NAME,
      sourceUrl: `${ASPCA_PLANTS}/peace-lily`,
    };
  });
}

export const toxicitySeeds: Record<string, ToxicitySeed[]> = {
  // No known toxicity to cats or dogs.
  'spider-plant': nonToxic('spider-plant'),
  'boston-fern': nonToxic('boston-fern'),
  'african-violet': nonToxic('african-violet'),
  'parlor-palm': nonToxic('parlor-palm'),
  calathea: nonToxic('calathea'),
  'christmas-cactus': nonToxic('christmas-cactus'),
  'moth-orchid': nonToxic('phalaenopsis-orchid'),
  hawthorn: nonToxic('hawthorn'),

  // Moderate: insoluble calcium oxalates.
  'peace-lily': peaceLilyRows(),
  'swiss-cheese-plant': calciumOxalate('swiss-cheese-plant', 'Swiss cheese plant'),
  'golden-pothos': calciumOxalate('golden-pothos', 'Golden pothos'),
  'heartleaf-philodendron': calciumOxalate(
    'heartleaf-philodendron',
    'Heartleaf philodendron',
    'Mouth irritation, pain and swelling, drooling, vomiting and trouble swallowing.',
  ),
  dieffenbachia: calciumOxalate('dieffenbachia', 'Dieffenbachia'),

  // Mild.
  'snake-plant': rows(
    'snake-plant',
    'mild',
    'Snake plant can upset the stomach.',
    'Nausea, vomiting and diarrhoea.',
  ),
  aloe: rows(
    'aloe',
    'mild',
    'Aloe can cause vomiting and diarrhoea.',
    'Vomiting, lethargy and diarrhoea.',
  ),
  'jade-plant': rows(
    'jade-plant',
    'mild',
    'Jade plant can cause vomiting and unsteadiness.',
    'Vomiting, low mood and poor coordination.',
  ),
  'english-ivy': rows(
    'english-ivy',
    'mild',
    'English ivy can cause vomiting and belly pain. The leaves are more of a problem than the berries.',
    'Vomiting, belly pain, drooling and diarrhoea.',
  ),
  poinsettia: rows(
    'poinsettia',
    'mild',
    'Poinsettia sap can irritate the mouth and stomach, but it is usually less harmful than its reputation.',
    'Mouth and stomach irritation, sometimes vomiting.',
  ),
  primrose: rows('primrose', 'mild', 'Primrose can cause mild vomiting.', 'Mild vomiting.'),

  // Severe.
  'sago-palm': rows(
    'sago-palm',
    'severe',
    'Sago palm can cause liver failure and can be fatal.',
    'Vomiting, black stools, increased thirst, bruising and bleeding, then liver failure.',
  ),
  foxglove: rows(
    'foxglove',
    'severe',
    'Foxglove can disturb the heartbeat and cause heart failure, and can be fatal.',
    'Irregular heartbeat, vomiting, diarrhoea, weakness and heart failure.',
  ),
  // Cats only. ASPCA knows of no effect on dogs, which is a "none" row with its source.
  'easter-lily': [
    ...rows(
      'easter-lily',
      'severe',
      'Easter lily can cause kidney failure.',
      'Vomiting, loss of appetite, lethargy and kidney failure.',
      ['cat'],
    ),
    ...rows('easter-lily', 'none', null, null, ['dog']),
  ],
};

// Taxa whose precise locations must never be shown (poaching risk). The database flags every matching species.
export const sensitiveTaxa: SensitiveTaxonSeed[] = [
  {
    rank: 'family',
    taxon: 'Orchidaceae',
    reason: 'Poaching risk',
    source: 'iNaturalist geoprivacy practice',
  },
  {
    rank: 'genus',
    taxon: 'Cypripedium',
    reason: 'Poaching risk',
    source: 'iNaturalist geoprivacy practice',
  },
];

// The demo partner and its label, as shown on the adoption screen.
const GREENHOUSE_GROWERS_ID = '6f1c5d3e-0000-4000-8000-000000000001';

export const partners: PartnerSeed[] = [
  {
    id: GREENHOUSE_GROWERS_ID,
    name: aoife.label.growerName,
    kind: 'grower',
    contactEmail: 'growers@example.com',
  },
];

export const qrCodes: QrCodeSeed[] = [
  {
    code: aoife.label.code,
    partnerId: GREENHOUSE_GROWERS_ID,
    speciesSlug: 'peace-lily',
    cultivar: null,
  },
];

// Collection sets. Phase 4 creates the set tables and loads these; nothing in this phase writes them to the database.
export const sets: SetSeed[] = [
  {
    id: 'irish-hedgerow',
    name: 'Irish hedgerow',
    speciesSlugs: [
      'foxglove',
      'gorse',
      'primrose',
      'hawthorn',
      'bluebell',
      'blackthorn',
      'dog-rose',
      'honeysuckle',
    ],
  },
  {
    id: 'easy-care-houseplants',
    name: 'Easy-care houseplants',
    speciesSlugs: [
      'spider-plant',
      'peace-lily',
      'swiss-cheese-plant',
      'snake-plant',
      'zz-plant',
      'golden-pothos',
    ],
  },
];
