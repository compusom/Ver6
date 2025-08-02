
import React, { useState, useEffect, useCallback } from 'react';
import db from '../database';
import Logger from '../Logger';

type TableKey = 'clients' | 'users' | 'performance_data' | 'looker_data' | 'bitacora_reports' | 'uploaded_videos' | 'import_history' | 'processed_files_hashes';

export const ControlPanelView: React.FC = () => {
    const [status, setStatus] = useState<Record<TableKey, boolean>>({} as Record<TableKey, boolean>);
    const [loading, setLoading] = useState<Partial<Record<TableKey, boolean>>>({});
    const [isChecking, setIsChecking] = useState(false);
    const [logs, setLogs] = useState<string[]>(['> Log de producción inicializado. Esperando comandos...']);

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

    useEffect(() => {
        checkTableStatus();
    }, [checkTableStatus]);


    const handleClearDatabase = async () => {
        if (!window.confirm('¿ESTÁS SEGURO? Esta acción eliminará TODA la información de la aplicación (clientes, historial, reportes, usuarios) de forma permanente. Esta acción no se puede deshacer.')) {
            return;
        }

        if (!window.confirm('CONFIRMACIÓN FINAL: ¿Realmente quieres borrar toda la base de datos (excepto la configuración)?')) {
            return;
        }

        try {
            addLog('☢️ Iniciando protocolo de limpieza de datos de la base de datos...');
            await db.clearAllData();
            addLog('✅ Base de datos limpiada con éxito. La aplicación se reiniciará.');
            alert('Base de datos limpiada. La aplicación se recargará.');
            window.location.reload();
        } catch (e) {
            console.error('Error al limpiar la base de datos:', e);
            const errorMessage = e instanceof Error ? e.message : String(e);
            addLog(`❌ Error durante la limpieza: ${errorMessage}`);
            alert('Ocurrió un error al intentar limpiar la base de datos.');
        }
    };

    return (
        <div className="max-w-4xl mx-auto bg-brand-surface rounded-lg p-8 shadow-lg animate-fade-in space-y-8">
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
                                <div className="flex items-center gap-2 text-yellow-400 font-bold bg-yellow-500/20 px-3 py-1 rounded-full text-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    OFFLINE
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
        </div>
    );
};