
import React, { useState } from 'react';

interface LoginViewProps {
    onLogin: (user: string, pass: string) => boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        
        // Debug logging
        console.log('=== LOGIN DEBUG ===');
        console.log('Attempting login with:', { username, password });
        
        // Simulate loading for better UX
        await new Promise(resolve => setTimeout(resolve, 800));
        
        if (onLogin(username, password)) {
            console.log('Login successful');
            // Success, parent will handle view change
        } else {
            console.log('Login failed');
            setError('Usuario o contraseña incorrectos.');
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-brand-bg via-slate-900 to-brand-bg flex items-center justify-center relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                    backgroundImage: `radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.4) 0%, transparent 50%),
                                     radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.4) 0%, transparent 50%)`
                }}></div>
            </div>
            
            {/* Animated Background Elements */}
            <div className="absolute top-20 left-20 w-32 h-32 bg-brand-primary/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-20 right-20 w-40 h-40 bg-brand-accent/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
            <div className="absolute top-1/2 left-10 w-24 h-24 bg-brand-primary/10 rounded-full blur-2xl animate-pulse" style={{animationDelay: '2s'}}></div>
            
            <div className="relative z-10 w-full max-w-md mx-auto p-6">
                <div className="bg-gradient-to-br from-brand-surface/80 to-brand-surface/60 backdrop-blur-xl border border-brand-border/50 rounded-2xl p-8 shadow-2xl animate-scale-in">
                    {/* Logo and Header */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-brand-primary to-brand-accent rounded-2xl flex items-center justify-center mx-auto mb-4 animate-glow">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">
                            Creative Assistant
                        </h1>
                        <p className="text-brand-text-secondary mt-2">AI-Powered Marketing Intelligence</p>
                        <div className="mt-4 h-px bg-gradient-to-r from-transparent via-brand-border to-transparent"></div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="group">
                                <label htmlFor="username" className="block text-sm font-medium text-brand-text-secondary mb-2 group-focus-within:text-brand-primary transition-colors">
                                    Usuario
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-brand-text-secondary group-focus-within:text-brand-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <input
                                        id="username"
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-brand-bg/50 border border-brand-border text-brand-text rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all duration-200 placeholder-brand-text-secondary/50"
                                        placeholder="Ingresa tu usuario"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div className="group">
                                <label htmlFor="password" className="block text-sm font-medium text-brand-text-secondary mb-2 group-focus-within:text-brand-primary transition-colors">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <svg className="h-5 w-5 text-brand-text-secondary group-focus-within:text-brand-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                    </div>
                                    <input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-brand-bg/50 border border-brand-border text-brand-text rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all duration-200 placeholder-brand-text-secondary/50"
                                        placeholder="Ingresa tu contraseña"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 animate-slide-up">
                                <div className="flex items-center gap-2 text-red-400">
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="text-sm font-medium">{error}</span>
                                </div>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-brand-primary to-brand-accent hover:from-brand-primary-hover hover:to-brand-accent text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-glow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] group"
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Iniciando sesión...</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-2">
                                    <span>Iniciar Sesión</span>
                                    <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </div>
                            )}
                        </button>
                    </form>

                    {/* Demo Credentials */}
                    <div className="mt-6 p-4 bg-brand-bg/30 rounded-xl border border-brand-border/30">
                        <p className="text-xs text-brand-text-secondary text-center mb-2">Credenciales de demo:</p>
                        <div className="text-xs text-brand-text-secondary space-y-1">
                            <div className="flex justify-between">
                                <span>Admin:</span>
                                <span className="text-brand-primary">Admin / Admin</span>
                            </div>
                        </div>
                        
                        {/* Debug Button */}
                        <button 
                            type="button"
                            onClick={() => {
                                console.log('=== DEBUG INFO ===');
                                console.log('localStorage users:', localStorage.getItem('db_users'));
                                console.log('localStorage logged_in_user:', localStorage.getItem('db_logged_in_user'));
                                console.log('All localStorage keys:', Object.keys(localStorage));
                            }}
                            className="w-full mt-3 py-2 px-3 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded-lg transition-colors"
                        >
                            Debug: Ver localStorage
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};