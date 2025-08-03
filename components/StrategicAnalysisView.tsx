import React, { useState, useMemo } from 'react';
import { Client, AggregatedAdPerformance, AnalysisResult, StrategicAnalysisResult, AllLookerData, PerformanceRecord, LookerCreativeData } from '../types';
import { DateRangePicker } from './DateRangePicker';

interface StrategicAnalysisViewProps {
    clients: Client[];
    lookerData: AllLookerData;
    performanceData: { [key: string]: PerformanceRecord[] };
    getStrategicAnalysis: (clientData: StrategicAnalysisInput) => Promise<StrategicAnalysisResult>;
    startDate: string;
    endDate: string;
    onDateChange: (start: string, end: string) => void;
}

interface StrategicAnalysisInput {
    client: Client;
    creativeSummaries: CreativeSummary[];
    performanceMetrics: PerformanceMetrics;
    dateRange: { start: string; end: string };
}

interface CreativeSummary {
    adName: string;
    creativeDescription: string;
    analysisResult: AnalysisResult;
    performanceData: any; // Simplificado para evitar problemas de tipo
    keyInsights: string[];
}

interface PerformanceMetrics {
    totalSpend: number;
    totalRevenue: number;
    overallROAS: number;
    bestPerformingAds: string[];
    worstPerformingAds: string[];
    trendAnalysis: string;
    demographicInsights: string;
}

