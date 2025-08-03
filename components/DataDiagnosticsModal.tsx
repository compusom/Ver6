import React, { useState, useEffect, useCallback } from 'react';
import { Client, PerformanceRecord, AllLookerData, ImportBatch } from '../types';
import db, { dbConnectionStatus } from '../database';
import { indexedDb, migrateFromLocalStorage } from '../lib/sqliteDatabase';
import Logger from '../Logger';

interface DataDiagnosticsModalProps {
    isOpen: boolean;
    onClose: () => void;
    clients: Client[];
    performanceData: { [key: string]: PerformanceRecord[] };
    lookerData: AllLookerData;
    importHistory: ImportBatch[];
}

interface LocalStorageInfo {
    size: number;
    type: string;
    length: number;
    error?: string;
}

export const DataDiagnosticsModal: React.FC<DataDiagnosticsModalProps> = ({
    isOpen,
    onClose,
    clients,
    performanceData,
    lookerData,
    importHistory
}) => {
    const [localStorageInfo, setLocalStorageInfo] = useState<{[key: string]: LocalStorageInfo}>({});
    const [processedHashes, setProcessedHashes] = useState<{[key: string]: string[]}>({});
    const [storageUsage, setStorageUsage] = useState<{used: string; quota: string; items: number}>({ used: '0', quota: '0', items: 0 });

    const refreshData = useCallback(async () => {
        if (!isOpen) return;
        
        // Cargar información del localStorage
        const info: {[key: string]: LocalStorageInfo} = {};
        
        // Revisar todas las claves del localStorage
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('db_')) {
                try {
                    const value = localStorage.getItem(key);
                    if (value) {
                        const parsed = JSON.parse(value);
                        info[key] = {
                            size: new Blob([value]).size,
                            type: Array.isArray(parsed) ? 'array' : typeof parsed,
                            length: Array.isArray(parsed) ? parsed.length : Object.keys(parsed || {}).length
                        };
                    }
                } catch (e) {
                    info[key] = { 
                        size: 0,
                        type: 'error',
                        length: 0,
                        error: 'Error parsing data' 
                    };
                }
            }
        }
        
        setLocalStorageInfo(info);
        
        // Cargar hashes procesados y uso del localStorage
        try {
            const hashes = await db.getProcessedHashes();
            setProcessedHashes(hashes);
            
            const usage = db.getLocalStorageUsage();
            setStorageUsage(usage);
        } catch (e) {
            console.error('Error loading diagnostic data:', e);
        }
    }, [isOpen]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    if (!isOpen) return null;

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const totalPerformanceRecords = Object.values(performanceData).flat().length;
    const totalLookerRecords = Object.values(lookerData).reduce((acc, clientData) => acc + Object.keys(clientData).length, 0);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-brand-surface rounded-xl border border-brand-border max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-brand-border">
                    <h2 className="text-xl font-bold text-brand-text">Diagnóstico de Datos</h2>
                    <button
                        onClick={onClose}
                        className="text-brand-text-secondary hover:text-brand-text"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Resumen General */}
                    <div className="bg-brand-bg/50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-brand-text mb-3">📊 Resumen General</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center">
                                <div className="text-2xl font-bold text-brand-primary">{clients.length}</div>
                                <div className="text-sm text-brand-text-secondary">Clientes</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-green-400">{totalPerformanceRecords}</div>
                                <div className="text-sm text-brand-text-secondary">Registros Performance</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-400">{totalLookerRecords}</div>
                                <div className="text-sm text-brand-text-secondary">Creativos Looker</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-orange-400">{importHistory.length}</div>
                                <div className="text-sm text-brand-text-secondary">Importaciones</div>
                            </div>
                        </div>
                    </div>

                    {/* Uso del Almacenamiento */}
                    <div className={`rounded-lg p-4 border-2 ${parseFloat(storageUsage.used) > 4 ? 'bg-red-500/10 border-red-500/30' : parseFloat(storageUsage.used) > 2 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                        <h3 className="text-lg font-semibold text-brand-text mb-3">💾 Uso del Almacenamiento Local</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center">
                                <div className={`text-2xl font-bold ${parseFloat(storageUsage.used) > 4 ? 'text-red-400' : parseFloat(storageUsage.used) > 2 ? 'text-yellow-400' : 'text-green-400'}`}>
                                    {storageUsage.used}MB
                                </div>
                                <div className="text-sm text-brand-text-secondary">Usado</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-blue-400">{storageUsage.quota}MB</div>
                                <div className="text-sm text-brand-text-secondary">Límite Estimado</div>
                            </div>
                            <div className="text-center">
                                <div className="text-2xl font-bold text-purple-400">{storageUsage.items}</div>
                                <div className="text-sm text-brand-text-secondary">Items Totales</div>
                            </div>
                        </div>
                        {parseFloat(storageUsage.used) > 4 && (
                            <div className="mt-3 p-2 bg-red-500/20 rounded text-sm text-red-400">
                                ⚠️ Almacenamiento casi lleno. Esto puede causar errores al importar datos.
                            </div>
                        )}
                        {parseFloat(storageUsage.used) > 2 && parseFloat(storageUsage.used) <= 4 && (
                            <div className="mt-3 p-2 bg-yellow-500/20 rounded text-sm text-yellow-400">
                                ⚠️ Almacenamiento con uso elevado. Considere limpiar datos antiguos.
                            </div>
                        )}
                    </div>

                    {/* Datos por Cliente */}
                    <div className="bg-brand-bg/50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-brand-text mb-3">👥 Datos por Cliente</h3>
                        {clients.length === 0 ? (
                            <p className="text-brand-text-secondary">No hay clientes configurados</p>
                        ) : (
                            <div className="space-y-2">
                                {clients.map(client => {
                                    const perfRecords = performanceData[client.id]?.length || 0;
                                    const lookerRecords = Object.keys(lookerData[client.id] || {}).length;
                                    const hashes = processedHashes[client.id]?.length || 0;
                                    
                                    return (
                                        <div key={client.id} className="flex items-center justify-between p-3 bg-brand-surface rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <img src={client.logo} alt={client.name} className="w-8 h-8 rounded-full" />
                                                <div>
                                                    <div className="font-medium text-brand-text">{client.name}</div>
                                                    <div className="text-xs text-brand-text-secondary">Meta: {client.metaAccountName || 'No configurado'}</div>
                                                </div>
                                            </div>
                                            <div className="flex gap-4 text-sm">
                                                <span className="text-green-400">{perfRecords} perf</span>
                                                <span className="text-purple-400">{lookerRecords} ads</span>
                                                <span className="text-orange-400">{hashes} files</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Historial de Importaciones */}
                    <div className="bg-brand-bg/50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-brand-text mb-3">📁 Historial de Importaciones</h3>
                        {importHistory.length === 0 ? (
                            <p className="text-brand-text-secondary">No hay importaciones registradas</p>
                        ) : (
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {importHistory.slice(0, 10).map(batch => (
                                    <div key={batch.id} className="flex items-center justify-between p-2 bg-brand-surface rounded">
                                        <div>
                                            <div className="text-sm font-medium text-brand-text">{batch.fileName}</div>
                                            <div className="text-xs text-brand-text-secondary">
                                                {batch.clientName} - {batch.description}
                                            </div>
                                        </div>
                                        <div className="text-xs text-brand-text-secondary">
                                            {new Date(batch.timestamp).toLocaleDateString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Información del LocalStorage */}
                    <div className="bg-brand-bg/50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-brand-text mb-3">💾 Almacenamiento Local</h3>
                        <div className="space-y-2">
                            {Object.entries(localStorageInfo).map(([key, info]) => (
                                <div key={key} className="flex items-center justify-between p-2 bg-brand-surface rounded">
                                    <div>
                                        <div className="text-sm font-medium text-brand-text">
                                            {key.replace('db_', '')}
                                        </div>
                                        <div className="text-xs text-brand-text-secondary">
                                            {info.error ? info.error : `${info.type} - ${info.length} items`}
                                        </div>
                                    </div>
                                    <div className="text-xs text-brand-text-secondary">
                                        {formatBytes(info.size)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Archivos Procesados */}
                    <div className="bg-brand-bg/50 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-brand-text mb-3">🔐 Archivos Procesados (Hashes)</h3>
                        {Object.keys(processedHashes).length === 0 ? (
                            <p className="text-brand-text-secondary">No hay archivos procesados registrados</p>
                        ) : (
                            <div className="space-y-2">
                                {Object.entries(processedHashes).map(([clientId, hashes]) => {
                                    const client = clients.find(c => c.id === clientId);
                                    return (
                                        <div key={clientId} className="p-2 bg-brand-surface rounded">
                                            <div className="text-sm font-medium text-brand-text mb-1">
                                                {client?.name || 'Cliente desconocido'}
                                            </div>
                                            <div className="text-xs text-brand-text-secondary">
                                                {hashes.length} archivos procesados
                                            </div>
                                            {hashes.length > 0 && (
                                                <div className="mt-1 text-xs text-brand-text-secondary break-all">
                                                    Último: {hashes[hashes.length - 1].substring(0, 16)}...
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Acciones de Limpieza */}
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                        <h3 className="text-lg font-semibold text-red-400 mb-3">⚠️ Acciones de Limpieza</h3>
                        <p className="text-sm text-brand-text-secondary mb-3">
                            Si los datos no se están mostrando correctamente o el almacenamiento está lleno, puedes usar estas acciones:
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={async () => {
                                    if (confirm('¿Migrar a IndexedDB? Esto moverá los datos a un sistema de base de datos más robusto que maneja archivos grandes mejor que localStorage.')) {
                                        try {
                                            const success = await migrateFromLocalStorage();
                                            if (success) {
                                                alert('Migración completada exitosamente. Los datos ahora están en IndexedDB.');
                                                await refreshData();
                                            } else {
                                                alert('Error durante la migración. Ver consola para detalles.');
                                            }
                                        } catch (e) {
                                            console.error('Migration error:', e);
                                            alert('Error durante la migración.');
                                        }
                                    }
                                }}
                                className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded text-sm hover:bg-purple-500/30"
                            >
                                Migrar a IndexedDB
                            </button>
                            <button
                                onClick={async () => {
                                    if (confirm('¿Limpiar datos antiguos? Esto eliminará importaciones e historial viejo para liberar espacio.')) {
                                        try {
                                            await db.clearOldData();
                                            await refreshData();
                                            alert('Datos antiguos limpiados correctamente.');
                                        } catch (e) {
                                            console.error('Error cleaning old data:', e);
                                            alert('Error al limpiar datos antiguos.');
                                        }
                                    }
                                }}
                                className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded text-sm hover:bg-orange-500/30"
                            >
                                Limpiar Datos Antiguos
                            </button>
                            <button
                                onClick={async () => {
                                    if (confirm('¿Limpiar solo el historial de archivos procesados? Esto permitirá reimportar archivos.')) {
                                        try {
                                            await db.saveProcessedHashes({});
                                            await refreshData();
                                            alert('Hashes de archivos limpiados correctamente.');
                                        } catch (e) {
                                            console.error('Error clearing hashes:', e);
                                            alert('Error al limpiar hashes.');
                                        }
                                    }
                                }}
                                className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm hover:bg-yellow-500/30"
                            >
                                Limpiar Hashes
                            </button>
                            <button
                                onClick={async () => {
                                    // Debug: mostrar contenido actual del localStorage
                                    const perfData = localStorage.getItem('db_performance_data');
                                    if (perfData) {
                                        try {
                                            const parsed = JSON.parse(perfData);
                                            console.log('[DEBUG] Performance data in localStorage:', parsed);
                                            const recordCount = Object.values(parsed).flat().length;
                                            alert(`LocalStorage contiene ${recordCount} registros de performance para ${Object.keys(parsed).length} clientes.\n\nVer consola para detalles.`);
                                        } catch (e) {
                                            alert('Error al parsear datos de performance en localStorage');
                                        }
                                    } else {
                                        alert('No hay datos de performance en localStorage');
                                    }
                                }}
                                className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-sm hover:bg-blue-500/30"
                            >
                                Debug Performance Data
                            </button>
                            <button
                                onClick={async () => {
                                    // Test completo del flujo de datos
                                    console.log('=== INICIANDO TEST COMPLETO ===');
                                    
                                    // 1. Verificar localStorage
                                    const localStorageData = localStorage.getItem('db_performance_data');
                                    console.log('1. LocalStorage performance_data:', localStorageData ? JSON.parse(localStorageData) : 'null');
                                    
                                    // 2. Verificar estado actual de la app
                                    const currentRecords = Object.values(performanceData).flat().length;
                                    console.log('2. Estado actual de la app:', {
                                        clientsWithData: Object.keys(performanceData),
                                        totalRecords: currentRecords,
                                        performanceData: performanceData
                                    });
                                    
                                    // 3. Verificar función de carga
                                    try {
                                        const loadedData = await db.getPerformanceData();
                                        const loadedRecords = Object.values(loadedData).flat().length;
                                        console.log('3. Datos cargados desde DB:', {
                                            clientsWithData: Object.keys(loadedData),
                                            totalRecords: loadedRecords,
                                            loadedData: loadedData
                                        });
                                        
                                        // 4. Comparar
                                        const comparison = {
                                            localStorageHasData: !!localStorageData,
                                            appStateHasData: currentRecords > 0,
                                            dbFunctionReturnsData: loadedRecords > 0,
                                            dataMatches: JSON.stringify(performanceData) === JSON.stringify(loadedData)
                                        };
                                        console.log('4. Comparación:', comparison);
                                        
                                        alert(`Test completo ejecutado. Ver consola para detalles.\n\n` +
                                              `Resumen:\n` +
                                              `- LocalStorage: ${comparison.localStorageHasData ? 'SÍ' : 'NO'} tiene datos\n` +
                                              `- App State: ${comparison.appStateHasData ? 'SÍ' : 'NO'} tiene datos\n` +
                                              `- DB Function: ${comparison.dbFunctionReturnsData ? 'SÍ' : 'NO'} retorna datos\n` +
                                              `- Datos coinciden: ${comparison.dataMatches ? 'SÍ' : 'NO'}`);
                                        
                                    } catch (e) {
                                        console.error('Error en test:', e);
                                        alert('Error durante el test. Ver consola.');
                                    }
                                    
                                    console.log('=== FIN TEST COMPLETO ===');
                                }}
                                className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm hover:bg-green-500/30"
                            >
                                Test Completo
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm('¿Recargar la página? Esto reiniciará el estado de la aplicación.')) {
                                        window.location.reload();
                                    }
                                }}
                                className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-sm hover:bg-blue-500/30"
                            >
                                Recargar Página
                            </button>
                            <button
    onClick={async () => {
        // Crear tabla de rendimiento si está OFFLINE
        try {
            if (!dbConnectionStatus.connected) {
                await indexedDb.initialize();
                await indexedDb.savePerformanceData({});
                localStorage.setItem('db_performance_data_storage', 'indexeddb');
                dbConnectionStatus.connected = true;
                Logger.success('Tabla de rendimiento creada y marcada como ONLINE.');
                console.log('[DIAGNOSTICS] Tabla de rendimiento creada y ONLINE.');
                alert('Tabla de rendimiento creada correctamente y ONLINE.');
                await refreshData();
            } else {
                Logger.info('La tabla de rendimiento ya está ONLINE.');
                alert('La tabla de rendimiento ya está ONLINE.');
            }
        } catch (e) {
            Logger.error('Error creando la tabla de rendimiento.', { error: e });
            console.error('[DIAGNOSTICS] Error creando la tabla de rendimiento:', e);
            alert('Error creando la tabla de rendimiento. Ver consola y log.');
        }
    }}
                                className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm hover:bg-green-500/30"
                            >
                                Crear tabla de rendimiento
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
