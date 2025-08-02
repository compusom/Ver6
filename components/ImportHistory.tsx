import React from 'react';
import { ImportBatch, AllLookerData } from '../types';
import { dbTyped } from '../database';
import Logger from '../Logger';

interface ImportHistoryProps {
    history: ImportBatch[];
    setHistory: React.Dispatch<React.SetStateAction<ImportBatch[]>>;
    setLookerData: React.Dispatch<React.SetStateAction<AllLookerData>>;
}

export const ImportHistory: React.FC<ImportHistoryProps> = ({ history, setHistory, setLookerData }) => {
    
    const handleUndo = async (batchId: string) => {
        if (!window.confirm('¿Seguro que quieres deshacer esta importación? Los datos añadidos serán eliminados.')) return;
        
        const batchToUndo = history.find(b => b.id === batchId);
        if (!batchToUndo) return;
        
        Logger.warn(`Undoing import batch: ${batchId}`, batchToUndo);
        
        try {
            const { type, keys, clientId } = batchToUndo.undoData;

            if (type === 'meta') {
                const perfData = await dbTyped.getPerformanceData();
                if (perfData[clientId]) {
                    const keysToUndo = new Set(keys);
                    perfData[clientId] = perfData[clientId].filter(record => !keysToUndo.has(record.uniqueId));
                    await dbTyped.savePerformanceData(perfData);
                }
            } else if (type === 'looker') {
                 const lookerData = await dbTyped.getLookerData();
                 if (lookerData[clientId]) {
                    keys.forEach(adName => {
                        delete lookerData[clientId][adName];
                    });
                    await dbTyped.saveLookerData(lookerData);
                    setLookerData(lookerData); // Update app state
                 }
            } else if (type === 'txt') {
                 let reports = await dbTyped.getBitacoraReports();
                 const keysToUndo = new Set(keys);
                 reports = reports.filter(report => !keysToUndo.has(report.id));
                 await dbTyped.saveBitacoraReports(reports);
            }
            
            const updatedHistory = history.filter(b => b.id !== batchId);
            setHistory(updatedHistory);
            await dbTyped.saveImportHistory(updatedHistory);
            
            Logger.success(`Successfully undone import batch: ${batchId}`);
            alert('Importación deshecha con éxito.');

        } catch (error) {
            Logger.error(`Failed to undo import batch: ${batchId}`, error);
            alert('Ocurrió un error al deshacer la importación.');
        }
    };

    if (history.length === 0) {
        return null;
    }

    return (
        <div className="bg-brand-surface rounded-lg p-6 shadow-lg mt-8">
            <h3 className="text-xl font-bold text-brand-text mb-4">Historial de Importaciones Recientes</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-brand-text-secondary">
                    <thead className="text-xs text-brand-text uppercase bg-brand-border/50">
                        <tr>
                            <th className="px-4 py-2">Fecha</th>
                            <th className="px-4 py-2">Tipo</th>
                            <th className="px-4 py-2">Archivo</th>
                            <th className="px-4 py-2">Cliente</th>
                            <th className="px-4 py-2">Descripción</th>
                            <th className="px-4 py-2">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        {history.map(batch => (
                            <tr key={batch.id} className="bg-brand-bg border-b border-brand-border/50 hover:bg-brand-border/20">
                                <td className="px-4 py-2 whitespace-nowrap">{new Date(batch.timestamp).toLocaleString('es-ES')}</td>
                                <td className="px-4 py-2"><span className="font-semibold uppercase">{batch.source}</span></td>
                                <td className="px-4 py-2 truncate max-w-xs" title={batch.fileName}>{batch.fileName}</td>
                                <td className="px-4 py-2">{batch.clientName}</td>
                                <td className="px-4 py-2">{batch.description}</td>
                                <td className="px-4 py-2">
                                    <button
                                        onClick={() => handleUndo(batch.id)}
                                        className="bg-red-600/20 text-red-400 hover:bg-red-600/40 text-xs font-bold py-1 px-2 rounded-md transition-colors"
                                    >
                                        Deshacer
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
