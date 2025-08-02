
import React from 'react';
import { FormatGroup } from '../types';

interface FormatSelectorProps {
    onSelectFormat: (format: FormatGroup) => void;
}

const formats: { id: FormatGroup, name: string, description: string, icon: JSX.Element }[] = [
    { 
        id: 'SQUARE_LIKE', 
        name: 'Formatos Cuadrados/Rectangulares',
        description: 'Feeds, Marketplace, Explore...',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
        )
    },
    { 
        id: 'VERTICAL', 
        name: 'Formatos Verticales', 
        description: 'Stories, Reels...',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
        )
    },
];

export const PlatformSelector: React.FC<FormatSelectorProps> = ({ onSelectFormat }) => {
    return (
        <div className="max-w-4xl mx-auto bg-brand-surface rounded-lg p-6 shadow-lg animate-fade-in">
            <h2 className="text-xl font-semibold text-brand-text mb-6 text-center">Selecciona un grupo de formatos para analizar</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {formats.map(format => (
                    <button
                        key={format.id}
                        onClick={() => onSelectFormat(format.id)}
                        className="group flex flex-col items-center justify-center p-6 bg-brand-border/30 rounded-lg text-brand-text-secondary hover:bg-brand-primary hover:text-white transition-all transform hover:scale-105"
                    >
                        <div className="text-brand-primary group-hover:text-white transition-colors">
                            {format.icon}
                        </div>
                        <span className="mt-4 text-lg font-bold text-brand-text group-hover:text-white transition-colors">{format.name}</span>
                        <span className="mt-1 text-sm">{format.description}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};