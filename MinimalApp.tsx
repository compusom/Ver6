import React, { useState } from 'react';

// Componente de prueba mínimo para diagnóstico - SIN CSS EXTERNO
const MinimalApp: React.FC = () => {
    const [message, setMessage] = useState('✅ React funciona correctamente');
    const [view, setView] = useState('home');

    // Estilos inline para evitar dependencias de CSS
    const styles = {
        container: {
            minHeight: '100vh',
            backgroundColor: '#1a202c',
            color: 'white',
            fontFamily: 'Arial, sans-serif'
        },
        header: {
            backgroundColor: '#2d3748',
            borderBottom: '1px solid #4a5568',
            padding: '1rem 1.5rem'
        },
        headerContent: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
        },
        title: {
            fontSize: '1.25rem',
            fontWeight: 'bold'
        },
        status: {
            fontSize: '0.875rem',
            color: '#a0aec0'
        },
        mainContent: {
            display: 'flex'
        },
        sidebar: {
            width: '256px',
            backgroundColor: '#2d3748',
            minHeight: 'calc(100vh - 70px)',
            borderRight: '1px solid #4a5568',
            padding: '1rem'
        },
        sidebarTitle: {
            fontSize: '1.125rem',
            fontWeight: '600',
            marginBottom: '1rem'
        },
        menuList: {
            listStyle: 'none',
            padding: 0,
            margin: 0
        },
        menuItem: {
            marginBottom: '0.5rem'
        },
        menuButton: {
            width: '100%',
            textAlign: 'left' as const,
            padding: '0.75rem',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontSize: '1rem'
        },
        menuButtonActive: {
            backgroundColor: '#3182ce',
            color: 'white'
        },
        menuButtonInactive: {
            backgroundColor: 'transparent',
            color: '#cbd5e0'
        },
        content: {
            flex: 1,
            padding: '2rem'
        },
        contentTitle: {
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '1rem'
        },
        debugSection: {
            marginTop: '2rem',
            padding: '2rem',
            borderTop: '1px solid #4a5568',
            backgroundColor: '#2d374880'
        },
        debugTitle: {
            fontSize: '1.125rem',
            fontWeight: '600',
            marginBottom: '1rem'
        },
        buttonGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
        },
        testButton: {
            padding: '0.75rem',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: 'all 0.2s'
        },
        debugInfo: {
            marginTop: '2rem',
            padding: '0.75rem',
            backgroundColor: '#4a5568',
            borderRadius: '0.375rem'
        }
    };

    const renderContent = () => {
        // Contenido específico por vista
        let content;
        let backgroundColor;

        switch(view) {
            case 'home':
                backgroundColor = '#0f172a';
                content = (
                    <div>
                        <h1 style={styles.contentTitle}>🏠 Inicio</h1>
                        <p>Esta es la vista de inicio. React está funcionando correctamente.</p>
                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#2d3748', borderRadius: '0.5rem' }}>
                            <strong>Estado actual:</strong> Vista de inicio cargada correctamente
                        </div>
                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#1a365d', borderRadius: '0.5rem' }}>
                            <strong>🏠 CONTENIDO DE INICIO:</strong> Esta sección debería ser diferente para cada vista
                        </div>
                    </div>
                );
                break;
            case 'clients':
                backgroundColor = '#1e3a8a';
                content = (
                    <div>
                        <h1 style={styles.contentTitle}>👥 Clientes</h1>
                        <p>Esta es la vista de clientes. La navegación funciona.</p>
                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#2d3748', borderRadius: '0.5rem' }}>
                            <strong>Estado actual:</strong> Vista de clientes cargada correctamente
                        </div>
                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#2563eb', borderRadius: '0.5rem' }}>
                            <strong>👥 CONTENIDO DE CLIENTES:</strong> Aquí deberían aparecer los clientes
                        </div>
                    </div>
                );
                break;
            case 'performance':
                backgroundColor = '#065f46';
                content = (
                    <div>
                        <h1 style={styles.contentTitle}>📊 Rendimiento</h1>
                        <p>Esta es la vista de rendimiento. La navegación funciona.</p>
                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#2d3748', borderRadius: '0.5rem' }}>
                            <strong>Estado actual:</strong> Vista de rendimiento cargada correctamente
                        </div>
                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#059669', borderRadius: '0.5rem' }}>
                            <strong>📊 CONTENIDO DE RENDIMIENTO:</strong> Aquí deberían aparecer las métricas
                        </div>
                    </div>
                );
                break;
            case 'import':
                backgroundColor = '#7c2d12';
                content = (
                    <div>
                        <h1 style={styles.contentTitle}>📁 Importar</h1>
                        <p>Esta es la vista de importación. La navegación funciona.</p>
                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#2d3748', borderRadius: '0.5rem' }}>
                            <strong>Estado actual:</strong> Vista de importación cargada correctamente
                        </div>
                        <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#ea580c', borderRadius: '0.5rem' }}>
                            <strong>📁 CONTENIDO DE IMPORTACIÓN:</strong> Aquí debería estar el formulario de importación
                        </div>
                    </div>
                );
                break;
            default:
                backgroundColor = '#4c1d95';
                content = (
                    <div>
                        <h1 style={styles.contentTitle}>❓ Vista Desconocida</h1>
                        <p>Vista no encontrada: {view}</p>
                    </div>
                );
        }

        const contentStyle = {
            ...styles.content,
            backgroundColor: backgroundColor
        };

        return (
            <div style={contentStyle}>
                {content}
            </div>
        );
    };

    const getButtonStyle = (buttonView: string) => {
        return {
            ...styles.menuButton,
            ...(view === buttonView ? styles.menuButtonActive : styles.menuButtonInactive)
        };
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <header style={styles.header}>
                <div style={styles.headerContent}>
                    <h1 style={styles.title}>Ver6 - Diagnóstico Minimal</h1>
                    <div style={styles.status}>
                        {message}
                    </div>
                </div>
            </header>

            <div style={styles.mainContent}>
                {/* Sidebar */}
                <nav style={styles.sidebar}>
                    <h2 style={styles.sidebarTitle}>📋 Menú de Prueba</h2>
                    <ul style={styles.menuList}>
                        <li style={styles.menuItem}>
                            <button
                                onClick={() => {
                                    console.log('Navegando a inicio...');
                                    setView('home');
                                    setMessage('✅ Navegación a Inicio funciona');
                                }}
                                style={getButtonStyle('home')}
                                onMouseEnter={(e) => {
                                    if (view !== 'home') {
                                        e.currentTarget.style.backgroundColor = '#4a5568';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (view !== 'home') {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                🏠 Inicio
                            </button>
                        </li>
                        <li style={styles.menuItem}>
                            <button
                                onClick={() => {
                                    console.log('Navegando a clientes...');
                                    setView('clients');
                                    setMessage('✅ Navegación a Clientes funciona');
                                }}
                                style={getButtonStyle('clients')}
                                onMouseEnter={(e) => {
                                    if (view !== 'clients') {
                                        e.currentTarget.style.backgroundColor = '#4a5568';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (view !== 'clients') {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                👥 Clientes
                            </button>
                        </li>
                        <li style={styles.menuItem}>
                            <button
                                onClick={() => {
                                    console.log('Navegando a rendimiento...');
                                    setView('performance');
                                    setMessage('✅ Navegación a Rendimiento funciona');
                                }}
                                style={getButtonStyle('performance')}
                                onMouseEnter={(e) => {
                                    if (view !== 'performance') {
                                        e.currentTarget.style.backgroundColor = '#4a5568';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (view !== 'performance') {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                📊 Rendimiento
                            </button>
                        </li>
                        <li style={styles.menuItem}>
                            <button
                                onClick={() => {
                                    console.log('Navegando a importar...');
                                    setView('import');
                                    setMessage('✅ Navegación a Importar funciona');
                                }}
                                style={getButtonStyle('import')}
                                onMouseEnter={(e) => {
                                    if (view !== 'import') {
                                        e.currentTarget.style.backgroundColor = '#4a5568';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (view !== 'import') {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                    }
                                }}
                            >
                                📁 Importar
                            </button>
                        </li>
                    </ul>
                    
                    <div style={styles.debugInfo}>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>🔧 Debug Info</h3>
                        <p style={{ fontSize: '0.75rem', color: '#a0aec0', margin: '0.25rem 0' }}>
                            Vista actual: <span style={{ color: 'white', backgroundColor: '#3182ce', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>{view}</span>
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#a0aec0', margin: '0.25rem 0' }}>
                            Estado: <span style={{ color: '#68d391' }}>Funcionando</span>
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#a0aec0', margin: '0.25rem 0' }}>
                            Última actualización: <span style={{ color: '#fbd38d' }}>{new Date().toLocaleTimeString()}</span>
                        </p>
                    </div>
                </nav>

                {/* Contenido principal */}
                <main style={{ flex: 1 }}>
                    {renderContent()}
                    
                    <div style={styles.debugSection}>
                        <h2 style={styles.debugTitle}>🧪 Tests de Diagnóstico</h2>
                        <div style={styles.buttonGrid}>
                            <button
                                onClick={() => {
                                    console.log('Test: React State');
                                    setMessage('✅ React State funciona correctamente');
                                }}
                                style={{
                                    ...styles.testButton,
                                    backgroundColor: '#3182ce',
                                    color: 'white'
                                }}
                            >
                                🔄 Test React State
                            </button>
                            <button
                                onClick={() => {
                                    console.log('Test: Console Logging');
                                    console.error('Test de error en consola');
                                    console.warn('Test de warning en consola');
                                    console.info('Test de info en consola');
                                    setMessage('✅ Console logging funciona - revisa DevTools');
                                }}
                                style={{
                                    ...styles.testButton,
                                    backgroundColor: '#d69e2e',
                                    color: 'white'
                                }}
                            >
                                📝 Test Console
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        const response = await fetch('http://localhost:3001/health');
                                        if (response.ok) {
                                            setMessage('✅ Servidor local disponible');
                                        } else {
                                            setMessage('❌ Servidor local error');
                                        }
                                    } catch (error) {
                                        setMessage('❌ Servidor local no disponible');
                                    }
                                }}
                                style={{
                                    ...styles.testButton,
                                    backgroundColor: '#38a169',
                                    color: 'white'
                                }}
                            >
                                🌐 Test Servidor
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MinimalApp;
