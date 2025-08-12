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
export const HEADER_MAP: Record<string, string> = {
  'dia': 'date',
  'nombre de la cuenta': 'account_name',
  'nombre del anuncio': 'ad_name',
  'nombre del conjunto de anuncios': 'adset_name',
  'nombre de la campana': 'campaign_name',
  'importe gastado eur': 'spend',
  'impresiones': 'impressions',
  'clics todos': 'clicks',
  'cpc todos': 'cpc',
  'cpm costo por mil impresiones': 'cpm',
  'ctr todos': 'ctr',
  'valor de conversion de compras': 'value',
  'compras': 'purchases',
  '% compras': 'purchases_pct',
  'porcentaje de compras': 'purchases_pct',
  'visitas a la pagina de destino': 'landing_page_views',
  'pagos iniciados': 'initiate_checkout',
  'divisa': 'currency_code',
  'ctr porcentaje de clics en el enlace': 'ctr_link_pct',
  'ctr unico porcentaje de clics en el enlace': 'unique_ctr_link_pct',
};
export function mapHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map(h => {
    const n = normHeader(h);
    let k = HEADER_MAP[n] ?? n;
    if (k === 'purchases' && /%/.test(h)) k = 'purchases_pct';
    const c = (seen.get(k) ?? 0) + 1;
    seen.set(k, c);
    return c === 1 ? k : `${k}_${c}`;
  });
}

export default { normHeader, mapHeaders, HEADER_MAP };
