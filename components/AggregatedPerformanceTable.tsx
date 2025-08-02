
import React from 'react';
import { AggregatedAdPerformance } from '../types';

interface AggregatedPerformanceTableProps {
    data: AggregatedAdPerformance[];
    onShowMetricsDetail: (ad: AggregatedAdPerformance) => void;
    onShowAnalysisDetail: (ad: AggregatedAdPerformance) => void;
    onUpdateAnalysis: (ad: AggregatedAdPerformance) => void;
    onUploadVideo: (ad: AggregatedAdPerformance) => void;
    generatingAnalysis: { [adName: string]: boolean };
}

export const AggregatedPerformanceTable: React.FC<AggregatedPerformanceTableProps> = ({ data, onShowMetricsDetail, onShowAnalysisDetail, onUpdateAnalysis, onUploadVideo, generatingAnalysis }) => {
    
    if (data.length === 0) {
        return <p className="text-brand-text-secondary text-center py-8">No hay datos de rendimiento para el rango de fechas y filtro seleccionado.</p>;
    }
    
    const headers = ['Creativo', 'Anuncio', 'Gasto', 'ROAS', 'Ventas', 'CPA', 'CPM', 'Frecuencia', 'CTR (Link)', 'Impresiones', 'Acción'];

    return (
        <div className="overflow-x-auto bg-brand-bg rounded-lg">
            <table className="w-full text-sm text-left text-brand-text-secondary">
                <thead className="text-xs text-brand-text uppercase bg-brand-surface">
                    <tr>
                        {headers.map(h => <th key={h} scope="col" className="px-4 py-3 whitespace-nowrap">{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row) => (
                        <tr key={row.adName} className="bg-brand-surface border-b border-brand-border hover:bg-brand-border/50">
                            <td className="px-4 py-3">
                                <button
                                    onClick={() => row.creativeType === 'video' ? onUploadVideo(row) : undefined}
                                    className="w-16 h-16 bg-brand-bg rounded-md flex items-center justify-center overflow-hidden relative group"
                                >
                                {(row.imageUrl) ? (
                                    <>
                                        <img src={row.imageUrl} alt={row.adName} className="w-full h-full object-cover" />
                                        {row.creativeType === 'video' && (
                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none group-hover:bg-black/50 transition-colors">
                                                <svg className="h-6 w-6 text-white/80" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand-border" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                )}
                                </button>
                            </td>
                            <td className="px-4 py-3 truncate max-w-xs font-medium text-brand-text">
                                <div className="flex items-center gap-2">
                                    <span title={row.adName}>{row.adName}</span>
                                    {row.inMultipleAdSets && (
                                        <span title="Este anuncio se encuentra en múltiples conjuntos de anuncios.">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-text-secondary" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                                            </svg>
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-3">{row.spend.toLocaleString('es-ES', { style: 'currency', currency: row.currency })}</td>
                            <td className="px-4 py-3 font-semibold text-brand-text">{row.roas.toFixed(2)}</td>
                            <td className="px-4 py-3">{row.purchases.toLocaleString('es-ES')}</td>
                            <td className="px-4 py-3">{row.cpa.toLocaleString('es-ES', { style: 'currency', currency: row.currency })}</td>
                            <td className="px-4 py-3">{row.cpm.toLocaleString('es-ES', { style: 'currency', currency: row.currency })}</td>
                            <td className="px-4 py-3">{row.frequency.toFixed(2)}</td>
                            <td className="px-4 py-3">{`${row.ctrLink.toFixed(2)}%`}</td>
                            <td className="px-4 py-3">{row.impressions.toLocaleString('es-ES')}</td>
                             <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    {row.adPreviewLink && (
                                        <a href={row.adPreviewLink} target="_blank" rel="noopener noreferrer" title="Ver vista previa en Meta" className="p-1.5 rounded-md text-brand-text-secondary bg-brand-border hover:bg-brand-border/70 transition-colors">
                                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                            </svg>
                                        </a>
                                    )}
                                    <button onClick={() => onShowMetricsDetail(row)} title="Ver todas las métricas" className="p-1.5 rounded-md text-brand-text-secondary bg-brand-border hover:bg-brand-border/70 transition-colors">
                                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path d="M2 11a1 1 0 011-1h2a1 1 0 110 2H3a1 1 0 01-1-1zm5 0a1 1 0 011-1h2a1 1 0 110 2H8a1 1 0 01-1-1zm5 0a1 1 0 011-1h2a1 1 0 110 2h-2a1 1 0 01-1-1z" />
                                            <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v12H4V4z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    {row.isMatched && row.imageUrl && (
                                        <>
                                            {row.creativeDescription ? (
                                                <button
                                                    onClick={() => onShowAnalysisDetail(row)}
                                                    className="bg-brand-border hover:bg-brand-border/70 text-brand-text text-xs font-bold py-1 px-2 rounded-md transition-colors"
                                                >
                                                    Análisis
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => onUpdateAnalysis(row)}
                                                    disabled={generatingAnalysis[row.adName] || (row.creativeType === 'video' && !row.isVideoUploaded)}
                                                    title={row.creativeType === 'video' && !row.isVideoUploaded ? 'Sube el video para analizar.' : ''}
                                                    className="bg-brand-primary/20 text-brand-primary hover:bg-brand-primary/40 text-xs font-bold py-1 px-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-wait"
                                                >
                                                    {generatingAnalysis[row.adName] ? 'Analizando...' : 'Generar IA'}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
