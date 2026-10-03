import { describe, expect, it } from 'vitest';
import {
  checkInAnsweredNo,
  checkInQuestion,
  copy,
  freezeUsed,
  likelyResultLine,
  streakLastDay,
  veryLikelyResultLine,
} from './copy.ts';

describe('copy', () => {
  it('uses the UX brief lines', () => {
    expect(checkInQuestion('Monty')).toBe("Is the top of Monty's soil dry?");
    expect(checkInAnsweredNo('Friday')).toBe("Good. We'll check again on Friday.");
    expect(streakLastDay(12)).toBe('Your 12-day streak needs one check-in today.');
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
});
