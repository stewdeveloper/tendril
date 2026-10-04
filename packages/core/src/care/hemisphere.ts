/** Countries wholly or mostly in the southern hemisphere, by ISO 3166-1 alpha-2 code. */
export const SOUTHERN_COUNTRY_CODES: ReadonlySet<string> = new Set([
  'AU',
  'NZ',
  'ZA',
  'AR',
  'CL',
  'UY',
  'PY',
  'BO',
  'PE',
  'LS',
  'SZ',
  'NA',
  'BW',
  'ZW',
  'MZ',
  'MG',
  'MU',
  'FJ',
  'PG',
  'NC',
  'SB',
  'VU',
  'WS',
  'TO',
]);

/**
 * The latitude the engine judges the season by (only its sign matters): the plant's weather-cell latitude when
 * known, else -1 for a southern-hemisphere country, else null, which the engine reads as northern.
 */
export function hemisphereLatitude(
  cellLat: number | null,
  countryCode: string | null,
): number | null {
  if (cellLat !== null && Number.isFinite(cellLat)) return cellLat;
  if (countryCode && SOUTHERN_COUNTRY_CODES.has(countryCode.toUpperCase())) return -1;
  return null;
}
