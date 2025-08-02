import React, { useState, useRef } from 'react';
import { Modal } from './Modal';
import { AggregatedAdPerformance } from '../types';

interface VideoUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    adData: AggregatedAdPerformance;
    onSave: (adName: string, videoFile: File) => void;
}

export const VideoUploadModal: React.FC<VideoUploadModalProps> = ({ isOpen, onClose, adData, onSave }) => {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [useDifferentName, setUseDifferentName] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setVideoFile(e.target.files[0]);
        }
    };
    
    const handleSave = () => {
        if (videoFile) {
            onSave(adData.adName, videoFile);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="bg-brand-surface rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-lg relative">
                <h2 className="text-2xl font-bold text-brand-text mb-4">Subir Video para Análisis</h2>
                <p className="text-brand-text-secondary mb-2">Sube el archivo de video para el anuncio:</p>
                <p className="font-mono text-sm bg-brand-bg p-2 rounded-md text-brand-primary mb-6 truncate">{adData.adName}</p>

                <div className="space-y-4">
                    {!useDifferentName && (
                        <div className="bg-brand-border/30 p-4 rounded-md text-center">
                            <p className="text-brand-text-secondary text-sm">El sistema espera un archivo con el nombre:</p>
                            <p className="font-semibold text-brand-text mt-1">{adData.videoFileName || "Nombre no especificado"}</p>
                        </div>
                    )}
                    
                    <div>
                         <label htmlFor="video-upload" className="block text-sm font-medium text-brand-text-secondary mb-1">
                            {useDifferentName ? "Selecciona el archivo de video" : "Selecciona el archivo correspondiente"}
                         </label>
                         <input
                            id="video-upload"
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="block w-full text-sm text-brand-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary/10 file:text-brand-primary hover:file:bg-brand-primary/20 cursor-pointer bg-brand-bg border border-brand-border rounded-lg p-2"
                            accept="video/*"
                        />
                         {videoFile && <p className="text-xs text-green-400 mt-2">Archivo seleccionado: {videoFile.name}</p>}
                    </div>

                    <div className="flex items-center">
                        <input
                            id="different-name-checkbox"
                            type="checkbox"
                            checked={useDifferentName}
                            onChange={(e) => setUseDifferentName(e.target.checked)}
                            className="h-4 w-4 rounded border-brand-border text-brand-primary focus:ring-brand-primary"
                        />
                        <label htmlFor="different-name-checkbox" className="ml-2 block text-sm text-brand-text-secondary">
                            El archivo que quiero subir tiene un nombre diferente.
                        </label>
                    </div>

                </div>

                <div className="flex justify-end gap-4 pt-6 mt-4 border-t border-brand-border">
                    <button type="button" onClick={onClose} className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg">
                        Cancelar
                    </button>
                    <button 
                        type="button" 
                        onClick={handleSave}
                        disabled={!videoFile}
                        className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Guardar Video
                    </button>
                </div>
            </div>
        </Modal>
    );
};