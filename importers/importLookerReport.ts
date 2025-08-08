import { read, utils } from 'xlsx';
import { MetaDb, MetaAdRow } from '../database/MetaDb.js';
import normalizeName from '../lib/normalizeName.js';
import adIdFromName from '../lib/adIdFromName.js';
import Logger from '../Logger.js';

export interface LookerImportResult {
  total: number;
  inserted: number;
  updated: number;
  unmatched: string[]; // accounts not found
}

/**
 * Import Looker report from an ArrayBuffer/Buffer. Upserts ads with preview/thumbnail
 * using ad_id derived from ad name.
 */
export async function importLookerReport(data: ArrayBuffer, db: MetaDb): Promise<LookerImportResult> {
  const workbook = read(data, { type: 'array' });
  const sheet = workbook.Sheets['Hoja 1'] || workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<any>(sheet);
  if (rows.length === 0) {
    Logger.warn('[importLookerReport] No rows in file');
    return { total: 0, inserted: 0, updated: 0, unmatched: [] };
  }

  const staging: MetaAdRow[] = [];
  const unmatched: string[] = [];

  for (const r of rows) {
    const rawAccount = r['account_name'] || r['Account name'] || r['Account Name'] || r['nombre de la cuenta'] || '';
    const client = await db.findClientByNameNorm(normalizeName(String(rawAccount)));
    if (!client) {
      unmatched.push(String(rawAccount));
      continue;
    }

    const adName = r['Ad name'] || r['Ad Name'] || r['Nombre del anuncio'] || '';
    const adId = adIdFromName(String(adName));
    const adNameNorm = normalizeName(String(adName));
    const preview = r['Ad Preview Link'] || r['ad_preview_link'];
    const thumb = r['Ad Creative Thumbnail Url'] || r['ad_creative_thumbnail_url'];

    staging.push({
      clientId: client.id,
      adId,
      name: String(adName),
      nameNorm: adNameNorm,
      adPreviewLink: preview,
      adCreativeThumbnailUrl: thumb,
    });
  }

  const dbResult = await db.upsertAds(staging);
  Logger.info(`{importLookerReport} processed=${rows.length} inserted=${dbResult.inserted} updated=${dbResult.updated} unmatched=${unmatched.length}`);
  return { total: rows.length, inserted: dbResult.inserted, updated: dbResult.updated, unmatched };
}

export default importLookerReport;
