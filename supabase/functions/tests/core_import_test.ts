import { assertEquals } from '@std/assert';
import { bandFor, confidenceLabel } from '@core/confidence.ts';

Deno.test('core loads under Deno through the @core/ alias', () => {
  assertEquals(bandFor(0.94), 'very_likely');
  assertEquals(confidenceLabel(0.71), 'Likely, 71%');
});
