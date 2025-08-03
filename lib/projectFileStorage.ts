/**
 * Project File Storage - Ver6 Sistema Local para Navegador
 * 
 * Este sistema maneja el almacenamiento de archivos para datos persistentes
 * que deben estar disponibles en la sesión de trabajo.
 * 
 * PROPÓSITO:
 * - processed_files_hashes: Para evitar reprocessar archivos ya importados
 * - config_backups: Respaldos de configuraciones importantes  
 * - data_exports: Exportaciones de datos para análisis offline
 * 
 * COMPORTAMIENTO EN NAVEGADOR:
 * - Usa localStorage con prefijo especial para "archivos del proyecto"
 * - Genera descargas automáticas para respaldar datos importantes
 * - Simula un sistema de archivos local para desarrollo
 */

class ProjectFileStorage {
    private readonly PROJECT_PREFIX = 'project_file_';
    private readonly EXPORT_PREFIX = 'export_';

    /**
     * Guardar datos en "archivo del proyecto"
     */
    async saveData(filename: string, data: any): Promise<void> {
        try {
            const key = `${this.PROJECT_PREFIX}${filename}`;
            const jsonString = JSON.stringify(data);
            
            // Guardar en localStorage como almacenamiento principal
            localStorage.setItem(key, jsonString);
            
            // También crear descarga para respaldo físico en carpeta del proyecto
            this.downloadAsFile(filename, JSON.stringify(data, null, 2));
            
            console.log(`[ProjectFS] ✅ Saved ${filename} to project storage + generated download`);
            
        } catch (error) {
            console.error(`[ProjectFS] Error saving ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Cargar datos desde "archivo del proyecto"
     */
    async loadData<T>(filename: string): Promise<T | null> {
        try {
            const key = `${this.PROJECT_PREFIX}${filename}`;
            const stored = localStorage.getItem(key);
            
            if (stored) {
                const data = JSON.parse(stored) as T;
                console.log(`[ProjectFS] ✅ Loaded ${filename} from project storage`);
                return data;
            }
            
            console.log(`[ProjectFS] No data found for ${filename}`);
            return null;
            
        } catch (error) {
            console.error(`[ProjectFS] Error loading ${filename}:`, error);
            return null;
        }
    }

    /**
     * Exportar datos con timestamp para respaldo
     */
    async exportData(filename: string, data: any): Promise<void> {
        try {
            const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const exportFilename = `${filename}_${timestamp}`;
            
            // Guardar referencia de exportación
            const exportKey = `${this.EXPORT_PREFIX}${exportFilename}`;
            localStorage.setItem(exportKey, JSON.stringify({
                originalFilename: filename,
                exportDate: new Date().toISOString(),
                dataSize: JSON.stringify(data).length
            }));
            
            // Descargar archivo
            this.downloadAsFile(exportFilename, JSON.stringify(data, null, 2));
            
            console.log(`[ProjectFS] ✅ Exported ${exportFilename}.json`);
            
        } catch (error) {
            console.error(`[ProjectFS] Error exporting ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Listar archivos disponibles en el proyecto
     */
    async listFiles(): Promise<string[]> {
        const files: string[] = [];
        
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.PROJECT_PREFIX)) {
                    const filename = key.replace(this.PROJECT_PREFIX, '');
                    files.push(filename);
                }
            }
            
            console.log(`[ProjectFS] Found ${files.length} project files`);
            return files;
            
        } catch (error) {
            console.error('[ProjectFS] Error listing files:', error);
            return [];
        }
    }

    /**
     * Eliminar archivo del proyecto
     */
    async deleteData(filename: string): Promise<void> {
        try {
            const key = `${this.PROJECT_PREFIX}${filename}`;
            localStorage.removeItem(key);
            console.log(`[ProjectFS] ✅ Deleted ${filename} from project storage`);
            
        } catch (error) {
            console.error(`[ProjectFS] Error deleting ${filename}:`, error);
            throw error;
        }
    }

    /**
     * Verificar si un archivo existe
     */
    async exists(filename: string): Promise<boolean> {
        try {
            const key = `${this.PROJECT_PREFIX}${filename}`;
            return localStorage.getItem(key) !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * Descargar archivo en el navegador para guardarlo en carpeta del proyecto
     */
    private downloadAsFile(filename: string, content: string): void {
        try {
            const blob = new Blob([content], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            
            a.href = url;
            a.download = `${filename}.json`;
            a.style.display = 'none';
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            console.log(`[ProjectFS] ✅ Downloaded ${filename}.json for project storage`);
        } catch (error) {
            console.error(`[ProjectFS] Error downloading file:`, error);
        }
    }

    /**
     * Obtener estadísticas del almacenamiento
     */
    async getStorageStats(): Promise<{
        filesCount: number;
        totalSize: string;
        files: { name: string; size: string; lastModified: string }[];
    }> {
        try {
            const files = await this.listFiles();
            const fileDetails: { name: string; size: string; lastModified: string }[] = [];
            let totalBytes = 0;

            for (const filename of files) {
                const data = await this.loadData(filename);
                const size = data ? JSON.stringify(data).length : 0;
                totalBytes += size;
                
                fileDetails.push({
                    name: filename,
                    size: `${(size / 1024).toFixed(2)} KB`,
                    lastModified: 'Unknown' // localStorage no proporciona fechas
                });
            }

            return {
                filesCount: files.length,
                totalSize: `${(totalBytes / 1024).toFixed(2)} KB`,
                files: fileDetails
            };
            
        } catch (error) {
            console.error('[ProjectFS] Error getting storage stats:', error);
            return {
                filesCount: 0,
                totalSize: '0 KB',
                files: []
            };
        }
    }

    /**
     * Limpiar archivos de exportación antiguos
     */
    async cleanupOldExports(): Promise<number> {
        try {
            let deletedCount = 0;
            const keysToDelete: string[] = [];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(this.EXPORT_PREFIX)) {
                    keysToDelete.push(key);
                }
            }

            keysToDelete.forEach(key => {
                localStorage.removeItem(key);
                deletedCount++;
            });

            console.log(`[ProjectFS] ✅ Cleanup completed: ${deletedCount} export references deleted`);
            return deletedCount;
            
        } catch (error) {
            console.error('[ProjectFS] Error during cleanup:', error);
            return 0;
        }
    }

    /**
     * Importar datos desde archivo subido por el usuario
     */
    async importFromFile(file: File): Promise<{ filename: string; data: any }> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const content = event.target?.result as string;
                    const data = JSON.parse(content);
                    
                    // Extraer nombre de archivo sin extensión
                    const filename = file.name.replace(/\.json$/, '');
                    
                    console.log(`[ProjectFS] ✅ Imported ${filename} from uploaded file`);
                    resolve({ filename, data });
                    
                } catch (error) {
                    console.error('[ProjectFS] Error parsing uploaded file:', error);
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                console.error('[ProjectFS] Error reading uploaded file');
                reject(new Error('Failed to read file'));
            };
            
            reader.readAsText(file);
        });
    }

    /**
     * Crear input para seleccionar archivo del proyecto
     */
    createFileInput(callback: (filename: string, data: any) => void): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';
        
        input.onchange = async (event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (file) {
                try {
                    const result = await this.importFromFile(file);
                    callback(result.filename, result.data);
                } catch (error) {
                    console.error('[ProjectFS] Error importing file:', error);
                }
            }
        };
        
        return input;
    }
}

// Singleton instance
export const projectFileStorage = new ProjectFileStorage();

export default projectFileStorage;
