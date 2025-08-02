import React, { useState, useEffect } from 'react';
import { Client, AllLookerData, PerformanceRecord, AggregatedAdPerformance, TrendsAnalysisResult, TrendCardData, AppView, AccountAverages } from '../types';
import { DateRangePicker } from './DateRangePicker';
import Logger from '../Logger';

interface TrendsViewProps {
    clients: Client[];
    lookerData: AllLookerData;
    getTrendsAnalysis: (topAds: AggregatedAdPerformance[], client: Client, period: string, dailyData: PerformanceRecord[]) => Promise<TrendsAnalysisResult>;
    performanceData: { [key: string]: PerformanceRecord[] };
    startDate: string;
    endDate: string;
    onDateChange: (start: string, end: string) => void;
}

const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    const parts = dateString.split('/');
    if (parts.length === 3) {
        const [day, month, year] = parts.map(Number);
        return new Date(year, month - 1, day);
    }
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
}

const TrendCard: React.FC<{ card: TrendCardData }> = ({ card }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="bg-brand-border/30 rounded-lg p-5 transition-all duration-300">
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-brand-text">{card.title}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                        {card.supportingMetrics.map(metric => (
                            <div key={metric.metricName}>
                                <span className="text-xs text-brand-text-secondary uppercase tracking-wider">{metric.metricName}</span>
                                <p className="text-brand-primary font-bold text-lg">{metric.value}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex-shrink-0 bg-brand-border hover:bg-brand-bg text-brand-text-secondary font-semibold py-2 px-3 rounded-md text-sm transition-colors flex items-center gap-2"
                >
                    {isExpanded ? 'Ocultar' : 'Ver Explicación'}
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>

            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-brand-border/50 space-y-4 animate-fade-in">
                    <div>
                        <h4 className="font-semibold text-brand-text mb-1">Explicación del Hallazgo</h4>
                        <p className="text-brand-text-secondary text-sm leading-relaxed">{card.explanation}</p>
                    </div>
                    {card.fatigueAnalysis && (
                         <div>
                            <h4 className="font-semibold text-brand-text mb-1">Análisis de Fatiga</h4>
                            <p className="text-brand-text-secondary text-sm leading-relaxed">{card.fatigueAnalysis}</p>
                        </div>
                    )}
                     {card.demographicInsights && (
                         <div>
                            <h4 className="font-semibold text-brand-text mb-1">Insights Demográficos</h4>
                            <p className="text-brand-text-secondary text-sm leading-relaxed">{card.demographicInsights}</p>
                        </div>
                    )}
                    <div className="bg-brand-primary/10 p-3 rounded-md">
                        <h4 className="font-semibold text-brand-primary mb-1">Plan de Acción Recomendado</h4>
                        <p className="text-brand-text-secondary text-sm leading-relaxed">{card.recommendation}</p>
                    </div>
                </div>
            )}
        </div>
    )
}

const LoadingSkeleton: React.FC = () => (
    <div className="space-y-4 animate-pulse">
        {[...Array(3)].map((_, i) => (
             <div key={i} className="bg-brand-border/30 rounded-lg p-5">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 space-y-2">
                        <div className="h-5 bg-brand-border rounded-md w-3/4"></div>
                        <div className="flex items-center gap-4">
                            <div className="h-8 bg-brand-border rounded-md w-1/4"></div>
                            <div className="h-8 bg-brand-border rounded-md w-1/4"></div>
                        </div>
                    </div>
                    <div className="h-9 w-32 bg-brand-border rounded-md"></div>
                </div>
            </div>
        ))}
    </div>
);


