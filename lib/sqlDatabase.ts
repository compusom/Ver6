import sql from 'mssql';
import Logger from '../Logger';

interface SqlServerConfig {
    server: string;
    database: string;
    options: {
        encrypt: boolean;
        trustServerCertificate: boolean;
        enableArithAbort: boolean;
        integratedSecurity: boolean;
    };
    connectionTimeout: number;
    requestTimeout: number;
}

class SqlServerDatabase {
    private config: SqlServerConfig;
    private pool: sql.ConnectionPool | null = null;
    private isConnected: boolean = false;

    constructor() {
        this.config = {
            server: 'PcCasa\\SQLEXPRESS',
            database: 'TuBaseDeDatos', // Cambiaremos esto después
            options: {
                encrypt: false, // Para conexiones locales
                trustServerCertificate: true,
                enableArithAbort: true,
                integratedSecurity: true // Usa Windows Authentication
            },
            connectionTimeout: 30000,
            requestTimeout: 30000
        };
    }

    async connect(): Promise<boolean> {
        try {
            Logger.info('🔌 Intentando conectar a SQL Server Express...');
            
            // Crear el pool de conexiones
            this.pool = new sql.ConnectionPool(this.config);
            
            // Configurar eventos
            this.pool.on('error', (err) => {
                Logger.error<unknown>('❌ Error en pool de SQL Server:', err);
                this.isConnected = false;
            });

            // Conectar
            await this.pool.connect();
            this.isConnected = true;
            
            Logger.success('✅ Conexión exitosa a SQL Server Express');
            return true;

        } catch (error) {
            Logger.error<unknown>('❌ Error al conectar a SQL Server:', error);
            this.isConnected = false;
            return false;
        }
    }

    async testConnection(): Promise<{ success: boolean; message: string; serverInfo?: any }> {
        try {
            if (!this.isConnected || !this.pool) {
                const connected = await this.connect();
                if (!connected) {
                    return { 
                        success: false, 
                        message: 'No se pudo establecer conexión con SQL Server' 
                    };
                }
            }

            // Ejecutar una consulta simple de prueba
            const request = this.pool!.request();
            const result = await request.query('SELECT @@VERSION as Version, DB_NAME() as CurrentDatabase, GETDATE() as CurrentTime');
            
            const serverInfo = result.recordset[0];
            
            Logger.success('🎉 Test de conexión SQL Server exitoso');
            Logger.info<Record<string, unknown>>('📊 Información del servidor:', serverInfo);

            return {
                success: true,
                message: 'Conexión exitosa a SQL Server Express',
                serverInfo
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            Logger.error<string>('❌ Test de conexión falló:', errorMessage);
            
            return {
                success: false,
                message: `Error en test de conexión: ${errorMessage}`
            };
        }
    }

    async executeQuery(query: string, params?: any[]): Promise<any> {
        try {
            if (!this.isConnected || !this.pool) {
                throw new Error('No hay conexión activa a SQL Server');
            }

            const request = this.pool.request();
            
            // Agregar parámetros si existen
            if (params) {
                params.forEach((param, index) => {
                    request.input(`param${index}`, param);
                });
            }

            const result = await request.query(query);
            return result;

        } catch (error) {
            Logger.error<unknown>('❌ Error ejecutando query SQL:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        try {
            if (this.pool) {
                await this.pool.close();
                this.pool = null;
                this.isConnected = false;
                Logger.info('🔌 Desconectado de SQL Server');
            }
        } catch (error) {
            Logger.error<unknown>('❌ Error al desconectar SQL Server:', error);
        }
    }

    getConnectionStatus(): { connected: boolean; server: string; database: string } {
        return {
            connected: this.isConnected,
            server: this.config.server,
            database: this.config.database
        };
    }

    // Método para cambiar la base de datos (útil para cuando creemos la BD correcta)
    updateDatabase(newDatabaseName: string): void {
        this.config.database = newDatabaseName;
        Logger.info(`📝 Base de datos actualizada a: ${newDatabaseName}`);
    }
}

// Exportar una instancia singleton
export const sqlDb = new SqlServerDatabase();
export default sqlDb;
