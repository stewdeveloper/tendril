import { adminClient } from '../_shared/db.ts';
import { createHandler } from './handler.ts';

Deno.serve(createHandler({ db: adminClient() }));
