import { bandFor } from '@core/confidence.ts';

/** Liveness check that also proves @tendril/core is bundled into functions. */
export function handler(_req: Request): Response {
  return Response.json({ ok: true, core: bandFor(0.94) });
}
