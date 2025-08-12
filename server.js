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

/**
 * Common function to ensure complete SQL schema using sqlTables.js definitions
 * @param {Object} sqlPool - The SQL connection pool
 * @param {Function} logger - Logger instance
 * @returns {Object} - Result object with actions and status
 */
async function ensureCompleteSchema(sqlPool, logger) {
    const actions = [];
    
    // Import the complete schema from sqlTables.js
    const { TABLES, getCreationOrder } = await import('./sqlTables.js');
    const tablesOrder = getCreationOrder();
    
    logger.info(`[SQL][Schema] Tables to create in order:`, tablesOrder);
    
    // Create schema step by step
    for (const tableName of tablesOrder) {
        const tableConfig = TABLES[tableName];
        logger.info(`[SQL][Schema] Processing table: ${tableName}`);
        
        try {
            // Check if table exists
            const checkTableQuery = `
                SELECT COUNT(*) as count 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = '${tableName}' AND TABLE_SCHEMA = 'dbo'
            `;
            const tableExists = await sqlPool.request().query(checkTableQuery);
            
            if (tableExists.recordset[0].count === 0) {
                logger.info(`[SQL][Schema] Creating table: ${tableName}`);
                
                // Use the exact SQL from sqlTables.js
                let createSQL = tableConfig.create;
                
                await sqlPool.request().query(createSQL);
                logger.info(`[SQL][Schema] ✅ Table ${tableName} created successfully`);
                actions.push({ step: 'create-table', detail: tableName, status: 'ok', rows: null });
            } else {
                logger.info(`[SQL][Schema] Table ${tableName} already exists`);
                actions.push({ step: 'check-table', detail: tableName, status: 'exists', rows: null });
                
                // For clients table, ensure we have the 'Unassigned' client
                if (tableName === 'clients') {
                    try {
                        const unassignedCheck = await sqlPool.request().query(
                            "SELECT COUNT(*) as count FROM clients WHERE name = 'Unassigned'"
                        );
                        
                        if (unassignedCheck.recordset[0].count === 0) {
                            await sqlPool.request().query(
                                "INSERT INTO clients (name) VALUES ('Unassigned')"
                            );
                            logger.info(`[SQL][Schema] ✅ Created 'Unassigned' client`);
                            actions.push({ step: 'create-default-client', detail: 'Unassigned', status: 'ok', rows: 1 });
                        }
                    } catch (clientError) {
                        logger.warn(`[SQL][Schema] Warning creating Unassigned client:`, clientError.message);
                        actions.push({ step: 'create-default-client', detail: 'Unassigned', status: 'error', rows: null });
                    }
                }
            }
            
        } catch (tableError) {
            logger.error(`[SQL][Schema] ❌ Error processing table ${tableName}:`, tableError.message);
            actions.push({ step: 'create-table', detail: tableName, status: 'error', rows: null });
            // Continue with other tables instead of stopping completely
            continue;
        }
    }
    
    // Final verification: check which tables were actually created
    const finalTablesQuery = `
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = 'dbo' 
        ORDER BY TABLE_NAME
    `;
    const finalTables = await sqlPool.request().query(finalTablesQuery);
    logger.info(`[SQL][Schema] Final tables in database:`, finalTables.recordset.map(t => t.TABLE_NAME));
    
    actions.push({ 
        step: 'final-verification', 
        detail: `${finalTables.recordset.length} tables total`, 
        status: 'ok', 
        rows: finalTables.recordset.length 
    });

    return {
        success: true,
        actions,
        tablesCreated: finalTables.recordset.length
    };
}

// Helper to normalize column names to match SQL schema
const normalizeKey = key =>
    key
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase();

