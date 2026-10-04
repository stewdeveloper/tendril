import {
  aoife,
  copy,
  freezeUsed,
  streakLastDay,
  type IsoDate,
  type PlantSummary,
  type QuotaState,
  type Severity,
} from '@tendril/core';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  CheckInSheet,
  ConfidenceLabel,
  EmptyState,
  FindMarker,
  LeagueRow,
  PermissionPrimer,
  PetCheckCard,
  PlanCard,
  PlantCard,
  PlantdexTile,
  QuotaMeter,
  RarityBadge,
  SheetPanel,
  Snackbar,
  StreakCounter,
  TaskRow,
  VerdictChip,
} from '../components';
import { useInsets } from '../components/useInsets';
import { AppText, useTheme } from '../theme';
import { registerFrame } from './registry';

/**
 * Frames 5a to 5r: the component sheet, one page per component, every state labelled. The design
 * has no renders of these (there is no `design/frames/5*.html`); the states and rules come from the
 * Components table of the UX brief, copied into docs/design-notes/component-sheet.md. A page that
 * cannot fit its states into one 393x852 frame continues on `<id>-2`.
 */

const noop = () => {};
/** The day the design frames show; the pages pass it so "yesterday" reads the same on any day. */
const TODAY: IsoDate = '2026-10-03';

interface PageProps {
  name: string;
  rule: string;
  children: ReactNode;
  /** The page carries the rest of the previous one: a short label instead of the rule. */
  continued?: boolean;
  /** A full-bleed page (the sheets) takes no side padding. */
  bleed?: boolean;
  /** No heading at all: the page is one component that fills it (the full-height sheet). */
  bare?: boolean;
}

/** The sheet's page: the component name in Inter 600 20, its rule in Inter 400 15, then the states. */
function Page({ name, rule, children, continued = false, bleed = false, bare = false }: PageProps) {
  const { c } = useTheme();
  const insets = useInsets();
  return (
    <ScrollView
      style={[styles.page, { backgroundColor: c.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 },
        bleed && styles.bleed,
      ]}
    >
      {bare ? null : (
        <View style={[styles.header, bleed && styles.inset]}>
          <AppText variant="heading" accessibilityRole="header">
            {continued ? `${name} (continued)` : name}
          </AppText>
          {continued ? null : (
            <AppText variant="sub" color="textSecondary">
              {rule}
            </AppText>
          )}
        </View>
      )}
      {children}
    </ScrollView>
  );
}

/** A state: its label in a caption, then the component. */
function State({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.state}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      {children}
    </View>
  );
}

/** Where the component sheet's rows and cards sit: the white card the frames put them in. */
function RowCard({ children, side = 0 }: { children: ReactNode; side?: number }) {
  return (
    <Card padding={0} style={[styles.rowCard, { paddingHorizontal: side }]}>
      {children}
    </Card>
  );
}

const RULES = {
  '5a': 'Word first, then the percentage; never a bare number.',
  '5b': 'One row per household pet. Verdict chip, one plain line and the source on every row.',
  '5c': 'Icon, word and colour together, read as "Cats: Mild".',
  '5d': 'Leaf count plus word. Sensitive species never appear on public rarity boards.',
  '5e': 'Photo, nickname, species in italics, next check.',
  '5f': 'Tap opens the check-in sheet. Finishing a watering task gets no celebration.',
  '5g': 'One question, two large answers, optional photo and leaf chips.',
  '5h': 'Reads "7 of 10 left this month". The reset date shows on tap.',
  '5i': 'Flame icon plus number in the streak colour. A broken streak turns grey, never red.',
  '5j': 'Your row is on the primary tint and says "You". Rank, handle, points.',
  '5k': 'Found shows photo, name and rarity. Missing shows a silhouette and a question mark.',
  '5l': 'Only the owner sees exact pins. Anything shared shows an area at most.',
  '5m': 'The billed amount is the largest text. Any tag, such as "Best value", is smaller than the price.',
  '5n': 'Says why and what Tendril never does, then the system prompt. "Not now" is always there.',
  '5o': 'At least 44 by 44 pt on iOS and 48 by 48 dp on Android.',
  '5p': 'Grab handle, title and a close button.',
  '5q': 'Tendril line drawing, one sentence, one action.',
  '5r': 'One plain sentence, with Undo where it can apply.',
} as const;

