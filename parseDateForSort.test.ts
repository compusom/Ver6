import { describe, it, expect } from 'vitest';
import { parseDateForSort } from './lib/parseDateForSort.js';

describe('parseDateForSort', () => {
  it('parses DD/MM/YYYY strings', () => {
    const d = parseDateForSort('09/11/2023');
    expect(d?.toISOString().startsWith('2023-11-09')).toBe(true);
  });

  it('parses Excel serial numbers', () => {
    const d = parseDateForSort(45239);
    expect(d?.toISOString().startsWith('2023-11-09')).toBe(true);
  });

  it('parses numeric strings', () => {
    const d = parseDateForSort('45239');
    expect(d?.toISOString().startsWith('2023-11-09')).toBe(true);
  });

  it('parses DD-MM-YYYY strings', () => {
    const d = parseDateForSort('09-11-2023');
    expect(d?.toISOString().startsWith('2023-11-09')).toBe(true);
  });

  it('preserves time for fractional Excel serials', () => {
    const d = parseDateForSort(45239.5);
    expect(d?.toISOString()).toBe('2023-11-09T12:00:00.000Z');
  });

  it('handles Date objects', () => {
    const src = new Date('2024-05-15T00:00:00Z');
    const d = parseDateForSort(src);
    expect(d?.toISOString()).toBe(src.toISOString());
  });
});
