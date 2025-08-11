import { describe, it, expect } from 'vitest';
import { mapHeaders, normHeader } from './headerNormalizer.js';

describe('headerNormalizer', () => {
  it('normalizes headers', () => {
    expect(normHeader('Impresiones')).toBe('impresiones');
    expect(normHeader('CPC (todos)')).toBe('cpc todos');
  });

  it('maps and dedupes headers with accents', () => {
    const res = mapHeaders(['Nombre de la campaña', 'Nombre de la campana']);
    expect(res).toEqual(['campaign_name', 'campaign_name_2']);
  });

  it('handles compras vs % compras', () => {
    const res = mapHeaders(['Compras', '% Compras']);
    expect(res).toEqual(['purchases', 'purchases_pct']);
  });

  it('dedupes after mapping', () => {
    const res = mapHeaders(['Compras', 'Compras']);
    expect(res).toEqual(['purchases', 'purchases_2']);
  });
});