function frame(id: string, title: string, node: () => ReactNode): void {
  registerFrame({ id, title: `Component sheet · ${title}`, render: () => <>{node()}</> });
}

// 5a Confidence label

frame('5a', 'Confidence label', () => (
  <Page name="Confidence label" rule={RULES['5a']}>
    <State label="Very likely, 80% and over">
      <View style={styles.start}>
        <ConfidenceLabel probability={0.94} />
      </View>
    </State>
    <State label="Likely, 50 to 79%">
      <View style={styles.start}>
        <ConfidenceLabel probability={0.71} />
      </View>
    </State>
    <State label="Not sure, under 50%">
      <View style={styles.start}>
        <ConfidenceLabel probability={0.41} />
      </View>
    </State>
  </Page>
));

// 5b Pet check card

const pets = aoife.household.pets;

frame('5b', 'Pet check card', () => (
  <Page name="Pet check card" rule={RULES['5b']}>
    <State label="Very likely match">
      <PetCheckCard
        pets={pets}
        toxicity={aoife.speciesToxicity['peace-lily']!}
        matchProbability={0.94}
        speciesName="Peace lily"
        onPetAte={noop}
      />
    </State>
  </Page>
));

frame('5b-2', 'Pet check card', () => (
  <Page name="Pet check card" rule={RULES['5b']} continued>
    <State label="Likely match: Easter lily, cats severe, with the note">
      <PetCheckCard
        pets={pets}
        toxicity={aoife.speciesToxicity['easter-lily']!}
        matchProbability={0.71}
        speciesName="Easter lily"
        onPetAte={noop}
      />
    </State>
  </Page>
));

// 5c Verdict chip

const VERDICTS: { severity: Severity; label: string }[] = [
  { severity: 'unknown', label: 'Unknown' },
  { severity: 'none', label: 'No known toxicity' },
  { severity: 'mild', label: 'Mild' },
  { severity: 'moderate', label: 'Moderate' },
  { severity: 'severe', label: 'Severe' },
];

frame('5c', 'Pet verdict chip', () => (
  <Page name="Pet verdict chip" rule={RULES['5c']}>
    {VERDICTS.map((v) => (
      <State key={v.severity} label={v.label}>
        <View style={styles.start}>
          <VerdictChip animal="cat" severity={v.severity} />
        </View>
      </State>
    ))}
  </Page>
));

// 5d Rarity badge

frame('5d', 'Rarity badge', () => (
  <Page name="Rarity badge" rule={RULES['5d']}>
    <State label="Common, one leaf">
      <View style={styles.start}>
        <RarityBadge tier="common" />
      </View>
    </State>
    <State label="Uncommon, two leaves">
      <View style={styles.start}>
        <RarityBadge tier="uncommon" />
      </View>
    </State>
    <State label="Rare, three leaves">
      <View style={styles.start}>
        <RarityBadge tier="rare" />
      </View>
    </State>
    <State label="Legendary, a flower">
      <View style={styles.start}>
        <RarityBadge tier="legendary" />
      </View>
    </State>
  </Page>
));

// 5e Plant card

const [monty, spidey, lily] = aoife.plants as [PlantSummary, PlantSummary, PlantSummary];
const paused: PlantSummary = {
  ...lily,
  id: 'paused',
  nickname: 'Fern',
  species: aoife.plantDetails['fern-dead']!.species,
  careState: 'paused',
  pausedNote: '1 of 2 dry checks',
};
const dead = aoife.plantDetails['fern-dead']!;
const givenAway = aoife.plantDetails['lily-given-away']!;

frame('5e', 'Plant card', () => (
  <Page name="Plant card" rule={RULES['5e']}>
    <State label="Check due">
      <PlantCard plant={monty} today={TODAY} onPress={noop} />
    </State>
    <State label="Overdue">
      <PlantCard plant={spidey} today={TODAY} onPress={noop} />
    </State>
    <State label="All good">
      <PlantCard plant={lily} today={TODAY} onPress={noop} />
    </State>
    <State label="Paused by a diagnosis">
      <PlantCard plant={paused} today={TODAY} onPress={noop} />
    </State>
    <State label="Dead, kept in history">
      <PlantCard plant={dead} today={TODAY} onPress={noop} />
    </State>
    <State label="Given away, kept in history">
      <PlantCard plant={givenAway} today={TODAY} onPress={noop} />
    </State>
  </Page>
));

