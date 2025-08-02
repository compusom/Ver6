
import React from 'react';
import { Modal } from './Modal';

interface AiAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    isLoading: boolean;
    analysisText: string;
}

const LoadingSpinner: React.FC = () => (
    <div className="flex flex-col items-center justify-center gap-4">
        <svg className="animate-spin h-10 w-10 text-brand-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg font-semibold text-brand-text">Generando conclusión estratégica...</p>
    </div>
);

// Basic markdown to HTML converter
const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
    const html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>')       // Italic
        .replace(/`([^`]+)`/g, '<code class="bg-brand-bg px-1 py-0.5 rounded-sm font-mono text-sm text-yellow-300">$1</code>') // Inline code
        .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>') // List items
        .replace(/^(#+) (.*$)/gm, (match, hashes, content) => { // Headers
            const level = hashes.length;
            const size = level === 1 ? 'text-xl' : level === 2 ? 'text-lg' : 'text-md';
            return `<h${level} class="${size} font-bold mt-4 mb-2 text-brand-text">${content}</h${level}>`;
        })
        .replace(/\n/g, '<br />'); // Newlines

    return <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html.replace(/<br \/><(h[1-6]|li|strong|em)/g, '<$1') }} />;
};


export const AiAnalysisModal: React.FC<AiAnalysisModalProps> = ({ isOpen, onClose, isLoading, analysisText }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="bg-brand-surface rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-brand-text">Conclusión Estratégica de la IA</h2>
                    <button onClick={onClose} className="text-brand-text-secondary hover:text-brand-text">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="overflow-y-auto pr-4 -mr-4 flex-grow">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <LoadingSpinner />
                        </div>
                    ) : (
                        <div className="text-brand-text-secondary space-y-4 whitespace-pre-wrap">
                           <MarkdownRenderer text={analysisText} />
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};