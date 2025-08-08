/**
 * Ver6 Local Server - Servidor local para persistencia de datos
 * 
 * Este servidor proporciona APIs REST para almacenar datos localmente
 * usando SQLite, permitiendo acceso desde cualquier navegador.
 * 
 * Características:
 * - Base de datos SQLite local (ver6_data.db)
 * - APIs REST para CRUD operations
 * - CORS habilitado para desarrollo
 * - Manejo de archivos y configuraciones
 * - Compatible con el sistema frontend existente
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import sql from 'mssql';
import xlsx from 'xlsx';
import crypto from 'crypto';
import logger from './serverLogger.js';
import { SQL_TABLE_DEFINITIONS, getCreationOrder, getDeletionOrder } from './sqlTables.js';
import { parseDateForSort } from './lib/parseDateForSort.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const BODY_LIMIT_MB = process.env.BODY_LIMIT_MB || '50mb';

// Database setup
const dbPath = join(__dirname, 'ver6_data.db');
const db = new Database(dbPath);

let sqlPool = null;

// Table creation/deletion order calculated from dependencies
const TABLE_CREATION_ORDER = getCreationOrder();
const TABLE_DELETION_ORDER = getDeletionOrder();

// Helper to normalize column names to match SQL schema

// Normaliza nombres de clientes para comparación y SQL
function normalizeName(input) {
    return (input || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

const normalizeKey = key =>
    key
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase();

// Extract column definitions from the metricas table for dynamic inserts and
// numeric conversion. Lines with the form "[column] TYPE" are parsed to obtain
// both the name and its SQL type.
const METRIC_COLUMN_DEFINITIONS = SQL_TABLE_DEFINITIONS.metricas
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('['))
    .map(line => {
        const name = line.slice(1, line.indexOf(']'));
        const type = line.slice(line.indexOf(']') + 1).replace(/[,\s]+$/g, '').trim();
        return { name, type };
    });

// Map normalized column names to their actual SQL names
const METRIC_COLUMN_MAP = new Map(
    METRIC_COLUMN_DEFINITIONS.map(def => [normalizeKey(def.name), def.name])
);

// Arrays/Sets of actual SQL column names for query generation and numeric detection
const METRIC_COLUMNS = Array.from(METRIC_COLUMN_MAP.values());
const NUMERIC_COLUMNS = new Set(
    METRIC_COLUMN_DEFINITIONS.filter(def => /INT|DECIMAL|BIGINT|FLOAT|REAL/i.test(def.type)).map(def => def.name)
);
const DATE_COLUMNS = new Set(
    METRIC_COLUMN_DEFINITIONS.filter(def => /DATE/i.test(def.type)).map(def => def.name)
);

// Mapear tipos de columnas SQL Server a tipos de mssql para parámetros preparados
function toMssqlType(sqlTypeStr) {
    if (!sqlTypeStr || typeof sqlTypeStr !== 'string') return sql.VarChar(sql.MAX);
    const t = sqlTypeStr.toUpperCase();
    // Extraer tamaños/precision si existen
    const dec = t.match(/DECIMAL\s*\((\d+)\s*,\s*(\d+)\)/);
    const numeric = t.match(/NUMERIC\s*\((\d+)\s*,\s*(\d+)\)/);
    const varchar = t.match(/VARCHAR\s*\((\d+)\)/);
    const nvarchar = t.match(/NVARCHAR\s*\((\d+)\)/);
    if (dec) return sql.Decimal(parseInt(dec[1], 10), parseInt(dec[2], 10));
    if (numeric) return sql.Numeric(parseInt(numeric[1], 10), parseInt(numeric[2], 10));
    if (t.includes('BIGINT')) return sql.BigInt;
    if (t.includes('INT')) return sql.Int;
    if (t.includes('FLOAT')) return sql.Float;
    if (t.includes('REAL')) return sql.Real;
    if (t.startsWith('DATE') && !t.includes('TIME')) return sql.Date;
    if (t.includes('DATETIME')) return sql.DateTime;
    if (t.includes('TEXT')) return sql.VarChar(sql.MAX);
    if (varchar) return sql.VarChar(parseInt(varchar[1], 10));
    if (nvarchar) return sql.NVarChar(parseInt(nvarchar[1], 10));
    // Fallback seguro
    return sql.VarChar(sql.MAX);
}

const MSSQL_TYPE_MAP = new Map(
    METRIC_COLUMN_DEFINITIONS.map(def => [def.name, toMssqlType(def.type)])
);

// Utility numeric parser mirroring the client-side logic
const parseNumber = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const cleaned = value
            .replace(/[€$]/g, '')
            .trim()
            .replace(/\./g, '')
            .replace(/,/g, '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    }
    return 0;
};

// Middleware
app.use(cors());
app.use(express.json({ limit: BODY_LIMIT_MB }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT_MB }));

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        cb(null, `${timestamp}-${file.originalname}`);
    }
});
const upload = multer({ storage });

// Initialize database tables
function initializeDatabase() {
    logger.info('[Server] Initializing SQLite database...');
    
    // Table for general key-value storage
    db.exec(`
        CREATE TABLE IF NOT EXISTS app_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            table_name TEXT NOT NULL,
            data_key TEXT,
            data_value TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(table_name, data_key)
        )
    `);

    // Table for performance records
    db.exec(`
        CREATE TABLE IF NOT EXISTS performance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT NOT NULL,
            record_data TEXT NOT NULL,
            batch_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Table for clients
    db.exec(`
        CREATE TABLE IF NOT EXISTS clients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Table for creative data
    db.exec(`
        CREATE TABLE IF NOT EXISTS creative_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT NOT NULL,
            creative_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Table for import history
    db.exec(`
        CREATE TABLE IF NOT EXISTS import_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    logger.info('[Server] ✅ Database tables initialized');
}

// Initialize database on startup
initializeDatabase();

// ==================== API ROUTES ====================

// --- SQL Server connection management ---
app.post('/api/sql/connect', async (req, res) => {
    const { server, port, database, user, password } = req.body || {};

    // Validación básica de parámetros
    const portIsValid = typeof port === 'string' && /^\d+$/.test(port);
    const portNumber = portIsValid ? parseInt(port, 10) : NaN;
    if (
        typeof server !== 'string' || !server.trim() ||
        !portIsValid || portNumber < 1 || portNumber > 65535 ||
        typeof database !== 'string' || !database.trim() ||
        typeof user !== 'string' || !user.trim() ||
        typeof password !== 'string' || !password.trim()
    ) {
        return res.status(400).json({ success: false, error: 'Invalid SQL connection parameters' });
    }

    const config = {
        server,
        port: portNumber,
        database,
        user,
        password,
        options: {
            encrypt: false, // Para SQL Server Express local
            trustServerCertificate: true, // Para certificados auto-firmados
            enableArithAbort: true
        }
    };

    try {
        if (sqlPool) {
            await sqlPool.close();
        }
        sqlPool = await new sql.ConnectionPool(config).connect();

        // Probar la conexión
        const result = await sqlPool.request().query('SELECT 1 as test');
        logger.info('[SQL] Conexión exitosa a SQL Server');

        // Ensure necessary tables and columns exist immediately after connecting
        try {
            await ensureSqlTables();
        } catch (migrationError) {
            logger.error('[SQL] Error ensuring tables:', migrationError.message);
            await sqlPool.close().catch(() => {});
            sqlPool = null;
            return res.status(500).json({ success: false, error: migrationError.message });
        }

        res.json({ success: true });
    } catch (error) {
        logger.error('[SQL] Error al conectar:', error.message);
        if (sqlPool) {
            await sqlPool.close().catch(() => {});
        }
        sqlPool = null;
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Listar nombres de tablas en SQL Server ---
app.get('/api/sql/tables', async (req, res) => {
    logger.info('[DEBUG] /api/sql/tables endpoint called');
    if (!sqlPool) {
        logger.info('[DEBUG] sqlPool is null, not connected to SQL Server');
        return res.status(400).json({ error: 'Not connected to SQL Server (pool is null)'});
    }
    try {
        logger.info('[DEBUG] sqlPool exists, attempting to query tables...');
        const result = await sqlPool.request().query(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `);
        const tables = result.recordset.map(row => row.TABLE_NAME);
        logger.info('[DEBUG] Tables found:', tables);
        res.json({ tables });
    } catch (error) {
        logger.error('[SQL] Error al consultar tablas:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sql/status', async (req, res) => {
    if (!sqlPool) {
        return res.json({ connected: false });
    }
    try {
        // Probar la conexión con SQL Server
        await sqlPool.request().query('SELECT 1 as test');
        res.json({ connected: true });
    } catch (error) {
        logger.error('[SQL] Error al verificar conexión:', error.message);
        if (sqlPool) {
            await sqlPool.close().catch(() => {});
        }
        sqlPool = null;
        res.json({ connected: false });
    }
});

app.get('/api/sql/permissions', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ error: 'Not connected' });
    }
    try {
        // Para SQL Server, verificamos permisos básicos
        const result = await sqlPool.request().query(`
            SELECT 
                HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'SELECT') as canSelect,
                HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'INSERT') as canInsert,
                HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'UPDATE') as canUpdate,
                HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'DELETE') as canDelete
        `);
        
        const permissions = result.recordset[0];
        res.json({ 
            permissions: {
                canSelect: Boolean(permissions.canSelect),
                canInsert: Boolean(permissions.canInsert),
                canUpdate: Boolean(permissions.canUpdate),
                canDelete: Boolean(permissions.canDelete)
            }
        });
    } catch (error) {
        logger.error('[SQL] Error al verificar permisos:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- Manage SQL Server tables ---
// Shared helper to initialize required tables and columns if they are missing.
async function ensureSqlTables() {
    const created = [];
    const altered = [];
    for (const table of TABLE_CREATION_ORDER) {
        const exists = await sqlPool
            .request()
            .query(`SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='${table}'`);
        if (exists.recordset.length === 0) {
            await sqlPool.request().query(SQL_TABLE_DEFINITIONS[table]);
            created.push(table);
        }
    }

    const columnCheck = await sqlPool
        .request()
        .query("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='archivos_reporte' AND COLUMN_NAME='days_detected'");
    if (columnCheck.recordset.length === 0) {
        await sqlPool.request().query('ALTER TABLE archivos_reporte ADD days_detected INT');
        altered.push('archivos_reporte.days_detected');
    }
    return { created, altered };
}

// Exposed route handler that wraps ensureSqlTables and reports results.
async function initSqlTables(req, res) {
    if (!sqlPool) {
        return res.status(400).json({ error: 'Not connected' });
    }


    const created = [];
    const altered = [];
    try {
        for (const table of TABLE_CREATION_ORDER) {
            // Check if table exists
            const exists = await sqlPool
                .request()
                .query(`SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='${table}'`);
            if (exists.recordset.length === 0) {
                await sqlPool.request().query(SQL_TABLE_DEFINITIONS[table]);
                created.push(table);
            }
        }

        // Ensure required columns exist on existing tables
        const columnCheck = await sqlPool
            .request()
            .query(`SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='archivos_reporte' AND COLUMN_NAME='days_detected'`);
        if (columnCheck.recordset.length === 0) {
            await sqlPool.request().query('ALTER TABLE archivos_reporte ADD days_detected INT');
            altered.push('archivos_reporte.days_detected');
        }

        // Ensure demographic columns exist on metricas table
        const edadCheck = await sqlPool
            .request()
            .query("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='metricas' AND COLUMN_NAME='edad'");
        if (edadCheck.recordset.length === 0) {
            await sqlPool.request().query("ALTER TABLE metricas ADD [edad] VARCHAR(50)");
            altered.push('metricas.edad');
        }
        const sexoCheck = await sqlPool
            .request()
            .query("SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='metricas' AND COLUMN_NAME='sexo'");
        if (sexoCheck.recordset.length === 0) {
            await sqlPool.request().query("ALTER TABLE metricas ADD [sexo] VARCHAR(50)");
            altered.push('metricas.sexo');
        }

        // Remove deprecated columns if they exist
        const obsoleteColumns = ['imagen_video_y_presentación', 'col_6'];
        for (const col of obsoleteColumns) {
            const chk = await sqlPool
                .request()
                .query(
                    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='metricas' AND COLUMN_NAME='${col}'`
                );
            if (chk.recordset.length > 0) {
                await sqlPool.request().query(`ALTER TABLE metricas DROP COLUMN [${col}]`);
                altered.push(`metricas.drop_${col}`);
            }
        }



        res.json({ success: true, created, altered });
    } catch (error) {
        logger.error('[SQL] Error creating tables:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Supports both POST (programmatic) and GET (manual browser check)
app.post('/api/sql/init-tables', initSqlTables);
app.get('/api/sql/init-tables', initSqlTables);

// Drops all known tables (children first to respect FKs)
app.delete('/api/sql/tables', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ error: 'Not connected' });
    }
    try {
        for (const table of TABLE_DELETION_ORDER) {
            await sqlPool
                .request()
                .query(`IF OBJECT_ID('${table}', 'U') IS NOT NULL DROP TABLE ${table};`);
        }
        res.json({ success: true });
    } catch (error) {
        logger.error('[SQL] Error dropping tables:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Deletes all data from tables without removing structure
app.delete('/api/sql/tables/data', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ error: 'Not connected' });
    }
    try {
        for (const table of TABLE_DELETION_ORDER) {
            await sqlPool
                .request()
                .query(`IF OBJECT_ID('${table}', 'U') IS NOT NULL DELETE FROM ${table};`);
        }
        res.json({ success: true });
    } catch (error) {
        logger.error('[SQL] Error clearing table data:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Import Meta Excel data into SQL Server ---
app.post('/api/sql/import-excel', upload.single('file'), async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ success: false, error: 'Not connected' });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    const confirmCreate = req.query.confirmCreate === '1';
    try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });
        if (rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Excel file is empty' });
        }
        const first = rows[0];
        const accountName = first['account_name'] || first['Account name'] || first['nombre_de_la_cuenta'] || first['Nombre de la cuenta'] || 'desconocido';
        const nameNorm = normalizeName(accountName);
        logger.info(`[SQL] Import META account="${accountName}" norm="${nameNorm}" confirm=${confirmCreate}`);
        let queryResult = await sqlPool
            .request()
            .input('name_norm', sql.NVarChar(255), nameNorm)
            .query('SELECT TOP 1 client_id FROM dbo.clients WHERE name_norm = @name_norm');
        let clientId;
        if (queryResult.recordset.length === 0) {
            if (!confirmCreate) {
                logger.info(`[SQL] Cliente no encontrado: ${nameNorm}, solicitando confirmación`);
                return res.status(409).json({ needsConfirmation: true, accountName, nameNorm });
            }
            const createRes = await sqlPool
                .request()
                .input('name', sql.NVarChar(255), accountName)
                .input('name_norm', sql.NVarChar(255), nameNorm)
                .query(`DECLARE @out TABLE(client_id UNIQUEIDENTIFIER, name NVARCHAR(255), name_norm NVARCHAR(255), created_at DATETIME2);
MERGE dbo.clients AS T
USING (SELECT @name_norm AS name_norm, @name AS name) AS S
ON T.name_norm = S.name_norm
WHEN MATCHED THEN UPDATE SET name = S.name
WHEN NOT MATCHED THEN
  INSERT (client_id, name, name_norm) VALUES (NEWID(), S.name, S.name_norm)
OUTPUT inserted.client_id, inserted.name, inserted.name_norm, inserted.created_at INTO @out;
SELECT client_id FROM @out;`);
            clientId = createRes.recordset[0].client_id;
            logger.info(`[SQL] Cliente creado: ${accountName} (${clientId})`);
        } else {
            clientId = queryResult.recordset[0].client_id;
        }
        const facts = [];
        for (const r of rows) {
            const d = parseDateForSort(r['date'] || r['day'] || r['día']);
            if (!d) continue;
            const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().split('T')[0];
            const adId = r['ad_id'] ? String(r['ad_id']).trim() : '';
            const campaignId = r['campaign_id'] || r['campaign id'] || '';
            const adsetId = r['adset_id'] || r['adset id'] || '';
            facts.push({
                client_id: clientId,
                date,
                ad_id: adId === '' ? null : adId,
                campaign_id: campaignId === '' ? null : campaignId,
                adset_id: adsetId === '' ? null : adsetId,
                impressions: r['impressions'] ?? null,
                clicks: r['clicks'] ?? null,
                spend: parseNumber(r['spend'] ?? r['amount_spent (eur)'] ?? null),
                purchases: r['purchases'] ?? null,
                roas: r['roas'] ?? null,
            });
        }

        const transaction = new sql.Transaction(sqlPool);
        await transaction.begin();
        try {
            const req = new sql.Request(transaction);
            await req.query(`CREATE TABLE #in_facts(
  client_id UNIQUEIDENTIFIER NOT NULL,
  [date] DATE NOT NULL,
  ad_id NVARCHAR(100) NULL,
  campaign_id NVARCHAR(100) NULL,
  adset_id NVARCHAR(100) NULL,
  impressions BIGINT NULL,
  clicks BIGINT NULL,
  spend DECIMAL(18,4) NULL,
  purchases INT NULL,
  roas DECIMAL(18,4) NULL
);`);

            const table = new sql.Table('#in_facts');
            table.create = false;
            table.columns.add('client_id', sql.UniqueIdentifier, { nullable: false });
            table.columns.add('date', sql.Date, { nullable: false });
            table.columns.add('ad_id', sql.NVarChar(100), { nullable: true });
            table.columns.add('campaign_id', sql.NVarChar(100), { nullable: true });
            table.columns.add('adset_id', sql.NVarChar(100), { nullable: true });
            table.columns.add('impressions', sql.BigInt, { nullable: true });
            table.columns.add('clicks', sql.BigInt, { nullable: true });
            table.columns.add('spend', sql.Decimal(18,4), { nullable: true });
            table.columns.add('purchases', sql.Int, { nullable: true });
            table.columns.add('roas', sql.Decimal(18,4), { nullable: true });
            for (const f of facts) {
                table.rows.add(
                    f.client_id,
                    f.date,
                    f.ad_id,
                    f.campaign_id,
                    f.adset_id,
                    f.impressions,
                    f.clicks,
                    f.spend,
                    f.purchases,
                    f.roas
                );
            }
            await req.bulk(table);

            const mergeRes = await req.query(`SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRAN;
  ;WITH D AS (
    SELECT client_id, [date], ad_id, campaign_id, adset_id,
           SUM(impressions) impressions, SUM(clicks) clicks,
           SUM(spend) spend, SUM(purchases) purchases, AVG(roas) roas
    FROM #in_facts
    GROUP BY client_id, [date], ad_id, campaign_id, adset_id
  ),
  A AS (
    MERGE dbo.facts_meta AS T
    USING D AS S
    ON (T.client_id = S.client_id AND T.[date] = S.[date] AND ISNULL(T.ad_id,'') = ISNULL(S.ad_id,''))
    WHEN MATCHED THEN
      UPDATE SET
        campaign_id = S.campaign_id,
        adset_id    = S.adset_id,
        impressions = S.impressions,
        clicks      = S.clicks,
        spend       = S.spend,
        purchases   = S.purchases,
        roas        = S.roas
    WHEN NOT MATCHED THEN
      INSERT (client_id,[date],ad_id,campaign_id,adset_id,impressions,clicks,spend,purchases,roas)
      VALUES (S.client_id,S.[date],S.ad_id,S.campaign_id,S.adset_id,S.impressions,S.clicks,S.spend,S.purchases,S.roas)
    OUTPUT $action AS action
  )
  SELECT
    SUM(CASE WHEN action='INSERT' THEN 1 ELSE 0 END) AS inserted,
    SUM(CASE WHEN action='UPDATE' THEN 1 ELSE 0 END) AS updated,
    COUNT(*) AS total
  FROM A;
  COMMIT;
END TRY
BEGIN CATCH
  DECLARE @n INT = ERROR_NUMBER(), @s INT = ERROR_STATE(), @m NVARCHAR(4000)=ERROR_MESSAGE(), @p NVARCHAR(128)=ERROR_PROCEDURE(), @l INT=ERROR_LINE();
  IF @@TRANCOUNT>0 ROLLBACK;
  SELECT @n AS error_number, @s AS error_state, @m AS error_message, @p AS error_proc, @l AS error_line;
END CATCH`);

            const resRow = mergeRes.recordset[0];
            if (resRow && resRow.error_number) {
                await transaction.rollback();
                logger.error('[SQL] Import merge error:', resRow);
                return res.status(500).json({ success: false, error: resRow });
            }

            await transaction.commit();

            const inserted = resRow.inserted || 0;
            const updated = resRow.updated || 0;
            const total = resRow.total || 0;
            logger.info(`[SQL] Import summary account="${accountName}" norm="${nameNorm}" inserted=${inserted} updated=${updated} total=${total}`);

            await sqlPool
                .request()
                .input('source', sql.NVarChar(50), 'sql')
                .input('batch_data', sql.NVarChar(sql.MAX), JSON.stringify({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), source: 'sql', fileName: req.file.originalname, accountName, nameNorm, summary: { inserted, updated, total } }))
                .query('INSERT INTO import_history (source, batch_data) VALUES (@source, @batch_data)');

            res.json({ inserted, updated, total });
        } catch (err) {
            await transaction.rollback();
            logger.error('[SQL] Error importing Excel:', err);
            res.status(500).json({ success: false, error: err.message });
        }
    } catch (error) {
        logger.error('[SQL] Error importing Excel:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        fs.unlink(req.file.path, () => {});
    }
});

// Get SQL import history
app.get('/api/sql/import-history', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ success: false, error: 'Not connected' });
    }
    try {
        const result = await sqlPool.request().query('SELECT batch_data FROM import_history ORDER BY created_at DESC');
        const history = result.recordset.map(r => JSON.parse(r.batch_data));
        res.json({ success: true, history });
    } catch (error) {
        logger.error('[Server] Error loading SQL import history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Ensure required SQL schema for Meta data
app.post('/api/sql/ensure-schema', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ ok: false, error: 'Not connected' });
    }
    logger.info('[SQL][EnsureSchema] start');
    const actions = [];
    try {
        const schemaSql = `
SET NOCOUNT ON;
DECLARE @actions TABLE(step NVARCHAR(100), detail NVARCHAR(4000), status NVARCHAR(50), rows INT NULL);

DECLARE @clients_client_id_type NVARCHAR(128);
DECLARE @facts_client_id_type   NVARCHAR(128);

SELECT @clients_client_id_type = TY.name
FROM sys.columns C
JOIN sys.types TY ON TY.user_type_id = C.user_type_id
WHERE C.object_id = OBJECT_ID('dbo.clients') AND C.name = 'client_id';

SELECT @facts_client_id_type = TY.name
FROM sys.columns C
JOIN sys.types TY ON TY.user_type_id = C.user_type_id
WHERE C.object_id = OBJECT_ID('dbo.facts_meta') AND C.name = 'client_id';

IF OBJECT_ID('dbo.clients','U') IS NULL
BEGIN
  CREATE TABLE dbo.clients(
    client_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    name_norm NVARCHAR(255) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_clients PRIMARY KEY (client_id)
  );
  INSERT INTO @actions VALUES('create-table','clients','ok',NULL);
  SET @clients_client_id_type = 'uniqueidentifier';
END;

IF COL_LENGTH('dbo.clients','client_id') IS NULL AND COL_LENGTH('dbo.clients','id') IS NOT NULL
BEGIN
  EXEC sp_rename 'dbo.clients.id', 'client_id', 'COLUMN';
  INSERT INTO @actions VALUES('rename-column','clients.id -> clients.client_id','ok',NULL);
  SET @clients_client_id_type = NULL;
END;

SELECT @clients_client_id_type = TY.name
FROM sys.columns C
JOIN sys.types TY ON TY.user_type_id = C.user_type_id
WHERE C.object_id = OBJECT_ID('dbo.clients') AND C.name = 'client_id';

IF @clients_client_id_type IS NOT NULL AND @clients_client_id_type <> 'uniqueidentifier'
BEGIN
  IF COL_LENGTH('dbo.clients','client_id_uid') IS NULL
    ALTER TABLE dbo.clients ADD client_id_uid UNIQUEIDENTIFIER NULL;

  IF COL_LENGTH('dbo.clients','client_id_uid') IS NOT NULL
    UPDATE dbo.clients SET client_id_uid = ISNULL(client_id_uid, NEWID());

  DECLARE @pk_clients sysname;
  SELECT @pk_clients = kc.name
  FROM sys.key_constraints kc
  WHERE kc.parent_object_id = OBJECT_ID('dbo.clients') AND kc.type='PK';
  IF @pk_clients IS NOT NULL
  BEGIN
    DECLARE @sql_drop_pk_clients NVARCHAR(MAX) = N'ALTER TABLE dbo.clients DROP CONSTRAINT ['+@pk_clients+N']';
    EXEC sp_executesql @sql_drop_pk_clients;
  END

  IF COL_LENGTH('dbo.clients','client_id_uid') IS NOT NULL
    ALTER TABLE dbo.clients ADD CONSTRAINT PK_clients PRIMARY KEY (client_id_uid);

  IF COL_LENGTH('dbo.clients','client_id') IS NOT NULL
    EXEC sp_rename 'dbo.clients.client_id', 'client_id_int', 'COLUMN';
  IF COL_LENGTH('dbo.clients','client_id_uid') IS NOT NULL
    EXEC sp_rename 'dbo.clients.client_id_uid', 'client_id', 'COLUMN';

  INSERT INTO @actions VALUES('migrate-type','clients.client_id int -> uniqueidentifier','ok',NULL);
END;

SELECT @clients_client_id_type = TY.name
FROM sys.columns C
JOIN sys.types TY ON TY.user_type_id = C.user_type_id
WHERE C.object_id = OBJECT_ID('dbo.clients') AND C.name = 'client_id';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UQ_clients_name_norm' AND object_id=OBJECT_ID('dbo.clients'))
  CREATE UNIQUE INDEX UQ_clients_name_norm ON dbo.clients(name_norm);

IF OBJECT_ID('dbo.facts_meta','U') IS NULL
BEGIN
  CREATE TABLE dbo.facts_meta(
    fact_id BIGINT IDENTITY(1,1) NOT NULL,
    client_id UNIQUEIDENTIFIER NULL,
    [date] DATE NOT NULL,
    ad_id NVARCHAR(100) NULL,
    campaign_id NVARCHAR(100) NULL,
    adset_id NVARCHAR(100) NULL,
    impressions BIGINT NULL,
    clicks BIGINT NULL,
    spend DECIMAL(18,4) NULL,
    purchases INT NULL,
    roas DECIMAL(18,4) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  INSERT INTO @actions VALUES('create-table','facts_meta','ok',NULL);
  SET @facts_client_id_type = 'uniqueidentifier';
END;

IF COL_LENGTH('dbo.facts_meta','ad_id_nz') IS NULL
BEGIN
  ALTER TABLE dbo.facts_meta ADD ad_id_nz AS (ISNULL(ad_id,'')) PERSISTED;
  INSERT INTO @actions VALUES('add-column','facts_meta.ad_id_nz (computed persisted)','ok',NULL);
END;

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_facts_meta_client_date_ad_nz' AND object_id=OBJECT_ID('dbo.facts_meta'))
BEGIN
  DROP INDEX [UX_facts_meta_client_date_ad_nz] ON dbo.facts_meta;
  INSERT INTO @actions VALUES('drop-index','UX_facts_meta_client_date_ad_nz','dropped',NULL);
END;

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_facts_meta_clients' AND parent_object_id=OBJECT_ID('dbo.facts_meta'))
BEGIN
  ALTER TABLE dbo.facts_meta DROP CONSTRAINT [FK_facts_meta_clients];
  INSERT INTO @actions VALUES('drop-fk','FK_facts_meta_clients','dropped',NULL);
END;

DECLARE @pk_facts sysname;
SELECT @pk_facts = kc.name
FROM sys.key_constraints kc
JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE kc.parent_object_id = OBJECT_ID('dbo.facts_meta')
  AND kc.type = 'PK'
  AND c.name = 'client_id';

IF @pk_facts IS NOT NULL
BEGIN
  DECLARE @sql2 NVARCHAR(MAX) = N'ALTER TABLE dbo.facts_meta DROP CONSTRAINT ['+@pk_facts+N']';
  EXEC sp_executesql @sql2;
  INSERT INTO @actions VALUES('drop-pk-on-client_id',@pk_facts,'dropped',NULL);
END;

SELECT @facts_client_id_type = TY.name
FROM sys.columns C
JOIN sys.types TY ON TY.user_type_id = C.user_type_id
WHERE C.object_id = OBJECT_ID('dbo.facts_meta') AND C.name = 'client_id';

IF @facts_client_id_type IS NOT NULL AND @facts_client_id_type <> 'uniqueidentifier'
BEGIN
  IF COL_LENGTH('dbo.facts_meta','client_id_uid') IS NULL
    ALTER TABLE dbo.facts_meta ADD client_id_uid UNIQUEIDENTIFIER NULL;

  IF NOT EXISTS (SELECT 1 FROM dbo.clients WHERE name_norm = N'unassigned')
    INSERT INTO dbo.clients (client_id, name, name_norm) VALUES (NEWID(), N'Unassigned', N'unassigned');

  DECLARE @unassigned UNIQUEIDENTIFIER = (SELECT TOP (1) client_id FROM dbo.clients WHERE name_norm = N'unassigned');

  IF COL_LENGTH('dbo.facts_meta','client_id_uid') IS NOT NULL
    UPDATE dbo.facts_meta SET client_id_uid = ISNULL(client_id_uid, @unassigned);

  IF COL_LENGTH('dbo.facts_meta','client_id') IS NOT NULL
    ALTER TABLE dbo.facts_meta DROP COLUMN client_id;
  IF COL_LENGTH('dbo.facts_meta','client_id_uid') IS NOT NULL
    EXEC sp_rename 'dbo.facts_meta.client_id_uid', 'client_id', 'COLUMN';

  INSERT INTO @actions VALUES('migrate-type','facts_meta.client_id int -> uniqueidentifier (placeholder)','ok',@@ROWCOUNT);

  SELECT @facts_client_id_type = TY.name
  FROM sys.columns C
  JOIN sys.types TY ON TY.user_type_id = C.user_type_id
  WHERE C.object_id = OBJECT_ID('dbo.facts_meta') AND C.name = 'client_id';
END
ELSE
BEGIN
  IF EXISTS (SELECT 1 FROM dbo.facts_meta WHERE client_id IS NULL)
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.clients WHERE name_norm = N'unassigned')
      INSERT INTO dbo.clients (client_id, name, name_norm) VALUES (NEWID(), N'Unassigned', N'unassigned');
    DECLARE @unassigned2 UNIQUEIDENTIFIER = (SELECT TOP (1) client_id FROM dbo.clients WHERE name_norm = N'unassigned');
    UPDATE dbo.facts_meta SET client_id = @unassigned2 WHERE client_id IS NULL;
    INSERT INTO @actions VALUES('backfill-null','facts_meta.client_id -> Unassigned','ok',@@ROWCOUNT);
  END

  SELECT @facts_client_id_type = TY.name
  FROM sys.columns C
  JOIN sys.types TY ON TY.user_type_id = C.user_type_id
  WHERE C.object_id = OBJECT_ID('dbo.facts_meta') AND C.name = 'client_id';
END;

BEGIN TRY
  ALTER TABLE dbo.facts_meta ALTER COLUMN client_id UNIQUEIDENTIFIER NOT NULL;
  INSERT INTO @actions VALUES('alter-not-null','facts_meta.client_id','ok',NULL);
END TRY
BEGIN CATCH
  DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
  INSERT INTO @actions VALUES('alter-not-null','facts_meta.client_id',@msg,NULL);
  THROW;
END CATCH

IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID('dbo.facts_meta') AND type='PK')
BEGIN
  ALTER TABLE dbo.facts_meta ADD CONSTRAINT PK_facts_meta PRIMARY KEY (fact_id);
  INSERT INTO @actions VALUES('create-pk','PK_facts_meta on fact_id','ok',NULL);
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name='FK_facts_meta_clients' AND parent_object_id=OBJECT_ID('dbo.facts_meta'))
BEGIN
  ALTER TABLE dbo.facts_meta
    ADD CONSTRAINT [FK_facts_meta_clients] FOREIGN KEY (client_id)
    REFERENCES dbo.clients(client_id);
  INSERT INTO @actions VALUES('create-fk','FK_facts_meta_clients','ok',NULL);
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_facts_meta_client_date_ad_nz' AND object_id=OBJECT_ID('dbo.facts_meta'))
BEGIN
  CREATE UNIQUE INDEX [UX_facts_meta_client_date_ad_nz]
  ON dbo.facts_meta(client_id, [date], ad_id_nz);
  INSERT INTO @actions VALUES('create-unique-index','UX_facts_meta_client_date_ad_nz','ok',NULL);
END;

-- import_history with batch_data
IF OBJECT_ID('dbo.import_history','U') IS NULL
BEGIN
  CREATE TABLE dbo.import_history(
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    source NVARCHAR(50) NOT NULL,
    batch_data NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  INSERT INTO @actions VALUES('create-table','import_history','ok',NULL);
END
ELSE
BEGIN
  IF COL_LENGTH('dbo.import_history','batch_data') IS NULL
  BEGIN
    IF COL_LENGTH('dbo.import_history','payload') IS NOT NULL
      EXEC sp_rename 'dbo.import_history.payload','batch_data','COLUMN';
    ELSE
      ALTER TABLE dbo.import_history ADD batch_data NVARCHAR(MAX) NULL;
    INSERT INTO @actions VALUES('alter-table','import_history.add_batch_data','ok',NULL);
  END
END;

-- processed_files_hashes
IF OBJECT_ID('dbo.processed_files_hashes','U') IS NULL
BEGIN
  CREATE TABLE dbo.processed_files_hashes(
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    file_hash NVARCHAR(128) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
  INSERT INTO @actions VALUES('create-table','processed_files_hashes','ok',NULL);
END
ELSE
BEGIN
  IF COL_LENGTH('dbo.processed_files_hashes','file_hash') IS NULL
  BEGIN
    ALTER TABLE dbo.processed_files_hashes ADD file_hash NVARCHAR(128) NOT NULL;
    INSERT INTO @actions VALUES('alter-table','processed_files_hashes.add_file_hash','ok',NULL);
  END
END;

SELECT step, detail, status, rows FROM @actions;
`;
        let result = await sqlPool.request().query(schemaSql);
        actions.push(...result.recordset);

        // 3) ads table
        result = await sqlPool
            .request()
            .query("SELECT 1 FROM sys.tables WHERE name='ads'");
        if (result.recordset.length === 0) {
            await sqlPool.request().query(`CREATE TABLE dbo.ads(
    ad_id NVARCHAR(100) NOT NULL PRIMARY KEY,
    client_id UNIQUEIDENTIFIER NOT NULL,
    name NVARCHAR(255) NULL,
    ad_name_norm NVARCHAR(255) NULL,
    ad_preview_link NVARCHAR(1000) NULL,
    ad_creative_thumbnail_url NVARCHAR(1000) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);`);
            actions.push({ step: 'create-table', detail: 'ads', status: 'ok' });
        } else {
            actions.push({ step: 'create-table', detail: 'ads', status: 'exists' });
        }
        result = await sqlPool
            .request()
            .query("SELECT 1 FROM sys.indexes WHERE name='IX_ads_client_adname' AND object_id=OBJECT_ID('dbo.ads')");
        if (result.recordset.length === 0) {
            await sqlPool
                .request()
                .query('CREATE INDEX IX_ads_client_adname ON dbo.ads(client_id, ad_name_norm);');
            actions.push({ step: 'create-index', detail: 'IX_ads_client_adname on ads', status: 'ok' });
        } else {
            actions.push({ step: 'create-index', detail: 'IX_ads_client_adname on ads', status: 'exists' });
        }

        logger.info('[SQL][EnsureSchema] end');
        res.json({ ok: true, actions, db: sqlPool.config.database, schema: 'dbo' });
    } catch (error) {
        logger.error('[SQL][EnsureSchema] error', error);
        res.status(500).json({ ok: false, error: error.message, actions });
    }
});

// Diagnostics route
app.get('/api/sql/diagnostics', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ error: 'Not connected' });
    }
    logger.info('[SQL][Diagnostics] start');
    const schemaChecks = [];
    const stats = {};
    try {
        const checkTable = async (table, columns = [], indexes = [], fk = null) => {
            const exists = (await sqlPool
                .request()
                .query(`SELECT 1 FROM sys.tables WHERE name='${table}'`)).recordset.length > 0;
            const colStatus = {};
            const idxStatus = {};
            if (exists) {
                for (const c of columns) {
                    const r = await sqlPool
                        .request()
                        .query(`SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.${table}') AND name='${c}'`);
                    colStatus[c] = r.recordset.length > 0;
                }
                for (const i of indexes) {
                    const r = await sqlPool
                        .request()
                        .query(`SELECT 1 FROM sys.indexes WHERE name='${i}' AND object_id=OBJECT_ID('dbo.${table}')`);
                    idxStatus[i] = r.recordset.length > 0;
                }
            }
            let fkStatus;
            if (exists && fk) {
                const r = await sqlPool
                    .request()
                    .query(`SELECT 1 FROM sys.foreign_keys WHERE name='${fk}' AND parent_object_id=OBJECT_ID('dbo.${table}')`);
                fkStatus = r.recordset.length > 0 ? `${fk}:ok` : `${fk}:missing`;
            }
            const entry = { table, exists, columns: colStatus, indexes: idxStatus };
            if (fkStatus) entry.fk = fkStatus;
            schemaChecks.push(entry);
            return exists;
        };

        const existsClients = await checkTable('clients', ['client_id', 'name', 'name_norm'], ['UQ_clients_name_norm']);
        const existsFacts = await checkTable('facts_meta', ['client_id', 'date', 'ad_id', 'ad_id_nz'], ['UX_facts_meta_client_date_ad_nz'], 'FK_facts_meta_clients');
        const existsAds = await checkTable('ads', ['ad_id', 'client_id', 'ad_name_norm'], ['IX_ads_client_adname']);

        if (existsClients) {
            const r = await sqlPool.request().query('SELECT COUNT(*) AS c FROM dbo.clients');
            stats.clients = { count: r.recordset[0].c };
        }
        if (existsFacts) {
            const r = await sqlPool
                .request()
                .query('SELECT COUNT(*) AS c, MIN([date]) AS minDate, MAX([date]) AS maxDate FROM dbo.facts_meta');
            stats.facts_meta = {
                count: r.recordset[0].c,
                minDate: r.recordset[0].minDate ? r.recordset[0].minDate.toISOString().slice(0, 10) : null,
                maxDate: r.recordset[0].maxDate ? r.recordset[0].maxDate.toISOString().slice(0, 10) : null,
            };
        }
        if (existsAds) {
            const r = await sqlPool.request().query('SELECT COUNT(*) AS c FROM dbo.ads');
            stats.ads = { count: r.recordset[0].c };
        }

        logger.info('[SQL][Diagnostics] end');
        res.json({ db: sqlPool.config.database, schema: 'dbo', schemaChecks, stats });
    } catch (error) {
        logger.error('[SQL][Diagnostics] error', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        database: dbPath,
        message: 'Ver6 Local Server is running'
    });
});

/**
 * Save data to a table
 */