// 5f Task row

const [dueTask, overdueTask, doneTask] = aoife.today.tasks as [
  (typeof aoife.today.tasks)[number],
  (typeof aoife.today.tasks)[number],
  (typeof aoife.today.tasks)[number],
];

frame('5f', 'Task row', () => (
  <Page name="Task row" rule={RULES['5f']}>
    <State label="Due, with the Check in action">
      <RowCard side={14}>
        <TaskRow
          task={dueTask}
          today={TODAY}
          onPress={noop}
          primaryAction={{ label: 'Check in', onPress: noop }}
          last
        />
      </RowCard>
    </State>
    <State label="Overdue">
      <RowCard side={14}>
        <TaskRow task={overdueTask} today={TODAY} onPress={noop} last />
      </RowCard>
    </State>
    <State label="Done: struck through, a check, no celebration">
      <RowCard side={14}>
        <TaskRow task={doneTask} today={TODAY} onPress={noop} last />
      </RowCard>
    </State>
  </Page>
));

// 5g Check-in sheet

const sheetProps = {
  visible: true,
  plantNickname: 'Monty',
  nextCheckWeekday: 'Friday',
  onAnswer: noop,
  onAddPhoto: noop,
  onClose: noop,
  onDone: noop,
  presentation: 'inline',
} as const;

frame('5g', 'Check-in sheet', () => (
  <Page name="Check-in sheet" rule={RULES['5g']} bleed>
    <View style={styles.inset}>
      <State label="Unanswered">
        <View />
      </State>
    </View>
    <CheckInSheet {...sheetProps} state="unanswered" />
  </Page>
));

frame('5g-2', 'Check-in sheet', () => (
  <Page name="Check-in sheet" rule={RULES['5g']} continued bleed>
    <View style={styles.inset}>
      <State label="Answered No: says when the next check is">
        <View />
      </State>
    </View>
    <CheckInSheet {...sheetProps} state="answered_no" streakDays={12} />
    <View style={styles.inset}>
      <State label="Answered Yes: a watering task is added, no celebration">
        <View />
      </State>
    </View>
    <CheckInSheet {...sheetProps} state="answered_yes" />
  </Page>
));

frame('5g-3', 'Check-in sheet', () => (
  <Page name="Check-in sheet" rule={RULES['5g']} continued bleed>
    <View style={styles.inset}>
      <State label="Saved offline: kept on the device, syncs later">
        <View />
      </State>
    </View>
    <CheckInSheet {...sheetProps} state="saved_offline" />
  </Page>
));

// 5h Quota meter

const quota = (used: number, limit: number, plan: QuotaState['plan']): QuotaState => ({
  kind: 'identification',
  used,
  limit,
  resetsOn: '2026-11-01',
  plan,
});

frame('5h', 'Quota meter', () => (
  <Page name="Quota meter" rule={RULES['5h']}>
    <State label="Free, 7 of 10">
      <QuotaMeter quota={quota(3, 10, 'free')} />
    </State>
    <State label="Premium, 52 of 60">
      <QuotaMeter quota={quota(8, 60, 'premium')} />
    </State>
    <State label="One left, 1 of 10">
      <QuotaMeter quota={quota(9, 10, 'free')} />
    </State>
    <State label="Used up, 0 of 10, resets 1 November">
      <QuotaMeter quota={quota(10, 10, 'free')} />
    </State>
    <State label="As the Today card">
      <QuotaMeter quota={quota(3, 10, 'free')} variant="card" />
    </State>
    <State label="As the camera pill">
      <View style={styles.start}>
        <QuotaMeter quota={quota(3, 10, 'free')} variant="pill" />
      </View>
    </State>
  </Page>
));

// 5i Streak counter

