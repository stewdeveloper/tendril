import type { Db } from './db.ts';
import { throwDbError } from './db.ts';
import { ApiError } from './errors.ts';

/** The household named in the request (the caller must be a member), else the caller's own (owner first). */
export async function resolveHousehold(db: Db, uid: string, requested?: string): Promise<string> {
  const { data, error } = await db
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', uid);
  if (error) throwDbError(error);
  const mine = data ?? [];
  if (requested) {
    if (!mine.some((m) => m.household_id === requested)) {
      throw new ApiError('forbidden', 'You are not a member of that household.');
    }
    return requested;
  }
  const home = mine.find((m) => m.role === 'owner') ?? mine[0];
  if (!home) throw new ApiError('not_found', 'Finish setting up your account first.');
  return home.household_id;
}