export const StrategicAnalysisView: React.FC<StrategicAnalysisViewProps> = ({
    clients,
    lookerData,
    performanceData,
    getStrategicAnalysis,
    startDate,
    endDate,
    onDateChange
}) => {
    
    // Validación defensiva para props
    const safeClients = Array.isArray(clients) ? clients : [];
    const safeLookerData = lookerData && typeof lookerData === 'object' ? lookerData : {};
    const safePerformanceData = performanceData && typeof performanceData === 'object' ? performanceData : {};
    
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [strategicResult, setStrategicResult] = useState<StrategicAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Filtrar clientes que tengan datos y creativos analizados
    const eligibleClients = useMemo(() => {
        return safeClients.filter(client => {
            const clientLookerData = safeLookerData[client.id] || {};
            const hasAnalyzedCreatives = Object.values(clientLookerData).some((ad: LookerCreativeData) => ad.analysisResult);
            const hasPerformanceData = safePerformanceData[client.id]?.length > 0;
            return hasAnalyzedCreatives && hasPerformanceData;
        });
    }, [safeClients, safeLookerData, safePerformanceData]);

    const selectedClient = useMemo(() => {
        return safeClients.find(c => c.id === selectedClientId);
    }, [safeClients, selectedClientId]);

    // Preparar datos para el análisis estratégico
    const prepareAnalysisData = (client: Client): StrategicAnalysisInput => {
        const clientLookerData = safeLookerData[client.id] || {};
        const clientPerformanceData = safePerformanceData[client.id] || [];
        
        // Filtrar datos por fecha
        const filteredPerformanceData = clientPerformanceData.filter(record => {
            const recordDate = new Date(record.day);
            const start = new Date(startDate);
            const end = new Date(endDate);
            return recordDate >= start && recordDate <= end;
        });

        // Crear resúmenes de creativos
        const creativeSummaries: CreativeSummary[] = Object.entries(clientLookerData)
            .filter(([_, adData]: [string, LookerCreativeData]) => adData.analysisResult)
            .map(([adName, adData]: [string, LookerCreativeData]) => {
                // Calcular métricas de rendimiento para este anuncio específico
                const adPerformanceData = filteredPerformanceData.filter(record => 
                    record.adName === adName
                );
                
                const aggregatedPerformance = aggregateAdPerformance(adPerformanceData, client);
                
                return {
                    adName,
                    creativeDescription: adData.creativeDescription || '',
                    analysisResult: adData.analysisResult!,
                    performanceData: aggregatedPerformance,
                    keyInsights: extractKeyInsights(adData.analysisResult!, aggregatedPerformance)
                };
            });

        // Calcular métricas generales de rendimiento
        const performanceMetrics: PerformanceMetrics = {
            totalSpend: filteredPerformanceData.reduce((acc, record) => acc + record.spend, 0),
            totalRevenue: filteredPerformanceData.reduce((acc, record) => acc + record.purchaseValue, 0),
            overallROAS: calculateROAS(filteredPerformanceData),
            bestPerformingAds: findBestPerformingAds(creativeSummaries),
            worstPerformingAds: findWorstPerformingAds(creativeSummaries),
            trendAnalysis: analyzeTrends(filteredPerformanceData),
            demographicInsights: analyzeDemographics(filteredPerformanceData)
        };

        return {
            client,
            creativeSummaries,
            performanceMetrics,
            dateRange: { start: startDate, end: endDate }
        };
    };

    const handleAnalyze = async () => {
        if (!selectedClient) return;
        
        setIsAnalyzing(true);
        setError(null);
        
        try {
            const analysisInput = prepareAnalysisData(selectedClient);
            const result = await getStrategicAnalysis(analysisInput);
            setStrategicResult(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error en el análisis estratégico');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
            {/* Header */}
            <header className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-brand-text">Análisis Estratégico Integral</h2>
                    <p className="text-brand-text-secondary mt-1">
                        Combina análisis de creativos con métricas de rendimiento para generar planes de acción estratégicos.
                    </p>
                </div>
                <DateRangePicker onDateChange={onDateChange} startDate={startDate} endDate={endDate} />
            </header>

            {/* Client Selection */}
            <div className="bg-brand-surface rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-brand-text mb-4">
                    Seleccionar Cliente para Análisis
                </h3>
                
                {eligibleClients.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-brand-text-secondary">
                            <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-lg font-medium">No hay clientes elegibles</p>
                            <p className="mt-2">
                                Para usar esta función, necesitas clientes con:
                                <br />• Creativos analizados por IA
                                <br />• Datos de rendimiento importados
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {eligibleClients.map(client => {
                                const clientLookerData = safeLookerData[client.id] || {};
                                const analyzedCreatives = Object.values(clientLookerData).filter((ad: LookerCreativeData) => ad.analysisResult).length;
                                const totalAds = Object.keys(clientLookerData).length;
                                
                                return (
                                    <button
                                        key={client.id}
                                        onClick={() => setSelectedClientId(client.id)}
                                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                                            selectedClientId === client.id
                                                ? 'border-brand-primary bg-brand-primary/10'
                                                : 'border-brand-border hover:border-brand-primary/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <img src={client.logo} alt={client.name} className="h-10 w-10 rounded-full" />
                                            <div>
                                                <h4 className="font-semibold text-brand-text">{client.name}</h4>
                                                <p className="text-sm text-brand-text-secondary">
                                                    {analyzedCreatives} de {totalAds} creativos analizados
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-xs text-brand-text-secondary">
                                            ✓ Creativos con análisis IA
                                            <br />
                                            ✓ Datos de rendimiento disponibles
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        
                        {selectedClient && (
                            <div className="mt-6 flex justify-center">
                                <button
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing}
                                    className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-3 px-8 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
                                >
                                    {isAnalyzing ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Analizando estrategia...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            Generar Análisis Estratégico
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-red-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">Error en el análisis:</span>
                    </div>
                    <p className="mt-1 text-red-300">{error}</p>
                </div>
            )}

            {/* Results Display */}
            {strategicResult && selectedClient && (
                <StrategicResultsDisplay 
                    result={strategicResult} 
                    client={selectedClient}
                    dateRange={{ start: startDate, end: endDate }}
                />
            )}
        </div>
    );
};

// Componente para mostrar los resultados del análisis estratégico
const StrategicResultsDisplay: React.FC<{
    result: StrategicAnalysisResult;
    client: Client;
    dateRange: { start: string; end: string };
}> = ({ result, client, dateRange }) => {
    return (
        <div className="space-y-6">
            {/* Executive Summary */}
            <div className="bg-brand-surface rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-brand-text mb-4 flex items-center gap-2">
                    <svg className="h-6 w-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Resumen Ejecutivo - {client.name}
                </h3>
                <div className="prose prose-invert max-w-none">
                    <p className="text-brand-text-secondary text-sm mb-4">
                        Período analizado: {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}
                    </p>
                    <div className="bg-brand-bg/50 rounded-lg p-4">
                        <p className="text-brand-text leading-relaxed">{result.executiveSummary}</p>
                    </div>
                </div>
            </div>

            {/* Action Plan */}
            <div className="bg-brand-surface rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-brand-text mb-4 flex items-center gap-2">
                    <svg className="h-6 w-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Plan de Acción Estratégico
                </h3>
                <div className="space-y-4">
                    {result.actionPlan.map((action, index) => (
                        <div key={index} className="border-l-4 border-brand-primary pl-4">
                            <h4 className="font-semibold text-brand-text">{action.title}</h4>
                            <p className="text-brand-text-secondary mt-1">{action.description}</p>
                            <div className="flex items-center gap-4 mt-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    action.priority === 'HIGH' ? 'bg-red-500/20 text-red-400' :
                                    action.priority === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-green-500/20 text-green-400'
                                }`}>
                                    Prioridad {action.priority}
                                </span>
                                <span className="text-xs text-brand-text-secondary">
                                    Impacto esperado: {action.expectedImpact}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Creative Insights */}
            <div className="bg-brand-surface rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-brand-text mb-4 flex items-center gap-2">
                    <svg className="h-6 w-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Insights de Creativos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.creativeInsights.map((insight, index) => (
                        <div key={index} className="bg-brand-bg/50 rounded-lg p-4">
                            <h4 className="font-semibold text-brand-text mb-2">{insight.adName}</h4>
                            <p className="text-sm text-brand-text-secondary mb-2">{insight.insight}</p>
                            <div className="text-xs text-brand-primary">{insight.recommendation}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Performance Recommendations */}
            <div className="bg-brand-surface rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-brand-text mb-4 flex items-center gap-2">
                    <svg className="h-6 w-6 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Recomendaciones de Rendimiento
                </h3>
                <div className="space-y-3">
                    {result.performanceRecommendations.map((rec, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-brand-bg/50 rounded-lg">
                            <div className="w-2 h-2 rounded-full bg-brand-primary mt-2 flex-shrink-0"></div>
                            <div>
                                <p className="text-brand-text">{rec.recommendation}</p>
                                <p className="text-sm text-brand-text-secondary mt-1">
                                    Impacto esperado: {rec.expectedImpact}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Funciones auxiliares
const aggregateAdPerformance = (records: PerformanceRecord[], client: Client): any => {
    if (records.length === 0) {
        // Devolver un objeto simplificado
        return {
            adName: '',
            spend: 0,
            revenue: 0,
            roas: 0,
            impressions: 0,
            clicks: 0,
            ctr: 0,
            cpc: 0,
            purchases: 0,
        };
    }

    const totals = records.reduce((acc, record) => ({
        spend: acc.spend + record.spend,
        revenue: acc.revenue + record.purchaseValue,
        impressions: acc.impressions + record.impressions,
        clicks: acc.clicks + record.linkClicks,
        purchases: acc.purchases + record.purchases,
    }), { spend: 0, revenue: 0, impressions: 0, clicks: 0, purchases: 0 });

    return {
        adName: records[0]?.adName || '',
        spend: totals.spend,
        revenue: totals.revenue,
        roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
        impressions: totals.impressions,
        clicks: totals.clicks,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
        purchases: totals.purchases,
    };
};

const extractKeyInsights = (analysis: AnalysisResult, performance: any): string[] => {
    const insights: string[] = [];
    
    if (analysis.effectivenessScore < 50) {
        insights.push(`Efectividad baja (${analysis.effectivenessScore}/100)`);
    }
    
    if (performance.roas < 2) {
        insights.push(`ROAS por debajo del promedio (${performance.roas.toFixed(2)})`);
    }
    
    if (analysis.funnelStage === 'TOFU' && performance.ctr > 2) {
        insights.push('Buen CTR para creative de awareness');
    }
    
    return insights;
};

const calculateROAS = (records: PerformanceRecord[]): number => {
    const totalSpend = records.reduce((acc, r) => acc + r.spend, 0);
    const totalRevenue = records.reduce((acc, r) => acc + r.purchaseValue, 0);
    return totalSpend > 0 ? totalRevenue / totalSpend : 0;
};

const findBestPerformingAds = (summaries: CreativeSummary[]): string[] => {
    return summaries
        .sort((a, b) => b.performanceData.roas - a.performanceData.roas)
        .slice(0, 3)
        .map(s => s.adName);
};

const findWorstPerformingAds = (summaries: CreativeSummary[]): string[] => {
    return summaries
        .sort((a, b) => a.performanceData.roas - b.performanceData.roas)
        .slice(0, 3)
        .map(s => s.adName);
};

const analyzeTrends = (records: PerformanceRecord[]): string => {
    if (records.length < 2) return 'Datos insuficientes para análisis de tendencias';
    
    const sortedRecords = records.sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime());
    const firstHalf = sortedRecords.slice(0, Math.floor(sortedRecords.length / 2));
    const secondHalf = sortedRecords.slice(Math.floor(sortedRecords.length / 2));
    
    const firstHalfROAS = calculateROAS(firstHalf);
    const secondHalfROAS = calculateROAS(secondHalf);
    
    if (secondHalfROAS > firstHalfROAS * 1.1) {
        return 'Tendencia positiva en ROAS';
    } else if (secondHalfROAS < firstHalfROAS * 0.9) {
        return 'Tendencia negativa en ROAS';
    }
    return 'ROAS estable en el período';
};

const analyzeDemographics = (records: PerformanceRecord[]): string => {
    // Placeholder para análisis demográfico
    return 'Análisis demográfico disponible con más datos';
};
