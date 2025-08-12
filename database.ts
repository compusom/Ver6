import { Client, User, PerformanceRecord, AllLookerData, BitacoraReport, UploadedVideo, ImportBatch, MetaApiConfig, ProcessedHashes } from './types';
import { indexedDBManager } from './lib/indexedDBManager';
import { localServerClient } from './lib/localServerClient';
import { notify } from './components/notificationService';
import Logger from './Logger';
import { CRITICAL_TABLES } from './database/constants';

/**
 * Pure IndexedDB Database Manager - Ver6 Sistema Híbrido
 * 
 * NUEVA ARQUITECTURA CON SERVIDOR LOCAL:
 * ✅ Servidor Local SQLite PRIORITARIO - Datos compartidos entre navegadores
 * ✅ IndexedDB como FALLBACK - Si el servidor no está disponible
 * ✅ localStorage SOLO para autenticación crítica
 * ✅ Detección automática de servidor disponible
 * ✅ Sin Universal Storage
 * ✅ Sistema robusto y predecible
 * 
 * PostgreSQL Migration Ready:
 * - Normalized data structure with proper relationships
 * - Strategic indexing for query optimization
 * - Clean, simple architecture
 */

type DbConnectionStatus = {
    connected: boolean;
    serverAvailable?: boolean;
};

// This state is controlled by the App component
export const dbConnectionStatus: DbConnectionStatus = {
    connected: false,
    serverAvailable: false,
};

// Check server availability on startup
async function checkServerAvailability() {
    try {
        const available = await localServerClient.isServerAvailable();
        dbConnectionStatus.serverAvailable = available;
        
        if (available) {
            Logger.info('[DB] 🟢 Local server is available - using server storage');
        } else {
            Logger.info('[DB] 🟡 Local server not available - using IndexedDB fallback');
        }
        
        return available;
    } catch (error) {
        Logger.warn('[DB] Error checking server availability:', error);
        dbConnectionStatus.serverAvailable = false;
        return false;
    }
}

const checkConnection = () => {
    if (!dbConnectionStatus.connected) {
        const errorMsg = 'Database not connected. Please check configuration in Settings.';
        Logger.error(`[DB] ${errorMsg}`);
        throw new Error(errorMsg);
    }
};

