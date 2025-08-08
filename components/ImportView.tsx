import React, { useState, useRef, useEffect } from 'react';
import { Client, PerformanceRecord, AllLookerData, BitacoraReport, ImportBatch, MetaApiConfig, User, LookerProcessResult, ProcessResult } from '../types';
import { NewClientsModal } from './NewClientsModal';
import db from '../database';
import Logger from '../Logger';
import { parseBitacoraReport } from '../lib/txtReportParser';
import { ClientSelectorModal } from './ClientSelectorModal';
import { ImportHistory } from './ImportHistory';
import { processPerformanceData, processLookerData } from '../lib/dataProcessor';
import { mcpConnector } from '../lib/mcpConnector';

const getFileHash = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

interface ImportViewProps {
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    lookerData: AllLookerData;
    setLookerData: React.Dispatch<React.SetStateAction<AllLookerData>>;
    performanceData: { [key: string]: PerformanceRecord[] };
    setPerformanceData: React.Dispatch<React.SetStateAction<{ [key: string]: PerformanceRecord[] }>>;
    bitacoraReports: BitacoraReport[];
    setBitacoraReports: React.Dispatch<React.SetStateAction<BitacoraReport[]>>;
    onSyncFromMeta: (clientId: string) => Promise<void>;
    metaApiConfig: MetaApiConfig | null;
    currentUser: User;
}

type Feedback = { type: 'info' | 'success' | 'error', message: string };

const ImportCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    onButtonClick: () => void;
    buttonText: string;
    disabled?: boolean;
}> = ({ title, description, icon, onButtonClick, buttonText, disabled }) => (
    <div className="bg-brand-border/30 rounded-lg p-6 flex flex-col items-start justify-between">
        <div>
            <div className="flex items-center gap-4 mb-2">
                <div className="text-brand-primary">{icon}</div>
                <h3 className="text-lg font-bold text-brand-text">{title}</h3>
            </div>
            <p className="text-sm text-brand-text-secondary mb-4">{description}</p>
        </div>
        <button
            onClick={onButtonClick}
            disabled={disabled}
            className="w-full bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {buttonText}
        </button>
    </div>
);


