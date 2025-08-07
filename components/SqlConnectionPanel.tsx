import React, { useEffect, useState } from 'react';

export const SqlConnectionPanel: React.FC = () => {
    const [server, setServer] = useState('192.168.1.234');
    const [port, setPort] = useState('1433');
    const [database, setDatabase] = useState('MiAppDB');
    const [user, setUser] = useState('MiAppUser');
    const [password, setPassword] = useState('Cataclismoss305020');

    const [connected, setConnected] = useState(false);
    const [permissions, setPermissions] = useState<Record<string, number> | null>(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchJson = async (url: string, options?: RequestInit) => {
        const res = await fetch(url, options);
        const text = await res.text();
        if (!res.ok) {
            throw new Error(text || `HTTP ${res.status}`);
        }
        try {
            return text ? JSON.parse(text) : {};
        } catch {
            throw new Error('Respuesta no válida del backend');
        }
    };

    const checkStatus = async () => {
        try {
            const data = await fetchJson('/api/sql/status');
            setConnected(Boolean(data.connected));
        } catch {
            setConnected(false);
        }
    };

    useEffect(() => {
        checkStatus();

        const id = setInterval(checkStatus, 5000);
        return () => clearInterval(id);

    }, []);

    const handleConnect = async () => {
        setLoading(true);
        setMessage('');
        setPermissions(null);
        try {
            const data = await fetchJson('/api/sql/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    server,
                    port,
                    database,
                    user,
                    password,
                }),
            });
            if (data.success) {
                setMessage('Conexión exitosa');
            } else {
                setMessage(data.error || 'Error al conectar');
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            setMessage(msg === 'Failed to fetch' ? 'No se pudo conectar con el backend' : msg);

        }
        await checkStatus();
        setLoading(false);
    };

    const handleCheckPermissions = async () => {
        setLoading(true);
        setMessage('');
        try {
            const data = await fetchJson('/api/sql/permissions');
            if (data.permissions) {
                setPermissions(data.permissions);
                setMessage('Permisos obtenidos');
            } else {
                setMessage(data.error || 'Error al obtener permisos');
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            setMessage(msg === 'Failed to fetch' ? 'No se pudo conectar con el backend' : msg);
        }
        setLoading(false);
    };

    return (
        <div className="mb-8">
            <h3 className="text-xl font-bold text-brand-text mb-4">Conexión a SQL Server</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <label className="flex flex-col text-sm">
                    <span>Servidor</span>
                    <input className="p-2 rounded bg-brand-bg" value={server} onChange={e => setServer(e.target.value)} />
                </label>
                <label className="flex flex-col text-sm">
                    <span>Puerto</span>
                    <input className="p-2 rounded bg-brand-bg" value={port} onChange={e => setPort(e.target.value)} />
                </label>
                <label className="flex flex-col text-sm">
                    <span>Base de datos</span>
                    <input className="p-2 rounded bg-brand-bg" value={database} onChange={e => setDatabase(e.target.value)} />
                </label>
                <label className="flex flex-col text-sm">
                    <span>Usuario</span>
                    <input className="p-2 rounded bg-brand-bg" value={user} onChange={e => setUser(e.target.value)} />
                </label>
                <label className="flex flex-col text-sm">
                    <span>Contraseña</span>
                    <input
                        type="password"
                        className="p-2 rounded bg-brand-bg"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                </label>
            </div>
            <div className="flex items-center gap-4 mb-4">
                <button
                    onClick={handleConnect}
                    disabled={loading}
                    className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                    Conectar
                </button>
                <div
                    className={`text-sm font-bold px-3 py-1 rounded-full ${
                        connected ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}
                >
                    {connected ? 'ONLINE' : 'OFFLINE'}
                </div>
                <button
                    onClick={handleCheckPermissions}
                    disabled={loading || !connected}
                    className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                    Probar Permisos
                </button>
            </div>
            {message && <p className="text-sm text-brand-text-secondary mb-2">{message}</p>}
            {permissions && (
                <div className="text-sm text-brand-text-secondary">
                    <p>SELECT: {permissions.canSelect ? '✔️' : '❌'}</p>
                    <p>INSERT: {permissions.canInsert ? '✔️' : '❌'}</p>
                    <p>UPDATE: {permissions.canUpdate ? '✔️' : '❌'}</p>
                    <p>DELETE: {permissions.canDelete ? '✔️' : '❌'}</p>
                </div>
            )}
        </div>
    );
};

