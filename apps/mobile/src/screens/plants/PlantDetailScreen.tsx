import {
  colors,
  diedNote,
  givenAwayNote,
  plantsCopy,
  radius,
  type CarePlanLine,
  type IsoDate,
  type Pet,
  type PlantDetail,
} from '@tendril/core';
import Droplet from 'lucide-react-native/icons/droplet';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import Sprout from 'lucide-react-native/icons/sprout';
import Sun from 'lucide-react-native/icons/sun';
import Thermometer from 'lucide-react-native/icons/thermometer';
import type { ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  ConfidenceLabel,
  HeroHeader,
  Note,
  PetCheckCard,
  RowsCard,
  type Row,
} from '../../components';
import { dayMonth } from '../../components/dates';
import { nextCheckText } from '../../components/PlantCard';
import type { IconProps } from '../../components/icons';
import { AppText, useTheme } from '../../theme';

export interface PlantDetailScreenProps {
  plant: PlantDetail;
  pets: Pet[];
  /** The calendar date "tomorrow" is counted from. */
  today: IsoDate;
  onBack: () => void;
  /** Opens the menu of what can change about the plant: died, given away. */
  onMore: () => void;
  onCheckIn: () => void;
  onPetAte: (petId: string) => void;
  onSourcePress?: (url: string) => void;
  /**
   * Starts a diagnosis for this plant. Frame 2d has no control for it, so the screen draws none;
   * the diagnosis flow (Task 4) decides where it is offered from.
   */
  onDiagnose?: () => void;
}

const ICONS: Record<CarePlanLine['icon'], ComponentType<IconProps>> = {
  sprout: Sprout,
  sun: Sun,
  droplet: Droplet,
  thermometer: Thermometer,
};

// The hero is 300 pt on a live plant (2d) and the standard 236 pt once it is closed (4k, 4l); the
// content sheet overlaps it by 24 pt.
const LIVE_HERO = 300;
const CLOSED_HERO = 236;
const SHEET_OVERLAP = 24;
// White over the photo in both schemes, like the back circle.
const ON_PHOTO = colors.light.surface;

/** The value in the next-check card: "Today" when a check is due, else when it is next. */
function nextCheckValue(plant: PlantDetail, today: IsoDate): string {
  switch (plant.careState) {
    case 'due':
    case 'overdue':
      return plantsCopy.checkInToday;
    case 'paused':
      return plant.pausedNote ?? 'Paused';
    default:
      return nextCheckText(plant, today).text;
  }
}

/**
 * Plant detail (2d, and 4k and 4l once the plant has died or been given away). A live plant shows
 * its next check, care plan, pet check and history; a closed one keeps only a calm note and its
 * history. Props only: the route wires the menu, the check-in and the emergency screen.
 */
export function PlantDetailScreen(props: PlantDetailScreenProps) {
  const { plant } = props;
  const { c } = useTheme();
  const alive = plant.status === 'alive';
  const height = alive ? LIVE_HERO : CLOSED_HERO;
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <HeroHeader
        photoUri={plant.photoUrl}
        photoLabel={`Your photo: ${plant.nickname}`}
        opacity={alive ? 1 : 0.55}
        height={height}
        onBack={props.onBack}
        right={
          alive ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More"
              onPress={props.onMore}
              style={[styles.circle, { backgroundColor: c.photoButton }]}
            >
              <Ellipsis size={24} color={ON_PHOTO} strokeWidth={2} />
            </Pressable>
          ) : undefined
        }
      />
      <View style={[styles.sheet, { top: height - SHEET_OVERLAP, backgroundColor: c.background }]}>
        <ScrollView
          contentContainerStyle={alive ? styles.liveContent : styles.closedContent}
          showsVerticalScrollIndicator={false}
        >
          {alive ? <Live {...props} /> : <Closed {...props} />}
        </ScrollView>
      </View>
    </View>
  );
}

