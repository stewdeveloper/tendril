import { describe, expect, it } from 'vitest';
import {
  placeTypeOptions,
  resultCopy,
  resultPhotoCount,
  thisIsLine,
  allDoneToday,
  checkInAnsweredNo,
  checkInOn,
  freezesHeldLine,
  freezesHeldShort,
  leaguePointsLine,
  leagueDaysLine,
  leagueEmptyLine,
  rankOfLine,
  inviteShareMessage,
  diedNote,
  givenAwayNote,
  givenAwaySnackbar,
  isValidNickname,
  offlineSaved,
  streakBroken,
  taskDoneTitle,
  weeksLabel,
  cameraCopy,
  checkInQuestion,
  copy,
  freezeUsed,
  emergencyCopy,
  indefiniteArticle,
  midSentenceName,
  petNameOrFallback,
  previewDaysLeft,
  pointsPendingReview,
  PROPER_FIRST_WORDS,
  taskDueTitle,
  trayCount,
  likelyResultLine,
  streakContinues,
  streakLastDay,
  veryLikelyResultLine,
  badgeShareMessage,
  collectionCopy,
  filterPillLabel,
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

describe('given-away snackbar', () => {
  it('names the plant', () => {
    expect(givenAwaySnackbar('Lily')).toBe('Lily marked as given away.');
  });
});

describe('isValidNickname', () => {
  it('accepts 1 to 40 characters after trimming', () => {
    expect(isValidNickname('Lily')).toBe(true);
    expect(isValidNickname('  Lily  ')).toBe(true);
    expect(isValidNickname('a'.repeat(40))).toBe(true);
  });
  it('refuses empty, blank and over-long names', () => {
    expect(isValidNickname('')).toBe(false);
    expect(isValidNickname('   ')).toBe(false);
    expect(isValidNickname('a'.repeat(41))).toBe(false);
    expect(isValidNickname(`  ${'a'.repeat(41)} `)).toBe(false);
  });
});

describe('emergency copy', () => {
  it('names the pet and the plant', () => {
    expect(emergencyCopy.title('Miso', 'peace lily')).toBe('If Miso ate peace lily');
  });
  it('the poison line button carries the number', () => {
    expect(emergencyCopy.callPoisonLine('ASPCA Poison Control', '(888) 426-4435')).toBe(
      'Call ASPCA Poison Control (888)\u00A0426\u20114435',
    );
  });
  it('a vet whose number cannot be dialled still gets guidance', () => {
    expect(emergencyCopy.vetNoNumber('Riverside Vets')).toBe(
      "We can't dial the number saved for Riverside Vets. Call your nearest vet now.",
    );
  });
  it('the source and match line reads as the frame does', () => {
    expect(emergencyCopy.sourceLine('ASPCA', 0.94)).toBe(
      'Source: ASPCA. Based on a very likely match, 94%.',
    );
    expect(emergencyCopy.sourceLine('ASPCA', 0.71)).toBe(
      'Source: ASPCA. Based on a likely match, 71%.',
    );
    expect(emergencyCopy.sourceLine('ASPCA', 0.34)).toBe(
      'Source: ASPCA. Based on the match: Not sure, 34%.',
    );
    expect(emergencyCopy.sourceLine('ASPCA', null)).toBe('Source: ASPCA.');
    expect(emergencyCopy.sourceLine(null, null)).toBeNull();
  });
});

describe('camera copy', () => {
  it('counts the tray out of five', () => {
    expect(trayCount(0)).toBe('0 of 5');
    expect(trayCount(2)).toBe('2 of 5');
  });
  it('never says safe', () => {
    for (const line of Object.values(cameraCopy)) expect(line).not.toMatch(/\bsafe/i);
  });
  it('says what the label scanner wants and what it found', () => {
    expect(cameraCopy.labelHint).toBe(
      'Point the camera at the QR code on your Tendril plant label.',
    );
    expect(cameraCopy.notTendrilLabel).toBe("That's not a Tendril label.");
  });
});

describe('scan result copy', () => {
  it('counts photos, singular and plural', () => {
    expect(resultPhotoCount(3)).toBe('3 photos');
    expect(resultPhotoCount(1)).toBe('1 photo');
  });
  it('confirms a likely match with the right article', () => {
    expect(thisIsLine('Peace lily')).toBe('This is a peace lily');
    expect(thisIsLine('African violet')).toBe('This is an African violet');
  });
  it('lists the places a find can be, in the order the sheet shows them', () => {
    expect(placeTypeOptions.map((o) => [o.value, o.label])).toEqual([
      ['shop', 'Shop'],
      ['garden_park', 'Garden or park'],
      ['wild', 'Wild'],
    ]);
  });
  it('never says safe', () => {
    expect(JSON.stringify(resultCopy)).not.toMatch(/\bsafe\b/i);
  });
});

describe('collection copy', () => {
  it('writes the filter pills and the badge share line', () => {
    expect(filterPillLabel('All', 37)).toBe('All · 37');
    expect(badgeShareMessage('First find')).toBe('I earned the First find badge in Tendril.');
  });
  it('never says safe', () => {
    expect(JSON.stringify(collectionCopy)).not.toMatch(/\bsafe\b/i);
  });
});

describe('leagues copy', () => {
  it('words the days left, the empty board and the rank', () => {
    expect(leagueDaysLine(3, 'Monday')).toBe('3 days left · resets Monday');
    expect(leagueDaysLine(1, 'Monday')).toBe('1 day left · resets Monday');
    expect(leagueDaysLine(0, 'Monday')).toBe('Ends today · resets Monday');
    expect(leagueEmptyLine(20)).toBe(
      'Log a find to join this week’s board with 20 people near you.',
    );
    expect(rankOfLine(4, 20)).toBe('4th of 20');
    expect(rankOfLine(12, 30)).toBe('12th of 30');
    expect(inviteShareMessage('https://x.y/i')).toContain('https://x.y/i');
  });
});
