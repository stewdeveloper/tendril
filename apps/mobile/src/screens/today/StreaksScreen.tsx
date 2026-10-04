import {
  checkInOn,
  freezesHeldShort,
  freezeUsed,
  streakBroken,
  todayCopy,
  weeksLabel,
  type StreakSummary,
} from '@tendril/core';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  BackBar,
  Button,
  Note,
  RowsCard,
  StreakCalendar,
  StreakCounter,
  type Row,
} from '../../components';
import { useInsets } from '../../components/useInsets';
import { AppText, useTheme } from '../../theme';

export interface StreaksScreenProps {
  streak: StreakSummary;
  /** Names the plant to check in on when the streak is broken (4h). */
  checkInNickname?: string;
  onBack: () => void;
  onInvite: () => void;
  /** Starts a check-in on the first plant that is due. */
  onCheckInFirst: () => void;
  /**
   * Turns winter mode on or off. Left out in 1B: there is no API for it yet, so the row reads
   * "Off" and does not respond (Phase 5 adds it).
   */
  onToggleWinter?: (on: boolean) => void;
}

/**
 * Streaks (4f, 4g, 4h): the care streak, its calendar, and what else keeps it going. A freeze that
 * saved the day gets a calm note; a broken streak gets the plain facts and a way to start again,
 * with no blame and no red.
 */
export function StreaksScreen({
  streak,
  checkInNickname,
  onBack,
  onInvite,
  onCheckInFirst,
  onToggleWinter,
}: StreaksScreenProps) {
  const { c } = useTheme();
  const insets = useInsets();
  const broken = streak.careState === 'broken';
  const frozen = streak.careState === 'freeze_used';

  const freezes: Row = {
    key: 'freezes',
    title: todayCopy.freezesRow,
    subtitle: streak.freezesHeld === 0 ? todayCopy.freezesRowLineSpent : todayCopy.freezesRowLine,
    right: freezesHeldShort(streak.freezesHeld),
    onPress: onInvite,
  };
  const rows: Row[] = frozen
    ? [freezes]
    : [
        {
          key: 'discovery',
          title: todayCopy.discoveryRow,
          subtitle: todayCopy.discoveryRowLine,
          right: weeksLabel(streak.discoveryWeeks),
          rightColor: 'streak',
        },
        { ...freezes, onPress: undefined },
        {
          key: 'winter',
          title: todayCopy.winterRow,
          subtitle: todayCopy.winterRowLine,
          right: streak.winterMode ? 'On' : 'Off',
          onPress:
            onToggleWinter && streak.winterModeAvailable
              ? () => onToggleWinter(!streak.winterMode)
              : undefined,
        },
      ];

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top, paddingBottom: Math.max(42, insets.bottom + 8) },
        ]}
      >
        <View style={styles.back}>
          <BackBar label={todayCopy.today} onPress={onBack} />
        </View>
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          {todayCopy.streaksTitle}
        </AppText>
        <StreakCounter
          size="stat"
          days={streak.careDays}
          label={todayCopy.careStreakLabel}
          state={broken ? 'broken' : streak.winterMode ? 'winter' : 'active'}
        />
        <StreakCalendar marks={streak.calendar} />
        {frozen ? <Note text={freezeUsed(streak.careDays)} /> : null}
        {broken && streak.lastBrokenLength != null ? (
          <AppText variant="body">{streakBroken(streak.lastBrokenLength)}</AppText>
        ) : null}
        {broken ? null : <RowsCard rows={rows} />}
        <View style={styles.spacer} />
        {broken ? (
          <Button
            label={checkInNickname ? checkInOn(checkInNickname) : todayCopy.checkIn}
            onPress={onCheckInFirst}
          />
        ) : frozen ? null : (
          <Button label={todayCopy.invite} variant="secondary" onPress={onInvite} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 16, gap: 18 },
  // The frame tucks the back row and the title closer to what follows than the page rhythm.
  back: { marginBottom: -6 },
  title: { marginBottom: -10 },
  spacer: { flex: 1 },
});
