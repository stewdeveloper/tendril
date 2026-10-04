import { supabaseUserVerifier } from '../_shared/auth.ts';
import { adminClient } from '../_shared/db.ts';
import { createHandler } from './handler.ts';

const db = adminClient();
Deno.serve(createHandler({ db, verifier: supabaseUserVerifier(db) }));
