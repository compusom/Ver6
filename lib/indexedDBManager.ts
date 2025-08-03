/**
 * IndexedDB Database Manager - Ver6 Creative Analytics Platform
 * 
 * Optimized for scalability and future PostgreSQL migration
 * Handles all data persistence with proper indexing and relationships
 * 
 * Data Structure Overview:
 * - clients: Client management and configuration
 * - performance_records: Individual performance metrics by day/ad/demographics
 * - creative_data: Creative assets and AI analysis results
 * - campaigns: Campaign-level aggregations and insights
 * - import_batches: Import history and data lineage
 * - system_config: Application configuration and user settings
 * 
 * Each store is designed to match PostgreSQL table structure for easy migration
 */

import { 
    Client, 
    User, 
    PerformanceRecord, 
    AllLookerData, 
    BitacoraReport, 
    UploadedVideo, 
    ImportBatch, 
    MetaApiConfig, 
    ProcessedHashes,
    AnalysisResult 
} from '../types';

// Enhanced interfaces for IndexedDB with proper indexing
interface PerformanceRecordIndexed extends PerformanceRecord {
    id?: number; // Auto-increment primary key
    createdAt: Date;
    updatedAt: Date;
    importBatchId: string; // Foreign key to import_batches
}

interface CreativeRecord {
    id?: number; // Auto-increment primary key
    clientId: string; // Foreign key to clients
    adName: string; // Links to performance_records
    imageUrl?: string;
    adPreviewLink?: string;
    creativeDescription?: string;
    analysisResult?: AnalysisResult;
    creativeType: 'image' | 'video';
    videoFileName?: string;
    createdAt: Date;
    updatedAt: Date;
}

interface CampaignSummary {
    id?: number; // Auto-increment primary key
    clientId: string; // Foreign key to clients
    campaignName: string;
    totalSpend: number;
    totalRevenue: number;
    totalImpressions: number;
    totalPurchases: number;
    roas: number;
    cpm: number;
    ctr: number;
    startDate: string;
    endDate: string;
    adCount: number;
    activeDays: number;
    createdAt: Date;
    updatedAt: Date;
}

interface SystemConfig {
    key: string; // Primary key
    value: any;
    category: 'user_settings' | 'app_config' | 'meta_api' | 'mcp_config';
    createdAt: Date;
    updatedAt: Date;
}

/**
 * IndexedDB Manager with PostgreSQL-compatible design
 * Implements proper relationships, indexing, and data integrity
 */
class IndexedDBManager {
    private dbName = 'Ver6Database';
    private version = 2; // Incremented for new schema
    private db: IDBDatabase | null = null;

