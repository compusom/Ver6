import { Client, User, PerformanceRecord, AllLookerData, BitacoraReport, UploadedVideo, ImportBatch, MetaApiConfig, ProcessedHashes } from '../types';

// IndexedDB Database Manager para archivos grandes en el navegador
// Esta es una alternativa a SQLite que funciona en el navegador
class IndexedDBManager {
    private dbName = 'Ver6Database';
    private version = 1;
    private db: IDBDatabase | null = null;

    async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Crear object stores con keyPath específico
                if (!db.objectStoreNames.contains('clients')) {
                    db.createObjectStore('clients', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('performance_data')) {
                    db.createObjectStore('performance_data', { keyPath: 'client_id' });
                }
                if (!db.objectStoreNames.contains('looker_data')) {
                    db.createObjectStore('looker_data', { keyPath: 'client_id' });
                }
                if (!db.objectStoreNames.contains('import_history')) {
                    db.createObjectStore('import_history', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('processed_hashes')) {
                    db.createObjectStore('processed_hashes', { keyPath: 'client_id' });
                }
                if (!db.objectStoreNames.contains('config')) {
                    db.createObjectStore('config', { keyPath: 'key' });
                }
                
                // Crear object stores genéricos sin keyPath para datos arbitrarios
                if (!db.objectStoreNames.contains('generic_data')) {
                    db.createObjectStore('generic_data');
                }
            };
        });
    }

    async saveData<T>(storeName: string, data: T, key?: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const request = key ? store.put({ id: key, data }) : store.put(data);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async getData<T>(storeName: string, key?: string): Promise<T | null> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            const request = key ? store.get(key) : store.getAll();
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result;
                if (key && result) {
                    resolve(result.data);
                } else {
                    resolve(result || null);
                }
            };
        });
    }

    async clearStore(storeName: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const request = store.clear();
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async deleteData(storeName: string, key: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const request = store.delete(key);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    // Métodos específicos para la aplicación
    async saveClients(clients: Client[]): Promise<void> {
        await this.saveData('clients', clients, 'all');
    }

    async getClients(): Promise<Client[]> {
        const result = await this.getData<Client[]>('clients', 'all');
        return result || [];
    }

    async savePerformanceData(data: {[key: string]: PerformanceRecord[]}): Promise<void> {
        // Guardar por cliente para optimizar consultas
        for (const [clientId, records] of Object.entries(data)) {
            await this.saveData('performance_data', records, clientId);
        }
    }

    async getPerformanceData(): Promise<{[key: string]: PerformanceRecord[]}> {
        const allData = await this.getData<any[]>('performance_data');
        const result: {[key: string]: PerformanceRecord[]} = {};
        
        if (Array.isArray(allData)) {
            for (const item of allData) {
                if (item.id && item.data) {
                    result[item.id] = item.data;
                }
            }
        }
        
        return result;
    }

    async cleanOldData(): Promise<void> {
        // En IndexedDB, no hay tanto problema de espacio como en localStorage
        console.log('[IndexedDB] Cleaning old data...');
        
        // Podrías implementar limpieza específica aquí si es necesario
        // Por ejemplo, mantener solo las últimas 100 importaciones
    }
}

// Sistema de gestión de archivos de imágenes usando IndexedDB
export class ImageFileManager {
    private dbName = 'Ver6ImageDatabase';
    private version = 1;
    private db: IDBDatabase | null = null;

    async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('images')) {
                    const store = db.createObjectStore('images', { keyPath: 'id' });
                    store.createIndex('client', 'client', { unique: false });
                }
            };
        });
    }

    async saveImage(clientName: string, imageFile: File, fileName?: string): Promise<string> {
        if (!this.db) {
            await this.initialize();
        }

        const cleanClientName = clientName.replace(/[^a-zA-Z0-9-_]/g, '_');
        const finalFileName = fileName || `${Date.now()}_${imageFile.name}`;
        const imageId = `${cleanClientName}/${finalFileName}`;

        // Convertir File a ArrayBuffer
        const arrayBuffer = await imageFile.arrayBuffer();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');

            const imageData = {
                id: imageId,
                client: cleanClientName,
                fileName: finalFileName,
                data: arrayBuffer,
                mimeType: imageFile.type,
                size: imageFile.size,
                timestamp: Date.now()
            };

            const request = store.put(imageData);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(imageId);
        });
    }

    async getImageBlob(imageId: string): Promise<Blob | null> {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            const request = store.get(imageId);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    const blob = new Blob([result.data], { type: result.mimeType });
                    resolve(blob);
                } else {
                    resolve(null);
                }
            };
        });
    }

    async getImageUrl(imageId: string): Promise<string | null> {
        const blob = await this.getImageBlob(imageId);
        if (blob) {
            return URL.createObjectURL(blob);
        }
        return null;
    }

    async listClientImages(clientName: string): Promise<{ id: string; fileName: string; size: number; timestamp: number }[]> {
        if (!this.db) {
            await this.initialize();
        }

        const cleanClientName = clientName.replace(/[^a-zA-Z0-9-_]/g, '_');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            const index = store.index('client');
            const request = index.getAll(cleanClientName);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const results = request.result.map((item: any) => ({
                    id: item.id,
                    fileName: item.fileName,
                    size: item.size,
                    timestamp: item.timestamp
                }));
                resolve(results);
            };
        });
    }

    async deleteImage(imageId: string): Promise<boolean> {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');
            const request = store.delete(imageId);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(true);
        });
    }

    async getStorageUsage(): Promise<{ totalImages: number; totalSize: number; byClient: { [client: string]: { count: number; size: number } } }> {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            const request = store.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const results = request.result;
                let totalSize = 0;
                const byClient: { [client: string]: { count: number; size: number } } = {};

                for (const item of results) {
                    totalSize += item.size;
                    
                    if (!byClient[item.client]) {
                        byClient[item.client] = { count: 0, size: 0 };
                    }
                    byClient[item.client].count++;
                    byClient[item.client].size += item.size;
                }

                resolve({
                    totalImages: results.length,
                    totalSize,
                    byClient
                });
            };
        });
    }
}

// Singleton instances
export const indexedDb = new IndexedDBManager();
export const imageManager = new ImageFileManager();

// Función para migrar datos de localStorage a IndexedDB
export async function migrateFromLocalStorage() {
    console.log('[MIGRATION] Starting migration from localStorage to IndexedDB...');
    
    try {
        await indexedDb.initialize();
        
        // Migrar clientes
        const clientsData = localStorage.getItem('db_clients');
        if (clientsData) {
            const clients = JSON.parse(clientsData) as Client[];
            await indexedDb.saveClients(clients);
            console.log('[MIGRATION] Migrated clients');
        }

        // Migrar datos de rendimiento
        const perfData = localStorage.getItem('db_performance_data');
        if (perfData) {
            const performanceData = JSON.parse(perfData) as {[key: string]: PerformanceRecord[]};
            await indexedDb.savePerformanceData(performanceData);
            console.log('[MIGRATION] Migrated performance data');
        }

        console.log('[MIGRATION] Migration completed successfully');
        return true;
    } catch (e) {
        console.error('[MIGRATION] Error during migration:', e);
        return false;
    }
}
