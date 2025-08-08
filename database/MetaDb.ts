import { Client } from '../types.js';
import normalizeName from '../lib/normalizeName.js';

export interface MetaMetricRow {
  clientId: number;
  date: string;
  adId: string;
  [key: string]: any;
}

export interface MetaDb {
  getClientByNameNorm(nameNorm: string): Promise<Client | undefined>;
  upsertClient(client: Client): Promise<number>;
  upsertMetaMetrics(rows: MetaMetricRow[]): Promise<{ inserted: number; updated: number }>;
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
        .input('spend', sql.Decimal(18, 2), row.spend ?? null);
      const result = await request.query(`MERGE facts_meta AS target
USING (SELECT @clientId AS client_id, @date AS [date], @adId AS ad_id, @spend AS spend) AS source
ON (target.client_id = source.client_id AND target.[date] = source.[date] AND target.ad_id = source.ad_id)
WHEN MATCHED THEN UPDATE SET spend = source.spend
WHEN NOT MATCHED THEN INSERT (client_id, [date], ad_id, spend) VALUES (source.client_id, source.[date], source.ad_id, source.spend);
`);
      if (result.rowsAffected && result.rowsAffected[0] === 1) inserted++; else updated++;
    }
    return { inserted, updated };
  }
}
