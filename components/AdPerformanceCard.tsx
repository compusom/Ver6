
import React from 'react';
import { AggregatedAdPerformance } from '../types';

interface AdPerformanceCardProps {
    ad: AggregatedAdPerformance;
    onShowMetricsDetail: () => void;
    onShowAnalysisDetail: () => void;
    onUpdateAnalysis: () => void;
    onUploadVideo: () => void;
    generatingAnalysis: boolean;
}

export const AdPerformanceCard: React.FC<AdPerformanceCardProps> = ({ ad, onShowMetricsDetail, onShowAnalysisDetail, onUpdateAnalysis, onUploadVideo, generatingAnalysis }) => {
    const metrics = [
        { label: "ROAS", value: ad.roas.toFixed(2), highlight: true },
        { label: "Gasto", value: ad.spend.toLocaleString('es-ES', { style: 'currency', currency: ad.currency }) },
        { label: "Ventas", value: ad.purchases.toLocaleString('es-ES') },
        { label: "CPA", value: ad.cpa.toLocaleString('es-ES', { style: 'currency', currency: ad.currency }) },
        { label: "CTR (Link)", value: `${ad.ctrLink.toFixed(2)}%` },
        { label: "CPM", value: ad.cpm.toLocaleString('es-ES', { style: 'currency', currency: ad.currency }) },
        { label: "Frecuencia", value: ad.frequency.toFixed(2) },
    ];
    
    const handleCreativeClick = () => {
        if (ad.creativeType === 'video' && ad.isMatched) {
            onUploadVideo();
        }
    };
    
    const renderCreativePreview = () => {
        if (ad.isMatched && ad.imageUrl) {
            return (
                <button 
                    onClick={handleCreativeClick}
                    className="relative w-full h-full group"
                    aria-label={ad.creativeType === 'video' ? 'Subir video para este anuncio' : 'Vista previa del creativo'}
                    disabled={ad.creativeType !== 'video'}
                >
                    <img src={ad.imageUrl} alt={ad.adName} className="w-full h-full object-cover" />
                    {ad.creativeType === 'video' && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none group-hover:bg-black/50 transition-colors">
                            <svg className="h-10 w-10 text-white/80" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                        </div>
                    )}
                </button>
            );
        }
        return (
            <div className="text-brand-text-secondary text-center p-4 flex flex-col items-center justify-center h-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <p className="text-xs mt-2">{ad.isMatched ? 'Error al cargar' : 'Creativo no vinculado'}</p>
            </div>
        );
    };

    const isVideoAndNotUploaded = ad.creativeType === 'video' && !ad.isVideoUploaded;

    return (
        <div className="bg-brand-border/50 rounded-lg overflow-hidden shadow-lg transform transition-all duration-300 hover:shadow-brand-primary/20 hover:-translate-y-1 flex flex-col">
            <div className="w-full aspect-square bg-brand-bg flex items-center justify-center overflow-hidden">
                {renderCreativePreview()}
            </div>
            <div className="p-4 flex flex-col flex-grow">
                <p className="text-sm font-semibold text-brand-text truncate" title={ad.adName}>{ad.adName}</p>
                {ad.inMultipleAdSets && <p className="text-xs text-brand-text-secondary mt-1">En múltiples Ad-Sets</p>}
                
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 flex-grow">
                     {metrics.map(metric => (
                        <div key={metric.label} className={metric.highlight ? 'col-span-2 bg-brand-primary/20 p-2 rounded-md text-center' : ''}>
                            <p className={`text-xs uppercase tracking-wider ${metric.highlight ? 'text-brand-primary' : 'text-brand-text-secondary'}`}>{metric.label}</p>
                            <p className={`font-bold ${metric.highlight ? 'text-brand-primary text-2xl' : 'text-brand-text text-base'}`}>{metric.value}</p>
                        </div>
                    ))}
                </div>
                
                <div className="mt-4 pt-3 border-t border-brand-border/50 flex items-center gap-2">
                    {ad.adPreviewLink && (
                        <a href={ad.adPreviewLink} target="_blank" rel="noopener noreferrer" title="Ver vista previa en Meta" className="p-2 rounded-md text-brand-text-secondary bg-brand-border hover:bg-brand-border/70 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                        </a>
                    )}
                    <button onClick={onShowMetricsDetail} title="Ver todas las métricas" className="p-2 rounded-md text-brand-text-secondary bg-brand-border hover:bg-brand-border/70 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 11a1 1 0 011-1h2a1 1 0 110 2H3a1 1 0 01-1-1zm5 0a1 1 0 011-1h2a1 1 0 110 2H8a1 1 0 01-1-1zm5 0a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" /><path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4z" clipRule="evenodd" /></svg>
                    </button>
                    {ad.isMatched && ad.imageUrl && (
                        ad.creativeDescription ? (
                            <button onClick={onShowAnalysisDetail} className="w-full bg-brand-border hover:bg-brand-border/70 text-brand-text text-sm font-bold py-2 px-3 rounded-md transition-colors">
                                Mostrar Análisis
                            </button>
                        ) : (
                            <button onClick={onUpdateAnalysis} disabled={generatingAnalysis || isVideoAndNotUploaded} title={isVideoAndNotUploaded ? 'Sube el archivo de video para poder analizarlo.' : ''} className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white text-sm font-bold py-2 px-3 rounded-md transition-colors disabled:opacity-50 disabled:cursor-wait">
                                {generatingAnalysis ? 'Analizando...' : 'Generar Análisis IA'}
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
};