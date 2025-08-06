import React, { useEffect, useState } from 'react';

export const SqlConnectionPanel: React.FC = () => {
    const [server, setServer] = useState('192.168.1.234');
    const [port, setPort] = useState('1433');
    const [database, setDatabase] = useState('MiAppDB');
    const [user, setUser] = useState('MiAppUser');
    const [password, setPassword] = useState('Cataclismoss305020');
    const [encrypt, setEncrypt] = useState(false);
    const [trustServerCertificate, setTrustServerCertificate] = useState(true);

    const [connected, setConnected] = useState(false);
    const [permissions, setPermissions] = useState<Record<string, number> | null>(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const checkStatus = async () => {
        try {
            const res = await fetch('/api/sql/status');
            const data = await res.json();
            setConnected(data.connected);
        } catch (error) {
            setConnected(false);
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleConnect = async () => {
        setLoading(true);
        setMessage('');
        setPermissions(null);
        try {
            const res = await fetch('/api/sql/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    server,
                    port,
                    database,
                    user,
                    password,
                    options: { encrypt, trustServerCertificate },
                }),
            });
            const data = await res.json();
            if (data.success) {
                setMessage('Conexión exitosa');
            } else {
                setMessage(data.error || 'Error al conectar');
            }
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
        }
        await checkStatus();
        setLoading(false);
    };

    const handleCheckPermissions = async () => {
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch('/api/sql/permissions');
            const data = await res.json();
            if (data.permissions) {
                setPermissions(data.permissions);
                setMessage('Permisos obtenidos');
            } else {
                setMessage(data.error || 'Error al obtener permisos');
            }
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error));
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
                    <input type="password" className="p-2 rounded bg-brand-bg" value={password} onChange={e => setPassword(e.target.value)} />
                </label>
                <div className="flex items-center gap-2">
                    <input type="checkbox" checked={encrypt} onChange={e => setEncrypt(e.target.checked)} />
                    <span className="text-sm">Encrypt</span>
                </div>
                <div className="flex items-center gap-2">
                    <input type="checkbox" checked={trustServerCertificate} onChange={e => setTrustServerCertificate(e.target.checked)} />
                    <span className="text-sm">Trust Server Certificate</span>
                </div>
            </div>
            <div className="flex items-center gap-4 mb-4">
                <button onClick={handleConnect} disabled={loading} className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50">
                    Conectar
                </button>
                <div className={`text-sm font-bold px-3 py-1 rounded-full ${connected ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {connected ? 'ONLINE' : 'OFFLINE'}
                </div>
                <button onClick={handleCheckPermissions} disabled={loading || !connected} className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50">
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
