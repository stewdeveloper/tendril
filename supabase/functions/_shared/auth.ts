import type { Db } from './db.ts';
import { ApiError } from './errors.ts';

export interface UserVerifier {
  verify(req: Request): Promise<{ userId: string } | null>;
}

/** Stands in for `@supabase/server`'s `withSupabase`: Bearer token, then `auth.getUser`. */
export function supabaseUserVerifier(db: Db): UserVerifier {
  return {
    async verify(req) {
      const header = req.headers.get('authorization') ?? '';
      const match = /^Bearer\s+(\S+)$/i.exec(header);
      if (!match) return null;
      const { data, error } = await db.auth.getUser(match[1]);
      if (error || !data.user) return null;
      return { userId: data.user.id };
    },
  };
}

export async function requireUser(verifier: UserVerifier, req: Request): Promise<string> {
  const user = await verifier.verify(req);
  if (!user) throw new ApiError('unauthenticated', 'Sign in to continue.');
  return user.userId;
}
