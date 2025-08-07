import { describe, it, expect } from 'vitest';
import { SQL_TABLE_DEFINITIONS } from './sqlTables.js';

function normalizeKey(key: string) {
  return key
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
}

describe('METRIC_COLUMN_MAP', () => {
  it('includes edad and sexo columns', () => {
    const defs = SQL_TABLE_DEFINITIONS.metricas
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('['))
      .map(line => {
        const name = line.slice(1, line.indexOf(']'));
        const type = line.slice(line.indexOf(']') + 1).replace(/[,\s]+$/g, '').trim();
        return { name, type };
      });

    const map = new Map(defs.map(def => [normalizeKey(def.name), def.name]));
    expect(map.get('edad')).toBe('edad');
    expect(map.get('sexo')).toBe('sexo');
  });
});
