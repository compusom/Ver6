
import React, { useState, useRef, useCallback } from 'react';

interface FileUploadProps {
    onFileUpload: (file: File) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload }) => {
    const [fileName, setFileName] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        onFileUpload(file);
    };

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            setFileName(file.name);
            onFileUpload(file);
        }
    }, [onFileUpload]);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };
    
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    return (
        <div className="bg-brand-surface rounded-lg p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-brand-text mb-4 text-center">Sube tu Creativo</h2>
            <div
                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${isDragging ? 'border-brand-primary bg-brand-primary/10' : 'border-brand-border hover:border-brand-primary bg-brand-bg'}`}
                onClick={handleClick}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,video/*"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-brand-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                 <p className="mt-4 text-lg font-semibold text-brand-text">Arrastra y suelta tu archivo o haz clic para seleccionar</p>
                <p className="mt-2 text-sm text-brand-text-secondary">
                    {fileName ? (
                        <span className="text-brand-primary font-medium break-all">{fileName}</span>
                    ) : (
                        "Soporta imágenes y videos. El análisis se adaptará al formato."
                    )}
                </p>
            </div>
             <p className="text-xs text-brand-text-secondary mt-4 text-center">
                 Al subir tu creativo, te pediremos que lo asignes a un cliente para un mejor seguimiento y cache de resultados.
             </p>
        </div>
    );
};