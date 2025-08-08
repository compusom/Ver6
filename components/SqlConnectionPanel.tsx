import React, { useEffect, useState } from 'react';
import Logger from '../Logger';

export const SqlConnectionPanel: React.FC = () => {
    const [tables, setTables] = useState<string[]>([]);
    const [tablesLoading, setTablesLoading] = useState(false);
    const [tableOpsLoading, setTableOpsLoading] = useState(false);

    const fetchTables = async () => {
        setTablesLoading(true);
        setMessage('');
        // Verificar estado real de la conexión antes de consultar tablas
        try {
            const status = await fetchJson('/api/sql/status');
            if (!status.connected) {
                setMessage('No hay conexión activa con SQL Server. Conéctate primero.');
                setTablesLoading(false);
                return;
            }
            const data = await fetchJson('/api/sql/tables');
            if (Array.isArray(data.tables)) {
                setTables(data.tables);
                setMessage('Tablas obtenidas correctamente');
            } else if (data.error) {
                setMessage(data.error);
            } else {
                setMessage('Error al obtener tablas');
            }
        } catch (error) {
            // Si el backend responde con HTML, mostrar mensaje claro
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes('Cannot GET') || msg.includes('Cannot POST')) {
                setMessage('El backend no responde correctamente al endpoint de tablas SQL. Verifica la conexión y el backend.');
            } else {
                setMessage(msg === 'Failed to fetch' ? 'No se pudo conectar con el backend' : msg);
            }
        }
        setTablesLoading(false);
    };
    // Las credenciales deben ingresarse en tiempo de ejecución por el usuario
    const [server, setServer] = useState(() => localStorage.getItem('sql_server') || '');
    const [port, setPort] = useState(() => localStorage.getItem('sql_port') || '');
    const [database, setDatabase] = useState(() => localStorage.getItem('sql_database') || '');
    const [user, setUser] = useState(() => localStorage.getItem('sql_user') || '');
    const [password, setPassword] = useState('');

    const [connected, setConnected] = useState(false);
    const [permissions, setPermissions] = useState<Record<string, number> | null>(null);
    const [message, setMessage] = useState('');
    const [connectionAlert, setConnectionAlert] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchJson = async (url: string, options?: RequestInit) => {
        // Obtener el puerto backend desde localStorage (o default 3001)
        const backendPort = localStorage.getItem('backend_port') || '3001';
        // Si la URL comienza con /api, redirigir al backend dinámico
        let fullUrl = url;
        if (url.startsWith('/api')) {
            fullUrl = `http://localhost:${backendPort}${url}`;
        }
        const res = await fetch(fullUrl, options);
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

        // Guardar las últimas credenciales (excepto contraseña) en localStorage
        localStorage.setItem('sql_server', server);
        localStorage.setItem('sql_port', port);
        localStorage.setItem('sql_database', database);
        localStorage.setItem('sql_user', user);

        // Intervalo para verificar y reconectar si se pierde la conexión
        const id = setInterval(async () => {
            const status = await fetchJson('/api/sql/status');
            if (!status.connected) {
                setConnectionAlert(true);
                // Intentar reconectar automáticamente usando las últimas credenciales
                const savedPassword = sessionStorage.getItem('sql_password') || password;
                await fetchJson('/api/sql/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        server: localStorage.getItem('sql_server') || server,
                        port: localStorage.getItem('sql_port') || port,
                        database: localStorage.getItem('sql_database') || database,
                        user: localStorage.getItem('sql_user') || user,
                        password: savedPassword,
                    }),
                });
                await checkStatus();
            } else {
                setConnectionAlert(false);
            }
        }, 5000);
        return () => clearInterval(id);
    }, [server, port, database, user, password]);

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
            // Guardar credenciales (password en sessionStorage)
            localStorage.setItem('sql_server', server);
            localStorage.setItem('sql_port', port);
            localStorage.setItem('sql_database', database);
            localStorage.setItem('sql_user', user);
            sessionStorage.setItem('sql_password', password);
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

    // --- Table management actions ---
    const handleEnsureSchema = async () => {
        setTableOpsLoading(true);
        setMessage('');
        Logger.info('[SQL][EnsureSchema] start');
        try {
            const data = await fetchJson('/api/sql/ensure-schema', { method: 'POST' });
            if (data.ok) {
                setMessage('Esquema verificado');
            } else if (data.error) {
                setMessage(data.error);
            } else {
                setMessage('Error al asegurar esquema');
            }
            await fetchTables();
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (msg.includes('Cannot POST') || msg.includes('Cannot GET')) {
                setMessage('El backend no responde correctamente al endpoint de asegurar esquema');
            } else {
                setMessage(msg === 'Failed to fetch' ? 'No se pudo conectar con el backend' : msg);
            }
        }
        Logger.info('[SQL][EnsureSchema] end');
        setTableOpsLoading(false);
    };

    const handleDropTables = async () => {
        if (!window.confirm('¿Seguro que deseas eliminar TODAS las tablas? Esta acción no se puede deshacer.')) return;
        setTableOpsLoading(true);
        setMessage('');
        try {
            await fetchJson('/api/sql/tables', { method: 'DELETE' });
            setMessage('Tablas eliminadas');
            setTables([]);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            setMessage(msg === 'Failed to fetch' ? 'No se pudo conectar con el backend' : msg);
        }
        setTableOpsLoading(false);
    };

    const handleClearTables = async () => {
        if (!window.confirm('¿Deseas borrar todos los datos de las tablas?')) return;
        setTableOpsLoading(true);
        setMessage('');
        try {
            await fetchJson('/api/sql/tables/data', { method: 'DELETE' });
            setMessage('Datos borrados de todas las tablas');
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            setMessage(msg === 'Failed to fetch' ? 'No se pudo conectar con el backend' : msg);
        }
        setTableOpsLoading(false);
    };

    // --- Diagnostics ---
    const [diagnostics, setDiagnostics] = useState<any | null>(null);
    const [diagLoading, setDiagLoading] = useState(false);
    const runDiagnostics = async () => {
        setDiagLoading(true);
        setMessage('');
        Logger.info('[SQL][Diagnostics] start');
        try {
            const data = await fetchJson('/api/sql/diagnostics');
            setDiagnostics(data);
            Logger.info('[SQL][Diagnostics] end');
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            setMessage(msg === 'Failed to fetch' ? 'No se pudo conectar con el backend' : msg);
            Logger.error('[SQL][Diagnostics] error', msg);
        }
        setDiagLoading(false);
    };

    const optionalIndexes = ['IX_ads_client_adname'];
    const hasIssues = diagnostics && diagnostics.schemaChecks && diagnostics.schemaChecks.some((sc: any) => {
        const cols = Object.values(sc.columns || {}).some((v: boolean) => !v);
        const idx = Object.entries(sc.indexes || {}).some(([name, v]) => !v && !optionalIndexes.includes(name));
        const fk = sc.fk && !String(sc.fk).includes(':ok');
        return !sc.exists || cols || idx || fk;
    });

    const renderStatus = (ok: boolean, optional = false) => {
        if (ok) return '✅';
        return optional ? '⚠️' : '❌';
    };

    const fixNow = async () => {
        await handleEnsureSchema();
        await runDiagnostics();
    };

    return (
        <div className="mb-8">
            {connectionAlert && (
                <div className="mb-4 p-3 rounded bg-red-500/20 text-red-400 font-bold">
                    ¡La conexión con SQL Server se perdió! Reconectando automáticamente...
                </div>
            )}
            <h3 className="text-xl font-bold text-brand-text mb-4">Conexión a SQL Server</h3>
            {/* Testigo de conexión al SQL Server */}
            <div className="mb-2 flex items-center gap-2">
                <span className="font-semibold">Estado SQL Server:</span>
                <span
                    className={`text-sm font-bold px-3 py-1 rounded-full ${
                        connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}
                >
                    {connected ? 'Conectado' : 'No conectado'}
                </span>
            </div>
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
                <button
                    onClick={handleCheckPermissions}
                    disabled={loading || !connected}
                    className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                    Probar Permisos
                </button>
            </div>
            {/* Botón y listado de tablas SQL debajo del panel de conexión */}
            <div className="mb-4 space-y-4">
                <button
                    onClick={fetchTables}
                    disabled={!connected || tablesLoading}
                    className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50 w-full sm:w-auto"
                >
                    {tablesLoading ? 'Consultando tablas...' : 'Refrescar Estado de Tablas SQL'}
                </button>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handleEnsureSchema}
                        disabled={!connected || tableOpsLoading}
                        className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50"
                    >
                        {tableOpsLoading ? 'Procesando...' : 'Crear/Verificar Tablas (SQL)'}
                    </button>
                    <button
                        onClick={handleClearTables}
                        disabled={!connected || tableOpsLoading}
                        className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50"
                    >
                        {tableOpsLoading ? 'Procesando...' : 'Borrar Datos'}
                    </button>
                    <button
                        onClick={handleDropTables}
                        disabled={!connected || tableOpsLoading}
                        className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50"
                    >
                        {tableOpsLoading ? 'Procesando...' : 'Eliminar Tablas'}
                    </button>
                </div>
            </div>
            {tables.length > 0 && (
                <div className="mb-4">
                    <h4 className="text-lg font-semibold text-brand-text mb-2">Tablas en la base de datos:</h4>
                    <ul className="list-disc pl-6">
                        {tables.map((table, idx) => (
                            <li key={idx} className="text-brand-text-secondary">{table}</li>
                        ))}
                    </ul>
                </div>
            )}
            {/* Diagnóstico de datos */}
            <div className="mb-4">
                <button
                    onClick={runDiagnostics}
                    disabled={!connected || diagLoading}
                    className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50"
                >
                    {diagLoading ? 'Procesando...' : 'Ejecutar diagnóstico'}
                </button>
                {diagnostics && (
                    <div className="mt-4 space-y-3">
                        {diagnostics.schemaChecks?.map((sc: any) => (
                            <div key={sc.table} className="border border-brand-border rounded p-2">
                                <div className="font-semibold">
                                    {sc.table}: {renderStatus(sc.exists)}
                                </div>
                                {Object.entries(sc.columns || {}).map(([col, ok]) => (
                                    <div key={col} className="ml-4 text-sm">
                                        {col}: {renderStatus(ok as boolean)}
                                    </div>
                                ))}
                                {Object.entries(sc.indexes || {}).map(([idx, ok]) => (
                                    <div key={idx} className="ml-4 text-sm">
                                        {idx}: {renderStatus(ok as boolean, optionalIndexes.includes(idx))}
                                    </div>
                                ))}
                                {sc.fk && (
                                    <div className="ml-4 text-sm">
                                        {sc.fk}: {renderStatus(String(sc.fk).includes(':ok'))}
                                    </div>
                                )}
                            </div>
                        ))}
                        <div className="text-sm">
                            <p>clients: {diagnostics.stats?.clients?.count ?? 0}</p>
                            {diagnostics.stats?.facts_meta && (
                                <p>
                                    facts_meta: {diagnostics.stats.facts_meta.count} ({diagnostics.stats.facts_meta.minDate} - {diagnostics.stats.facts_meta.maxDate})
                                </p>
                            )}
                            <p>ads: {diagnostics.stats?.ads?.count ?? 0}</p>
                        </div>
                        {hasIssues && (
                            <button
                                onClick={fixNow}
                                className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg shadow-md transition-colors"
                            >
                                Arreglar ahora
                            </button>
                        )}
                    </div>
                )}
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