// Meta Excel to Database Field Mapping
const META_FIELD_MAPPING = new Map([
    // Identificadores principales
    ['nombre_de_la_campana', 'nombre_de_la_campaña'],
    ['nombre_del_conjunto_de_anuncios', 'nombre_del_anuncio'],
    ['nombre_del_anuncio', 'nombre_del_anuncio'],
    ['nombre_de_la_cuenta', 'nombre_de_la_cuenta'],
    ['dia', 'finalizacion_de_campaña'],
    ['edad', 'edad'],
    ['sexo', 'sexo'],
    
    // Métricas de rendimiento
    ['importe_gastado_eur', 'importe_gastado_EUR'],
    ['impresiones', 'impresiones'],
    ['alcance', 'alcance'],
    ['frecuencia', 'frecuencia'],
    ['cpm_costo_por_mil_impresiones', 'cpm_por_1000'],
    ['clics_todos', 'clics_todos'],
    ['clics_en_el_enlace', 'clics_enlace'],
    ['visitas_a_la_pagina_de_destino', 'visitas_a_la_pagina_de_destino'],
    ['ctr_todos', 'ctr_todos'],
    ['ctr_porcentaje_de_clics_en_el_enlace', 'ctr_link_click_pct'],
    ['cpc_todos', 'costo'],
    
    // Métricas de conversión
    ['articulos_agregados_al_carrito', 'articulos_agregados_al_carrito'],
    ['pagos_iniciados', 'pagos_iniciados'],
    ['compras', 'compras'],
    ['valor_de_conversion_de_compras', 'valor_de_conversion_compras'],
    
    // Métricas de video e interacción
    ['reproducciones_de_video_de_3_segundos', 'reproducciones_de_video_3s'],
    ['reproducciones_de_video_hasta_el_25', 'rep_video_25_pct'],
    ['reproducciones_de_video_hasta_el_50', 'rep_video_50_pct'],
    ['reproducciones_de_video_hasta_el_75', 'rep_video_75_pct'],
    ['reproducciones_de_video_hasta_el_95', 'rep_video_95_pct'],
    ['reproducciones_de_video_hasta_el_100', 'rep_video_100_pct'],
    ['tiempo_promedio_de_reproduccion_del_video', 'tiempo_promedio_video'],
    ['interacciones_con_la_publicacion', 'interacciones_con_la_publicacion'],
    ['reacciones_a_publicaciones', 'reacciones_a_la_publicacion'],
    ['comentarios_de_publicaciones', 'comentarios_de_la_publicacion'],
    
    // Campos adicionales
    ['objetivo', 'objetivo'],
    ['tipo_de_compra', 'tipo_de_puja'],
    ['divisa', 'divisa'],
    ['url_del_sitio_web', 'url_del_sitio_web']
]);

// Columns that contain numeric data
const NUMERIC_COLUMNS = new Set([
    'importe_gastado_EUR', 'impresiones', 'alcance', 'frecuencia', 'cpm_por_1000',
    'clics_todos', 'clics_enlace', 'visitas_a_la_pagina_de_destino', 'ctr_todos',
    'ctr_link_click_pct', 'costo', 'articulos_agregados_al_carrito', 'pagos_iniciados',
    'compras', 'valor_de_conversion_compras', 'reproducciones_de_video_3s',
    'rep_video_25_pct', 'rep_video_50_pct', 'rep_video_75_pct', 'rep_video_95_pct',
    'rep_video_100_pct', 'tiempo_promedio_video', 'interacciones_con_la_publicacion',
    'reacciones_a_la_publicacion', 'comentarios_de_la_publicacion'
]);

// Columns that contain date data
const DATE_COLUMNS = new Set([
    'finalizacion_de_campaña', 'fecha_de_creacion', 'inicio_del_informe', 'fin_del_informe'
]);

// All available metric columns
const METRIC_COLUMNS = Array.from(META_FIELD_MAPPING.values());

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

