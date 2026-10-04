import { describe, expect, it } from 'vitest';
import { normaliseHandle } from './handle.ts';

describe('normaliseHandle', () => {
  it('trims, strips one leading @ and lowercases', () => {
    expect(normaliseHandle('  @SiobhanPlants ')).toBe('siobhanplants');
    expect(normaliseHandle('siobhanplants')).toBe('siobhanplants');
    expect(normaliseHandle('@@x')).toBe('@x');
  });
  it('is empty for blank input or a lone @', () => {
    expect(normaliseHandle('   ')).toBe('');
    expect(normaliseHandle('@')).toBe('');
  });
});
