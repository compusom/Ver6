// Universal File Storage - works in any browser
// Downloads large files as JSON and prompts user to upload when needed

export class UniversalFileStorage {
    private readonly maxLocalStorageSize = 5 * 1024 * 1024; // 5MB limit for localStorage

    async saveData(key: string, data: any): Promise<void> {
        const dataString = JSON.stringify(data);
        const sizeInBytes = new Blob([dataString]).size;
        const sizeMB = (sizeInBytes / 1024 / 1024).toFixed(2);
        
        console.log(`[UniversalStorage] Saving ${key}: ${sizeMB}MB`);

        // If data is small enough, use localStorage
        if (sizeInBytes < this.maxLocalStorageSize) {
            try {
                localStorage.setItem(`us_${key}`, dataString);
                localStorage.setItem(`us_${key}_meta`, JSON.stringify({ 
                    type: 'localStorage', 
                    size: sizeInBytes,
                    timestamp: Date.now()
                }));
                console.log(`[UniversalStorage] Saved ${key} to localStorage (${sizeMB}MB)`);
                return;
            } catch (error) {
                console.warn(`[UniversalStorage] localStorage failed for ${key}, downloading file instead`);
            }
        }

        // For large data, automatically download as JSON file
        try {
            await this.downloadDataAsFile(key, dataString);
            
            // Save metadata indicating this data is in a downloaded file
            localStorage.setItem(`us_${key}_meta`, JSON.stringify({
                type: 'downloadedFile',
                size: sizeInBytes,
                timestamp: Date.now(),
                fileName: `ver6_${key}_data.json`,
                sizeMB: sizeMB
            }));

            console.log(`[UniversalStorage] Downloaded ${key} as file (${sizeMB}MB)`);
            
            // Show user instructions
            this.showDownloadInstructions(key, sizeMB);
            
        } catch (error) {
            throw new Error(`Cannot save ${key}: Failed to download file. ${error}`);
        }
    }

    async loadData(key: string): Promise<any | null> {
        try {
            // Check metadata first
            const metaString = localStorage.getItem(`us_${key}_meta`);
            if (!metaString) {
                console.log(`[UniversalStorage] No metadata found for ${key}`);
                return null;
            }

            const metadata = JSON.parse(metaString);

            if (metadata.type === 'localStorage') {
                const data = localStorage.getItem(`us_${key}`);
                if (data) {
                    console.log(`[UniversalStorage] Loaded ${key} from localStorage`);
                    return JSON.parse(data);
                }
            } else if (metadata.type === 'downloadedFile') {
                // Prompt user to upload the file
                return await this.promptUserForFile(key, metadata);
            }

            console.log(`[UniversalStorage] No data found for ${key}`);
            return null;
        } catch (error) {
            console.error(`[UniversalStorage] Error loading ${key}:`, error);
            return null;
        }
    }

    deleteData(key: string): void {
        try {
            const metaString = localStorage.getItem(`us_${key}_meta`);
            if (metaString) {
                const metadata = JSON.parse(metaString);
                
                if (metadata.type === 'localStorage') {
                    localStorage.removeItem(`us_${key}`);
                } else if (metadata.type === 'downloadedFile') {
                    console.log(`[UniversalStorage] File ${metadata.fileName} should be manually deleted from Downloads folder`);
                }
                
                localStorage.removeItem(`us_${key}_meta`);
                console.log(`[UniversalStorage] Deleted ${key}`);
            }
        } catch (error) {
            console.error(`[UniversalStorage] Error deleting ${key}:`, error);
        }
    }

