import { read, utils } from 'xlsx';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { MetaDb, MetaMetricRow, MetaAdRow } from '../database/MetaDb.js';
import Logger from '../Logger.js';
import { mapHeaders } from '../lib/headerNormalizer.js';
import { toDateISO, toNumberES, normName, toPct } from '../lib/valueParsers.js';
import { synthAdId } from '../services/idsResolver.js';
import crypto from 'crypto';

/**
 * Import Meta report from an ArrayBuffer/Buffer. Parses Excel, creates/uses client, and upserts metrics.
 */
export async function importMetaReport(data: ArrayBuffer, db: MetaDb) {
  const hash = crypto.createHash('sha256').update(Buffer.from(data)).digest('hex');
  if (await db.hasFileHash(hash)) {
    Logger.info('[importMetaReport] File already processed');
    return { parsed: 0, valid: 0, skipped: 0, missing_date: 0, missing_ad_name: 0, totals_row_skipped: 0 };
  }
  const workbook = read(data, { type: 'array' });
  const sheet = workbook.Sheets['Raw Data Report'] || workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<any[]>(sheet, { header: 1, defval: null });

  if (rows.length < 2) {
    Logger.warn('[importMetaReport] No rows in file');
    return { parsed: 0, valid: 0, skipped: 0, missing_date: 0, missing_ad_name: 0, totals_row_skipped: 0 };
  }

  const headerRow = rows[0].map(h => String(h ?? ''));
  const dataRows = rows.slice(1);

  const canonical = mapHeaders(headerRow);

  // detect currency
  let detectedCurrency: string | undefined;
  const currencyIdx = canonical.indexOf('currency_code');
  if (currencyIdx >= 0) {
    const val = dataRows[0][currencyIdx];
    if (val) detectedCurrency = String(val).trim().toUpperCase();
  }
  if (!detectedCurrency) {
    const spendIdx = canonical.indexOf('spend');
    if (spendIdx >= 0) {
      const m = headerRow[spendIdx]?.match(/\((\w{3})\)/);
      if (m) detectedCurrency = m[1].toUpperCase();
    }
  }

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
      return { parsed: 0, valid: 0, skipped: 0, missing_date: 0, missing_ad_name: 0, totals_row_skipped: 0 };
    }
    client = { id: '', name: String(rawName), nameNorm, logo: '', currency: detectedCurrency || '', userId: '' };
    const id = await db.createClient({ name: client.name, nameNorm, currencyCode: detectedCurrency });
    client.id = id;
    Logger.info(`[importMetaReport] Created client ${client.name} (${id})`);
  } else if (detectedCurrency) {
    await db.setClientCurrencyIfNull(client.id, detectedCurrency);
    if (!client.currency) client.currency = detectedCurrency;
  }

  const adMap: Map<string, MetaAdRow> = new Map();
  const stagingRows: MetaMetricRow[] = [];
  let parsed = 0;
  let valid = 0;
  let missing_date = 0;
  let missing_ad_name = 0;
  let synthetic_ad_id = 0;
  let skipped = 0;
  let totals_row_skipped = 0;
  const examples: Record<string, any> = {};

  for (const arr of dataRows) {
    parsed++;
    const obj: any = {};
    for (let i = 0; i < canonical.length; i++) {
      const key = canonical[i];
      obj[key] = arr[i];
    }

    obj['date'] = toDateISO(obj['date']);
    for (const k of Object.keys(obj)) {
      if (k.endsWith('_pct')) obj[k] = toPct(obj[k]);
      else if (['impressions', 'clicks', 'spend', 'purchases', 'value'].includes(k)) obj[k] = toNumberES(obj[k]);
    }

    const date = obj['date'];
    const adName = obj['ad_name'];
    if (!date && !adName) {
      totals_row_skipped++;
      skipped++;
      if (!examples.totals_row_skipped) examples.totals_row_skipped = obj;
      continue;
    }
    if (!date) {
      missing_date++;
      skipped++;
      if (!examples.missing_date) examples.missing_date = obj;
      continue;
    }
    if (!adName) {
      missing_ad_name++;
      skipped++;
      if (!examples.missing_ad_name) examples.missing_ad_name = obj;
      continue;
    }
    const account = obj['account_name'] ?? '';
    const campaign = obj['campaign_name'] ?? '';
    const adset = obj['adset_name'] ?? '';
    let adId = obj['ad_id'] ? String(obj['ad_id']) : '';
    if (!adId) {
      adId = synthAdId(account, campaign, adset, adName).toString();
      synthetic_ad_id++;
    }
    obj['ad_id'] = adId; // ensure in examples
    valid++;

    stagingRows.push({
      clientId: client.id,
      date,
      adId,
      impressions: obj['impressions'],
      clicks: obj['clicks'],
      spend: obj['spend'],
      purchases: obj['purchases'],
      value: obj['value'],
    });

    const adRow: MetaAdRow = {
      clientId: client.id,
      adId,
      name: String(adName),
      nameNorm: normName(String(adName)),
    };
    const adKey = `${adRow.clientId}-${adRow.adId}`;
    if (!adMap.has(adKey)) adMap.set(adKey, adRow);
  }

  const adsResult = await db.upsertAds([...adMap.values()]);
  const stagingInserted = await db.bulkInsertStaging(stagingRows);
  const mergeResult = await db.mergeFromStaging(client.id);
  await db.saveFileHash(hash);

  Logger.info(
    `[importMetaReport] parsed=${parsed} valid=${valid} skipped=${skipped} totals_row=${totals_row_skipped} missing_date=${missing_date} missing_ad_name=${missing_ad_name} synthetic_ad_id=${synthetic_ad_id} staging_rows_inserted=${stagingInserted} merge_rows_ready=${mergeResult.ready} merge_inserted=${mergeResult.inserted} merge_updated=${mergeResult.updated} adsIns=${adsResult.inserted} adsUpd=${adsResult.updated}`
  );
  if (examples.totals_row_skipped) Logger.info('[importMetaReport] example totals_row_skipped', examples.totals_row_skipped);
  if (examples.missing_date) Logger.info('[importMetaReport] example missing_date', examples.missing_date);
  if (examples.missing_ad_name) Logger.info('[importMetaReport] example missing_ad_name', examples.missing_ad_name);
  return { parsed, valid, skipped, missing_date, missing_ad_name, totals_row_skipped };
}
export default importMetaReport;
