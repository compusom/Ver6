import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import adIdFromName from './adIdFromName';

describe('adIdFromName', () => {
  it('derives deterministic id from normalized name', () => {
    const raw = '  Ád Prueba  ';
    const normalized = 'ad prueba';
    const expectedHash = crypto.createHash('sha1').update(normalized).digest('hex');
    const expected = `H_${expectedHash}`;
    expect(adIdFromName(raw)).toBe(expected);
  });

  it('returns consistent value for same name regardless of casing/spacing', () => {
    const a = adIdFromName('My Ad Name');
    const b = adIdFromName('  my   ad name ');
    expect(a).toBe(b);
  });
});
