import {
  collectionCopy,
  filterPillLabel,
  placeTypeOptions,
  radius,
  setProgressValue,
  shortDate,
  type Badge,
  type CollectionSet,
  type FindListItem,
  type PlantdexEntry,
  type SpeciesRef,
} from '@tendril/core';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  EmptyState,
  Note,
  PlantdexTile,
  RowsCard,
  ScreenHeader,
  SegmentedControl,
  Snackbar,
  type Row,
} from '../../components';
import { FindsMap } from '../../components/FindsMap';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';

export type CollectionSegment = 'plantdex' | 'sets' | 'map' | 'badges';
export type PlantdexFilter = 'all' | 'houseplant' | 'wild';

export interface CollectionScreenProps {
  segment: CollectionSegment;
  /** Null while the Plantdex is loading. */
  plantdex: {
    entries: PlantdexEntry[];
    counts: { all: number; houseplants: number; wild: number };
    filter: PlantdexFilter;
  } | null;
  sets: CollectionSet[];
  finds: FindListItem[];
  /** The location permission is on, so the map can show. Off, the finds are a list. */
  locationGranted: boolean;
  badges: Badge[];
  avatarLetter: string;
  /** A transient line over the tab bar ("Find saved"). */
  notice?: string | null;
  onSegment: (segment: CollectionSegment) => void;
  onFilter: (filter: PlantdexFilter) => void;
  onOpenSpecies: (speciesId: string) => void;
  onScan: () => void;
  onTurnOnLocation: () => void;
  /** Share the badge the button names: the latest one earned. */
  onShareBadge: (badge: Badge) => void;
  onAvatar: () => void;
}

const SEGMENTS = [
  { value: 'plantdex', label: collectionCopy.segmentPlantdex },
  { value: 'sets', label: collectionCopy.segmentSets },
  { value: 'map', label: collectionCopy.segmentMap },
  { value: 'badges', label: collectionCopy.segmentBadges },
];

/** One tile of the Plantdex grid: a found species (with its entry's photo), or a missing one. */
export interface PlantdexGridTile {
  key: string;
  species: SpeciesRef | null;
  found: boolean;
  photoUrl: string | null;
  /** The set a missing tile belongs to. */
  setName?: string;
}

/**
 * The Plantdex grid (2f): the sets in set order, each set's tiles in the set's own order (a found
 * species as its Plantdex entry, a missing one as a missing tile), then the found species that
 * belong to no set. Under a filter, a found tile needs an entry the filter kept.
 */
export function plantdexTiles(
  entries: PlantdexEntry[],
  sets: CollectionSet[],
  filter: PlantdexFilter,
): PlantdexGridTile[] {
  const byId = new Map(entries.map((e) => [e.species.id, e]));
  const placed = new Set<string>();
  const tiles: PlantdexGridTile[] = [];
  for (const set of sets) {
    const setTiles: PlantdexGridTile[] = [];
    set.tiles.forEach((tile, i) => {
      if (tile.found && tile.species) {
        const entry = byId.get(tile.species.id);
        // The set knows the species is found; with no filter that is enough to show it.
        if (!entry && filter !== 'all') return;
        placed.add(tile.species.id);
        setTiles.push({
          key: `${set.id}-${tile.species.id}`,
          species: entry?.species ?? tile.species,
          found: true,
          photoUrl: entry?.photoUrl ?? null,
        });
      } else {
        setTiles.push({
          key: `${set.id}-missing-${i}`,
          species: null,
          found: false,
          photoUrl: null,
          setName: set.name,
        });
      }
    });
    // A set the filter emptied of found species leaves its missing tiles out too.
    if (filter === 'all' || setTiles.some((t) => t.found)) tiles.push(...setTiles);
  }
  for (const entry of entries) {
    if (placed.has(entry.species.id)) continue;
    tiles.push({
      key: `entry-${entry.species.id}`,
      species: entry.species,
      found: true,
      photoUrl: entry.photoUrl,
    });
  }
  return tiles;
}

/**
 * The Collection tab (2f, 4ah to 4ak, 4am to 4ap): the Plantdex, its sets, a map of the person's
 * finds and their badges. Props only: the route wires the hooks, the permission and the sharing.
 */
