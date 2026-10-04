import type { CareTask, IsoDate } from '@tendril/core';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';
import { Button } from './Button';
import { dayMonth, daysBetween, deviceToday } from './dates';
import { DECORATIVE } from './decorative';
import { PhotoSlot } from './PhotoSlot';

export interface TaskRowProps {
  task: CareTask;
  /** Opens the check-in (or the plant when the task is done). */
  onPress: () => void;
  /** A full-width button inside the row (2e): "Check in" on the task that is due. */
  primaryAction?: { label: string; onPress: () => void };
  /** Leave off the divider under the last row of a card. */
  last?: boolean;
  /** The calendar date "yesterday" is counted from. Defaults to the device's date. */
  today?: IsoDate;
}

const PHOTO = 52;

export function taskTitle(task: CareTask): string {
  if (task.kind === 'water') return `Water ${task.plantNickname}`;
  return task.status === 'due'
    ? `Time to check ${task.plantNickname}'s soil.`
    : `Check ${task.plantNickname}'s soil`;
}

/** "Living room · due today", "Kitchen · overdue since yesterday", "Bedroom · done". */
export function taskSubtitle(task: CareTask, today: IsoDate): string {
  let status: string;
  if (task.status === 'done') status = 'done';
  else if (task.status === 'due') status = 'due today';
  else {
    const diff = daysBetween(task.dueOn, today);
    const since = diff === 1 ? 'yesterday' : diff != null && diff > 1 ? dayMonth(task.dueOn) : null;
    status = since ? `overdue since ${since}` : 'overdue';
  }
  return [task.room, status].filter(Boolean).join(' · ');
}

/**
 * A care task in the Today list (2e). Sits inside a white card with 14 pt side padding; the rows
 * share its hairline dividers. A finished task is struck through with a check and its photo
 * faded, and is not celebrated.
 */
export function TaskRow({ task, onPress, primaryAction, last = false, today }: TaskRowProps) {
  const { c } = useTheme();
  const done = task.status === 'done';
  const title = taskTitle(task);
  const subtitle = taskSubtitle(task, today ?? deviceToday());
  return (
    <View style={[styles.row, { borderBottomColor: c.divider, borderBottomWidth: last ? 0 : 1 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title} ${subtitle}`}
        onPress={onPress}
        style={styles.main}
      >
        <View {...DECORATIVE} style={[styles.photo, done && styles.fadedPhoto]}>
          <PhotoSlot
            uri={task.photoUrl}
            label={`Photo of ${task.plantNickname}`}
            width={PHOTO}
            height={PHOTO}
            radius={12}
            showLabel={false}
          />
        </View>
        <View style={styles.text}>
          <AppText
            variant="body"
            color={done ? 'textSecondary' : 'textPrimary'}
            style={done ? styles.struck : undefined}
          >
            {title}
          </AppText>
          <AppText variant="sub" color="textSecondary" style={styles.subtitle}>
            {subtitle}
          </AppText>
        </View>
        {done ? (
          <CircleCheck {...DECORATIVE} size={22} color={c.textSecondary} strokeWidth={2} />
        ) : primaryAction ? null : (
          <ChevronRight {...DECORATIVE} size={20} color={c.textSecondary} strokeWidth={2} />
        )}
      </Pressable>
      {primaryAction ? (
        <Button label={primaryAction.label} onPress={primaryAction.onPress} compact />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 12, paddingVertical: 14 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: PHOTO, height: PHOTO },
  fadedPhoto: { opacity: 0.6 },
  text: { flex: 1, minWidth: 0 },
  subtitle: { lineHeight: 20 },
  struck: { textDecorationLine: 'line-through' },
});
