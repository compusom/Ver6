// File System Storage - saves large files directly to user's file system
// Uses File System Access API (modern browsers) with localStorage fallback

export class FileSystemStorage {
    private readonly maxLocalStorageSize = 5 * 1024 * 1024; // 5MB limit for localStorage
    private fileHandles: Map<string, FileSystemFileHandle> = new Map();

    async saveData(key: string, data: any): Promise<void> {
        const dataString = JSON.stringify(data);
        const sizeInBytes = new Blob([dataString]).size;
        const sizeMB = (sizeInBytes / 1024 / 1024).toFixed(2);
        
        console.log(`[FileStorage] Saving ${key}: ${sizeMB}MB`);

        // If data is small enough, use localStorage
        if (sizeInBytes < this.maxLocalStorageSize) {
            try {
                localStorage.setItem(`fs_${key}`, dataString);
                localStorage.setItem(`fs_${key}_meta`, JSON.stringify({ 
                    type: 'localStorage', 
                    size: sizeInBytes,
                    timestamp: Date.now()
                }));
                console.log(`[FileStorage] Saved ${key} to localStorage (${sizeMB}MB)`);
                return;
            } catch (error) {
                console.warn(`[FileStorage] localStorage failed for ${key}, trying file system`);
            }
        }

        // For large data, use File System Access API
        if ('showSaveFilePicker' in window) {
            try {
                await this.saveToFileSystem(key, dataString);
                return;
            } catch (error) {
                console.warn(`[FileStorage] File system save failed:`, error);
            }
        }

        // Final fallback: try localStorage with error
        try {
            localStorage.setItem(`fs_${key}`, dataString);
            localStorage.setItem(`fs_${key}_meta`, JSON.stringify({ 
                type: 'localStorage', 
                size: sizeInBytes,
                timestamp: Date.now()
            }));
            console.log(`[FileStorage] Forced save to localStorage despite size`);
        } catch (error) {
            throw new Error(`Cannot save ${key}: File too large (${sizeMB}MB) and File System API not available. Please use a smaller file or enable File System Access in your browser.`);
        }
    }

    async loadData(key: string): Promise<any | null> {
        try {
            // Check metadata first
            const metaString = localStorage.getItem(`fs_${key}_meta`);
            if (!metaString) {
                console.log(`[FileStorage] No metadata found for ${key}`);
                return null;
            }

            const metadata = JSON.parse(metaString);

            if (metadata.type === 'localStorage') {
                const data = localStorage.getItem(`fs_${key}`);
                if (data) {
                    console.log(`[FileStorage] Loaded ${key} from localStorage`);
                    return JSON.parse(data);
                }
            } else if (metadata.type === 'fileSystem') {
                return await this.loadFromFileSystem(key);
            }

            console.log(`[FileStorage] No data found for ${key}`);
            return null;
        } catch (error) {
            console.error(`[FileStorage] Error loading ${key}:`, error);
            return null;
        }
    }

    deleteData(key: string): void {
        try {
            const metaString = localStorage.getItem(`fs_${key}_meta`);
            if (metaString) {
                const metadata = JSON.parse(metaString);
                
                if (metadata.type === 'localStorage') {
                    localStorage.removeItem(`fs_${key}`);
                } else if (metadata.type === 'fileSystem') {
                    // Remove file handle reference
                    this.fileHandles.delete(key);
                    // Note: We can't delete the actual file, user would need to do that manually
                    console.log(`[FileStorage] File handle removed for ${key}. User should manually delete the file if desired.`);
                }
                
                localStorage.removeItem(`fs_${key}_meta`);
                console.log(`[FileStorage] Deleted ${key}`);
            }
        } catch (error) {
            console.error(`[FileStorage] Error deleting ${key}:`, error);
        }
    }

