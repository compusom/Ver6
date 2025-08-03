import { Client, User, PerformanceRecord, AllLookerData, BitacoraReport, UploadedVideo, ImportBatch, MetaApiConfig, ProcessedHashes } from './types';
import { universalFileStorage } from './lib/universalFileStorage';

// Production-ready database client.
// Uses localStorage for small files and automatic downloads for large files.

type DbConnectionStatus = {
    connected: boolean;
};

// This state is controlled by the App component
export const dbConnectionStatus: DbConnectionStatus = {
    connected: false,
};

const checkConnection = () => {
    if (!dbConnectionStatus.connected) {
        const errorMsg = 'Database not connected. Please check configuration in Settings.';
        console.error(`[DB] ${errorMsg}`);
        throw new Error(errorMsg);
    }
};

const db = {
    async select<T>(table: string, defaultValue: T): Promise<T> {
        // Allow reading config and import_history before connection is established
        if (table !== 'config' && table !== 'import_history' && table !== 'processed_files_hashes') {
            checkConnection();
        }
        console.log(`[DB] Executing: SELECT * FROM ${table}`);
        
        // For small critical data (users, logged_in_user), always use localStorage directly
        const criticalTables = ['users', 'logged_in_user', 'config'];
        if (criticalTables.includes(table)) {
            try {
                const localData = localStorage.getItem(`db_${table}`);
                if (localData) {
                    const result = JSON.parse(localData);
                    console.log(`[DB] Retrieved ${table} from localStorage (critical data)`);
                    return result as T;
                }
                console.log(`[DB] No data found for ${table} in localStorage, returning default`);
                return defaultValue;
            } catch (error) {
                console.error(`[DB] Error parsing localStorage data for ${table}:`, error);
                return defaultValue;
            }
        }
        
        try {
            // Try universal file storage first
            const fileData = await universalFileStorage.loadData(table);
            if (fileData !== null) {
                console.log(`[DB] Retrieved ${table} from universal storage`);
                return fileData as T;
            }

            // Fallback to localStorage for backward compatibility
            const localData = localStorage.getItem(`db_${table}`);
            if (localData) {
                const result = JSON.parse(localData);
                console.log(`[DB] Retrieved ${table} from localStorage (legacy)`);
                return result as T;
            }

            console.log(`[DB] No data found for ${table}, returning default`);
            return defaultValue;
        } catch (error) {
            console.error(`[DB] Error loading ${table}:`, error);
            return defaultValue;
        }
    },

    async update(table: string, data: any): Promise<void> {
        // Allow writing config before connection is established
        if (table !== 'config') {
            checkConnection();
        }
        console.log(`[DB] Executing: UPDATE ${table} with new data...`);

        // For small critical data (users, logged_in_user, config), always use localStorage directly
        const criticalTables = ['users', 'logged_in_user', 'config'];
        if (criticalTables.includes(table)) {
            try {
                const dataString = JSON.stringify(data);
                localStorage.setItem(`db_${table}`, dataString);
                console.log(`[DB] Successfully saved ${table} to localStorage (critical data)`);
                return;
            } catch (error) {
                console.error(`[DB] Failed to save critical data ${table}:`, error);
                const errorMsg = `Error: No se pudieron guardar los datos críticos. ${error}`;
                alert(errorMsg);
                throw new Error(errorMsg);
            }
        }

        try {
            // Use universal storage for large data
            await universalFileStorage.saveData(table, data);
            console.log(`[DB] Successfully saved ${table} using universal storage`);
            
            // Clean up any old localStorage version
            localStorage.removeItem(`db_${table}`);
            localStorage.removeItem(`db_${table}_storage`);
            
        } catch (error) {
            console.error(`[DB] Failed to save ${table}:`, error);
            
            // Last resort: try regular localStorage
            try {
                const dataString = JSON.stringify(data);
                localStorage.setItem(`db_${table}`, dataString);
                console.log(`[DB] Saved ${table} to localStorage as fallback`);
            } catch (localStorageError) {
                const errorMsg = `Error: No se pudieron guardar los datos. El archivo es demasiado grande. Intenta con un archivo más pequeño. ${error}`;
                alert(errorMsg);
                throw new Error(errorMsg);
            }
        }
    },

    async clearTable(table: string): Promise<void> {
        checkConnection();
        console.log(`[DB] Executing: DELETE FROM ${table} (clearing table)`);

        try {
            // Clear from universal storage
            universalFileStorage.deleteData(table);
            
            // Also clear any legacy localStorage data
            localStorage.removeItem(`db_${table}`);
            localStorage.removeItem(`db_${table}_storage`);
            
            console.log(`[DB] Cleared table ${table} from all storage systems`);
        } catch (error) {
            console.error(`[DB] Error clearing table ${table}:`, error);
            throw error;
        }
    },

    async clearAllData(): Promise<void> {
        checkConnection();
        console.log(`[DB] Executing: CLEAR ALL USER DATA`);

        // Clear universal storage
        universalFileStorage.clearAll();

        // Clear localStorage data
        const keysToClear = [
            'db_clients',
            'db_users',
            'db_performance_data',
            'db_looker_data',
            'db_bitacora_reports',
            'db_uploaded_videos',
            'db_import_history',
            'db_processed_files_hashes',
            'current_client_id',
            'logged_in_user'
        ];
        
        keysToClear.forEach(key => localStorage.removeItem(key));
        
        // Clear all analysis cache keys
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('metaAdCreativeAnalysis_')) {
                localStorage.removeItem(key);
            }
        });

        // Clear storage type markers
        Object.keys(localStorage).forEach(key => {
            if (key.endsWith('_storage')) {
                localStorage.removeItem(key);
            }
        });

        console.log(`[DB] All user data cleared from compression storage and localStorage`);
    },
    
    async factoryReset(): Promise<void> {
        // No connection check needed for a full reset
        console.log(`[DB] Executing: FACTORY RESET`);
        
        // Clear universal storage
        universalFileStorage.clearAll();
        
        // Clear all localStorage
        localStorage.clear();
        
        console.log(`[DB] Factory reset completed - all data cleared`);
    },

    getLocalStorageUsage(): { used: string; quota: string; items: number } {
        // Get universal storage info
        const usInfo = universalFileStorage.getStorageInfo();
        
        // Get traditional localStorage info
        let localStorageSize = 0;
        let localStorageItems = 0;
        
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key) && !key.startsWith('us_')) {
                const value = localStorage.getItem(key);
                if (value) {
                    localStorageSize += key.length + value.length;
                    localStorageItems++;
                }
            }
        }
        
        const totalSizeMB = ((usInfo.totalLocalStorageSize + localStorageSize) / (1024 * 1024)).toFixed(2);
        const totalItems = usInfo.keys.length + localStorageItems;
        
        console.log(`[DB] Storage usage: ${totalSizeMB}MB (${usInfo.keys.length} items: ${usInfo.downloadedFiles.length} downloaded files, ${usInfo.keys.length - usInfo.downloadedFiles.length} in localStorage, ${localStorageItems} legacy)`);
        
        return {
            used: totalSizeMB,
            quota: '∞',
            items: totalItems
        };
    },

    async clearOldData(): Promise<void> {
        console.log('[DB] Clearing old data to free space...');
        
        // Clean up traditional localStorage data
        const importHistoryRaw = localStorage.getItem('db_import_history');
        if (importHistoryRaw) {
            try {
                const importHistory = JSON.parse(importHistoryRaw) as ImportBatch[];
                if (Array.isArray(importHistory) && importHistory.length > 10) {
                    const recentImports = importHistory.slice(-10);
                    localStorage.setItem('db_import_history', JSON.stringify(recentImports));
                    console.log(`[DB] Reduced import history from ${importHistory.length} to ${recentImports.length} items`);
                }
            } catch (e) {
                console.warn('[DB] Error cleaning import history:', e);
            }
        }
        
        // Clean up hashes
        const hashesRaw = localStorage.getItem('db_processed_files_hashes');
        if (hashesRaw) {
            try {
                const processedHashes = JSON.parse(hashesRaw) as {[key: string]: string[]};
                const cleanedHashes: {[key: string]: string[]} = {};
                for (const [clientId, hashes] of Object.entries(processedHashes)) {
                    if (Array.isArray(hashes) && hashes.length > 20) {
                        cleanedHashes[clientId] = hashes.slice(-20);
                    } else if (Array.isArray(hashes)) {
                        cleanedHashes[clientId] = hashes;
                    } else {
                        cleanedHashes[clientId] = [];
                    }
                }
                localStorage.setItem('db_processed_files_hashes', JSON.stringify(cleanedHashes));
                console.log('[DB] Cleaned old file hashes');
            } catch (e) {
                console.warn('[DB] Error cleaning file hashes:', e);
            }
        }

        console.log('[DB] Old data cleanup completed');
    }
};

