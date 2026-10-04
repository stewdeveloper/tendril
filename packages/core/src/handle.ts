/**
 * A typed handle as the server matches it: trimmed, one leading "@" removed, lowercase. Handle
 * search is exact-match only, so this is the whole of the "fuzziness" there is.
 */
export function normaliseHandle(input: string): string {
  return input.trim().replace(/^@/, '').toLowerCase();
}
