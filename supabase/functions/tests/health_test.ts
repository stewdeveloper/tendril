import { assertEquals } from '@std/assert';
import { handler } from '../health/handler.ts';

Deno.test('health returns ok and proves core is bundled', async () => {
  const res = handler(new Request('http://localhost/health'));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { ok: true, core: 'very_likely' });
});
