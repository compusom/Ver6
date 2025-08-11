import { describe, it, expect } from 'vitest';
import { toNumberES, toDateISO, toPct } from './valueParsers.js';

describe('valueParsers', () => {
  it('parses european numbers', () => {
    expect(toNumberES('1.234,56')).toBeCloseTo(1234.56);
  });

  it('parses d/m/y dates', () => {
    expect(toDateISO('31/07/2025')).toBe('2025-07-31');
  });

  it('parses percentages', () => {
    expect(toPct('5,43')).toBeCloseTo(0.0543);
    expect(toPct('0,54')).toBeCloseTo(0.54);
  });

  it('returns null for non-finite numbers', () => {
    expect(toNumberES('Infinity')).toBeNull();
  });
});
