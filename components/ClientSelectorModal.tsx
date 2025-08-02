
import React, { useEffect, useState } from 'react';
import { Client } from '../types';
import { Modal } from './Modal';

interface ClientSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    clients: Client[];
    onClientSelect: (clientId: string) => void;
    title?: string;
    description?: string;
}

export const ClientSelectorModal: React.FC<ClientSelectorModalProps> = ({ 
    isOpen, 
    onClose, 
    clients, 
    onClientSelect,
    title = "Asignar a Cliente",
    description = "Selecciona el cliente para esta operación."
}) => {
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    useEffect(() => {
        if (isOpen && clients.length > 0) {
            setSelectedClientId(clients[0].id);
        }
    }, [isOpen, clients]);

    if (!isOpen) {
        return null;
    }

    const handleSubmit = () => {
        if(selectedClientId) {
            onClientSelect(selectedClientId);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div 
                className="relative bg-brand-surface rounded-lg shadow-xl p-8 w-full max-w-md"
            >
                <h2 className="text-2xl font-bold text-brand-text mb-4">{title}</h2>
                <p className="text-brand-text-secondary mb-6">{description}</p>

                {clients.length > 0 ? (
                    <div className="space-y-4">
                        <select
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-3 focus:ring-brand-primary focus:border-brand-primary"
                        >
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>
                                    {client.name}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={handleSubmit}
                            disabled={!selectedClientId}
                            className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-3 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Confirmar
                        </button>
                    </div>
                ) : (
                     <p className="text-yellow-400 bg-yellow-500/10 p-4 rounded-md text-center">No tienes clientes asignados. Por favor, crea uno en la pestaña de 'Clientes'.</p>
                )}

                 <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-brand-text-secondary hover:text-brand-text transition-colors"
                    aria-label="Cerrar modal"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </Modal>
    );
};