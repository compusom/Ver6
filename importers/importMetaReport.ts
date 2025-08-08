import { read, utils } from 'xlsx';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { MetaDb, MetaMetricRow, MetaAdRow } from '../database/MetaDb.js';
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

  const metricRows: MetaMetricRow[] = [];
  const adMap: Map<string, MetaAdRow> = new Map();
  let discarded = 0;
  for (const r of rows) {
    const date = r['date'] || r['day'] || r['día'];
    const adId = r['ad_id'] || r['Ad ID'] || r['ad id'];
    const adName = r['ad_name'] || r['Ad name'] || r['nombre del anuncio'];
    if (!date || !adId) {
      discarded++;
      continue;
    }
    const row: MetaMetricRow = {
      clientId: client.id,
      date: new Date(date).toISOString().slice(0, 10),
      adId: String(adId),
      spend: r['spend'] || r['amount_spent (eur)'] || r['importe gastado (eur)'],
    };
    if (r['days_detected'] === undefined) row['days_detected'] = 0;
    metricRows.push(row);
    if (adName) {
      const adRow: MetaAdRow = {
        clientId: client.id,
        adId: String(adId),
        name: String(adName),
        nameNorm: normalizeName(String(adName)),
      };
      const key = `${adRow.clientId}-${adRow.adId}`;
      if (!adMap.has(key)) adMap.set(key, adRow);
    }
  }

  const adsResult = await db.upsertAds([...adMap.values()]);
  const result = await db.upsertMetaMetrics(metricRows);
  Logger.info(`[importMetaReport] processed=${metricRows.length} inserted=${result.inserted} updated=${result.updated} skipped=${discarded} adsIns=${adsResult.inserted} adsUpd=${adsResult.updated}`);
  return { total: metricRows.length, inserted: result.inserted, updated: result.updated, skipped: discarded };
}
export default importMetaReport;
