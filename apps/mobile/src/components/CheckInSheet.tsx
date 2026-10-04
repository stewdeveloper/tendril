import {
  cameraCopy,
  checkInAnsweredNo,
  checkInQuestion,
  offlineSaved,
  radius,
  streakContinues,
  type LeafState,
} from '@tendril/core';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../theme';
import { Button } from './Button';
import { Note } from './Note';
import { OptionPills } from './OptionPills';
import { Sheet, SheetOverlay, SheetPanel } from './Sheet';

export type CheckInState = 'unanswered' | 'answered_no' | 'answered_yes' | 'saved_offline';

/**
 * How the sheet is shown. `modal` is the app's bottom sheet; `overlay` draws the scrim and panel
 * inline in the parent (the catalog frames 4c to 4e, so the device chrome stays on top); `inline`
 * is the bare panel in the flow, for the component sheet.
 */
export type CheckInPresentation = 'modal' | 'overlay' | 'inline';

interface CheckInSheetBase {
  /** Shows or hides the `modal` presentation. The other two are drawn whenever they are mounted. */
  visible: boolean;
  plantNickname: string;
  /** The care streak, named in the answered No state. */
  streakDays?: number;
  /**
   * Called once with the answer. The parent must then move `state` on (answered_no, answered_yes
   * or saved_offline): until it does, both answers stay disabled so a second tap cannot record a
   * second check-in.
   */
  onAnswer: (dry: boolean, leaves: LeafState[]) => void;
  onAddPhoto: () => void;
  /** A photo is already attached: the button then offers to change it. */
  hasPhoto?: boolean;
  onClose: () => void;
  onDone: () => void;
  presentation?: CheckInPresentation;
}

export type CheckInSheetProps = CheckInSheetBase &
  (
    | { state: 'unanswered'; nextCheckWeekday?: string }
    // `offline`: the Yes was saved without a connection. It still says to water, plus the sync note.
    | { state: 'answered_yes'; nextCheckWeekday?: string; offline?: boolean }
    // These two say when the next check is, so they cannot be drawn without the day.
    | { state: 'answered_no'; nextCheckWeekday: string }
    // Offline, "No, still damp" only: an offline Yes is `answered_yes` with `offline`.
    | { state: 'saved_offline'; nextCheckWeekday: string }
  );

const LEAF_OPTIONS: { value: LeafState; label: string }[] = [
  { value: 'healthy', label: 'Healthy' },
  { value: 'yellowing', label: 'Yellowing' },
  { value: 'drooping', label: 'Drooping' },
  { value: 'brown_tips', label: 'Brown tips' },
  { value: 'spots', label: 'Spots' },
];

/**
 * Panel heights from the frames: 522 pt for the question (4c), 382 pt once it is answered (4d, 4e).
 * They are floors, not fixed heights: the question's content is a few points taller than 522 (the
 * frame squeezes the grab handle to nothing to fit), so a fixed height would clip the answers.
 */
const QUESTION_MIN_HEIGHT = 522;
const ANSWERED_MIN_HEIGHT = 382;

/**
 * The check-in (4c, 4d, 4e): one question, two large answers, an optional photo and leaf chips.
 * Answering is a single tap and cannot be repeated until the state moves on, so a double tap
 * records one check-in. Finishing a watering task gets no celebration, in any state.
 */
