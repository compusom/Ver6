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

const METRIC_COLUMNS = METRIC_COLUMN_DEFINITIONS.map(def => def.name);
const NUMERIC_COLUMNS = new Set(
    METRIC_COLUMN_DEFINITIONS.filter(def => /INT|DECIMAL|BIGINT|FLOAT|REAL/i.test(def.type)).map(def => def.name)
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

// Helper for parsing dates of the form DD/MM/YYYY
const parseDateForSort = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
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

    const allowCreateClient = req.query.allowCreateClient === 'true';

    // Helper to normalize column names to match SQL schema
    const normalizeKey = (key) =>
        key
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9]+/g, '_')
            .replace(/^_|_$/g, '')
            .toLowerCase();

    try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });

        if (rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Excel file is empty' });
        }

        // Determine client from first row
        const firstRow = rows[0];
        const clientName =
            firstRow['nombre_de_la_cuenta'] ||
            firstRow['Nombre de la cuenta'] ||
            firstRow['Account name'] ||
            'desconocido';

        // Ensure client exists
        let result = await sqlPool
            .request()
            .input('nombre', sql.VarChar(255), clientName)
            .query('SELECT id_cliente FROM clientes WHERE nombre_cuenta = @nombre');
        let clientId;
        if (result.recordset.length === 0) {
            if (!allowCreateClient) {
                return res.status(400).json({ success: false, error: `Client ${clientName} not found` });
            }
            result = await sqlPool
                .request()
                .input('nombre', sql.VarChar(255), clientName)
                .query('INSERT INTO clientes (nombre_cuenta) OUTPUT INSERTED.id_cliente VALUES (@nombre)');
            clientId = result.recordset[0].id_cliente;
        } else {
            clientId = result.recordset[0].id_cliente;
        }

        const uniqueDays = new Set();
        const records = [];
        const fileUniqueIds = new Set();

        for (const row of rows) {
            const normalized = {};
            const original = {};
            for (const [k, v] of Object.entries(row)) {
                const nk = normalizeKey(k);
                original[nk] = v;
                if (METRIC_COLUMNS.includes(nk)) {
                    normalized[nk] = NUMERIC_COLUMNS.has(nk) ? parseNumber(v) : v;
                }
            }
            const uniqueId = `${original.dia || original.day}_${
                original.nombre_de_la_campaña || original.campaign_name || ''
            }_${
                original.nombre_del_anuncio || original.ad_name || ''
            }_${original.edad || original.age || ''}_${original.sexo || original.gender || ''}`;
            if (!uniqueId || fileUniqueIds.has(uniqueId)) {
                continue;
            }
            fileUniqueIds.add(uniqueId);
            normalized.unique_id = uniqueId;
            records.push(normalized);
            const dayValue = original.dia || original.day;
            if (dayValue) uniqueDays.add(dayValue);
        }

        const parsedDates = Array.from(uniqueDays)
            .map(parseDateForSort)
            .filter(d => d !== null);
        const periodStart =
            parsedDates.length > 0
                ? new Date(Math.min(...parsedDates.map(d => d.getTime())))
                      .toISOString()
                      .split('T')[0]
                : null;
        const periodEnd =
            parsedDates.length > 0
                ? new Date(Math.max(...parsedDates.map(d => d.getTime())))
                      .toISOString()
                      .split('T')[0]
                : null;
        const daysDetected = uniqueDays.size;

        // Create report record
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        const report = await sqlPool
            .request()
            .input('id_cliente', sql.Int, clientId)
            .input('nombre_archivo', sql.VarChar(255), req.file.originalname)
            .input('hash_archivo', sql.Char(64), fileHash)
            .input('period_start', sql.Date, periodStart)
            .input('period_end', sql.Date, periodEnd)
            .input('days_detected', sql.Int, daysDetected)
            .query(
                'INSERT INTO archivos_reporte (id_cliente, nombre_archivo, hash_archivo, period_start, period_end, days_detected) OUTPUT INSERTED.id_reporte VALUES (@id_cliente, @nombre_archivo, @hash_archivo, @period_start, @period_end, @days_detected)'
            );
        const reportId = report.recordset[0].id_reporte;

        let inserted = 0;
        let updated = 0;
        let skipped = rows.length - records.length;

        const transaction = new sql.Transaction(sqlPool);
        await transaction.begin();
        try {
            const allParams = ['id_reporte', 'unique_id', ...METRIC_COLUMNS];
            const insertPS = new sql.PreparedStatement(transaction);
            allParams.forEach(col => {
                if (col === 'id_reporte') insertPS.input(col, sql.Int);
                else if (col === 'unique_id') insertPS.input(col, sql.NVarChar(255));
                else if (NUMERIC_COLUMNS.has(col)) insertPS.input(col, sql.Float);
                else insertPS.input(col, sql.NVarChar);
            });
            await insertPS.prepare(
                `INSERT INTO metricas (${allParams.map(c => `[${c}]`).join(', ')}) VALUES (${allParams
                    .map(c => `@${c}`)
                    .join(', ')})`
            );

            const updateCols = ['id_reporte', ...METRIC_COLUMNS];
            const updatePS = new sql.PreparedStatement(transaction);
            updatePS.input('unique_id', sql.NVarChar(255));
            updateCols.forEach(col => {
                if (col === 'id_reporte') updatePS.input(col, sql.Int);
                else if (NUMERIC_COLUMNS.has(col)) updatePS.input(col, sql.Float);
                else updatePS.input(col, sql.NVarChar);
            });
            await updatePS.prepare(
                `UPDATE metricas SET ${updateCols
                    .map(c => `[${c}] = @${c}`)
                    .join(', ')} WHERE unique_id = @unique_id`
            );

            for (const rec of records) {
                rec.id_reporte = reportId;
                const exists = await new sql.Request(transaction)
                    .input('unique_id', sql.NVarChar, rec.unique_id)
                    .query('SELECT 1 FROM metricas WHERE unique_id = @unique_id');
                if (exists.recordset.length > 0) {
                    const updateParams = {};
                    updateCols.forEach(col => {
                        updateParams[col] = rec[col] ?? null;
                    });
                    updateParams.unique_id = rec.unique_id;
                    await updatePS.execute(updateParams);
                    updated++;
                } else {
                    const insertParams = {};
                    allParams.forEach(col => {
                        insertParams[col] = rec[col] ?? null;
                    });
                    await insertPS.execute(insertParams);
                    inserted++;
                }
            }

            await insertPS.unprepare();
            await updatePS.unprepare();
            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            throw err;
        }

        const history = {
            clientId,
            clientName,
            reportId,
            inserted,
            updated,
            skipped,
            periodStart,
            periodEnd,
            daysDetected
        };
        db.prepare('INSERT INTO import_history (batch_data) VALUES (?)').run(JSON.stringify(history));

        res.json({ success: true, inserted, updated, skipped, clientName, periodStart, periodEnd });
    } catch (error) {
        logger.error('[SQL] Error importing Excel:', error.message);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        fs.unlink(req.file.path, () => {});
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
