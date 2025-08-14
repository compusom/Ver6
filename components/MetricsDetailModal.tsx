import React, { useState, useMemo } from 'react';
import { Modal } from './Modal';
import { AggregatedAdPerformance, AccountAverages, DemographicData, AdEvolutionMetrics } from '../types';

interface MetricsDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    adData: AggregatedAdPerformance | null;
    accountAverages: AccountAverages | null;
}

const MetricSubCard: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
    <div className={`bg-brand-bg/50 rounded-lg p-4 shadow-inner h-full ${className}`}>
        <h3 className="text-sm font-semibold text-brand-text-secondary uppercase tracking-wider mb-4">{title}</h3>
        <div className="space-y-4">
            {children}
        </div>
    </div>
);

const MetricItem: React.FC<{ label: string; value: string; average?: string; isHighlighted?: boolean }> = ({ label, value, average, isHighlighted = false }) => (
    <div>
        <p className="text-xs text-brand-text-secondary">{label}</p>
        <p className={`font-bold break-words ${isHighlighted ? 'text-brand-primary text-xl' : 'text-brand-text text-lg'}`}>
            {value}
        </p>
        {average && (
            <p className="text-xs text-brand-text-secondary/70 mt-0.5">
                Prom. Cuenta: {average}
            </p>
        )}
    </div>
);

const InfoPill: React.FC<{ title: string; items: string[]; type: 'included' | 'excluded' }> = ({ title, items, type }) => {
    const [isOpen, setIsOpen] = useState(false);
    if(items.length === 0) return null;
    
    const pillColor = type === 'included' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300';

    return (
        <div>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className={`w-full text-left flex justify-between items-center p-2 rounded-md hover:bg-brand-border/80 transition-colors ${pillColor}`}
                aria-expanded={isOpen}
            >
                <span className="text-xs font-semibold">{title} ({items.length})</span>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="text-xs font-mono bg-brand-bg rounded p-2 mt-1 max-h-24 overflow-y-auto">
                    {items.map(name => <div key={name} className="truncate" title={name}>{name}</div>)}
                </div>
            )}
        </div>
    );
};

