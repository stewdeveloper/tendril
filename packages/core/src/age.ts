/**
 * COPPA gate with month precision. Someone born in the current month 13 years ago may still be 12,
 * so only birth months strictly before that count as 13 or over. Only the boolean is ever stored.
 */
export function isAtLeast13(
  birth: { year: number; month: number },
  today: { year: number; month: number },
): boolean {
  if (!Number.isInteger(birth.year) || !Number.isInteger(birth.month)) return false;
  if (birth.month < 1 || birth.month > 12) return false;
  const birthIndex = birth.year * 12 + (birth.month - 1);
  const cutoff = (today.year - 13) * 12 + (today.month - 1);
  return birthIndex < cutoff;
}
