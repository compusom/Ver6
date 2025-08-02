import { Client, User, PerformanceRecord, AllLookerData, BitacoraReport, UploadedVideo, ImportBatch, MetaApiConfig, ProcessedHashes } from './types';

// A simulated database client for a more realistic feel.
// In a real-world scenario, this would be a backend API client.
// This simulation uses localStorage as its data store.

const ARTIFICIAL_DELAY_MS = 400;

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

const simulateQuery = <T>(action: () => T): Promise<T> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                // Connection is checked inside the action to allow config to be read before connection.
                const result = action();
                resolve(result);
            } catch (error) {
                reject(error);
            }
        }, ARTIFICIAL_DELAY_MS);
    });
};

const db = {
    async select<T>(table: string, defaultValue: T): Promise<T> {
        // Allow reading config before connection is established
        if (table !== 'config') {
            checkConnection();
        }
        console.log(`[DB] Executing: SELECT * FROM ${table};`);
        return simulateQuery(() => {
            try {
                const data = localStorage.getItem(`db_${table}`);
                return data ? JSON.parse(data) : defaultValue;
            } catch (e) {
                console.error(`[DB] Error parsing table ${table}:`, e);
                return defaultValue;
            }
        });
    },

    async update(table: string, data: any): Promise<void> {
        // Allow writing config before connection is established
        if (table !== 'config') {
            checkConnection();
        }
        console.log(`[DB] Executing: UPDATE ${table} with new data...`);
        return simulateQuery(() => {
             try {
                localStorage.setItem(`db_${table}`, JSON.stringify(data));
            } catch (e) {
                console.error(`[DB] Error writing to table ${table}:`, e);
                if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) {
                    alert(`Error: El almacenamiento está lleno. No se pudieron guardar los datos en la tabla "${table}". Libere espacio desde el Panel de Control.`);
                }
            }
        });
    },

    async clearTable(table: string): Promise<void> {
        checkConnection();
        console.log(`[DB] Executing: DELETE FROM ${table};`);
        return simulateQuery(() => {
            localStorage.removeItem(`db_${table}`);
        });
    },

    async clearAllData(): Promise<void> {
        checkConnection();
        console.log(`[DB] Executing: CLEAR ALL USER DATA;`);
        return simulateQuery(() => {
            const keysToClear = [
                'db_clients',
                'db_users',
                'db_performance_data',
                'db_looker_data',
                'db_bitacora_reports',
                'db_uploaded_videos',
                'db_import_history', // Added import history
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
        });
    },
    
    async factoryReset(): Promise<void> {
        // No connection check needed for a full reset
        console.log(`[DB] Executing: FACTORY RESET;`);
        return simulateQuery(() => {
            localStorage.clear();
        });
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
};