const DemographicsCard: React.FC<{ demographics: DemographicData[] | undefined, currency: string }> = ({ demographics, currency }) => {
    const [demographicModalOpen, setDemographicModalOpen] = useState(false);
    const [selectedModalGender, setSelectedModalGender] = useState<'male' | 'female' | 'unknown' | null>(null);
    const [loadingGender, setLoadingGender] = useState<string | null>(null);

    const genderData = useMemo(() => {
        if (!demographics || demographics.length === 0) {
            return { male: [], female: [], unknown: [] };
        }

        const grouped = demographics.reduce((acc, d) => {
            const gender = d.gender.toLowerCase();
            if (gender === 'male') acc.male.push(d);
            else if (gender === 'female') acc.female.push(d);
            else acc.unknown.push(d);
            return acc;
        }, { male: [] as DemographicData[], female: [] as DemographicData[], unknown: [] as DemographicData[] });

        return grouped;
    }, [demographics]);

    const calculateGenderMetrics = (genderGroup: DemographicData[]) => {
        if (genderGroup.length === 0) return { roas: 0, ctr: 0, cpa: 0, spend: 0, purchaseValue: 0, purchases: 0, cpm: 0 };

        const totals = genderGroup.reduce((acc, d) => {
            acc.spend += d.spend;
            acc.purchaseValue += d.purchaseValue;
            acc.purchases += d.purchases;
            acc.impressions += d.impressions;
            acc.linkClicks += d.linkClicks;
            return acc;
        }, { spend: 0, purchaseValue: 0, purchases: 0, impressions: 0, linkClicks: 0 });

        return {
            roas: totals.spend > 0 ? totals.purchaseValue / totals.spend : 0,
            ctr: totals.impressions > 0 ? (totals.linkClicks / totals.impressions) * 100 : 0,
            cpa: totals.purchases > 0 ? totals.spend / totals.purchases : 0,
            spend: totals.spend,
            purchaseValue: totals.purchaseValue,
            purchases: totals.purchases,
            cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
        };
    };

    const maleMetrics = calculateGenderMetrics(genderData.male);
    const femaleMetrics = calculateGenderMetrics(genderData.female);
    const unknownMetrics = calculateGenderMetrics(genderData.unknown);

    const handleGenderClick = async (gender: 'male' | 'female' | 'unknown') => {
        const genderGroupData = genderData[gender];
        if (genderGroupData.length === 0) return;
        
        setLoadingGender(gender);
        // Simulate loading (you can remove this if you don't need it)
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setSelectedModalGender(gender);
        setDemographicModalOpen(true);
        setLoadingGender(null);
    };

    if (!demographics || demographics.length === 0) {
        return <MetricSubCard title="Rendimiento Demográfico"><p className="text-xs text-brand-text-secondary">No hay datos demográficos.</p></MetricSubCard>;
    }

    const GenderCard: React.FC<{ 
        gender: 'male' | 'female' | 'unknown';
        metrics: any;
        count: number;
        config: { title: string; icon: string; gradient: string; hoverGradient: string; accentColor: string };
    }> = ({ gender, metrics, count, config }) => {
        const hasData = count > 0;
        const isLoading = loadingGender === gender;
        
        return (
            <button
                onClick={() => handleGenderClick(gender)}
                disabled={!hasData || isLoading}
                className={`group relative overflow-hidden rounded-xl border transition-all duration-300 transform text-left p-0 ${
                    !hasData 
                        ? 'opacity-50 cursor-not-allowed border-brand-border/30' 
                        : 'border-brand-border/50 hover:border-brand-border hover:scale-[1.02] hover:shadow-lg hover:shadow-brand-primary/10'
                }`}
            >
                {/* Loading Overlay */}
                {isLoading && (
                    <div className="absolute inset-0 bg-brand-surface/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
                        <div className="flex items-center gap-2 text-brand-text">
                            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm font-medium">Cargando...</span>
                        </div>
                    </div>
                )}
                
                {/* Gradient Background */}
                <div className={`absolute inset-0 ${config.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                
                {/* Content */}
                <div className="relative p-5 bg-brand-surface group-hover:bg-transparent transition-colors duration-300">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="text-2xl transform group-hover:scale-110 transition-transform duration-300">
                                {config.icon}
                            </div>
                            <div>
                                <h4 className="font-bold text-brand-text text-lg group-hover:text-white transition-colors duration-300">
                                    {config.title}
                                </h4>
                                <p className="text-brand-text-secondary group-hover:text-white/80 text-sm transition-colors duration-300">
                                    {count} grupo{count !== 1 ? 's' : ''} demográfico{count !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                        
                        {hasData && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <svg className="w-5 h-5 text-white transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        )}
                    </div>

                    {/* Metrics Preview */}
                    {hasData && (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-center">
                                <div className="text-xs text-brand-text-secondary group-hover:text-white/70 font-medium mb-1 transition-colors duration-300">
                                    ROAS
                                </div>
                                <div className={`font-bold text-lg ${config.accentColor} group-hover:text-white transition-colors duration-300`}>
                                    {metrics.roas.toFixed(2)}
                                </div>
                            </div>
                            
                            <div className="text-center">
                                <div className="text-xs text-brand-text-secondary group-hover:text-white/70 font-medium mb-1 transition-colors duration-300">
                                    CTR
                                </div>
                                <div className={`font-bold text-lg ${config.accentColor} group-hover:text-white transition-colors duration-300`}>
                                    {metrics.ctr.toFixed(2)}%
                                </div>
                            </div>
                            
                            <div className="text-center">
                                <div className="text-xs text-brand-text-secondary group-hover:text-white/70 font-medium mb-1 transition-colors duration-300">
                                    CPA
                                </div>
                                <div className={`font-bold text-sm ${config.accentColor} group-hover:text-white transition-colors duration-300`}>
                                    {metrics.cpa.toLocaleString('es-ES', { style: 'currency', currency, maximumFractionDigits: 0 })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!hasData && (
                        <div className="text-center py-4">
                            <p className="text-brand-text-secondary text-sm">Sin datos disponibles</p>
                        </div>
                    )}
                </div>
            </button>
        );
    };

    const genderConfigs = {
        male: {
            title: 'Hombres',
            icon: '👨',
            gradient: 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20',
            hoverGradient: 'bg-gradient-to-br from-blue-500 to-cyan-500',
            accentColor: 'text-blue-400'
        },
        female: {
            title: 'Mujeres',
            icon: '👩',
            gradient: 'bg-gradient-to-br from-pink-500/20 to-rose-500/20',
            hoverGradient: 'bg-gradient-to-br from-pink-500 to-rose-500',
            accentColor: 'text-pink-400'
        },
        unknown: {
            title: 'Otros',
            icon: '👤',
            gradient: 'bg-gradient-to-br from-purple-500/20 to-violet-500/20',
            hoverGradient: 'bg-gradient-to-br from-purple-500 to-violet-500',
            accentColor: 'text-purple-400'
        }
    };

    return (
        <>
            <MetricSubCard title="Rendimiento Demográfico">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                        <GenderCard 
                            gender="male" 
                            metrics={maleMetrics} 
                            count={genderData.male.length}
                            config={genderConfigs.male}
                        />
                        <GenderCard 
                            gender="female" 
                            metrics={femaleMetrics} 
                            count={genderData.female.length}
                            config={genderConfigs.female}
                        />
                        <GenderCard 
                            gender="unknown" 
                            metrics={unknownMetrics} 
                            count={genderData.unknown.length}
                            config={genderConfigs.unknown}
                        />
                    </div>
                    
                    <div className="text-center pt-2 border-t border-brand-border/30">
                        <p className="text-xs text-brand-text-secondary">
                            💡 Haz clic en cualquier género para ver el análisis detallado
                        </p>
                    </div>
                </div>
            </MetricSubCard>

            {/* Demographic Modal */}
            {selectedModalGender && (
                <DemographicModal
                    isOpen={demographicModalOpen}
                    onClose={() => {
                        setDemographicModalOpen(false);
                        setSelectedModalGender(null);
                    }}
                    gender={selectedModalGender}
                    data={genderData[selectedModalGender]}
                    currency={currency}
                />
            )}
        </>
    );
};


const FunnelStep: React.FC<{label: string, value: number, prevValue: number | null, isLast: boolean}> = ({ label, value, prevValue, isLast }) => {
    
    const dropOff = prevValue !== null && prevValue > 0 ? 100 - ((value / prevValue) * 100) : 0;
    
    const getDropOffStatus = (dropOff: number): { color: string; icon: React.ReactElement } => {
        if (dropOff > 50) {
            return {
                color: 'bg-red-500/20 text-red-300',
                icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-4a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
            };
        }
        if (dropOff >= 30) {
            return {
                color: 'bg-yellow-500/20 text-yellow-300',
                icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-4a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
            };
        }
        return {
            color: 'bg-green-500/20 text-green-300',
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
        };
    };

    const dropOffStatus = getDropOffStatus(dropOff);

    return (
        <div className="relative group">
             <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-brand-text flex-1 truncate">{label}</p>
                <p className="text-sm font-bold text-brand-text">{value.toLocaleString('es-ES')}</p>
                 {prevValue !== null && (
                     <div className={`flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded ${dropOffStatus.color}`}>
                        {dropOffStatus.icon}
                        <span>-{dropOff.toFixed(1)}%</span>
                    </div>
                 )}
            </div>
            {!isLast && (
                 <div className="flex justify-center my-1">
                    <div className="h-3 w-px bg-brand-border group-hover:bg-brand-primary transition-colors"></div>
                 </div>
             )}
        </div>
    );
};

const EvolutionModal: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    currentMetrics: AdEvolutionMetrics,
    previousMetrics?: AdEvolutionMetrics,
    currency: string,
}> = ({ isOpen, onClose, currentMetrics, previousMetrics, currency }) => {
    
    const formatCurrency = (value: number) => value.toLocaleString('es-ES', { style: 'currency', currency });
    const formatNumber = (value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 0 });
    const formatDecimal = (value: number) => value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const ComparisonRow: React.FC<{ label: string, current: number, previous: number | undefined, format: (val: number) => string, isGoodUp: boolean }> = ({ label, current, previous, format, isGoodUp }) => {
        let changeText = 'N/A';
        let changeColor = 'text-brand-text-secondary';
        
        if (previous !== undefined && previous !== 0) {
            const change = ((current - previous) / previous) * 100;
            const isUp = change >= 0;
            const isGood = isGoodUp ? isUp : !isUp;
            changeColor = Math.abs(change) < 0.1 ? 'text-brand-text-secondary' : isGood ? 'text-green-400' : 'text-red-400';
            changeText = `${isUp ? '+' : ''}${change.toFixed(1)}%`;
        } else if (previous === 0 && current > 0) {
            changeText = '+∞%';
            changeColor = isGoodUp ? 'text-green-400' : 'text-red-400';
        }

        return (
            <div className="grid grid-cols-3 gap-4 items-center py-2 border-b border-brand-border/50 last:border-b-0">
                <div className="font-semibold text-brand-text">{label}</div>
                <div className="text-right font-mono">{previous !== undefined ? format(previous) : 'N/A'}</div>
                <div className="text-right font-mono flex items-center justify-end gap-2">
                    <span>{format(current)}</span>
                    <span className={`text-xs font-bold w-16 text-center py-0.5 rounded ${changeColor}`}>{changeText}</span>
                </div>
            </div>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="bg-brand-surface rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-2xl relative">
                <h2 className="text-xl font-bold text-brand-text mb-2">Evolución vs. Semana Anterior</h2>
                <p className="text-brand-text-secondary mb-6 text-sm">Comparativa de métricas clave del período actual contra el período anterior de igual duración.</p>
                 <div className="grid grid-cols-3 gap-4 text-xs font-bold text-brand-text-secondary uppercase tracking-wider mb-2">
                    <div className="">Métrica</div>
                    <div className="text-right">Semana Anterior</div>
                    <div className="text-right">Semana Actual</div>
                </div>
                <div className="space-y-1">
                    <ComparisonRow label="ROAS" current={currentMetrics.roas} previous={previousMetrics?.roas} format={formatDecimal} isGoodUp={true} />
                    <ComparisonRow label="Compras" current={currentMetrics.purchases} previous={previousMetrics?.purchases} format={formatNumber} isGoodUp={true} />
                    <ComparisonRow label="CPA" current={currentMetrics.cpa} previous={previousMetrics?.cpa} format={formatCurrency} isGoodUp={false} />
                    <ComparisonRow label="CPM" current={currentMetrics.cpm} previous={previousMetrics?.cpm} format={formatCurrency} isGoodUp={false} />
                    <ComparisonRow label="Frecuencia" current={currentMetrics.frequency} previous={previousMetrics?.frequency} format={formatDecimal} isGoodUp={false} />
                    <ComparisonRow label="Tasa de Compra" current={currentMetrics.tasaCompra} previous={previousMetrics?.tasaCompra} format={(v) => `${formatDecimal(v)}%`} isGoodUp={true} />
                    <ComparisonRow label="CTR (Link)" current={currentMetrics.ctrLink} previous={previousMetrics?.ctrLink} format={(v) => `${formatDecimal(v)}%`} isGoodUp={true} />
                </div>
            </div>
        </Modal>
    );
};


export const MetricsDetailModal: React.FC<MetricsDetailModalProps> = ({ isOpen, onClose, adData, accountAverages }) => {
    const [isEvolutionModalOpen, setIsEvolutionModalOpen] = useState(false);
    
    if (!isOpen || !adData) return null;

    const formatCurrency = (value: number) => value.toLocaleString('es-ES', { style: 'currency', currency: adData.currency });
    const formatNumber = (value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 0 });
    const formatDecimal = (value: number) => value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatPercent = (value: number) => `${formatDecimal(value)}%`;
    
    const funnelSteps = [
        { label: 'Impresiones', value: adData.impressions },
        { label: 'Alcance', value: adData.alcance },
        { label: 'Visitas a Página', value: adData.visitasLP },
        { label: 'Atención', value: adData.atencion },
        { label: 'Interés', value: adData.interes },
        { label: 'Deseo', value: adData.deseo },
        { label: 'Añadido al Carrito', value: adData.addsToCart },
        { label: 'Pago Iniciado', value: adData.checkoutsInitiated },
        { label: 'Compra', value: adData.purchases },
    ].filter(step => step.value > 0);

    const cleanAudienceName = (name: string) => name.split(':').pop()?.trim() || name;
    const cleanedIncludedAudiences = [...new Set(adData.includedCustomAudiences.map(cleanAudienceName))];
    const cleanedExcludedAudiences = [...new Set(adData.excludedCustomAudiences.map(cleanAudienceName))];

    return (
        <>
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="bg-brand-surface rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-6xl max-h-[90vh] flex flex-col relative">
                 <div className="flex justify-between items-start mb-4 flex-shrink-0 border-b border-brand-border pb-4">
                    <div className="flex items-center gap-4">
                        {adData.imageUrl && (
                            <img src={adData.imageUrl} alt="Creative Thumbnail" className="w-16 h-16 rounded-md object-cover bg-brand-bg flex-shrink-0" />
                        )}
                        <div>
                            <h2 className="text-2xl font-bold text-brand-text">Métricas Detalladas</h2>
                            <p className="text-brand-text-secondary truncate max-w-md" title={adData.adName}>{adData.adName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-brand-text-secondary hover:text-brand-text">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="overflow-y-auto pr-4 -mr-4 flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Column 1: Funnel */}
                    <div className="lg:col-span-1">
                        <MetricSubCard title="Embudo de Conversión">
                            <div className="space-y-1">
                                {funnelSteps.map((step, index) => (
                                    <FunnelStep 
                                        key={step.label}
                                        label={step.label}
                                        value={step.value}
                                        prevValue={index > 0 ? funnelSteps[index-1].value : null}
                                        isLast={index === funnelSteps.length - 1}
                                    />
                                ))}
                            </div>
                        </MetricSubCard>
                    </div>

                    {/* Column 2: Main Metrics */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <MetricSubCard title="Resultados Principales">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                                <MetricItem label="ROAS" value={formatDecimal(adData.roas)} average={accountAverages ? formatDecimal(accountAverages.roas) : undefined} isHighlighted />
                                <MetricItem label="Ventas" value={formatCurrency(adData.purchaseValue)} isHighlighted />
                                <MetricItem label="Tasa de Compra" value={formatPercent(adData.tasaCompra)} average={accountAverages ? formatPercent(accountAverages.tasaCompra) : undefined} isHighlighted />
                                <MetricItem label="Compras" value={formatNumber(adData.purchases)} />
                                <MetricItem label="Ticket Promedio" value={formatCurrency(adData.ticketPromedio)} />
                                <MetricItem label="Gasto" value={formatCurrency(adData.spend)} />
                            </div>
                        </MetricSubCard>
                       
                        <MetricSubCard title="Costes y Eficiencia">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                                <MetricItem label="CPA" value={formatCurrency(adData.cpa)} average={accountAverages ? formatCurrency(accountAverages.cpa) : undefined}/>
                                <MetricItem label="CPM" value={formatCurrency(adData.cpm)} average={accountAverages ? formatCurrency(accountAverages.cpm) : undefined}/>
                                <MetricItem label="CPC (Todo)" value={formatCurrency(adData.cpc)}/>
                                <MetricItem label="Frecuencia" value={formatDecimal(adData.frequency)} average={accountAverages ? formatDecimal(accountAverages.frequency) : undefined}/>
                            </div>
                        </MetricSubCard>
                        {adData.previousWeekMetrics && (
                            <div className="mt-auto">
                                <button 
                                    onClick={() => setIsEvolutionModalOpen(true)}
                                    className="w-full bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg transition-colors"
                                >
                                    Ver Evolución Semanal
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* Column 3: Interaction & Audience */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <MetricSubCard title="Interacción">
                           <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                               <MetricItem label="Clics (Enlace)" value={formatNumber(adData.linkClicks)} />
                               <MetricItem label="CTR (Enlace)" value={formatPercent(adData.ctrLink)} average={accountAverages ? formatPercent(accountAverages.ctrLink) : undefined}/>
                                <MetricItem label="Reacciones" value={formatNumber(adData.postReactions)} />
                                <MetricItem label="Comentarios" value={formatNumber(adData.postComments)} />
                                <MetricItem label="Compartidos" value={formatNumber(adData.postShares)} />
                                <MetricItem label="Me Gusta Página" value={formatNumber(adData.pageLikes)} />
                               {adData.creativeType === 'video' && (
                                   <>
                                    <MetricItem label="Tiempo Reprod." value={`${formatDecimal(adData.videoAveragePlayTime)}s`} />
                                    <MetricItem label="ThruPlays" value={formatNumber(adData.thruPlays)} />
                                   </>
                               )}
                           </div>
                        </MetricSubCard>
                        
                        <DemographicsCard demographics={adData.demographics} currency={adData.currency} />

                        <MetricSubCard title="Contexto y Audiencias">
                             <MetricItem label="Días Activos (Total)" value={formatNumber(adData.activeDays)} />
                             <InfoPill title="Públicos Incluidos" items={cleanedIncludedAudiences} type="included" />
                             <InfoPill title="Públicos Excluidos" items={cleanedExcludedAudiences} type="excluded" />
                        </MetricSubCard>
                    </div>

                </div>
            </div>
        </Modal>

        {adData.previousWeekMetrics && (
            <EvolutionModal
                isOpen={isEvolutionModalOpen}
                onClose={() => setIsEvolutionModalOpen(false)}
                currentMetrics={adData as Required<AdEvolutionMetrics>}
                previousMetrics={adData.previousWeekMetrics}
                currency={adData.currency}
            />
        )}
        </>
    );
};

// Modal específico para datos demográficos
const DemographicModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    gender: 'male' | 'female' | 'unknown';
    data: DemographicData[];
    currency: string;
}> = ({ isOpen, onClose, gender, data, currency }) => {
    if (!isOpen || data.length === 0) return null;

    const genderConfig = {
        male: {
            title: 'Rendimiento Masculino',
            icon: '👨',
            color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
            accentColor: 'text-blue-400'
        },
        female: {
            title: 'Rendimiento Femenino',
            icon: '👩',
            color: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
            accentColor: 'text-pink-400'
        },
        unknown: {
            title: 'Otros Géneros',
            icon: '👤',
            color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
            accentColor: 'text-purple-400'
        }
    };

    const config = genderConfig[gender];

    // Calcular métricas agregadas
    const totalMetrics = data.reduce((acc, d) => {
        acc.spend += d.spend;
        acc.purchaseValue += d.purchaseValue;
        acc.purchases += d.purchases;
        acc.impressions += d.impressions;
        acc.linkClicks += d.linkClicks;
        return acc;
    }, { spend: 0, purchaseValue: 0, purchases: 0, impressions: 0, linkClicks: 0 });

    const summaryMetrics = {
        roas: totalMetrics.spend > 0 ? totalMetrics.purchaseValue / totalMetrics.spend : 0,
        ctr: totalMetrics.impressions > 0 ? (totalMetrics.linkClicks / totalMetrics.impressions) * 100 : 0,
        cpa: totalMetrics.purchases > 0 ? totalMetrics.spend / totalMetrics.purchases : 0,
        cpm: totalMetrics.impressions > 0 ? (totalMetrics.spend / totalMetrics.impressions) * 1000 : 0,
    };

    // Datos ordenados por ROAS
    const sortedData = [...data].sort((a, b) => {
        const roasA = a.spend > 0 ? a.purchaseValue / a.spend : 0;
        const roasB = b.spend > 0 ? b.purchaseValue / b.spend : 0;
        return roasB - roasA;
    });

    const MetricCard: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent = false }) => (
        <div className="bg-brand-bg/50 rounded-xl p-4 text-center border border-brand-border/30">
            <div className="text-xs text-brand-text-secondary font-medium mb-1">{label}</div>
            <div className={`text-lg font-bold ${accent ? config.accentColor : 'text-brand-text'}`}>{value}</div>
        </div>
    );

    const ProgressBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => {
        const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
        return (
            <div className="w-full bg-brand-border/30 rounded-full h-2 overflow-hidden">
                <div 
                    className={`h-full transition-all duration-500 ${color}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>
        );
    };

    const maxRoas = Math.max(...sortedData.map(d => d.spend > 0 ? d.purchaseValue / d.spend : 0));
    const maxSpend = Math.max(...sortedData.map(d => d.spend));

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="bg-brand-surface rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col relative animate-fade-in">
                
                {/* Header */}
                <div className={`${config.color} p-6 rounded-t-xl border-b border-brand-border/20`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="text-3xl">{config.icon}</div>
                            <div>
                                <h3 className="text-xl font-bold text-brand-text">{config.title}</h3>
                                <p className="text-brand-text-secondary text-sm">{data.length} grupos demográficos</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            className="text-brand-text-secondary hover:text-brand-text transition-colors p-2 hover:bg-brand-bg/20 rounded-lg"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-6">
                    
                    {/* Resumen de métricas */}
                    <div className="mb-6">
                        <h4 className="text-lg font-semibold text-brand-text mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Resumen Global
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <MetricCard label="ROAS" value={summaryMetrics.roas.toFixed(2)} accent />
                            <MetricCard label="CTR" value={`${summaryMetrics.ctr.toFixed(2)}%`} />
                            <MetricCard label="CPA" value={summaryMetrics.cpa.toLocaleString('es-ES', { style: 'currency', currency })} />
                            <MetricCard label="CPM" value={summaryMetrics.cpm.toLocaleString('es-ES', { style: 'currency', currency })} />
                        </div>
                    </div>

                    {/* Detalle por grupo etario */}
                    <div>
                        <h4 className="text-lg font-semibold text-brand-text mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            Desglose por Edad
                        </h4>
                        
                        <div className="space-y-4">
                            {sortedData.map((demo, index) => {
                                const roas = demo.spend > 0 ? demo.purchaseValue / demo.spend : 0;
                                const cpa = demo.purchases > 0 ? demo.spend / demo.purchases : 0;
                                const cpm = demo.impressions > 0 ? (demo.spend / demo.impressions) * 1000 : 0;
                                const ctr = demo.impressions > 0 ? (demo.linkClicks / demo.impressions) * 100 : 0;
                                const frequency = 1; // Placeholder

                                return (
                                    <div key={index} className="bg-brand-bg/30 rounded-xl p-5 border border-brand-border/20 hover:border-brand-border/40 transition-all">
                                        
                                        {/* Header del grupo etario */}
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`${config.color} rounded-full px-3 py-1 text-sm font-bold`}>
                                                    #{index + 1}
                                                </div>
                                                <div>
                                                    <h5 className="font-bold text-brand-text text-lg">{demo.ageRange}</h5>
                                                    <p className="text-brand-text-secondary text-sm">{demo.purchases} compras</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm text-brand-text-secondary">Gasto</div>
                                                <div className="font-bold text-brand-text">{demo.spend.toLocaleString('es-ES', { style: 'currency', currency })}</div>
                                            </div>
                                        </div>

                                        {/* Métricas con barras de progreso */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                            
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-brand-text-secondary font-medium">ROAS</span>
                                                    <span className="text-sm font-bold text-brand-text">{roas.toFixed(2)}</span>
                                                </div>
                                                <ProgressBar value={roas} max={maxRoas} color="bg-gradient-to-r from-green-500 to-emerald-500" />
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-brand-text-secondary font-medium">CPA</span>
                                                    <span className="text-sm font-bold text-brand-text">{cpa.toLocaleString('es-ES', { style: 'currency', currency, maximumFractionDigits: 0 })}</span>
                                                </div>
                                                <ProgressBar value={demo.spend} max={maxSpend} color="bg-gradient-to-r from-blue-500 to-cyan-500" />
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-brand-text-secondary font-medium">CPM</span>
                                                    <span className="text-sm font-bold text-brand-text">{cpm.toLocaleString('es-ES', { style: 'currency', currency, maximumFractionDigits: 0 })}</span>
                                                </div>
                                                <ProgressBar value={demo.spend} max={maxSpend} color="bg-gradient-to-r from-purple-500 to-violet-500" />
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-brand-text-secondary font-medium">CTR</span>
                                                    <span className="text-sm font-bold text-brand-text">{ctr.toFixed(2)}%</span>
                                                </div>
                                                <ProgressBar value={ctr} max={10} color="bg-gradient-to-r from-orange-500 to-red-500" />
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-brand-text-secondary font-medium">Compras</span>
                                                    <span className="text-sm font-bold text-brand-text">{demo.purchases}</span>
                                                </div>
                                                <ProgressBar value={demo.purchases} max={Math.max(...sortedData.map(d => d.purchases))} color="bg-gradient-to-r from-pink-500 to-rose-500" />
                                            </div>

                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
