
import React, { useState, useEffect, useRef } from 'react';
import { Client, User } from '../types';
import { Modal } from './Modal';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

interface ClientFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (client: Client) => void;
    initialData: Client | null;
    currentUser: User;
}

export const ClientFormModal: React.FC<ClientFormModalProps> = ({ isOpen, onClose, onSave, initialData, currentUser }) => {
    const [name, setName] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [metaAccountName, setMetaAccountName] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setName(initialData.name);
                setCurrency(initialData.currency);
                setLogoPreview(initialData.logo);
                setMetaAccountName(initialData.metaAccountName || '');
                setLogoFile(null);
            } else {
                // Reset for new client
                setName('');
                setCurrency('EUR');
                setLogoPreview(null);
                setMetaAccountName('');
                setLogoFile(null);
            }
        }
    }, [isOpen, initialData]);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !currency.trim()) return;

        let logoUrl = initialData?.logo || `https://avatar.vercel.sh/${encodeURIComponent(name.trim())}.png?text=${encodeURIComponent(name.trim().charAt(0))}`;
        if (logoFile) {
            logoUrl = await fileToBase64(logoFile);
        }
        
        const clientData: Client = {
            id: initialData?.id || crypto.randomUUID(),
            name: name.trim(),
            logo: logoUrl,
            currency: currency.trim().toUpperCase(),
            userId: initialData?.userId || currentUser.id,
            metaAccountName: metaAccountName.trim() ? metaAccountName.trim() : undefined,
        };

        onSave(clientData);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="bg-brand-surface rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-lg relative">
                <h2 className="text-2xl font-bold text-brand-text mb-6">
                    {initialData ? 'Editar Cliente' : 'Añadir Nuevo Cliente'}
                </h2>
                <form onSubmit={handleSave} className="space-y-4">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <div>
                            <label htmlFor="clientName" className="block text-sm font-medium text-brand-text-secondary mb-1">Nombre del Cliente</label>
                            <input
                                id="clientName"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ej: Muto Longevity"
                                className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-2 focus:ring-brand-primary focus:border-brand-primary"
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="clientCurrency" className="block text-sm font-medium text-brand-text-secondary mb-1">Moneda (3 letras)</label>
                            <input
                                id="clientCurrency"
                                type="text"
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                placeholder="Ej: EUR"
                                maxLength={3}
                                className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-2 focus:ring-brand-primary focus:border-brand-primary"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="metaAccountName" className="block text-sm font-medium text-brand-text-secondary mb-1">Nombre de Cuenta de Meta (Opcional)</label>
                         <p className="text-xs text-brand-text-secondary/70 mb-1">Este es el "Nombre de la cuenta" exacto que aparece en tus reportes. Es <span className="font-bold text-brand-text-secondary">crucial</span> para vincular los datos automáticamente.</p>
                        <input
                            id="metaAccountName"
                            type="text"
                            value={metaAccountName}
                            onChange={(e) => setMetaAccountName(e.target.value)}
                            placeholder="Ej: MiCliente - Ventas (ES)"
                            className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-2 focus:ring-brand-primary focus:border-brand-primary"
                        />
                    </div>
                    
                    <div>
                         <label className="block text-sm font-medium text-brand-text-secondary mb-1">Logo del Cliente (Opcional)</label>
                         <div className="mt-1 flex items-center gap-4 bg-brand-bg border border-brand-border rounded-md p-2">
                            <span className="h-12 w-12 rounded-full overflow-hidden bg-brand-border flex-shrink-0">
                                {logoPreview ? <img src={logoPreview} alt="Logo Preview" className="h-full w-full object-cover" /> : <svg className="h-full w-full text-brand-text-secondary p-2" fill="currentColor" viewBox="0 0 24 24"><path d="M24 20.993V24H0v-2.997A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                            </span>
                            <input
                                id="clientLogo"
                                type="file"
                                ref={fileInputRef}
                                onChange={handleLogoChange}
                                className="block w-full text-sm text-brand-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20 cursor-pointer"
                                accept="image/png, image/jpeg, image/gif"
                            />
                        </div>
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