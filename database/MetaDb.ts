import { Client } from '../types.js';
import normalizeName from '../lib/normalizeName.js';
import crypto from 'crypto';
import sql from 'mssql';

export interface MetaMetricRow {
  clientId: string;
  date: string;
  adId: string | null;
  campaignId?: string | null;
  adsetId?: string | null;
  impressions?: number | null;
  clicks?: number | null;
  spend?: number | null;
  purchases?: number | null;
  roas?: number | null;
  days_detected?: number;
  [key: string]: any;
}

export interface MetaAdRow {
  clientId: string;
  adId: string;
  name: string;
  nameNorm: string;
  adPreviewLink?: string;
  adCreativeThumbnailUrl?: string;
}

export interface LookerUrlRow {
  clientId: string;
  adId?: string;
  adNameNorm?: string;
  adPreviewLink?: string;
  adCreativeThumbnailUrl?: string;
}

export interface MetaDb {
  findClientByNameNorm(nameNorm: string): Promise<Client | undefined>;
  createClient(client: { name: string; nameNorm: string }): Promise<string>;
  upsertAds(rows: MetaAdRow[]): Promise<{ inserted: number; updated: number }>;
  upsertMetaMetrics(rows: MetaMetricRow[]): Promise<{ inserted: number; updated: number }>;
  updateAdUrls(rows: LookerUrlRow[]): Promise<{ updated: number; unmatched: LookerUrlRow[] }>;
}

export function createMetaDb(): MetaDb {
  if (process.env.SQLSERVER_HOST) {
    return new MetaDbSql();
  }
  return new MetaDbLocal();
}

class MetaDbLocal implements MetaDb {
  private clients: Map<string, Client> = new Map();
  private metrics: Map<string, any> = new Map();
  private ads: Map<string, MetaAdRow> = new Map();

  async findClientByNameNorm(nameNorm: string): Promise<Client | undefined> {
    for (const c of this.clients.values()) {
      if (c.nameNorm === nameNorm) return c;
    }
    return undefined;
  }

  async createClient(client: { name: string; nameNorm: string }): Promise<string> {
    const existing = await this.findClientByNameNorm(client.nameNorm);
    if (existing) {
      existing.name = client.name;
      this.clients.set(existing.id, existing);
      return existing.id;
    }
    const id = crypto.randomUUID();
    const newClient: Client = { id, name: client.name, nameNorm: client.nameNorm, logo: '', currency: '', userId: '' };
    this.clients.set(id, newClient);
    return id;
  }

  async upsertAds(rows: MetaAdRow[]): Promise<{ inserted: number; updated: number }> {
    let inserted = 0;
    let updated = 0;
    for (const row of rows) {
      const key = `${row.clientId}-${row.adId}`;
      const existing = this.ads.get(key);
      if (existing) {
        this.ads.set(key, { ...existing, ...row });
        updated++;
      } else {
        this.ads.set(key, row);
        inserted++;
      }
    }
    return { inserted, updated };
  }

  async upsertMetaMetrics(rows: MetaMetricRow[]): Promise<{ inserted: number; updated: number }> {
    let inserted = 0;
    let updated = 0;
    for (const row of rows) {
      const key = `${row.clientId}-${row.date}-${row.adId}`;
      if (this.metrics.has(key)) {
        const existing = this.metrics.get(key);
        this.metrics.set(key, { ...existing, ...row });
        updated++;
      } else {
        this.metrics.set(key, row);
        inserted++;
      }
    }
    return { inserted, updated };
  }

  async updateAdUrls(rows: LookerUrlRow[]): Promise<{ updated: number; unmatched: LookerUrlRow[] }> {
    let updated = 0;
    const unmatched: LookerUrlRow[] = [];
    for (const row of rows) {
      let key: string | undefined;
      if (row.adId) {
        key = `${row.clientId}-${row.adId}`;
      } else if (row.adNameNorm) {
        for (const [k, ad] of this.ads.entries()) {
          if (ad.clientId === row.clientId && ad.nameNorm === row.adNameNorm) {
            key = k;
            break;
          }
        }
      }
      if (key && this.ads.has(key)) {
        const existing = this.ads.get(key)!;
        this.ads.set(key, { ...existing, adPreviewLink: row.adPreviewLink, adCreativeThumbnailUrl: row.adCreativeThumbnailUrl });
        updated++;
      } else {
        unmatched.push(row);
      }
    }
    return { updated, unmatched };
  }
}

