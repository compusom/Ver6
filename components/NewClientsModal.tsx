
import React from 'react';
import { Modal } from './Modal';

interface NewClientsModalProps {
    isOpen: boolean;
    onClose: () => void;
    newAccountNames: string[];
    onConfirm: (accountNames: string[]) => void;
}

export const NewClientsModal: React.FC<NewClientsModalProps> = ({ isOpen, onClose, newAccountNames, onConfirm }) => {
    
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="bg-brand-surface rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-lg relative">
                <h2 className="text-2xl font-bold text-brand-text mb-4">
                    Nuevas Cuentas Detectadas
                </h2>
                <p className="text-brand-text-secondary mb-6">
                    Se encontraron las siguientes cuentas en el reporte que no están vinculadas a ningún cliente existente. ¿Deseas crearlos ahora?
                </p>
                
                <div className="bg-brand-bg rounded-md p-4 max-h-60 overflow-y-auto mb-6">
                    <ul className="space-y-2">
                        {newAccountNames.map(name => (
                            <li key={name} className="text-brand-text flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                </svg>
                                {name}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="flex justify-end gap-4">
                    <button type="button" onClick={onClose} className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg">
                        Cancelar
                    </button>
                    <button 
                        type="button" 
                        onClick={() => onConfirm(newAccountNames)}
                        className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors"
                    >
                        Crear {newAccountNames.length} Clientes y Continuar
                    </button>
                </div>
            </div>
        </Modal>
    );
};
