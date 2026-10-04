import { aoife, plantdexCounts, type FindListItem, type SpeciesRef } from '@tendril/core';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FindsMap } from '../../components/FindsMap';
import { ThemeProvider } from '../../theme';
import { CollectionScreen, plantdexTiles, type CollectionScreenProps } from './CollectionScreen';
import { progressCardSet, setProgressFrom } from './setProgress';
import { SpeciesCardScreen } from './SpeciesCardScreen';

const noop = () => {};
const base: Omit<CollectionScreenProps, 'segment'> = {
  plantdex: { entries: aoife.plantdex, counts: plantdexCounts, filter: 'all' },
  allEntries: aoife.plantdex,
  sets: aoife.sets,
  finds: aoife.finds,
  locationGranted: true,
  badges: aoife.badges,
  avatarLetter: 'A',
  onSegment: noop,
  onFilter: noop,
  onOpenSpecies: noop,
  onScan: noop,
  onTurnOnLocation: noop,
  onShareBadge: noop,
  onAvatar: noop,
};
const wrap = (ui: React.ReactElement) => render(<ThemeProvider scheme="light">{ui}</ThemeProvider>);
const orchid: SpeciesRef = aoife.species['early-purple-orchid']!;

describe('plantdexTiles', () => {
  it('walks the sets in order, found species then missing tiles, then finds in no set', () => {
    const tiles = plantdexTiles(aoife.plantdex, aoife.sets, 'all');
    expect(tiles.map((t) => (t.found ? t.species?.id : `missing:${t.setName}`))).toEqual([
      'foxglove',
      'gorse',
      'primrose',
      'hawthorn',
      ...Array(4).fill('missing:Irish hedgerow'),
      'spider-plant',
      'peace-lily',
      'swiss-cheese-plant',
      ...Array(3).fill('missing:Easy-care houseplants'),
      'bluebell',
    ]);
  });
  it('a filter hides the missing tiles of sets with nothing found under it', () => {
    const wild = aoife.plantdex.filter((e) => e.category === 'wild');
    const tiles = plantdexTiles(wild, aoife.sets, 'wild');
    expect(tiles.filter((t) => !t.found)).toHaveLength(4);
    expect(tiles.map((t) => t.species?.id).filter(Boolean)).not.toContain('peace-lily');
  });
  it('a set that claims a species found with no Plantdex entry shows it as missing', () => {
    const entries = aoife.plantdex.filter((e) => e.species.id !== 'gorse');
    const tiles = plantdexTiles(entries, aoife.sets, 'all');
    expect(tiles.map((t) => t.species?.id)).not.toContain('gorse');
    expect(tiles.filter((t) => !t.found && t.setName === 'Irish hedgerow')).toHaveLength(5);
  });
});

describe('setProgressFrom', () => {
  const byId = (ids: string[]) =>
    new Map(aoife.plantdex.filter((e) => ids.includes(e.species.id)).map((e) => [e.species.id, e]));
  it('counts only the species with an entry', () => {
    const p = setProgressFrom(aoife.sets[0]!, byId(['foxglove', 'gorse']));
    expect(p.found).toBe(2);
    expect(p.total).toBe(8);
    expect(p.tiles.filter((t) => t.entry)).toHaveLength(2);
  });
  it('picks the first incomplete set that has something found under the filter', () => {
    const houseplants = new Map(
      aoife.plantdex.filter((e) => e.category === 'houseplant').map((e) => [e.species.id, e]),
    );
    expect(progressCardSet(aoife.sets, houseplants, 'houseplant')?.set.name).toBe(
      'Easy-care houseplants',
    );
    expect(progressCardSet(aoife.sets, new Map(), 'wild')).toBeNull();
  });
});

