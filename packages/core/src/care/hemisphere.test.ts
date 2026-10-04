import { describe, expect, it } from 'vitest';
import { hemisphereLatitude, SOUTHERN_COUNTRY_CODES } from './hemisphere.ts';
import { season } from './engine.ts';

describe('hemisphereLatitude', () => {
  it('uses the cell latitude when it is known, north or south', () => {
    expect(hemisphereLatitude(53.35, 'AU')).toBe(53.35);
    expect(hemisphereLatitude(-33.87, 'IE')).toBe(-33.87);
    expect(hemisphereLatitude(0, 'NZ')).toBe(0);
  });

  it('falls back to -1 for a southern-hemisphere country', () => {
    expect(hemisphereLatitude(null, 'AU')).toBe(-1);
    expect(hemisphereLatitude(null, 'NZ')).toBe(-1);
    expect(hemisphereLatitude(null, 'TO')).toBe(-1);
  });

  it('is null (northern) for any other country or none', () => {
    expect(hemisphereLatitude(null, 'IE')).toBeNull();
    expect(hemisphereLatitude(null, 'US')).toBeNull();
    expect(hemisphereLatitude(null, 'BR')).toBeNull();
    expect(hemisphereLatitude(null, null)).toBeNull();
    expect(hemisphereLatitude(null, '')).toBeNull();
  });

  it('accepts a lower-case code and ignores an unreadable latitude', () => {
    expect(hemisphereLatitude(null, 'za')).toBe(-1);
    expect(hemisphereLatitude(Number.NaN, 'CL')).toBe(-1);
    expect(hemisphereLatitude(Number.POSITIVE_INFINITY, 'IE')).toBeNull();
  });

  it('lists exactly the agreed southern codes', () => {
    expect([...SOUTHERN_COUNTRY_CODES].sort()).toEqual(
      [
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
      ].sort(),
    );
  });

  it('feeds the engine season: July is winter in Australia without a cell', () => {
    expect(season(7, hemisphereLatitude(null, 'AU'))).toBe('winter');
    expect(season(7, hemisphereLatitude(null, 'IE'))).toBe('summer');
  });
});
