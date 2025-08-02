
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Modal } from './Modal';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (user: User) => void;
    initialData: User | null;
}

export const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'user'>('user');

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setUsername(initialData.username);
                setPassword(''); // For security, don't pre-fill password
                setRole(initialData.role);
            } else {
                // Reset for new user
                setUsername('');
                setPassword('');
                setRole('user');
            }
        }
    }, [isOpen, initialData]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || (!initialData && !password.trim())) {
             alert('El nombre de usuario y la contraseña son obligatorios para nuevos usuarios.');
            return;
        }

        const userData: User = {
            id: initialData?.id || crypto.randomUUID(),
            username: username.trim(),
            password: password.trim() || initialData!.password, // Use new password if provided, otherwise keep old
            role: role,
        };

        onSave(userData);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="bg-brand-surface rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-lg relative">
                <h2 className="text-2xl font-bold text-brand-text mb-6">
                    {initialData ? 'Editar Usuario' : 'Añadir Nuevo Usuario'}
                </h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-brand-text-secondary mb-1">Nombre de Usuario</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-2 focus:ring-brand-primary focus:border-brand-primary"
                            required
                        />
                    </div>
                     <div>
                        <label htmlFor="password" className="block text-sm font-medium text-brand-text-secondary mb-1">
                            Contraseña {initialData && '(dejar en blanco para no cambiar)'}
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-2 focus:ring-brand-primary focus:border-brand-primary"
                            required={!initialData}
                        />
                    </div>
                    <div>
                        <label htmlFor="role" className="block text-sm font-medium text-brand-text-secondary mb-1">Rol</label>
                        <select
                            id="role"
                            value={role}
                            onChange={(e) => setRole(e.target.value as 'admin' | 'user')}
                            className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-2 focus:ring-brand-primary focus:border-brand-primary"
                        >
                            <option value="user">Usuario</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-4 pt-4">
                        <button type="button" onClick={onClose} className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg">
                            Cancelar
                        </button>
                        <button type="submit" className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors">
                            Guardar
                        </button>
                    </div>
                </form>
                <button onClick={onClose} className="absolute top-4 right-4 text-brand-text-secondary hover:text-brand-text transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </Modal>
    );
};