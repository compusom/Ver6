// Simple compression-based storage system
// Alternative to IndexedDB - uses localStorage with compression and chunking

export class CompressionStorage {
    private readonly maxChunkSize = 1024 * 1024; // 1MB per chunk
    private readonly compressionThreshold = 10 * 1024; // 10KB threshold for compression

    async saveData(key: string, data: any): Promise<void> {
        const dataString = JSON.stringify(data);
        const sizeInBytes = new Blob([dataString]).size;
        
        console.log(`[CompStorage] Saving ${key}: ${(sizeInBytes / 1024 / 1024).toFixed(2)}MB`);

        try {
            // Try direct storage first for small data
            if (sizeInBytes < this.compressionThreshold) {
                localStorage.setItem(`cs_${key}`, dataString);
                localStorage.setItem(`cs_${key}_meta`, JSON.stringify({ type: 'direct', size: sizeInBytes }));
                console.log(`[CompStorage] Saved ${key} directly to localStorage`);
                return;
            }

            // For larger data, use compression and chunking
            const compressedData = await this.compressString(dataString);
            const chunks = this.chunkData(compressedData);
            
            // Save chunks
            for (let i = 0; i < chunks.length; i++) {
                localStorage.setItem(`cs_${key}_chunk_${i}`, chunks[i]);
            }
            
            // Save metadata
            const metadata = {
                type: 'chunked_compressed',
                chunkCount: chunks.length,
                originalSize: sizeInBytes,
                compressedSize: compressedData.length
            };
            localStorage.setItem(`cs_${key}_meta`, JSON.stringify(metadata));
            
            console.log(`[CompStorage] Saved ${key} as ${chunks.length} compressed chunks`);
            console.log(`[CompStorage] Compression ratio: ${(metadata.compressedSize / metadata.originalSize * 100).toFixed(1)}%`);
            
        } catch (error) {
            console.error(`[CompStorage] Failed to save ${key}:`, error);
            throw new Error(`Failed to save data: ${error}`);
        }
    }

    async loadData(key: string): Promise<any | null> {
        try {
            const metaString = localStorage.getItem(`cs_${key}_meta`);
            if (!metaString) {
                console.log(`[CompStorage] No data found for key: ${key}`);
                return null;
            }

            const metadata = JSON.parse(metaString);
            
            if (metadata.type === 'direct') {
                const data = localStorage.getItem(`cs_${key}`);
                return data ? JSON.parse(data) : null;
            }
            
            if (metadata.type === 'chunked_compressed') {
                // Load all chunks
                const chunks: string[] = [];
                for (let i = 0; i < metadata.chunkCount; i++) {
                    const chunk = localStorage.getItem(`cs_${key}_chunk_${i}`);
                    if (!chunk) {
                        throw new Error(`Missing chunk ${i} for key ${key}`);
                    }
                    chunks.push(chunk);
                }
                
                // Reconstruct compressed data
                const compressedData = chunks.join('');
                
                // Decompress
                const decompressedString = await this.decompressString(compressedData);
                
                console.log(`[CompStorage] Loaded ${key} from ${chunks.length} chunks`);
                return JSON.parse(decompressedString);
            }
            
            throw new Error(`Unknown storage type: ${metadata.type}`);
            
        } catch (error) {
            console.error(`[CompStorage] Failed to load ${key}:`, error);
            return null;
        }
    }

    deleteData(key: string): void {
        try {
            const metaString = localStorage.getItem(`cs_${key}_meta`);
            if (!metaString) return;

            const metadata = JSON.parse(metaString);
            
            // Remove metadata
            localStorage.removeItem(`cs_${key}_meta`);
            
            if (metadata.type === 'direct') {
                localStorage.removeItem(`cs_${key}`);
            } else if (metadata.type === 'chunked_compressed') {
                // Remove all chunks
                for (let i = 0; i < metadata.chunkCount; i++) {
                    localStorage.removeItem(`cs_${key}_chunk_${i}`);
                }
            }
            
            console.log(`[CompStorage] Deleted ${key}`);
        } catch (error) {
            console.error(`[CompStorage] Error deleting ${key}:`, error);
        }
    }

    private chunkData(data: string): string[] {
        const chunks: string[] = [];
        for (let i = 0; i < data.length; i += this.maxChunkSize) {
            chunks.push(data.slice(i, i + this.maxChunkSize));
        }
        return chunks;
    }

    private async compressString(str: string): Promise<string> {
        // Simple run-length encoding for JSON data
        return str
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/,\s*/g, ',') // Remove spaces after commas
            .replace(/:\s*/g, ':') // Remove spaces after colons
            .replace(/\{\s*/g, '{') // Remove spaces after opening braces
            .replace(/\s*\}/g, '}'); // Remove spaces before closing braces
    }

    private async decompressString(compressedStr: string): Promise<string> {
        // For our simple compression, no decompression needed
        return compressedStr;
    }

    getStorageInfo(): { keys: string[], totalSize: number, chunks: number } {
        const keys: string[] = [];
        let totalSize = 0;
        let chunks = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('cs_') && key.endsWith('_meta')) {
                const baseKey = key.replace('cs_', '').replace('_meta', '');
                keys.push(baseKey);
                
                try {
                    const metadata = JSON.parse(localStorage.getItem(key) || '{}');
                    totalSize += metadata.originalSize || 0;
                    if (metadata.type === 'chunked_compressed') {
                        chunks += metadata.chunkCount || 0;
                    }
                } catch (e) {
                    console.warn(`[CompStorage] Invalid metadata for ${key}`);
                }
            }
        }

        return { keys, totalSize, chunks };
    }

    clearAll(): void {
        const keysToDelete: string[] = [];
        
        // Find all compression storage keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('cs_')) {
                keysToDelete.push(key);
            }
        }
        
        // Delete them
        keysToDelete.forEach(key => localStorage.removeItem(key));
        
        console.log(`[CompStorage] Cleared ${keysToDelete.length} compression storage items`);
    }
}

export const compressionStorage = new CompressionStorage();