function Live({ plant, pets, today, onCheckIn, onPetAte, onSourcePress }: PlantDetailScreenProps) {
  const { c } = useTheme();
  const value = nextCheckValue(plant, today);
  const due = plant.careState === 'due' || plant.careState === 'overdue';
  const care: Row[] = plant.carePlan.map((line, i) => ({
    key: `care-${i}`,
    title: line.title,
    subtitle: line.detail,
    icon: ICONS[line.icon],
  }));
  return (
    <>
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          {plant.nickname}
        </AppText>
        <AppText variant="sub" color="textSecondary" style={styles.names}>
          {`${plant.species.commonName} · `}
          <AppText variant="sci" color="textSecondary">
            {plant.species.scientificName}
          </AppText>
        </AppText>
        <View style={styles.pills}>
          {plant.room ? (
            <View style={[styles.room, { borderColor: c.border }]}>
              <AppText variant="caption" color="textSecondary">
                {plant.room}
              </AppText>
            </View>
          ) : null}
          {plant.matchProbability != null ? (
            <ConfidenceLabel probability={plant.matchProbability} />
          ) : null}
        </View>
      </View>
      {value ? (
        <View style={[styles.next, { backgroundColor: c.primaryTint }]}>
          <View style={styles.nextText}>
            <AppText variant="caption" color="primary">
              {plantsCopy.nextSoilCheck}
            </AppText>
            <AppText variant="heading">{value}</AppText>
          </View>
          {due ? (
            <View style={styles.checkIn}>
              <Button label="Check in" compact onPress={onCheckIn} />
            </View>
          ) : null}
        </View>
      ) : null}
      {care.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">
            {plantsCopy.carePlan}
          </AppText>
          <RowsCard inset rows={care} />
        </View>
      ) : null}
      <PetCheckCard
        variant="compact"
        pets={pets}
        toxicity={plant.toxicity}
        matchProbability={null}
        speciesName={plant.species.commonName}
        onPetAte={onPetAte}
        onSourcePress={onSourcePress}
      />
      {plant.history.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">
            {plantsCopy.history}
          </AppText>
          <View>
            {plant.history.map((entry, i) => (
              <View
                key={`${entry.on}-${i}`}
                style={[
                  styles.historyRow,
                  {
                    borderBottomColor: c.divider,
                    borderBottomWidth: i === plant.history.length - 1 ? 0 : 1,
                  },
                ]}
              >
                <AppText variant="body" style={styles.historyLabel}>
                  {entry.label}
                </AppText>
                <AppText variant="sub" color="textSecondary" style={styles.historyDate}>
                  {dayMonth(entry.on) ?? entry.on}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
}

function Closed({ plant, today }: PlantDetailScreenProps) {
  const on = plant.statusOn ?? today;
  const note = plant.status === 'dead' ? diedNote(on, plant.deathCause) : givenAwayNote(on);
  const history: Row[] = plant.history.map((entry, i) => ({
    key: `history-${i}`,
    title: entry.label,
    right: dayMonth(entry.on) ?? entry.on,
  }));
  return (
    <>
      <AppText variant="title" accessibilityRole="header" style={styles.closedTitle}>
        {plant.nickname}
      </AppText>
      <AppText variant="sci" color="textSecondary">
        {`${plant.species.commonName} · ${plant.species.scientificName}`}
      </AppText>
      <Note text={note} />
      {history.length > 0 ? (
        <>
          <AppText variant="heading" accessibilityRole="header" style={styles.closedHeading}>
            {plantsCopy.history}
          </AppText>
          <RowsCard rows={history} />
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    overflow: 'hidden',
    zIndex: 4,
  },
  liveContent: { paddingTop: 20, paddingHorizontal: 16, paddingBottom: 24, gap: 24 },
  closedContent: { paddingTop: 20, paddingHorizontal: 16, paddingBottom: 42, gap: 18 },
  closedTitle: { marginBottom: -10 },
  closedHeading: { marginBottom: -6 },
  header: { gap: 4 },
  names: { lineHeight: 20 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
  room: {
    minHeight: 28,
    paddingHorizontal: 10 - 1.5,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  next: {
    borderRadius: radius.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nextText: { flex: 1 },
  // The frame's button is 115 pt wide: the label plus 22 pt at each side.
  checkIn: { minWidth: 115 },
  section: { gap: 12 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  historyLabel: { flex: 1 },
  historyDate: { lineHeight: 22 },
});
