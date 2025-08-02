
import React, { useState } from 'react';

interface LoginViewProps {
    onLogin: (user: string, pass: string) => boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (onLogin(username, password)) {
            // Success, parent will handle view change
        } else {
            setError('Usuario o contraseña incorrectos.');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-full max-w-sm mx-auto bg-brand-surface rounded-lg p-8 shadow-2xl animate-fade-in">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-brand-text">Bienvenido</h1>
                    <p className="text-brand-text-secondary mt-2">Inicia sesión para continuar</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-brand-text-secondary mb-1">Usuario</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-3 focus:ring-brand-primary focus:border-brand-primary transition-colors"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-brand-text-secondary mb-1">Contraseña</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-3 focus:ring-brand-primary focus:border-brand-primary"
                            required
                        />
                    </div>
                    {error && (
                        <p className="text-sm text-red-400 text-center">{error}</p>
                    )}
                    <div>
                        <button type="submit" className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50">
                            Iniciar Sesión
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};