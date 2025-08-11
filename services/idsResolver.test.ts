import { describe, it, expect } from 'vitest';
import { synthAdId } from './idsResolver.js';

describe('idsResolver', () => {
  it('generates deterministic negative synthetic ids', () => {
    const id1 = synthAdId('acct', 'camp', 'set', 'ad');
    const id2 = synthAdId('acct', 'camp', 'set', 'ad');
    expect(id1).toBe(id2);
    expect(typeof id1).toBe('bigint');
    expect(id1 < 0n).toBe(true);
  });
});