    private async saveToFileSystem(key: string, dataString: string): Promise<void> {
        if (!('showSaveFilePicker' in window)) {
            throw new Error('File System Access API not supported');
        }

        try {
            // Try to get existing file handle or create new one
            let fileHandle = this.fileHandles.get(key);
            
            if (!fileHandle) {
                const options = {
                    suggestedName: `ver6_${key}_data.json`,
                    types: [{
                        description: 'Ver6 Data Files',
                        accept: {
                            'application/json': ['.json'],
                        },
                    }],
                };

                fileHandle = await (window as any).showSaveFilePicker(options);
                this.fileHandles.set(key, fileHandle);
            }

            // Write data to file
            const writable = await fileHandle.createWritable();
            await writable.write(dataString);
            await writable.close();

            // Save metadata
            localStorage.setItem(`fs_${key}_meta`, JSON.stringify({
                type: 'fileSystem',
                size: dataString.length,
                timestamp: Date.now(),
                fileName: fileHandle.name
            }));

            console.log(`[FileStorage] Saved ${key} to file system as ${fileHandle.name}`);
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('File save cancelled by user');
            }
            throw error;
        }
    }

    private async loadFromFileSystem(key: string): Promise<any | null> {
        try {
            let fileHandle = this.fileHandles.get(key);
            
            if (!fileHandle) {
                // Ask user to select the file
                if ('showOpenFilePicker' in window) {
                    const options = {
                        types: [{
                            description: 'Ver6 Data Files',
                            accept: {
                                'application/json': ['.json'],
                            },
                        }],
                        multiple: false
                    };

                    const [selectedHandle] = await (window as any).showOpenFilePicker(options);
                    this.fileHandles.set(key, selectedHandle);
                    fileHandle = selectedHandle;
                } else {
                    throw new Error('File System Access API not supported');
                }
            }

            const file = await fileHandle.getFile();
            const dataString = await file.text();
            
            console.log(`[FileStorage] Loaded ${key} from file system`);
            return JSON.parse(dataString);
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log(`[FileStorage] File selection cancelled for ${key}`);
                return null;
            }
            throw error;
        }
    }

    getStorageInfo(): { keys: string[], totalLocalStorageSize: number, fileSystemKeys: string[] } {
        const keys: string[] = [];
        const fileSystemKeys: string[] = [];
        let totalLocalStorageSize = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('fs_') && key.endsWith('_meta')) {
                const baseKey = key.replace('fs_', '').replace('_meta', '');
                keys.push(baseKey);
                
                try {
                    const metadata = JSON.parse(localStorage.getItem(key) || '{}');
                    if (metadata.type === 'localStorage') {
                        totalLocalStorageSize += metadata.size || 0;
                    } else if (metadata.type === 'fileSystem') {
                        fileSystemKeys.push(baseKey);
                    }
                } catch (e) {
                    console.warn(`[FileStorage] Invalid metadata for ${key}`);
                }
            }
        }

        return { keys, totalLocalStorageSize, fileSystemKeys };
    }

    clearAll(): void {
        const keysToDelete: string[] = [];
        
        // Find all file storage keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('fs_')) {
                keysToDelete.push(key);
            }
        }
        
        // Delete them
        keysToDelete.forEach(key => localStorage.removeItem(key));
        
        // Clear file handles
        this.fileHandles.clear();
        
        console.log(`[FileStorage] Cleared ${keysToDelete.length} file storage items`);
    }

    async requestFileSystemPermission(): Promise<boolean> {
        if (!('showSaveFilePicker' in window)) {
            console.warn('[FileStorage] File System Access API not supported in this browser');
            return false;
        }

        try {
            // Test if we can use the API
            const testHandle = await (window as any).showSaveFilePicker({
                suggestedName: 'test.txt',
                types: [{
                    description: 'Test files',
                    accept: { 'text/plain': ['.txt'] },
                }],
            });
            
            // Cancel the save (user doesn't actually need to save)
            console.log('[FileStorage] File System Access API is available');
            return true;
        } catch (error) {
            if (error.name === 'AbortError') {
                // User cancelled, but API is available
                return true;
            }
            console.warn('[FileStorage] File System Access API test failed:', error);
            return false;
        }
    }
}

export const fileSystemStorage = new FileSystemStorage();
