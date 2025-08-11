export function normalize(header: string): string {
  if (!header) return '';
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '_');
}

export function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map(h => {
    let norm = normalize(h);
    if (norm === 'compras' && /%/.test(h)) {
      norm = 'compras_pct';
    }
    if (seen.has(norm)) {
      const count = (seen.get(norm) || 0) + 1;
      seen.set(norm, count);
      norm = `${norm}_${count}`;
    } else {
      seen.set(norm, 1);
    }
    return norm;
  });
}

export default { normalize, dedupeHeaders };
