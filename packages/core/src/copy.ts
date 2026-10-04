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
  homeAreaSkipped: "Home area skipped. We'll ask again before your first public find.",
} as const;

export const linkSentLine = (email: string) =>
  `We sent a sign-in link to ${email}. Open it on this phone within 15 minutes.`;
export const linkExpiredLine = (email: string) =>
  `Sign-in links work once, for 15 minutes. We can send a fresh one to ${email}.`;
