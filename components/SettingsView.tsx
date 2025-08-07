
import React, { useState, useEffect } from 'react';
import { notify } from './notificationService';
import { MetaApiConfig } from '../types';
import Logger from '../Logger';
import { MCPConfigView } from './MCPConfigView';

interface SettingsViewProps {
    metaApiConfig: MetaApiConfig | null;
    setMetaApiConfig: React.Dispatch<React.SetStateAction<MetaApiConfig | null>>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ metaApiConfig, setMetaApiConfig }) => {
    const [config, setConfig] = useState<MetaApiConfig>({ appId: '', appSecret: '', accessToken: '' });
    const [testing, setTesting] = useState(false);
    const [lastTestResult, setLastTestResult] = useState<boolean | null>(null);
    const [activeTab, setActiveTab] = useState<'meta' | 'mcp'>('meta');

    useEffect(() => {
        if (metaApiConfig) {
            setConfig(metaApiConfig);
            setLastTestResult(true);
        }
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
