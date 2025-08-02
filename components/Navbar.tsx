import React from 'react';
import { AppView, User } from '../types';

interface NavbarProps {
    currentView: AppView;
    onNavigate: (view: AppView) => void;
    currentUser: User;
    onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, currentUser, onLogout }) => {
    
    const navItems: { view: AppView; label: string; adminOnly: boolean; }[] = [
        { view: 'creative_analysis', label: 'Análisis de Creativos', adminOnly: false },
        { view: 'performance', label: 'Rendimiento', adminOnly: false },
        { view: 'strategies', label: 'Estrategias', adminOnly: false },
        { view: 'reports', label: 'Reportes', adminOnly: false },
        { view: 'clients', label: 'Clientes', adminOnly: false },
        { view: 'import', label: 'Importar', adminOnly: true },
        { view: 'users', label: 'Usuarios', adminOnly: true },
        { view: 'logs', label: 'Logs', adminOnly: true },
        { view: 'control_panel', label: 'Panel de Control', adminOnly: true },
        { view: 'help', label: 'Ayuda', adminOnly: false },
        { view: 'settings', label: 'Configuración', adminOnly: false },
    ];

    return (
        <nav className="bg-brand-surface p-4 rounded-lg shadow-md mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
                {navItems.map(item => {
                    if (item.adminOnly && currentUser.role !== 'admin') return null;
                    return (
                        <button 
                            key={item.view}
                            onClick={() => onNavigate(item.view)}
                            className={`font-semibold transition-colors ${currentView === item.view ? 'text-brand-primary' : 'text-brand-text-secondary hover:text-brand-text'}`}
                        >
                            {item.label}
                        </button>
                    )
                })}
            </div>

            <div className="flex items-center gap-4">
                {/* User Info & Logout */}
                <div className="flex items-center gap-3">
                    <span className="text-sm text-brand-text-secondary">
                        Usuario: <span className="font-bold text-brand-text">{currentUser.username}</span>
                    </span>
                    <button onClick={onLogout} title="Cerrar Sesión" className="p-2 rounded-full text-brand-text-secondary hover:bg-red-500 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        </nav>
    );
};