class MetaDbSql implements MetaDb {
  private pool: Promise<sql.ConnectionPool>;
  constructor() {
    const cfg: sql.config = {
      server: process.env.SQLSERVER_HOST || 'localhost',
      database: process.env.SQLSERVER_DB || 'master',
      user: process.env.SQLSERVER_USER,
      password: process.env.SQLSERVER_PASS,
      options: { trustServerCertificate: true },
    };
    this.pool = sql.connect(cfg);
  }

  private async ensurePool() {
    return this.pool;
  }

  async findClientByNameNorm(nameNorm: string): Promise<Client | undefined> {
    const pool = await this.ensurePool();
    const result = await pool
      .request()
      .input('name_norm', sql.NVarChar(255), nameNorm)
      .query('SELECT TOP 1 client_id, name, name_norm FROM clients WHERE name_norm = @name_norm');
    const row = result.recordset[0];
    return row ? { id: String(row.client_id), name: row.name, nameNorm: row.name_norm, logo: '', currency: '', userId: '' } : undefined;
  }

  async createClient(client: { name: string; nameNorm: string }): Promise<string> {
    const pool = await this.ensurePool();
    const result = await pool
      .request()
      .input('name', sql.NVarChar(255), client.name)
      .input('name_norm', sql.NVarChar(255), client.nameNorm)
      .query(`DECLARE @out TABLE(client_id UNIQUEIDENTIFIER, name NVARCHAR(255), name_norm NVARCHAR(255), created_at DATETIME2);
MERGE dbo.clients AS T
USING (SELECT @name_norm AS name_norm, @name AS name) AS S
ON T.name_norm = S.name_norm
WHEN MATCHED THEN UPDATE SET name = S.name
WHEN NOT MATCHED THEN
  INSERT (client_id, name, name_norm) VALUES (NEWID(), S.name, S.name_norm)
OUTPUT inserted.client_id, inserted.name, inserted.name_norm, inserted.created_at INTO @out;
SELECT client_id, name, name_norm, created_at FROM @out;`);
    const row = result.recordset[0];
    return String(row.client_id);
  }

  async upsertAds(rows: MetaAdRow[]): Promise<{ inserted: number; updated: number }> {
    const pool = await this.ensurePool();
    let inserted = 0;
    let updated = 0;
    for (const row of rows) {
      const request = pool
        .request()
        .input('clientId', sql.UniqueIdentifier, row.clientId)
        .input('adId', sql.NVarChar(255), row.adId)
        .input('name', sql.NVarChar(255), row.name)
        .input('nameNorm', sql.NVarChar(255), row.nameNorm)
        .input('prev', sql.NVarChar(sql.MAX), row.adPreviewLink ?? null)
        .input('thumb', sql.NVarChar(sql.MAX), row.adCreativeThumbnailUrl ?? null);
      const result = await request.query(`
CREATE TABLE #actions (action NVARCHAR(10));
MERGE ads AS target
USING (SELECT @clientId AS client_id, @adId AS ad_id, @name AS name, @nameNorm AS ad_name_norm, @prev AS ad_preview_link, @thumb AS ad_creative_thumbnail_url) AS source
ON (target.client_id = source.client_id AND target.ad_id = source.ad_id)
WHEN MATCHED THEN UPDATE SET name = source.name, ad_name_norm = source.ad_name_norm, ad_preview_link = source.ad_preview_link, ad_creative_thumbnail_url = source.ad_creative_thumbnail_url
WHEN NOT MATCHED THEN INSERT (client_id, ad_id, name, ad_name_norm, ad_preview_link, ad_creative_thumbnail_url) VALUES (source.client_id, source.ad_id, source.name, source.ad_name_norm, source.ad_preview_link, source.ad_creative_thumbnail_url)
OUTPUT $action INTO #actions;
SELECT action FROM #actions;
DROP TABLE #actions;
`);
      const action = result.recordset[0]?.action;
      if (action === 'INSERT') inserted++; else updated++;
    }
    return { inserted, updated };
  }

