import { describe, expect, it } from 'vitest';
import {
  checkInAnsweredNo,
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
