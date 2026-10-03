import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
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
