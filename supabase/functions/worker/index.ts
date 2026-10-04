/// <reference path="../_shared/runtime.d.ts" />
import { adminClient } from '../_shared/db.ts';
import { selectWeatherProvider } from '../_shared/providers/select.ts';
import { createHandler } from './handler.ts';

const edge = typeof EdgeRuntime === 'undefined' ? undefined : EdgeRuntime;

Deno.serve(
  createHandler({
    db: adminClient(),
    weather: selectWeatherProvider(),
    workerKey: Deno.env.get('WORKER_KEY'),
    waitUntil: edge ? (p) => edge.waitUntil(p) : undefined,
  }),
);
