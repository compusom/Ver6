import React, { useState, useEffect, useMemo } from 'react';
import { Client, PerformanceRecord } from '../types';
import { DateRangePicker } from './DateRangePicker';
import { MiniLineChart } from './MiniLineChart';

interface FunnelViewProps {
    clients: Client[];
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
};

const calculateMetricsForPeriod = (records: PerformanceRecord[], clientCurrency: string) => {
    const totals = records.reduce((acc, r) => {
        acc.spend += r.spend;
        acc.reach += r.reach;
        acc.impressions += r.impressions;
        acc.landingPageViews += r.landingPageViews;
        acc.attention += r.attention;
        acc.interest += r.interest;
        acc.deseo += r.desire;
        acc.addsToCart += r.addsToCart;
        acc.checkoutsInitiated += r.checkoutsInitiated;
        acc.purchases += r.purchases;
        acc.frequencyTotal += r.frequency * r.impressions;
        return acc;
    }, {
        spend: 0, reach: 0, impressions: 0, landingPageViews: 0,
        attention: 0, interest: 0, deseo: 0, addsToCart: 0,
        checkoutsInitiated: 0, purchases: 0, frequencyTotal: 0
    });

    const frequency = totals.impressions > 0 ? totals.frequencyTotal / totals.impressions : 0;
    const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
    const costVisit = totals.landingPageViews > 0 ? totals.spend / totals.landingPageViews : 0;
    const costAttention = totals.attention > 0 ? totals.spend / totals.attention : 0;
    const costInterest = totals.interest > 0 ? totals.spend / totals.interest : 0;
    const costDeseo = totals.deseo > 0 ? totals.spend / totals.deseo : 0;
    const costAddToCart = totals.addsToCart > 0 ? totals.spend / totals.addsToCart : 0;
    const costCheckout = totals.checkoutsInitiated > 0 ? totals.spend / totals.checkoutsInitiated : 0;
    const cpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0;

    return {
        Inversion: totals.spend, Alcance: totals.reach, Impresiones: totals.impressions,
        Visitas: totals.landingPageViews, Atencion: totals.attention, Interes: totals.interest,
        Deseo: totals.deseo, AddToCart: totals.addsToCart, InicioPago: totals.checkoutsInitiated,
        Compras: totals.purchases,
        cost: {
            Frecuencia: frequency, CPM: cpm, Visita: costVisit, Atencion: costAttention,
            Interes: costInterest, Deseo: costDeseo, AddToCart: costAddToCart,
            Checkout: costCheckout, Compra: cpa
        }
    };
};

const FunnelStage: React.FC<{
    label: string;
    value: number;
    change: number;
    chartData: { date: string, value: number }[];
    isCurrency?: boolean;
    currencySymbol?: string;
    costLabel: string;
    costValue: number;
}> = ({ label, value, change, chartData, isCurrency, currencySymbol, costLabel, costValue }) => {
    const formatValue = (val: number) => {
        if (isCurrency) {
            return val.toLocaleString('es-ES', { style: 'currency', currency: currencySymbol || 'EUR', minimumFractionDigits: 2 });
        }
        return val.toLocaleString('es-ES');
    };
    
    const changeColor = change >= 0 ? 'text-green-400' : 'text-red-400';
    const changeIcon = change >= 0 ? '▲' : '▼';

    return (
        <div className="flex items-center gap-4 w-full">
            <div className="w-1/6 text-right font-semibold text-brand-text">{label}</div>
            <div className="w-1/6 text-left">
                <p className="text-2xl font-bold text-brand-text">{formatValue(value)}</p>
                <p className={`text-sm font-semibold ${changeColor}`}>{changeIcon} {Math.abs(change * 100).toFixed(1)}%</p>
                <p className="text-xs text-brand-text-secondary">Periodo Posterior</p>
            </div>
            <div className="w-3/6">
                <MiniLineChart data={chartData} color={label === 'Inversion' ? '#3B82F6' : '#F97316'} />
            </div>
            <div className="w-1/6">
                <div className="bg-blue-900/50 p-3 rounded-lg text-center">
                    <p className="text-xs text-blue-300">{costLabel}</p>
                    <p className="text-lg font-bold text-white">{isCurrency ? formatValue(costValue) : costValue.toFixed(2)}</p>
                    {/* Placeholder for cost change */}
                    <p className="text-xs text-brand-text-secondary opacity-50">↑ 0.0%</p>
                </div>
            </div>
        </div>
    );
};

