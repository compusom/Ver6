import { read, utils } from 'xlsx';
import { MetaDb, LookerUrlRow } from '../database/MetaDb.js';
import normalizeName from '../lib/normalizeName.js';
import Logger from '../Logger.js';

export interface LookerImportResult {
  total: number;
  updated: number;
  unmatched: Record<string, string[]>; // account -> identifiers
}

/**
 * Import Looker report from an ArrayBuffer/Buffer. Updates ad URLs by matching on client + ad_id or ad_name_norm.
 */
export async function importLookerReport(data: ArrayBuffer, db: MetaDb): Promise<LookerImportResult> {
  const workbook = read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<any>(sheet);
  if (rows.length === 0) {
    Logger.warn('[importLookerReport] No rows in file');
    return { total: 0, updated: 0, unmatched: {} };
  }

  const staging: LookerUrlRow[] = [];
  const unmatched: { account: string; id: string }[] = [];
  const clientNames: Record<number, string> = {};

  for (const r of rows) {
    const rawAccount = r['account_name'] || r['Account name'] || r['nombre de la cuenta'] || '';
    const client = await db.getClientByNameNorm(normalizeName(String(rawAccount)));
    const adId = r['ad_id'] || r['Ad ID'] || r['ad id'];
    const adName = r['ad_name'] || r['Ad name'] || r['nombre del anuncio'];
    const adNameNorm = adName ? normalizeName(String(adName)) : undefined;
    const preview = r['ad_preview_link'] || r['Ad Preview Link'];
    const thumb = r['ad_creative_thumbnail_url'] || r['Ad Creative Thumbnail Url'];
    const identifier = adId ? String(adId) : adNameNorm || '';

    if (!client) {
      unmatched.push({ account: String(rawAccount), id: identifier });
      continue;
    }
    clientNames[Number(client.id)] = client.name;
    staging.push({
      clientId: Number(client.id),
      adId: adId ? String(adId) : undefined,
      adNameNorm,
      adPreviewLink: preview,
      adCreativeThumbnailUrl: thumb,
    });
  }

  const dbResult = await db.updateAdUrls(staging);
  dbResult.unmatched.forEach(u => {
    const account = clientNames[u.clientId] || String(u.clientId);
    const id = u.adId ? u.adId : u.adNameNorm || '';
    unmatched.push({ account, id });
  });

  const grouped: Record<string, string[]> = {};
  unmatched.forEach(u => {
    if (!grouped[u.account]) grouped[u.account] = [];
    grouped[u.account].push(u.id);
  });

  Logger.info(`{importLookerReport} processed=${rows.length} updated=${dbResult.updated} unmatched=${unmatched.length}`);
  return { total: rows.length, updated: dbResult.updated, unmatched: grouped };
}

export default importLookerReport;
