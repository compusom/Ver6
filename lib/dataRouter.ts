import { DataSource } from '../constants';
import Logger from '../Logger';
import { localServerClient } from './localServerClient';
import { indexedDBManager } from './indexedDBManager';
import { Client, PerformanceRecord, ImportBatch } from '../types';

const fetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${url}`);
  }
  return res.json();
};

const normalizeClients = (data: any): Client[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.clients)) return data.clients;
  if (data && typeof data === 'object') {
    return Object.values(data).filter(v => typeof v === 'object') as Client[];
  }
  Logger.warn('[FETCH] clients response not array, defaulting to empty');
  return [];
};

const flattenRows = (value: any): PerformanceRecord[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap(v => Array.isArray((v as any)?.rows) ? (v as any).rows : (v as any));
  }
  if (Array.isArray((value as any).rows)) {
    return (value as any).rows;
  }
  return [];
};

const normalizePerformance = (raw: any): Record<string, PerformanceRecord[]> => {
  const result: Record<string, PerformanceRecord[]> = {};
  let total = 0;
  const data = raw?.data ?? raw;
  if (Array.isArray(data)) {
    const rows = flattenRows(data);
    const safeRows = Array.isArray(rows) ? rows : [];
    if (!Array.isArray(rows)) {
      Logger.warn('[FETCH] performanceData[default] rows missing or invalid');
    }
    if (safeRows.length > 0) {
      result['default'] = safeRows;
      total += safeRows.length;
    }
  } else if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      const rows = flattenRows(value);
      const safeRows = Array.isArray(rows) ? rows : [];
      if (!Array.isArray(rows)) {
        Logger.warn(`[FETCH] performanceData[${key}] rows missing or invalid`);
      }
      result[key] = safeRows;
      total += safeRows.length;
    }
  }
  if (result.default && Object.keys(result).length > 1) {
    delete result.default;
  }
  for (const key of Object.keys(result)) {
    if (!Array.isArray(result[key])) {
      Logger.warn(`[FETCH] performanceData[${key}] invalid, converting to empty array`);
      result[key] = [];
    }
  }
  Logger.info(`[FETCH] performance flattened rows=${total}`);
  return result;
};

export async function getClients(ds: DataSource): Promise<Client[]> {
  Logger.info('[FETCH]', { ds, resource: 'clients' });
  if (ds === DataSource.LOCAL) {
    const clients = await localServerClient.loadClients().catch(() => []);
    return normalizeClients(clients);
  }
  const data = await fetchJson('/api/sql/clients');
  return normalizeClients(data);
}

export async function getPerformance(ds: DataSource): Promise<Record<string, PerformanceRecord[]>> {
  Logger.info('[FETCH]', { ds, resource: 'performance' });
  if (ds === DataSource.LOCAL) {
    // Check if we have SQL Server connection for detailed data
    try {
      const statusRes = await fetch('/api/sql/status');
      const status = await statusRes.json();
      
      if (status.connected) {
        Logger.info('[FETCH] Using SQL Server detailed performance data');
        const data = await fetchJson('/api/sql/performance-details');
        return normalizePerformance(data);
      }
    } catch (error) {
      Logger.warn('[FETCH] SQL Server not available, falling back to local data:', error);
    }
    
    // Fallback to local data
    const raw = await localServerClient.loadPerformanceData().catch(() => ({}));
    return normalizePerformance(raw);
  }
  
  // For SQL data source, use detailed endpoint
  const data = await fetchJson('/api/sql/performance-details');
  return normalizePerformance(data);
}

export async function getImportHistory(ds: DataSource): Promise<ImportBatch[]> {
  Logger.info('[FETCH]', { ds, resource: 'import_history' });
  if (ds === DataSource.LOCAL) {
    return indexedDBManager.getImportHistory();
  }
  const data = await fetchJson('/api/sql/import-history');
  const history = data?.history ?? data;
  return Array.isArray(history) ? history : [];
}