// Default MSSQL types for Meta fields
const MSSQL_TYPE_MAP = new Map([
    // Default fallback for any unknown column
    ['default', sql.VarChar(sql.MAX)],
    
    // Numeric fields
    ['importe_gastado_EUR', sql.Decimal(18, 2)],
    ['impresiones', sql.Int],
    ['alcance', sql.Int],
    ['frecuencia', sql.Decimal(10, 4)],
    ['cpm_por_1000', sql.Decimal(10, 2)],
    ['clics_todos', sql.Int],
    ['clics_enlace', sql.Int],
    ['visitas_a_la_pagina_de_destino', sql.Int],
    ['ctr_todos', sql.Decimal(10, 4)],
    ['ctr_link_click_pct', sql.Decimal(10, 4)],
    ['costo', sql.Decimal(10, 2)],
    ['articulos_agregados_al_carrito', sql.Int],
    ['pagos_iniciados', sql.Int],
    ['compras', sql.Int],
    ['valor_de_conversion_compras', sql.Decimal(10, 2)],
    ['reproducciones_de_video_3s', sql.Int],
    ['rep_video_25_pct', sql.Decimal(10, 4)],
    ['rep_video_50_pct', sql.Decimal(10, 4)],
    ['rep_video_75_pct', sql.Decimal(10, 4)],
    ['rep_video_95_pct', sql.Decimal(10, 4)],
    ['rep_video_100_pct', sql.Decimal(10, 4)],
    ['tiempo_promedio_video', sql.Int],
    ['interacciones_con_la_publicacion', sql.Int],
    ['reacciones_a_la_publicacion', sql.Int],
    ['comentarios_de_la_publicacion', sql.Int],
    
    // Date fields
    ['finalizacion_de_campaña', sql.Date],
    ['fecha_de_creacion', sql.Date],
    ['inicio_del_informe', sql.Date],
    ['fin_del_informe', sql.Date],
    
    // Text fields
    ['nombre_de_la_campaña', sql.VarChar(255)],
    ['nombre_del_anuncio', sql.VarChar(255)],
    ['edad', sql.VarChar(50)],
    ['sexo', sql.VarChar(50)],
    ['objetivo', sql.VarChar(255)],
    ['tipo_de_puja', sql.VarChar(255)],
    ['unique_id', sql.VarChar(255)],
    ['id_reporte', sql.Int]
]);

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