export function CollectionScreen(props: CollectionScreenProps) {
  const { segment, plantdex } = props;
  const { c } = useTheme();
  const insets = useInsets();
  const emptyPlantdex = segment === 'plantdex' && plantdex != null && plantdex.counts.all === 0;
  const gap = segment === 'plantdex' && !emptyPlantdex ? 16 : 18;
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { gap, paddingTop: insets.top + 8, paddingBottom: segment === 'plantdex' ? 32 : 24 },
        ]}
      >
        <ScreenHeader
          title={collectionCopy.title}
          avatarLetter={props.avatarLetter}
          onAvatarPress={props.onAvatar}
        />
        <SegmentedControl
          options={SEGMENTS}
          value={segment}
          onChange={(v) => props.onSegment(v as CollectionSegment)}
        />
        {segment === 'plantdex' ? <PlantdexView {...props} /> : null}
        {segment === 'sets' ? <SetsView sets={props.sets} /> : null}
        {segment === 'map' ? <MapSegment {...props} /> : null}
        {segment === 'badges' ? <BadgesView {...props} /> : null}
      </ScrollView>
      {props.notice ? <Snackbar text={props.notice} withTabBar /> : null}
    </View>
  );
}

function PlantdexView({ plantdex, sets, onFilter, onOpenSpecies, onScan }: CollectionScreenProps) {
  if (!plantdex) return null;
  if (plantdex.counts.all === 0) {
    return (
      <>
        <EmptyState text={collectionCopy.emptyPlantdex} />
        {/* The frame pulls the button 8 pt closer to the sentence than the page's 18 pt rhythm. */}
        <View style={styles.pulled}>
          <Button label={collectionCopy.scanPlant} onPress={onScan} />
        </View>
      </>
    );
  }
  const { counts, filter } = plantdex;
  const tiles = plantdexTiles(plantdex.entries, sets, filter);
  const progress = sets.find((s) => s.found < s.total) ?? sets[0];
  const rows = chunk(tiles, 2);
  return (
    <>
      <View style={styles.filters}>
        {(
          [
            ['all', collectionCopy.filterAll, counts.all],
            ['houseplant', collectionCopy.filterHouseplants, counts.houseplants],
            ['wild', collectionCopy.filterWild, counts.wild],
          ] as const
        ).map(([value, label, count]) => (
          <FilterPill
            key={value}
            label={filterPillLabel(label, count)}
            selected={filter === value}
            onPress={() => onFilter(value)}
          />
        ))}
      </View>
      {progress ? <SetProgress set={progress} /> : null}
      <View style={styles.grid}>
        {rows.map((row) => (
          <View key={row[0]!.key} style={styles.gridRow}>
            {row.map((t) => (
              <View key={t.key} style={styles.cell}>
                <PlantdexTile
                  species={t.species}
                  found={t.found}
                  setName={t.setName}
                  photoUrl={t.photoUrl}
                  onPress={t.species ? () => onOpenSpecies(t.species!.id) : undefined}
                />
              </View>
            ))}
            {row.length === 1 ? <View style={styles.cell} /> : null}
          </View>
        ))}
      </View>
    </>
  );
}

const RING = 1.5;

