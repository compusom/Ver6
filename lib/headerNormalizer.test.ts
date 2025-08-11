import { describe, it, expect } from 'vitest';
import { dedupeHeaders, normalize } from './headerNormalizer.js';

describe('headerNormalizer', () => {
  it('normalizes headers', () => {
    expect(normalize('Impresiones')).toBe('impresiones');
    expect(normalize('CPC (todos)')).toBe('cpc_todos');
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
