import { plantsCopy, type IsoDate, type PlantSummary } from '@tendril/core';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  EmptyState,
  PlantCard,
  RowsCard,
  ScreenHeader,
  SegmentedControl,
} from '../../components';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';

export interface MyPlantsScreenProps {
  households: { id: string; name: string }[];
  householdId: string;
  plants: PlantSummary[];
  /** The calendar date "tomorrow" is counted from. */
  today: IsoDate;
  avatarLetter: string;
  onSwitch: (householdId: string) => void;
  onOpen: (plantId: string) => void;
  onAdd: () => void;
  onScan: () => void;
  onScanLabel: () => void;
  onAvatar: () => void;
}

interface Group {
  room: string | null;
  plants: PlantSummary[];
}

/**
 * The rooms in the order they first appear, each with its plants. Plants with no room form the
 * last group, which is drawn without a heading.
 */
export function groupByRoom(plants: PlantSummary[]): Group[] {
  const rooms = new Map<string, PlantSummary[]>();
  const noRoom: PlantSummary[] = [];
  for (const plant of plants) {
    const room = plant.room?.trim();
    if (!room) noRoom.push(plant);
    else rooms.set(room, [...(rooms.get(room) ?? []), plant]);
  }
  const groups: Group[] = [...rooms].map(([room, list]) => ({ room, plants: list }));
  if (noRoom.length > 0) groups.push({ room: null, plants: noRoom });
  return groups;
}

/**
 * My Plants (4i, 4j): the household's plants by room, with a switch between households when there
 * is more than one. With no plants it offers the two ways to add one. Props only.
 */
export function MyPlantsScreen(props: MyPlantsScreenProps) {
  const { households, householdId, plants, today } = props;
  const { c } = useTheme();
  const insets = useInsets();
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: 24 }]}
      >
        <ScreenHeader
          title={plantsCopy.myPlants}
          avatarLetter={props.avatarLetter}
          onAvatarPress={props.onAvatar}
        />
        {households.length > 1 ? (
          <SegmentedControl
            options={households.map((h) => ({ value: h.id, label: h.name }))}
            value={householdId}
            onChange={props.onSwitch}
          />
        ) : null}
        {plants.length === 0 ? (
          <>
            <EmptyState text={plantsCopy.emptyLine} />
            {/* The frame pulls the buttons 8 pt closer to the sentence than the page's rhythm. */}
            <View style={styles.actions}>
              <Button label={plantsCopy.scanPlant} onPress={props.onScan} />
              <Button
                label={plantsCopy.scanPlantLabel}
                variant="secondary"
                onPress={props.onScanLabel}
              />
            </View>
          </>
        ) : (
          <>
            {groupByRoom(plants).map((group) => (
              <View key={group.room ?? '(none)'} style={styles.group}>
                {group.room ? (
                  <AppText variant="heading" accessibilityRole="header" style={styles.heading}>
                    {group.room}
                  </AppText>
                ) : null}
                <RowsCard>
                  {group.plants.map((plant) => (
                    <PlantCard
                      key={plant.id}
                      plant={plant}
                      variant="row"
                      today={today}
                      onPress={() => props.onOpen(plant.id)}
                    />
                  ))}
                </RowsCard>
              </View>
            ))}
            <View style={styles.spacer} />
            <View style={styles.add}>
              <Button label={plantsCopy.addPlant} onPress={props.onAdd} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, gap: 18 },
  // Each room's heading hugs its card, as in the frame; the groups keep the page's 18 pt rhythm.
  group: { gap: 18 },
  heading: { marginBottom: -6 },
  spacer: { flex: 1 },
  add: { marginTop: -8 },
  actions: { gap: 10, marginTop: -8 },
});