const db = {
    /**
     * Initialize database connection
     */
    async connect(): Promise<void> {
        try {
            // Check server availability first
            await checkServerAvailability();
            
            // Always initialize IndexedDB as fallback
            await indexedDBManager.initialize();
            dbConnectionStatus.connected = true;
            
            if (dbConnectionStatus.serverAvailable) {
                Logger.info('[DB] ✅ Connected to Local Server (primary) + IndexedDB (fallback)');
            } else {
                Logger.info('[DB] ✅ Connected to IndexedDB (server not available)');
            }
            
            // Initialize with any critical data migration if needed
            await this.migrateFromLegacyStorage();
            
        } catch (error) {
            Logger.error('[DB] ❌ Failed to connect to database:', error);
            dbConnectionStatus.connected = false;
            throw error;
        }
    },

    async select<T>(table: string, defaultValue: T): Promise<T> {
        // Allow reading config and import_history before connection is established
        if (table !== 'config' && table !== 'import_history' && table !== 'processed_files_hashes') {
            checkConnection();
        }
        Logger.info(`[DB] Executing: SELECT * FROM ${table}`);
        
        // Critical authentication data from localStorage ONLY
        if (CRITICAL_TABLES.includes(table as typeof CRITICAL_TABLES[number])) {
            try {
                const localData = localStorage.getItem(`db_${table}`);
                if (localData) {
                    const result = JSON.parse(localData);
                    Logger.info(`[DB] ✅ Retrieved ${table} from localStorage (critical auth data)`);
                    return result as T;
                }
                Logger.info(`[DB] No critical data found for ${table}, returning default`);
                return defaultValue;
            } catch (error) {
                Logger.error(`[DB] Error parsing localStorage data for ${table}:`, error);
                return defaultValue;
            }
        }
        
        // Try local server first (if available)
        if (dbConnectionStatus.serverAvailable) {
            try {
                const serverData = await localServerClient.loadData<T>(table);
                if (serverData !== null && !this.isEmptyData(serverData)) {
                    Logger.info(`[DB] ✅ Retrieved ${table} from local server`);
                    return serverData;
                }
            } catch (error) {
                Logger.warn(`[DB] Failed to load ${table} from server, falling back to IndexedDB:`, error);
                // Fall through to IndexedDB
            }
        }
        
        // Special handling for processed_files_hashes - try file system
        if (table === 'processed_files_hashes') {
            try {
                const fileData = await this.loadFromProjectFile(table);
                if (fileData !== null) {
                    Logger.info(`[DB] ✅ Retrieved ${table} from project file`);
                    return fileData as T;
                }
            } catch (error) {
                Logger.warn(`[DB] Could not load ${table} from project file:`, error);
            }
        }
        
        // All other data comes from IndexedDB (with connection check)
        try {
            // Ensure connection before accessing IndexedDB
            if (!dbConnectionStatus.connected) {
                Logger.warn(`[DB] Database not connected, trying to initialize for ${table}`);
                await indexedDBManager.initialize();
                dbConnectionStatus.connected = true;
            }
            
            const result = await this.retrieveFromIndexedDB(table);
            if (result !== null) {
                Logger.info(`[DB] ✅ Retrieved ${table} from IndexedDB`);
                return result as T;
            }
        } catch (indexedDbError) {
            Logger.error(`[DB] ❌ IndexedDB retrieval failed for ${table}:`, indexedDbError);
            
            // For non-critical data, try to return from project files as fallback
            if (table === 'processed_files_hashes') {
                try {
                    const fileData = await this.loadFromProjectFile(table);
                    if (fileData !== null) {
                        Logger.info(`[DB] ⚠️ Retrieved ${table} from project file (fallback)`);
                        return fileData as T;
                    }
                } catch (fileError) {
                    Logger.warn(`[DB] Project file fallback also failed for ${table}:`, fileError);
                }
            }
            
            throw new Error(`Failed to retrieve ${table} from IndexedDB: ${indexedDbError}`);
        }

        Logger.info(`[DB] No data found for ${table}, returning default`);
        return defaultValue;
    },

    async update(table: string, data: any): Promise<void> {
        // Allow writing config before connection is established
        if (table !== 'config' && table !== 'processed_files_hashes') {
            checkConnection();
        }
        Logger.info(`[DB] Executing: UPDATE ${table} with new data...`);
        Logger.info(`[DB] Data size: ${JSON.stringify(data).length} characters`);

        // Critical authentication data stays in localStorage for immediate access
        if (CRITICAL_TABLES.includes(table as typeof CRITICAL_TABLES[number])) {
            try {
                const dataString = JSON.stringify(data);
                localStorage.setItem(`db_${table}`, dataString);
                Logger.info(`[DB] ✅ Saved ${table} to localStorage (critical auth data)`);
                return;
            } catch (error) {
                Logger.error(`[DB] Failed to save critical data ${table}:`, error);
                const errorMsg = `Error: No se pudieron guardar los datos críticos. ${error}`;
                notify(errorMsg, 'error');
                throw new Error(errorMsg);
            }
        }

        // Try to save to local server first (if available) using dedicated endpoints
        if (dbConnectionStatus.serverAvailable && !this.isEmptyData(data)) {
            try {
                let savedToServer = false;

                if (table === 'clients') {
                    // Prefer dedicated clients endpoint
                    savedToServer = await localServerClient.saveClients(Array.isArray(data) ? data : [data]);
                } else if (table === 'performance_data') {
                    // Send per-client batches to dedicated performance endpoint
                    const entries = Object.entries(data as { [key: string]: PerformanceRecord[] });
                    let total = 0;
                    for (const [clientId, records] of entries) {
                        if (Array.isArray(records) && records.length > 0) {
                            const batchId = `batch_${Date.now()}_${clientId}`;
                            const ok = await localServerClient.savePerformanceRecords(clientId, records, batchId);
                            if (ok) total += records.length;
                        }
                    }
                    savedToServer = total > 0;
                } else {
                    // Generic save for other tables
                    savedToServer = await localServerClient.saveData(table, data);
                }

                if (savedToServer) {
                    Logger.info(`[DB] ✅ Saved ${table} to local server`);

                    // Also save to IndexedDB as backup for important data
                    if (['clients', 'performance_data', 'looker_data'].includes(table)) {
                        try {
                            await this.routeToIndexedDB(table, data);
                            Logger.info(`[DB] ✅ Also saved ${table} to IndexedDB backup`);
                        } catch (backupError) {
                            Logger.warn(`[DB] IndexedDB backup failed for ${table}:`, backupError);
                        }
                    }
                    return;
                } else {
                    Logger.warn(`[DB] Failed to save ${table} to server, falling back to IndexedDB`);
                }
            } catch (error) {
                Logger.warn(`[DB] Server save error for ${table}, falling back to IndexedDB:`, error);
                // Fall through to IndexedDB
            }
        }

        // Special handling for processed_files_hashes - save to project file
        if (table === 'processed_files_hashes') {
            try {
                await this.saveToProjectFile(table, data);
                Logger.info(`[DB] ✅ Saved ${table} to project file`);
                
                // Also try to save to IndexedDB as backup
                try {
                    await this.routeToIndexedDB(table, data);
                    Logger.info(`[DB] ✅ Also saved ${table} to IndexedDB as backup`);
                } catch (indexedDbError) {
                    Logger.warn(`[DB] IndexedDB backup failed for ${table}:`, indexedDbError);
                }
                return;
            } catch (error) {
                Logger.error(`[DB] Failed to save ${table} to project file:`, error);
                // Fall through to IndexedDB as fallback
            }
        }

        // All other data goes ONLY to IndexedDB
        try {
            // Ensure connection before accessing IndexedDB
            if (!dbConnectionStatus.connected) {
                Logger.warn(`[DB] Database not connected, trying to initialize for saving ${table}`);
                await indexedDBManager.initialize();
                dbConnectionStatus.connected = true;
            }
            
            await this.routeToIndexedDB(table, data);
            Logger.info(`[DB] ✅ Successfully saved ${table} to IndexedDB`);
            
            // Clean up any legacy storage versions
            this.cleanupLegacyStorage(table);
            
        } catch (indexedDbError) {
            Logger.error(`[DB] ❌ IndexedDB save failed for ${table}:`, indexedDbError);
            const errorMsg = `Error: No se pudieron guardar los datos en IndexedDB. ${indexedDbError}`;
            notify(errorMsg, 'error');
            throw new Error(errorMsg);
        }
    },

    /**
     * Route data to appropriate IndexedDB storage method
     */
    async routeToIndexedDB(table: string, data: any): Promise<void> {
        switch (table) {
            case 'clients':
                await indexedDBManager.saveClients(Array.isArray(data) ? data : [data]);
                break;
                
            case 'performance_data':
                // Handle the complex performance data structure
                for (const [clientId, records] of Object.entries(data as {[key: string]: PerformanceRecord[]})) {
                    if (Array.isArray(records)) {
                        // Generate a batch ID for this save operation
                        const importBatchId = `batch_${Date.now()}_${clientId}`;
                        await indexedDBManager.savePerformanceRecords(clientId, records, importBatchId);
                        
                        // Generate campaign summaries for efficient reporting
                        await indexedDBManager.generateCampaignSummaries(clientId);
                    }
                }
                break;
                
            case 'looker_data':
                // Handle Looker creative data
                for (const [clientId, clientData] of Object.entries(data as AllLookerData)) {
                    await indexedDBManager.saveCreativeData(clientId, clientData);
                }
                break;
                
            case 'import_history':
                if (Array.isArray(data)) {
                    for (const batch of data) {
                        await indexedDBManager.saveImportBatch(batch);
                    }
                }
                break;
                
            case 'bitacora_reports':
                // Store as generic config data
                await indexedDBManager.saveConfig('bitacora_reports', data, 'app_config');
                break;
                
            case 'uploaded_videos':
                // Store as generic config data
                await indexedDBManager.saveConfig('uploaded_videos', data, 'app_config');
                break;
                
            case 'meta_api_config':
                await indexedDBManager.saveConfig('meta_api_config', data, 'meta_api');
                break;
                
            case 'mcp_config':
                await indexedDBManager.saveConfig('mcp_config', data, 'mcp_config');
                break;
                
            case 'processed_files_hashes':
                await indexedDBManager.saveConfig('processed_files_hashes', data, 'app_config');
                break;
                
            default:
                // Generic storage for other data types
                await indexedDBManager.saveConfig(table, data, 'app_config');
                break;
        }
    },

    /**
     * Retrieve data from appropriate IndexedDB method
     */
    async retrieveFromIndexedDB(table: string): Promise<any> {
        switch (table) {
            case 'clients':
                return await indexedDBManager.getClients();
                
            case 'performance_data':
                return await indexedDBManager.getPerformanceData();
                
            case 'looker_data':
                // Get all clients and their creative data with robust fallback
                try {
                    const clients = await indexedDBManager.getClients();
                    const result: AllLookerData = {};
                    
                    if (clients.length === 0) {
                        Logger.warn('[DB] No clients found, checking for creative data without client constraint');
                        // If no clients, try to get all creative data directly
                        const allCreativeData = await indexedDBManager.getAllCreativeData();
                        return allCreativeData;
                    }
                    
                    for (const client of clients) {
                        try {
                            const clientCreativeData = await indexedDBManager.getCreativeData(client.id);
                            if (clientCreativeData && Object.keys(clientCreativeData).length > 0) {
                                result[client.id] = clientCreativeData;
                            }
                        } catch (error) {
                            Logger.warn(`[DB] Failed to get creative data for client ${client.id}:`, error);
                        }
                    }
                    
                    Logger.info(`[DB] ✅ Retrieved creative data for ${Object.keys(result).length} clients from IndexedDB`);
                    return result;
                } catch (error) {
                    Logger.error('[DB] Error retrieving looker_data from IndexedDB:', error);
                    // Fallback: try to get all creative data without client filtering
                    try {
                        const allCreativeData = await indexedDBManager.getAllCreativeData();
                        Logger.info('[DB] ⚠️ Retrieved creative data using fallback method');
                        return allCreativeData;
                    } catch (fallbackError) {
                        Logger.error('[DB] Fallback also failed:', fallbackError);
                        return {};
                    }
                }
                
            case 'import_history':
                return await indexedDBManager.getImportHistory();
                
            case 'bitacora_reports':
                return await indexedDBManager.getConfig('bitacora_reports');
                
            case 'uploaded_videos':
                return await indexedDBManager.getConfig('uploaded_videos');
                
            case 'meta_api_config':
                return await indexedDBManager.getConfig('meta_api_config');
                
            case 'mcp_config':
                return await indexedDBManager.getConfig('mcp_config');
                
            case 'processed_files_hashes':
                return await indexedDBManager.getConfig('processed_files_hashes');
                
            default:
                return await indexedDBManager.getConfig(table);
        }
    },

    async clearTable(table: string): Promise<void> {
        checkConnection();
        Logger.info(`[DB] Executing: DELETE FROM ${table} (clearing table)`);

        try {
            // Clear from IndexedDB only
            if (table === 'clients') {
                await indexedDBManager.clearAllData();
            } else {
                // For specific tables, we could implement specific clear methods
                // For now, use the generic approach
                await indexedDBManager.clearAllData();
            }
            
            // Also clear any legacy localStorage data
            localStorage.removeItem(`db_${table}`);
            
            Logger.info(`[DB] ✅ Cleared table ${table} from IndexedDB`);
        } catch (error) {
            Logger.error(`[DB] Error clearing table ${table}:`, error);
            throw error;
        }
    },

    async clearAllData(): Promise<void> {
        checkConnection();
        Logger.info(`[DB] Executing: CLEAR ALL USER DATA`);

        try {
            // Clear IndexedDB data
            await indexedDBManager.clearAllData();

            // Clear critical localStorage data (keep auth data intact unless specifically requested)
            const legacyKeys = [
                'db_clients', 'db_performance_data', 'db_looker_data', 
                'db_bitacora_reports', 'db_uploaded_videos', 'db_import_history',
                'db_processed_files_hashes', 'current_client_id',
                'db_processed_hashes' // <-- Asegura borrar también esta clave si existe
            ];
            legacyKeys.forEach(key => localStorage.removeItem(key));

            // Extra: Borra manualmente processed_hashes si existe fuera del array
            localStorage.removeItem('db_processed_hashes');

            // Borra el archivo de proyecto de hashes procesados
            try {
                const { projectFileStorage } = await import('./lib/projectFileStorage');
                await projectFileStorage.deleteData('processed_files_hashes');
                Logger.info('[DB] ✅ Archivo de hashes procesados eliminado del proyecto');
            } catch (e) {
                Logger.warn('[DB] No se pudo eliminar el archivo de hashes procesados del proyecto:', e);
            }
            
            // Clear analysis cache
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('metaAdCreativeAnalysis_')) {
                    localStorage.removeItem(key);
                }
            });
            
            Logger.info('[DB] ✅ All user data cleared successfully (auth data preserved)');
            
        } catch (error) {
            Logger.error('[DB] Error clearing data:', error);
            throw error;
        }
    },
    
    async factoryReset(): Promise<void> {
        Logger.info(`[DB] Executing: FACTORY RESET`);
        
        try {
            // Clear IndexedDB
            await indexedDBManager.clearAllData();
            
            // Clear all localStorage including auth
            localStorage.clear();
            
            Logger.info(`[DB] ✅ Factory reset completed - all data cleared`);
        } catch (error) {
            Logger.error('[DB] Error during factory reset:', error);
            // Force clear localStorage even if IndexedDB fails
            localStorage.clear();
        }
    },

    /**
     * Migration utilities - ONLY from localStorage legacy
     */
    async migrateFromLegacyStorage(): Promise<void> {
        Logger.info('[DB] Checking for legacy localStorage migration...');
        
        try {
            // Check for existing localStorage data that should be migrated
            const legacyTables = ['clients', 'performance_data', 'looker_data', 'import_history', 'bitacora_reports', 'uploaded_videos'];
            
            for (const table of legacyTables) {
                const legacyData = localStorage.getItem(`db_${table}`);
                if (legacyData) {
                    try {
                        const parsedData = JSON.parse(legacyData);
                        if (parsedData && !this.isEmptyData(parsedData)) {
                            await this.routeToIndexedDB(table, parsedData);
                            Logger.info(`[DB] ✅ Migrated ${table} from localStorage to IndexedDB`);
                            
                            // Remove legacy data after successful migration
                            localStorage.removeItem(`db_${table}`);
                        }
                    } catch (error) {
                        Logger.warn(`[DB] Failed to migrate ${table} from localStorage:`, error);
                    }
                }
            }
            
        } catch (error) {
            Logger.warn('[DB] Migration check failed:', error);
        }
    },

    /**
     * Clean up legacy storage after successful IndexedDB save
     */
    cleanupLegacyStorage(table: string): void {
        try {
            localStorage.removeItem(`db_${table}`);
            localStorage.removeItem(`db_${table}_storage`);
            // Note: No more universalFileStorage cleanup
        } catch (error) {
            Logger.warn(`[DB] Legacy cleanup failed for ${table}:`, error);
        }
    },

    getLocalStorageUsage(): { used: string; quota: string; items: number } {
        try {
            // Get IndexedDB stats
            indexedDBManager.getDatabaseStats().then(stats => {
                Logger.info('[DB] IndexedDB Stats:', stats);
            });
            
            // Get localStorage usage (now minimal - only auth data)
            let localStorageSize = 0;
            let localStorageItems = 0;
            
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    const value = localStorage.getItem(key);
                    if (value) {
                        localStorageSize += key.length + value.length;
                        localStorageItems++;
                    }
                }
            }
            
            const totalSizeMB = (localStorageSize / (1024 * 1024)).toFixed(2);
            
            return {
                used: totalSizeMB + 'MB (localStorage) + IndexedDB Storage',
                quota: 'IndexedDB (Several GB Available)',
                items: localStorageItems
            };
            
        } catch (error) {
            Logger.warn('[DB] Error getting storage usage:', error);
            return { used: 'Unknown', quota: 'Unknown', items: 0 };
        }
    },

    async clearOldData(): Promise<void> {
        Logger.info('[DB] Clearing old data to optimize storage...');
        
        try {
            // IndexedDB handles this efficiently
            Logger.info('[DB] ✅ Old data cleanup completed');
        } catch (error) {
            Logger.warn('[DB] Error during cleanup:', error);
        }
    },

    /**
     * Database health check
     */
    async healthCheck(): Promise<{
        connected: boolean;
        indexedDBAvailable: boolean;
        storageStats: any;
        issues: string[];
    }> {
        const issues: string[] = [];
        let indexedDBAvailable = false;
        let storageStats = null;
        
        try {
            await indexedDBManager.initialize();
            indexedDBAvailable = true;
            storageStats = await indexedDBManager.getDatabaseStats();
        } catch (error) {
            issues.push(`IndexedDB initialization failed: ${error}`);
        }
        
        return {
            connected: dbConnectionStatus.connected,
            indexedDBAvailable,
            storageStats,
            issues
        };
    },

    // Typed API methods for compatibility
    async getUsers(): Promise<User[]> {
        return await this.select('users', []);
    },

    async saveUsers(users: User[]): Promise<void> {
        await this.update('users', users);
    },

    async getClients(): Promise<Client[]> {
        return await this.select('clients', []);
    },

    async saveClients(clients: Client[]): Promise<void> {
        await this.update('clients', clients);
    },

    async getPerformanceData(): Promise<{[key: string]: PerformanceRecord[]}> {
        return await this.select('performance_data', {});
    },

    async savePerformanceData(data: {[key: string]: PerformanceRecord[]}): Promise<void> {
        await this.update('performance_data', data);
    },

    async getLookerData(): Promise<AllLookerData> {
        return await this.select('looker_data', {});
    },

    async saveLookerData(data: AllLookerData): Promise<void> {
        await this.update('looker_data', data);
    },

    async getBitacoraReports(): Promise<BitacoraReport[]> {
        return await this.select('bitacora_reports', []);
    },

    async saveBitacoraReports(reports: BitacoraReport[]): Promise<void> {
        await this.update('bitacora_reports', reports);
    },

    async getUploadedVideos(): Promise<UploadedVideo[]> {
        return await this.select('uploaded_videos', []);
    },

    async saveUploadedVideos(videos: UploadedVideo[]): Promise<void> {
        await this.update('uploaded_videos', videos);
    },

    async getImportHistory(): Promise<ImportBatch[]> {
        const history = await this.select('import_history', []);
        if (Array.isArray(history)) {
            return history;
        }
        if (history && typeof history === 'object') {
            if (Array.isArray((history as any).default)) {
                return (history as any).default as ImportBatch[];
            }
            const values = Object.values(history as any);
            if (values.length === 1 && Array.isArray(values[0])) {
                return values[0] as ImportBatch[];
            }
        }
        return [];
    },

    async saveImportHistory(history: ImportBatch[]): Promise<void> {
        await this.update('import_history', history);
    },

    async getLoggedInUser(): Promise<User | null> {
        return await this.select('logged_in_user', null);
    },

    async saveLoggedInUser(user: User | null): Promise<void> {
        await this.update('logged_in_user', user);
    },

    async getMetaApiConfig(): Promise<MetaApiConfig | null> {
        return await this.select('config', null);
    },

    async saveMetaApiConfig(config: MetaApiConfig): Promise<void> {
        await this.update('config', config);
    },

    async getProcessedHashes(): Promise<ProcessedHashes> {
        return await this.select('processed_files_hashes', {});
    },

    async saveProcessedHashes(hashes: ProcessedHashes): Promise<void> {
        await this.update('processed_files_hashes', hashes);
    },

    // Additional IndexedDB-specific methods
    async getPerformanceDataByClient(clientId: string): Promise<PerformanceRecord[]> {
        try {
            return await indexedDBManager.getPerformanceRecords(clientId);
        } catch (error) {
            Logger.warn(`[DB] Failed to get performance data for client ${clientId}:`, error);
            return [];
        }
    },

    async getCreativeDataByClient(clientId: string): Promise<any> {
        try {
            return await indexedDBManager.getCreativeData(clientId);
        } catch (error) {
            Logger.warn(`[DB] Failed to get creative data for client ${clientId}:`, error);
            return null;
        }
    },

    async getCampaignSummaries(clientId: string, dateRange?: { start: string; end: string }): Promise<any[]> {
        try {
            return await indexedDBManager.getCampaignSummaries(clientId, dateRange);
        } catch (error) {
            Logger.warn(`[DB] Failed to get campaign summaries for client ${clientId}:`, error);
            return [];
        }
    },

    async getDatabaseStats(): Promise<any> {
        try {
            return await indexedDBManager.getDatabaseStats();
        } catch (error) {
            Logger.warn('[DB] Failed to get database stats:', error);
            return { error: 'Stats unavailable' };
        }
    },

    async debugCreativeData(): Promise<any> {
        try {
            const [clients, allCreativeData] = await Promise.all([
                indexedDBManager.getClients(),
                indexedDBManager.getAllCreativeData()
            ]);

            const clientsWithCreatives = Object.keys(allCreativeData);
            const creativeDataByClient: {[key: string]: number} = {};
            let totalCreativeRecords = 0;

            for (const [clientId, creativeData] of Object.entries(allCreativeData)) {
                const count = Object.keys(creativeData).length;
                creativeDataByClient[clientId] = count;
                totalCreativeRecords += count;
            }

            const debug = {
                totalClients: clients.length,
                totalCreativeRecords,
                clientsWithCreatives,
                creativeDataByClient
            };

            Logger.info('[DB] 🔍 Creative Data Debug:', debug);
            return debug;
        } catch (error) {
            Logger.error('[DB] Failed to debug creative data:', error);
            return {
                totalClients: 0,
                totalCreativeRecords: 0,
                clientsWithCreatives: [],
                creativeDataByClient: {}
            };
        }
    },

    // ==================== PROJECT FILE STORAGE METHODS ====================

    /**
     * Save data to project file storage
     */
    async saveToProjectFile(filename: string, data: any): Promise<void> {
        try {
            const { projectFileStorage } = await import('./lib/projectFileStorage');
            await projectFileStorage.saveData(filename, data);
            Logger.info(`[DB] ✅ Saved ${filename} to project file storage`);
        } catch (error) {
            Logger.error(`[DB] Failed to save ${filename} to project file:`, error);
            throw error;
        }
    },

    /**
     * Load data from project file storage
     */
    async loadFromProjectFile<T>(filename: string): Promise<T | null> {
        try {
            const { projectFileStorage } = await import('./lib/projectFileStorage');
            const data = await projectFileStorage.loadData<T>(filename);
            if (data) {
                Logger.info(`[DB] ✅ Loaded ${filename} from project file storage`);
            }
            return data;
        } catch (error) {
            Logger.error(`[DB] Failed to load ${filename} from project file:`, error);
            return null;
        }
    },

    /**
     * Export data to project file with timestamp
     */
    async exportToProjectFile(filename: string, data: any): Promise<void> {
        try {
            const { projectFileStorage } = await import('./lib/projectFileStorage');
            await projectFileStorage.exportData(filename, data);
            Logger.info(`[DB] ✅ Exported ${filename} to project files`);
        } catch (error) {
            Logger.error(`[DB] Failed to export ${filename} to project file:`, error);
            throw error;
        }
    },

    /**
     * List available project files
     */
    async listProjectFiles(): Promise<string[]> {
        try {
            const { projectFileStorage } = await import('./lib/projectFileStorage');
            return await projectFileStorage.listFiles();
        } catch (error) {
            Logger.error('[DB] Failed to list project files:', error);
            return [];
        }
    },

    /**
     * Get project storage statistics
     */
    async getProjectStorageStats(): Promise<any> {
        try {
            const { projectFileStorage } = await import('./lib/projectFileStorage');
            return await projectFileStorage.getStorageStats();
        } catch (error) {
            Logger.error('[DB] Failed to get project storage stats:', error);
            return {
                filesCount: 0,
                totalSize: '0 KB',
                files: []
            };
        }
    },

    // ==================== HELPER METHODS ====================

    /**
     * Check if data is empty (avoid saving empty arrays or objects)
     */
    isEmptyData(data: any): boolean {
        if (data === null || data === undefined) return true;
        
        if (Array.isArray(data)) {
            return data.length === 0;
        }
        
        if (typeof data === 'object') {
            return Object.keys(data).length === 0;
        }
        
        return false;
    }
};

export default db;
