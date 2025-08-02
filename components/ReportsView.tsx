
import React, { useState, useEffect, useMemo } from 'react';
import { Client, AllLookerData, BitacoraReport, ReportTable, WeeklyReportSummary, ParsedMetricValue, ReportRow } from '../types';
import Logger from '../Logger';

interface ReportsViewProps {
    clients: Client[];
    lookerData: AllLookerData;
    bitacoraReports: BitacoraReport[];
}

const KPICard: React.FC<{ label: string; data: ParsedMetricValue | string | undefined, icon: JSX.Element }> = ({ label, data, icon }) => {
    if (!data) return null;

    let valueStr = '';
    let changeIndicator: React.ReactNode = null;

    if (typeof data === 'object' && 'value' in data) {
        const options: Intl.NumberFormatOptions = {};
        if (data.symbol?.includes('€')) {
            options.style = 'currency';
            options.currency = 'EUR';
        } else {
            options.minimumFractionDigits = 2;
            options.maximumFractionDigits = 2;
        }
        valueStr = data.value.toLocaleString('es-ES', options);
        if (data.symbol && !data.symbol.includes('€')) {
            valueStr += ` ${data.symbol}`;
        }

        if (data.change !== undefined && data.direction && data.direction !== 'neutral') {
            const isUp = data.direction === 'up';
            const isGood = label.toLowerCase() === 'cpa' ? !isUp : isUp;
            changeIndicator = (
                <span className={`text-sm font-bold ${isGood ? 'text-green-300' : 'text-red-400'}`}>
                    {isUp ? '▲' : '▼'} {(data.change * 100).toFixed(1)}% vs sem. ant.
                </span>
            );
        }
    } else {
        valueStr = String(data);
    }
    
    return (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-lg hover:shadow-cyan-500/10 transition-shadow">
            <div className="flex items-center justify-between text-cyan-300">
                <p className="text-sm font-semibold uppercase tracking-wider">{label}</p>
                {icon}
            </div>
            <div>
                <p className="text-3xl font-bold text-white my-2">{valueStr}</p>
                <div className="h-5">{changeIndicator}</div>
            </div>
        </div>
    );
};

