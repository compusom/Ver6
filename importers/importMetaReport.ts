import { read, utils } from 'xlsx';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { MetaDb, MetaMetricRow, MetaAdRow } from '../database/MetaDb.js';
import Logger from '../Logger.js';
import { dedupeHeaders, HEADER_MAP } from '../lib/headerNormalizer.js';
import { toDateISO, toNumberES, normName } from '../lib/valueParsers.js';
import { synthAdId } from '../services/idsResolver.js';

/**
 * Import Meta report from an ArrayBuffer/Buffer. Parses Excel, creates/uses client, and upserts metrics.
 */
export async function importMetaReport(data: ArrayBuffer, db: MetaDb) {
  const workbook = read(data, { type: 'array' });
  const sheet = workbook.Sheets['Raw Data Report'] || workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });

  if (rows.length < 2) {
    Logger.warn('[importMetaReport] No rows in file');
    return { parsed: 0, valid: 0, missing_date: 0, missing_ad_name: 0 };
  }

  const headerRow = rows[0].map(h => String(h ?? ''));
  const dataRows = rows.slice(1);

  const normalized = dedupeHeaders(headerRow);
  const canonical = normalized.map(h => HEADER_MAP[h] ?? h);

  // prepare first row to resolve client
  const firstObj: any = {};
  for (let i = 0; i < canonical.length; i++) {
    firstObj[canonical[i]] = dataRows[0][i];
  }
  const rawName = firstObj['account_name'] || '';
  const nameNorm = normName(String(rawName));
  let client = await db.findClientByNameNorm(nameNorm);
  if (!client) {
    const rl = createInterface({ input, output });
    const answer = (await rl.question(`Client "${rawName}" not found. Create? (y/N): `)).trim().toLowerCase();
    rl.close();
    if (answer !== 'y') {
      Logger.warn('[importMetaReport] Aborted import - client not created');
      return { parsed: 0, valid: 0, missing_date: 0, missing_ad_name: 0 };
    }
    client = { id: '', name: String(rawName), nameNorm, logo: '', currency: '', userId: '' };
    const id = await db.createClient({ name: client.name, nameNorm });
    client.id = id;
    Logger.info(`[importMetaReport] Created client ${client.name} (${id})`);
  }

  const agg: Map<string, { row: MetaMetricRow; value: number }> = new Map();
  const adMap: Map<string, MetaAdRow> = new Map();
  let parsed = 0;
  let valid = 0;
  let missing_date = 0;
  let missing_ad_name = 0;
  const examples: Record<string, any> = {};

  for (const arr of dataRows) {
    parsed++;
    const obj: any = {};
    for (let i = 0; i < canonical.length; i++) {
      const key = canonical[i];
      obj[key] = arr[i];
    }
    const date = toDateISO(obj['date']);
    const adName = obj['ad_name'];
    if (!date) {
      missing_date++;
      if (!examples.missing_date) examples.missing_date = obj;
      continue;
    }
    if (!adName) {
      missing_ad_name++;
      if (!examples.missing_ad_name) examples.missing_ad_name = obj;
      continue;
    }
    valid++;
    const account = obj['account_name'];
    const campaign = obj['campaign_name'];
    const adset = obj['adset_name'];
    const adId = obj['ad_id'] ? String(obj['ad_id']) : synthAdId(account, campaign, adset, adName).toString();

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
        value: 0,
      });
    }
    const entry = agg.get(key)!;
    entry.row.impressions! += toNumberES(obj['impressions']) ?? 0;
    entry.row.clicks! += toNumberES(obj['clicks']) ?? 0;
    entry.row.spend! += toNumberES(obj['spend']) ?? 0;
    entry.row.purchases! += toNumberES(obj['purchases']) ?? 0;
    entry.value += toNumberES(obj['value']) ?? 0;

    const adRow: MetaAdRow = {
      clientId: client.id,
      adId,
      name: String(adName),
      nameNorm: normName(String(adName)),
    };
    const adKey = `${adRow.clientId}-${adRow.adId}`;
    if (!adMap.has(adKey)) adMap.set(adKey, adRow);
  }

  const metricRows: MetaMetricRow[] = [];
  agg.forEach(v => {
    if (v.row.spend && v.row.spend > 0 && v.value) {
      v.row.roas = v.value / (v.row.spend ?? 1);
    }
    metricRows.push(v.row);
  });

  const adsResult = await db.upsertAds([...adMap.values()]);
  const result = await db.upsertMetaMetrics(metricRows);
  Logger.info(
    `[importMetaReport] parsed=${parsed} valid=${valid} missing_date=${missing_date} missing_ad_name=${missing_ad_name} inserted=${result.inserted} updated=${result.updated} adsIns=${adsResult.inserted} adsUpd=${adsResult.updated}`
  );
  return { parsed, valid, missing_date, missing_ad_name };
}
export default importMetaReport;
