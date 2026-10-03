import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { compareImages } from './compare.ts';

function solid(w: number, h: number, rgb: [number, number, number]): PNG {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) png.data.set([...rgb, 255], i * 4);
  return png;
}

describe('compareImages', () => {
  it('identical images differ by 0%', () => {
    expect(
      compareImages(solid(10, 10, [251, 250, 246]), solid(10, 10, [251, 250, 246])).diffPercent,
    ).toBe(0);
  });
  it('reports the share of differing pixels', () => {
    const a = solid(10, 10, [255, 255, 255]);
    const b = solid(10, 10, [255, 255, 255]);
    for (let i = 0; i < 25; i++) b.data.set([0, 0, 0, 255], i * 4);
    expect(compareImages(a, b).diffPercent).toBeCloseTo(25, 0);
  });
  it('compares only the overlapping area when sizes differ', () => {
    expect(compareImages(solid(10, 10, [1, 1, 1]), solid(12, 8, [1, 1, 1])).diffPercent).toBe(0);
  });
});
