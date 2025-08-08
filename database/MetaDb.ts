import { Client } from '../types.js';
import normalizeName from '../lib/normalizeName.js';

export interface MetaMetricRow {
  clientId: number;
  date: string;
  adId: string;
  spend?: number;
  days_detected?: number;
  [key: string]: any;
}

export interface MetaAdRow {
  clientId: number;
  adId: string;
  name: string;
  nameNorm: string;
  adPreviewLink?: string;
  adCreativeThumbnailUrl?: string;
}

export interface LookerUrlRow {
  clientId: number;
  adId?: string;
  adNameNorm?: string;
  adPreviewLink?: string;
  adCreativeThumbnailUrl?: string;
}

export interface MetaDb {
  getClientByNameNorm(nameNorm: string): Promise<Client | undefined>;
  upsertClient(client: Client): Promise<number>;
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

  async getClientByNameNorm(nameNorm: string): Promise<Client | undefined> {
    for (const c of this.clients.values()) {
      if (c.nameNorm === nameNorm) return c;
    }
    return undefined;
  }

  async upsertClient(client: Client): Promise<number> {
    const nameNorm = client.nameNorm || normalizeName(client.name);
    let existing = await this.getClientByNameNorm(nameNorm);
    if (existing) {
      const merged = { ...existing, ...client, nameNorm };
      this.clients.set(existing.id, merged);
      return Number(existing.id);
    }
    const id = String(this.clients.size + 1);
    const newClient: Client = { ...client, id, nameNorm };
    this.clients.set(id, newClient);
    return Number(id);
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

import sql from 'mssql';

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

  async getClientByNameNorm(nameNorm: string): Promise<Client | undefined> {
    const pool = await this.ensurePool();
    const result = await pool
      .request()
      .input('nameNorm', sql.NVarChar, nameNorm)
      .query('SELECT TOP 1 id, name, name_norm FROM clients WHERE name_norm = @nameNorm');
    const row = result.recordset[0];
    return row ? { id: String(row.id), name: row.name, nameNorm: row.name_norm, logo: '', currency: '', userId: '' } : undefined;
  }

  async upsertClient(client: Client): Promise<number> {
    const pool = await this.ensurePool();
    const nameNorm = client.nameNorm || normalizeName(client.name);
    const result = await pool
      .request()
      .input('name', sql.NVarChar, client.name)
      .input('nameNorm', sql.NVarChar, nameNorm)
      .query(`MERGE clients AS target
ON target.name_norm = @nameNorm
WHEN MATCHED THEN UPDATE SET name = @name
WHEN NOT MATCHED THEN INSERT (name, name_norm) VALUES (@name, @nameNorm)
OUTPUT inserted.id;`);
    const id = result.recordset[0]?.id;
    return Number(id);
  }

  async upsertAds(rows: MetaAdRow[]): Promise<{ inserted: number; updated: number }> {
    const pool = await this.ensurePool();
    let inserted = 0;
    let updated = 0;
    for (const row of rows) {
      const request = pool
        .request()
        .input('clientId', sql.Int, row.clientId)
        .input('adId', sql.NVarChar, row.adId)
        .input('name', sql.NVarChar, row.name)
        .input('nameNorm', sql.NVarChar, row.nameNorm);
      const result = await request.query(`
CREATE TABLE #actions (action NVARCHAR(10));
MERGE ads AS target
USING (SELECT @clientId AS client_id, @adId AS ad_id, @name AS name, @nameNorm AS ad_name_norm) AS source
ON (target.client_id = source.client_id AND target.ad_id = source.ad_id)
WHEN MATCHED THEN UPDATE SET name = source.name, ad_name_norm = source.ad_name_norm
WHEN NOT MATCHED THEN INSERT (client_id, ad_id, name, ad_name_norm) VALUES (source.client_id, source.ad_id, source.name, source.ad_name_norm)
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
        .input('clientId', sql.Int, row.clientId)
        .input('date', sql.Date, row.date)
        .input('adId', sql.NVarChar, row.adId)
        .input('spend', sql.Decimal(18, 2), row.spend ?? null)
        .input('daysDetected', sql.Int, row.days_detected ?? 0);
      const result = await request.query(`
CREATE TABLE #actions (action NVARCHAR(10));
MERGE facts_meta AS target
USING (SELECT @clientId AS client_id, @date AS [date], @adId AS ad_id, @spend AS spend, @daysDetected AS days_detected) AS source
ON (target.client_id = source.client_id AND target.[date] = source.[date] AND target.ad_id = source.ad_id)
WHEN MATCHED THEN UPDATE SET spend = source.spend, days_detected = source.days_detected
WHEN NOT MATCHED THEN INSERT (client_id, [date], ad_id, spend, days_detected) VALUES (source.client_id, source.[date], source.ad_id, source.spend, source.days_detected)
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
    temp.columns.add('client_id', sql.Int, { nullable: false });
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
    const unmatched: LookerUrlRow[] = result.recordsets[1].map((r: any) => ({ clientId: r.client_id, adId: r.ad_id ?? undefined, adNameNorm: r.ad_name_norm ?? undefined }));
    return { updated, unmatched };
  }
}
