import { describe, expect, it } from 'vitest';
import { distanceM, isInsideZone, randomizeZone } from './privacy.ts';

const home = { lat: 53.35, lng: -6.26 };
describe('privacy', () => {
  it('measures distance', () => {
    expect(distanceM(home, home)).toBe(0);
    expect(distanceM({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111195, -2);
  });
  it('randomised zones always still cover home, for any random draw', () => {
    for (const r of [0, 0.000001, 0.25, 0.5, 0.75, 0.999999]) {
      for (const s of [0, 0.33, 0.999999]) {
        let i = 0;
        const draws = [r, s];
        const zone = randomizeZone(home, 2000, () => draws[i++ % 2]!);
        expect(zone.radiusM).toBe(3000);
        expect(isInsideZone(home, zone)).toBe(true);
        expect(distanceM(home, zone.center)).toBeLessThanOrEqual(1000.5);
      }
    }
  });
  it('moves the centre away from home for most draws', () => {
    const zone = randomizeZone(home, 2000, () => 0.9);
    expect(distanceM(home, zone.center)).toBeGreaterThan(100);
  });
  it('points outside the zone are outside', () => {
    const zone = { center: home, radiusM: 1000 };
    expect(isInsideZone({ lat: 53.4, lng: -6.26 }, zone)).toBe(false);
  });
});
