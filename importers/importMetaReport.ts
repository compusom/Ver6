import { read, utils } from 'xlsx';
import { MetaDb, MetaMetricRow } from '../database/MetaDb.js';
import normalizeName from '../lib/normalizeName.js';
import Logger from '../Logger.js';

/**
 * Import Meta report from an ArrayBuffer/Buffer. Parses Excel, creates/uses client, and upserts metrics.
 */
export async function importMetaReport(data: ArrayBuffer, db: MetaDb) {
  const workbook = read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<any>(sheet);

  if (rows.length === 0) {
    Logger.warn('[importMetaReport] No rows in file');
    return { processed: 0, inserted: 0, updated: 0, discarded: 0 };
  }

  const first = rows[0];
  const rawName = first['account_name'] || first['Account name'] || first['nombre de la cuenta'] || '';
  const nameNorm = normalizeName(String(rawName));
  let client = await db.getClientByNameNorm(nameNorm);
  if (!client) {
    client = { id: '', name: String(rawName), nameNorm, logo: '', currency: '', userId: '' };
    const id = await db.upsertClient(client);
    client.id = String(id);
    Logger.info(`[importMetaReport] Created client ${client.name} (${id})`);
  }

  const metricRows: MetaMetricRow[] = [];
  let discarded = 0;
  for (const r of rows) {
    const date = r['date'] || r['day'] || r['día'];
    const adId = r['ad_id'] || r['Ad ID'] || r['ad id'];
    if (!date || !adId) {
      discarded++;
      continue;
    }
    const row: MetaMetricRow = {
      clientId: Number(client.id),
      date: new Date(date).toISOString().slice(0, 10),
      adId: String(adId),
      spend: r['spend'] || r['amount_spent (eur)'] || r['importe gastado (eur)'],
    };
    if (r['days_detected'] === undefined) row['days_detected'] = 0;
    metricRows.push(row);
  }

  const result = await db.upsertMetaMetrics(metricRows);
  Logger.info(`[importMetaReport] processed=${metricRows.length} inserted=${result.inserted} updated=${result.updated} discarded=${discarded}`);
  return { processed: metricRows.length, inserted: result.inserted, updated: result.updated, discarded };
}
export default importMetaReport;
