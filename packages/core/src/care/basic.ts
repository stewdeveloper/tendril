import type { IsoDate } from '../domain.ts';
import { addDays } from '../period.ts';

/** Days between soil checks: the curated override if set, else from the Plant.id watering range. */
export function baseIntervalDays(
  watering: { min: number | null; max: number | null },
  override: number | null,
): number {
  if (override !== null) return override;
  const values = [watering.min, watering.max].filter((v): v is number => v !== null);
  if (values.length === 0) return 7;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (avg <= 1.3) return 10;
  if (avg <= 2.3) return 7;
  return 4;
}

export function basicCheckIn(input: { today: IsoDate; soilDry: boolean; baseDays: number }): {
  waterTaskOn: IsoDate | null;
  nextCheckOn: IsoDate;
} {
  return input.soilDry
    ? { waterTaskOn: input.today, nextCheckOn: addDays(input.today, input.baseDays) }
    : { waterTaskOn: null, nextCheckOn: addDays(input.today, 2) };
}