// Get clients from SQL Server
app.get('/api/sql/clients', async (req, res) => {
    logger.info('[DEBUG] /api/sql/clients endpoint called');
    if (!sqlPool) {
        logger.info('[DEBUG] sqlPool is null, not connected to SQL Server');
        return res.status(400).json({ success: false, error: 'Not connected to SQL Server' });
    }
    try {
        logger.info('[DEBUG] Querying clients from SQL Server...');
        const result = await sqlPool.request().query(`
            SELECT client_id, name, name_norm
            FROM dbo.clients
            ORDER BY name
        `);
        const clients = result.recordset.map(row => ({
            id: row.client_id,
            name: row.name,
            logo: `https://avatar.vercel.sh/${encodeURIComponent(row.name)}.png?text=${row.name.charAt(0).toUpperCase()}`,
            currency: "EUR", // Default currency for SQL clients
            metaAccountName: row.name
        }));
        logger.info('[DEBUG] Found clients:', clients.length);
        res.json({ success: true, data: clients, count: clients.length });
    } catch (error) {
        logger.error('[SQL] Error al consultar clients:', error.message);
        res.status(500).json({ success: false, error: error.message });
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
    logger.info(`[SQL] TABLE_CREATION_ORDER:`, TABLE_CREATION_ORDER);
    logger.info(`[SQL] Available SQL_TABLE_DEFINITIONS:`, Object.keys(SQL_TABLE_DEFINITIONS));
    
    for (const table of TABLE_CREATION_ORDER) {
        logger.info(`[SQL] Checking if table "${table}" exists...`);
        const exists = await sqlPool
            .request()
            .query(`SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='${table}'`);
        
        if (exists.recordset.length === 0) {
            logger.info(`[SQL] Table "${table}" does not exist, creating...`);
            const createSQL = SQL_TABLE_DEFINITIONS[table];
            logger.info(`[SQL] CREATE SQL for "${table}":`, createSQL);
            
            try {
                await sqlPool.request().query(createSQL);
                created.push(table);
                logger.info(`[SQL] ✅ Table "${table}" created successfully`);
            } catch (createError) {
                logger.error(`[SQL] ❌ Failed to create table "${table}":`, createError);
                throw createError;
            }
        } else {
            logger.info(`[SQL] Table "${table}" already exists`);
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

    const allowCreateClient = true; // Always allow creating clients automatically
    logger.info(`[SQL] ===== STARTING EXCEL IMPORT =====`);
    logger.info(`[SQL] File: ${req.file.originalname}`);
    logger.info(`[SQL] File path: ${req.file.path}`);
    logger.info(`[SQL] Allow create client: ${allowCreateClient}`);
    
    // Ensure tables exist before importing - use complete schema
    logger.info(`[SQL] Step 1: Ensuring SQL tables exist...`);
    try {
        const schemaResult = await ensureCompleteSchema(sqlPool, logger);
        logger.info(`[SQL] ✅ Schema ensured - ${schemaResult.tablesCreated} tables available`);
    } catch (tableError) {
        logger.error(`[SQL] ❌ Table initialization failed:`, tableError);
        logger.error(`[SQL] Error message:`, tableError.message);
        logger.error(`[SQL] Error code:`, tableError.code);
        logger.error(`[SQL] Error number:`, tableError.number);
        logger.error(`[SQL] Error state:`, tableError.state);
        logger.error(`[SQL] Error class:`, tableError.class);
        logger.error(`[SQL] Error severity:`, tableError.severity);
        logger.error(`[SQL] Error server:`, tableError.serverName);
        logger.error(`[SQL] Error procedure:`, tableError.procName);
        logger.error(`[SQL] Error line:`, tableError.lineNumber);
        logger.error(`[SQL] Full error object:`, JSON.stringify(tableError, null, 2));
        logger.error(`[SQL] Stack trace:`, tableError.stack);
        
        // Try to get more details from SQL Server
        try {
            if (sqlPool) {
                const errorDetailQuery = `
                    SELECT 
                        error_number() as ErrorNumber,
                        error_severity() as ErrorSeverity,
                        error_state() as ErrorState,
                        error_procedure() as ErrorProcedure,
                        error_line() as ErrorLine,
                        error_message() as ErrorMessage
                `;
                logger.error(`[SQL] Attempting to get SQL Server error details...`);
                const errorDetails = await sqlPool.request().query(errorDetailQuery);
                logger.error(`[SQL] SQL Server error details:`, errorDetails.recordset);
            }
        } catch (detailError) {
            logger.error(`[SQL] Could not retrieve SQL error details:`, detailError.message);
        }
        
        return res.status(500).json({ 
            success: false, 
            error: `Table initialization failed: ${tableError.message}`,
            details: {
                code: tableError.code,
                number: tableError.number,
                state: tableError.state,
                class: tableError.class,
                severity: tableError.severity,
                server: tableError.serverName,
                procedure: tableError.procName,
                line: tableError.lineNumber
            }
        });
    }
    
    try {
        logger.info(`[SQL] Step 2: Reading Excel file...`);
        const fileBuffer = fs.readFileSync(req.file.path);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        logger.info(`[SQL] ✅ Excel file loaded, sheet: ${workbook.SheetNames[0]}`);

        // Detect and skip title rows like "Raw Data Report"
        let startRow = 0;
        const firstCell = sheet['A1']?.v;
        if (typeof firstCell === 'string' && firstCell.toLowerCase().includes('raw data report')) {
            startRow = 1;
        }
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: null, range: startRow });
        logger.info(`[SQL] ✅ Parsed ${rows.length} rows from Excel`);

        if (rows.length === 0) {
            logger.error(`[SQL] ❌ Excel file is empty`);
            return res.status(400).json({ success: false, error: 'Excel file is empty' });
        }

        // Determine client from first row
        logger.info(`[SQL] Step 3: Determining client from first row...`);
        const firstRow = rows[0];
        logger.info(`[SQL] First row keys:`, Object.keys(firstRow));
        
        const clientName =
            firstRow['nombre_de_la_cuenta'] ||
            firstRow['Nombre de la cuenta'] ||
            firstRow['Account name'] ||
            'desconocido';
        
        logger.info(`[SQL] ✅ Client name determined: "${clientName}"`);
        logger.info(`[SQL] Step 4: Checking if client exists in database...`);

        // Ensure client exists
        let result;
        try {
            result = await sqlPool
                .request()
                .input('nombre', sql.VarChar(255), clientName)
                .query('SELECT client_id FROM clients WHERE name = @nombre');
            logger.info(`[SQL] ✅ Client lookup query executed successfully`);
        } catch (clientQueryError) {
            logger.error(`[SQL] ❌ Client lookup query failed:`, clientQueryError);
            logger.error(`[SQL] Query was: SELECT client_id FROM clients WHERE name = @nombre`);
            logger.error(`[SQL] Parameter: @nombre = "${clientName}"`);
            throw clientQueryError;
        }
        let clientId;
        logger.info(`[SQL] Client lookup result: ${result.recordset.length} records found`);
        
        if (result.recordset.length === 0) {
            logger.info(`[SQL] Client "${clientName}" not found. allowCreateClient = ${allowCreateClient}`);
            
            if (!allowCreateClient) {
                logger.error(`[SQL] ❌ Client creation not allowed`);
                return res.status(400).json({ success: false, error: `Client ${clientName} not found` });
            }
            
            logger.info(`[SQL] Step 5: Creating new client "${clientName}"...`);
            try {
                // Import normalizeName function
                const { normalizeName } = await import('./lib/normalizeName.js');
                const normalizedName = normalizeName(clientName);
                
                result = await sqlPool
                    .request()
                    .input('nombre', sql.VarChar(255), clientName)
                    .input('nombre_norm', sql.VarChar(255), normalizedName)
                    .query('INSERT INTO clients (name, name_norm) OUTPUT INSERTED.client_id VALUES (@nombre, @nombre_norm)');
                clientId = result.recordset[0].client_id;
                logger.info(`[SQL] ✅ Client created successfully with ID: ${clientId}`);
            } catch (createClientError) {
                logger.error(`[SQL] ❌ Failed to create client:`, createClientError);
                throw createClientError;
            }
        } else {
            clientId = result.recordset[0].client_id;
            logger.info(`[SQL] ✅ Existing client found with ID: ${clientId}`);
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
                const colName = META_FIELD_MAPPING.get(nk);
                if (colName) {
                    if (NUMERIC_COLUMNS.has(colName)) {
                        normalized[colName] = parseNumber(v);
                    } else if (DATE_COLUMNS.has(colName)) {
                        const d = parseDateForSort(v);
                        normalized[colName] = d ? new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) : null;
                    } else {
                        normalized[colName] = v;
                    }
                }
            }
            const uniqueId = `${original.dia || original.day}_${
                original.nombre_de_la_campana || original.campaign_name || ''
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

        // Create or reuse report record
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        // Check if this file was already imported
        const existingReport = await sqlPool
            .request()
            .input('hash_archivo', sql.Char(64), fileHash)
            .query('SELECT id_reporte FROM archivos_reporte WHERE hash_archivo = @hash_archivo');

        if (existingReport.recordset.length > 0) {
            return res.status(400).json({ success: false, error: 'Este archivo ya fue importado anteriormente' });
        }

        const report = await sqlPool
            .request()
            .input('client_id', sql.Int, clientId)
            .input('nombre_archivo', sql.VarChar(255), req.file.originalname)
            .input('hash_archivo', sql.Char(64), fileHash)
            .input('period_start', sql.Date, periodStart)
            .input('period_end', sql.Date, periodEnd)
            .input('days_detected', sql.Int, daysDetected)
            .query(
                'INSERT INTO archivos_reporte (client_id, nombre_archivo, hash_archivo, period_start, period_end, days_detected) OUTPUT INSERTED.id_reporte VALUES (@client_id, @nombre_archivo, @hash_archivo, @period_start, @period_end, @days_detected)'
            );
        const reportId = report.recordset[0].id_reporte;

        let inserted = 0;
        let updated = 0;
        let skipped = rows.length - records.length;

        const transaction = new sql.Transaction(sqlPool);
        await transaction.begin();
        try {
            const metricCols = METRIC_COLUMNS.filter(c => c !== 'unique_id');
            const allParams = ['id_reporte', 'unique_id', ...metricCols];

            // Create a safe parameter name (ASCII only) for each column/param
            const toParam = (col) => 'p_' + normalizeKey(col);

            const updateCols = metricCols; // exclude id_reporte from SET

            logger.info(`[SQL] Starting to process ${records.length} records for import`);
        for (const rec of records) {
                rec.id_reporte = reportId;

                // First attempt an update within the same report
                const updateReq = transaction.request();
                updateReq.input(toParam('unique_id'), MSSQL_TYPE_MAP.get('unique_id') || sql.VarChar(255), rec.unique_id);
                updateReq.input(toParam('id_reporte'), sql.Int, reportId);
                updateCols.forEach(col => {
                    const type = MSSQL_TYPE_MAP.get(col) || sql.VarChar(sql.MAX);
                    updateReq.input(toParam(col), type, rec[col] ?? null);
                });
                const updateResult = await updateReq.query(
                    `UPDATE metricas SET ${updateCols
                        .map(c => `[${c}] = @${toParam(c)}`)
                        .join(', ')} WHERE unique_id = @${toParam('unique_id')} AND id_reporte = @${toParam('id_reporte')}`
                );

                if (updateResult.rowsAffected[0] > 0) {
                    updated++;
                    logger.info(`[SQL] Updated record with unique_id: ${rec.unique_id}`);
                    continue;
                }

                // If no rows updated, insert new record
                const insertReq = transaction.request();
                allParams.forEach(col => {
                    const type = MSSQL_TYPE_MAP.get(col) || sql.VarChar(sql.MAX);
                    const paramType = col === 'id_reporte' ? sql.Int : type;
                    insertReq.input(toParam(col), paramType, rec[col] ?? null);
                });
                await insertReq.query(
                    `INSERT INTO metricas (${allParams.map(c => `[${c}]`).join(', ')}) VALUES (${allParams
                        .map(c => `@${toParam(c)}`)
                        .join(', ')})`
                );
                inserted++;
                logger.info(`[SQL] Inserted new record with unique_id: ${rec.unique_id}`);
            }

            await transaction.commit();
            logger.info(`[SQL] Transaction committed successfully. Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`);
        } catch (err) {
            await transaction.rollback().catch(rbErr => {
                logger.error('[SQL] Rollback failed:', rbErr);
            });
            throw err;
        }

        const history = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            source: 'sql',
            fileName: req.file.originalname,
            fileHash,
            clientName,
            description: `${inserted} insertados, ${updated} actualizados, ${skipped} omitidos`,
            undoData: { type: 'sql', keys: [], clientId: String(clientId) },
            periodStart,
            periodEnd,
            daysDetected
        };
        await sqlPool
            .request()
            .input('source', sql.VarChar(50), 'meta-excel')
            .input('batch_data', sql.NVarChar(sql.MAX), JSON.stringify(history))
            .query('INSERT INTO import_history (source, batch_data) VALUES (@source, @batch_data)');

        res.json({ success: true, inserted, updated, skipped, clientName, periodStart, periodEnd });
    } catch (error) {
        logger.error('[SQL] ❌ ERROR IMPORTING EXCEL:');
        logger.error('[SQL] Error message:', error.message);
        logger.error('[SQL] Error code:', error.code);
        logger.error('[SQL] Error number:', error.number);
        logger.error('[SQL] Error state:', error.state);
        logger.error('[SQL] Full error object:', error);
        logger.error('[SQL] Stack trace:', error.stack);
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

// Ensure required SQL schema for Meta data - Complete Schema
app.post('/api/sql/ensure-schema', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ ok: false, error: 'Not connected' });
    }
    logger.info('[SQL][EnsureSchema] Creating complete database schema...');
    
    try {
        const result = await ensureCompleteSchema(sqlPool, logger);
        logger.info('[SQL][EnsureSchema] ✅ Complete schema creation process finished');
        res.json({ 
            ok: true, 
            actions: result.actions, 
            db: sqlPool.config.database, 
            schema: 'dbo',
            tablesCreated: result.tablesCreated
        });
    } catch (error) {
        logger.error('[SQL][EnsureSchema] error', error);
        res.status(500).json({ ok: false, error: error.message, actions: [] });
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
