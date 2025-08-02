
import React from 'react';
import { Language } from '../types';

interface LanguageSelectorProps {
    language: Language;
    onLanguageChange: (lang: Language) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ language, onLanguageChange }) => {
    const languages = [
        { id: 'es', name: 'Español' },
        { id: 'en', name: 'English' },
    ];

    return (
        <div className="flex justify-center items-center gap-2 mb-6">
            <span className="text-sm text-brand-text-secondary">{language === 'es' ? 'Idioma del Análisis:' : 'Analysis Language:'}</span>
            <div className="flex rounded-lg bg-brand-border p-1">
                {languages.map((lang) => (
                    <button
                        key={lang.id}
                        onClick={() => onLanguageChange(lang.id as Language)}
                        className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${
                            language === lang.id
                                ? 'bg-brand-primary text-white'
                                : 'bg-transparent text-brand-text-secondary hover:bg-brand-surface'
                        }`}
                    >
                        {lang.name}
                    </button>
                ))}
            </div>
        </div>
    );
};