import React, { useState, useEffect, useCallback } from 'react';
import { notify } from './notificationService';
import db from '../database';
import Logger from '../Logger';
import { SqlConnectionPanel } from './SqlConnectionPanel';
import { dimensionalManager, DimensionalStatus } from '../database/dimensional_manager';

type TableKey = 'clients' | 'users' | 'performance_data' | 'looker_data' | 'bitacora_reports' | 'uploaded_videos' | 'import_history' | 'processed_files_hashes';

export const ControlPanelView: React.FC = () => {
    // Selector de modo de base de datos
    const [dbMode, setDbMode] = useState<'local' | 'sql'>(localStorage.getItem('db_mode') === 'sql' ? 'sql' : 'local');
    // Backend connection witness
    const [backendPort, setBackendPort] = useState(() => localStorage.getItem('backend_port') || '3001');
    const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
    const [backendError, setBackendError] = useState('');

    const checkBackend = useCallback(async () => {
        setBackendStatus('checking');
        setBackendError('');
        try {
            const res = await fetch(`http://localhost:${backendPort}/api/health`, { method: 'GET' });
            if (res.ok) {
                setBackendStatus('online');
            } else {
                setBackendStatus('offline');
                setBackendError('No responde el backend en el puerto seleccionado.');
            }
        } catch (e) {
            setBackendStatus('offline');
            setBackendError('No responde el backend en el puerto seleccionado.');
        }
    }, [backendPort]);

    useEffect(() => {
        checkBackend();
    }, [checkBackend]);
    const [status, setStatus] = useState<Record<TableKey, boolean>>({} as Record<TableKey, boolean>);
    const [loading, setLoading] = useState<Partial<Record<TableKey, boolean>>>({});
    const [isChecking, setIsChecking] = useState(false);
    const [logs, setLogs] = useState<string[]>(['> Log de producción inicializado. Esperando comandos...']);
    // Estado para el terminal SQL
    const [sqlCommand, setSqlCommand] = useState('');
    const [sqlResult, setSqlResult] = useState<string>('');
    const [sqlLoading, setSqlLoading] = useState(false);
    // Estado para el sistema dimensional
    const [dimensionalStatus, setDimensionalStatus] = useState<DimensionalStatus>(DimensionalStatus.NOT_INITIALIZED);
    const [dimensionalStats, setDimensionalStats] = useState<any>(null);
    const [dimensionalLoading, setDimensionalLoading] = useState(false);

    // Ejecuta el comando SQL en el backend
    const handleRunSqlCommand = async () => {
        if (!sqlCommand.trim()) return;
        setSqlLoading(true);
        setSqlResult('');
        try {
            const res = await fetch(`/api/sql/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: sqlCommand })
            });
            const data = await res.json();
            if (data.success) {
                setSqlResult(JSON.stringify(data.result, null, 2));
            } else {
                setSqlResult('Error: ' + (data.error || 'Comando inválido'));
            }
        } catch (e) {
            setSqlResult('Error de conexión o backend');
        }
        setSqlLoading(false);
    };

    const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setLogs(prev => [...prev.slice(-100), `[${timestamp}] ${message}`]);
    }
    
    const tables: { key: TableKey; name: string; description: string }[] = [
        { key: 'clients', name: 'Tabla de Clientes', description: 'Almacena perfiles de clientes.' },
        { key: 'users', name: 'Tabla de Usuarios', description: 'Almacena credenciales y roles de usuarios.' },
        { key: 'performance_data', name: 'Tabla de Rendimiento (Meta)', description: 'Almacena datos de reportes XLSX.' },
        { key: 'looker_data', name: 'Tabla de Creativos (Looker)', description: 'Almacena URLs de creativos por anuncio.'},
        { key: 'bitacora_reports', name: 'Tabla de Reportes (TXT)', description: 'Almacena los reportes de bitácora parseados.'},
        { key: 'uploaded_videos', name: 'Tabla de Videos Subidos', description: 'Almacena los archivos de video para análisis.'},
        { key: 'import_history', name: 'Tabla de Historial de Importación', description: 'Registra todas las operaciones de subida.'},
        { key: 'processed_files_hashes', name: 'Tabla de Hashes de Archivos', description: 'Previene la subida de archivos duplicados.'},
    ];

    const checkTableStatus = useCallback(async () => {
        setIsChecking(true);
        addLog('> Ejecutando: CHECK DATABASE STATUS...');
        await new Promise(res => setTimeout(res, 500));
        
        const checkKey = (key: string) => localStorage.getItem(key) !== null;
        const newStatus = tables.reduce((acc, table) => {
            acc[table.key] = checkKey(`db_${table.key}`);
            return acc;
        }, {} as Record<TableKey, boolean>);
        
        setStatus(newStatus);
        
        addLog('✅ Status de tablas verificado desde el almacenamiento.');
        setIsChecking(false);
    }, []);

    const checkDimensionalStatus = useCallback(async () => {
        try {
            await dimensionalManager.initialize();
            setDimensionalStatus(dimensionalManager.getStatus());
            
            if (dimensionalManager.isReady()) {
                const stats = await dimensionalManager.getSystemStats();
                setDimensionalStats(stats);
            }
        } catch (error) {
            Logger.error('[CTRL] Failed to check dimensional status:', error);
        }
    }, []);

    useEffect(() => {
        checkTableStatus();
        checkDimensionalStatus();
    }, [checkTableStatus, checkDimensionalStatus]);


    const handleClearDatabase = async () => {
        if (!window.confirm('¿ESTÁS SEGURO? Esta acción eliminará TODA la información de la aplicación (clientes, historial, reportes, usuarios) de forma permanente. Esta acción no se puede deshacer.')) {
            return;
        }

        if (!window.confirm('CONFIRMACIÓN FINAL: ¿Realmente quieres borrar toda la base de datos (excepto la configuración)?')) {
            return;
        }

        try {
            addLog('☢️ Iniciando protocolo de limpieza de datos de la base de datos...');
            
            // Limpiar datos del sistema dimensional si está disponible
            if (dimensionalManager.isReady()) {
                addLog('🗂️ Limpiando datos del sistema dimensional...');
                await dimensionalManager.dropDimensionalTables();
                addLog('✅ Sistema dimensional limpiado.');
            }
            
            // Limpiar datos del sistema tradicional
            await db.clearAllData();
            
            // Actualizar estado dimensional
            await checkDimensionalStatus();
            
            // Recargar hashes procesados en el frontend tras limpiar la base
            if (window.location.reload) {
                window.location.reload();
            } else {
                // Si no se puede recargar, fuerza actualización de estado global
                if ((window as any).getProcessedHashes) {
                    (window as any).getProcessedHashes();
                }
            }
            addLog('✅ Base de datos limpiada con éxito. La aplicación se reiniciará.');
            notify('Base de datos limpiada. La aplicación se recargará.', 'success');
            // window.location.reload() ya se ejecuta arriba si existe
        } catch (e) {
            console.error('Error al limpiar la base de datos:', e);
            const errorMessage = e instanceof Error ? e.message : String(e);
            addLog(`❌ Error durante la limpieza: ${errorMessage}`);
            notify('Ocurrió un error al intentar limpiar la base de datos.', 'error');
        }
    };

    // Verifica y reconecta SQL antes de importar
    const ensureSqlConnected = async () => {
        const backendPort = localStorage.getItem('backend_port') || '3001';
        const statusRes = await fetch(`http://localhost:${backendPort}/api/sql/status`);
        const status = await statusRes.json();
        if (!status.connected) {
            // Reconectar usando credenciales guardadas
            const server = localStorage.getItem('sql_server') || '';
            const port = localStorage.getItem('sql_port') || '';
            const database = localStorage.getItem('sql_database') || '';
            const user = localStorage.getItem('sql_user') || '';
            const password = sessionStorage.getItem('sql_password') || localStorage.getItem('sql_password') || '';
            const connectRes = await fetch(`http://localhost:${backendPort}/api/sql/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ server, port, database, user, password })
            });
            const connectData = await connectRes.json();
            if (!connectData.success) {
                throw new Error('No se pudo reconectar a SQL Server: ' + (connectData.error || 'Error desconocido'));
            }
        }
    };

    // Ejemplo de uso antes de importar Excel
    const handleImportExcel = async (file, allowCreateClient = false) => {
        try {
            await ensureSqlConnected();
            // ...lógica de importación existente...
            // Por ejemplo:
            // const formData = new FormData();
            // formData.append('file', file);
            // const res = await fetch(`/api/sql/import-excel?allowCreateClient=${allowCreateClient}`, {
            //     method: 'POST',
            //     body: formData
            // });
            // const data = await res.json();
            // ...manejo de respuesta...
        } catch (err) {
            notify('Error de conexión SQL: ' + err.message, 'error');
        }
    };

    // Manejadores para el sistema dimensional
    const handleCreateDimensionalTables = async () => {
        if (!window.confirm('¿Crear las tablas del sistema dimensional? Esto creará todas las tablas necesarias para el análisis avanzado.')) {
            return;
        }
        
        setDimensionalLoading(true);
        addLog('🏗️ Iniciando creación del sistema dimensional...');
        
        try {
            await dimensionalManager.createDimensionalTables();
            await checkDimensionalStatus();
            addLog('✅ Sistema dimensional creado exitosamente.');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`❌ Error creando sistema dimensional: ${errorMessage}`);
        } finally {
            setDimensionalLoading(false);
        }
    };

    const handleDropDimensionalTables = async () => {
        if (!window.confirm('¿ELIMINAR todas las tablas del sistema dimensional? Esta acción eliminará todos los datos analíticos de forma permanente.')) {
            return;
        }
        
        if (!window.confirm('CONFIRMACIÓN FINAL: ¿Realmente quieres eliminar todo el sistema dimensional? Esta acción no se puede deshacer.')) {
            return;
        }
        
        setDimensionalLoading(true);
        addLog('🗑️ Eliminando sistema dimensional...');
        
        try {
            await dimensionalManager.dropDimensionalTables();
            await checkDimensionalStatus();
            addLog('✅ Sistema dimensional eliminado exitosamente.');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`❌ Error eliminando sistema dimensional: ${errorMessage}`);
        } finally {
            setDimensionalLoading(false);
        }
    };

    const handleMigrateToDimensional = async () => {
        if (dimensionalStatus !== DimensionalStatus.READY) {
            notify('Sistema dimensional no está listo. Crear las tablas primero.', 'warning');
            return;
        }
        
        if (!window.confirm('¿Migrar datos existentes al sistema dimensional? Esto procesará todos los datos de performance existentes.')) {
            return;
        }
        
        setDimensionalLoading(true);
        addLog('📦 Iniciando migración de datos existentes...');
        
        try {
            await dimensionalManager.migrateExistingData();
            await checkDimensionalStatus();
            addLog('✅ Migración completada exitosamente.');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            addLog(`❌ Error en migración: ${errorMessage}`);
        } finally {
            setDimensionalLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto bg-brand-surface rounded-lg p-8 shadow-lg animate-fade-in space-y-8">
            {/* Selector de modo de base de datos */}
            <div className="mb-6 flex flex-col sm:flex-row items-center gap-4">
                <label className="text-sm text-brand-text-secondary font-bold">Modo de base de datos:</label>
                <select
                    value={dbMode}
                    onChange={e => {
                        setDbMode(e.target.value as 'local' | 'sql');
                        localStorage.setItem('db_mode', e.target.value);
                    }}
                    className="p-2 rounded bg-brand-bg w-32 font-bold"
                >
                    <option value="local">Local</option>
                    <option value="sql">SQL Server</option>
                </select>
                <span className="text-xs text-brand-text-secondary">Selecciona el modo para pruebas y operaciones</span>
                {dbMode === 'local' && dimensionalStatus === DimensionalStatus.READY && (
                    <div className="flex items-center gap-1 bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        DW Activo
                    </div>
                )}
            </div>
            {/* Backend connection witness y panel de control solo en modo local */}
            {dbMode === 'local' && (
                <>
                    <div className="mb-6 flex flex-col sm:flex-row items-center gap-4">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm ${backendStatus === 'online' ? 'bg-green-500/20 text-green-400' : backendStatus === 'checking' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}
                        >
                            {backendStatus === 'online' ? (
                                <>
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="green" /></svg>
                                    Backend ONLINE (puerto {backendPort})
                                </>
                            ) : backendStatus === 'checking' ? (
                                <>
                                    <svg className="h-5 w-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="yellow" /></svg>
                                    Verificando backend...
                                </>
                            ) : (
                                <>
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="red" /></svg>
                                    Backend OFFLINE
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-brand-text-secondary">Puerto backend:</label>
                            <input type="number" min="1" max="65535" value={backendPort} onChange={e => {
                                setBackendPort(e.target.value);
                                localStorage.setItem('backend_port', e.target.value);
                            }} className="p-2 rounded bg-brand-bg w-24" />
                            <button onClick={checkBackend} className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm">Reintentar</button>
                        </div>
                        {backendError && <span className="text-red-400 text-xs ml-2">{backendError}</span>}
                    </div>
                    {/* Panel de control de la base de datos local */}
                    <div>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-brand-text mb-2">Panel de Control de la Base de Datos</h2>
                                <p className="text-brand-text-secondary">
                                    Gestiona las "tablas" de la base de datos simulada de la aplicación.
                                </p>
                            </div>
                            <button
                                onClick={checkTableStatus}
                                disabled={isChecking}
                                className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center sm:justify-start gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isChecking ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                                </svg>
                                <span>{isChecking ? 'Verificando...' : 'Refrescar Estado'}</span>
                            </button>
                        </div>
                        <div className="space-y-4">
                            {tables.map(table => (
                                <div key={table.key} className="bg-brand-border/50 p-4 rounded-md flex justify-between items-center transition-colors">
                                    <div>
                                        <h3 className="font-semibold text-brand-text">{table.name}</h3>
                                        <p className="text-sm text-brand-text-secondary">{table.description}</p>
                                    </div>
                                    {status[table.key] ? (
                                        <div className="flex items-center gap-2 text-green-400 font-bold bg-green-500/20 px-3 py-1 rounded-full text-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                            ONLINE
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="text-yellow-400 font-bold bg-yellow-500/20 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                OFFLINE
                                            </span>
                                            <button
                                                className="ml-2 px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm hover:bg-green-500/30 font-bold"
                                                disabled={!!loading[table.key]}
                                                onClick={async () => {
                                                    setLoading(l => ({ ...l, [table.key]: true }));
                                                    addLog(`> Intentando crear la tabla '${table.name}'...`);
                                                    try {
                                                        if (table.key === 'performance_data') {
                                                            await db.update('performance_data', {});
                                                        } else if (table.key === 'clients') {
                                                            await db.update('clients', []);
                                                        } else if (table.key === 'users') {
                                                            await db.update('users', []);
                                                        } else if (table.key === 'looker_data') {
                                                            await db.update('looker_data', {});
                                                        } else if (table.key === 'bitacora_reports') {
                                                            await db.update('bitacora_reports', []);
                                                        } else if (table.key === 'uploaded_videos') {
                                                            await db.update('uploaded_videos', []);
                                                        } else if (table.key === 'import_history') {
                                                            await db.update('import_history', []);
                                                        } else if (table.key === 'processed_files_hashes') {
                                                            await db.update('processed_files_hashes', {});
                                                        }
                                                        addLog(`✅ Tabla '${table.name}' creada correctamente.`);
                                                        await checkTableStatus();
                                                    } catch (e) {
                                                        addLog(`❌ Error creando la tabla '${table.name}': ${e instanceof Error ? e.message : String(e)}`);
                                                        notify('Error creando la tabla. Ver log.', 'error');
                                                    }
                                                    setLoading(l => ({ ...l, [table.key]: false }));
                                                }}
                                            >Crear tabla</button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mt-6">
                            <h3 className="text-sm font-semibold text-brand-text-secondary mb-2">LOG DE OPERACIONES DE PRODUCCIÓN</h3>
                            <pre className="bg-brand-bg p-4 rounded-md font-mono text-xs text-brand-text-secondary h-40 overflow-y-auto w-full">
                                {logs.map((log, i) => (
                                   <p key={i} className={`whitespace-pre-wrap ${log.includes('✅') ? 'text-green-400' : log.includes('⚠️') ? 'text-yellow-400' : log.includes('❌') || log.includes('☢️') ? 'text-red-400' : ''}`}>{log}</p>
                                ))}
                            </pre>
                        </div>
                    </div>
                    {/* Panel de Sistema Dimensional */}
                    <div className="border-t-2 border-blue-500/30 pt-6 space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            <h3 className="text-xl font-bold text-blue-400">Sistema Dimensional (Data Warehouse)</h3>
                        </div>
                        
                        {/* Estado del sistema dimensional */}
                        <div className="bg-blue-600/10 p-4 rounded-md space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-semibold text-blue-400">Estado del Sistema</h4>
                                    <p className="text-sm text-brand-text-secondary mt-1">
                                        Sistema analítico avanzado con arquitectura dimensional para análisis de Meta Ads
                                    </p>
                                </div>
                                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${
                                    dimensionalStatus === DimensionalStatus.READY ? 'bg-green-500/20 text-green-400' :
                                    dimensionalStatus === DimensionalStatus.INITIALIZING ? 'bg-yellow-500/20 text-yellow-400' :
                                    dimensionalStatus === DimensionalStatus.ERROR ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                                }`}>
                                    {dimensionalStatus === DimensionalStatus.READY && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                    {dimensionalStatus === DimensionalStatus.INITIALIZING && <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                                    {dimensionalStatus.replace('_', ' ').toUpperCase()}
                                </div>
                            </div>
                            
                            {/* Estadísticas del sistema */}
                            {dimensionalStats && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-brand-text">{dimensionalStats.accounts}</div>
                                        <div className="text-xs text-brand-text-secondary">Cuentas</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-brand-text">{dimensionalStats.campaigns}</div>
                                        <div className="text-xs text-brand-text-secondary">Campañas</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-brand-text">{dimensionalStats.ads}</div>
                                        <div className="text-xs text-brand-text-secondary">Anuncios</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-brand-text">{dimensionalStats.factRecords}</div>
                                        <div className="text-xs text-brand-text-secondary">Registros</div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Botones de acción */}
                            <div className="flex flex-wrap gap-3 pt-4 border-t border-blue-500/20">
                                {dimensionalStatus === DimensionalStatus.NOT_INITIALIZED ? (
                                    <button
                                        onClick={handleCreateDimensionalTables}
                                        disabled={dimensionalLoading}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {dimensionalLoading ? (
                                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                        )}
                                        Crear Tablas Dimensionales
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={handleMigrateToDimensional}
                                            disabled={dimensionalLoading}
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                            </svg>
                                            Migrar Datos Existentes
                                        </button>
                                        <button
                                            onClick={checkDimensionalStatus}
                                            disabled={dimensionalLoading}
                                            className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Actualizar Estado
                                        </button>
                                        <button
                                            onClick={handleDropDimensionalTables}
                                            disabled={dimensionalLoading}
                                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            Eliminar Tablas
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Zona de peligro local */}
                    <div className="border-t-2 border-red-500/30 pt-6 space-y-4">
                        <h3 className="text-xl font-bold text-red-400">Zona de Peligro</h3>
                        <div className="bg-red-600/10 p-4 rounded-md flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div>
                                <h4 className="font-semibold text-red-400">Limpiar Todos los Datos</h4>
                                <p className="text-sm text-brand-text-secondary mt-1">
                                    Elimina permanentemente todos los clientes, análisis, reportes, usuarios, etc. La aplicación volverá a su estado inicial.
                                </p>
                            </div>
                            <button
                                onClick={handleClearDatabase}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex-shrink-0"
                            >
                                Limpiar Datos
                            </button>
                        </div>
                    </div>
                </>
            )}
            {dbMode === 'sql' && (
                <>
                    <SqlConnectionPanel />
                    {/* Terminal SQL */}
                    <div className="mt-8 p-6 bg-brand-bg rounded-lg shadow-md">
                        <h3 className="text-lg font-bold text-brand-text mb-2">Terminal SQL Server</h3>
                        <p className="text-sm text-brand-text-secondary mb-2">Ejecuta comandos SQL directamente sobre la base conectada.</p>
                        <textarea
                            value={sqlCommand}
                            onChange={e => setSqlCommand(e.target.value)}
                            rows={4}
                            className="w-full p-2 rounded bg-brand-border/10 font-mono text-brand-text mb-2"
                            placeholder="Escribe tu comando SQL aquí..."
                            disabled={sqlLoading}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleRunSqlCommand}
                                className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm"
                                disabled={sqlLoading || !sqlCommand.trim()}
                            >Ejecutar SQL</button>
                            <button
                                onClick={() => { setSqlCommand(''); setSqlResult(''); }}
                                className="bg-brand-bg border border-brand-border text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm"
                                disabled={sqlLoading}
                            >Limpiar</button>
                        </div>
                        <pre className="bg-brand-border/10 p-4 rounded-md font-mono text-xs text-brand-text-secondary mt-4 h-40 overflow-y-auto w-full">
                            {sqlLoading ? 'Ejecutando...' : sqlResult}
                        </pre>
                    </div>
                </>
            )}
        </div>
    );
};
