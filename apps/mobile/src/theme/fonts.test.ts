import { typeScale } from '@tendril/core';
import { fontFamilyFor, fontMap } from './fonts';

describe('fonts', () => {
  it('loads exactly the five fonts the type scale uses', () => {
    expect(Object.keys(fontMap).sort()).toEqual([
      'Fraunces_600SemiBold',
      'Inter_400Regular',
      'Inter_400Regular_Italic',
      'Inter_500Medium',
      'Inter_600SemiBold',
    ]);
  });
  it('maps every type variant to a loaded font key', () => {
    for (const style of Object.values(typeScale)) {
      expect(Object.keys(fontMap)).toContain(fontFamilyFor(style));
    }
  });
});
