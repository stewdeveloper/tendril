// Per-weight imports so only the five fonts the type scale uses ship (the package roots pull in
// every weight).
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_400Regular_Italic } from '@expo-google-fonts/inter/400Regular_Italic';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import type { TypeStyle } from '@tendril/core';

export const fontMap = {
  Fraunces_600SemiBold,
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_500Medium,
  Inter_600SemiBold,
};

export function fontFamilyFor(s: TypeStyle): keyof typeof fontMap {
  if (s.family === 'Fraunces') return 'Fraunces_600SemiBold';
  if (s.italic) return 'Inter_400Regular_Italic';
  return s.weight === '600'
    ? 'Inter_600SemiBold'
    : s.weight === '500'
      ? 'Inter_500Medium'
      : 'Inter_400Regular';
}
