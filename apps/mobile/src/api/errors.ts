/**
 * A refusal from the API with its HTTP status and the server's code. The Supabase API throws these
 * from its Edge Function replies; the fixture throws them where the server would.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${code} (${status})`);
    this.name = 'ApiError';
  }
}

/** What to do about a failed confirm: it was saved already, the result cannot be saved, or try again. */
export type ConfirmFailure = 'already_saved' | 'rejected' | 'retry';

export function confirmFailure(error: unknown): ConfirmFailure {
  if (error instanceof ApiError) {
    if (error.status === 409) return 'already_saved';
    if (error.status === 400) return 'rejected';
  }
  // A network failure, a 5xx or anything unexpected: the same save may well work again.
  return 'retry';
}
