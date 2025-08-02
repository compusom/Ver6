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
    const topSegments = useMemo(() => {
        if (!demographics || demographics.length === 0) {
            return [];
        }

        const maxRoas = Math.max(...demographics.map(d => d.spend > 0 ? d.purchaseValue / d.spend : 0));
        const maxSales = Math.max(...demographics.map(d => d.purchaseValue));
        
        const scoredDemographics = demographics.map(d => {
            const roas = d.spend > 0 ? d.purchaseValue / d.spend : 0;
            
            const normalizedRoas = maxRoas > 0 ? roas / maxRoas : 0;
            const normalizedSales = maxSales > 0 ? d.purchaseValue / maxSales : 0;

            const score = (normalizedRoas * 0.5) + (normalizedSales * 0.5);
            return { ...d, score, roas };
        });

        return scoredDemographics.sort((a, b) => b.score - a.score).slice(0, 3);
    }, [demographics]);

    if (!demographics || demographics.length === 0) {
        return <MetricSubCard title="Rendimiento Demográfico"><p className="text-xs text-brand-text-secondary">No hay datos demográficos.</p></MetricSubCard>;
    }

    const formatLabel = (data: DemographicData) => {
        const gender = data.gender.toLowerCase() === 'female' ? 'Mujer' : data.gender.toLowerCase() === 'male' ? 'Hombre' : 'Otro';
        return `${gender} ${data.ageRange}`;
    };

    return (
        <MetricSubCard title="Rendimiento Demográfico">
             <div className="grid grid-cols-1 gap-4">
                {topSegments.length > 0 ? topSegments.map((segment, index) => (
                    <div key={index} className="border-b border-brand-border/50 pb-3 last:border-b-0 last:pb-0">
                        <p className="font-bold text-brand-text text-lg flex items-center gap-2">
                            <span className="text-sm font-mono bg-brand-primary/20 text-brand-primary rounded-full h-6 w-6 flex items-center justify-center">{index + 1}</span>
                            {formatLabel(segment)}
                        </p>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                            <div>
                                <p className="text-xs text-brand-text-secondary">Ventas</p>
                                <p className="text-sm font-semibold">{segment.purchaseValue.toLocaleString('es-ES', { style: 'currency', currency })}</p>
                            </div>
                            <div>
                                <p className="text-xs text-brand-text-secondary">ROAS</p>
                                <p className="text-sm font-semibold">{segment.roas.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-brand-text-secondary">CTR</p>
                                <p className="text-sm font-semibold">{`${(segment.impressions > 0 ? (segment.linkClicks / segment.impressions) * 100 : 0).toFixed(2)}%`}</p>
                            </div>
                        </div>
                    </div>
                )) : <p className="text-xs text-brand-text-secondary">No hay suficientes datos para mostrar un top.</p>}
            </div>
        </MetricSubCard>
    );
};


const FunnelStep: React.FC<{label: string, value: number, prevValue: number | null, isLast: boolean}> = ({ label, value, prevValue, isLast }) => {
    
    const dropOff = prevValue !== null && prevValue > 0 ? 100 - ((value / prevValue) * 100) : 0;
    
    const getDropOffStatus = (dropOff: number): { color: string; icon: JSX.Element } => {
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