app.post('/api/data/:table', (req, res) => {
    try {
        const { table } = req.params;
        const { data, key = null } = req.body;

        logger.info(`[Server] Saving data to table: ${table}, key: ${key}`);
        
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO app_data (table_name, data_key, data_value, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        const result = stmt.run(table, key, JSON.stringify(data));
        
        logger.info(`[Server] ✅ Saved data to ${table}, row ID: ${result.lastInsertRowid}`);
        
        res.json({ 
            success: true, 
            table,
            key,
            rowId: result.lastInsertRowid,
            message: 'Data saved successfully'
        });
        
    } catch (error) {
        logger.error('[Server] Error saving data:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * Get data from a table
 */
app.get('/api/data/:table', (req, res) => {
    try {
        const { table } = req.params;
        const { key } = req.query;

        logger.info(`[Server] Loading data from table: ${table}, key: ${key}`);
        
        let stmt, rows;
        
        if (key) {
            // Get specific key
            stmt = db.prepare('SELECT * FROM app_data WHERE table_name = ? AND data_key = ?');
            rows = stmt.get(table, key);
            
            if (rows) {
                const data = JSON.parse(rows.data_value);
                logger.info(`[Server] ✅ Found data for ${table}/${key}`);
                res.json({ success: true, data, metadata: { created_at: rows.created_at, updated_at: rows.updated_at } });
            } else {
                logger.info(`[Server] No data found for ${table}/${key}`);
                res.json({ success: true, data: null });
            }
        } else {
            // Get all data for table
            stmt = db.prepare('SELECT * FROM app_data WHERE table_name = ?');
            rows = stmt.all(table);
            
            const result = {};
            rows.forEach(row => {
                const key = row.data_key || 'default';
                result[key] = JSON.parse(row.data_value);
            });
            
            logger.info(`[Server] ✅ Found ${rows.length} records for ${table}`);
            res.json({ success: true, data: result, count: rows.length });
        }
        
    } catch (error) {
        logger.error('[Server] Error loading data:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * Delete data from a table
 */
app.delete('/api/data/:table', (req, res) => {
    try {
        const { table } = req.params;
        const { key } = req.query;

        logger.info(`[Server] Deleting data from table: ${table}, key: ${key}`);
        
        let stmt, result;
        
        if (key) {
            stmt = db.prepare('DELETE FROM app_data WHERE table_name = ? AND data_key = ?');
            result = stmt.run(table, key);
        } else {
            stmt = db.prepare('DELETE FROM app_data WHERE table_name = ?');
            result = stmt.run(table);
        }
        
        logger.info(`[Server] ✅ Deleted ${result.changes} records from ${table}`);
        
        res.json({ 
            success: true, 
            deletedCount: result.changes,
            message: `Deleted ${result.changes} records`
        });
        
    } catch (error) {
        logger.error('[Server] Error deleting data:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * Save clients data
 */
app.post('/api/clients', (req, res) => {
    try {
        const { clients } = req.body;
        
        logger.info(`[Server] Saving ${clients.length} clients`);
        
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO clients (id, name, data, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        const transaction = db.transaction(() => {
            for (const client of clients) {
                stmt.run(client.id, client.name, JSON.stringify(client));
            }
        });
        
        transaction();
        
        logger.info(`[Server] ✅ Saved ${clients.length} clients`);
        
        res.json({ 
            success: true, 
            count: clients.length,
            message: 'Clients saved successfully'
        });
        
    } catch (error) {
        logger.error('[Server] Error saving clients:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * Get all clients
 */
app.get('/api/clients', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM clients ORDER BY updated_at DESC');
        const rows = stmt.all();
        
        const clients = rows.map(row => JSON.parse(row.data));
        
        logger.info(`[Server] ✅ Retrieved ${clients.length} clients`);
        
        res.json({ 
            success: true, 
            data: clients,
            count: clients.length
        });
        
    } catch (error) {
        logger.error('[Server] Error loading clients:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * Save performance records
 */
app.post('/api/performance/:clientId', (req, res) => {
    try {
        const { clientId } = req.params;
        const { records, batchId = `batch_${Date.now()}` } = req.body;
        
        logger.info(`[Server] Saving ${records.length} performance records for client ${clientId}`);
        
        const stmt = db.prepare(`
            INSERT INTO performance_records (client_id, record_data, batch_id)
            VALUES (?, ?, ?)
        `);
        
        const transaction = db.transaction(() => {
            for (const record of records) {
                stmt.run(clientId, JSON.stringify(record), batchId);
            }
        });
        
        transaction();
        
        logger.info(`[Server] ✅ Saved ${records.length} performance records for ${clientId}`);
        
        res.json({ 
            success: true, 
            clientId,
            batchId,
            count: records.length,
            message: 'Performance records saved successfully'
        });
        
    } catch (error) {
        logger.error('[Server] Error saving performance records:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * Get performance data for all clients
 */
app.get('/api/performance', (req, res) => {
    try {
        const stmt = db.prepare(`
            SELECT client_id, record_data 
            FROM performance_records 
            ORDER BY created_at DESC
        `);
        const rows = stmt.all();
        
        const performanceData = {};
        
        rows.forEach(row => {
            if (!performanceData[row.client_id]) {
                performanceData[row.client_id] = [];
            }
            performanceData[row.client_id].push(JSON.parse(row.record_data));
        });
        
        logger.info(`[Server] ✅ Retrieved performance data for ${Object.keys(performanceData).length} clients`);
        
        res.json({ 
            success: true, 
            data: performanceData,
            clientCount: Object.keys(performanceData).length,
            totalRecords: rows.length
        });
        
    } catch (error) {
        logger.error('[Server] Error loading performance data:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * File upload endpoint
 */
app.post('/api/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: 'No file uploaded' 
            });
        }
        
        logger.info(`[Server] ✅ File uploaded: ${req.file.filename}`);
        
        res.json({
            success: true,
            file: {
                originalName: req.file.originalname,
                filename: req.file.filename,
                path: req.file.path,
                size: req.file.size
            }
        });
        
    } catch (error) {
        logger.error('[Server] Error uploading file:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * Get database statistics
 */
app.get('/api/stats', (req, res) => {
    try {
        const tables = [
            { name: 'app_data', query: 'SELECT COUNT(*) as count FROM app_data' },
            { name: 'clients', query: 'SELECT COUNT(*) as count FROM clients' },
            { name: 'performance_records', query: 'SELECT COUNT(*) as count FROM performance_records' },
            { name: 'creative_data', query: 'SELECT COUNT(*) as count FROM creative_data' },
            { name: 'import_history', query: 'SELECT COUNT(*) as count FROM import_history' }
        ];
        
        const stats = {};
        let totalRecords = 0;
        
        tables.forEach(table => {
            const result = db.prepare(table.query).get();
            stats[table.name] = result.count;
            totalRecords += result.count;
        });
        
        // Get database file size
        const dbStats = fs.statSync(dbPath);
        const dbSizeKB = Math.round(dbStats.size / 1024);
        
        logger.info(`[Server] ✅ Database stats: ${totalRecords} total records, ${dbSizeKB}KB`);
        
        res.json({
            success: true,
            database: {
                path: dbPath,
                sizeKB: dbSizeKB,
                lastModified: dbStats.mtime
            },
            tables: stats,
            totalRecords
        });
        
    } catch (error) {
        logger.error('[Server] Error getting stats:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * Clear all data (for development/testing)
 */
app.post('/api/clear', (req, res) => {
    try {
        const tables = ['app_data', 'clients', 'performance_records', 'creative_data', 'import_history'];
        
        let totalDeleted = 0;
        
        tables.forEach(tableName => {
            const result = db.prepare(`DELETE FROM ${tableName}`).run();
            totalDeleted += result.changes;
            logger.info(`[Server] Cleared ${result.changes} records from ${tableName}`);
        });
        
        logger.info(`[Server] ✅ Cleared all data: ${totalDeleted} total records deleted`);
        
        res.json({
            success: true,
            deletedRecords: totalDeleted,
            message: 'All data cleared successfully'
        });
        
    } catch (error) {
        logger.error('[Server] Error clearing data:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// --- SQL Server terminal: ejecutar comandos SQL ---
app.post('/api/sql/execute', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ success: false, error: 'No conectado a SQL Server' });
    }
    const { command } = req.body || {};
    if (typeof command !== 'string' || !command.trim()) {
        return res.status(400).json({ success: false, error: 'Comando vacío' });
    }
    try {
        const result = await sqlPool.request().query(command);
        res.json({ success: true, result: result.recordset });
    } catch (error) {
        res.status(200).json({ success: false, error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    logger.info(`\n🚀 Ver6 Local Server running on http://localhost:${PORT}`);
    logger.info(`📊 Database: ${dbPath}`);
    logger.info(`🔗 Health check: http://localhost:${PORT}/api/health`);
    logger.info(`📈 Stats: http://localhost:${PORT}/api/stats`);
    logger.info('');
    logger.info('API Endpoints:');
    logger.info('  POST /api/data/:table     - Save data');
    logger.info('  GET  /api/data/:table     - Get data');
    logger.info('  DELETE /api/data/:table   - Delete data');
    logger.info('  POST /api/clients         - Save clients');
    logger.info('  GET  /api/clients         - Get clients');
    logger.info('  POST /api/performance/:id - Save performance data');
    logger.info('  GET  /api/performance     - Get performance data');
    logger.info('  POST /api/upload          - Upload files');
    logger.info('  GET  /api/stats           - Database statistics');
    logger.info('  POST /api/clear           - Clear all data');
    logger.info('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('\n[Server] Shutting down gracefully...');
    db.close();
    process.exit(0);
});

export default app;
