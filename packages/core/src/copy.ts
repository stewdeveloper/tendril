import type { IsoDate, PlaceType } from './domain.ts';
import { bandFor, bandWord, confidenceLabel, toPercent } from './confidence.ts';
import { longDate } from './dates.ts';
import { nonBreakingPhone } from './emergency.ts';

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
  checkHealth: 'Check its health',
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

/** Diagnosis (4q to 4s) and the photo step that comes before it. */
export const diagnosisCopy = {
  photosTitle: 'Take photos',
  photosLine:
    'Add one to three photos of the leaves, stems or soil that worry you. Close up and in daylight works best.',
  takePhoto: 'Take a photo',
  choosePhoto: 'Choose from library',
  removePhoto: 'Remove photo',
  check: 'Check its health',
  checking: 'Checking',
  photosFull: 'That is three photos, the most we can use.',
  permissionDenied: 'Allow photo access in your phone settings to add photos.',
  failed: "Couldn't check your plant. Try again.",
  changeToPlan: 'Change to your plan',
  apply: 'Apply to care plan',
  applyFailed: "Couldn't change your plan. Try again.",
  tryPremium: 'Try Premium free for 7 days',
  notNow: 'Not now',
  notSureNote: "This didn't use your diagnosis.",
  closePhoto: 'Take a close photo',
} as const;
/** "1 of 3 photos" under the photo step's picker. */
export const photosCount = (n: number) => `${n} of 3 photos`;

/** The pet emergency screen (4bh, 4bi). */
export const emergencyCopy = {
  callVet: 'Call your vet',
  findVet: 'Find a vet nearby',
  saveVet: 'Save your vet',
  noVetNote: "You haven't saved a vet yet. Call your nearest vet now.",
  /** A vet is saved, but the number has no digits to dial. */
  vetNoNumber: (name: string) =>
    `We can't dial the number saved for ${name}. Call your nearest vet now.`,
  /** The screen with nothing known yet (still loading, or the lookup failed): the safe actions. */
  fallbackTitle: 'If your pet ate a plant',
  callNearestVet: 'Call your nearest vet now.',
  title: (petName: string, speciesName: string) => `If ${petName} ate ${speciesName}`,
  callPoisonLine: (name: string, phone: string) => `Call ${name} ${nonBreakingPhone(phone)}`,
  /** "Source: ASPCA. Based on a very likely match, 94%." The match part only when there is one. */
  sourceLine: (sourceName: string | null, matchProbability: number | null): string | null => {
    const source = sourceName ? `Source: ${sourceName}.` : null;
    const band = matchProbability == null ? null : bandFor(matchProbability);
    // "Not sure" is not a kind of match, so it reads as the label: "Based on the match: Not sure, 34%."
    const match =
      matchProbability == null || band == null
        ? null
        : band === 'not_sure'
          ? `Based on the match: ${confidenceLabel(matchProbability)}.`
          : `Based on a ${bandWord(band).toLowerCase()} match, ${toPercent(matchProbability)}%.`;
    return [source, match].filter(Boolean).join(' ') || null;
  },
} as const;

/** The camera, gallery and label-scan screens (2b, 4t, 4u and the label scanner). */
export const cameraCopy = {
  organLeaf: 'Leaf',
  organFlower: 'Flower',
  organWhole: 'Whole plant',
  gallery: 'Gallery',
  takePhoto: 'Take photo',
  identify: 'Identify',
  healthToggle: 'Check its health',
  removePhoto: 'Remove photo',
  deniedTitle: 'The camera is off for Tendril.',
  deniedBody: 'Turn it on in Settings to scan plants. Gallery photos still work.',
  deniedLabelBody: 'Turn it on in Settings to scan plant labels.',
  openSettings: 'Open Settings',
  chooseFromGallery: 'Choose from gallery',
  galleryTitle: 'Choose photos',
  gallerySub: 'Up to 5 photos of the same plant.',
  galleryAdd: 'Add photos',
  identifyFailed: "Couldn't identify that. Try again.",
  photoFailed: "Couldn't use that photo. Try another.",
  labelHint: 'Point the camera at the QR code on your Tendril plant label.',
  notTendrilLabel: "That's not a Tendril label.",
  addPhoto: 'Add a photo',
  changePhoto: 'Change photo',
  photoSourceTake: 'Take a photo',
  photoSourceChoose: 'Choose from library',
} as const;
/** "2 of 5" under the camera's photo tray. */
export const trayCount = (n: number) => `${n} of 5`;

