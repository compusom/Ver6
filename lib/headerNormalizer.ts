export function normHeader(header: string): string {
  if (!header) return '';
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function dedupeHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map(h => {
    let norm = normHeader(h);
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

export const HEADER_MAP: Record<string, string> = {
  'nombre de la campaña': 'campaign_name',
  'nombre del conjunto de anuncios': 'adset_name',
  'nombre del anuncio': 'ad_name',
  dia: 'date',
  'importe gastado eur': 'spend',
  impresiones: 'impressions',
  'clics todos': 'clicks',
  'cpc todos': 'cpc',
  'cpm costo por mil impresiones': 'cpm',
  'ctr todos': 'ctr',
  'valor de conversion de compras': 'value',
  compras: 'purchases',
  'compras_pct': 'purchases_pct',
  'visitas a la pagina de destino': 'lpv',
  'pagos iniciados': 'init_checkout',
  'nombre de la cuenta': 'account_name',
};

export default { normHeader, dedupeHeaders, HEADER_MAP };
