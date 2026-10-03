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
export const freezeUsed = (days: number) => `A freeze kept your ${days}-day streak going.`;
export const previewEnding = () =>
  "Your Premium preview ends tomorrow. You'll go back to Free, and nothing is charged.";
export const veryLikelyResultLine = (name: string, percent: number) =>
  `Very likely a ${name}, ${percent}% match.`;
export const likelyResultLine = (name: string, percent: number) =>
  `Likely a ${name}, ${percent}%. Compare these two before you add it.`;