export const TrendsView: React.FC<TrendsViewProps> = ({ clients, lookerData, getTrendsAnalysis, performanceData, startDate, endDate, onDateChange }) => {
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<TrendsAnalysisResult | null>(null);
    
    useEffect(() => {
        if (clients.length > 0 && !selectedClientId) {
            setSelectedClientId(clients[0].id);
        }
    }, [clients, selectedClientId]);

    const handleAnalyze = async () => {
        if (!selectedClientId || !startDate || !endDate) {
            alert("Por favor, selecciona un cliente y un rango de fechas.");
            return;
        }
        
        setIsLoading(true);
        setAnalysisResult(null);
        Logger.info('Starting trends analysis', { selectedClientId, startDate, endDate });

        const client = clients.find(c => c.id === selectedClientId);
        if (!client) {
            setIsLoading(false);
            return;
        }

        const clientLookerData = lookerData[client.id] || {};
        const clientPerfData = performanceData[client.id] || [];

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        const periodData = clientPerfData.filter(record => {
            const recordDate = parseDate(record.day);
            return recordDate && recordDate >= start && recordDate <= end && record.adDelivery.toLowerCase() === 'active' && record.impressions > 0;
        });

        const adsByName = periodData.reduce((acc, record) => {
            if (!record.adName) return acc;
            if (!acc[record.adName]) acc[record.adName] = [];
            acc[record.adName].push(record);
            return acc;
        }, {} as Record<string, PerformanceRecord[]>);

        const aggregatedAds: AggregatedAdPerformance[] = Object.entries(adsByName).map(([adName, records]) => {
             const totals = records.reduce((acc, r) => {
                const currentImpressions = r.impressions || 0;
                acc.spend += r.spend || 0;
                acc.purchaseValue += r.purchaseValue || 0;
                acc.purchases += r.purchases || 0;
                acc.impressions += currentImpressions;
                acc.clicks += r.clicksAll || 0;
                acc.linkClicks += r.linkClicks || 0;
                acc.thruPlays += r.thruPlays || 0;
                acc.frequencyTotal += (r.frequency || 0) * currentImpressions;
                if ((r.videoAveragePlayTime || 0) > 0 && currentImpressions > 0) {
                    acc.videoAveragePlayTimeWeightedTotal += (r.videoAveragePlayTime || 0) * currentImpressions;
                    acc.videoImpressions += currentImpressions;
                }
                acc.reach += r.reach || 0;
                acc.landingPageViews += r.landingPageViews || 0;
                acc.addsToCart += r.addsToCart || 0;
                acc.checkoutsInitiated += r.checkoutsInitiated || 0;
                acc.postInteractions += r.postInteractions || 0;
                acc.postReactions += r.postReactions || 0;
                acc.postComments += r.postComments || 0;
                acc.postShares += r.postShares || 0;
                acc.pageLikes += r.pageLikes || 0;
                acc.atencion += r.attention || 0;
                acc.interes += r.interest || 0;
                acc.deseo += r.desire || 0;

                return acc;
            }, { 
                spend: 0, purchaseValue: 0, purchases: 0, impressions: 0, clicks: 0, linkClicks: 0, 
                thruPlays: 0, videoAveragePlayTimeWeightedTotal: 0, videoImpressions: 0, frequencyTotal: 0, 
                landingPageViews: 0, addsToCart: 0, checkoutsInitiated: 0, postInteractions: 0, reach: 0,
                atencion: 0, interes: 0, deseo: 0,
                postReactions: 0, postComments: 0, postShares: 0, pageLikes: 0
            });
            
            const allRecordsForAd = clientPerfData.filter(r => r.adName === adName);
            const activeDaysSet = new Set();
            allRecordsForAd.forEach(r => {
                if (r.adDelivery?.toLowerCase() === 'active' && 
                    r.adSetDelivery?.toLowerCase() === 'active' && 
                    r.campaignDelivery?.toLowerCase() === 'active') {
                    activeDaysSet.add(r.day);
                }
            });
            const activeDays = activeDaysSet.size;

            const adSetNames = [...new Set(allRecordsForAd.map(r => r.adSetName))];
            const campaignNames = [...new Set(allRecordsForAd.map(r => r.campaignName))];
            const includedCustomAudiences = [...new Set(allRecordsForAd.flatMap(r => r.includedCustomAudiences?.split(',').map(s => s.trim()) || []).filter(Boolean))];
            const excludedCustomAudiences = [...new Set(allRecordsForAd.flatMap(r => r.excludedCustomAudiences?.split(',').map(s => s.trim()) || []).filter(Boolean))];

            const roas = totals.spend > 0 ? totals.purchaseValue / totals.spend : 0;
            const cpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0;
            const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
            const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
            const ctrLink = totals.impressions > 0 ? (totals.linkClicks / totals.impressions) * 100 : 0;
            const frequency = totals.impressions > 0 ? totals.frequencyTotal / totals.impressions : 0;
            const videoAveragePlayTime = totals.videoImpressions > 0 ? totals.videoAveragePlayTimeWeightedTotal / totals.videoImpressions : 0;
            const ticketPromedio = totals.purchases > 0 ? totals.purchaseValue / totals.purchases : 0;
            const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
            const tasaVisitaLP = totals.linkClicks > 0 ? (totals.landingPageViews / totals.linkClicks) * 100 : 0;
            const tasaCompra = totals.landingPageViews > 0 ? (totals.purchases / totals.landingPageViews) * 100 : 0;
            
            const lookerMatch = clientLookerData[adName];
            const inMultipleAdSets = new Set(records.map(r => r.adSetName)).size > 1;
            const videoFileName = records.find(r => r.videoFileName)?.videoFileName;
            const isVideo = !!videoFileName || (records.some(r => r.thruPlays > 0) && videoAveragePlayTime > 1);

            return {
                adName,
                adSetNames,
                campaignNames,
                includedCustomAudiences,
                excludedCustomAudiences,
                spend: totals.spend,
                purchases: totals.purchases,
                purchaseValue: totals.purchaseValue,
                impressions: totals.impressions,
                clicks: totals.clicks,
                linkClicks: totals.linkClicks,
                roas, cpa, cpm, ctr, ctrLink, frequency,
                videoAveragePlayTime,
                thruPlays: totals.thruPlays,
                isMatched: !!lookerMatch,
                creativeDescription: lookerMatch?.creativeDescription,
                currency: client.currency,
                inMultipleAdSets,
                imageUrl: lookerMatch?.imageUrl,
                adPreviewLink: lookerMatch?.adPreviewLink,
                creativeType: isVideo ? 'video' : 'image',
                analysisResult: lookerMatch?.analysisResult,
                videoFileName: videoFileName,
                ticketPromedio,
                alcance: totals.reach,
                cpc,
                visitasLP: totals.landingPageViews,
                tasaVisitaLP,
                tasaCompra,
                addsToCart: totals.addsToCart,
                checkoutsInitiated: totals.checkoutsInitiated,
                postInteractions: totals.postInteractions,
                postReactions: totals.postReactions,
                postComments: totals.postComments,
                postShares: totals.postShares,
                pageLikes: totals.pageLikes,
                activeDays,
                atencion: totals.atencion,
                interes: totals.interes,
                deseo: totals.deseo,
                isVideoUploaded: false,
                demographics: [],
                previousWeekMetrics: undefined,
            };
        });

        // Select top ads by spend that have a ROAS > 1 and have been analyzed
        const topAds = aggregatedAds
            .filter(ad => ad.creativeDescription && ad.roas > 1)
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 7); // Increased to 7 for more context

        if (topAds.length === 0) {
            alert("No hay suficientes anuncios con buen rendimiento y análisis de IA en este período para generar un análisis de tendencias. Intenta con un rango de fechas más amplio o analiza más creativos.");
            setIsLoading(false);
            return;
        }

        const topAdNames = new Set(topAds.map(ad => ad.adName));
        const dailyDataForTopAds = periodData.filter(d => topAdNames.has(d.adName));
        const periodString = `${new Date(startDate).toLocaleDateString('es-ES')} - ${new Date(endDate).toLocaleDateString('es-ES')}`;

        const result = await getTrendsAnalysis(topAds, client, periodString, dailyDataForTopAds);
        setAnalysisResult(result);
        setIsLoading(false);
    };
    
    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
            <header className="text-center">
                <h1 className="text-4xl font-bold tracking-tight text-brand-text sm:text-5xl">Análisis de Tendencias y Estrategias</h1>
                <p className="mt-4 text-lg text-brand-text-secondary">Obtén una visión estratégica de la IA sobre qué está funcionando, por qué, y qué hacer a continuación.</p>
            </header>

            <div className="bg-brand-surface rounded-lg p-6 shadow-lg flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1 w-full">
                    <label htmlFor="client-selector" className="block text-sm font-medium text-brand-text-secondary mb-1">Seleccionar Cliente</label>
                    <select
                        id="client-selector"
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-3 focus:ring-brand-primary focus:border-brand-primary"
                    >
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="flex-1 w-full">
                     <label className="block text-sm font-medium text-brand-text-secondary mb-1">Seleccionar Período</label>
                    <DateRangePicker onDateChange={onDateChange} startDate={startDate} endDate={endDate} />
                </div>
                <div className="w-full md:w-auto self-end">
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading || !selectedClientId}
                        className="w-full bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-3 px-6 rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                         </svg>
                        <span>{isLoading ? 'Analizando...' : 'Analizar Tendencias'}</span>
                    </button>
                </div>
            </div>

            <div className="bg-brand-surface rounded-lg p-6 shadow-lg min-h-[20rem]">
                 <h2 className="text-2xl font-bold text-brand-text mb-6">Resultados del Análisis Estratégico</h2>
                 {isLoading && <LoadingSkeleton />}
                 {!isLoading && analysisResult && (
                    analysisResult.trends.length > 0 ? (
                        <div className="space-y-4">
                            {analysisResult.trends.map((card, index) => (
                                <TrendCard key={index} card={card} />
                            ))}
                        </div>
                    ) : (
                         <div className="text-center py-10">
                            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-brand-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="mt-4 font-semibold text-brand-text">Análisis completado sin resultados.</p>
                            <p className="text-brand-text-secondary">La IA no pudo generar tendencias con los datos actuales. Prueba un rango de fechas diferente o con más anuncios analizados.</p>
                        </div>
                    )
                 )}
                 {!isLoading && !analysisResult && (
                     <div className="text-center py-10">
                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-brand-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <p className="mt-4 font-semibold text-brand-text">Listo para analizar</p>
                        <p className="text-brand-text-secondary">Configura el cliente y el período, y presiona "Analizar Tendencias" para empezar.</p>
                    </div>
                 )}
            </div>
        </div>
    );
};