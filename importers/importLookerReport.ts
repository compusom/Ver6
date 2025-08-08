import { read, utils } from 'xlsx';
import { MetaDb, MetaAdRow } from '../database/MetaDb.js';
import normalizeName from '../lib/normalizeName.js';
import adIdFromName from '../lib/adIdFromName.js';
import Logger from '../Logger.js';

export interface LookerImportResult {
  total: number;
  inserted: number;
  updated: number;
  unmatched: string[]; // cuentas que no se encontraron
}

/**
 * Importa el reporte de Looker desde un ArrayBuffer/Buffer.
 * Upsertea en `ads` usando un ad_id DERIVADO del nombre del anuncio
 * (idéntico al de META) para que los previews/thumbnails empaten.
 */
export async function importLookerReport(
  data: ArrayBuffer,
  db: MetaDb
): Promise<LookerImportResult> {
  const workbook = read(data, { type: 'array' });
  const sheet =
    workbook.Sheets['Hoja 1'] ?? workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<any>(sheet);

  if (rows.length === 0) {
    Logger.warn('[importLookerReport] No rows in file');
    return { total: 0, inserted: 0, updated: 0, unmatched: [] };
  }

  const staging: MetaAdRow[] = [];
  const unmatched = new Set<string>();

  for (const r of rows) {
    // Nombre de cuenta (varias variantes según Looker/export)
    const rawAccount =
      r['account_name'] ||
      r['Account name'] ||
      r['Account Name'] ||
      r['nombre de la cuenta'] ||
      '';

    const accountNorm = normalizeName(String(rawAccount));
    const client = await db.findClientByNameNorm(accountNorm);

    if (!client) {
      if (rawAccount) unmatched.add(String(rawAccount));
      continue;
    }

    // Nombre del anuncio y ad_id derivado (mismo hashing que META)
    const adName = r['Ad name'] || r['Ad Name'] || r['Nombre del anuncio'] || '';
    const adId = adIdFromName(String(adName));
    const adNameNorm = normalizeName(String(adName));

    // Enlaces opcionales del reporte de Looker
    const preview: string | undefined =
      r['Ad Preview Link'] || r['ad_preview_link'] || undefined;

    const thumb: string | undefined =
      r['Ad Creative Thumbnail Url'] ||
      r['ad_creative_thumbnail_url'] ||
      undefined;

    // Adaptar a la forma que espera MetaDb.upsertAds
    staging.push({
      clientId: client.id, // OJO: si tu MetaDb usa client_id, ajusta aquí
      adId,
      name: String(adName),
      nameNorm: adNameNorm,
      adPreviewLink: preview,
      adCreativeThumbnailUrl: thumb,
    });
  }

  const dbResult = await db.upsertAds(staging);

  Logger.info(
    `[importLookerReport] processed=${rows.length} inserted=${dbResult.inserted} updated=${dbResult.updated} unmatched=${unmatched.size}`
  );

  return {
    total: rows.length,
    inserted: dbResult.inserted,
    updated: dbResult.updated,
    unmatched: Array.from(unmatched),
  };
}

export default importLookerReport;
