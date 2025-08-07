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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const BODY_LIMIT_MB = process.env.BODY_LIMIT_MB || '50mb';

// Database setup
const dbPath = join(__dirname, 'ver6_data.db');
const db = new Database(dbPath);

let sqlPool = null;

// --- SQL Server Table Definitions ---
// Mapping of table names to their CREATE TABLE statements. These will be used
// to ensure that the required schema exists when importing data from Excel or
// other sources. The order of the keys in TABLE_CREATION_ORDER matters for
// foreign-key relationships (parents first, children afterwards).
const SQL_TABLE_DEFINITIONS = {
    clientes: `
        CREATE TABLE clientes (
            id_cliente INT IDENTITY(1,1) PRIMARY KEY,
            nombre_cuenta VARCHAR(255) UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,
    archivos_reporte: `
        CREATE TABLE archivos_reporte (
            id_reporte INT IDENTITY(1,1) PRIMARY KEY,
            id_cliente INT NOT NULL,
            nombre_archivo VARCHAR(255),
            hash_archivo CHAR(64) UNIQUE NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
        )
    `,
    metricas: `
        CREATE TABLE metricas (
            id_metricas BIGINT IDENTITY(1,1) PRIMARY KEY,
            id_reporte INT NOT NULL,
            [nombre_de_la_campaña] VARCHAR(255),
            [nombre_del_conjunto_de_anuncios] VARCHAR(255),
            [nombre_del_anuncio] VARCHAR(255),
            [dia] DATE,
            [imagen_video_y_presentación] VARCHAR(255),
            [col_6] VARCHAR(255),
            [importe_gastado_EUR] DECIMAL(12,2),
            [entrega_de_la_campaña] VARCHAR(50),
            [entrega_del_conjunto_de_anuncios] VARCHAR(50),
            [entrega_del_anuncio] VARCHAR(50),
            [impresiones] BIGINT,
            [alcance] BIGINT,
            [frecuencia] DECIMAL(5,2),
            [compras] INT,
            [visitas_a_la_página_de_destino] INT,
            [clics_todos] INT,
            [cpm_costo_por_mil_impresiones] DECIMAL(12,2),
            [ctr_todos] DECIMAL(5,2),
            [cpc_todos] DECIMAL(12,2),
            [reproducciones_3s] BIGINT,
            [pagos_iniciados] INT,
            [pct_compras_por_visitas_lp] DECIMAL(5,2),
            [me_gusta_en_facebook] INT,
            [artículos_agregados_al_carrito] INT,
            [pagos_iniciados_web] INT,
            [presupuesto_de_la_campaña] DECIMAL(12,2),
            [tipo_de_presupuesto_de_la_campaña] VARCHAR(50),
            [públicos_personalizados_incluidos] TEXT,
            [públicos_personalizados_excluidos] TEXT,
            [clics_en_el_enlace] INT,
            [información_de_pago_agregada] INT,
            [interacción_con_la_página] INT,
            [comentarios_de_publicaciones] INT,
            [interacciones_con_la_publicación] INT,
            [reacciones_a_publicaciones] INT,
            [veces_compartidas_publicaciones] INT,
            [puja] DECIMAL(12,2),
            [tipo_de_puja] VARCHAR(50),
            [url_del_sitio_web] TEXT,
            [ctr_link_click_pct] DECIMAL(5,2),
            [divisa] VARCHAR(10),
            [valor_de_conversión_compras] DECIMAL(12,2),
            [objetivo] VARCHAR(100),
            [tipo_de_compra] VARCHAR(50),
            [inicio_del_informe] DATE,
            [fin_del_informe] DATE,
            [atencion] INT,
            [deseo] INT,
            [interes] INT,
            [rep_video_25_pct] BIGINT,
            [rep_video_50_pct] BIGINT,
            [rep_video_100_pct] BIGINT,
            [pct_rep_3s_por_impresiones] DECIMAL(5,2),
            [aov] DECIMAL(12,2),
            [lp_view_rate] DECIMAL(5,2),
            [adc_lpv] DECIMAL(12,2),
            [captura_de_video] INT,
            [tasa_conv_landing] DECIMAL(5,2),
            [pct_compras] DECIMAL(5,2),
            [visualizaciones] INT,
            [nombre_de_la_imagen] VARCHAR(255),
            [cvr_link_click] DECIMAL(5,2),
            [retencion_video_short] DECIMAL(5,2),
            [retención_de_video] DECIMAL(5,2),
            [rep_video_75_pct] BIGINT,
            [rep_video_95_pct] BIGINT,
            [tiempo_promedio_video] DECIMAL(6,2),
            [thruplays] INT,
            [rep_video] INT,
            [rep_video_2s_unicas] INT,
            [ctr_unico_enlace_pct] DECIMAL(5,2),
            [nombre_de_la_cuenta] VARCHAR(255),
            [impresiones_compras] INT,
            [captura_video_final] INT,
            inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_reporte) REFERENCES archivos_reporte(id_reporte)
        )
    `,
    archivos_url: `
        CREATE TABLE archivos_url (
            id_url INT IDENTITY(1,1) PRIMARY KEY,
            id_cliente INT NOT NULL,
            nombre_archivo VARCHAR(255),
            hash_archivo CHAR(64) UNIQUE NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
        )
    `,
    vistas_preview: `
        CREATE TABLE vistas_preview (
            id_cliente INT NOT NULL,
            [Account name] VARCHAR(255),
            [Ad name] VARCHAR(255),
            [Reach] BIGINT,
            [Ad Preview Link] TEXT,
            [Ad Creative Thumbnail Url] TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id_cliente, [Ad name]),
            FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
        )
    `
};

// Order in which tables must be created and dropped
const TABLE_CREATION_ORDER = ['clientes', 'archivos_reporte', 'metricas', 'archivos_url', 'vistas_preview'];
const TABLE_DELETION_ORDER = ['metricas', 'archivos_url', 'vistas_preview', 'archivos_reporte', 'clientes'];

// Extract column names from the metricas table definition for dynamic inserts
const METRIC_COLUMNS = SQL_TABLE_DEFINITIONS.metricas
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('['))
    .map(line => line.slice(1, line.indexOf(']')));

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
    console.log('[Server] Initializing SQLite database...');
    
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

    console.log('[Server] ✅ Database tables initialized');
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
        console.log('[SQL] Conexión exitosa a SQL Server');
        
        res.json({ success: true });
    } catch (error) {
        console.error('[SQL] Error al conectar:', error.message);
        if (sqlPool) {
            await sqlPool.close().catch(() => {});
        }
        sqlPool = null;
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Listar nombres de tablas en SQL Server ---
app.get('/api/sql/tables', async (req, res) => {
    console.log('[DEBUG] /api/sql/tables endpoint called');
    if (!sqlPool) {
        console.log('[DEBUG] sqlPool is null, not connected to SQL Server');
        return res.status(400).json({ error: 'Not connected to SQL Server (pool is null)'});
    }
    try {
        console.log('[DEBUG] sqlPool exists, attempting to query tables...');
        const result = await sqlPool.request().query(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `);
        const tables = result.recordset.map(row => row.TABLE_NAME);
        console.log('[DEBUG] Tables found:', tables);
        res.json({ tables });
    } catch (error) {
        console.error('[SQL] Error al consultar tablas:', error.message);
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
        console.error('[SQL] Error al verificar conexión:', error.message);
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
        console.error('[SQL] Error al verificar permisos:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- Manage SQL Server tables ---
// Shared handler to initialize required tables if they are missing. Some users
// have reported hitting this endpoint with GET in the browser, so we expose the
// same logic for both GET and POST requests to avoid "Cannot POST"/"Cannot GET"
// confusion.
async function initSqlTables(req, res) {
    if (!sqlPool) {
        return res.status(400).json({ error: 'Not connected' });
    }
    const created = [];
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
        res.json({ success: true, created });
    } catch (error) {
        console.error('[SQL] Error creating tables:', error.message);
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
        console.error('[SQL] Error dropping tables:', error.message);
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
        console.error('[SQL] Error clearing table data:', error.message);
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
            result = await sqlPool
                .request()
                .input('nombre', sql.VarChar(255), clientName)
                .query('INSERT INTO clientes (nombre_cuenta) OUTPUT INSERTED.id_cliente VALUES (@nombre)');
            clientId = result.recordset[0].id_cliente;
        } else {
            clientId = result.recordset[0].id_cliente;
        }

        // Create report record
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        const report = await sqlPool
            .request()
            .input('id_cliente', sql.Int, clientId)
            .input('nombre_archivo', sql.VarChar(255), req.file.originalname)
            .input('hash_archivo', sql.Char(64), fileHash)
            .query(
                'INSERT INTO archivos_reporte (id_cliente, nombre_archivo, hash_archivo) OUTPUT INSERTED.id_reporte VALUES (@id_cliente, @nombre_archivo, @hash_archivo)'
            );
        const reportId = report.recordset[0].id_reporte;

        let inserted = 0;
        for (const row of rows) {
            const normalized = {};
            for (const [k, v] of Object.entries(row)) {
                const nk = normalizeKey(k);
                if (METRIC_COLUMNS.includes(nk)) {
                    normalized[nk] = v;
                }
            }
            const cols = Object.keys(normalized);
            if (cols.length === 0) continue;

            const colNames = cols.map((c) => `[${c}]`).join(', ');
            const params = cols.map((_, i) => `@p${i}`).join(', ');
            const request = sqlPool.request();
            cols.forEach((c, i) => request.input(`p${i}`, normalized[c]));
            request.input('id_reporte', sql.Int, reportId);
            await request.query(
                `INSERT INTO metricas (${colNames}, id_reporte) VALUES (${params}, @id_reporte)`
            );
            inserted++;
        }

        res.json({ success: true, message: `Imported ${inserted} rows for ${clientName}` });
    } catch (error) {
        console.error('[SQL] Error importing Excel:', error.message);
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

        console.log(`[Server] Saving data to table: ${table}, key: ${key}`);
        
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO app_data (table_name, data_key, data_value, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        const result = stmt.run(table, key, JSON.stringify(data));
        
        console.log(`[Server] ✅ Saved data to ${table}, row ID: ${result.lastInsertRowid}`);
        
        res.json({ 
            success: true, 
            table,
            key,
            rowId: result.lastInsertRowid,
            message: 'Data saved successfully'
        });
        
    } catch (error) {
        console.error('[Server] Error saving data:', error);
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

        console.log(`[Server] Loading data from table: ${table}, key: ${key}`);
        
        let stmt, rows;
        
        if (key) {
            // Get specific key
            stmt = db.prepare('SELECT * FROM app_data WHERE table_name = ? AND data_key = ?');
            rows = stmt.get(table, key);
            
            if (rows) {
                const data = JSON.parse(rows.data_value);
                console.log(`[Server] ✅ Found data for ${table}/${key}`);
                res.json({ success: true, data, metadata: { created_at: rows.created_at, updated_at: rows.updated_at } });
            } else {
                console.log(`[Server] No data found for ${table}/${key}`);
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
            
            console.log(`[Server] ✅ Found ${rows.length} records for ${table}`);
            res.json({ success: true, data: result, count: rows.length });
        }
        
    } catch (error) {
        console.error('[Server] Error loading data:', error);
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

        console.log(`[Server] Deleting data from table: ${table}, key: ${key}`);
        
        let stmt, result;
        
        if (key) {
            stmt = db.prepare('DELETE FROM app_data WHERE table_name = ? AND data_key = ?');
            result = stmt.run(table, key);
        } else {
            stmt = db.prepare('DELETE FROM app_data WHERE table_name = ?');
            result = stmt.run(table);
        }
        
        console.log(`[Server] ✅ Deleted ${result.changes} records from ${table}`);
        
        res.json({ 
            success: true, 
            deletedCount: result.changes,
            message: `Deleted ${result.changes} records`
        });
        
    } catch (error) {
        console.error('[Server] Error deleting data:', error);
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
        
        console.log(`[Server] Saving ${clients.length} clients`);
        
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
        
        console.log(`[Server] ✅ Saved ${clients.length} clients`);
        
        res.json({ 
            success: true, 
            count: clients.length,
            message: 'Clients saved successfully'
        });
        
    } catch (error) {
        console.error('[Server] Error saving clients:', error);
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
        
        console.log(`[Server] ✅ Retrieved ${clients.length} clients`);
        
        res.json({ 
            success: true, 
            data: clients,
            count: clients.length
        });
        
    } catch (error) {
        console.error('[Server] Error loading clients:', error);
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
        
        console.log(`[Server] Saving ${records.length} performance records for client ${clientId}`);
        
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
        
        console.log(`[Server] ✅ Saved ${records.length} performance records for ${clientId}`);
        
        res.json({ 
            success: true, 
            clientId,
            batchId,
            count: records.length,
            message: 'Performance records saved successfully'
        });
        
    } catch (error) {
        console.error('[Server] Error saving performance records:', error);
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
        
        console.log(`[Server] ✅ Retrieved performance data for ${Object.keys(performanceData).length} clients`);
        
        res.json({ 
            success: true, 
            data: performanceData,
            clientCount: Object.keys(performanceData).length,
            totalRecords: rows.length
        });
        
    } catch (error) {
        console.error('[Server] Error loading performance data:', error);
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
        
        console.log(`[Server] ✅ File uploaded: ${req.file.filename}`);
        
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
        console.error('[Server] Error uploading file:', error);
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
        
        console.log(`[Server] ✅ Database stats: ${totalRecords} total records, ${dbSizeKB}KB`);
        
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
        console.error('[Server] Error getting stats:', error);
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
            console.log(`[Server] Cleared ${result.changes} records from ${tableName}`);
        });
        
        console.log(`[Server] ✅ Cleared all data: ${totalDeleted} total records deleted`);
        
        res.json({
            success: true,
            deletedRecords: totalDeleted,
            message: 'All data cleared successfully'
        });
        
    } catch (error) {
        console.error('[Server] Error clearing data:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🚀 Ver6 Local Server running on http://localhost:${PORT}`);
    console.log(`📊 Database: ${dbPath}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📈 Stats: http://localhost:${PORT}/api/stats`);
    console.log('');
    console.log('API Endpoints:');
    console.log('  POST /api/data/:table     - Save data');
    console.log('  GET  /api/data/:table     - Get data');
    console.log('  DELETE /api/data/:table   - Delete data');
    console.log('  POST /api/clients         - Save clients');
    console.log('  GET  /api/clients         - Get clients');
    console.log('  POST /api/performance/:id - Save performance data');
    console.log('  GET  /api/performance     - Get performance data');
    console.log('  POST /api/upload          - Upload files');
    console.log('  GET  /api/stats           - Database statistics');
    console.log('  POST /api/clear           - Clear all data');
    console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down gracefully...');
    db.close();
    process.exit(0);
});

export default app;
