// =====================================================================================
// DIMENSIONAL MANAGER - INTEGRACIÓN CON SISTEMA EXISTENTE
// Administra las operaciones del Data Warehouse dimensional desde el panel de control
// Compatible con la arquitectura híbrida existente (IndexedDB + Local Server)
// =====================================================================================

import Logger from '../Logger';
import { notify } from '../components/notificationService';
import { localServerClient } from '../lib/localServerClient';
import { indexedDBManager } from '../lib/indexedDBManager';

/**
 * Estados del sistema dimensional
 */
export enum DimensionalStatus {
    NOT_INITIALIZED = 'not_initialized',
    INITIALIZING = 'initializing', 
    READY = 'ready',
    ERROR = 'error',
    MIGRATING = 'migrating'
}

/**
 * Resultado de operaciones ETL
 */
export interface ETLResult {
    batchId: number;
    status: 'completed' | 'completed_with_errors' | 'failed';
    stats: {
        recordsProcessed: number;
        recordsSuccess: number;
        recordsFailed: number;
    };
    errors: string[];
    duration?: number;
}

/**
 * Configuración del sistema dimensional
 */
export interface DimensionalConfig {
    enabled: boolean;
    version: string;
    lastMigrationAt?: string;
    migrationStatus: string;
    autoETL: boolean;
    backupOriginalData: boolean;
}

/**
 * Manager principal para el sistema dimensional
 */
export class DimensionalManager {
    private static instance: DimensionalManager;
    private status: DimensionalStatus = DimensionalStatus.NOT_INITIALIZED;
    private config: DimensionalConfig | null = null;
    private dbExecutor: ((sql: string, params?: any[]) => Promise<any>) | null = null;

    private constructor() {}

    public static getInstance(): DimensionalManager {
        if (!DimensionalManager.instance) {
            DimensionalManager.instance = new DimensionalManager();
        }
        return DimensionalManager.instance;
    }

    /**
     * Inicializa el sistema dimensional
     */
    public async initialize(forceReinit = false): Promise<void> {
        try {
            if (this.status === DimensionalStatus.READY && !forceReinit) {
                return;
            }

            this.status = DimensionalStatus.INITIALIZING;
            Logger.info('[DIM] Initializing dimensional system...');

            // Configurar executor de base de datos
            await this.setupDatabaseExecutor();

            // Verificar si las tablas dimensionales existen
            const tablesExist = await this.checkDimensionalTables();
            
            if (!tablesExist) {
                Logger.info('[DIM] Dimensional tables not found, system not initialized');
                this.status = DimensionalStatus.NOT_INITIALIZED;
                return;
            }

            // Cargar configuración
            await this.loadConfig();

            if (this.config?.enabled) {
                await this.validateSystemIntegrity();
                this.status = DimensionalStatus.READY;
                Logger.success('[DIM] Dimensional system ready');
            } else {
                this.status = DimensionalStatus.NOT_INITIALIZED;
                Logger.info('[DIM] Dimensional system disabled in configuration');
            }

        } catch (error) {
            this.status = DimensionalStatus.ERROR;
            Logger.error('[DIM] Failed to initialize dimensional system:', error);
            // Don't throw - allow system to continue without dimensional features
        }
        
        // Log final status for debugging
        Logger.info(`[DIM] Initialization complete. Status: ${this.status}, Config enabled: ${this.config?.enabled}`);
    }

