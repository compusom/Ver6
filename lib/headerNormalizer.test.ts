import { describe, it, expect } from 'vitest';
import { dedupeHeaders, normHeader } from './headerNormalizer.js';

describe('headerNormalizer', () => {
  it('normalizes headers', () => {
    expect(normHeader('Impresiones')).toBe('impresiones');
    expect(normHeader('CPC (todos)')).toBe('cpc todos');
  });

  it('handles compras vs % compras', () => {
    const res = dedupeHeaders(['Compras', '% Compras']);
    expect(res).toEqual(['compras', 'compras_pct']);
  });

  it('dedupes repeated headers', () => {
    const res = dedupeHeaders(['foo', 'Foo']);
    expect(res).toEqual(['foo', 'foo_2']);
  });
});
