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
import SQLDebugLogger from './sql-debug-logger.js';

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
    console.log('🔍 [SCHEMA DEBUG] ensureCompleteSchema function started');
    const actions = [];
    
    // Import the complete schema from sqlTables.js
    console.log('🔍 [SCHEMA DEBUG] Importing sqlTables.js...');
    const { TABLES, getCreationOrder } = await import('./sqlTables.js');
    const tablesOrder = getCreationOrder();
    console.log('🔍 [SCHEMA DEBUG] Tables order:', tablesOrder);
    
    logger.info(`[SQL][Schema] Tables to create in order:`, tablesOrder);
    
    // Create schema step by step
    for (const tableName of tablesOrder) {
        console.log(`🔍 [SCHEMA DEBUG] Starting table: ${tableName}`);
        const tableConfig = TABLES[tableName];
        logger.info(`[SQL][Schema] Processing table: ${tableName}`);
        
        try {
            // Check if table exists
            console.log(`🔍 [SCHEMA DEBUG] Checking if ${tableName} exists...`);
            const checkTableQuery = `
                SELECT COUNT(*) as count 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = '${tableName}' AND TABLE_SCHEMA = 'dbo'
            `;
            const tableExists = await sqlPool.request().query(checkTableQuery);
            console.log(`🔍 [SCHEMA DEBUG] ${tableName} exists check result:`, tableExists.recordset[0].count);
            
            if (tableExists.recordset[0].count === 0) {
                console.log(`🔍 [SCHEMA DEBUG] ${tableName} does not exist, creating...`);
                logger.info(`[SQL][Schema] Creating table: ${tableName}`);
                
                try {
                    // Use the exact SQL from sqlTables.js
                    let createSQL = tableConfig.create;
                    console.log(`🔍 [SCHEMA DEBUG] About to execute SQL for ${tableName}:`);
                    console.log(`🔍 [SCHEMA DEBUG] SQL:`, createSQL.substring(0, 200) + '...');
                    
                    await sqlPool.request().query(createSQL);
                    console.log(`🔍 [SCHEMA DEBUG] ✅ ${tableName} created successfully`);
                    logger.info(`[SQL][Schema] ✅ Table ${tableName} created successfully`);
                    actions.push({ step: 'create-table', detail: tableName, status: 'ok', rows: null });
                } catch (createError) {
                    console.log(`❌ [SCHEMA DEBUG] CRITICAL ERROR creating table ${tableName}:`);
                    console.log(`❌ [SCHEMA DEBUG] Error message:`, createError.message);
                    console.log(`❌ [SCHEMA DEBUG] Error number:`, createError.number);
                    console.log(`❌ [SCHEMA DEBUG] Error severity:`, createError.severity);
                    console.log(`❌ [SCHEMA DEBUG] Error state:`, createError.state);
                    console.log(`❌ [SCHEMA DEBUG] Error class:`, createError.class);
                    console.log(`❌ [SCHEMA DEBUG] Error procedure:`, createError.procName);
                    console.log(`❌ [SCHEMA DEBUG] Error line:`, createError.lineNumber);
                    console.log(`❌ [SCHEMA DEBUG] SQL being executed:`, createSQL);
                    console.log(`❌ [SCHEMA DEBUG] Full error object:`, JSON.stringify(createError, Object.getOwnPropertyNames(createError), 2));
                    
                    logger.error(`[SQL][Schema] ❌ Error creating table ${tableName}:`);
                    logger.error(`[SQL][Schema] Error message:`, createError.message);
                    logger.error(`[SQL][Schema] Error number:`, createError.number);
                    logger.error(`[SQL][Schema] Error severity:`, createError.severity);
                    logger.error(`[SQL][Schema] Error state:`, createError.state);
                    logger.error(`[SQL][Schema] Error class:`, createError.class);
                    logger.error(`[SQL][Schema] Error procedure:`, createError.procName);
                    logger.error(`[SQL][Schema] Error line:`, createError.lineNumber);
                    logger.error(`[SQL][Schema] SQL being executed:`, createSQL);
                    
                    // Check if it's a constraint/index error and if the table was partially created
                    if (createError.message && (createError.message.includes('constraint') || createError.message.includes('index') || createError.number === 2714)) {
                        logger.warn(`[SQL][Schema] Constraint/index error on ${tableName}, checking if table exists now...`);
                        
                        const reCheckTable = await sqlPool.request().query(checkTableQuery);
                        if (reCheckTable.recordset[0].count > 0) {
                            logger.info(`[SQL][Schema] Table ${tableName} exists after constraint error - continuing`);
                            actions.push({ step: 'create-table', detail: tableName, status: 'exists-after-error', rows: null });
                        } else {
                            // Try to get more information about what went wrong
                            logger.error(`[SQL][Schema] Table ${tableName} still doesn't exist after error. Attempting to continue with next table.`);
                            actions.push({ step: 'create-table', detail: tableName, status: 'failed-but-continue', rows: null });
                            continue; // Continue with next table instead of throwing
                        }
                    } else {
                        // Log error but continue with next table
                        logger.error(`[SQL][Schema] Non-constraint error on ${tableName}, continuing with next table`);
                        actions.push({ step: 'create-table', detail: tableName, status: 'error-continue', rows: null });
                        continue;
                    }
                }
            } else {
                logger.info(`[SQL][Schema] Table ${tableName} already exists`);
                actions.push({ step: 'check-table', detail: tableName, status: 'exists', rows: null });
            }
            
            // Note: Removed automatic 'Unassigned' client creation
            // Clients are now created automatically from Excel imports
            
        } catch (tableError) {
            logger.error(`[SQL][Schema] ❌ Error processing table ${tableName}:`, tableError.message);
            logger.error(`[SQL][Schema] Table error details:`, {
                message: tableError.message,
                number: tableError.number,
                severity: tableError.severity,
                state: tableError.state,
                class: tableError.class
            });
            actions.push({ step: 'create-table', detail: tableName, status: 'error', rows: null, error: tableError.message });
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

    const hasErrors = actions.some(action => action.status === 'error');
    const hasSuccessfulTables = finalTables.recordset.length > 0;
    
    return {
        success: hasSuccessfulTables, // Success if at least some tables were created
        actions,
        tablesCreated: finalTables.recordset.length,
        hasErrors,
        message: hasErrors ? `Schema setup completed with some errors. ${finalTables.recordset.length} tables available.` : 'Schema setup completed successfully.'
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

// Meta Excel to Database Field Mapping (COMPLETO)
const META_FIELD_MAPPING = new Map([
    // Identificadores principales
    ['nombre_de_la_campana', 'nombre_de_la_campaña'],
    ['nombre_del_conjunto_de_anuncios', 'nombre_del_conjunto_de_anuncios'],
    ['nombre_del_anuncio', 'nombre_del_anuncio'],
    ['nombre_de_la_cuenta', 'nombre_de_la_cuenta'],
    ['dia', 'dia'],
    ['edad', 'edad'],
    ['sexo', 'sexo'],
    
    // Métricas básicas de rendimiento
    ['importe_gastado_eur', 'importe_gastado_EUR'],
    ['impresiones', 'impresiones'],
    ['alcance', 'alcance'],
    ['frecuencia', 'frecuencia'],
    ['compras', 'compras'],
    ['visitas_a_la_pagina_de_destino', 'visitas_a_la_página_de_destino'],
    ['clics_todos', 'clics_todos'],
    ['cpm_costo_por_mil_impresiones', 'cpm_costo_por_mil_impresiones'],
    ['ctr_todos', 'ctr_todos'],
    ['cpc_todos', 'cpc_todos'],
    
    // Entrega
    ['entrega_de_la_campana', 'entrega_de_la_campaña'],
    ['entrega_del_conjunto_de_anuncios', 'entrega_del_conjunto_de_anuncios'],
    ['entrega_del_anuncio', 'entrega_del_anuncio'],
    
    // Métricas de video
    ['reproducciones_de_video_de_3_segundos', 'reproducciones_3s'],
    ['reproducciones_de_video_hasta_el_25', 'rep_video_25_pct'],
    ['reproducciones_de_video_hasta_el_50', 'rep_video_50_pct'],
    ['reproducciones_de_video_hasta_el_75', 'rep_video_75_pct'],
    ['reproducciones_de_video_hasta_el_95', 'rep_video_95_pct'],
    ['reproducciones_de_video_hasta_el_100', 'rep_video_100_pct'],
    ['tiempo_promedio_de_reproduccion_del_video', 'tiempo_promedio_video'],
    ['reproducciones_de_video', 'rep_video'],
    ['reproducciones_de_video_continuas_de_2_segundos_unicas', 'rep_video_2s_unicas'],
    ['thruplays', 'thruplays'],
    
    // Conversiones y pagos
    ['pagos_iniciados', 'pagos_iniciados'],
    ['pagos_iniciados_en_el_sitio_web', 'pagos_iniciados_web'],
    ['porcentaje_de_compras_por_visitas_a_la_pagina_de_destino', 'pct_compras_por_visitas_lp'],
    ['articulos_agregados_al_carrito', 'artículos_agregados_al_carrito'],
    ['informacion_de_pago_agregada', 'información_de_pago_agregada'],
    ['valor_de_conversion_de_compras', 'valor_de_conversión_compras'],
    
    // Interacciones y engagement
    ['me_gusta_en_facebook', 'me_gusta_en_facebook'],
    ['interacciones_con_la_publicacion', 'interacciones_con_la_publicación'],
    ['interaccion_con_la_pagina', 'interacción_con_la_página'],
    ['comentarios_de_publicaciones', 'comentarios_de_publicaciones'],
    ['reacciones_a_publicaciones', 'reacciones_a_publicaciones'],
    ['veces_que_se_compartieron_las_publicaciones', 'veces_compartidas_publicaciones'],
    
    // Enlaces y CTR
    ['clics_en_el_enlace', 'clics_en_el_enlace'],
    ['ctr_porcentaje_de_clics_en_el_enlace', 'ctr_link_click_pct'],
    ['ctr_unico_porcentaje_de_clics_en_el_enlace', 'ctr_unico_enlace_pct'],
    
    // Presupuesto y puja
    ['presupuesto_de_la_campana', 'presupuesto_de_la_campaña'],
    ['tipo_de_presupuesto_de_la_campana', 'tipo_de_presupuesto_de_la_campaña'],
    ['puja', 'puja'],
    ['tipo_de_puja', 'tipo_de_puja'],
    
    // Públicos
    ['publicos_personalizados_incluidos', 'públicos_personalizados_incluidos'],
    ['publicos_personalizados_excluidos', 'públicos_personalizados_excluidos'],
    
    // Configuración y objetivos
    ['objetivo', 'objetivo'],
    ['tipo_de_compra', 'tipo_de_compra'],
    ['divisa', 'divisa'],
    ['url_del_sitio_web', 'url_del_sitio_web'],
    
    // Informes y fechas
    ['inicio_del_informe', 'inicio_del_informe'],
    ['fin_del_informe', 'fin_del_informe'],
    
    // Métricas AIDA y personalizadas
    ['atencion', 'atencion'],
    ['deseo', 'deseo'],
    ['interes', 'interes'],
    
    // Métricas avanzadas de video y conversión
    ['porcentaje_de_reproducciones_de_video_de_3_segundos_por_impresiones', 'pct_rep_3s_por_impresiones'],
    ['aov', 'aov'],
    ['lp_view_rate', 'lp_view_rate'],
    ['adc_lpv', 'adc_lpv'],
    ['captura_de_video', 'captura_de_video'],
    ['captura_video', 'captura_video_final'],
    ['tasa_de_conversion_de_landing', 'tasa_conv_landing'],
    ['pct_compras', 'pct_compras'],
    ['visualizaciones', 'visualizaciones'],
    ['cvr_link_click', 'cvr_link_click'],
    ['nombre_de_la_imagen', 'nombre_de_la_imagen'],
    ['retencion_video', 'retencion_video_short'],
    ['retencion_de_video', 'retención_de_video'],
    ['impresiones_compras', 'impresiones_compras']
]);

// Columns that contain numeric data
const NUMERIC_COLUMNS = new Set([
    'importe_gastado_EUR', 'impresiones', 'alcance', 'frecuencia', 'compras',
    'clics_todos', 'clics_en_el_enlace', 'visitas_a_la_página_de_destino', 'ctr_todos',
    'ctr_link_click_pct', 'cpc_todos', 'cpm_costo_por_mil_impresiones',
    'artículos_agregados_al_carrito', 'pagos_iniciados', 'pagos_iniciados_web',
    'valor_de_conversión_compras', 'reproducciones_3s', 'me_gusta_en_facebook',
    'rep_video_25_pct', 'rep_video_50_pct', 'rep_video_75_pct', 'rep_video_95_pct',
    'rep_video_100_pct', 'tiempo_promedio_video', 'interacciones_con_la_publicación',
    'reacciones_a_publicaciones', 'comentarios_de_publicaciones', 'veces_compartidas_publicaciones',
    'puja', 'presupuesto_de_la_campaña', 'información_de_pago_agregada', 'interacción_con_la_página',
    'pct_compras_por_visitas_lp', 'atencion', 'deseo', 'interes', 'pct_rep_3s_por_impresiones',
    'aov', 'lp_view_rate', 'adc_lpv', 'captura_de_video', 'tasa_conv_landing', 'pct_compras',
    'visualizaciones', 'cvr_link_click', 'retencion_video_short', 'retención_de_video',
    'thruplays', 'rep_video', 'rep_video_2s_unicas', 'ctr_unico_enlace_pct',
    'impresiones_compras', 'captura_video_final'
]);

// Columns that contain date data
const DATE_COLUMNS = new Set([
    'dia', 'fecha_de_creacion', 'inicio_del_informe', 'fin_del_informe'
]);

// All available metric columns (eliminar duplicados)
const METRIC_COLUMNS = [...new Set(Array.from(META_FIELD_MAPPING.values()))];

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

// Default MSSQL types for Meta fields (ACTUALIZADO)
const MSSQL_TYPE_MAP = new Map([
    // Default fallback for any unknown column
    ['default', sql.VarChar(sql.MAX)],
    
    // Identificadores
    ['unique_id', sql.VarChar(255)],
    ['id_reporte', sql.Int],
    
    // Text fields - Identificadores principales
    ['nombre_de_la_campaña', sql.VarChar(255)],
    ['nombre_del_conjunto_de_anuncios', sql.VarChar(255)],
    ['nombre_del_anuncio', sql.VarChar(255)],
    ['nombre_de_la_cuenta', sql.VarChar(255)],
    ['edad', sql.VarChar(50)],
    ['sexo', sql.VarChar(50)],
    
    // Text fields - Entrega
    ['entrega_de_la_campaña', sql.VarChar(50)],
    ['entrega_del_conjunto_de_anuncios', sql.VarChar(50)],
    ['entrega_del_anuncio', sql.VarChar(50)],
    
    // Text fields - Configuración
    ['objetivo', sql.VarChar(100)],
    ['tipo_de_compra', sql.VarChar(50)],
    ['tipo_de_puja', sql.VarChar(50)],
    ['tipo_de_presupuesto_de_la_campaña', sql.VarChar(50)],
    ['divisa', sql.VarChar(10)],
    ['url_del_sitio_web', sql.VarChar(sql.MAX)],
    ['públicos_personalizados_incluidos', sql.VarChar(sql.MAX)],
    ['públicos_personalizados_excluidos', sql.VarChar(sql.MAX)],
    ['nombre_de_la_imagen', sql.VarChar(255)],
    
    // Date fields
    ['dia', sql.Date],
    ['inicio_del_informe', sql.Date],
    ['fin_del_informe', sql.Date],
    
    // Numeric fields - Métricas básicas
    ['importe_gastado_EUR', sql.Decimal(12, 2)],
    ['impresiones', sql.BigInt],
    ['alcance', sql.BigInt],
    ['frecuencia', sql.Decimal(5, 2)],
    ['compras', sql.Int],
    ['visitas_a_la_página_de_destino', sql.Int],
    ['clics_todos', sql.Int],
    ['clics_en_el_enlace', sql.Int],
    ['cpm_costo_por_mil_impresiones', sql.Decimal(12, 2)],
    ['ctr_todos', sql.Decimal(5, 2)],
    ['cpc_todos', sql.Decimal(12, 2)],
    ['ctr_link_click_pct', sql.Decimal(5, 2)],
    ['ctr_unico_enlace_pct', sql.Decimal(5, 2)],
    
    // Numeric fields - Video
    ['reproducciones_3s', sql.BigInt],
    ['rep_video_25_pct', sql.BigInt],
    ['rep_video_50_pct', sql.BigInt],
    ['rep_video_75_pct', sql.BigInt],
    ['rep_video_95_pct', sql.BigInt],
    ['rep_video_100_pct', sql.BigInt],
    ['tiempo_promedio_video', sql.Decimal(6, 2)],
    ['rep_video', sql.Int],
    ['rep_video_2s_unicas', sql.Int],
    ['thruplays', sql.Int],
    
    // Numeric fields - Conversiones
    ['pagos_iniciados', sql.Int],
    ['pagos_iniciados_web', sql.Int],
    ['artículos_agregados_al_carrito', sql.Int],
    ['información_de_pago_agregada', sql.Int],
    ['valor_de_conversión_compras', sql.Decimal(12, 2)],
    ['pct_compras_por_visitas_lp', sql.Decimal(5, 2)],
    
    // Numeric fields - Interacciones
    ['me_gusta_en_facebook', sql.Int],
    ['interacciones_con_la_publicación', sql.Int],
    ['interacción_con_la_página', sql.Int],
    ['comentarios_de_publicaciones', sql.Int],
    ['reacciones_a_publicaciones', sql.Int],
    ['veces_compartidas_publicaciones', sql.Int],
    
    // Numeric fields - Presupuesto
    ['puja', sql.Decimal(12, 2)],
    ['presupuesto_de_la_campaña', sql.Decimal(12, 2)],
    
    // Numeric fields - AIDA y personalizadas
    ['atencion', sql.Int],
    ['deseo', sql.Int],
    ['interes', sql.Int],
    
    // Numeric fields - Métricas avanzadas
    ['pct_rep_3s_por_impresiones', sql.Decimal(5, 2)],
    ['aov', sql.Decimal(12, 2)],
    ['lp_view_rate', sql.Decimal(5, 2)],
    ['adc_lpv', sql.Decimal(12, 2)],
    ['captura_de_video', sql.Int],
    ['captura_video_final', sql.Int],
    ['tasa_conv_landing', sql.Decimal(5, 2)],
    ['pct_compras', sql.Decimal(5, 2)],
    ['visualizaciones', sql.Int],
    ['cvr_link_click', sql.Decimal(5, 2)],
    ['retencion_video_short', sql.Decimal(5, 2)],
    ['retención_de_video', sql.Decimal(5, 2)],
    ['impresiones_compras', sql.Int]
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

// Debug endpoint to test SQL connection step by step with comprehensive logging
app.post('/api/sql/debug-connect', async (req, res) => {
    const { server, port, database, user, password } = req.body || {};
    
    // Create comprehensive logger
    const debugLogger = new SQLDebugLogger();
    
    debugLogger.info('SESSION', 'Starting comprehensive SQL debug session');
    debugLogger.debug('REQUEST', 'Received connection request', {
        server: server || 'undefined',
        port: port || 'undefined', 
        database: database || 'undefined',
        user: user || 'undefined',
        passwordProvided: !!password,
        requestBody: req.body
    });
    
    try {
        debugLogger.info('VALIDATION', 'Starting parameter validation');
        
        const portIsValid = typeof port === 'string' && /^\d+$/.test(port);
        const portNumber = portIsValid ? parseInt(port, 10) : NaN;
        
        debugLogger.debug('VALIDATION', 'Parameter validation details', {
            serverType: typeof server,
            serverValid: typeof server === 'string' && !!server.trim(),
            portType: typeof port,
            portIsValid,
            portNumber,
            portInRange: !isNaN(portNumber) && portNumber >= 1 && portNumber <= 65535,
            databaseType: typeof database,
            databaseValid: typeof database === 'string' && !!database.trim(),
            userType: typeof user,
            userValid: typeof user === 'string' && !!user.trim(),
            passwordType: typeof password,
            passwordValid: typeof password === 'string' && !!password.trim()
        });
        
        if (
            typeof server !== 'string' || !server.trim() ||
            !portIsValid || portNumber < 1 || portNumber > 65535 ||
            typeof database !== 'string' || !database.trim() ||
            typeof user !== 'string' || !user.trim() ||
            typeof password !== 'string' || !password.trim()
        ) {
            debugLogger.error('VALIDATION', 'Invalid SQL connection parameters provided');
            const reportFile = debugLogger.saveFullReport();
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid parameters', 
                logFile: reportFile,
                summary: debugLogger.getLogSummary()
            });
        }
        
        debugLogger.success('VALIDATION', 'All parameters validated successfully');
        
        const config = {
            server,
            port: portNumber,
            database,
            user,
            password,
            options: {
                encrypt: false,
                trustServerCertificate: true,
                enableArithAbort: true
            }
        };
        
        debugLogger.debug('CONFIG', 'SQL Server connection configuration created', config);
        
        debugLogger.info('CONNECTION', 'Attempting to connect to SQL Server');
        
        if (sqlPool) {
            debugLogger.info('CLEANUP', 'Closing existing connection pool');
            try {
                await sqlPool.close();
                debugLogger.success('CLEANUP', 'Existing connection pool closed successfully');
            } catch (closeError) {
                debugLogger.warn('CLEANUP', 'Error closing existing connection pool', closeError);
            }
        }
        
        debugLogger.info('CONNECTION', 'Creating new SQL connection pool');
        sqlPool = await new sql.ConnectionPool(config).connect();
        debugLogger.success('CONNECTION', 'Connected to SQL Server successfully');
        
        debugLogger.info('TEST', 'Testing connection with simple query');
        const testResult = await sqlPool.request().query('SELECT 1 as test, GETDATE() as currentTime, @@VERSION as version');
        debugLogger.success('TEST', 'Test query executed successfully', { 
            result: testResult.recordset,
            rowCount: testResult.rowsAffected 
        });
        
        debugLogger.info('SCHEMA', 'Starting comprehensive schema verification');
        
        // Check existing tables with detailed info
        debugLogger.info('SCHEMA', 'Checking existing database tables');
        const existingTablesQuery = `
            SELECT 
                t.TABLE_NAME,
                t.TABLE_TYPE,
                t.TABLE_SCHEMA
            FROM INFORMATION_SCHEMA.TABLES t 
            WHERE t.TABLE_SCHEMA = 'dbo' 
            ORDER BY t.TABLE_NAME
        `;
        const existingTables = await sqlPool.request().query(existingTablesQuery);
        debugLogger.info('SCHEMA', 'Found existing tables', { 
            count: existingTables.recordset.length,
            tables: existingTables.recordset
        });
        
        // Check constraints and indexes
        debugLogger.info('SCHEMA', 'Checking existing constraints and indexes');
        const constraintsQuery = `
            SELECT 
                tc.CONSTRAINT_NAME,
                tc.CONSTRAINT_TYPE,
                tc.TABLE_NAME,
                kcu.COLUMN_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
                ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
            WHERE tc.TABLE_SCHEMA = 'dbo'
            ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_NAME
        `;
        const constraints = await sqlPool.request().query(constraintsQuery);
        debugLogger.info('SCHEMA', 'Found existing constraints', { 
            count: constraints.recordset.length,
            constraints: constraints.recordset
        });
        
        // Load table definitions
        debugLogger.info('SCHEMA', 'Loading table definitions from sqlTables.js');
        const { TABLES, getCreationOrder } = await import('./sqlTables.js');
        const tablesOrder = getCreationOrder();
        debugLogger.info('SCHEMA', 'Table creation order determined', { 
            totalTables: Object.keys(TABLES).length,
            creationOrder: tablesOrder,
            tableDefinitions: Object.keys(TABLES)
        });
        
        debugLogger.info('SCHEMA', 'Beginning table-by-table processing');
        
        let successfulTables = 0;
        let failedTables = 0;
        let skippedTables = 0;
        
        for (const tableName of tablesOrder) {
            debugLogger.info(`TABLE-${tableName.toUpperCase()}`, `Starting processing of table: ${tableName}`);
            
            try {
                const tableConfig = TABLES[tableName];
                debugLogger.debug(`TABLE-${tableName.toUpperCase()}`, 'Table configuration loaded', {
                    hasCreateSQL: !!tableConfig.create,
                    dependencies: tableConfig.dependencies || [],
                    createSQLLength: tableConfig.create ? tableConfig.create.length : 0
                });
                
                // Check if table exists
                const checkTableQuery = `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${tableName}' AND TABLE_SCHEMA = 'dbo'`;
                debugLogger.debug(`TABLE-${tableName.toUpperCase()}`, 'Checking table existence', { query: checkTableQuery });
                
                const tableExists = await sqlPool.request().query(checkTableQuery);
                const exists = tableExists.recordset[0].count > 0;
                debugLogger.info(`TABLE-${tableName.toUpperCase()}`, `Table existence check complete`, { 
                    exists,
                    count: tableExists.recordset[0].count 
                });
                
                if (!exists) {
                    debugLogger.info(`TABLE-${tableName.toUpperCase()}`, `Table does not exist, attempting creation`);
                    debugLogger.sql(`TABLE-${tableName.toUpperCase()}`, 'Executing CREATE TABLE statement', tableConfig.create);
                    
                    try {
                        await sqlPool.request().query(tableConfig.create);
                        debugLogger.success(`TABLE-${tableName.toUpperCase()}`, `Table created successfully`);
                        successfulTables++;
                    } catch (createError) {
                        debugLogger.logError(`TABLE-${tableName.toUpperCase()}`, `CRITICAL ERROR creating table`, createError);
                        
                        // Try to get more SQL Server error details
                        try {
                            const errorDetailsQuery = `
                                SELECT 
                                    ERROR_NUMBER() as ErrorNumber,
                                    ERROR_SEVERITY() as ErrorSeverity,
                                    ERROR_STATE() as ErrorState,
                                    ERROR_PROCEDURE() as ErrorProcedure,
                                    ERROR_LINE() as ErrorLine,
                                    ERROR_MESSAGE() as ErrorMessage
                            `;
                            const errorDetails = await sqlPool.request().query(errorDetailsQuery);
                            debugLogger.error(`TABLE-${tableName.toUpperCase()}`, 'SQL Server error details', errorDetails.recordset[0]);
                        } catch (detailError) {
                            debugLogger.warn(`TABLE-${tableName.toUpperCase()}`, 'Could not retrieve SQL error details', detailError);
                        }
                        
                        failedTables++;
                        continue; // Continue with next table
                    }
                } else {
                    debugLogger.info(`TABLE-${tableName.toUpperCase()}`, `Table already exists, skipping creation`);
                    skippedTables++;
                }
                
                // Special handling for clients table
                if (tableName === 'clients') {
                    debugLogger.info('DEFAULT-CLIENT', 'Processing default client for clients table');
                    try {
                        const unassignedCheck = await sqlPool.request().query("SELECT COUNT(*) as count FROM clients WHERE name = 'Unassigned'");
                        debugLogger.debug('DEFAULT-CLIENT', 'Default client existence check', { count: unassignedCheck.recordset[0].count });
                        
                        if (unassignedCheck.recordset[0].count === 0) {
                            debugLogger.info('DEFAULT-CLIENT', 'Creating default Unassigned client');
                            await sqlPool.request().query("INSERT INTO clients (name) VALUES ('Unassigned')");
                            debugLogger.success('DEFAULT-CLIENT', 'Default client created successfully');
                        } else {
                            debugLogger.info('DEFAULT-CLIENT', 'Default client already exists');
                        }
                    } catch (clientError) {
                        debugLogger.logError('DEFAULT-CLIENT', 'Error handling default client', clientError);
                    }
                }
                
            } catch (tableError) {
                debugLogger.logError(`TABLE-${tableName.toUpperCase()}`, `Unexpected error processing table`, tableError);
                failedTables++;
                continue;
            }
        }
        
        debugLogger.info('SUMMARY', 'Table processing completed', {
            totalTables: tablesOrder.length,
            successful: successfulTables,
            failed: failedTables,
            skipped: skippedTables
        });
        
        // Final verification
        debugLogger.info('FINAL-CHECK', 'Performing final database verification');
        const finalTables = await sqlPool.request().query(existingTablesQuery);
        const finalConstraints = await sqlPool.request().query(constraintsQuery);
        
        debugLogger.success('FINAL-CHECK', 'Final verification completed', { 
            tablesNow: finalTables.recordset.length,
            tableNames: finalTables.recordset.map(t => t.TABLE_NAME),
            constraintsNow: finalConstraints.recordset.length
        });
        
        // Save comprehensive report
        const reportFile = debugLogger.saveFullReport();
        const summary = debugLogger.getLogSummary();
        
        debugLogger.success('SESSION', 'Debug session completed successfully');
        
        res.json({ 
            success: true, 
            tablesCreated: finalTables.recordset.length,
            summary,
            logFile: reportFile,
            statistics: {
                totalTables: tablesOrder.length,
                successful: successfulTables,
                failed: failedTables,
                skipped: skippedTables
            }
        });
        
    } catch (error) {
        debugLogger.logError('CONNECTION', 'FATAL ERROR during SQL connection process', error);
        
        // Try to get additional error context
        if (error.originalError) {
            debugLogger.error('CONNECTION', 'Original error details', error.originalError);
        }
        
        if (sqlPool) {
            debugLogger.info('CLEANUP', 'Closing connection pool due to error');
            try {
                await sqlPool.close();
                debugLogger.success('CLEANUP', 'Connection pool closed successfully');
            } catch (closeError) {
                debugLogger.error('CLEANUP', 'Error closing connection pool', closeError);
            }
            sqlPool = null;
        }
        
        const reportFile = debugLogger.saveFullReport();
        const summary = debugLogger.getLogSummary();
        
        res.status(500).json({ 
            success: false, 
            error: error.message, 
            logFile: reportFile,
            summary
        });
    }
});

// --- SQL Server connection management ---
app.post('/api/sql/connect', async (req, res) => {
    const { server, port, database, user, password } = req.body || {};

    // Log connection attempt
    console.log('🔍 [SQL DEBUG] Connection attempt started');
    console.log('🔍 [SQL DEBUG] Parameters:', { server, port, database, user, passwordProvided: !!password });
    
    // Create comprehensive logger for this connection attempt
    let debugLogger;
    try {
        debugLogger = new SQLDebugLogger();
        debugLogger.info('CONNECTION', 'Starting SQL Server connection attempt', {
            server: server || 'undefined',
            port: port || 'undefined', 
            database: database || 'undefined',
            user: user || 'undefined',
            passwordProvided: !!password
        });
        console.log('🔍 [SQL DEBUG] Logger created successfully');
    } catch (loggerError) {
        console.error('❌ [SQL DEBUG] Failed to create logger:', loggerError);
        // Continue without logger
        debugLogger = {
            info: (cat, msg, data) => console.log(`ℹ️ [${cat}] ${msg}`, data),
            debug: (cat, msg, data) => console.log(`🔍 [${cat}] ${msg}`, data),
            error: (cat, msg, data) => console.log(`❌ [${cat}] ${msg}`, data),
            warn: (cat, msg, data) => console.log(`⚠️ [${cat}] ${msg}`, data),
            success: (cat, msg, data) => console.log(`✅ [${cat}] ${msg}`, data),
            logError: (cat, msg, error) => console.log(`❌ [${cat}] ${msg}`, error),
            saveFullReport: () => null
        };
    }

    // Validación básica de parámetros
    const portIsValid = typeof port === 'string' && /^\d+$/.test(port);
    const portNumber = portIsValid ? parseInt(port, 10) : NaN;
    
    debugLogger.debug('VALIDATION', 'Parameter validation details', {
        serverType: typeof server,
        serverValid: typeof server === 'string' && !!server.trim(),
        portType: typeof port,
        portIsValid,
        portNumber,
        portInRange: !isNaN(portNumber) && portNumber >= 1 && portNumber <= 65535,
        databaseType: typeof database,
        databaseValid: typeof database === 'string' && !!database.trim(),
        userType: typeof user,
        userValid: typeof user === 'string' && !!user.trim(),
        passwordType: typeof password,
        passwordValid: typeof password === 'string' && !!password.trim()
    });
    
    if (
        typeof server !== 'string' || !server.trim() ||
        !portIsValid || portNumber < 1 || portNumber > 65535 ||
        typeof database !== 'string' || !database.trim() ||
        typeof user !== 'string' || !user.trim() ||
        typeof password !== 'string' || !password.trim()
    ) {
        debugLogger.error('VALIDATION', 'Invalid SQL connection parameters provided');
        const reportFile = debugLogger.saveFullReport();
        return res.status(400).json({ success: false, error: 'Invalid SQL connection parameters', logFile: reportFile });
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
        console.log('🔍 [SQL DEBUG] Basic connection test successful');

        // Skip automatic table creation to avoid constraint conflicts
        debugLogger.info('SCHEMA', 'Skipping automatic schema setup to avoid constraint errors');
        console.log('🔍 [SQL DEBUG] Schema setup skipped - connection successful');
        
        // Create tables automatically on connection
        const schemaResult = await ensureCompleteSchema(sqlPool, debugLogger);
        logger.info('[SQL] Schema setup result:', schemaResult);

        debugLogger.success('CONNECTION', 'SQL Server connection established successfully');
        console.log('🔍 [SQL DEBUG] About to send success response');
        const reportFile = debugLogger.saveFullReport();
        console.log('🔍 [SQL DEBUG] Report file:', reportFile);
        res.json({ success: true, logFile: reportFile, message: 'Connected successfully without schema creation' });
    } catch (error) {
        console.log('❌ [SQL DEBUG] FATAL ERROR during connection process:');
        console.log('❌ [SQL DEBUG] Error message:', error.message);
        console.log('❌ [SQL DEBUG] Error stack:', error.stack);
        console.log('❌ [SQL DEBUG] Error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        
        debugLogger.logError('CONNECTION', 'FATAL ERROR during connection process', error);
        
        if (sqlPool) {
            debugLogger.info('CLEANUP', 'Closing connection pool due to error');
            await sqlPool.close().catch(() => {});
        }
        sqlPool = null;
        
        const reportFile = debugLogger.saveFullReport();
        res.status(500).json({ success: false, error: error.message, logFile: reportFile, stack: error.stack });
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
            SELECT 
                c.client_id, 
                c.name, 
                c.name_norm,
                c.created_at,
                COUNT(ar.id_reporte) as total_reports,
                MAX(ar.uploaded_at) as last_upload,
                SUM(CAST(ISNULL(m.importe_gastado_EUR, 0) as DECIMAL(18,2))) as total_spend,
                COUNT(DISTINCT m.nombre_del_anuncio) as unique_ads
            FROM dbo.clients c
            LEFT JOIN archivos_reporte ar ON c.client_id = ar.client_id
            LEFT JOIN metricas m ON ar.id_reporte = m.id_reporte
            GROUP BY c.client_id, c.name, c.name_norm, c.created_at
            ORDER BY c.name
        `);
        const clients = result.recordset.map(row => ({
            id: row.client_id,
            name: row.name,
            logo: `https://avatar.vercel.sh/${encodeURIComponent(row.name)}.png?text=${row.name.charAt(0).toUpperCase()}`,
            currency: "EUR",
            metaAccountName: row.name,
            createdAt: row.created_at,
            totalReports: row.total_reports || 0,
            lastUpload: row.last_upload,
            totalSpend: row.total_spend || 0,
            uniqueAds: row.unique_ads || 0,
            hasData: (row.total_reports || 0) > 0
        }));
        logger.info('[DEBUG] Found clients:', clients.length);
        res.json({ success: true, data: clients, count: clients.length });
    } catch (error) {
        logger.error('[SQL] Error al consultar clients:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Obtener anuncios de un cliente específico ---
/**
 * Get SQL performance data (alias for /api/performance)
 */
app.get('/api/sql/performance', async (req, res) => {
    try {
        // Priorizar SQL Server si está conectado
        if (sqlPool) {
            logger.info('[Server] Loading performance data from SQL Server');
            
            const result = await sqlPool.request().query(`
                SELECT 
                    c.client_id,
                    c.name as client_name,
                    ar.nombre_archivo,
                    ar.period_start,
                    ar.period_end,
                    ar.uploaded_at,
                    COUNT(m.id_metricas) as total_records,
                    SUM(CAST(m.importe_gastado_EUR as DECIMAL(18,2))) as total_spend,
                    SUM(CAST(m.compras as INT)) as total_purchases,
                    SUM(CAST(m.impresiones as BIGINT)) as total_impressions,
                    COUNT(DISTINCT m.nombre_del_anuncio) as unique_ads
                FROM clients c
                LEFT JOIN archivos_reporte ar ON c.client_id = ar.client_id
                LEFT JOIN metricas m ON ar.id_reporte = m.id_reporte
                GROUP BY c.client_id, c.name, ar.nombre_archivo, ar.period_start, ar.period_end, ar.uploaded_at
                ORDER BY ar.uploaded_at DESC
            `);
            
            const performanceData = {};
            const recordset = result.recordset || [];

            recordset.forEach(row => {
                if (!performanceData[row.client_id]) {
                    performanceData[row.client_id] = {
                        clientName: row.client_name,
                        currency: "EUR",
                        reports: []
                    };
                }
                
                if (row.nombre_archivo) {
                    performanceData[row.client_id].reports.push({
                        fileName: row.nombre_archivo,
                        periodStart: row.period_start,
                        periodEnd: row.period_end,
                        uploadedAt: row.uploaded_at,
                        totalRecords: row.total_records || 0,
                        totalSpend: parseFloat(row.total_spend) || 0,
                        totalPurchases: row.total_purchases || 0,
                        totalImpressions: row.total_impressions || 0,
                        uniqueAds: row.unique_ads || 0
                    });
                }
            });
            
            const clientCount = Object.keys(performanceData).length;
            logger.info(`[Server] ✅ Retrieved SQL performance data for ${clientCount} clients`);

            res.json({
                success: true,
                data: clientCount ? performanceData : [],
                clientCount,
                source: 'SQL Server'
            });
            
        } else {
            logger.info('[Server] Using SQLite for performance data');
            
            const stmt = db.prepare(`
                SELECT client_id, record_data
                FROM performance_records
                ORDER BY created_at DESC
            `);
            const rows = stmt.all() || [];

            const performanceData = {};

            rows.forEach(row => {
                if (!performanceData[row.client_id]) {
                    performanceData[row.client_id] = [];
                }
                performanceData[row.client_id].push(JSON.parse(row.record_data));
            });

            const clientCount = Object.keys(performanceData).length;
            logger.info(`[Server] ✅ Retrieved SQLite performance data for ${clientCount} clients`);

            res.json({
                success: true,
                data: clientCount ? performanceData : [],
                clientCount,
                totalRecords: rows.length,
                source: 'SQLite'
            });
        }
        
    } catch (error) {
        logger.error('[Server] Error loading SQL performance data:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// --- Get detailed performance data for all clients (for PerformanceView) ---
app.get('/api/sql/performance-details', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ success: false, error: 'Not connected to SQL Server' });
    }
    
    try {
        logger.info('[DEBUG] Getting detailed performance data for all clients');
        
        const result = await sqlPool.request().query(`
            SELECT 
                c.client_id,
                c.name as clientName,
                m.nombre_de_la_campaña as campaignName,
                m.nombre_del_conjunto_de_anuncios as adSetName,
                m.nombre_del_anuncio as adName,
                m.dia as day,
                m.edad as age,
                m.sexo as gender,
                m.divisa as currency,
                CAST(ISNULL(m.importe_gastado_EUR, 0) as DECIMAL(18,2)) as spend,
                CAST(ISNULL(m.impresiones, 0) as BIGINT) as impressions,
                CAST(ISNULL(m.alcance, 0) as BIGINT) as reach,
                CAST(ISNULL(m.frecuencia, 0) as DECIMAL(5,2)) as frequency,
                CAST(ISNULL(m.compras, 0) as INT) as purchases,
                CAST(ISNULL(m.valor_de_conversión_compras, 0) as DECIMAL(18,2)) as purchaseValue,
                CAST(ISNULL(m.clics_en_el_enlace, 0) as INT) as linkClicks,
                CAST(ISNULL(m.clics_todos, 0) as INT) as clicksAll,
                CAST(ISNULL(m.visitas_a_la_página_de_destino, 0) as INT) as landingPageViews,
                CAST(ISNULL(m.artículos_agregados_al_carrito, 0) as INT) as addsToCart,
                CAST(ISNULL(m.pagos_iniciados, 0) as INT) as checkoutsInitiated,
                CAST(ISNULL(m.thruplays, 0) as INT) as thruPlays,
                CAST(ISNULL(m.tiempo_promedio_video, 0) as DECIMAL(6,2)) as videoAveragePlayTime,
                CAST(ISNULL(m.me_gusta_en_facebook, 0) as INT) as pageLikes,
                CAST(ISNULL(m.interacciones_con_la_publicación, 0) as INT) as postInteractions,
                CAST(ISNULL(m.reacciones_a_publicaciones, 0) as INT) as postReactions,
                CAST(ISNULL(m.comentarios_de_publicaciones, 0) as INT) as postComments,
                CAST(ISNULL(m.veces_compartidas_publicaciones, 0) as INT) as postShares,
                CAST(ISNULL(m.atencion, 0) as INT) as attention,
                CAST(ISNULL(m.interes, 0) as INT) as interest,
                CAST(ISNULL(m.deseo, 0) as INT) as desire,
                m.entrega_de_la_campaña as campaignDelivery,
                m.entrega_del_conjunto_de_anuncios as adSetDelivery,
                m.entrega_del_anuncio as adDelivery,
                m.públicos_personalizados_incluidos as includedCustomAudiences,
                m.públicos_personalizados_excluidos as excludedCustomAudiences
            FROM metricas m
            INNER JOIN archivos_reporte ar ON m.id_reporte = ar.id_reporte
            INNER JOIN clients c ON ar.client_id = c.client_id
            WHERE m.nombre_del_anuncio IS NOT NULL 
                AND m.nombre_del_anuncio != ''
            ORDER BY c.client_id, m.dia DESC, m.nombre_del_anuncio
        `);
        
        // Group by client_id
        const performanceByClient = {};
        result.recordset.forEach(row => {
            if (!performanceByClient[row.client_id]) {
                performanceByClient[row.client_id] = [];
            }
            
            // Map to PerformanceRecord format
            const record = {
                clientName: row.clientName,
                campaignName: row.campaignName,
                adSetName: row.adSetName,
                adName: row.adName,
                day: row.day,
                age: row.age,
                gender: row.gender,
                currency: row.currency,
                spend: row.spend,
                impressions: row.impressions,
                reach: row.reach,
                frequency: row.frequency,
                purchases: row.purchases,
                purchaseValue: row.purchaseValue,
                linkClicks: row.linkClicks,
                clicksAll: row.clicksAll,
                landingPageViews: row.landingPageViews,
                addsToCart: row.addsToCart,
                checkoutsInitiated: row.checkoutsInitiated,
                thruPlays: row.thruPlays,
                videoAveragePlayTime: row.videoAveragePlayTime,
                pageLikes: row.pageLikes,
                postInteractions: row.postInteractions,
                postReactions: row.postReactions,
                postComments: row.postComments,
                postShares: row.postShares,
                attention: row.attention,
                interest: row.interest,
                desire: row.desire,
                campaignDelivery: row.campaignDelivery,
                adSetDelivery: row.adSetDelivery,
                adDelivery: row.adDelivery,
                includedCustomAudiences: row.includedCustomAudiences,
                excludedCustomAudiences: row.excludedCustomAudiences
            };
            
            performanceByClient[row.client_id].push(record);
        });
        
        const totalRecords = result.recordset.length;
        const clientCount = Object.keys(performanceByClient).length;
        
        logger.info(`[DEBUG] Found ${totalRecords} performance records for ${clientCount} clients`);
        
        res.json({ 
            success: true, 
            data: performanceByClient, 
            totalRecords,
            clientCount,
            source: 'SQL Server Detailed'
        });
        
    } catch (error) {
        logger.error(`[SQL] Error getting detailed performance data:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/sql/clients/:clientId/ads', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ success: false, error: 'Not connected to SQL Server' });
    }
    
    const clientId = parseInt(req.params.clientId);
    if (isNaN(clientId)) {
        return res.status(400).json({ success: false, error: 'Invalid client ID' });
    }
    
    try {
        logger.info(`[DEBUG] Getting ads for client ${clientId}`);
        
        const result = await sqlPool.request()
            .input('clientId', sql.Int, clientId)
            .query(`
                SELECT 
                    m.nombre_del_anuncio as ad_name,
                    m.nombre_de_la_campaña as campaign_name,
                    m.nombre_del_conjunto_de_anuncios as adset_name,
                    COUNT(*) as total_records,
                    SUM(CAST(ISNULL(m.importe_gastado_EUR, 0) as DECIMAL(18,2))) as total_spend,
                    SUM(CAST(ISNULL(m.compras, 0) as INT)) as total_purchases,
                    SUM(CAST(ISNULL(m.valor_de_conversión_compras, 0) as DECIMAL(18,2))) as total_purchase_value,
                    SUM(CAST(ISNULL(m.impresiones, 0) as BIGINT)) as total_impressions,
                    SUM(CAST(ISNULL(m.clics_todos, 0) as INT)) as total_clicks,
                    MIN(m.dia) as first_date,
                    MAX(m.dia) as last_date,
                    ar.nombre_archivo as report_file
                FROM metricas m
                INNER JOIN archivos_reporte ar ON m.id_reporte = ar.id_reporte
                WHERE ar.client_id = @clientId
                    AND m.nombre_del_anuncio IS NOT NULL 
                    AND m.nombre_del_anuncio != ''
                GROUP BY 
                    m.nombre_del_anuncio, 
                    m.nombre_de_la_campaña, 
                    m.nombre_del_conjunto_de_anuncios,
                    ar.nombre_archivo
                ORDER BY total_spend DESC, m.nombre_del_anuncio
            `);
        
        const ads = result.recordset.map(row => ({
            adName: row.ad_name,
            campaignName: row.campaign_name,
            adsetName: row.adset_name,
            totalRecords: row.total_records,
            totalSpend: row.total_spend || 0,
            totalPurchases: row.total_purchases || 0,
            totalPurchaseValue: row.total_purchase_value || 0,
            totalImpressions: row.total_impressions || 0,
            totalClicks: row.total_clicks || 0,
            firstDate: row.first_date,
            lastDate: row.last_date,
            reportFile: row.report_file,
            roas: row.total_spend > 0 ? ((row.total_purchase_value || 0) / row.total_spend) : 0,
            ctr: row.total_impressions > 0 ? ((row.total_clicks || 0) / row.total_impressions * 100) : 0
        }));
        
        logger.info(`[DEBUG] Found ${ads.length} ads for client ${clientId}`);
        res.json({ success: true, data: ads, count: ads.length, clientId });
        
    } catch (error) {
        logger.error(`[SQL] Error getting ads for client ${clientId}:`, error.message);
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

// Drops all known tables (children first to respect FKs) and recreates them
app.delete('/api/sql/tables', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ error: 'Not connected' });
    }
    try {
        // Drop all tables in deletion order
        logger.info('[SQL] Dropping all tables...');
        for (const table of TABLE_DELETION_ORDER) {
            await sqlPool
                .request()
                .query(`IF OBJECT_ID('${table}', 'U') IS NOT NULL DROP TABLE ${table};`);
        }
        
        // Recreate all tables using the schema function
        logger.info('[SQL] Recreating all tables...');
        const schemaResult = await ensureCompleteSchema(sqlPool, logger);
        
        if (schemaResult.success) {
            res.json({ 
                success: true, 
                message: `All tables dropped and recreated. ${schemaResult.tablesCreated} tables created.`,
                tablesCreated: schemaResult.tablesCreated 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Tables dropped but recreation failed',
                details: schemaResult 
            });
        }
    } catch (error) {
        logger.error('[SQL] Error dropping/recreating tables:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Deletes all data from tables without removing structure
app.delete('/api/sql/tables/data', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ error: 'Not connected' });
    }
    try {
        // Clear data in deletion order to respect foreign keys
        for (const table of TABLE_DELETION_ORDER) {
            await sqlPool
                .request()
                .query(`IF OBJECT_ID('${table}', 'U') IS NOT NULL DELETE FROM ${table};`);
        }
        
        // Note: the previous automatic recreation of 'Unassigned' client has been removed.
        // Clients will be created automatically from Excel imports when necessary.

        res.json({ success: true, message: 'All data cleared' });
    } catch (error) {
        logger.error('[SQL] Error clearing table data:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Execute dimensional stored procedure ---
app.post('/api/sql/execute-dimensional-procedure', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ success: false, error: 'Not connected to SQL Server' });
    }

    const { importBatchId } = req.body;
    if (!importBatchId || typeof importBatchId !== 'number') {
        return res.status(400).json({ success: false, error: 'Valid import_batch_id is required' });
    }

    logger.info(`[Dimensional] Executing high-performance stored procedure for batch ${importBatchId}`);
    
    try {
        const startTime = Date.now();
        
        // Execute the high-performance set-based stored procedure
        const result = await sqlPool.request()
            .input('import_batch_id', sql.Int, importBatchId)
            .execute('sp_load_meta_excel_batch_setbased');
            
        const duration = Date.now() - startTime;
        
        logger.info(`[Dimensional] Stored procedure completed in ${duration}ms`);
        
        res.json({
            success: true,
            message: 'Dimensional data loaded successfully',
            batchId: importBatchId,
            duration: duration,
            procedureName: 'sp_load_meta_excel_batch_setbased'
        });
        
    } catch (error) {
        logger.error(`[Dimensional] Error executing stored procedure:`, error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            batchId: importBatchId
        });
    }
});

// --- Import Meta Excel data into SQL Server (DIMENSIONAL SYSTEM) ---
app.post('/api/sql/import-excel-dimensional', upload.single('file'), async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ success: false, error: 'Not connected to SQL Server' });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    logger.info(`[Dimensional] ===== STARTING DIMENSIONAL EXCEL IMPORT =====`);
    logger.info(`[Dimensional] File: ${req.file.originalname}`);
    
    try {
        // Read Excel file
        logger.info(`[Dimensional] Reading Excel file...`);
        const fileBuffer = fs.readFileSync(req.file.path);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Detect and skip title rows
        let startRow = 0;
        const firstCell = sheet['A1']?.v;
        if (typeof firstCell === 'string' && firstCell.toLowerCase().includes('raw data report')) {
            startRow = 1;
        }
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: null, range: startRow });
        logger.info(`[Dimensional] ✅ Parsed ${rows.length} rows from Excel`);

        if (rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Excel file is empty' });
        }

        // Create batch record in etl_batches table
        const batchResult = await sqlPool.request()
            .input('batch_name', sql.VarChar(255), req.file.originalname)
            .input('source_file', sql.VarChar(255), req.file.originalname)
            .input('total_rows', sql.Int, rows.length)
            .query(`
                INSERT INTO etl_batches (batch_name, source_file, status, total_rows, created_at)
                OUTPUT INSERTED.batch_id
                VALUES (@batch_name, @source_file, 'processing', @total_rows, GETDATE())
            `);
            
        const batchId = batchResult.recordset[0].batch_id;
        logger.info(`[Dimensional] Created ETL batch with ID: ${batchId}`);
        
        // Insert data into staging table (stg_meta_daily)
        logger.info(`[Dimensional] Inserting data into staging table...`);
        let insertedRows = 0;
        let errors = 0;
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            try {
                // Map Excel columns to staging table columns
                const request = sqlPool.request()
                    .input('import_batch_id', sql.Int, batchId)
                    .input('account_name', sql.VarChar(255), row['Nombre de la cuenta'] || row['Account name'] || '')
                    .input('campaign_name', sql.VarChar(255), row['Nombre de la campaña'] || row['Campaign name'] || '')
                    .input('adset_name', sql.VarChar(255), row['Nombre del conjunto de anuncios'] || row['Adset name'] || '')
                    .input('ad_name', sql.VarChar(255), row['Nombre del anuncio'] || row['Ad name'] || '')
                    .input('dte', sql.Date, new Date(row['Día'] || row['Day'] || row['Date']))
                    .input('age_label', sql.VarChar(50), row['Edad'] || row['Age'] || 'Desconocido')
                    .input('gender_label', sql.VarChar(50), row['Sexo'] || row['Gender'] || 'DESCONOCIDO')
                    .input('currency_code', sql.VarChar(10), row['Divisa'] || row['Currency'] || 'EUR')
                    .input('spend', sql.Decimal(12, 2), parseNumber(row['Importe gastado (EUR)'] || row['Amount spent (EUR)'] || 0))
                    .input('impressions', sql.BigInt, parseInt(row['Impresiones'] || row['Impressions'] || 0))
                    .input('reach', sql.BigInt, parseInt(row['Alcance'] || row['Reach'] || 0))
                    .input('frequency', sql.Decimal(5, 2), parseFloat(row['Frecuencia'] || row['Frequency'] || 0))
                    .input('clicks_all', sql.Int, parseInt(row['Clics (todos)'] || row['Clicks (all)'] || 0))
                    .input('link_clicks', sql.Int, parseInt(row['Clics en el enlace'] || row['Link clicks'] || 0))
                    .input('lpv', sql.Int, parseInt(row['Visitas a la página de destino'] || row['Landing page views'] || 0))
                    .input('purchases', sql.Int, parseInt(row['Compras'] || row['Purchases'] || 0))
                    .input('conversion_value', sql.Decimal(12, 2), parseNumber(row['Valor de conversión de compras'] || row['Purchase conversion value'] || 0))
                    .input('campaign_status', sql.VarChar(50), row['Entrega de la campaña'] || row['Campaign delivery'] || 'ACTIVE')
                    .input('adset_status', sql.VarChar(50), row['Entrega del conjunto de anuncios'] || row['Adset delivery'] || 'ACTIVE')
                    .input('ad_status', sql.VarChar(50), row['Entrega del anuncio'] || row['Ad delivery'] || 'ACTIVE')
                    .input('objective_name', sql.VarChar(100), row['Objetivo'] || row['Objective'] || '')
                    .input('budget_type_name', sql.VarChar(50), row['Tipo de presupuesto de la campaña'] || row['Campaign budget type'] || '')
                    .input('budget', sql.Decimal(12, 2), parseNumber(row['Presupuesto de la campaña'] || row['Campaign budget'] || 0))
                    .input('landing_url', sql.VarChar(2000), row['URL del sitio web'] || row['Website URL'] || '')
                    .input('audiences_included_raw', sql.VarChar(sql.MAX), row['Públicos personalizados incluidos'] || row['Custom audiences included'] || '')
                    .input('audiences_excluded_raw', sql.VarChar(sql.MAX), row['Públicos personalizados excluidos'] || row['Custom audiences excluded'] || '')
                    .input('v3s', sql.Int, parseInt(row['Reproducciones de vídeo de 3 segundos'] || row['3-second video plays'] || 0))
                    .input('v25', sql.Int, parseInt(row['Reproducciones de vídeo hasta el 25%'] || row['Video plays at 25%'] || 0))
                    .input('v50', sql.Int, parseInt(row['Reproducciones de vídeo hasta el 50%'] || row['Video plays at 50%'] || 0))
                    .input('v75', sql.Int, parseInt(row['Reproducciones de vídeo hasta el 75%'] || row['Video plays at 75%'] || 0))
                    .input('v95', sql.Int, parseInt(row['Reproducciones de vídeo hasta el 95%'] || row['Video plays at 95%'] || 0))
                    .input('v100', sql.Int, parseInt(row['Reproducciones de vídeo hasta el 100%'] || row['Video plays at 100%'] || 0))
                    .input('thruplays', sql.Int, parseInt(row['ThruPlays'] || row['Thruplays'] || 0))
                    .input('avg_watch', sql.Decimal(6, 2), parseFloat(row['Tiempo promedio de reproducción del vídeo'] || row['Average video watch time'] || 0));
                    
                await request.query(`
                    INSERT INTO stg_meta_daily (
                        import_batch_id, account_name, campaign_name, adset_name, ad_name, dte,
                        age_label, gender_label, currency_code, spend, impressions, reach, frequency,
                        clicks_all, link_clicks, lpv, purchases, conversion_value,
                        campaign_status, adset_status, ad_status, objective_name, budget_type_name,
                        budget, landing_url, audiences_included_raw, audiences_excluded_raw,
                        v3s, v25, v50, v75, v95, v100, thruplays, avg_watch
                    ) VALUES (
                        @import_batch_id, @account_name, @campaign_name, @adset_name, @ad_name, @dte,
                        @age_label, @gender_label, @currency_code, @spend, @impressions, @reach, @frequency,
                        @clicks_all, @link_clicks, @lpv, @purchases, @conversion_value,
                        @campaign_status, @adset_status, @ad_status, @objective_name, @budget_type_name,
                        @budget, @landing_url, @audiences_included_raw, @audiences_excluded_raw,
                        @v3s, @v25, @v50, @v75, @v95, @v100, @thruplays, @avg_watch
                    )
                `);
                
                insertedRows++;
                
                if (insertedRows % 100 === 0) {
                    logger.info(`[Dimensional] Inserted ${insertedRows} rows into staging...`);
                }
                
            } catch (rowError) {
                errors++;
                logger.warn(`[Dimensional] Error inserting row ${i + 1}:`, rowError.message);
            }
        }
        
        logger.info(`[Dimensional] Staging complete: ${insertedRows} inserted, ${errors} errors`);
        
        // Update batch status
        await sqlPool.request()
            .input('batch_id', sql.Int, batchId)
            .input('processed_rows', sql.Int, insertedRows)
            .input('error_rows', sql.Int, errors)
            .query(`
                UPDATE etl_batches 
                SET status = 'staged', processed_rows = @processed_rows, error_rows = @error_rows, updated_at = GETDATE()
                WHERE batch_id = @batch_id
            `);
        
        // Execute the high-performance stored procedure
        logger.info(`[Dimensional] Executing high-performance dimensional loading...`);
        const procedureStartTime = Date.now();
        
        await sqlPool.request()
            .input('import_batch_id', sql.Int, batchId)
            .execute('sp_load_meta_excel_batch_setbased');
            
        const procedureDuration = Date.now() - procedureStartTime;
        logger.info(`[Dimensional] Dimensional loading completed in ${procedureDuration}ms`);
        
        // Update final batch status
        await sqlPool.request()
            .input('batch_id', sql.Int, batchId)
            .query(`
                UPDATE etl_batches 
                SET status = 'completed', completed_at = GETDATE(), updated_at = GETDATE()
                WHERE batch_id = @batch_id
            `);

        logger.info(`[Dimensional] ✅ Import completed successfully`);
        
        res.json({ 
            success: true, 
            message: `Successfully processed ${insertedRows} records using dimensional system`,
            batchId: batchId,
            recordsProcessed: insertedRows,
            errors: errors,
            procedureDuration: procedureDuration
        });

    } catch (error) {
        logger.error('[Dimensional] ❌ ERROR IMPORTING EXCEL:', error.message);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        fs.unlink(req.file.path, () => {});
    }
});

// --- Import Meta Excel data into SQL Server (STAR SCHEMA) ---
app.post('/api/sql/import-excel', upload.single('file'), async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ success: false, error: 'Not connected' });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    logger.info(`[Star Schema] ===== STARTING EXCEL IMPORT (STAR SCHEMA) =====`);
    logger.info(`[Star Schema] File: ${req.file.originalname}`);
    
    try {
        // Import simple functions for current DB structure
        const { 
            getOrCreateClientSimple, 
            processRowSimple, 
            createReportRecord,
            detectSpendFieldAndCurrency,
            extractCurrencyFromRow
        } = await import('./simple-excel-import.js');
        
        // Read Excel file
        logger.info(`[Star Schema] Reading Excel file...`);
        const fileBuffer = fs.readFileSync(req.file.path);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // Detect and skip title rows
        let startRow = 0;
        const firstCell = sheet['A1']?.v;
        if (typeof firstCell === 'string' && firstCell.toLowerCase().includes('raw data report')) {
            startRow = 1;
        }
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: null, range: startRow });
        logger.info(`[Star Schema] ✅ Parsed ${rows.length} rows from Excel`);

        if (rows.length === 0) {
            return res.status(400).json({ success: false, error: 'Excel file is empty' });
        }

        // Determine client and currency
        const firstRow = rows[0];
        const clientName = 
            firstRow['Nombre de la cuenta'] || 
            firstRow['nombre_de_la_cuenta'] || 
            firstRow['Account name'] || 
            'Cliente Desconocido';
        
        // Detect spend field and currency once
        const spendInfo = detectSpendFieldAndCurrency(firstRow);
        const currency = extractCurrencyFromRow(firstRow);
        
        logger.info(`[Star Schema] Client determined: "${clientName}" with currency: ${currency}`);
        logger.info(`[Star Schema] Spend field detected: "${spendInfo.field}" (${spendInfo.currency})`);
        
        // Get or create client
        const clientID = await getOrCreateClientSimple(sqlPool, clientName, currency);
        logger.info(`[Star Schema] Client ID: ${clientID}`);
        
        // Calculate file hash and periods
        const crypto = await import('crypto');
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        
        // Check if already imported
        const existingReport = await sqlPool.request()
            .input('hash_archivo', sql.Char(64), fileHash)
            .query('SELECT id_reporte FROM archivos_reporte WHERE hash_archivo = @hash_archivo');
            
        if (existingReport.recordset.length > 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Este archivo ya fue importado anteriormente' 
            });
        }
        
        // Calculate date range
        const uniqueDays = new Set();
        rows.forEach(row => {
            const dayValue = row['Día'] || row['dia'] || row['Day'];
            if (dayValue) uniqueDays.add(dayValue);
        });
        
        const dates = Array.from(uniqueDays).map(d => new Date(d)).filter(d => !isNaN(d.getTime()));
        const periodStart = dates.length > 0 ? new Date(Math.min(...dates)).toISOString().split('T')[0] : null;
        const periodEnd = dates.length > 0 ? new Date(Math.max(...dates)).toISOString().split('T')[0] : null;
        
        // Create report record
        const reportId = await createReportRecord(
            sqlPool, clientID, req.file.originalname, fileHash, 
            periodStart, periodEnd, uniqueDays.size
        );
        logger.info(`[Star Schema] Report ID: ${reportId}`);

        // Process rows
        let processed = 0;
        let errors = 0;
        let skipped = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            
            // Skip rows without essential data
            const hasDay = row['Día'] || row['dia'] || row['Day'];
            const hasCampaign = row['Nombre de la campaña'] || row['nombre_de_la_campana'] || row['Campaign name'];
            const hasAdName = row['Nombre del anuncio'] || row['nombre_del_anuncio'] || row['Ad name'];
            
            if (!hasDay || !hasCampaign || !hasAdName) {
                skipped++;
                continue;
            }
            
            try {
                const result = await processRowSimple(sqlPool, row, clientID, reportId, spendInfo);
                if (result.success) {
                    processed++;
                    if (processed % 100 === 0) {
                        logger.info(`[Star Schema] Processed ${processed} rows...`);
                    }
                } else {
                    skipped++;
                }
            } catch (rowError) {
                errors++;
                logger.warn(`[Star Schema] Error processing row ${i + 1}:`, rowError.message);
            }
        }

        // Save import history
        const historyData = {
            fileName: req.file.originalname,
            recordsProcessed: processed,
            errorsCount: errors,
            skippedCount: skipped,
            clientName: clientName,
            timestamp: new Date().toISOString(),
            description: `Star Schema Import: ${processed} processed, ${errors} errors, ${skipped} skipped`
        };
        
        await sqlPool.request()
            .input('source', sql.VarChar(50), 'meta-excel')
            .input('batch_data', sql.VarChar(sql.MAX), JSON.stringify(historyData))
            .query(`
                INSERT INTO import_history (source, batch_data) 
                VALUES (@source, @batch_data)
            `);

        logger.info(`[Star Schema] ✅ Import completed: ${processed} processed, ${errors} errors, ${skipped} skipped`);
        
        res.json({ 
            success: true, 
            processed, 
            errors, 
            skipped,
            clientName,
            message: `Successfully imported ${processed} records for ${clientName}`
        });

    } catch (error) {
        logger.error('[Star Schema] ❌ ERROR IMPORTING EXCEL:', error.message);
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
    const result = await sqlPool.request().query('SELECT id, source, batch_data, created_at FROM import_history ORDER BY created_at DESC');
    const history = result.recordset.map(r => {
        try {
            const data = JSON.parse(r.batch_data || '{}');
            return {
                id: r.id,
                source: r.source,
                fileName: data.fileName || 'Unknown',
                recordsProcessed: data.recordsProcessed || 0,
                timestamp: r.created_at,
                description: data.description || 'Legacy import'
            };
        } catch (parseError) {
            return {
                id: r.id,
                source: r.source,
                fileName: 'Parse Error',
                recordsProcessed: 0,
                timestamp: r.created_at,
                description: 'Could not parse batch_data'
            };
        }
    });
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
    logger.info('[SQL][EnsureSchema] Starting schema creation...');
    
    try {
        const result = await ensureCompleteSchema(sqlPool, logger);
        
        logger.info('[SQL][EnsureSchema] ✅ Schema setup completed:', result);
        res.json({ 
            ok: result.success, 
            actions: result.actions || [], 
            db: sqlPool.config.database, 
            schema: 'dbo',
            tablesCreated: result.tablesCreated || 0,
            message: result.message || 'Schema creation completed'
        });
    } catch (error) {
        logger.error('[SQL][EnsureSchema] Error:', error.message);
        res.status(500).json({ 
            ok: false, 
            error: error.message,
            db: sqlPool.config.database, 
            schema: 'dbo'
        });
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

        if (!Array.isArray(records)) {
            logger.warn(`[Server] Invalid performance records payload for client ${clientId}`);
            return res.status(400).json({
                success: false,
                error: 'Invalid records payload: expected an array of records'
            });
        }

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
app.get('/api/performance', async (req, res) => {
    try {
        // Priorizar SQL Server si está conectado
        if (sqlPool) {
            logger.info('[Server] Loading performance data from SQL Server');
            
            const result = await sqlPool.request().query(`
                SELECT 
                    c.client_id,
                    c.name as client_name,
                    ar.nombre_archivo,
                    ar.period_start,
                    ar.period_end,
                    ar.uploaded_at,
                    COUNT(m.id_metricas) as total_records,
                    SUM(CAST(m.importe_gastado_EUR as DECIMAL(18,2))) as total_spend,
                    SUM(CAST(m.compras as INT)) as total_purchases,
                    SUM(CAST(m.impresiones as BIGINT)) as total_impressions,
                    COUNT(DISTINCT m.nombre_del_anuncio) as unique_ads
                FROM clients c
                LEFT JOIN archivos_reporte ar ON c.client_id = ar.client_id
                LEFT JOIN metricas m ON ar.id_reporte = m.id_reporte
                GROUP BY c.client_id, c.name, ar.nombre_archivo, ar.period_start, ar.period_end, ar.uploaded_at
                ORDER BY ar.uploaded_at DESC
            `);
            
            const performanceData = {};
            
            result.recordset.forEach(row => {
                if (!performanceData[row.client_id]) {
                    performanceData[row.client_id] = {
                        clientName: row.client_name,
                        currency: "EUR",
                        reports: []
                    };
                }
                
                if (row.nombre_archivo) {
                    performanceData[row.client_id].reports.push({
                        fileName: row.nombre_archivo,
                        periodStart: row.period_start,
                        periodEnd: row.period_end,
                        uploadedAt: row.uploaded_at,
                        totalRecords: row.total_records || 0,
                        totalSpend: row.total_spend || 0,
                        totalPurchases: row.total_purchases || 0,
                        totalImpressions: row.total_impressions || 0,
                        uniqueAds: row.unique_ads || 0
                    });
                }
            });
            
            logger.info(`[Server] ✅ Retrieved SQL performance data for ${Object.keys(performanceData).length} clients`);
            
            res.json({ 
                success: true, 
                data: performanceData,
                clientCount: Object.keys(performanceData).length,
                source: 'SQL Server'
            });
            
        } else {
            // Fallback a SQLite si SQL Server no está disponible
            logger.info('[Server] SQL Server not available, using SQLite fallback');
            
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
            
            logger.info(`[Server] ✅ Retrieved SQLite performance data for ${Object.keys(performanceData).length} clients`);
            
            res.json({ 
                success: true, 
                data: performanceData,
                clientCount: Object.keys(performanceData).length,
                totalRecords: rows.length,
                source: 'SQLite'
            });
        }
        
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

// --- Check if dimensional stored procedure exists ---
app.get('/api/sql/check-dimensional-procedure', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ success: false, error: 'Not connected to SQL Server' });
    }
    
    try {
        const result = await sqlPool.request().query(`
            SELECT COUNT(*) as count
            FROM sys.objects 
            WHERE type = 'P' AND name = 'sp_load_meta_excel_batch_setbased'
        `);
        
        const exists = result.recordset[0].count > 0;
        
        res.json({
            success: true,
            procedureExists: exists,
            procedureName: 'sp_load_meta_excel_batch_setbased'
        });
        
    } catch (error) {
        logger.error('[Dimensional] Error checking stored procedure:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- Create dimensional stored procedure ---
app.post('/api/sql/create-dimensional-procedure', async (req, res) => {
    if (!sqlPool) {
        return res.status(400).json({ success: false, error: 'Not connected to SQL Server' });
    }
    
    try {
        // Read the stored procedure file
        const procedureSQL = fs.readFileSync('./database/sp_load_meta_excel_batch_setbased.sql', 'utf8');
        
        logger.info('[Dimensional] Creating high-performance stored procedure...');
        
        // Execute the stored procedure creation
        await sqlPool.request().query(procedureSQL);
        
        logger.info('[Dimensional] ✅ Stored procedure created successfully');
        
        res.json({
            success: true,
            message: 'High-performance dimensional stored procedure created successfully',
            procedureName: 'sp_load_meta_excel_batch_setbased'
        });
        
    } catch (error) {
        logger.error('[Dimensional] Error creating stored procedure:', error.message);
        res.status(500).json({ success: false, error: error.message });
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