    /**
     * Configura el executor de base de datos según el modo activo
     */
    private async setupDatabaseExecutor(): Promise<void> {
        const dbMode = localStorage.getItem('db_mode') || 'local';
        
        if (dbMode === 'sql') {
            // Modo SQL Server - usar localServerClient
            this.dbExecutor = async (sql: string, params: any[] = []) => {
                const backendPort = localStorage.getItem('backend_port') || '3001';
                const response = await fetch(`http://localhost:${backendPort}/api/sql/execute`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command: sql, params })
                });
                
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.error || 'SQL execution failed');
                }
                
                return result.result;
            };
        } else {
            // Modo local - usar IndexedDB con SQLite simulation
            // NOTA: Para una implementación completa, necesitarías sql.js o similar
            // Por ahora, simulamos con IndexedDB
            this.dbExecutor = async (sql: string, params: any[] = []) => {
                // Esta implementación necesitaría un layer de traducción SQL->IndexedDB
                // Para el prototipo, usar métodos directos de indexedDBManager
                throw new Error('SQLite operations in local mode require sql.js integration');
            };
        }
    }

    /**
     * Verifica si existen las tablas dimensionales
     */
    private async checkDimensionalTables(): Promise<boolean> {
        try {
            if (!this.dbExecutor) return false;

            const dbMode = localStorage.getItem('db_mode') || 'local';
            
            if (dbMode === 'sql') {
                // SQL Server syntax
                const result = await this.dbExecutor(`
                    SELECT TABLE_NAME as name 
                    FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_SCHEMA = 'dbo' 
                    AND TABLE_NAME IN ('dim_date', 'dim_account', 'fact_meta_daily')
                `);
                return Array.isArray(result) && result.length >= 3;
            } else {
                // SQLite syntax
                const result = await this.dbExecutor(`
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name IN ('dim_date', 'dim_account', 'fact_meta_daily')
                `);
                return Array.isArray(result) && result.length >= 3;
            }
        } catch (error) {
            Logger.warn('[DIM] Could not check dimensional tables:', error);
            return false;
        }
    }

    /**
     * Carga la configuración del sistema dimensional
     */
    private async loadConfig(): Promise<void> {
        try {
            if (!this.dbExecutor) return;

            // Try to load config from control table
            try {
                const result = await this.dbExecutor(
                    'SELECT * FROM dw_control ORDER BY control_id DESC LIMIT 1'
                );

                if (result && result.length > 0) {
                    const control = result[0];
                    this.config = {
                        enabled: control.dimensional_enabled === 1,
                        version: control.system_version,
                        lastMigrationAt: control.last_migration_at,
                        migrationStatus: control.migration_status,
                        autoETL: true,
                        backupOriginalData: true
                    };
                    return;
                }
            } catch (configError) {
                Logger.warn('[DIM] Could not load config from dw_control table:', configError);
            }

            // Default config if table doesn't exist or is empty
            this.config = {
                enabled: true, // Enable by default if tables exist
                version: 'v6.1.0',
                migrationStatus: 'completed',
                autoETL: true,
                backupOriginalData: true
            };
        } catch (error) {
            Logger.error('[DIM] Failed to load dimensional config:', error);
            throw error;
        }
    }

    /**
     * Valida la integridad del sistema
     */
    private async validateSystemIntegrity(): Promise<void> {
        if (!this.dbExecutor) return;

        try {
            // Verificar integridad referencial básica
            const checks = [
                'SELECT COUNT(*) as count FROM dim_date',
                'SELECT COUNT(*) as count FROM dim_currency', 
                'SELECT COUNT(*) as count FROM dim_gender',
                'SELECT COUNT(*) as count FROM dim_age'
            ];

            let validDimensions = 0;
            for (const check of checks) {
                try {
                    const result = await this.dbExecutor(check);
                    if (result && result[0]?.count >= 0) {
                        validDimensions++;
                    }
                } catch (checkError) {
                    Logger.warn(`[DIM] Could not validate dimension: ${check}`, checkError);
                }
            }

            if (validDimensions >= 2) { // More lenient - at least 2 dimensions should exist
                Logger.info('[DIM] System integrity validation passed');
            } else {
                Logger.warn('[DIM] System integrity validation incomplete - some dimensions missing');
            }
        } catch (error) {
            Logger.warn('[DIM] System integrity validation failed, but continuing:', error);
            // Don't throw - allow system to continue with partial functionality
        }
    }

    /**
     * Crea todas las tablas dimensionales
     */
    public async createDimensionalTables(): Promise<void> {
        try {
            this.status = DimensionalStatus.INITIALIZING;
            Logger.info('[DIM] Creating dimensional tables...');

            const dbMode = localStorage.getItem('db_mode') || 'local';
            
            if (dbMode === 'sql') {
                // Use server endpoint to initialize dimensional system
                const backendPort = localStorage.getItem('backend_port') || '3001';
                const response = await fetch(`http://localhost:${backendPort}/api/sql/initialize-dimensional`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.error || 'Failed to initialize dimensional system');
                }
                
                Logger.success(`[DIM] Dimensional system initialized: ${result.stats.statementsExecuted} statements executed`);
                
                // Create the stored procedure for high performance if needed
                try {
                    const procedureExists = await this.checkDimensionalProcedure();
                    if (!procedureExists) {
                        await this.createDimensionalProcedure();
                        Logger.info('[DIM] High-performance stored procedure created');
                    } else {
                        Logger.info('[DIM] High-performance stored procedure already exists');
                    }
                } catch (procedureError) {
                    Logger.warn('[DIM] Could not create stored procedure, but tables created successfully:', procedureError);
                }
                
            } else {
                // Local mode - would need SQLite implementation
                throw new Error('Dimensional system requires SQL Server mode. Local SQLite mode not yet implemented.');
            }

            this.status = DimensionalStatus.READY;
            Logger.success('[DIM] Dimensional tables created successfully');
            notify('Sistema dimensional creado exitosamente', 'success');

        } catch (error) {
            this.status = DimensionalStatus.ERROR;
            Logger.error('[DIM] Failed to create dimensional tables:', error);
            notify('Error creando sistema dimensional: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * Elimina todas las tablas dimensionales
     */
    public async dropDimensionalTables(): Promise<void> {
        try {
            Logger.info('[DIM] Dropping dimensional tables...');

            const dbMode = localStorage.getItem('db_mode') || 'local';
            
            if (dbMode === 'sql') {
                // Use server endpoint to drop dimensional system
                const backendPort = localStorage.getItem('backend_port') || '3001';
                const response = await fetch(`http://localhost:${backendPort}/api/sql/drop-dimensional`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.error || 'Failed to drop dimensional system');
                }
                
                Logger.success(`[DIM] Dimensional system dropped: ${result.stats.tablesDropped} tables removed`);
                
            } else {
                // Local mode - would need SQLite implementation
                throw new Error('Dimensional system requires SQL Server mode. Local SQLite mode not yet implemented.');
            }

            this.status = DimensionalStatus.NOT_INITIALIZED;
            this.config = null;

            Logger.success('[DIM] Dimensional tables dropped successfully');
            notify('Sistema dimensional eliminado exitosamente', 'success');

        } catch (error) {
            Logger.error('[DIM] Failed to drop dimensional tables:', error);
            notify('Error eliminando sistema dimensional: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * Obtiene estadísticas del sistema dimensional
     */
    public async getSystemStats(): Promise<any> {
        if (this.status !== DimensionalStatus.READY) {
            return null;
        }

        try {
            const dbMode = localStorage.getItem('db_mode') || 'local';
            
            if (dbMode === 'sql') {
                // Use server endpoint to get dimensional status
                const backendPort = localStorage.getItem('backend_port') || '3001';
                const response = await fetch(`http://localhost:${backendPort}/api/sql/dimensional-status`);
                
                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.error || 'Failed to get system stats');
                }
                
                return {
                    accounts: result.stats?.dim_account || 0,
                    campaigns: result.stats?.dim_campaign || 0,
                    adsets: result.stats?.dim_adset || 0,
                    ads: result.stats?.dim_ad || 0,
                    factRecords: result.stats?.fact_meta_daily || 0,
                    completedBatches: result.stats?.etl_batches || 0,
                    dateRange: result.stats?.dateRange || {},
                    status: this.status,
                    config: this.config
                };
                
            } else {
                // Local mode - return basic info
                return {
                    accounts: 0,
                    campaigns: 0,
                    adsets: 0,
                    ads: 0,
                    factRecords: 0,
                    completedBatches: 0,
                    status: this.status,
                    config: this.config
                };
            }
        } catch (error) {
            Logger.error('[DIM] Failed to get system stats:', error);
            return null;
        }
    }

    /**
     * Procesa archivo Excel usando el sistema dimensional de alta performance
     */
    public async processExcelFile(file: File): Promise<ETLResult> {
        if (this.status !== DimensionalStatus.READY) {
            throw new Error('Dimensional system not ready');
        }

        try {
            Logger.info(`[DIM] Starting high-performance ETL process for ${file.name}`);
            
            const startTime = Date.now();
            
            // Crear FormData para el archivo
            const formData = new FormData();
            formData.append('file', file);
            
            // Subir archivo y ejecutar ETL dimensional
            const backendPort = localStorage.getItem('backend_port') || '3001';
            const response = await fetch(`http://localhost:${backendPort}/api/sql/import-excel-dimensional`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'ETL process failed');
            }
            
            const duration = Date.now() - startTime;
            
            const etlResult: ETLResult = {
                batchId: result.batchId,
                status: result.errors > 0 ? 'completed_with_errors' : 'completed',
                stats: {
                    recordsProcessed: result.recordsProcessed || 0,
                    recordsSuccess: result.recordsProcessed - (result.errors || 0),
                    recordsFailed: result.errors || 0
                },
                errors: result.errors > 0 ? [`${result.errors} records failed to process`] : [],
                duration: duration
            };
            
            Logger.success(`[DIM] High-performance ETL completed in ${duration}ms`);
            notify(`ETL completado: ${etlResult.stats.recordsSuccess} registros procesados usando sistema dimensional`, 
                   etlResult.stats.recordsFailed > 0 ? 'warning' : 'success');
            
            return etlResult;

        } catch (error) {
            Logger.error('[DIM] High-performance ETL process failed:', error);
            notify('Error en proceso ETL dimensional: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * Verifica si el stored procedure dimensional existe
     */
    public async checkDimensionalProcedure(): Promise<boolean> {
        try {
            const backendPort = localStorage.getItem('backend_port') || '3001';
            const response = await fetch(`http://localhost:${backendPort}/api/sql/check-dimensional-procedure`);
            const result = await response.json();
            
            return result.success && result.procedureExists;
        } catch (error) {
            Logger.error('[DIM] Error checking dimensional procedure:', error);
            return false;
        }
    }

    /**
     * Crea el stored procedure dimensional
     */
    public async createDimensionalProcedure(): Promise<void> {
        try {
            Logger.info('[DIM] Creating high-performance dimensional stored procedure...');
            
            const backendPort = localStorage.getItem('backend_port') || '3001';
            const response = await fetch(`http://localhost:${backendPort}/api/sql/create-dimensional-procedure`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to create stored procedure');
            }
            
            Logger.success('[DIM] High-performance stored procedure created successfully');
            notify('Stored procedure dimensional creado exitosamente', 'success');
            
        } catch (error) {
            Logger.error('[DIM] Error creating dimensional procedure:', error);
            notify('Error creando stored procedure: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * Obtiene datos analíticos para PerformanceView
     */
    public async getPerformanceData(filters: any = {}): Promise<any> {
        if (this.status !== DimensionalStatus.READY) {
            return null;
        }

        try {
            const dbMode = localStorage.getItem('db_mode') || 'local';
            
            if (dbMode === 'sql') {
                // Use server endpoint to get performance data
                const backendPort = localStorage.getItem('backend_port') || '3001';
                const response = await fetch(`http://localhost:${backendPort}/api/sql/dimensional-performance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filters })
                });
                
                const result = await response.json();
                
                if (!result.success) {
                    throw new Error(result.error || 'Failed to get performance data');
                }
                
                Logger.info(`[DIM] Retrieved ${result.data?.length || 0} performance records`);
                return result.data || [];
                
            } else {
                // Local mode - would need SQLite implementation
                Logger.warn('[DIM] Performance data retrieval not available in local mode');
                return null;
            }

        } catch (error) {
            Logger.error('[DIM] Failed to get performance data:', error);
            return null;
        }
    }

    /**
     * Migra datos existentes al sistema dimensional
     */
    public async migrateExistingData(): Promise<void> {
        if (this.status !== DimensionalStatus.READY) {
            throw new Error('Dimensional system not ready');
        }

        try {
            this.status = DimensionalStatus.MIGRATING;
            Logger.info('[DIM] Starting migration of existing data...');

            // Obtener datos existentes del sistema
            const existingPerformanceData = await this.getExistingPerformanceData();
            
            if (existingPerformanceData && existingPerformanceData.length > 0) {
                // Crear un archivo temporal con los datos existentes para procesarlo
                const csvContent = this.convertToCSV(existingPerformanceData);
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const file = new File([blob], 'Migration_from_existing_system.csv', { type: 'text/csv' });
                
                const result = await this.processExcelFile(file);
                
                Logger.success(`[DIM] Migration completed: ${result.stats.recordsSuccess} records`);
                notify(`Migración completada: ${result.stats.recordsSuccess} registros`, 'success');
            } else {
                Logger.info('[DIM] No existing data found to migrate');
                notify('No se encontraron datos existentes para migrar', 'info');
            }

            this.status = DimensionalStatus.READY;

        } catch (error) {
            this.status = DimensionalStatus.ERROR;
            Logger.error('[DIM] Migration failed:', error);
            notify('Error en migración: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * Convierte datos a formato CSV para migración
     */
    private convertToCSV(data: any[]): string {
        if (data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];
        
        for (const row of data) {
            const values = headers.map(header => {
                const value = row[header];
                return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
            });
            csvRows.push(values.join(','));
        }
        
        return csvRows.join('\n');
    }

    /**
     * Obtiene datos existentes del sistema para migración
     */
    private async getExistingPerformanceData(): Promise<any[]> {
        try {
            // Intentar obtener datos del sistema existente
            const performanceData = await indexedDBManager.getPerformanceData();
            
            if (!performanceData || Object.keys(performanceData).length === 0) {
                return [];
            }

            // Convertir formato existente a formato Excel esperado
            const convertedData: any[] = [];
            
            for (const [clientId, records] of Object.entries(performanceData)) {
                if (Array.isArray(records)) {
                    for (const record of records) {
                        convertedData.push({
                            'Nombre de la cuenta': record.accountName || clientId,
                            'Nombre de la campaña': record.campaignName || 'Unknown',
                            'Nombre del conjunto de anuncios': record.adSetName || 'Unknown',
                            'Nombre del anuncio': record.adName || 'Unknown',
                            'Día': record.day || record.date,
                            'Edad': record.age || 'Desconocido',
                            'Sexo': record.gender || 'DESCONOCIDO',
                            'Divisa': record.currency || 'EUR',
                            'Importe gastado (EUR)': record.spend || 0,
                            'Impresiones': record.impressions || 0,
                            'Alcance': record.reach || 0,
                            'Frecuencia': record.frequency || 0,
                            'Clics (todos)': record.clicksAll || 0,
                            'Clics en el enlace': record.linkClicks || 0,
                            'Visitas a la página de destino': record.landingPageViews || 0,
                            'Compras': record.purchases || 0,
                            'Valor de conversión de compras': record.purchaseValue || 0,
                            'Entrega de la campaña': record.campaignDelivery || 'ACTIVE',
                            'Entrega del conjunto de anuncios': record.adSetDelivery || 'ACTIVE',
                            'Entrega del anuncio': record.adDelivery || 'ACTIVE'
                        });
                    }
                }
            }

            return convertedData;

        } catch (error) {
            Logger.error('[DIM] Failed to get existing performance data:', error);
            return [];
        }
    }

    /**
     * Actualiza la configuración del sistema
     */
    private async updateConfig(updates: Partial<DimensionalConfig>): Promise<void> {
        if (!this.dbExecutor) return;

        try {
            await this.dbExecutor(`
                UPDATE dw_control 
                SET dimensional_enabled = ?,
                    migration_status = ?,
                    last_migration_at = datetime('now')
                WHERE control_id = (SELECT MAX(control_id) FROM dw_control)
            `, [
                updates.enabled ? 1 : 0,
                updates.migrationStatus || 'completed'
            ]);

            // Actualizar configuración local
            if (this.config) {
                Object.assign(this.config, updates);
            }

        } catch (error) {
            Logger.error('[DIM] Failed to update config:', error);
        }
    }

    /**
     * Verifica si el sistema dimensional está listo
     */
    public isReady(): boolean {
        return this.status === DimensionalStatus.READY;
    }

    /**
     * Obtiene el estado actual del sistema
     */
    public getStatus(): DimensionalStatus {
        return this.status;
    }

    /**
     * Obtiene la configuración actual
     */
    public getConfig(): DimensionalConfig | null {
        return this.config;
    }

    /**
     * Verifica el estado del sistema dimensional desde el servidor
     */
    public async checkServerStatus(): Promise<void> {
        try {
            const dbMode = localStorage.getItem('db_mode') || 'local';
            
            if (dbMode === 'sql') {
                const backendPort = localStorage.getItem('backend_port') || '3001';
                const response = await fetch(`http://localhost:${backendPort}/api/sql/dimensional-status`);
                
                const result = await response.json();
                
                if (result.success) {
                    if (result.status === 'ready') {
                        this.status = DimensionalStatus.READY;
                        this.config = result.config ? {
                            enabled: result.config.dimensional_enabled === 1,
                            version: result.config.system_version,
                            lastMigrationAt: result.config.last_migration_at,
                            migrationStatus: result.config.migration_status,
                            autoETL: true,
                            backupOriginalData: true
                        } : null;
                    } else if (result.status === 'not_initialized') {
                        this.status = DimensionalStatus.NOT_INITIALIZED;
                        this.config = null;
                    } else {
                        this.status = DimensionalStatus.ERROR;
                    }
                    
                    Logger.info(`[DIM] Server status check: ${result.status}, Tables exist: ${result.tablesExist}`);
                } else {
                    throw new Error(result.error || 'Failed to check server status');
                }
            } else {
                this.status = DimensionalStatus.NOT_INITIALIZED;
                Logger.info('[DIM] Local mode - dimensional system not available');
            }
            
        } catch (error) {
            Logger.warn('[DIM] Could not check server status:', error);
            this.status = DimensionalStatus.ERROR;
        }
    }

    /**
     * Integración automática - llama a este método al arrancar la aplicación
     */
    public async initializeFromServer(): Promise<void> {
        try {
            await this.setupDatabaseExecutor();
            await this.checkServerStatus();
            
            if (this.status === DimensionalStatus.READY) {
                Logger.success('[DIM] Dimensional system is ready');
            } else if (this.status === DimensionalStatus.NOT_INITIALIZED) {
                Logger.info('[DIM] Dimensional system not initialized - tables need to be created');
            }
            
        } catch (error) {
            Logger.error('[DIM] Failed to initialize from server:', error);
            this.status = DimensionalStatus.ERROR;
        }
    }
}

// Instancia singleton
export const dimensionalManager = DimensionalManager.getInstance();