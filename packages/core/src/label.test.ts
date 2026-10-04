import { describe, expect, it } from 'vitest';
import { parseLabelCode } from './label.ts';

const HOST = 'tendril.app';

describe('parseLabelCode', () => {
  it('reads a web link', () => {
    expect(parseLabelCode('https://tendril.app/l/ab12-cd', HOST)).toBe('AB12-CD');
    expect(parseLabelCode('  https://tendril.app/l/K7Q2/  ', HOST)).toBe('K7Q2');
    expect(parseLabelCode('https://TENDRIL.app/l/k7q2?src=qr#x', HOST)).toBe('K7Q2');
  });
  it('reads an app link', () => {
    expect(parseLabelCode('tendril://l/k7q2', HOST)).toBe('K7Q2');
    expect(parseLabelCode('TENDRIL://l/K7Q2', HOST)).toBe('K7Q2');
  });
  it('reads a bare code, in any case', () => {
    expect(parseLabelCode('k7q2-9x', HOST)).toBe('K7Q2-9X');
    expect(parseLabelCode('ABCD', HOST)).toBe('ABCD');
  });
  it('rejects links to other hosts or paths', () => {
    expect(parseLabelCode('https://evil.example/l/K7Q2', HOST)).toBeNull();
    expect(parseLabelCode('https://tendril.app.evil.example/l/K7Q2', HOST)).toBeNull();
    expect(parseLabelCode('https://tendril.app/i/K7Q2', HOST)).toBeNull();
    expect(parseLabelCode('http://tendril.app/l/K7Q2', HOST)).toBeNull();
    expect(parseLabelCode('tendril://i/K7Q2', HOST)).toBeNull();
  });
  it('rejects codes of the wrong shape', () => {
    expect(parseLabelCode('', HOST)).toBeNull();
    expect(parseLabelCode('ABC', HOST)).toBeNull();
    expect(parseLabelCode('A'.repeat(33), HOST)).toBeNull();
    expect(parseLabelCode('AB CD', HOST)).toBeNull();
    expect(parseLabelCode('AB_CD', HOST)).toBeNull();
    expect(parseLabelCode('https://tendril.app/l/AB', HOST)).toBeNull();
  });
});