export const ImportView: React.FC<ImportViewProps> = ({ clients, setClients, lookerData, setLookerData, performanceData, setPerformanceData, bitacoraReports, setBitacoraReports, onSyncFromMeta, metaApiConfig, currentUser }) => {
    
    // Validación defensiva para props
    // Modo de importación: Local o SQL
    const [importMode, setImportMode] = useState<'local' | 'sql'>('local');
    const safeClients = Array.isArray(clients) ? clients : [];
    const safeLookerData = lookerData && typeof lookerData === 'object' ? lookerData : {};
    const safePerformanceData = performanceData && typeof performanceData === 'object' ? performanceData : {};
    const safeBitacoraReports = Array.isArray(bitacoraReports) ? bitacoraReports : [];
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    // Helper: verifica y reconecta SQL si es necesario
    const ensureSqlConnected = async () => {
        const backendPort = localStorage.getItem('backend_port') || '3001';
        const statusRes = await fetch(`http://localhost:${backendPort}/api/sql/status`);
        const status = await statusRes.json();
        if (!status.connected) {
            const server = localStorage.getItem('sql_server') || '';
            const port = localStorage.getItem('sql_port') || '';
            const database = localStorage.getItem('sql_database') || '';
            const user = localStorage.getItem('sql_user') || '';
            const password = sessionStorage.getItem('sql_password') || '';
            const connectRes = await fetch(`http://localhost:${backendPort}/api/sql/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ server, port, database, user, password })
            });
            const connectData = await connectRes.json();
            if (!connectData.success) {
                throw new Error(connectData.error || 'No se pudo reconectar a SQL Server');
            }
        }
    };

    // Nueva función para importar a SQL
    const importExcelToSQL = async (file: File) => {
        setIsProcessing(true);
        setFeedback({ type: 'info', message: 'Verificando conexión y enviando archivo a SQL Server...' });
        try {
            const backendPort = localStorage.getItem('backend_port') || '3001';
            await ensureSqlConnected();
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(`http://localhost:${backendPort}/api/sql/import-excel?allowCreateClient=true`, {
                method: 'POST',
                body: formData,
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result?.success === false) {
                throw new Error(result?.error || 'Error al importar a SQL Server.');
            }
            setFeedback({ type: 'success', message: `Importación a SQL exitosa: ${result.message || 'OK'}` });
            await loadSqlHistory();
        } catch (error) {
            setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Error inesperado.' });
        } finally {
            setIsProcessing(false);
        }
    };
    const [isNewClientsModalOpen, setIsNewClientsModalOpen] = useState(false);
    const [isTxtClientSelectorOpen, setIsTxtClientSelectorOpen] = useState(false);
    const [isApiSyncClientSelectorOpen, setIsApiSyncClientSelectorOpen] = useState(false);
    const [newAccountNames, setNewAccountNames] = useState<string[]>([]);
    const [pendingXlsxFile, setPendingXlsxFile] = useState<{ file: File, source: 'looker' | 'meta' } | null>(null);
    const [pendingTxtData, setPendingTxtData] = useState<{ content: string, file: File } | null>(null);
    const [importHistory, setImportHistory] = useState<ImportBatch[]>([]);
    const [sqlImportHistory, setSqlImportHistory] = useState<ImportBatch[]>([]);
    
    const lookerInputRef = useRef<HTMLInputElement>(null);
    const metaInputRef = useRef<HTMLInputElement>(null);
    const txtInputRef = useRef<HTMLInputElement>(null);

    async function loadSqlHistory() {
        try {
            const res = await fetch('/api/sql/import-history');
            const data = await res.json();
            if (data.success && Array.isArray(data.history)) {
                setSqlImportHistory(data.history);
            }
        } catch (err) {
            console.error('Error loading SQL import history:', err);
        }
    }

    useEffect(() => {
        db.getImportHistory().then(history => {
            setImportHistory(history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        });
        loadSqlHistory();
    }, []);

    const addImportToHistory = async (batch: Omit<ImportBatch, 'id' | 'timestamp'>) => {
        const newBatch: ImportBatch = { ...batch, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
        setImportHistory(prev => [newBatch, ...prev]);
        await db.saveImportHistory([newBatch, ...importHistory]);
    };
    
    const processAndSaveFullData = async (file: File, source: 'meta', clientList: Client[]) => {
        const fileHash = await getFileHash(file);
        const processedHashes = await db.getProcessedHashes();

        if (Object.values(processedHashes).flat().includes(fileHash)) {
            throw new Error(`Este archivo (${file.name}) ya ha sido importado previamente.`);
        }

        const results = await processPerformanceData(file, clientList, performanceData, source, false) as ProcessResult[];
        
        setPerformanceData(current => {
            const newData = { ...current };
            results.forEach(({ client, records }) => {
                newData[client.id] = [...(newData[client.id] || []), ...records];
                console.log(`[IMPORT] Added ${records.length} records for client ${client.name} (${client.id})`);
            });
            console.log(`[IMPORT] New performance data structure:`, Object.keys(newData).map(clientId => `${clientId}: ${newData[clientId].length} records`));
            return newData;
        });
        
        const totalNewRecords = results.reduce((acc, res) => acc + res.newRecordsCount, 0);
        if (totalNewRecords === 0) {
            setFeedback({ type: 'info', message: 'Importación completada. No se encontraron filas nuevas.' });
            return;
        }

        // Send data to MCP server for each processed result
        for (const result of results) {
            if (result.newRecordsCount > 0) {
                try {
                    console.log(`[MCP] Attempting to send data for client: ${result.client.name}`);
                    const mcpSuccess = await mcpConnector.sendExcelData(result);
                    if (mcpSuccess) {
                        console.log(`[MCP] Successfully sent data to MCP for client: ${result.client.name}`);
                        Logger.success(`Datos enviados al servidor MCP para cliente: ${result.client.name}`);
                    } else {
                        console.warn(`[MCP] Failed to send data to MCP for client: ${result.client.name}`);
                    }
                } catch (error) {
                    console.error(`[MCP] Error sending data to MCP for client ${result.client.name}:`, error);
                    // Don't fail the entire import if MCP fails, just log it
                }
            }
        }

        // Aggregate feedback from all results
        const clientNames = results.map(r => r.client.name).join(', ');
        const periodStarts = results.map(r => r.periodStart).filter(Boolean);
        const periodEnds = results.map(r => r.periodEnd).filter(Boolean);
        const daysDetected = results.reduce((sum, r) => sum + (r.daysDetected || 0), 0);
        
        const minDate = periodStarts.length > 0 ? new Date(Math.min(...periodStarts.map(d => new Date(d!).getTime()))) : null;
        const maxDate = periodEnds.length > 0 ? new Date(Math.max(...periodEnds.map(d => new Date(d!).getTime()))) : null;

        let periodMessage = '';
        if (minDate && maxDate) {
            periodMessage = ` Período detectado: ${minDate.toLocaleDateString('es-ES')} - ${maxDate.toLocaleDateString('es-ES')} (${daysDetected} días).`
        }

        setFeedback({ 
            type: 'success', 
            message: `Importación completada. ${totalNewRecords} nuevas filas añadidas para: ${clientNames}.${periodMessage} ${mcpConnector.getConfig() ? '✅ Datos enviados al MCP' : '⚠️ MCP no configurado'}` 
        });

        const newHashes = { ...processedHashes };
        for (const result of results) {
            if (result.newRecordsCount > 0) {
                await addImportToHistory({
                    source,
                    fileName: file.name,
                    fileHash,
                    clientName: result.client.name,
                    description: `${result.newRecordsCount} filas de rendimiento añadidas`,
                    undoData: { type: 'meta', keys: [result.client.id], clientId: result.client.id }
                });
                newHashes[result.client.id] = [...(newHashes[result.client.id] || []), fileHash];
            }
        }
        await db.saveProcessedHashes(newHashes);
    };

    const processAndSaveLookerData = async (file: File, clientList: Client[]) => {
        const fileHash = await getFileHash(file);
        const processedHashes = await db.getProcessedHashes();
    
        if (Object.values(processedHashes).flat().includes(fileHash)) {
            throw new Error(`Este archivo (${file.name}) ya ha sido importado previamente.`);
        }
    
        const results = await processLookerData(file, clientList, lookerData, false) as LookerProcessResult[];
    
        setLookerData(current => {
            const newData = JSON.parse(JSON.stringify(current));
            results.forEach(({ client, lookerDataPatch }) => {
                if (!newData[client.id]) {
                    newData[client.id] = {};
                }
                Object.assign(newData[client.id], lookerDataPatch);
            });
            return newData;
        });
    
        const totalNewRecords = results.reduce((acc, res) => acc + res.newRecordsCount, 0);
        if (totalNewRecords === 0) {
            setFeedback({ type: 'info', message: 'Importación de Looker completada. No se encontraron creativos nuevos.' });
            return;
        }
    
        const clientNames = results.map(r => r.client.name).join(', ');
        setFeedback({ type: 'success', message: `Importación de Looker completada. ${totalNewRecords} nuevos creativos vinculados para: ${clientNames}.` });
    
        const newHashes = { ...processedHashes };
        for (const result of results) {
            if (result.newRecordsCount > 0) {
                await addImportToHistory({
                    source: 'looker',
                    fileName: file.name,
                    fileHash,
                    clientName: result.client.name,
                    description: `${result.newRecordsCount} creativos vinculados`,
                    undoData: { type: 'looker', keys: result.undoKeys, clientId: result.client.id }
                });
                newHashes[result.client.id] = [...(newHashes[result.client.id] || []), fileHash];
            }
        }
        await db.saveProcessedHashes(newHashes);
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, source: 'looker' | 'meta' | 'txt') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (source === 'txt') {
            handleTxtFileUpload(file);
        } else {
            handleXlsxFileUpload(file, source);
        }
        
        e.target.value = '';
    };

    const handleXlsxFileUpload = async (file: File, source: 'looker' | 'meta') => {
        setIsProcessing(true);
        setFeedback({ type: 'info', message: `Procesando reporte de ${source}...` });
        try {
            if (source === 'looker') {
                const checkResult = await processLookerData(file, safeClients, safeLookerData, true);
                if ('newAccountNames' in checkResult && checkResult.newAccountNames.length > 0) {
                    setNewAccountNames(checkResult.newAccountNames);
                    setPendingXlsxFile({ file, source });
                    setIsNewClientsModalOpen(true);
                } else {
                    await processAndSaveLookerData(file, safeClients);
                }
            } else {
                if (importMode === 'sql') {
                    await importExcelToSQL(file);
                } else {
                    const checkResult = await processPerformanceData(file, safeClients, safePerformanceData, source, true);
                    if ('newAccountNames' in checkResult && checkResult.newAccountNames.length > 0) {
                        setNewAccountNames(checkResult.newAccountNames);
                        setPendingXlsxFile({ file, source });
                        setIsNewClientsModalOpen(true);
                    } else {
                        await processAndSaveFullData(file, source, safeClients);
                    }
                }
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Error inesperado.";
            setFeedback({ type: 'error', message });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleTxtFileUpload = async (file: File) => {
        try {
            const content = await file.text();
            setPendingTxtData({ content, file });
            setIsTxtClientSelectorOpen(true);
        } catch(error) {
            setFeedback({ type: 'error', message: `Error al leer el archivo TXT.` });
        }
    };
    
    const processTxtReport = async (clientId: string) => {
        if (!pendingTxtData) return;
        setIsTxtClientSelectorOpen(false);
        setIsProcessing(true);
        setFeedback({ type: 'info', message: 'Analizando y guardando reporte Bitácora...' });
        
        try {
            const client = safeClients.find(c => c.id === clientId);
            if (!client) throw new Error("Cliente no encontrado");

            const fileHash = await getFileHash(pendingTxtData.file);
            const processedHashes = await db.getProcessedHashes();
            if(processedHashes[clientId]?.includes(fileHash)) {
                throw new Error(`Este archivo (${pendingTxtData.file.name}) ya ha sido importado para este cliente.`);
            }

            const parsedReport = parseBitacoraReport(pendingTxtData.content);
            const reportId = crypto.randomUUID();
            const finalReport: BitacoraReport = { ...parsedReport, id: reportId, clientId, fileName: pendingTxtData.file.name, importDate: new Date().toISOString() };
            
            setBitacoraReports([...bitacoraReports, finalReport]);
            
            setFeedback({ type: 'success', message: `Reporte "${pendingTxtData.file.name}" importado con éxito.` });

            await addImportToHistory({ source: 'txt', fileName: pendingTxtData.file.name, fileHash, clientName: client.name, description: 'Reporte de bitácora añadido', undoData: { type: 'txt', keys: [reportId], clientId: clientId } });
            
            const updatedHashes = { ...processedHashes };
            updatedHashes[clientId] = [...(updatedHashes[clientId] || []), fileHash];
            await db.saveProcessedHashes(updatedHashes);

        } catch(error) {
            const message = error instanceof Error ? error.message : "Error desconocido.";
            setFeedback({ type: 'error', message: `Error al procesar el reporte TXT: ${message}` });
        } finally {
            setIsProcessing(false);
            setPendingTxtData(null);
        }
    };

    const handleCreateNewClients = async (accountsToCreate: string[]) => {
        const newClients: Client[] = accountsToCreate.map(accountName => ({
            id: crypto.randomUUID(),
            name: accountName,
            logo: `https://avatar.vercel.sh/${encodeURIComponent(accountName)}.png?text=${encodeURIComponent(accountName.charAt(0))}`,
            currency: 'EUR', // Default currency
            userId: currentUser.id,
            metaAccountName: accountName,
        }));
        
        const updatedClients = [...safeClients, ...newClients];
        setClients(updatedClients);
        setIsNewClientsModalOpen(false);
        Logger.info(`Created ${newClients.length} new clients from import.`);
        
        if (pendingXlsxFile) {
            try {
                if (pendingXlsxFile.source === 'looker') {
                    await processAndSaveLookerData(pendingXlsxFile.file, updatedClients);
                } else {
                    await processAndSaveFullData(pendingXlsxFile.file, pendingXlsxFile.source, updatedClients);
                }
            } catch(e) {
                const message = e instanceof Error ? e.message : "Error inesperado.";
                setFeedback({ type: 'error', message });
            } finally {
                setPendingXlsxFile(null);
            }
        }
    };
    
    const triggerFileUpload = (ref: React.RefObject<HTMLInputElement>) => ref.current?.click();

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="bg-brand-surface rounded-lg p-6 shadow-lg space-y-6">
                <h2 className="text-2xl font-bold text-brand-text">Centro de Importación de Datos</h2>
                {/* Switch Local/SQL mejorado */}
                <div className="flex items-center gap-4 mb-4">
                    <span className="font-semibold text-brand-text">Modo de importación:</span>
                    <div className="flex items-center bg-brand-border/30 rounded-lg px-2 py-1">
                        <button
                            type="button"
                            className={`px-4 py-1 rounded-l-lg font-semibold focus:outline-none transition-colors ${importMode === 'local' ? 'bg-blue-600 text-white' : 'bg-transparent text-brand-text'}`}
                            onClick={() => setImportMode('local')}
                            disabled={importMode === 'local'}
                        >
                            Local
                        </button>
                        <button
                            type="button"
                            className={`px-4 py-1 rounded-r-lg font-semibold focus:outline-none transition-colors ${importMode === 'sql' ? 'bg-blue-600 text-white' : 'bg-transparent text-brand-text'}`}
                            onClick={() => setImportMode('sql')}
                            disabled={importMode === 'sql'}
                        >
                            SQL
                        </button>
                    </div>
                    <span className="ml-2 text-xs text-brand-text-secondary">{importMode === 'local' ? 'Local (almacenamiento en navegador)' : 'SQL (envía datos al servidor SQL)'}</span>
                </div>
                {feedback && (
                    <div className={`p-4 rounded-md text-sm font-semibold ${feedback.type === 'success' ? 'bg-green-500/20 text-green-300' : feedback.type === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'}`}>
                        {feedback.message}
                    </div>
                )}
                <input type="file" ref={lookerInputRef} onChange={(e) => handleFileChange(e, 'looker')} accept=".xlsx" className="hidden" />
                <input type="file" ref={metaInputRef} onChange={(e) => handleFileChange(e, 'meta')} accept=".xlsx" className="hidden" />
                <input type="file" ref={txtInputRef} onChange={(e) => handleFileChange(e, 'txt')} accept=".txt" className="hidden" />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <ImportCard
                        title="Rendimiento (Meta)"
                        description={importMode === 'local' ? "Sube el XLSX exportado desde Meta Ads para importar los datos de rendimiento de las campañas." : "Sube el XLSX exportado desde Meta Ads para enviar los datos directamente al servidor SQL."}
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path d="M5 11a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" /><path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm2 5a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm-1 5a1 1 0 00-1 1v2a1 1 0 001 1h12a1 1 0 001-1v-2a1 1 0 00-1-1H4z" clipRule="evenodd" /></svg>}
                        onButtonClick={() => triggerFileUpload(metaInputRef)}
                        buttonText={importMode === 'local' ? "Subir XLSX de Meta" : "Enviar XLSX a SQL"}
                        disabled={isProcessing}
                    />
                    <ImportCard
                        title="Creativos (Looker)"
                        description="Sube el XLSX de Looker Studio con los nombres de anuncios y las URLs de los creativos para vincularlos."
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>}
                        onButtonClick={() => triggerFileUpload(lookerInputRef)}
                        buttonText="Subir XLSX de Looker"
                        disabled={isProcessing}
                    />
                    <ImportCard
                        title="Reporte Bitácora (TXT)"
                        description="Sube un reporte de bitácora en formato TXT para un análisis semanal o mensual detallado."
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>}
                        onButtonClick={() => triggerFileUpload(txtInputRef)}
                        buttonText="Subir TXT de Bitácora"
                        disabled={isProcessing}
                    />
                </div>
                <div className="border-t border-brand-border pt-6">
                    <h3 className="text-lg font-semibold text-brand-text mb-2">Sincronización API</h3>
                    <p className="text-sm text-brand-text-secondary mb-4">Sincroniza datos directamente desde la API de Meta para los clientes que tengan un "Nombre de Cuenta de Meta" configurado.</p>
                    <button
                        onClick={() => setIsApiSyncClientSelectorOpen(true)}
                        disabled={!metaApiConfig}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title={!metaApiConfig ? 'Configura la API de Meta en la pestaña de Configuración' : 'Sincronizar cliente'}
                    >
                        Sincronizar desde Meta API
                    </button>
                </div>
            </div>

            <NewClientsModal isOpen={isNewClientsModalOpen} onClose={() => setIsNewClientsModalOpen(false)} newAccountNames={newAccountNames} onConfirm={handleCreateNewClients} />
            <ClientSelectorModal isOpen={isTxtClientSelectorOpen} onClose={() => setIsTxtClientSelectorOpen(false)} clients={safeClients} onClientSelect={processTxtReport} title="Seleccionar Cliente para Reporte TXT" description="Elige a qué cliente pertenece este reporte de Bitácora."/>
            <ClientSelectorModal isOpen={isApiSyncClientSelectorOpen} onClose={() => setIsApiSyncClientSelectorOpen(false)} clients={safeClients.filter(c => c.metaAccountName)} onClientSelect={onSyncFromMeta} title="Seleccionar Cliente para Sincronizar" description="Elige qué cliente quieres sincronizar desde la API de Meta."/>
            <ImportHistory title="Historial de Importaciones Local" history={importHistory} setHistory={setImportHistory} setLookerData={setLookerData} />
            <ImportHistory title="Historial de Importaciones SQL" history={sqlImportHistory} setHistory={setSqlImportHistory} setLookerData={setLookerData} allowUndo={false} />
        </div>
    );
};