/** The scan result (2a, 2c, 4v to 4y), its health check card and the "Log a find" sheet (4z, 4aa). */
export const resultCopy = {
  notSureTitle: 'Not sure yet',
  closestMatches: 'Closest matches',
  careBasics: 'Care basics',
  careLight: 'Light',
  careSoil: 'Soil check',
  careWarmth: 'Warmth',
  otherPossibilities: 'Other possibilities',
  petCheck: 'Pet check',
  logFind: 'Log a find',
  addToMyPlants: 'Add to My Plants',
  takeClosePhoto: 'Take a close photo',
  tryAgain: 'Try again',
  close: 'Close',
  ok: 'OK',
  notAPlantTitle: 'No plant found',
  noIdentificationUsed: "This didn't use an identification.",
  offlineTitle: "You're offline",
  offlineBody: "Your photos are saved. We'll identify them when you're back online.",
  errorTitle: 'Something went wrong',
  errorBody: "We couldn't identify this one. It didn't use an identification.",
  healthCheckTitle: 'Health check',
  healthCheckLine: 'Once you add this plant, the advice appears on its page.',
  whereWasIt: 'Where was it?',
  pointsNote:
    'Points come from in-app camera finds. No picking, no trespassing, and others only ever see an area.',
  locationOffNote: 'Location is off. This find goes in your Plantdex without points.',
  turnOnLocation: 'Turn on location',
  saveFind: 'Save find',
  saveFindFailed: "Couldn't save your find. Try again.",
  alreadySaved: "This one's already saved.",
  cannotSave: "We can't save this result. Try scanning again.",
  findSaved: 'Find saved',
  allowLocation: 'Allow location',
  scanAgain: 'Scan again',
} as const;
/** "3 photos", "1 photo": the count over a result's photo strip. */
export const resultPhotoCount = (n: number) => `${n} ${n === 1 ? 'photo' : 'photos'}`;
/** "This is a peace lily": confirming a likely match (4v). */
export const thisIsLine = (name: string) =>
  `This is ${indefiniteArticle(name)} ${midSentenceName(name)}`;
/** The places a find can be, as the pills show them, in the order the sheet lists them (4z). */
export const placeTypeOptions: readonly { value: PlaceType; label: string }[] = [
  { value: 'shop', label: 'Shop' },
  { value: 'garden_park', label: 'Garden or park' },
  { value: 'wild', label: 'Wild' },
];

/** The new-species moment (4ab to 4ae) and the set-complete screen (4al). */
export const momentCopy = {
  newToPlantdex: 'New to your Plantdex',
  reduceMotionNote: 'Reduce Motion is on, so this card appears with a fade only.',
  points: 'Points',
  plantdex: 'Plantdex',
  continue: 'Continue',
  share: 'Share',
  setsBack: 'Sets',
} as const;
export const plantdexSpecies = (n: number) => `${n} species`;
export const setProgressValue = (found: number, total: number) => `${found} of ${total}`;
/** "Set complete: 6 of 6." (4al). */
export const setCompleteLine = (total: number) => `Set complete: ${total} of ${total}.`;
/** What the Share sheet carries for a completed set. */
export const setShareMessage = (name: string, total: number) =>
  `I completed the ${name} set in Tendril: ${total} of ${total}.`;
/** Why a find that is not held and not a gallery photo earned no points, in plain words. */
export const noPointsReasonLine = (reason: string | null): string | null => {
  switch (reason) {
    case 'gallery':
    case 'integrity':
      return copy.galleryNote;
    case 'location_off':
      return resultCopy.locationOffNote;
    case 'time_skew':
      return "This photo's time didn't match your phone's clock, so it earns no points.";
    case 'duplicate':
      return "You've already earned points for this find.";
    case 'daily_cap':
      return "You've reached today's points limit. Your Plantdex still grows.";
    default:
      return null;
  }
};

/** The Collection tab and the species card (2f, 4ah to 4ap). */
export const collectionCopy = {
  title: 'Collection',
  segmentPlantdex: 'Plantdex',
  segmentSets: 'Sets',
  segmentMap: 'Map',
  segmentBadges: 'Badges',
  filterAll: 'All',
  filterHouseplants: 'Houseplants',
  filterWild: 'Wild',
  emptyPlantdex: 'Your Plantdex fills up as you scan. Start with a plant at home.',
  scanPlant: 'Scan a plant',
  notFoundYet: 'Not found yet',
  mapAlt: 'Map with your exact pins',
  mapSub: 'Only you see exact pins. Anything shared shows an area at most.',
  locationOff: 'Location is off, so your finds show as a list.',
  turnOnLocation: 'Turn on location',
  locationPrivate: 'Location private',
  noFindsYet: 'No finds yet. Log one from a scan.',
  emptyBadges: 'No badges yet. Log your first find to earn one.',
  earned: 'Earned',
  locked: 'Locked',
  shareBadge: 'Share a badge',
  yourFinds: 'Your finds',
  seeOnMap: 'See finds on the map',
} as const;
/** "Foxglove" as a plain filter pill label: "All · 37". */
export const filterPillLabel = (label: string, count: number) => `${label} · ${count}`;
/** What Share carries for a badge. */
export const badgeShareMessage = (name: string) => `I earned the ${name} badge in Tendril.`;