export function CheckInSheet(props: CheckInSheetProps) {
  const {
    visible,
    plantNickname,
    state,
    streakDays,
    onAnswer,
    onAddPhoto,
    hasPhoto = false,
    onClose,
    onDone,
    presentation = 'modal',
  } = props;
  const [leaves, setLeaves] = useState<LeafState[]>([]);
  const [answered, setAnswered] = useState(false);

  // A new state, or reopening the sheet, starts clean. Resetting while rendering, rather than in an
  // effect, avoids a frame that shows the old picks under the new state.
  const round = `${state}:${visible}`;
  const [seenRound, setSeenRound] = useState(round);
  if (seenRound !== round) {
    setSeenRound(round);
    setLeaves([]);
    setAnswered(false);
  }

  const answer = (dry: boolean) => {
    if (answered) return;
    setAnswered(true);
    onAnswer(dry, leaves);
  };

  let content: ReactNode;
  if (state === 'unanswered') {
    content = (
      <>
        <AppText variant="title">{checkInQuestion(plantNickname)}</AppText>
        <AppText variant="sub" color="textSecondary">
          Push a finger in up to the first knuckle.
        </AppText>
        <AppText variant="caption" color="textSecondary" style={styles.tightBelow}>
          How do the leaves look? (optional)
        </AppText>
        <OptionPills
          multiple
          options={LEAF_OPTIONS}
          value={leaves}
          onChange={(v) => setLeaves(v as LeafState[])}
        />
        <View style={styles.tightAbove}>
          <Button
            label={hasPhoto ? cameraCopy.changePhoto : cameraCopy.addPhoto}
            variant="secondary"
            onPress={onAddPhoto}
          />
        </View>
        <View style={styles.spacer} />
        <View style={styles.answers}>
          <AnswerTile label="Yes, dry" filled disabled={answered} onPress={() => answer(true)} />
          <AnswerTile label="No, still damp" disabled={answered} onPress={() => answer(false)} />
        </View>
      </>
    );
  } else {
    content = (
      <View style={styles.result} accessibilityLiveRegion="polite">
        {props.state === 'answered_yes' ? (
          <>
            <AppText variant="title">{`Time to water ${plantNickname}.`}</AppText>
            <AppText variant="sub" color="textSecondary">
              We&apos;ve added a watering task for today.
            </AppText>
            {props.offline ? <Note tone="dark" text={offlineSaved} /> : null}
          </>
        ) : (
          <>
            <AppText variant="title">{checkInAnsweredNo(props.nextCheckWeekday)}</AppText>
            {props.state === 'saved_offline' ? (
              <Note tone="dark" text={offlineSaved} />
            ) : streakDays != null && streakDays > 0 ? (
              <AppText variant="sub" color="textSecondary">
                {streakContinues(streakDays)}
              </AppText>
            ) : null}
          </>
        )}
        <View style={styles.spacer} />
        <View style={styles.tightAbove}>
          <Button label="Done" onPress={onDone} />
        </View>
      </View>
    );
  }

  const panel = {
    title: 'Check-in',
    onClose,
    minHeight:
      presentation === 'inline'
        ? undefined
        : state === 'unanswered'
          ? QUESTION_MIN_HEIGHT
          : ANSWERED_MIN_HEIGHT,
    children: content,
  };
  if (presentation === 'overlay') return <SheetOverlay {...panel} />;
  if (presentation === 'inline') return <SheetPanel {...panel} />;
  return <Sheet visible={visible} {...panel} />;
}

interface AnswerTileProps {
  label: string;
  /** The primary answer is filled; the other is outlined. */
  filled?: boolean;
  disabled: boolean;
  onPress: () => void;
}

/** A 64 pt answer (4c): large enough to tap without looking, in the primary colours. */
function AnswerTile({ label, filled = false, disabled, onPress }: AnswerTileProps) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.tile,
        {
          backgroundColor: filled ? c.primary : 'transparent',
          borderColor: filled ? 'transparent' : c.primary,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      {({ pressed }) => (
        <>
          {pressed && !disabled ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: c.pressedOverlay }]} />
          ) : null}
          <AppText
            variant="bodyStrong"
            color={filled ? c.onPrimary : c.primary}
            style={styles.label}
          >
            {label}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The sheet body already spaces its children by 18 pt; these pull a pair closer, as the frame does.
  tightBelow: { marginBottom: -8 },
  tightAbove: { marginTop: -8 },
  spacer: { flex: 1 },
  result: { flex: 1, gap: 18 },
  answers: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.card,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: { textAlign: 'center' },
});
