import { describe, expect, it } from 'vitest';
import {
  allDoneToday,
  checkInAnsweredNo,
  checkInOn,
  freezesHeldLine,
  freezesHeldShort,
  leaguePointsLine,
  diedNote,
  givenAwayNote,
  offlineSaved,
  streakBroken,
  taskDoneTitle,
  weeksLabel,
  checkInQuestion,
  copy,
  freezeUsed,
  indefiniteArticle,
  midSentenceName,
  petNameOrFallback,
  previewDaysLeft,
  pointsPendingReview,
  PROPER_FIRST_WORDS,
  taskDueTitle,
  likelyResultLine,
  streakContinues,
  streakLastDay,
  veryLikelyResultLine,
} from './copy.ts';

describe('copy', () => {
  it('uses the UX brief lines', () => {
    expect(checkInQuestion('Monty')).toBe("Is the top of Monty's soil dry?");
    expect(checkInAnsweredNo('Friday')).toBe("Good. We'll check again on Friday.");
    expect(streakLastDay(12)).toBe('Your 12-day streak needs one check-in today.');
    expect(streakContinues(12)).toBe('Your 12-day streak continues.');
    expect(freezeUsed(12)).toBe('A freeze kept your 12-day streak going.');
    expect(veryLikelyResultLine('peace lily', 94)).toBe('Very likely a peace lily, 94% match.');
    expect(likelyResultLine('peace lily', 71)).toBe(
      'Likely a peace lily, 71%. Compare these two before you add it.',
    );
    expect(copy.galleryNote).toBe("Gallery photos get identified but don't earn points.");
  });
  it('never uses the word safe', () => {
    for (const v of Object.values(copy)) expect(v.toLowerCase()).not.toMatch(/\bsafe\b/);
  });
  it('picks a or an by first letter', () => {
    expect(indefiniteArticle('peace lily')).toBe('a');
    expect(indefiniteArticle('Early purple orchid')).toBe('an');
    expect(indefiniteArticle('Orchid')).toBe('an');
  });
  it('lower-cases a name mid-sentence unless it starts with a proper word', () => {
    expect(midSentenceName('Peace lily')).toBe('peace lily');
    expect(midSentenceName('Swiss cheese plant')).toBe('Swiss cheese plant');
    expect(midSentenceName('Easter cactus')).toBe('Easter cactus');
    expect(midSentenceName('  Monstera ')).toBe('monstera');
    expect(PROPER_FIRST_WORDS).toContain('Moses');
  });
  it('builds result lines with the right article and casing', () => {
    expect(veryLikelyResultLine('Peace lily', 94)).toBe('Very likely a peace lily, 94% match.');
    expect(veryLikelyResultLine('Early purple orchid', 88)).toBe(
      'Very likely an early purple orchid, 88% match.',
    );
    expect(likelyResultLine('Swiss cheese plant', 71)).toBe(
      'Likely a Swiss cheese plant, 71%. Compare these two before you add it.',
    );
  });
  it('has the pending-review and due-task lines', () => {
    expect(pointsPendingReview).toBe('Points pending review');
    expect(taskDueTitle('Monty')).toBe("Time to check Monty's soil.");
  });
  it('falls back for blank pet names', () => {
    expect(petNameOrFallback('  Biscuit ', 'dog')).toBe('Biscuit');
    expect(petNameOrFallback('  ', 'cat')).toBe('your cat');
    expect(petNameOrFallback(null, 'dog')).toBe('your dog');
    expect(petNameOrFallback(null, 'other')).toBe('your pet');
  });
});

describe('previewDaysLeft', () => {
  it('says how long the preview has left, and that nothing is charged', () => {
    expect(previewDaysLeft(5)).toBe(
      'Premium preview: 5 days left. It ends on its own, and nothing is charged.',
    );
    expect(previewDaysLeft(1)).toBe(
      'Premium preview: 1 day left. It ends on its own, and nothing is charged.',
    );
  });
});

describe('today copy', () => {
  it('matches the frames', () => {
    expect(freezesHeldLine(1)).toBe('1 freeze held');
    expect(freezesHeldLine(2)).toBe('2 freezes held');
    expect(freezesHeldShort(0)).toBe('0 held');
    expect(weeksLabel(3)).toBe('3 weeks');
    expect(weeksLabel(1)).toBe('1 week');
    expect(streakBroken(16)).toBe('Your last streak ran 16 days. Any check-in starts a new one.');
    expect(checkInOn('Monty')).toBe('Check in on Monty');
    expect(taskDoneTitle('check', 'Monty')).toBe("Checked Monty's soil");
    expect(taskDoneTitle('water', 'Lily')).toBe('Watered Lily');
    expect(leaguePointsLine(340, 3)).toBe('340 points · 3 days left');
    expect(leaguePointsLine(5, 1)).toBe('5 points · 1 day left');
    expect(allDoneToday({ plantNickname: 'Spidey', when: 'tomorrow' })).toBe(
      'All done for today. Next check: Spidey, tomorrow.',
    );
    expect(allDoneToday()).toBe('All done for today.');
  });
});

describe('offlineSaved', () => {
  it('is the one sanctioned offline note', () => {
    expect(offlineSaved).toBe("You're offline. Saved, and it will sync when you're back.");
  });
});

describe('plant closed notes (4k, 4l)', () => {
  it('say what happened and on which day, and that it stays in the history', () => {
    expect(givenAwayNote('2026-09-12')).toBe('Given away on 12 September. Kept in your history.');
  });
  it('a plant that died names the cause when there is one', () => {
    expect(diedNote('2026-08-20', 'too dry')).toBe(
      'Marked as died on 20 August: too dry. We use this to give better advice.',
    );
    expect(diedNote('2026-08-20', null)).toBe(
      'Marked as died on 20 August. We use this to give better advice.',
    );
  });
});
