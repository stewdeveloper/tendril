/**
 * Props that hide a decorative lucide icon from VoiceOver and TalkBack. The glyphs in icons.tsx do
 * this themselves; spread this on the lucide icons that sit outside an accessible control.
 */
export const DECORATIVE = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
  'aria-hidden': true,
} as const;
