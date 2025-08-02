
import React, { useState, useEffect } from 'react';
import { MetaApiConfig } from '../types';
import Logger from '../Logger';

interface SettingsViewProps {
    metaApiConfig: MetaApiConfig | null;
    setMetaApiConfig: React.Dispatch<React.SetStateAction<MetaApiConfig | null>>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ metaApiConfig, setMetaApiConfig }) => {
    const [config, setConfig] = useState<MetaApiConfig>({ appId: '', appSecret: '', accessToken: '' });
    const [testing, setTesting] = useState(false);
    const [lastTestResult, setLastTestResult] = useState<boolean | null>(null);

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
            alert('Configuración guardada con éxito (simulado).');
        } else {
             Logger.error('Meta API connection test failed.');
        }
        setTesting(false);
    };

    const isConnected = !!(metaApiConfig?.appId && metaApiConfig?.appSecret && metaApiConfig?.accessToken);

    return (
        <div className="max-w-2xl mx-auto bg-brand-surface rounded-lg p-8 shadow-lg animate-fade-in">
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
