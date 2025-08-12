/**
 * Local Server API Client - Ver6
 * 
 * Cliente para comunicarse con el servidor local SQLite
 * Reemplaza el almacenamiento en localStorage/IndexedDB por almacenamiento en servidor
 */

const SERVER_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SERVER_URL) || 'http://localhost:3001';

export class LocalServerClient {
    private baseUrl: string;

    constructor(baseUrl = SERVER_URL) {
        this.baseUrl = baseUrl;
    }

    /**
     * Check if server is available
     */
    async isServerAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`);
            return response.ok;
        } catch (error) {
            console.warn('[LocalServer] Server not available:', error);
            return false;
        }
    }

    /**
     * Save data to server
     */
    async saveData(table: string, data: any, key?: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/data/${table}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data, key }),
            });

            const result = await response.json();
            
            if (result.success) {
                console.log(`[LocalServer] ✅ Saved ${table} to server`);
                return true;
            } else {
                console.error(`[LocalServer] Failed to save ${table}:`, result.error);
                return false;
            }
        } catch (error) {
            console.error(`[LocalServer] Error saving ${table}:`, error);
            return false;
        }
    }

    /**
     * Load data from server
     */
    async loadData<T>(table: string, key?: string): Promise<T | null> {
        try {
            const url = key 
                ? `${this.baseUrl}/api/data/${table}?key=${encodeURIComponent(key)}`
                : `${this.baseUrl}/api/data/${table}`;
                
            const response = await fetch(url);
            const result = await response.json();
            
            if (result.success) {
                console.log(`[LocalServer] ✅ Loaded ${table} from server`);
                return result.data as T;
            } else {
                console.error(`[LocalServer] Failed to load ${table}:`, result.error);
                return null;
            }
        } catch (error) {
            console.error(`[LocalServer] Error loading ${table}:`, error);
            return null;
        }
    }

    /**
     * Delete data from server
     */
    async deleteData(table: string, key?: string): Promise<boolean> {
        try {
            const url = key 
                ? `${this.baseUrl}/api/data/${table}?key=${encodeURIComponent(key)}`
                : `${this.baseUrl}/api/data/${table}`;
                
            const response = await fetch(url, { method: 'DELETE' });
            const result = await response.json();
            
            if (result.success) {
                console.log(`[LocalServer] ✅ Deleted ${table} from server`);
                return true;
            } else {
                console.error(`[LocalServer] Failed to delete ${table}:`, result.error);
                return false;
            }
        } catch (error) {
            console.error(`[LocalServer] Error deleting ${table}:`, error);
            return false;
        }
    }

    /**
     * Save clients to server
     */
    async saveClients(clients: any[]): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/clients`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ clients }),
            });

            const result = await response.json();
            
            if (result.success) {
                console.log(`[LocalServer] ✅ Saved ${clients.length} clients to server`);
                return true;
            } else {
                console.error(`[LocalServer] Failed to save clients:`, result.error);
                return false;
            }
        } catch (error) {
            console.error(`[LocalServer] Error saving clients:`, error);
            return false;
        }
    }

    /**
     * Load clients from server
     */
    async loadClients(): Promise<any[]> {
        try {
            const response = await fetch(`${this.baseUrl}/api/clients`);
            const result = await response.json();
            
            if (result.success) {
                console.log(`[LocalServer] ✅ Loaded ${result.count} clients from server`);
                return result.data;
            } else {
                console.error(`[LocalServer] Failed to load clients:`, result.error);
                return [];
            }
        } catch (error) {
            console.error(`[LocalServer] Error loading clients:`, error);
            return [];
        }
    }

    /**
     * Save performance records to server
     */
    async savePerformanceRecords(clientId: string, records: any[], batchId?: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/performance/${clientId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ records, batchId }),
            });

            const result = await response.json();
            
            if (result.success) {
                console.log(`[LocalServer] ✅ Saved ${records.length} performance records for ${clientId}`);
                return true;
            } else {
                console.error(`[LocalServer] Failed to save performance records:`, result.error);
                return false;
            }
        } catch (error) {
            console.error(`[LocalServer] Error saving performance records:`, error);
            return false;
        }
    }

    /**
     * Load performance data from server
     */
    async loadPerformanceData(): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/api/performance`);
            const result = await response.json();
            
            if (result.success) {
                console.log(`[LocalServer] ✅ Loaded performance data for ${result.clientCount} clients`);
                return result.data;
            } else {
                console.error(`[LocalServer] Failed to load performance data:`, result.error);
                return {};
            }
        } catch (error) {
            console.error(`[LocalServer] Error loading performance data:`, error);
            return {};
        }
    }

    /**
     * Upload file to server
     */
    async uploadFile(file: File): Promise<any> {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${this.baseUrl}/api/upload`, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            
            if (result.success) {
                console.log(`[LocalServer] ✅ Uploaded file: ${result.file.originalName}`);
                return result.file;
            } else {
                console.error(`[LocalServer] Failed to upload file:`, result.error);
                return null;
            }
        } catch (error) {
            console.error(`[LocalServer] Error uploading file:`, error);
            return null;
        }
    }

    /**
     * Get server statistics
     */
    async getStats(): Promise<any> {
        try {
            const response = await fetch(`${this.baseUrl}/api/stats`);
            const result = await response.json();
            
            if (result.success) {
                console.log(`[LocalServer] ✅ Retrieved server stats: ${result.totalRecords} records`);
                return result;
            } else {
                console.error(`[LocalServer] Failed to get stats:`, result.error);
                return null;
            }
        } catch (error) {
            console.error(`[LocalServer] Error getting stats:`, error);
            return null;
        }
    }

    /**
     * Clear all data from server (development only)
     */
    async clearAllData(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/clear`, {
                method: 'POST',
            });

            const result = await response.json();
            
            if (result.success) {
                console.log(`[LocalServer] ✅ Cleared all data: ${result.deletedRecords} records`);
                return true;
            } else {
                console.error(`[LocalServer] Failed to clear data:`, result.error);
                return false;
            }
        } catch (error) {
            console.error(`[LocalServer] Error clearing data:`, error);
            return false;
        }
    }
}

// Singleton instance
export const localServerClient = new LocalServerClient();

export default localServerClient;