frame('5i', 'Streak counter', () => (
  <Page name="Streak counter" rule={RULES['5i']}>
    <State label="Active">
      <StreakCounter days={12} label="day care streak" state="active" />
    </State>
    <State label="Last day to keep it">
      <StreakCounter days={12} label="day care streak" state="last_day" />
      <AppText variant="caption" color="textSecondary">
        {streakLastDay(12)}
      </AppText>
    </State>
    <State label="Freeze used">
      <StreakCounter days={12} label="day care streak" state="freeze_used" />
      <AppText variant="caption" color="textSecondary">
        {freezeUsed(12)}
      </AppText>
    </State>
    <State label="Winter mode, 3 weeks">
      <StreakCounter days={3} label="week discovery streak" state="winter" />
    </State>
    <State label="Broken: grey, never red">
      <StreakCounter days={0} label="day care streak" state="broken" />
    </State>
  </Page>
));

// 5j League row

frame('5j', 'League row', () => (
  <Page name="League row" rule={RULES['5j']}>
    <State label="You">
      <RowCard>
        <LeagueRow
          row={{ rank: 4, handle: 'aoifegrows', points: 340, isYou: true, pending: false }}
        />
      </RowCard>
    </State>
    <State label="Others">
      <RowCard>
        <LeagueRow
          row={{ rank: 1, handle: 'hedgehopper', points: 520, isYou: false, pending: false }}
        />
        <LeagueRow
          row={{ rank: 2, handle: 'fernandfox', points: 410, isYou: false, pending: false }}
        />
      </RowCard>
    </State>
    <State label="Points pending">
      <RowCard>
        <LeagueRow
          row={{ rank: 3, handle: 'mossbank', points: 355, isYou: false, pending: true }}
        />
      </RowCard>
    </State>
  </Page>
));

// 5k Plantdex tile

const foxglove = aoife.species['foxglove']!;
const orchid = aoife.species['early-purple-orchid']!;

frame('5k', 'Plantdex tile', () => (
  <Page name="Plantdex tile" rule={RULES['5k']}>
    <View style={styles.grid}>
      <View style={styles.cell}>
        <State label="Found">
          <PlantdexTile species={foxglove} found />
        </State>
      </View>
      <View style={styles.cell}>
        <State label="Missing">
          <PlantdexTile species={null} found={false} setName="Irish hedgerow" />
        </State>
      </View>
    </View>
    <View style={styles.grid}>
      <View style={styles.cell}>
        <State label="Sensitive">
          <PlantdexTile species={orchid} found />
        </State>
      </View>
      <View style={styles.cell} />
    </View>
  </Page>
));

// 5l Find marker

/** A stand-in for the map: the marker over a quiet tinted block. */
function MapBox({ label, kind }: { label: string; kind: 'exact' | 'area' | 'hidden' }) {
  const { c } = useTheme();
  return (
    <State label={label}>
      <View style={[styles.map, { backgroundColor: c.primaryTint }]}>
        <View style={styles.marker}>
          <FindMarker kind={kind} />
        </View>
      </View>
    </State>
  );
}

frame('5l', 'Find marker', () => (
  <Page name="Find marker" rule={RULES['5l']}>
    <MapBox label="Exact pin, only you see it" kind="exact" />
    <MapBox label="Shared area" kind="area" />
    <MapBox label="Hidden" kind="hidden" />
  </Page>
));

// 5m Plan card

frame('5m', 'Plan card', () => (
  <Page name="Plan card" rule={RULES['5m']}>
    <State label="Yearly, selected">
      <PlanCard
        title="Yearly"
        tag="Best value"
        subtitle="$2.08 a month, billed yearly"
        price="$24.99"
        per="a year"
        selected
        onPress={noop}
      />
    </State>
    <State label="Monthly, unselected">
      <PlanCard
        title="Monthly"
        subtitle="Billed monthly"
        price="$4.99"
        per="a month"
        selected={false}
        onPress={noop}
      />
    </State>
  </Page>
));

// 5n Permission primer

frame('5n', 'Permission primer', () => (
  <Page name="Permission primer" rule={RULES['5n']}>
    <State label="Camera">
      <PermissionPrimer kind="camera" onContinue={noop} onNotNow={noop} />
    </State>
  </Page>
));

frame('5n-2', 'Permission primer', () => (
  <Page name="Permission primer" rule={RULES['5n']} continued>
    <State label="Location">
      <PermissionPrimer kind="location" onContinue={noop} onNotNow={noop} />
    </State>
    <State label="Notifications">
      <PermissionPrimer kind="notifications" onContinue={noop} onNotNow={noop} />
    </State>
  </Page>
));