const FunnelChart: React.FC<{ table: ReportTable }> = ({ table }) => {
    const period = table.headers.find(h => h.includes('Semana actual')) || table.headers[1];
    if (!period) return null;
    
    const steps = table.rows.map(row => {
        const step = row['Paso del Embudo'];
        const valueData = row[period] as ParsedMetricValue | string;
        const value = typeof valueData === 'object' ? valueData.value : 0;
        return { name: String(step), value };
    }).filter(s => s.value > 0);

    let maxValue = 0;
    if (steps.length > 0) {
        maxValue = steps[0].value;
    }

    return (
        <div className="space-y-2">
            {steps.map((step, index) => {
                const widthPercentage = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
                return (
                    <div key={index} className="flex items-center gap-3 text-sm">
                        <div className="w-40 text-right truncate text-cyan-200">{step.name}</div>
                        <div className="flex-1 bg-gray-700/50 rounded-full h-6">
                            <div
                                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-6 rounded-full flex items-center justify-end pr-2"
                                style={{ width: `${widthPercentage}%` }}
                            >
                                <span className="font-bold text-white text-xs">{step.value.toLocaleString('es-ES')}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const ReportDataTable: React.FC<{ table: ReportTable, clientLookerData: AllLookerData[string] }> = ({ table, clientLookerData }) => {
    // Implement similar to existing component but with new futuristic styling
    return (
        <div className="overflow-x-auto">
             <table className="w-full text-sm text-left text-cyan-200">
                <thead className="text-xs text-cyan-100 uppercase bg-white/5">
                    <tr>
                         {table.headers.map(h => <th key={h} scope="col" className="px-4 py-3 whitespace-nowrap">{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {table.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-white/10 hover:bg-white/5">
                            {table.headers.map(header => {
                                const cellValue = row[header];
                                const adNameValue = row['Anuncio'];
                                const adName = typeof adNameValue === 'string' ? adNameValue : String(adNameValue?.value || '');
                                const lookerAd = adName ? clientLookerData[adName] : null;

                                if (header === 'Anuncio' && lookerAd?.imageUrl) {
                                    return (
                                        <td key={header} className="px-4 py-3 max-w-xs">
                                            <div className="flex items-center gap-3">
                                                <img src={lookerAd.imageUrl} alt={adName} className="h-10 w-10 rounded-md object-cover bg-brand-bg flex-shrink-0" />
                                                <span className="font-medium text-white truncate" title={adName}>{adName}</span>
                                            </div>
                                        </td>
                                    );
                                }
                                
                                if (typeof cellValue === 'object' && cellValue !== null && 'value' in cellValue) {
                                    const metric = cellValue as ParsedMetricValue;
                                    return (
                                        <td key={header} className="px-4 py-3 font-mono">
                                            <span>{(metric.symbol && !metric.symbol.includes('%')) ? metric.symbol : ''}{metric.value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{(metric.symbol && metric.symbol.includes('%')) ? metric.symbol : ''}</span>
                                            {metric.change !== undefined && (
                                                <span className={`ml-2 text-xs ${metric.direction === 'up' ? 'text-green-400' : metric.direction === 'down' ? 'text-red-400' : 'text-cyan-200'}`}>
                                                    ({(metric.change * 100).toFixed(1)}% {metric.direction === 'up' ? '▲' : '▼'})
                                                </span>
                                            )}
                                        </td>
                                    )
                                }
                                return <td key={header} className="px-4 py-3">{String(cellValue)}</td>
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

const parseWeekIdFromHeader = (header: string): string | null => {
    const match = header.match(/\((\d{1,2} \w{3,}\.? – \d{1,2} \w{3,}\.? \d{4})\)/);
    if (match && match[1]) {
        return match[1].replace(/[\s.]/g, '').replace('–', '_');
    }
    return null;
};

const extractMetricsFromRow = (rows: ReportRow[], columnName: string): WeeklyReportSummary['metrics'] => {
    const findMetric = (metricName: string) => {
        const row = rows.find(r => typeof r['Métrica'] === 'string' && r['Métrica'].toLowerCase() === metricName.toLowerCase());
        return row ? row[columnName] : 'N/A';
    };
    return {
        roas: findMetric('roas'),
        inversion: findMetric('inversion'),
        ventas: findMetric('ventas'),
        cpa: findMetric('cpa'),
    };
};

const monthMap: { [key: string]: number } = { 'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5, 'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11 };

const parseEndDateFromHeader = (header: string): Date | null => {
    const match = header.match(/– (\d{1,2}) (\w{3,})\.? (\d{4})/);
    if (match) {
        const [, day, monthStr, year] = match;
        const month = monthMap[monthStr.toLowerCase().substring(0,3)];
        if (day && month !== undefined && year) {
            return new Date(parseInt(year, 10), month, parseInt(day, 10));
        }
    }
    return null;
}

const MetricDisplay: React.FC<{ label: string, data: ParsedMetricValue | string | undefined }> = ({ label, data }) => {
    if (!data) return null;

    let valueStr = '';
    let changeIndicator: React.ReactNode = null;

    if (typeof data === 'object' && 'value' in data) {
        const options: Intl.NumberFormatOptions = {};
        if (data.symbol?.includes('€')) {
            options.style = 'currency';
            options.currency = 'EUR';
        } else {
            options.minimumFractionDigits = 2;
            options.maximumFractionDigits = 2;
        }
        valueStr = data.value.toLocaleString('es-ES', options);
        if (data.symbol && !data.symbol.includes('€')) {
            valueStr += ` ${data.symbol}`;
        }

        if (data.change !== undefined && data.direction && data.direction !== 'neutral') {
            const isUp = data.direction === 'up';
            const isGood = label.toLowerCase() === 'cpa' ? !isUp : isUp;
            changeIndicator = (
                <span className={`ml-1.5 text-xs font-bold ${isGood ? 'text-green-400' : 'text-red-400'}`}>
                    {isUp ? '▲' : '▼'} {(data.change * 100).toFixed(1)}%
                </span>
            );
        }
    } else {
        valueStr = String(data);
    }
    
    return (
        <div>
            <p className="text-xs text-brand-text-secondary uppercase">{label}</p>
            <p className="font-semibold text-brand-text text-lg">
                {valueStr}
                {changeIndicator}
            </p>
        </div>
    );
};


export const ReportsView: React.FC<ReportsViewProps> = ({ clients, lookerData, bitacoraReports }) => {
    const [selectedClientId, setSelectedClientId] = useState<string>('');
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (clients.length > 0 && !selectedClientId) {
            setSelectedClientId(clients[0].id);
        }
    }, [clients, selectedClientId]);

    const weeklySummaries = useMemo((): WeeklyReportSummary[] => {
        if (!selectedClientId) return [];

        const clientReports = bitacoraReports.filter(r => r.clientId === selectedClientId);
        const summariesMap = new Map<string, WeeklyReportSummary>();

        for (const report of clientReports) {
            if (!report.mainSummaryTable) continue;

            const table = report.mainSummaryTable;
            
            for (const header of table.headers) {
                if (header.toLowerCase() === 'métrica') continue;

                const weekId = parseWeekIdFromHeader(header);
                if (!weekId) continue;

                const newSummary: WeeklyReportSummary = {
                    weekId,
                    reportId: report.id,
                    periodLabel: header,
                    metrics: extractMetricsFromRow(table.rows, header),
                    importDate: report.importDate,
                };
                
                const existing = summariesMap.get(weekId);
                if (!existing || new Date(newSummary.importDate) > new Date(existing.importDate)) {
                    summariesMap.set(weekId, newSummary);
                }
            }
        }
        
        return Array.from(summariesMap.values()).sort((a, b) => {
            const dateA = parseEndDateFromHeader(a.periodLabel);
            const dateB = parseEndDateFromHeader(b.periodLabel);
            if (dateA && dateB) {
                return dateB.getTime() - dateA.getTime();
            }
            return new Date(b.importDate).getTime() - new Date(a.importDate).getTime();
        });

    }, [bitacoraReports, selectedClientId]);

    const selectedReport = useMemo(() => {
        return bitacoraReports.find(r => r.id === selectedReportId) || null;
    }, [bitacoraReports, selectedReportId]);
    
    const clientLookerData = lookerData[selectedClientId] || {};

    const kpiData = useMemo(() => {
        if (!selectedReport || !selectedReport.mainSummaryTable) return [];
        const table = selectedReport.mainSummaryTable;
        const period = table.headers.find(h => h.includes('Semana actual')) || table.headers[1];
        if (!period) return [];
        const metrics = extractMetricsFromRow(table.rows, period);
        return [
            { label: "Inversión", data: metrics.inversion, icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-1.134 0V7.151c.196.062.387.148.567.267zM11.567 7.418c.155-.103.346-.196.567-.267v1.698a2.5 2.5 0 00-1.134 0V7.151c.196.062.387.148.567.267z" /><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.5 4.5 0 00-1.876.763.5.5 0 00.374.938 3.5 3.5 0 013.704 0 .5.5 0 00.374-.938A4.5 4.5 0 0011 5.092V5zM10 14a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg> },
            { label: "Ventas", data: metrics.ventas, icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4z" clipRule="evenodd" /></svg> },
            { label: "ROAS", data: metrics.roas, icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg> },
            { label: "CPA", data: metrics.cpa, icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg> },
        ]
    }, [selectedReport]);


    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
             <header className="text-center">
                <h1 className="text-4xl font-bold tracking-tight text-brand-text sm:text-5xl">Visor de Reportes de Bitácora</h1>
                <p className="mt-4 text-lg text-brand-text-secondary">Selecciona un cliente y un reporte para ver el análisis detallado de la cuenta.</p>
            </header>

            <div className="bg-brand-surface rounded-lg p-6 shadow-lg">
                <div className="max-w-sm mb-6">
                     <label htmlFor="client-selector-reports" className="block text-sm font-medium text-brand-text-secondary mb-1">Seleccionar Cliente</label>
                    <select
                        id="client-selector-reports"
                        value={selectedClientId}
                        onChange={(e) => {
                            setSelectedClientId(e.target.value);
                            setSelectedReportId(null);
                        }}
                        className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-3 focus:ring-brand-primary focus:border-brand-primary"
                        disabled={clients.length === 0}
                    >
                        {clients.length > 0 ? clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>) : <option>No hay clientes</option>}
                    </select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    <aside className="md:col-span-4 lg:col-span-3">
                        <h2 className="font-bold text-brand-text mb-2">Resúmenes Semanales</h2>
                        <div className="bg-brand-bg rounded-md p-2 space-y-2 max-h-[70vh] overflow-y-auto">
                            {isLoading && <p className="text-sm text-brand-text-secondary p-2">Cargando reportes...</p>}
                            {!isLoading && weeklySummaries.length === 0 && <p className="text-sm text-brand-text-secondary p-2">No hay reportes semanales para este cliente.</p>}
                            {weeklySummaries.map(summary => (
                                <div 
                                    key={summary.weekId}
                                    className={`w-full text-left p-3 rounded-md transition-all duration-300 ${selectedReportId === summary.reportId ? 'bg-brand-primary/10 ring-2 ring-brand-primary' : 'bg-brand-border/30 hover:bg-brand-border/50'}`}
                                >
                                    <button
                                         onClick={() => setSelectedReportId(summary.reportId)}
                                         className="w-full text-left font-semibold block text-brand-text mb-3"
                                    >
                                        {summary.periodLabel}
                                    </button>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                       <MetricDisplay label="ROAS" data={summary.metrics.roas} />
                                       <MetricDisplay label="Inversión" data={summary.metrics.inversion} />
                                       <MetricDisplay label="Ventas" data={summary.metrics.ventas} />
                                       <MetricDisplay label="CPA" data={summary.metrics.cpa} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </aside>
                    <main className="md:col-span-8 lg:col-span-9">
                        {selectedReport ? (
                            <div className="space-y-8">
                                <h2 className="text-3xl font-bold text-cyan-300">Revisión Global: {selectedReport.mainSummaryTable?.headers[1].match(/\((.*?)\)/)?.[1]}</h2>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {kpiData.map(kpi => <KPICard key={kpi.label} {...kpi} />)}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                    <div className="lg:col-span-3 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-lg">
                                        <h3 className="font-semibold text-cyan-300 mb-4">Embudo de Conversión</h3>
                                        {selectedReport.funnelAnalysisTable ? <FunnelChart table={selectedReport.funnelAnalysisTable} /> : <p className="text-sm text-cyan-200/50">Datos de embudo no disponibles.</p>}
                                    </div>
                                    <div className="lg:col-span-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-lg">
                                        <h3 className="font-semibold text-cyan-300 mb-4">Tendencia de Ratios</h3>
                                        {selectedReport.ratioTrendsTable ? <ReportDataTable table={selectedReport.ratioTrendsTable} clientLookerData={{}} /> : <p className="text-sm text-cyan-200/50">Datos de tendencias no disponibles.</p>}
                                    </div>
                                </div>

                                {selectedReport.topAdsTables.map((table, i) => (
                                    <div key={`top-ads-${i}`} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-lg">
                                        <h3 className="font-semibold text-cyan-300 mb-3">{table.title}</h3>
                                        <ReportDataTable table={table} clientLookerData={clientLookerData} />
                                    </div>
                                ))}

                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full bg-brand-bg rounded-lg border-2 border-dashed border-brand-border">
                                <div className="text-center p-8">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-brand-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="mt-4 font-semibold text-brand-text">Selecciona un resumen semanal</p>
                                    <p className="text-brand-text-secondary">Elige un resumen de la lista de la izquierda para ver su contenido detallado.</p>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
};
