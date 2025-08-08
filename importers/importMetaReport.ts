import { read, utils } from 'xlsx';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { MetaDb, MetaMetricRow, MetaAdRow } from '../database/MetaDb.js';
import normalizeName from '../lib/normalizeName.js';
import adIdFromName from '../lib/adIdFromName.js';
import Logger from '../Logger.js';

/**
 * Import Meta report from an ArrayBuffer/Buffer. Parses Excel, creates/uses client, and upserts metrics.
 */
export async function importMetaReport(data: ArrayBuffer, db: MetaDb) {
  const workbook = read(data, { type: 'array' });
  const sheet = workbook.Sheets['Raw Data Report'] || workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<any>(sheet);

  if (rows.length === 0) {
    Logger.warn('[importMetaReport] No rows in file');
    return { total: 0, inserted: 0, updated: 0, skipped: 0 };
  }

  const first = rows[0];
  const rawName = first['account_name'] || first['Account name'] || first['nombre de la cuenta'] || '';
  const nameNorm = normalizeName(String(rawName));
  let client = await db.findClientByNameNorm(nameNorm);
  if (!client) {
    const rl = createInterface({ input, output });
    const answer = (await rl.question(`Client "${rawName}" not found. Create? (y/N): `)).trim().toLowerCase();
    rl.close();
    if (answer !== 'y') {
      Logger.warn('[importMetaReport] Aborted import - client not created');
      return { total: 0, inserted: 0, updated: 0, skipped: rows.length };
    }
    client = { id: '', name: String(rawName), nameNorm, logo: '', currency: '', userId: '' };
    const id = await db.createClient({ name: client.name, nameNorm });
    client.id = id;
    Logger.info(`[importMetaReport] Created client ${client.name} (${id})`);
  }

  const agg: Map<string, { row: MetaMetricRow; purchase_value: number }> = new Map();
  const adMap: Map<string, MetaAdRow> = new Map();
  let discarded = 0;

  const parseDate = (val: any) => {
    if (!val) return '';
    const parts = String(val).split(/[-\/]/);
    if (parts.length === 3) {
      const [d, m, y] = parts;
      const year = y.length === 2 ? `20${y}` : y;
      return `${year.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const dt = new Date(val);
    if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    return '';
  };

  const parseNum = (v: any): number => {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') return v;
    const cleaned = String(v).replace(/[€$,]/g, '').replace(/\./g, '').replace(/,/g, '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  for (const r of rows) {
    const rawDate = r['Día'] ?? r['day'] ?? r['date'];
    const adName = r['Nombre del anuncio'] ?? r['Ad name'] ?? r['ad_name'];
    if (!rawDate || !adName) {
      discarded++;
      continue;
    }
    const date = parseDate(rawDate);
    const adId = adIdFromName(String(adName));

    const key = `${date}|${adId}`;
    if (!agg.has(key)) {
      agg.set(key, {
        row: {
          clientId: client.id,
          date,
          adId,
          impressions: 0,
          clicks: 0,
          spend: 0,
          purchases: 0,
          roas: null,
        },
        purchase_value: 0,
      });
    }
    const entry = agg.get(key)!;
    entry.row.impressions! += parseNum(r['Impresiones']);
    entry.row.clicks! += parseNum(r['Clics en el enlace'] ?? r['Clics (todos)']);
    entry.row.spend! += parseNum(r['Importe gastado (EUR)']);
    entry.row.purchases! += parseNum(r['Compras']);
    entry.purchase_value += parseNum(r['Valor de conversión de compras']);

    const adRow: MetaAdRow = {
      clientId: client.id,
      adId,
      name: String(adName),
      nameNorm: normalizeName(String(adName)),
    };
    const adKey = `${adRow.clientId}-${adRow.adId}`;
    if (!adMap.has(adKey)) adMap.set(adKey, adRow);
  }

  const metricRows: MetaMetricRow[] = [];
  agg.forEach(v => {
    if (v.row.spend && v.row.spend > 0 && v.purchase_value) {
      v.row.roas = v.purchase_value / (v.row.spend ?? 1);
    }
    metricRows.push(v.row);
  });

  const adsResult = await db.upsertAds([...adMap.values()]);
  const result = await db.upsertMetaMetrics(metricRows);
  Logger.info(`[importMetaReport] processed=${metricRows.length} inserted=${result.inserted} updated=${result.updated} skipped=${discarded} adsIns=${adsResult.inserted} adsUpd=${adsResult.updated}`);
  return { total: metricRows.length, inserted: result.inserted, updated: result.updated, skipped: discarded };
}
export default importMetaReport;
