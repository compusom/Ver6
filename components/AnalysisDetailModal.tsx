
import React from 'react';
import { Modal } from './Modal';
import { AggregatedAdPerformance } from '../types';
import { Recommendations } from './Recommendations';

interface AnalysisDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    adData: AggregatedAdPerformance | null;
}

export const AnalysisDetailModal: React.FC<AnalysisDetailModalProps> = ({ isOpen, onClose, adData }) => {
    if (!adData) return null;

    const analysisResult = adData.analysisResult;
    
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="bg-brand-surface rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-4xl max-h-[90vh] flex flex-col relative">
                <div className="flex justify-between items-center mb-4 flex-shrink-0 border-b border-brand-border pb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-brand-text">Análisis Detallado del Creativo</h2>
                        <p className="text-brand-text-secondary truncate max-w-lg">{adData.adName}</p>
                    </div>
                    <button onClick={onClose} className="text-brand-text-secondary hover:text-brand-text">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="overflow-y-auto pr-4 -mr-4 flex-grow">
                   {analysisResult ? (
                        <Recommendations analysisResult={analysisResult} isLoading={false} />
                   ) : (
                        <div className="text-center py-16 text-brand-text-secondary">
                            <p>No se encontró un resultado de análisis para este creativo.</p>
                        </div>
                   )}
                </div>
            </div>
        </Modal>
    );
};