// 5o Button

frame('5o', 'Button', () => (
  <Page name="Button" rule={RULES['5o']}>
    <State label="Primary">
      <Button label="Add to my plants" onPress={noop} />
    </State>
    <State label="Secondary">
      <Button label="Add a photo" variant="secondary" onPress={noop} />
    </State>
    <State label="Text">
      <Button label="Not now" variant="text" onPress={noop} />
    </State>
    <State label="Danger">
      <Button label="Delete account" variant="danger" onPress={noop} />
    </State>
    <State label="Pressed">
      <Button label="Add to my plants" onPress={noop} previewPressed />
    </State>
    <State label="Disabled">
      <Button label="Add to my plants" onPress={noop} disabled />
    </State>
    <State label="Loading">
      <Button label="Add to my plants" onPress={noop} loading />
    </State>
  </Page>
));

// 5p Sheet

const SHEET_BODY = 'The title stays in view while a long body scrolls.';

frame('5p', 'Sheet', () => (
  <Page name="Sheet" rule={RULES['5p']} bleed>
    <View style={styles.inset}>
      <State label="Half height">
        <View />
      </State>
    </View>
    <SheetPanel title="Log a find" onClose={noop} height={426}>
      <AppText variant="sub" color="textSecondary">
        {SHEET_BODY}
      </AppText>
    </SheetPanel>
  </Page>
));

/** The panel grows to the window less the status bar's safe area and an 8 pt gap, then scrolls. */
frame('5p-2', 'Sheet', () => (
  <Page name="Sheet" rule={RULES['5p']} continued bleed bare>
    <SheetPanel title="Log a find" onClose={noop} height={Number.MAX_SAFE_INTEGER}>
      <AppText variant="caption" color="textSecondary">
        Full height, kept clear of the status bar
      </AppText>
      <AppText variant="sub" color="textSecondary">
        {SHEET_BODY}
      </AppText>
    </SheetPanel>
  </Page>
));

// 5q Empty state

frame('5q', 'Empty state', () => (
  <Page name="Empty state" rule={RULES['5q']}>
    <State label="My Plants">
      <EmptyState text="No plants yet. Scan one, or scan the label it came with.">
        <Button label="Scan a plant" onPress={noop} />
      </EmptyState>
    </State>
    <State label="Friends">
      <EmptyState text="No friends here yet. Invite someone to compare finds each week.">
        <Button label="Add friends" onPress={noop} />
      </EmptyState>
    </State>
  </Page>
));

// 5r Snackbar

/** The snackbar floats over a screen; here it sits in a strip of the page. */
function SnackStrip({ height, children }: { height: number; children: ReactNode }) {
  return <View style={[styles.strip, { height }]}>{children}</View>;
}

frame('5r', 'Snackbar', () => (
  <Page name="Snackbar" rule={RULES['5r']}>
    <State label="Saved, with Undo">
      <SnackStrip height={64}>
        <Snackbar text="Check-in saved." onUndo={noop} bottomOffset={8} />
      </SnackStrip>
    </State>
    <State label="Offline">
      <SnackStrip height={64}>
        <Snackbar text="You're offline. We'll sync when you're back." bottomOffset={8} />
      </SnackStrip>
    </State>
    <State label="Points pending">
      <SnackStrip height={88}>
        <Snackbar text={copy.pointsHeld} bottomOffset={8} />
      </SnackStrip>
    </State>
  </Page>
));

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  // A full-bleed page: the sheets span the screen, so the labels bring their own side padding.
  bleed: { paddingHorizontal: 0, gap: 10 },
  inset: { paddingHorizontal: 16 },
  header: { gap: 2 },
  state: { gap: 6 },
  start: { alignItems: 'flex-start' },
  rowCard: { overflow: 'hidden' },
  grid: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  cell: { flex: 1, minWidth: 0 },
  map: { height: 132, borderRadius: 16, overflow: 'hidden' },
  marker: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The snackbar is absolutely positioned 16 pt in from the edges of its parent, so the strip
  // spans the screen (16 pt side padding on each side) and its Snackbar lands on the margins.
  strip: { marginHorizontal: -16 },
});
