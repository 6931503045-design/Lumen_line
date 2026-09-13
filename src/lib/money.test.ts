import { describe, expect, it } from 'vitest';

import { addSatang, formatBaht, toSatang } from './money.js';

describe('money utilities', () => {
  it('converts baht to satang safely', () => {
    expect(toSatang('80')).toBe(8000);
    expect(toSatang('1,250.50')).toBe(125050);
    expect(toSatang('0.10')).toBe(10);
  });

  it('avoids floating point errors for decimal addition', () => {
    expect(addSatang(toSatang('0.10'), toSatang('0.20'))).toBe(30);
  });

  it('formats satang into baht string', () => {
    expect(formatBaht(125050)).toBe('1250.50');
    expect(formatBaht(10)).toBe('0.10');
  });

  it('rejects invalid money input', () => {
    expect(() => toSatang('abc')).toThrow();
    expect(() => toSatang('-5')).toThrow();
  });
});
