import React, { useState, useRef, useEffect } from 'react';
import { AppView, User } from '../types';

interface NavbarProps {
    currentView: AppView;
    onNavigate: (view: AppView) => void;
    currentUser: User;
    onLogout: () => void;
    onOpenDiagnostics?: () => void;
}

interface NavItem {
    view: AppView;
    label: string;
    icon: React.ReactNode;
    adminOnly: boolean;
    description?: string;
    color?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, currentUser, onLogout, onOpenDiagnostics }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const primaryNavItems: NavItem[] = [
        {
            view: 'creative_analysis',
            label: 'Análisis IA',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
            ),
            adminOnly: false,
            description: 'Análisis de creativos con IA',
            color: 'text-purple-400'
        },
        {
            view: 'performance',
            label: 'Performance',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
            ),
            adminOnly: false,
            description: 'Métricas y rendimiento',
            color: 'text-green-400'
        },
        {
            view: 'strategies',
            label: 'Estrategias',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a1 1 0 01-1-1V9a1 1 0 011-1h1a2 2 0 100-4H4a1 1 0 01-1-1V4a1 1 0 011-1h3a1 1 0 011 1v1z" />
                </svg>
            ),
            adminOnly: false,
            description: 'Optimización de campañas',
            color: 'text-blue-400'
        },
        {
            view: 'strategic_analysis',
            label: 'Plan Estratégico',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            ),
            adminOnly: false,
            description: 'Análisis estratégico integral',
            color: 'text-indigo-400'
        },
        {
            view: 'reports',
            label: 'Reportes',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
            adminOnly: false,
            description: 'Informes detallados',
            color: 'text-orange-400'
        }
    ];

    const managementItems: NavItem[] = [
        {
            view: 'clients',
            label: 'Clientes',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
            adminOnly: false,
            description: 'Gestión de clientes'
        },
        {
            view: 'import',
            label: 'Importar',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
            ),
            adminOnly: true,
            description: 'Importar datos'
        }
    ];

    const adminItems: NavItem[] = [
        {
            view: 'users',
            label: 'Usuarios',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
            ),
            adminOnly: true,
            description: 'Gestión de usuarios'
        },
        {
            view: 'control_panel',
            label: 'Panel Admin',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
            adminOnly: true,
            description: 'Panel de control'
        },
        {
            view: 'logs',
            label: 'Logs',
            icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
            adminOnly: true,
            description: 'Logs del sistema'
        }
    ];

    const NavButton: React.FC<{ item: NavItem; isActive: boolean }> = ({ item, isActive }) => (
        <button
            onClick={() => onNavigate(item.view)}
            className={`group relative flex items-center gap-3 px-3 py-2 rounded-xl font-medium transition-all duration-200 ${
                isActive
                    ? 'bg-white/10 text-white shadow-lg ring-1 ring-white/20'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
            }`}
            title={item.description}
        >
            <span className={`transition-colors ${isActive ? 'text-white' : item.color || 'text-gray-400'}`}>
                {item.icon}
            </span>
            <span className="text-sm">{item.label}</span>
            {isActive && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 -z-10"></div>
            )}
        </button>
    );

    return (
        <>
            {/* Desktop Navigation */}
            <nav className="hidden lg:flex fixed top-6 left-6 right-6 z-50 bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl">
                <div className="flex w-full items-center justify-between px-6 py-3">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-30 group-hover:opacity-100 transition duration-1000"></div>
                        </div>
                        <div>
                            <h1 className="text-white font-bold text-lg">Creative AI</h1>
                        </div>
                    </div>

                    {/* Primary Navigation */}
                    <div className="flex items-center gap-1">
                        {primaryNavItems.map((item) => (
                            <NavButton key={item.view} item={item} isActive={currentView === item.view} />
                        ))}
                    </div>

                    {/* Secondary Navigation */}
                    <div className="flex items-center gap-4">
                        {/* Management Section */}
                        <div className="flex items-center gap-1 pl-4 border-l border-gray-700">
                            {managementItems.map((item) => {
                                if (item.adminOnly && currentUser.role !== 'admin') return null;
                                return <NavButton key={item.view} item={item} isActive={currentView === item.view} />;
                            })}
                        </div>

                        {/* Admin Section */}
                        {currentUser.role === 'admin' && (
                            <div className="flex items-center gap-1 pl-4 border-l border-gray-700">
                                {adminItems.map((item) => (
                                    <button
                                        key={item.view}
                                        onClick={() => onNavigate(item.view)}
                                        className={`p-2 rounded-lg transition-all duration-200 ${
                                            currentView === item.view
                                                ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                                                : 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
                                        }`}
                                        title={item.description}
                                    >
                                        {item.icon}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Utility Buttons */}
                        <div className="flex items-center gap-1 pl-4 border-l border-gray-700">
                            <button
                                onClick={() => onNavigate('settings')}
                                className={`p-2 rounded-lg transition-all duration-200 ${
                                    currentView === 'settings'
                                        ? 'bg-white/10 text-white ring-1 ring-white/20'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                                title="Configuración"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>
                            <button
                                onClick={() => onNavigate('help')}
                                className={`p-2 rounded-lg transition-all duration-200 ${
                                    currentView === 'help'
                                        ? 'bg-white/10 text-white ring-1 ring-white/20'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                                title="Ayuda"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>
                        </div>

                        {/* User Menu */}
                        <div className="flex items-center gap-3 pl-4 border-l border-gray-700">
                            {/* Diagnóstico Button */}
                            {currentUser.role === 'admin' && onOpenDiagnostics && (
                                <button
                                    onClick={onOpenDiagnostics}
                                    className="p-2 rounded-lg text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 transition-all duration-200"
                                    title="Diagnóstico de Datos"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </button>
                            )}
                            
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                    <span className="text-white text-sm font-medium">
                                        {currentUser.username.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="text-sm">
                                    <div className="text-white font-medium">{currentUser.username}</div>
                                    <div className="text-gray-400 text-xs capitalize">{currentUser.role}</div>
                                </div>
                            </div>
                            <button
                                onClick={onLogout}
                                className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                                title="Cerrar Sesión"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Navigation */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-gray-900/95 backdrop-blur-xl border-b border-gray-700/50">
                <div className="flex items-center justify-between px-4 py-3">
                    {/* Mobile Logo */}
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <span className="text-white font-bold">Creative AI</span>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                        </svg>
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="border-t border-gray-700/50 bg-gray-900/95 backdrop-blur-xl">
                        <div className="px-4 py-3 space-y-1">
                            {/* Primary Items */}
                            <div className="space-y-1">
                                {primaryNavItems.map((item) => (
                                    <button
                                        key={item.view}
                                        onClick={() => {
                                            onNavigate(item.view);
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                                            currentView === item.view
                                                ? 'bg-white/10 text-white'
                                                : 'text-gray-300 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <span className={item.color || 'text-gray-400'}>{item.icon}</span>
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Management Items */}
                            <div className="pt-3 border-t border-gray-700/50 space-y-1">
                                {managementItems.map((item) => {
                                    if (item.adminOnly && currentUser.role !== 'admin') return null;
                                    return (
                                        <button
                                            key={item.view}
                                            onClick={() => {
                                                onNavigate(item.view);
                                                setIsMobileMenuOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                                                currentView === item.view
                                                    ? 'bg-white/10 text-white'
                                                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <span className="text-gray-400">{item.icon}</span>
                                            <span>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Admin Items */}
                            {currentUser.role === 'admin' && (
                                <div className="pt-3 border-t border-gray-700/50 space-y-1">
                                    {adminItems.map((item) => (
                                        <button
                                            key={item.view}
                                            onClick={() => {
                                                onNavigate(item.view);
                                                setIsMobileMenuOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                                                currentView === item.view
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : 'text-gray-300 hover:text-red-400 hover:bg-red-500/10'
                                            }`}
                                        >
                                            <span className="text-red-400">{item.icon}</span>
                                            <span>{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Utility Items */}
                            <div className="pt-3 border-t border-gray-700/50 space-y-1">
                                <button
                                    onClick={() => {
                                        onNavigate('settings');
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                                        currentView === 'settings'
                                            ? 'bg-white/10 text-white'
                                            : 'text-gray-300 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>Configuración</span>
                                </button>
                                <button
                                    onClick={() => {
                                        onNavigate('help');
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                                        currentView === 'help'
                                            ? 'bg-white/10 text-white'
                                            : 'text-gray-300 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Ayuda</span>
                                </button>
                                
                                {/* Diagnóstico Button (Admin only) */}
                                {currentUser.role === 'admin' && onOpenDiagnostics && (
                                    <button
                                        onClick={() => {
                                            onOpenDiagnostics();
                                            setIsMobileMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:text-orange-400 hover:bg-orange-500/10 transition-all"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                        <span>Diagnóstico</span>
                                    </button>
                                )}
                            </div>

                            {/* User Section */}
                            <div className="pt-3 border-t border-gray-700/50">
                                <div className="flex items-center gap-3 px-3 py-2 text-gray-300">
                                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                        <span className="text-white text-sm font-medium">
                                            {currentUser.username.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <div className="text-white font-medium">{currentUser.username}</div>
                                        <div className="text-gray-400 text-xs capitalize">{currentUser.role}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={onLogout}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    <span>Cerrar Sesión</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};
