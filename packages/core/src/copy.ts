import type { IsoDate } from './domain.ts';
import { longDate } from './dates.ts';

/** Fixed lines from the UX brief's Copy table. Never use the word "safe". */
export const copy = {
  galleryNote: "Gallery photos get identified but don't earn points.",
  pointsHeld: 'Points pending review. We check unusual finds before they count.',
  sensitiveSpecies: "We keep this species' location private to protect it.",
  homeArea: 'Finds near home never appear publicly, not even as an area.',
  previewOffer: 'Try Premium free for 7 days. No payment details, nothing to cancel.',
  notAPlant: "We couldn't find a plant in this photo. Try again with the plant filling the frame.",
  notSure: 'Try a close photo of one leaf or flower.',
  deleteAccount: 'This deletes your plants, finds, photos and points for good.',
  deleteAccountWithSubscription:
    "This deletes your plants, finds, photos and points for good. It doesn't cancel your subscription, so do that first.",
} as const;

export const checkInQuestion = (nickname: string) => `Is the top of ${nickname}'s soil dry?`;
export const checkInAnsweredNo = (weekday: string) => `Good. We'll check again on ${weekday}.`;
export const streakLastDay = (days: number) => `Your ${days}-day streak needs one check-in today.`;
export const streakContinues = (days: number) => `Your ${days}-day streak continues.`;
export const freezeUsed = (days: number) => `A freeze kept your ${days}-day streak going.`;
export const previewEnding = () =>
  "Your Premium preview ends tomorrow. You'll go back to Free, and nothing is charged.";
export const previewDaysLeft = (days: number) =>
  `Premium preview: ${days} ${days === 1 ? 'day' : 'days'} left. It ends on its own, and nothing is charged.`;
export const pointsPendingReview = 'Points pending review';
export const taskDueTitle = (nickname: string) => `Time to check ${nickname}'s soil.`;

/** My Plants, plant detail, setup and label adoption (2d, 4i to 4p): the lines the frames fix. */
export const plantsCopy = {
  myPlants: 'My Plants',
  addPlant: 'Add a plant',
  emptyLine: 'No plants yet. Scan one, or scan the label it came with.',
  scanPlant: 'Scan a plant',
  scanPlantLabel: 'Scan a plant label',
  nextSoilCheck: 'Next soil check',
  checkInToday: 'Today',
  carePlan: 'Care plan',
  history: 'History',
  nickname: 'Nickname',
  lightTitle: 'Light in the room',
  potTitle: 'Pot',
  drainsTitle: 'Drains at the bottom?',
  notSure: 'Not sure',
  notSureNote:
    "Not sure is fine. We'll start with the species' basic schedule and you can change it later.",
  save: 'Save',
  cancel: 'Cancel',
  saveFailed: "Couldn't save your plant. Try again.",
  labelUnknown: "We don't know this label. The code may be retired.",
  labelUnknownBody: 'You can still scan the plant itself.',
  scanThePlant: 'Scan the plant',
  addToMyPlants: 'Add to my plants',
  noIdentificationUsed: 'No identification used.',
  markDied: 'Mark as died',
  givenAway: 'Given away',
  diedCauseTitle: 'What happened?',
  diedCauseLine: 'Optional. We use this to give better advice.',
  diedCauseOther: 'Anything else? (optional)',
  statusFailed: "Couldn't update the plant. Try again.",
} as const;

/** "Set up Lily" (4m). */
export const setupTitle = (name: string) => `Set up ${name}`;
/** "From the label · Greenhouse Growers" (4o). */
export const fromLabelLine = (grower: string) => `From the label · ${grower}`;
/** The note on a plant that was given away (4k). */
export const givenAwayNote = (on: IsoDate) =>
  `Given away on ${longDate(on)}. Kept in your history.`;
/** The note on a plant that died (4l): the cause when the person gave one. */
export const diedNote = (on: IsoDate, cause: string | null) =>
  `Marked as died on ${longDate(on)}${cause ? `: ${cause}` : ''}. We use this to give better advice.`;

/** Proper adjectives and names that keep their capital when a plant name sits mid-sentence. */
export const PROPER_FIRST_WORDS: readonly string[] = [
  'Easter',
  'Swiss',
  'English',
  'African',
  'Boston',
  'Christmas',
  'Irish',
  'Chinese',
  'Japanese',
  'Persian',
  'Venus',
  'Moses',
];

/** "a" or "an" for a name, by whether its first letter is a vowel. */
export const indefiniteArticle = (name: string): 'a' | 'an' =>
  /^[aeiou]/i.test(name.trim()) ? 'an' : 'a';

/** A plant name for the middle of a sentence: "Peace lily" becomes "peace lily". */
export const midSentenceName = (name: string): string => {
  const trimmed = name.trim();
  const first = trimmed.split(/\s+/)[0] ?? '';
  if (PROPER_FIRST_WORDS.includes(first)) return trimmed;
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
};

/** What to call a pet in copy: its name, or "your cat", "your dog" or "your pet". */
export const petNameOrFallback = (name: string | null | undefined, animal: string): string => {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  return animal === 'cat' || animal === 'dog' ? `your ${animal}` : 'your pet';
};

export const veryLikelyResultLine = (name: string, percent: number) =>
  `Very likely ${indefiniteArticle(name)} ${midSentenceName(name)}, ${percent}% match.`;