  async upsertMetaMetrics(rows: MetaMetricRow[]): Promise<{ inserted: number; updated: number }> {
    const pool = await this.ensurePool();
    let inserted = 0;
    let updated = 0;
    for (const row of rows) {
      const request = pool
        .request()
        .input('clientId', sql.UniqueIdentifier, row.clientId)
        .input('date', sql.Date, row.date)
        .input('adId', sql.NVarChar(100), row.adId)
        .input('campaignId', sql.NVarChar(100), row.campaignId ?? null)
        .input('adsetId', sql.NVarChar(100), row.adsetId ?? null)
        .input('impressions', sql.BigInt, row.impressions ?? null)
        .input('clicks', sql.BigInt, row.clicks ?? null)
        .input('spend', sql.Decimal(18,4), row.spend ?? null)
        .input('purchases', sql.Int, row.purchases ?? null)
        .input('roas', sql.Decimal(18,4), row.roas ?? null)
        .input('daysDetected', sql.Int, row.days_detected ?? 0);
      const result = await request.query(`
CREATE TABLE #actions (action NVARCHAR(10));
MERGE facts_meta AS target
USING (SELECT @clientId AS client_id, @date AS [date], @adId AS ad_id, @campaignId AS campaign_id, @adsetId AS adset_id, @impressions AS impressions, @clicks AS clicks, @spend AS spend, @purchases AS purchases, @roas AS roas, @daysDetected AS days_detected) AS source
ON (target.client_id = source.client_id AND target.[date] = source.[date] AND ISNULL(target.ad_id,'') = ISNULL(source.ad_id,''))
WHEN MATCHED THEN UPDATE SET campaign_id = source.campaign_id, adset_id = source.adset_id, impressions = source.impressions, clicks = source.clicks, spend = source.spend, purchases = source.purchases, roas = source.roas, days_detected = source.days_detected
WHEN NOT MATCHED THEN INSERT (client_id, [date], ad_id, campaign_id, adset_id, impressions, clicks, spend, purchases, roas, days_detected) VALUES (source.client_id, source.[date], source.ad_id, source.campaign_id, source.adset_id, source.impressions, source.clicks, source.spend, source.purchases, source.roas, source.days_detected)
OUTPUT $action INTO #actions;
SELECT action FROM #actions;
DROP TABLE #actions;
`);
      const action = result.recordset[0]?.action;
      if (action === 'INSERT') inserted++; else updated++;
    }
    return { inserted, updated };
  }

  async updateAdUrls(rows: LookerUrlRow[]): Promise<{ updated: number; unmatched: LookerUrlRow[] }> {
    const pool = await this.ensurePool();
    const temp = new sql.Table('#looker');
    temp.create = true;
    temp.columns.add('client_id', sql.UniqueIdentifier, { nullable: false });
    temp.columns.add('ad_id', sql.NVarChar(255), { nullable: true });
    temp.columns.add('ad_name_norm', sql.NVarChar(255), { nullable: true });
    temp.columns.add('ad_preview_link', sql.NVarChar(sql.MAX), { nullable: true });
    temp.columns.add('ad_creative_thumbnail_url', sql.NVarChar(sql.MAX), { nullable: true });
    for (const r of rows) {
      temp.rows.add(r.clientId, r.adId ?? null, r.adNameNorm ?? null, r.adPreviewLink ?? null, r.adCreativeThumbnailUrl ?? null);
    }
    await pool.request().bulk(temp);
    const result = await pool.request().query(`
UPDATE ads
SET ad_preview_link = l.ad_preview_link, ad_creative_thumbnail_url = l.ad_creative_thumbnail_url
FROM ads a
JOIN #looker l ON a.client_id = l.client_id AND (a.ad_id = l.ad_id OR (l.ad_id IS NULL AND a.ad_name_norm = l.ad_name_norm));
SELECT COUNT(*) AS updated FROM #looker l
JOIN ads a ON a.client_id = l.client_id AND (a.ad_id = l.ad_id OR (l.ad_id IS NULL AND a.ad_name_norm = l.ad_name_norm));
SELECT l.client_id, l.ad_id, l.ad_name_norm FROM #looker l
LEFT JOIN ads a ON a.client_id = l.client_id AND (a.ad_id = l.ad_id OR (l.ad_id IS NULL AND a.ad_name_norm = l.ad_name_norm))
WHERE a.ad_id IS NULL;
DROP TABLE #looker;
`);
    const updated = result.recordsets[0][0]?.updated || 0;
    const unmatched: LookerUrlRow[] = result.recordsets[1].map((r: any) => ({ clientId: String(r.client_id), adId: r.ad_id ?? undefined, adNameNorm: r.ad_name_norm ?? undefined }));
    return { updated, unmatched };
  }
}
