
import React, { useState, useEffect } from 'react';
import { notify } from './notificationService';
import { MetaApiConfig } from '../types';
import Logger from '../Logger';
import { MCPConfigView } from './MCPConfigView';
import { dimensionalManager, DimensionalStatus } from '../database/dimensional_manager';

interface SettingsViewProps {
    metaApiConfig: MetaApiConfig | null;
    setMetaApiConfig: React.Dispatch<React.SetStateAction<MetaApiConfig | null>>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ metaApiConfig, setMetaApiConfig }) => {
    const [config, setConfig] = useState<MetaApiConfig>({ appId: '', appSecret: '', accessToken: '' });
    const [testing, setTesting] = useState(false);
    const [lastTestResult, setLastTestResult] = useState<boolean | null>(null);
    const [activeTab, setActiveTab] = useState<'meta' | 'mcp' | 'dimensional'>('meta');
    const [dimensionalStatus, setDimensionalStatus] = useState<DimensionalStatus>(DimensionalStatus.NOT_INITIALIZED);

    useEffect(() => {
        if (metaApiConfig) {
            setConfig(metaApiConfig);
            setLastTestResult(true);
        }
        
        // Check dimensional status
        const checkDimensional = async () => {
            try {
                await dimensionalManager.initialize();
                setDimensionalStatus(dimensionalManager.getStatus());
            } catch (error) {
                Logger.error('Failed to check dimensional status:', error);
            }
        };
        
        checkDimensional();
    }, [metaApiConfig]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleTest = async () => {
        setTesting(true);
        Logger.info('Simulating Meta API connection test...');
        await new Promise(res => setTimeout(res, 1000));
        
        const success = !!(config.appId && config.appSecret && config.accessToken);
        setLastTestResult(success);
        
        if (success) {
            setMetaApiConfig(config);
            Logger.success('Meta API configuration saved.');
            notify('Configuración guardada con éxito (simulado).', 'success');
        } else {
             Logger.error('Meta API connection test failed.');
        }
        setTesting(false);
    };

    const isConnected = !!(metaApiConfig?.appId && metaApiConfig?.appSecret && metaApiConfig?.accessToken);

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            {/* Tab Navigation */}
            <div className="bg-brand-surface rounded-lg p-2 shadow-lg">
                <div className="flex space-x-1">
                    <button
                        onClick={() => setActiveTab('meta')}
                        className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-colors ${
                            activeTab === 'meta'
                                ? 'bg-brand-primary text-white shadow-md'
                                : 'text-brand-text-secondary hover:text-brand-text hover:bg-brand-bg/50'
                        }`}
                    >
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                            </svg>
                            API de Meta
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('mcp')}
                        className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-colors ${
                            activeTab === 'mcp'
                                ? 'bg-brand-primary text-white shadow-md'
                                : 'text-brand-text-secondary hover:text-brand-text hover:bg-brand-bg/50'
                        }`}
                    >
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12l4-4m-4 4l4 4" />
                            </svg>
                            Servidor MCP
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('dimensional')}
                        className={`flex-1 py-3 px-4 text-sm font-medium rounded-lg transition-colors ${
                            activeTab === 'dimensional'
                                ? 'bg-brand-primary text-white shadow-md'
                                : 'text-brand-text-secondary hover:text-brand-text hover:bg-brand-bg/50'
                        }`}
                    >
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            Data Warehouse
                            {dimensionalStatus === DimensionalStatus.READY && (
                                <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                            )}
                        </span>
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'meta' && (
                <div className="bg-brand-surface rounded-lg p-8 shadow-lg">
                    <h2 className="text-2xl font-bold text-brand-text mb-6">Conexión API de Meta</h2>
                    <p className="text-brand-text-secondary mb-6">
                        Introduce las credenciales de tu aplicación de Meta para automatizar la importación de datos. La conexión se realiza a través de un backend seguro (actualmente simulado).
                        <br/>
                        <strong>Estado:</strong> 
                        <span className={`ml-2 font-bold ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
                            {isConnected ? 'Configurado' : 'No Configurado'}
                        </span>
                    </p>
                    <div className="space-y-4">
                        <InputField label="App ID" name="appId" value={config.appId} onChange={handleChange} />
                        <InputField label="App Secret" name="appSecret" value={config.appSecret} onChange={handleChange} type="password" />
                        <InputField label="Access Token" name="accessToken" value={config.accessToken} onChange={handleChange} type="password" />
                    </div>
                    <div className="mt-8 flex items-center justify-between">
                        <button
                            onClick={handleTest}
                            disabled={testing}
                            className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {testing ? 'Probando...' : 'Guardar Conexión'}
                        </button>
                        {lastTestResult !== null && !testing && (
                            <div className={`text-sm font-semibold px-4 py-2 rounded-md ${lastTestResult ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                {lastTestResult ? 'Conexión Exitosa' : 'Falló la Conexión'}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'mcp' && (
                <MCPConfigView />
            )}

            {activeTab === 'dimensional' && (
                <div className="bg-brand-surface rounded-lg p-8 shadow-lg">
                    <h2 className="text-2xl font-bold text-brand-text mb-6">Sistema Dimensional (Data Warehouse)</h2>
                    <p className="text-brand-text-secondary mb-6">
                        El sistema dimensional proporciona un modelo de datos optimizado para análisis avanzados de Meta Ads.
                        Incluye dimensiones SCD Tipo 2, métricas calculadas y vistas de compatibilidad.
                        <br/><br/>
                        <strong>Estado actual:</strong> 
                        <span className={`ml-2 font-bold ${
                            dimensionalStatus === DimensionalStatus.READY ? 'text-green-400' : 
                            dimensionalStatus === DimensionalStatus.ERROR ? 'text-red-400' : 
                            'text-yellow-400'
                        }`}>
                            {dimensionalStatus.replace('_', ' ').toUpperCase()}
                        </span>
                    </p>
                    
                    <div className="space-y-6">
                        <div className="bg-brand-bg p-4 rounded-lg">
                            <h3 className="text-lg font-bold text-brand-text mb-3">Características del Sistema</h3>
                            <ul className="space-y-2 text-sm text-brand-text-secondary">
                                <li className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <strong>Modelo Dimensional Star Schema:</strong> Optimizado para consultas analíticas rápidas
                                </li>
                                <li className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <strong>SCD Tipo 2:</strong> Seguimiento histórico de cambios en campañas, adsets y anuncios
                                </li>
                                <li className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <strong>ETL Automático:</strong> Procesamiento de archivos Excel de Meta con validación de datos
                                </li>
                                <li className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <strong>Compatibilidad:</strong> Vistas que mantienen la API existente para una transición fluida
                                </li>
                                <li className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <strong>Métricas Avanzadas:</strong> KPIs calculados automáticamente (ROAS, CPA, CTR, etc.)
                                </li>
                            </ul>
                        </div>
                        
                        <div className="bg-brand-bg p-4 rounded-lg">
                            <h3 className="text-lg font-bold text-brand-text mb-3">Gestión del Sistema</h3>
                            <p className="text-sm text-brand-text-secondary mb-4">
                                Para crear, eliminar o gestionar las tablas dimensionales, utiliza el Panel de Control.
                                El sistema dimensional requiere ser activado desde allí antes de poder utilizarse.
                            </p>
                            <div className="flex items-center gap-2 text-blue-400 text-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Ve al Panel de Control para activar o configurar el sistema dimensional
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const InputField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string }> = ({ label, name, value, onChange, type = 'text' }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-brand-text-secondary mb-1">{label}</label>
        <input
            type={type}
            name={name}
            id={name}
            value={value}
            onChange={onChange}
            className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-2 focus:ring-brand-primary focus:border-brand-primary transition-colors"
            autoComplete={type === 'password' ? 'current-password' : 'off'}
        />
    </div>
);
