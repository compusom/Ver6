
import React, { useState } from 'react';
import { User } from '../types';
import { UserFormModal } from './UserFormModal';

interface UserManagerProps {
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    currentUser: User;
}

export const UserManager: React.FC<UserManagerProps> = ({ users, setUsers, currentUser }) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const handleOpenAddModal = () => {
        setEditingUser(null);
        setIsFormModalOpen(true);
    };

    const handleOpenEditModal = (user: User) => {
        setEditingUser(user);
        setIsFormModalOpen(true);
    };

    const handleSaveUser = (userData: User) => {
        const isEditing = users.some(u => u.id === userData.id);
        const updatedUsers = isEditing
            ? users.map(u => u.id === userData.id ? userData : u)
            : [...users, userData];
        
        setUsers(updatedUsers);
        setIsFormModalOpen(false);
    };

    const handleDeleteUser = (userId: string) => {
        if (userId === currentUser.id) {
            alert("No puedes eliminar tu propia cuenta de administrador.");
            return;
        }
        if (window.confirm('¿Seguro que quieres eliminar este usuario? Esta acción es irreversible.')) {
            const updatedUsers = users.filter(u => u.id !== userId);
            setUsers(updatedUsers);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
            <div className="bg-brand-surface rounded-lg p-6 shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                    <h3 className="text-xl font-bold text-brand-text">
                        Gestión de Usuarios ({users.length})
                    </h3>
                    <button onClick={handleOpenAddModal} className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Añadir Usuario
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-brand-text-secondary">
                        <thead className="text-xs text-brand-text uppercase bg-brand-border/50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Usuario</th>
                                <th scope="col" className="px-6 py-3">Rol</th>
                                <th scope="col" className="px-6 py-3">ID de Usuario</th>
                                <th scope="col" className="px-6 py-3"><span className="sr-only">Acciones</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} className="bg-brand-surface border-b border-brand-border hover:bg-brand-border/30">
                                    <td className="px-6 py-4 font-medium text-brand-text whitespace-nowrap">{user.username}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-blue-500/20 text-blue-300' : 'bg-gray-500/20 text-gray-300'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs">{user.id}</td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button onClick={() => handleOpenEditModal(user)} className="p-2 rounded-full text-brand-text-secondary hover:bg-brand-primary hover:text-white transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>
                                        </button>
                                        <button onClick={() => handleDeleteUser(user.id)} disabled={user.id === currentUser.id} className="p-2 rounded-full text-brand-text-secondary hover:bg-red-500 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <UserFormModal
                isOpen={isFormModalOpen}
                onClose={() => setIsFormModalOpen(false)}
                onSave={handleSaveUser}
                initialData={editingUser}
            />
        </div>
    );
};