    /**
     * Initialize database with optimized schema
     * Creates indexes for efficient querying
     */
    async initialize(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                console.log('[IndexedDB] Database initialized successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                
                // Clear old stores if they exist (for clean migration)
                const storeNames = Array.from(db.objectStoreNames);
                storeNames.forEach(storeName => {
                    if (db.objectStoreNames.contains(storeName)) {
                        db.deleteObjectStore(storeName);
                    }
                });

                // Create optimized object stores with proper indexing

                // 1. CLIENTS - Main client entities
                const clientStore = db.createObjectStore('clients', { 
                    keyPath: 'id' 
                });
                clientStore.createIndex('userId', 'userId', { unique: false });
                clientStore.createIndex('name', 'name', { unique: false });

                // 2. USERS - Authentication and user management
                const userStore = db.createObjectStore('users', { 
                    keyPath: 'id' 
                });
                userStore.createIndex('username', 'username', { unique: true });

                // 3. PERFORMANCE_RECORDS - Core performance metrics (most queried)
                const perfStore = db.createObjectStore('performance_records', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                // Critical indexes for performance queries
                perfStore.createIndex('clientId', 'clientId', { unique: false });
                perfStore.createIndex('uniqueId', 'uniqueId', { unique: true });
                perfStore.createIndex('campaignName', 'campaignName', { unique: false });
                perfStore.createIndex('adName', 'adName', { unique: false });
                perfStore.createIndex('day', 'day', { unique: false });
                perfStore.createIndex('clientId_day', ['clientId', 'day'], { unique: false });
                perfStore.createIndex('clientId_campaign', ['clientId', 'campaignName'], { unique: false });
                perfStore.createIndex('importBatchId', 'importBatchId', { unique: false });

                // 4. CREATIVE_DATA - Creative assets and AI analysis
                const creativeStore = db.createObjectStore('creative_data', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                creativeStore.createIndex('clientId', 'clientId', { unique: false });
                creativeStore.createIndex('adName', 'adName', { unique: false });
                creativeStore.createIndex('clientId_adName', ['clientId', 'adName'], { unique: true });
                creativeStore.createIndex('creativeType', 'creativeType', { unique: false });

                // 5. CAMPAIGN_SUMMARIES - Pre-aggregated campaign metrics
                const campaignStore = db.createObjectStore('campaign_summaries', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                campaignStore.createIndex('clientId', 'clientId', { unique: false });
                campaignStore.createIndex('campaignName', 'campaignName', { unique: false });
                campaignStore.createIndex('clientId_campaign', ['clientId', 'campaignName'], { unique: true });

                // 6. IMPORT_BATCHES - Data lineage and import history
                const importStore = db.createObjectStore('import_batches', { 
                    keyPath: 'id' 
                });
                importStore.createIndex('clientId', 'clientId', { unique: false });
                importStore.createIndex('timestamp', 'timestamp', { unique: false });
                importStore.createIndex('fileName', 'fileName', { unique: false });

                // 7. SYSTEM_CONFIG - Configuration and settings
                const configStore = db.createObjectStore('system_config', { 
                    keyPath: 'key' 
                });
                configStore.createIndex('category', 'category', { unique: false });

                // 8. PROCESSED_HASHES - Duplicate detection
                const hashStore = db.createObjectStore('processed_hashes', { 
                    keyPath: 'clientId' 
                });

                // 9. BITACORA_REPORTS - Legacy reports (to be migrated)
                const bitacoraStore = db.createObjectStore('bitacora_reports', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                bitacoraStore.createIndex('clientId', 'clientId', { unique: false });

                // 10. UPLOADED_VIDEOS - Video asset management
                const videoStore = db.createObjectStore('uploaded_videos', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                videoStore.createIndex('clientId', 'clientId', { unique: false });
                videoStore.createIndex('fileName', 'fileName', { unique: false });

                console.log('[IndexedDB] Database schema created with optimized indexes');
            };
        });
    }

    /**
     * Generic data access methods with proper error handling
     */
    private async executeTransaction<T>(
        storeNames: string | string[], 
        mode: IDBTransactionMode, 
        operation: (transaction: IDBTransaction) => Promise<T>
    ): Promise<T> {
        if (!this.db) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db!.transaction(storeNames, mode);
                
                transaction.onerror = () => reject(transaction.error);
                transaction.onabort = () => reject(new Error('Transaction aborted'));
                
                operation(transaction).then(resolve).catch(reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    // ==================== CLIENT MANAGEMENT ====================

    async saveClients(clients: Client[]): Promise<void> {
        return this.executeTransaction('clients', 'readwrite', async (transaction) => {
            const store = transaction.objectStore('clients');
            let savedCount = 0;
            let updatedCount = 0;
            
            for (const client of clients) {
                try {
                    // Check if client already exists
                    const existingClient = await new Promise<Client | null>((resolve, reject) => {
                        const getRequest = store.get(client.id);
                        getRequest.onsuccess = () => resolve(getRequest.result || null);
                        getRequest.onerror = () => reject(getRequest.error);
                    });
                    
                    if (existingClient) {
                        updatedCount++;
                    } else {
                        savedCount++;
                    }
                    
                    await new Promise<void>((resolve, reject) => {
                        const request = store.put(client);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                } catch (error) {
                    console.warn(`[IndexedDB] Error saving client ${client.id}:`, error);
                    // Continue with next client
                }
            }
            
            console.log(`[IndexedDB] Clients processed - New: ${savedCount}, Updated: ${updatedCount}`);
        });
    }

    async getClients(): Promise<Client[]> {
        return this.executeTransaction('clients', 'readonly', async (transaction) => {
            const store = transaction.objectStore('clients');
            return new Promise<Client[]>((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        });
    }

    async getClientById(clientId: string): Promise<Client | null> {
        return this.executeTransaction('clients', 'readonly', async (transaction) => {
            const store = transaction.objectStore('clients');
            return new Promise<Client | null>((resolve, reject) => {
                const request = store.get(clientId);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        });
    }

    // ==================== PERFORMANCE DATA ====================

    /**
     * Save performance records with proper indexing
     * Includes data validation and relationship integrity
     */
    async savePerformanceRecords(clientId: string, records: PerformanceRecord[], importBatchId: string): Promise<void> {
        console.log(`[IndexedDB] Saving ${records.length} performance records for client ${clientId}`);
        
        return this.executeTransaction('performance_records', 'readwrite', async (transaction) => {
            const store = transaction.objectStore('performance_records');
            const uniqueIdIndex = store.index('uniqueId');
            const now = new Date();
            let savedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;
            
            for (const record of records) {
                try {
                    // First, check if record with this uniqueId already exists
                    const existingRecord = await new Promise<PerformanceRecordIndexed | null>((resolve, reject) => {
                        const getRequest = uniqueIdIndex.get(record.uniqueId);
                        getRequest.onsuccess = () => resolve(getRequest.result || null);
                        getRequest.onerror = () => reject(getRequest.error);
                    });
                    
                    if (existingRecord) {
                        // Update existing record with newer data
                        const indexedRecord: PerformanceRecordIndexed = {
                            ...existingRecord,
                            ...record,
                            updatedAt: now,
                            importBatchId // Update with new batch ID
                        };
                        
                        await new Promise<void>((resolve, reject) => {
                            const request = store.put(indexedRecord);
                            request.onsuccess = () => {
                                updatedCount++;
                                resolve();
                            };
                            request.onerror = () => reject(request.error);
                        });
                    } else {
                        // Create new record
                        const indexedRecord: PerformanceRecordIndexed = {
                            ...record,
                            createdAt: now,
                            updatedAt: now,
                            importBatchId
                        };
                        
                        await new Promise<void>((resolve, reject) => {
                            const request = store.add(indexedRecord);
                            request.onsuccess = () => {
                                savedCount++;
                                resolve();
                            };
                            request.onerror = () => {
                                // If add fails due to constraint, try to update
                                if (request.error?.name === 'ConstraintError') {
                                    const putRequest = store.put(indexedRecord);
                                    putRequest.onsuccess = () => {
                                        updatedCount++;
                                        resolve();
                                    };
                                    putRequest.onerror = () => reject(putRequest.error);
                                } else {
                                    reject(request.error);
                                }
                            };
                        });
                    }
                } catch (error) {
                    console.warn(`[IndexedDB] Skipping duplicate record ${record.uniqueId}:`, error);
                    skippedCount++;
                    // Continue with next record instead of failing the entire batch
                }
            }
            
            console.log(`[IndexedDB] Performance records processed - New: ${savedCount}, Updated: ${updatedCount}, Skipped: ${skippedCount}`);
        });
    }

    /**
     * Get performance records with efficient filtering
     */
    async getPerformanceRecords(clientId: string, filters?: {
        campaignName?: string;
        adName?: string;
        startDate?: string;
        endDate?: string;
    }): Promise<PerformanceRecord[]> {
        return this.executeTransaction('performance_records', 'readonly', async (transaction) => {
            const store = transaction.objectStore('performance_records');
            const index = store.index('clientId');
            
            return new Promise<PerformanceRecord[]>((resolve, reject) => {
                const request = index.getAll(clientId);
                
                request.onsuccess = () => {
                    let results = request.result || [];
                    
                    // Apply filters
                    if (filters) {
                        if (filters.campaignName) {
                            results = results.filter(r => r.campaignName === filters.campaignName);
                        }
                        if (filters.adName) {
                            results = results.filter(r => r.adName === filters.adName);
                        }
                        if (filters.startDate) {
                            results = results.filter(r => r.day >= filters.startDate!);
                        }
                        if (filters.endDate) {
                            results = results.filter(r => r.day <= filters.endDate!);
                        }
                    }
                    
                    resolve(results);
                };
                request.onerror = () => reject(request.error);
            });
        });
    }

    /**
     * Get performance data in legacy format for backward compatibility
     */
    async getPerformanceData(): Promise<{[key: string]: PerformanceRecord[]}> {
        const clients = await this.getClients();
        const result: {[key: string]: PerformanceRecord[]} = {};
        
        for (const client of clients) {
            const records = await this.getPerformanceRecords(client.id);
            result[client.id] = records;
        }
        
        return result;
    }

    // ==================== CREATIVE DATA ====================

    async saveCreativeData(clientId: string, lookerData: AllLookerData[string]): Promise<void> {
        return this.executeTransaction('creative_data', 'readwrite', async (transaction) => {
            const store = transaction.objectStore('creative_data');
            const clientAdNameIndex = store.index('clientId_adName');
            const now = new Date();
            let savedCount = 0;
            let updatedCount = 0;
            
            for (const [adName, creativeData] of Object.entries(lookerData)) {
                try {
                    // Check if record already exists using composite index
                    const existingRecord = await new Promise<CreativeRecord | null>((resolve, reject) => {
                        const getRequest = clientAdNameIndex.get([clientId, adName]);
                        getRequest.onsuccess = () => resolve(getRequest.result || null);
                        getRequest.onerror = () => reject(getRequest.error);
                    });
                    
                    const record: CreativeRecord = {
                        clientId,
                        adName,
                        imageUrl: creativeData.imageUrl,
                        adPreviewLink: creativeData.adPreviewLink,
                        creativeDescription: creativeData.creativeDescription,
                        analysisResult: creativeData.analysisResult,
                        creativeType: creativeData.imageUrl?.includes('.mp4') ? 'video' : 'image',
                        createdAt: existingRecord?.createdAt || now,
                        updatedAt: now
                    };
                    
                    if (existingRecord) {
                        // Keep the original ID and creation date
                        record.id = existingRecord.id;
                        updatedCount++;
                    } else {
                        savedCount++;
                    }
                    
                    await new Promise<void>((resolve, reject) => {
                        const request = store.put(record);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                } catch (error) {
                    console.warn(`[IndexedDB] Error saving creative data for ${adName}:`, error);
                    // Continue with next record
                }
            }
            
            console.log(`[IndexedDB] Creative data processed for client ${clientId} - New: ${savedCount}, Updated: ${updatedCount}`);
        });
    }

    async getCreativeData(clientId: string): Promise<AllLookerData[string]> {
        return this.executeTransaction('creative_data', 'readonly', async (transaction) => {
            const store = transaction.objectStore('creative_data');
            const index = store.index('clientId');
            
            return new Promise<AllLookerData[string]>((resolve, reject) => {
                const request = index.getAll(clientId);
                
                request.onsuccess = () => {
                    const records = request.result || [];
                    const result: AllLookerData[string] = {};
                    
                    records.forEach((record: CreativeRecord) => {
                        result[record.adName] = {
                            imageUrl: record.imageUrl || '',
                            adPreviewLink: record.adPreviewLink,
                            creativeDescription: record.creativeDescription,
                            analysisResult: record.analysisResult
                        };
                    });
                    
                    resolve(result);
                };
                request.onerror = () => reject(request.error);
            });
        });
    }

    /**
     * Get all creative data across all clients
     */
    async getAllCreativeData(): Promise<AllLookerData> {
        return this.executeTransaction('creative_data', 'readonly', async (transaction) => {
            const store = transaction.objectStore('creative_data');
            
            return new Promise<AllLookerData>((resolve, reject) => {
                const request = store.getAll();
                
                request.onsuccess = () => {
                    const records = request.result || [];
                    const result: AllLookerData = {};
                    
                    records.forEach((record: CreativeRecord) => {
                        if (!result[record.clientId]) {
                            result[record.clientId] = {};
                        }
                        
                        result[record.clientId][record.adName] = {
                            imageUrl: record.imageUrl || '',
                            adPreviewLink: record.adPreviewLink,
                            creativeDescription: record.creativeDescription,
                            analysisResult: record.analysisResult
                        };
                    });
                    
                    resolve(result);
                };
                request.onerror = () => reject(request.error);
            });
        });
    }

    // ==================== SYSTEM CONFIGURATION ====================

    async saveConfig(key: string, value: any, category: SystemConfig['category'] = 'app_config'): Promise<void> {
        return this.executeTransaction('system_config', 'readwrite', async (transaction) => {
            const store = transaction.objectStore('system_config');
            const now = new Date();
            
            const config: SystemConfig = {
                key,
                value,
                category,
                createdAt: now,
                updatedAt: now
            };
            
            await new Promise<void>((resolve, reject) => {
                const request = store.put(config);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        });
    }

    async getConfig<T>(key: string): Promise<T | null> {
        return this.executeTransaction('system_config', 'readonly', async (transaction) => {
            const store = transaction.objectStore('system_config');
            
            return new Promise<T | null>((resolve, reject) => {
                const request = store.get(key);
                request.onsuccess = () => {
                    const result = request.result;
                    resolve(result ? result.value : null);
                };
                request.onerror = () => reject(request.error);
            });
        });
    }

    // ==================== IMPORT MANAGEMENT ====================

    async saveImportBatch(batch: ImportBatch): Promise<void> {
        return this.executeTransaction('import_batches', 'readwrite', async (transaction) => {
            const store = transaction.objectStore('import_batches');
            
            await new Promise<void>((resolve, reject) => {
                const request = store.put(batch);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        });
    }

    async getImportHistory(): Promise<ImportBatch[]> {
        return this.executeTransaction('import_batches', 'readonly', async (transaction) => {
            const store = transaction.objectStore('import_batches');
            const index = store.index('timestamp');
            
            return new Promise<ImportBatch[]>((resolve, reject) => {
                const request = index.getAll();
                request.onsuccess = () => {
                    const results = request.result || [];
                    // Sort by timestamp descending
                    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                    resolve(results);
                };
                request.onerror = () => reject(request.error);
            });
        });
    }

    // ==================== ANALYTICS & REPORTING ====================

    /**
     * Generate campaign summaries for efficient reporting
     */
    async generateCampaignSummaries(clientId: string): Promise<void> {
        const records = await this.getPerformanceRecords(clientId);
        const campaignMap = new Map<string, PerformanceRecord[]>();
        
        // Group by campaign
        records.forEach(record => {
            const key = record.campaignName;
            if (!campaignMap.has(key)) {
                campaignMap.set(key, []);
            }
            campaignMap.get(key)!.push(record);
        });
        
        // Calculate summaries
        const summaries: CampaignSummary[] = [];
        
        for (const [campaignName, campaignRecords] of campaignMap) {
            const totalSpend = campaignRecords.reduce((sum, r) => sum + r.spend, 0);
            const totalRevenue = campaignRecords.reduce((sum, r) => sum + r.purchaseValue, 0);
            const totalImpressions = campaignRecords.reduce((sum, r) => sum + r.impressions, 0);
            const totalPurchases = campaignRecords.reduce((sum, r) => sum + r.purchases, 0);
            
            const summary: CampaignSummary = {
                clientId,
                campaignName,
                totalSpend,
                totalRevenue,
                totalImpressions,
                totalPurchases,
                roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
                cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
                ctr: totalImpressions > 0 ? (campaignRecords.reduce((sum, r) => sum + r.clicksAll, 0) / totalImpressions) * 100 : 0,
                startDate: campaignRecords.reduce((min, r) => r.day < min ? r.day : min, campaignRecords[0].day),
                endDate: campaignRecords.reduce((max, r) => r.day > max ? r.day : max, campaignRecords[0].day),
                adCount: new Set(campaignRecords.map(r => r.adName)).size,
                activeDays: new Set(campaignRecords.map(r => r.day)).size,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            summaries.push(summary);
        }
        
        // Save summaries
        await this.executeTransaction('campaign_summaries', 'readwrite', async (transaction) => {
            const store = transaction.objectStore('campaign_summaries');
            const clientCampaignIndex = store.index('clientId_campaign');
            let savedCount = 0;
            let updatedCount = 0;
            
            for (const summary of summaries) {
                try {
                    // Check if summary already exists
                    const existingSummary = await new Promise<CampaignSummary | null>((resolve, reject) => {
                        const getRequest = clientCampaignIndex.get([clientId, summary.campaignName]);
                        getRequest.onsuccess = () => resolve(getRequest.result || null);
                        getRequest.onerror = () => reject(getRequest.error);
                    });
                    
                    if (existingSummary) {
                        // Preserve original ID and creation date
                        summary.id = existingSummary.id;
                        summary.createdAt = existingSummary.createdAt;
                        updatedCount++;
                    } else {
                        savedCount++;
                    }
                    
                    await new Promise<void>((resolve, reject) => {
                        const request = store.put(summary);
                        request.onsuccess = () => resolve();
                        request.onerror = () => reject(request.error);
                    });
                } catch (error) {
                    console.warn(`[IndexedDB] Error saving campaign summary for ${summary.campaignName}:`, error);
                }
            }
            
            console.log(`[IndexedDB] Campaign summaries processed for client ${clientId} - New: ${savedCount}, Updated: ${updatedCount}`);
        });
    }

    /**
     * Get campaign summaries with optional date filtering
     */
    async getCampaignSummaries(clientId: string, dateRange?: { start: string; end: string }): Promise<CampaignSummary[]> {
        if (!this.db) await this.initialize();
        
        return await this.executeTransaction('campaign_summaries', 'readonly', async (transaction) => {
            const store = transaction.objectStore('campaign_summaries');
            const index = store.index('clientId');
            
            return new Promise<CampaignSummary[]>((resolve, reject) => {
                const request = index.getAll(clientId);
                request.onsuccess = () => {
                    let summaries = request.result as CampaignSummary[];
                    
                    // Apply date filter if provided
                    if (dateRange) {
                        summaries = summaries.filter(summary => {
                            return summary.startDate >= dateRange.start && summary.endDate <= dateRange.end;
                        });
                    }
                    
                    resolve(summaries);
                };
                request.onerror = () => reject(request.error);
            });
        });
    }

    // ==================== MIGRATION & CLEANUP ====================

    /**
     * Clear all data for fresh start
     */
    async clearAllData(): Promise<void> {
        if (!this.db) await this.initialize();
        
        const storeNames = ['clients', 'users', 'performance_records', 'creative_data', 
                          'campaign_summaries', 'import_batches', 'system_config', 
                          'processed_hashes', 'bitacora_reports', 'uploaded_videos'];
        
        return this.executeTransaction(storeNames, 'readwrite', async (transaction) => {
            for (const storeName of storeNames) {
                const store = transaction.objectStore(storeName);
                await new Promise<void>((resolve, reject) => {
                    const request = store.clear();
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }
        });
    }

    /**
     * Get database statistics for monitoring
     */
    async getDatabaseStats(): Promise<{
        clients: number;
        performanceRecords: number;
        creativeRecords: number;
        importBatches: number;
        totalSize: string;
    }> {
        const stats = {
            clients: 0,
            performanceRecords: 0,
            creativeRecords: 0,
            importBatches: 0,
            totalSize: 'Unknown'
        };
        
        try {
            stats.clients = (await this.getClients()).length;
            
            const perfData = await this.getPerformanceData();
            stats.performanceRecords = Object.values(perfData).flat().length;
            
            const importHistory = await this.getImportHistory();
            stats.importBatches = importHistory.length;
            
            // Estimate size (rough calculation)
            if ('estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                stats.totalSize = `${((estimate.usage || 0) / 1024 / 1024).toFixed(2)} MB`;
            }
        } catch (error) {
            console.warn('[IndexedDB] Error getting database stats:', error);
        }
        
        return stats;
    }
}

// Singleton instance
export const indexedDBManager = new IndexedDBManager();

// Legacy exports for backward compatibility
export const indexedDb = indexedDBManager;