describe('CollectionScreen', () => {
  it('Plantdex shows filters with counts and a missing tile', async () => {
    await wrap(<CollectionScreen segment="plantdex" {...base} />);
    expect(screen.getByText('All · 37')).toBeTruthy();
    expect(screen.getByText('Houseplants · 21')).toBeTruthy();
    expect(screen.getByText('Wild · 16')).toBeTruthy();
    expect(screen.getAllByLabelText('Not found yet').length).toBeGreaterThan(0);
    expect(screen.getByText('4 of 8')).toBeTruthy();
  });
  it('the Houseplants filter never shows a wild set progress card', async () => {
    const houseplants = aoife.plantdex.filter((e) => e.category === 'houseplant');
    await wrap(
      <CollectionScreen
        segment="plantdex"
        {...base}
        plantdex={{ entries: houseplants, counts: plantdexCounts, filter: 'houseplant' }}
      />,
    );
    expect(screen.getByText('3 of 6')).toBeTruthy();
    expect(screen.queryByText('4 of 8')).toBeNull();
  });
  it('a set card counts entries, not the set claim', async () => {
    const entries = aoife.plantdex.filter((e) => e.species.id !== 'gorse');
    await wrap(
      <CollectionScreen
        segment="plantdex"
        {...base}
        plantdex={{ entries, counts: plantdexCounts, filter: 'all' }}
        allEntries={entries}
      />,
    );
    expect(screen.getByText('3 of 8')).toBeTruthy();
  });
  it('a filter pill reports the filter, a tile reports its species', async () => {
    const onFilter = jest.fn();
    const onOpenSpecies = jest.fn();
    await wrap(
      <CollectionScreen
        segment="plantdex"
        {...base}
        onFilter={onFilter}
        onOpenSpecies={onOpenSpecies}
      />,
    );
    await fireEvent.press(screen.getByRole('radio', { name: 'Wild · 16' }));
    expect(onFilter).toHaveBeenCalledWith('wild');
    // The placeholder photo repeats the name, so the first match is enough: both sit in the tile.
    await fireEvent.press(screen.getAllByText('Bluebell')[0]!);
    expect(onOpenSpecies).toHaveBeenCalledWith('bluebell');
  });
  it('the segments switch the view', async () => {
    const onSegment = jest.fn();
    await wrap(<CollectionScreen segment="plantdex" {...base} onSegment={onSegment} />);
    await fireEvent.press(screen.getByRole('tab', { name: 'Badges' }));
    expect(onSegment).toHaveBeenCalledWith('badges');
  });
  it('an empty Plantdex offers the first scan and no filters', async () => {
    const onScan = jest.fn();
    await wrap(
      <CollectionScreen
        segment="plantdex"
        {...base}
        plantdex={{ entries: [], counts: { all: 0, houseplants: 0, wild: 0 }, filter: 'all' }}
        sets={[]}
        onScan={onScan}
      />,
    );
    expect(
      screen.getByText('Your Plantdex fills up as you scan. Start with a plant at home.'),
    ).toBeTruthy();
    expect(screen.queryByText('All · 0')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Scan a plant' }));
    expect(onScan).toHaveBeenCalled();
  });
  it('Sets lists the sets, then the first set as tiles', async () => {
    await wrap(<CollectionScreen segment="sets" {...base} />);
    expect(screen.getByText('Easy-care houseplants')).toBeTruthy();
    expect(screen.getByText('3 of 6')).toBeTruthy();
    expect(screen.getByText('Foxglove')).toBeTruthy();
    expect(screen.getAllByText('Not found yet')).toHaveLength(4);
  });
  it('map without location falls back to a list', async () => {
    const onTurnOn = jest.fn();
    await wrap(
      <CollectionScreen
        segment="map"
        {...base}
        locationGranted={false}
        onTurnOnLocation={onTurnOn}
      />,
    );
    expect(screen.getByText('Location is off, so your finds show as a list.')).toBeTruthy();
    expect(screen.getByText('Garden or park · 2 Apr')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Turn on location' }));
    expect(onTurnOn).toHaveBeenCalled();
  });
  it('map with location shows the map, the privacy line and the finds', async () => {
    await wrap(<CollectionScreen segment="map" {...base} />);
    expect(
      screen.getByText('Only you see exact pins. Anything shared shows an area at most.'),
    ).toBeTruthy();
    expect(screen.getByText('Wild · 28 Sep')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Turn on location' })).toBeNull();
  });
  it('a sensitive find says its location is private, in the list and on the map', async () => {
    const hidden: FindListItem = {
      observationId: 'obs-orchid',
      species: orchid,
      placeType: 'wild',
      foundOn: '2026-10-01',
      lat: 53.1,
      lng: -6.1,
    };
    await wrap(<CollectionScreen segment="map" {...base} finds={[hidden, ...aoife.finds]} />);
    expect(screen.getByText('Location private')).toBeTruthy();
    expect(screen.queryByTestId('find-pin-obs-orchid')).toBeNull();
    expect(screen.getByTestId('find-pin-obs-find-foxglove')).toBeTruthy();
  });
  it('Badges show Earned, progress and Share, which shares the latest earned badge', async () => {
    const onShare = jest.fn();
    await wrap(<CollectionScreen segment="badges" {...base} onShareBadge={onShare} />);
    expect(screen.getAllByText('Earned')).toHaveLength(2);
    expect(screen.getByText('12 of 30')).toBeTruthy();
    expect(screen.getByText('1 of 3')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Share a badge' }));
    expect(onShare).toHaveBeenCalledWith(expect.objectContaining({ id: 'hedgerow-half' }));
  });
  it('with no badge earned, says so and keeps the locked row, with nothing to share', async () => {
    await wrap(
      <CollectionScreen
        segment="badges"
        {...base}
        badges={[{ ...aoife.badges[0]!, earned: false }]}
      />,
    );
    expect(screen.getByText('No badges yet. Log your first find to earn one.')).toBeTruthy();
    expect(screen.getByText('Locked')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Share a badge' })).toBeNull();
  });
  it('shows a notice as a snackbar', async () => {
    await wrap(<CollectionScreen segment="plantdex" {...base} notice="Find saved" />);
    expect(screen.getByText('Find saved')).toBeTruthy();
  });
});

describe('FindsMap', () => {
  const find = (id: string, species: SpeciesRef, lat: number | null, lng: number | null) =>
    ({ observationId: id, species, placeType: 'wild', foundOn: '2026-10-01', lat, lng }) as const;
  it('pins only the finds that are not sensitive and have a position', async () => {
    await wrap(
      <FindsMap
        height={340}
        finds={[
          find('a', aoife.species['foxglove']!, 53.3, -6.2),
          find('b', orchid, 53.1, -6.1),
          find('c', aoife.species['gorse']!, null, null),
        ]}
      />,
    );
    expect(screen.getByTestId('find-pin-a')).toBeTruthy();
    expect(screen.queryByTestId('find-pin-b')).toBeNull();
    expect(screen.queryByTestId('find-pin-c')).toBeNull();
  });
});

describe('SpeciesCardScreen', () => {
  it('sensitive species: privacy note and no map link', async () => {
    const card = { species: orchid, findsCount: 1, sets: [], toxicity: [] };
    await wrap(
      <SpeciesCardScreen
        card={card}
        pets={aoife.household.pets}
        onBack={noop}
        onSeeOnMap={noop}
        onPetAte={noop}
      />,
    );
    expect(screen.getByText("We keep this species' location private to protect it.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'See finds on the map' })).toBeNull();
    expect(screen.queryByText('Rare')).toBeNull();
  });
  it('unknown toxicity names the pet, and the set progress shows', async () => {
    const onSeeOnMap = jest.fn();
    const card = {
      species: aoife.species['bluebell']!,
      findsCount: 2,
      sets: [{ name: 'Irish hedgerow', found: 4, total: 8 }],
      toxicity: [],
    };
    await wrap(
      <SpeciesCardScreen
        card={card}
        pets={aoife.household.pets}
        onBack={noop}
        onSeeOnMap={onSeeOnMap}
        onPetAte={noop}
      />,
    );
    expect(screen.getByText('Cats: Unknown')).toBeTruthy();
    expect(screen.getByText('Dogs: Unknown')).toBeTruthy();
    expect(
      screen.getByText('Not reviewed yet. Keep it away from Miso until we know more.'),
    ).toBeTruthy();
    expect(screen.getByText('4 of 8')).toBeTruthy();
    expect(screen.getByText('Rare')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'See finds on the map' }));
    expect(onSeeOnMap).toHaveBeenCalled();
  });
  it('My pet ate this asks which pet, and Back goes back', async () => {
    const onPetAte = jest.fn();
    const onBack = jest.fn();
    const card = { species: aoife.species['bluebell']!, findsCount: 2, sets: [], toxicity: [] };
    await wrap(
      <SpeciesCardScreen
        card={card}
        pets={aoife.household.pets}
        onBack={onBack}
        onSeeOnMap={noop}
        onPetAte={onPetAte}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'My pet ate this' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Bran' }));
    expect(onPetAte).toHaveBeenCalledWith('pet-bran');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
  });
});