export const FunnelView: React.FC<FunnelViewProps> = ({ clients, performanceData, startDate, endDate, onDateChange }) => {
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    useEffect(() => {
        if (clients.length > 0 && !selectedClientId) {
            setSelectedClientId(clients[0].id);
        }
    }, [clients, selectedClientId]);

    const funnelData = useMemo(() => {
        if (!selectedClientId) return null;

        const client = clients.find(c => c.id === selectedClientId);
        if (!client) return null;

        const clientPerfData = performanceData[selectedClientId] || [];

        // Current period data
        const start = new Date(startDate);
        const end = new Date(endDate);
        const currentPeriodRecords = clientPerfData.filter(r => {
            const recordDate = parseDate(r.day);
            return recordDate && recordDate >= start && recordDate <= end;
        });

        // Previous period data
        const periodLength = (end.getTime() - start.getTime());
        const prevStart = new Date(start.getTime() - periodLength - 1);
        const prevEnd = new Date(end.getTime() - periodLength - 1);
        const previousPeriodRecords = clientPerfData.filter(r => {
            const recordDate = parseDate(r.day);
            return recordDate && recordDate >= prevStart && recordDate <= prevEnd;
        });
        
        // 14-day trend data
        const trendEndDate = new Date();
        const trendStartDate = new Date();
        trendStartDate.setDate(trendEndDate.getDate() - 13);
        const trendRecords = clientPerfData.filter(r => {
             const recordDate = parseDate(r.day);
            return recordDate && recordDate >= trendStartDate && recordDate <= trendEndDate;
        });
        
        const dailyTrendData = Array.from({ length: 14 }, (_, i) => {
            const date = new Date();
            date.setDate(trendEndDate.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            const recordsForDay = trendRecords.filter(r => parseDate(r.day)?.toISOString().split('T')[0] === dateString);
            return { date: dateString, records: recordsForDay };
        }).reverse();

        const getDailyMetric = (metric: keyof PerformanceRecord) => dailyTrendData.map(d => ({
            date: d.date,
            value: d.records.reduce((sum, r) => sum + (r[metric] as number || 0), 0)
        }));

        const currentMetrics = calculateMetricsForPeriod(currentPeriodRecords, client.currency);
        const previousMetrics = calculateMetricsForPeriod(previousPeriodRecords, client.currency);

        const getChange = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 1 : 0;
            return (current - previous) / previous;
        };

        const stages = [
            { label: 'Inversion', value: currentMetrics.Inversion, prevValue: previousMetrics.Inversion, chartData: getDailyMetric('spend'), isCurrency: true, costLabel: 'Frecuencia', costValue: currentMetrics.cost.Frecuencia },
            { label: 'Alcance', value: currentMetrics.Alcance, prevValue: previousMetrics.Alcance, chartData: getDailyMetric('reach'), costLabel: 'CPM', costValue: currentMetrics.cost.CPM, isCurrencyCost: true },
            { label: 'Impresiones', value: currentMetrics.Impresiones, prevValue: previousMetrics.Impresiones, chartData: getDailyMetric('impressions'), costLabel: 'CPM', costValue: currentMetrics.cost.CPM, isCurrencyCost: true },
            { label: 'Visitas', value: currentMetrics.Visitas, prevValue: previousMetrics.Visitas, chartData: getDailyMetric('landingPageViews'), costLabel: 'Cost. Visita', costValue: currentMetrics.cost.Visita, isCurrencyCost: true },
            { label: 'Atención', value: currentMetrics.Atencion, prevValue: previousMetrics.Atencion, chartData: getDailyMetric('attention'), costLabel: 'Cost. Atencion', costValue: currentMetrics.cost.Atencion, isCurrencyCost: true },
            { label: 'Interés', value: currentMetrics.Interes, prevValue: previousMetrics.Interes, chartData: getDailyMetric('interest'), costLabel: 'Cost. Interés', costValue: currentMetrics.cost.Interes, isCurrencyCost: true },
            { label: 'Deseo', value: currentMetrics.Deseo, prevValue: previousMetrics.Deseo, chartData: getDailyMetric('desire'), costLabel: 'Cost. Deseo', costValue: currentMetrics.cost.Deseo, isCurrencyCost: true },
            { label: 'AddToCart', value: currentMetrics.AddToCart, prevValue: previousMetrics.AddToCart, chartData: getDailyMetric('addsToCart'), costLabel: 'Cost. AddToCart', costValue: currentMetrics.cost.AddToCart, isCurrencyCost: true },
            { label: 'Inicio Pago', value: currentMetrics.InicioPago, prevValue: previousMetrics.InicioPago, chartData: getDailyMetric('checkoutsInitiated'), costLabel: 'Cost. Checkout', costValue: currentMetrics.cost.Checkout, isCurrencyCost: true },
            { label: 'Compras', value: currentMetrics.Compras, prevValue: previousMetrics.Compras, chartData: getDailyMetric('purchases'), costLabel: 'Cost. Compra', costValue: currentMetrics.cost.Compra, isCurrencyCost: true },
        ];
        
        return {
            client,
            stages: stages.map(s => ({ ...s, change: getChange(s.value, s.prevValue) }))
        };

    }, [selectedClientId, startDate, endDate, performanceData, clients]);

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
            <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-brand-text">Embudo de Conversión</h2>
                    <p className="text-brand-text-secondary mt-1">Visualiza el rendimiento completo de la cuenta.</p>
                </div>
                 <div className="flex items-center gap-4">
                     <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="bg-brand-surface border border-brand-border text-brand-text rounded-md p-2.5 focus:ring-brand-primary focus:border-brand-primary"
                    >
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <DateRangePicker onDateChange={onDateChange} startDate={startDate} endDate={endDate} />
                </div>
            </header>

            <div className="bg-brand-surface p-6 rounded-lg shadow-lg">
                {funnelData ? (
                    <div className="space-y-4">
                        {funnelData.stages.map((stage, index) => (
                             <div key={stage.label} className="flex flex-col items-center">
                                <FunnelStage 
                                    label={stage.label}
                                    value={stage.value}
                                    change={stage.change}
                                    chartData={stage.chartData}
                                    isCurrency={stage.isCurrency}
                                    currencySymbol={funnelData.client.currency}
                                    costLabel={stage.costLabel}
                                    costValue={stage.costValue}
                                />
                                {index < funnelData.stages.length - 1 && (
                                     <div className="h-8 w-px bg-brand-border my-2 flex items-center justify-center">
                                        <svg className="h-4 w-4 text-brand-text-secondary" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16">
                        <p className="text-brand-text-secondary">Selecciona un cliente para ver el embudo.</p>
                    </div>
                )}
            </div>
        </div>
    );
};