export const likelyResultLine = (name: string, percent: number) =>
  `Likely ${indefiniteArticle(name)} ${midSentenceName(name)}, ${percent}%. Compare these two before you add it.`;

/** Onboarding (3a to 3k): the lines the frames fix, so the screens and the tests read one source. */
export const onboardingCopy = {
  welcomeLine: 'Name any plant from a photo, see how sure we are, and check it against your pets.',
  ageTitle: 'When were you born?',
  ageLine: 'Month and year are enough.',
  ageStopTitle: 'Thanks for telling us',
  ageStopLine: "You can't create a Tendril account right now. We haven't kept your date of birth.",
  signInTitle: 'Save your plants',
  signInLine: 'Sign in so your plants and finds follow you to a new phone.',
  linkSentTitle: 'Check your email',
  linkExpiredTitle: 'This link has expired',
  petsTitle: 'Who lives with you?',
  petsLine: 'Pick all that apply. Every plant gets a pet check for each of them.',
  petsNone: 'No pet checks for now. Add a pet any time in Settings and every plant gets checked.',
  homeAreaTitle: "Where's home?",
  townNotFoundTitle: "We couldn't find that town",
  townNotFoundBody: 'Check the spelling, or move the area on the map instead.',
  firstScanTitle: 'Your first scan',
  firstScanLines: [
    'Fill the frame with one leaf, a flower or the whole plant.',
    'Tendril needs the camera to take plant photos.',
    'Photos stay private unless you share one.',
  ],
  orUseEmail: 'or use email',
  emailRequired: 'Enter your email address.',
  linkResent: 'Sent again. Check your email.',
  namesOptional: 'Names (optional)',
  skip: 'Skip',
  petsSaveFailed: "Couldn't save your pets. Try again.",
  homeAreaSaveFailed: "Couldn't save your area. Try again.",
  homeAreaSkipped: "Home area skipped. We'll ask again before your first public find.",
} as const;

export const linkSentLine = (email: string) =>
  `We sent a sign-in link to ${email}. Open it on this phone within 15 minutes.`;
export const linkExpiredLine = (email: string) =>
  `Sign-in links work once, for 15 minutes. We can send a fresh one to ${email}.`;

/** Today, the check-in and Streaks (2e, 4a to 4h): the lines the frames fix. */
export const todayCopy = {
  today: 'Today',
  dueToday: 'Due today',
  emptyLine: "Add your first plant and we'll tell you when to check its soil.",
  scanPlant: 'Scan a plant',
  scanLabel: 'Scan your plant label',
  checkIn: 'Check in',
  checkInFailed: "Couldn't save your check-in. Try again.",
  careStreakLabel: 'day care streak',
  discoveryStreakLabel: 'week discovery streak',
  league: 'League',
  identifications: 'Identifications',
  streaksTitle: 'Streaks',
  discoveryRow: 'Discovery streak',
  discoveryRowLine: 'A new species each week',
  freezesRow: 'Freezes',
  freezesRowLine: 'Spent on a missed day',
  freezesRowLineSpent: 'Invite a friend to earn another',
  winterRow: 'Winter mode',
  winterRowLine: 'Protects discovery when little grows',
  invite: 'Invite a friend to earn a freeze',
} as const;

/** The note under a check-in that was saved without a connection (4e, and an offline Yes). */
export const offlineSaved = "You're offline. Saved, and it will sync when you're back.";

/** "1 freeze held", "2 freezes held": the line under the Today streak tiles (2e). */
export const freezesHeldLine = (n: number) => `${n} ${n === 1 ? 'freeze' : 'freezes'} held`;
/** "1 held": the Freezes row on Streaks (4f, 4g). */
export const freezesHeldShort = (n: number) => `${n} held`;
/** "3 weeks", "1 week": the Discovery streak row (4f). */
export const weeksLabel = (n: number) => `${n} ${n === 1 ? 'week' : 'weeks'}`;
/** The line under a broken streak. It says what happened and how to start again, never who failed (4h). */
export const streakBroken = (days: number) =>
  `Your last streak ran ${days} ${days === 1 ? 'day' : 'days'}. Any check-in starts a new one.`;
/** "Check in on Monty" (4h). */
export const checkInOn = (nickname: string) => `Check in on ${nickname}`;
/** A finished task in the all-done list (4b). */
export const taskDoneTitle = (kind: 'water' | 'check', nickname: string) =>
  kind === 'water' ? `Watered ${nickname}` : `Checked ${nickname}'s soil`;
/** "340 points · 3 days left": under the league rank (2e, 4b). */
export const leaguePointsLine = (points: number, daysLeft: number) =>
  `${points} points · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`;
/** "All done for today. Next check: Spidey, tomorrow." `when` is "tomorrow" or a weekday (4b). */
export const allDoneToday = (next?: { plantNickname: string; when: string }) =>
  next
    ? `All done for today. Next check: ${next.plantNickname}, ${next.when}.`
    : 'All done for today.';

/** The longest nickname a plant can have. */
export const NICKNAME_MAX = 40;
/** A nickname is 1 to 40 characters once trimmed. The app and the server share this. */
export const isValidNickname = (name: string): boolean => {
  const length = name.trim().length;
  return length >= 1 && length <= NICKNAME_MAX;
};
/** The snackbar after a plant is marked as given away; it carries the Undo. */
export const givenAwaySnackbar = (nickname: string) => `${nickname} marked as given away.`;