/** A filter pill (2f): 36 pt tall, with 4 pt of touch slop above and below to reach 44. */
function FilterPill({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={onPress}
      style={[
        styles.pill,
        selected
          ? { backgroundColor: c.primaryTint, borderColor: c.primary }
          : { borderColor: c.border },
      ]}
    >
      <AppText variant="caption" color={selected ? 'primary' : 'textPrimary'}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** "Irish hedgerow 4 of 8" over one segment per species in the set (2f). */
function SetProgress({ set }: { set: CollectionSet }) {
  const { c } = useTheme();
  return (
    <Card padding={14} gap={8}>
      <View style={styles.progressTitle}>
        <AppText variant="bodyStrong">{set.name}</AppText>
        <AppText variant="caption" color="textSecondary">
          {setProgressValue(set.found, set.total)}
        </AppText>
      </View>
      <View style={styles.segments}>
        {Array.from({ length: set.total }, (_, i) => (
          <View
            key={i}
            style={[styles.segment, { backgroundColor: i < set.found ? c.primary : c.primaryTint }]}
          />
        ))}
      </View>
    </Card>
  );
}

const chunk = <T,>(list: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, (i + 1) * size),
  );

function SetsView({ sets }: { sets: CollectionSet[] }) {
  const first = sets[0];
  const rows: Row[] = sets.map((s) => ({
    key: s.id,
    title: s.name,
    subtitle: s.preview,
    right: setProgressValue(s.found, s.total),
  }));
  return (
    <>
      <RowsCard rows={rows} />
      {first ? (
        <>
          <AppText variant="heading" accessibilityRole="header" style={styles.heading}>
            {first.name}
          </AppText>
          <View style={styles.grid}>
            {chunk(first.tiles, 3).map((row, r) => (
              <View key={r} style={styles.gridRow}>
                {row.map((t, i) => (
                  <View key={i} style={styles.cell}>
                    <SetTile species={t.found ? t.species : null} />
                  </View>
                ))}
                {Array.from({ length: 3 - row.length }, (_, i) => (
                  <View key={`pad-${i}`} style={styles.cell} />
                ))}
              </View>
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

/** One species of a set (4ak): its initial when found, a question mark when not. */
function SetTile({ species }: { species: SpeciesRef | null }) {
  const { c } = useTheme();
  const found = species != null;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={species?.commonName ?? collectionCopy.notFoundYet}
      style={[
        styles.setTile,
        found ? { backgroundColor: c.primaryTint } : { backgroundColor: c.background },
      ]}
    >
      {found ? null : (
        <View pointerEvents="none" style={[styles.setRing, { borderColor: c.border }]} />
      )}
      <View style={styles.setGlyph}>
        <AppText
          variant="title"
          color="textSecondary"
          style={[styles.initial, { opacity: found ? 0.6 : 1 }]}
        >
          {found ? species.commonName.charAt(0).toUpperCase() : '?'}
        </AppText>
      </View>
      <AppText variant="caption" style={styles.setName}>
        {species?.commonName ?? collectionCopy.notFoundYet}
      </AppText>
    </View>
  );
}

const placeLabel = (find: FindListItem) =>
  placeTypeOptions.find((o) => o.value === find.placeType)?.label ?? '';

/** The finds as rows (4am, 4an). A sensitive species says its location is private. */
function findRows(finds: FindListItem[]): Row[] {
  return finds.map((f) => ({
    key: f.observationId,
    title: f.species.commonName,
    subtitle: `${placeLabel(f)} · ${shortDate(f.foundOn)}`,
    right: f.species.sensitive ? collectionCopy.locationPrivate : undefined,
  }));
}

function MapSegment({ finds, locationGranted, onTurnOnLocation }: CollectionScreenProps) {
  if (!locationGranted) {
    return (
      <>
        <Note text={collectionCopy.locationOff} />
        {finds.length > 0 ? <RowsCard rows={findRows(finds)} /> : null}
        <View style={styles.pulled}>
          <Button
            label={collectionCopy.turnOnLocation}
            variant="secondary"
            onPress={onTurnOnLocation}
          />
        </View>
      </>
    );
  }
  return (
    <>
      <FindsMap finds={finds} height={340} />
      <AppText variant="sub" color="textSecondary">
        {collectionCopy.mapSub}
      </AppText>
      {finds.length > 0 ? (
        <RowsCard rows={findRows(finds)} />
      ) : (
        <EmptyState text={collectionCopy.noFindsYet} />
      )}
    </>
  );
}

function BadgesView({ badges, onShareBadge }: CollectionScreenProps) {
  const earned = badges.filter((b) => b.earned);
  const latest = earned.at(-1);
  const rows: Row[] = badges.map((b) => ({
    key: b.id,
    title: b.name,
    subtitle: b.description,
    right: b.earned
      ? collectionCopy.earned
      : b.progress
        ? setProgressValue(b.progress.current, b.progress.target)
        : collectionCopy.locked,
    rightColor: b.earned ? 'primary' : 'textSecondary',
  }));
  return (
    <>
      {earned.length === 0 ? <EmptyState text={collectionCopy.emptyBadges} /> : null}
      <RowsCard rows={rows} />
      {latest ? (
        <View style={styles.pulled}>
          <Button
            label={collectionCopy.shareBadge}
            variant="secondary"
            onPress={() => onShareBadge(latest)}
          />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16 },
  // The frame pulls a button 8 pt closer to what is above it than the page's rhythm.
  pulled: { marginTop: -8 },
  filters: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pill: {
    height: 36,
    paddingHorizontal: 14 - RING,
    borderRadius: radius.pill,
    borderWidth: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  grid: { gap: 8 },
  gridRow: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1 },
  heading: { marginBottom: -6 },
  setTile: { borderRadius: radius.tile, overflow: 'hidden' },
  setRing: { ...StyleSheet.absoluteFill, borderWidth: RING, borderRadius: radius.tile },
  setGlyph: { height: 84, alignItems: 'center', justifyContent: 'center' },
  initial: { lineHeight: 28 },
  setName: { paddingTop: 6, paddingHorizontal: 8, paddingBottom: 8 },
});
