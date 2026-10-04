import { aoife, plantdexCounts, type CollectionSet } from '@tendril/core';
import {
  CollectionScreen,
  type CollectionScreenProps,
} from '../../screens/collection/CollectionScreen';
import { SpeciesCardScreen } from '../../screens/collection/SpeciesCardScreen';
import { registerFrame } from '../registry';
import { TabScreenFrame } from '../TabScreenFrame';

/** Frames 2f, 4ah to 4ak and 4am to 4ap: the Collection tab and the species card. */

const noop = () => {};
const handlers = {
  avatarLetter: 'A',
  onSegment: noop,
  onFilter: noop,
  onOpenSpecies: noop,
  onScan: noop,
  onTurnOnLocation: noop,
  onShareBadge: noop,
  onAvatar: noop,
} as const;

const plantdex = { entries: aoife.plantdex, counts: plantdexCounts, filter: 'all' as const };

const collection = (
  props: Pick<CollectionScreenProps, 'segment'> & Partial<CollectionScreenProps>,
) => (
  <TabScreenFrame active="collection">
    <CollectionScreen
      {...handlers}
      plantdex={plantdex}
      allEntries={aoife.plantdex}
      sets={aoife.sets}
      finds={aoife.finds}
      locationGranted
      badges={aoife.badges}
      {...props}
    />
  </TabScreenFrame>
);

const [foxglove, bluebell, gorse, primrose, hawthorn] = aoife.plantdex.map((e) => e.species);

// Frame 2f draws its tiles as Foxglove, Bluebell, Gorse, one missing, Primrose, Hawthorn. The sample
// data cannot give that order (Bluebell is in no set, and the set has four missing), so this frame
// passes a set shaped like the design's grid. The real order is tested in `plantdexTiles`.
const hedgerowAsDrawn: CollectionSet = {
  ...aoife.sets[0]!,
  tiles: [
    { species: foxglove!, found: true },
    { species: bluebell!, found: true },
    { species: gorse!, found: true },
    { species: null, found: false },
    { species: primrose!, found: true },
    { species: hawthorn!, found: true },
  ],
};

registerFrame({
  id: '2f',
  title: 'Plantdex · 37 species, filters, set progress, missing tile',
  render: () => collection({ segment: 'plantdex', sets: [hedgerowAsDrawn] }),
});

registerFrame({
  id: '4ah',
  title: 'Plantdex · empty',
  render: () =>
    collection({
      segment: 'plantdex',
      plantdex: { entries: [], counts: { all: 0, houseplants: 0, wild: 0 }, filter: 'all' },
      sets: [],
    }),
});

const bluebellCard = {
  species: aoife.species['bluebell']!,
  findsCount: 2,
  sets: [{ name: 'Irish hedgerow', found: 4, total: 8 }],
  toxicity: aoife.speciesToxicity['bluebell'] ?? [],
};
const orchidCard = {
  species: aoife.species['early-purple-orchid']!,
  findsCount: 1,
  sets: [],
  toxicity: aoife.speciesToxicity['early-purple-orchid'] ?? [],
};
const cardHandlers = { pets: aoife.household.pets, onBack: noop, onSeeOnMap: noop, onPetAte: noop };

registerFrame({
  id: '4ai',
  title: 'Species card',
  statusBar: 'light',
  render: () => <SpeciesCardScreen card={bluebellCard} {...cardHandlers} />,
});

registerFrame({
  id: '4aj',
  title: 'Species card · sensitive species',
  statusBar: 'light',
  render: () => <SpeciesCardScreen card={orchidCard} {...cardHandlers} />,
});

registerFrame({
  id: '4ak',
  title: 'Sets · progress rows and the set as tiles',
  // The design draws six of the set's tiles (Foxglove to Hawthorn, then two missing), not all eight.
  render: () =>
    collection({
      segment: 'sets',
      sets: [
        { ...aoife.sets[0]!, tiles: aoife.sets[0]!.tiles.slice(0, 6) },
        ...aoife.sets.slice(1),
      ],
    }),
});

registerFrame({
  id: '4am',
  title: 'Finds map · exact pins, only you see them',
  render: () => collection({ segment: 'map', finds: aoife.finds.slice(0, 2) }),
});

registerFrame({
  id: '4an',
  title: 'Finds map · location off, a list',
  render: () => collection({ segment: 'map', locationGranted: false }),
});

registerFrame({
  id: '4ao',
  title: 'Badges · earned, progress, share',
  render: () => collection({ segment: 'badges' }),
});

registerFrame({
  id: '4ap',
  title: 'Badges · none earned yet',
  render: () =>
    collection({
      segment: 'badges',
      badges: [{ ...aoife.badges[0]!, earned: false, progress: null }],
    }),
});
