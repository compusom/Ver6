import React, { useState, useEffect } from 'react';
import { mcpConnector } from '../lib/mcpConnector';

interface MCPConfigViewProps {
    onConfigSaved?: () => void;
}

export const MCPConfigView: React.FC<MCPConfigViewProps> = ({ onConfigSaved }) => {
    const [testUrl, setTestUrl] = useState('');
    const [productionUrl, setProductionUrl] = useState('');
    const [authentication, setAuthentication] = useState('');
    const [path, setPath] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [isTestingSupabase, setIsTestingSupabase] = useState(false);
    const [lastTestResult, setLastTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [lastSupabaseTestResult, setLastSupabaseTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const [showDebugLogs, setShowDebugLogs] = useState(false);

    useEffect(() => {
        // Load existing configuration
        const config = mcpConnector.getConfig();
        if (config) {
            setTestUrl(config.testUrl || '');
            setProductionUrl(config.productionUrl || '');
            setAuthentication(config.authentication || '');
            setPath(config.path || '');
        }
    }, []);

    const handleSaveConfig = () => {
        const config = {
            testUrl: testUrl.trim(),
            productionUrl: productionUrl.trim(),
            authentication: authentication.trim() || undefined,
            path: path.trim() || undefined
        };

        mcpConnector.saveConfig(config);
        onConfigSaved?.();
        alert('Configuración MCP guardada exitosamente');
    };

    const handleTestConnection = async () => {
        if (!testUrl.trim()) {
            alert('Por favor ingresa una URL de test válida');
            return;
        }

        setIsTesting(true);
        setLastTestResult(null);

        try {
            // Save current config temporarily for testing
            const tempConfig = {
                testUrl: testUrl.trim(),
                productionUrl: productionUrl.trim(),
                authentication: authentication.trim() || undefined,
                path: path.trim() || undefined
            };
            mcpConnector.saveConfig(tempConfig);

            const result = await mcpConnector.testConnection();
            setLastTestResult(result);

        } catch (error) {
            setLastTestResult({
                success: false,
                message: `Error de conexión: ${error instanceof Error ? error.message : 'Error desconocido'}`
            });
        } finally {
            setIsTesting(false);
        }
    };

    const handleTestSupabase = async () => {
        setIsTestingSupabase(true);
        setLastSupabaseTestResult(null);
        setDebugLogs([]);

        // Intercept console logs for debugging
        const originalLog = console.log;
        const originalError = console.error;
        const logs: string[] = [];

        const logInterceptor = (...args: any[]) => {
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            if (message.includes('[SUPABASE]')) {
                logs.push(`LOG: ${message}`);
                setDebugLogs(prev => [...prev, `LOG: ${message}`]);
            }
            originalLog(...args);
        };

        const errorInterceptor = (...args: any[]) => {
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' ');
            if (message.includes('[SUPABASE]')) {
                logs.push(`ERROR: ${message}`);
                setDebugLogs(prev => [...prev, `ERROR: ${message}`]);
            }
            originalError(...args);
        };

        console.log = logInterceptor;
        console.error = errorInterceptor;

        try {
            const result = await mcpConnector.testSupabaseConnection();
            setLastSupabaseTestResult(result);
            setShowDebugLogs(true);
        } catch (error) {
            setLastSupabaseTestResult({
                success: false,
                message: `Error de conexión Supabase: ${error instanceof Error ? error.message : 'Error desconocido'}`
            });
        } finally {
            // Restore original console functions
            console.log = originalLog;
            console.error = originalError;
            setIsTestingSupabase(false);
        }
    };

    const isConfigured = testUrl.trim() !== '';

    return (
        <div className="max-w-3xl mx-auto bg-brand-surface rounded-lg p-8 shadow-lg animate-fade-in">
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-brand-text mb-2">
                    Configuración MCP Server
                </h2>
                <p className="text-brand-text-secondary">
                    Configura la conexión al servidor MCP para enviar automáticamente los datos del Excel procesado.
                </p>
            </div>

            <div className="space-y-6">
                {/* Test URL */}
                <div>
                    <label htmlFor="testUrl" className="block text-sm font-medium text-brand-text-secondary mb-2">
                        Test URL *
                    </label>
                    <input
                        id="testUrl"
                        type="url"
                        value={testUrl}
                        onChange={(e) => setTestUrl(e.target.value)}
                        placeholder="https://ads-analists.app.n8n.cloud/mcp-test/..."
                        className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-3 focus:ring-brand-primary focus:border-brand-primary"
                    />
                    <p className="text-xs text-brand-text-secondary mt-1">
                        URL del servidor MCP para testing (obligatorio)
                    </p>
                </div>

                {/* Production URL */}
                <div>
                    <label htmlFor="productionUrl" className="block text-sm font-medium text-brand-text-secondary mb-2">
                        Production URL
                    </label>
                    <input
                        id="productionUrl"
                        type="url"
                        value={productionUrl}
                        onChange={(e) => setProductionUrl(e.target.value)}
                        placeholder="https://ads-analists.app.n8n.cloud/mcp-prod/..."
                        className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-3 focus:ring-brand-primary focus:border-brand-primary"
                    />
                    <p className="text-xs text-brand-text-secondary mt-1">
                        URL del servidor MCP para producción (opcional)
                    </p>
                </div>

                {/* Path */}
                <div>
                    <label htmlFor="path" className="block text-sm font-medium text-brand-text-secondary mb-2">
                        Path Adicional
                    </label>
                    <input
                        id="path"
                        type="text"
                        value={path}
                        onChange={(e) => setPath(e.target.value)}
                        placeholder="13ad145e-0b6b-4263-8c86-7315492e8863"
                        className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-3 focus:ring-brand-primary focus:border-brand-primary"
                    />
                    <p className="text-xs text-brand-text-secondary mt-1">
                        Path adicional que se añadirá a la URL base (opcional)
                    </p>
                </div>

                {/* Authentication */}
                <div>
                    <label htmlFor="authentication" className="block text-sm font-medium text-brand-text-secondary mb-2">
                        Authentication Header
                    </label>
                    <input
                        id="authentication"
                        type="text"
                        value={authentication}
                        onChange={(e) => setAuthentication(e.target.value)}
                        placeholder="Bearer token123... o Basic auth..."
                        className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-3 focus:ring-brand-primary focus:border-brand-primary"
                    />
                    <p className="text-xs text-brand-text-secondary mt-1">
                        Header de autorización completo (ej: "Bearer token123" o "Basic auth...") - opcional
                    </p>
                </div>

                {/* Test Result */}
                {lastTestResult && (
                    <div className={`p-4 rounded-lg border ${
                        lastTestResult.success 
                            ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                    }`}>
                        <div className="flex items-center gap-2">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {lastTestResult.success ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                )}
                            </svg>
                            <span className="font-medium">
                                {lastTestResult.success ? 'Conexión exitosa' : 'Error de conexión'}
                            </span>
                        </div>
                        <p className="text-sm mt-2 opacity-90">{lastTestResult.message}</p>
                    </div>
                )}

                {/* Supabase Test Result */}
                {lastSupabaseTestResult && (
                    <div className={`p-4 rounded-lg border ${
                        lastSupabaseTestResult.success 
                            ? 'bg-green-50 border-green-200 text-green-800' 
                            : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {lastSupabaseTestResult.success ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                )}
                            </svg>
                            <span className="font-medium">
                                {lastSupabaseTestResult.success ? 'Supabase: Conexión exitosa' : 'Supabase: Error de conexión'}
                            </span>
                        </div>
                        <p className="text-sm mt-2 opacity-90">{lastSupabaseTestResult.message}</p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                    <button
                        onClick={handleTestConnection}
                        disabled={isTesting || !testUrl.trim()}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isTesting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Probando...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                </svg>
                                Probar Conexión
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleTestSupabase}
                        disabled={isTestingSupabase}
                        className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isTestingSupabase ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Probando Supabase...
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                                </svg>
                                Test Supabase
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleSaveConfig}
                        className="flex items-center gap-2 px-6 py-3 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg font-medium transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Guardar Configuración
                    </button>

                    {debugLogs.length > 0 && !showDebugLogs && (
                        <button
                            onClick={() => setShowDebugLogs(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors text-sm"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Ver Debug Logs ({debugLogs.length})
                        </button>
                    )}
                </div>

                {/* Debug Logs Section */}
                {showDebugLogs && debugLogs.length > 0 && (
                    <div className="mt-6 p-4 bg-gray-900 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-medium text-white">Debug Logs - Supabase</h4>
                            <button
                                onClick={() => setShowDebugLogs(false)}
                                className="text-gray-400 hover:text-white text-sm"
                            >
                                Ocultar
                            </button>
                        </div>
                        <div className="bg-black rounded p-3 max-h-64 overflow-y-auto">
                            {debugLogs.map((log, index) => (
                                <div key={index} className={`text-xs font-mono mb-1 ${
                                    log.startsWith('ERROR:') ? 'text-red-400' : 'text-green-400'
                                }`}>
                                    {log}
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 text-xs text-gray-400">
                            💡 Estos logs te ayudan a ver exactamente qué está pasando con la conexión a Supabase
                        </div>
                    </div>
                )}

                {/* Status Indicator */}
                <div className="mt-6 p-4 bg-brand-bg rounded-lg">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                            isConfigured 
                                ? (lastTestResult?.success ? 'bg-green-500' : 'bg-yellow-500')
                                : 'bg-red-500'
                        }`}></div>
                        <span className="text-sm font-medium text-brand-text">
                            Estado MCP: {
                                isConfigured 
                                    ? (lastTestResult?.success ? 'Conectado y funcionando' : 'Configurado (pendiente test)')
                                    : 'No configurado'
                            }
                        </span>
                    </div>
                    {isConfigured && (
                        <p className="text-xs text-brand-text-secondary mt-2">
                            Los datos del Excel se enviarán automáticamente al servidor MCP después de cada importación.
                        </p>
                    )}
                </div>

                {/* Info Box */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <h4 className="text-blue-400 font-medium mb-1">¿Qué se envía al MCP?</h4>
                            <ul className="text-sm text-blue-300 space-y-1">
                                <li>• Datos completos del Excel procesado (métricas de rendimiento)</li>
                                <li>• Información del cliente y período analizado</li>
                                <li>• Resumen de métricas (ROAS, gasto total, top ads)</li>
                                <li>• Timestamp y metadata de la importación</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