export default db;

// Type-safe wrappers for convenience
export const dbTyped = {
    getUsers: () => db.select<User[]>('users', []),
    saveUsers: (users: User[]) => db.update('users', users),
    
    getClients: () => db.select<Client[]>('clients', []),
    saveClients: (clients: Client[]) => db.update('clients', clients),

    getPerformanceData: () => db.select<{[key: string]: PerformanceRecord[]}>('performance_data', {}),
    savePerformanceData: (data: {[key:string]: PerformanceRecord[]}) => db.update('performance_data', data),

    getLookerData: () => db.select<AllLookerData>('looker_data', {}),
    saveLookerData: (data: AllLookerData) => db.update('looker_data', data),
    
    getBitacoraReports: () => db.select<BitacoraReport[]>('bitacora_reports', []),
    saveBitacoraReports: (reports: BitacoraReport[]) => db.update('bitacora_reports', reports),
    
    getUploadedVideos: () => db.select<UploadedVideo[]>('uploaded_videos', []),
    saveUploadedVideos: (videos: UploadedVideo[]) => db.update('uploaded_videos', videos),

    getImportHistory: () => db.select<ImportBatch[]>('import_history', []),
    saveImportHistory: (history: ImportBatch[]) => db.update('import_history', history),

    getLoggedInUser: () => db.select<User | null>('logged_in_user', null),
    saveLoggedInUser: (user: User | null) => db.update('logged_in_user', user),

    getMetaApiConfig: () => db.select<MetaApiConfig | null>('config', null),
    saveMetaApiConfig: (config: MetaApiConfig | null) => db.update('config', config),

    getProcessedHashes: () => db.select<ProcessedHashes>('processed_files_hashes', {}),
    saveProcessedHashes: (hashes: ProcessedHashes) => db.update('processed_files_hashes', hashes),
    
    // Utility functions
    getLocalStorageUsage: () => db.getLocalStorageUsage(),
    clearOldData: () => db.clearOldData(),
};