    private async downloadDataAsFile(key: string, dataString: string): Promise<void> {
        const blob = new Blob([dataString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `ver6_${key}_data.json`;
        
        // Append to body, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the URL object
        URL.revokeObjectURL(url);
    }

    private showDownloadInstructions(key: string, sizeMB: string): void {
        const message = `
✅ Archivo guardado exitosamente!

📁 Se ha descargado: ver6_${key}_data.json (${sizeMB}MB)

📋 IMPORTANTE - Para cargar los datos la próxima vez:
1. El archivo se encuentra en tu carpeta de Descargas
2. Cuando refresques la página, se te pedirá que selecciones este archivo
3. NO muevas ni renombres el archivo

¿Continuar?`;

        alert(message);
    }

    private async promptUserForFile(key: string, metadata: any): Promise<any | null> {
        return new Promise((resolve) => {
            const message = `
📁 Necesito cargar tus datos de ${key}

Archivo requerido: ${metadata.fileName} (${metadata.sizeMB}MB)
Descargado el: ${new Date(metadata.timestamp).toLocaleString()}

Busca este archivo en tu carpeta de Descargas y selecciónalo.

¿Seleccionar archivo ahora?`;

            if (!confirm(message)) {
                resolve(null);
                return;
            }

            // Create file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            
            input.onchange = async (event) => {
                const file = (event.target as HTMLInputElement).files?.[0];
                if (!file) {
                    resolve(null);
                    return;
                }

                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    console.log(`[UniversalStorage] Loaded ${key} from uploaded file`);
                    resolve(data);
                } catch (error) {
                    alert(`Error al leer el archivo: ${error}`);
                    resolve(null);
                }
            };

            input.oncancel = () => resolve(null);
            
            // Trigger file dialog
            input.click();
        });
    }

    getStorageInfo(): { keys: string[], totalLocalStorageSize: number, downloadedFiles: string[] } {
        const keys: string[] = [];
        const downloadedFiles: string[] = [];
        let totalLocalStorageSize = 0;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('us_') && key.endsWith('_meta')) {
                const baseKey = key.replace('us_', '').replace('_meta', '');
                keys.push(baseKey);
                
                try {
                    const metadata = JSON.parse(localStorage.getItem(key) || '{}');
                    if (metadata.type === 'localStorage') {
                        totalLocalStorageSize += metadata.size || 0;
                    } else if (metadata.type === 'downloadedFile') {
                        downloadedFiles.push(`${metadata.fileName} (${metadata.sizeMB}MB)`);
                    }
                } catch (e) {
                    console.warn(`[UniversalStorage] Invalid metadata for ${key}`);
                }
            }
        }

        return { keys, totalLocalStorageSize, downloadedFiles };
    }

    clearAll(): void {
        const keysToDelete: string[] = [];
        const filesToDelete: string[] = [];
        
        // Find all universal storage keys
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('us_')) {
                keysToDelete.push(key);
                
                // Track downloaded files for user notification
                if (key.endsWith('_meta')) {
                    try {
                        const metadata = JSON.parse(localStorage.getItem(key) || '{}');
                        if (metadata.type === 'downloadedFile') {
                            filesToDelete.push(metadata.fileName);
                        }
                    } catch (e) {
                        // Ignore invalid metadata
                    }
                }
            }
        }
        
        // Delete localStorage keys
        keysToDelete.forEach(key => localStorage.removeItem(key));
        
        console.log(`[UniversalStorage] Cleared ${keysToDelete.length} universal storage items`);
        
        // Notify user about downloaded files
        if (filesToDelete.length > 0) {
            const message = `
🗑️ Datos borrados del navegador.

📁 Archivos en Descargas que puedes eliminar manualmente:
${filesToDelete.map(f => `• ${f}`).join('\n')}

Estos archivos ya no son necesarios.`;
            
            alert(message);
        }
    }

    // Helper method to check if there are any downloaded files that need to be loaded
    getDownloadedFilesStatus(): { hasDownloadedFiles: boolean, files: string[] } {
        const info = this.getStorageInfo();
        return {
            hasDownloadedFiles: info.downloadedFiles.length > 0,
            files: info.downloadedFiles
        };
    }
}

export const universalFileStorage = new UniversalFileStorage();
