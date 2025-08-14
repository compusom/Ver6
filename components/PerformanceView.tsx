import React, { useState, useEffect, useMemo } from 'react';
import { notify } from './notificationService';
import { Client, PerformanceRecord, AggregatedAdPerformance, AllLookerData, CreativeSet, AnalysisResult, UploadedVideo, Creative, AppView, AccountAverages, DemographicData, AdEvolutionMetrics } from '../types';
import { AdPerformanceCard } from './AdPerformanceCard';
import { AggregatedPerformanceTable } from './AggregatedPerformanceTable';
import { DateRangePicker } from './DateRangePicker';
import { AiAnalysisModal } from './AiAnalysisModal';
import { AnalysisDetailModal } from './AnalysisDetailModal';
import { VideoUploadModal } from './VideoUploadModal';
import db from '../database';
import Logger from '../Logger';
import { MetricsDetailModal } from './MetricsDetailModal';
import { DataSourceSwitch } from './DataSourceSwitch';
import { dimensionalManager, DimensionalStatus } from '../database/dimensional_manager';

type FilterMode = 'all' | 'image' | 'video';
type DisplayMode = 'table' | 'cards';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const getCreativeFromFile = (file: File, objectUrl: string): Promise<Creative> => {
    return new Promise((resolve, reject) => {
        const type = file.type.startsWith('image/') ? 'image' : 'video';
        
        const processCreative = (width: number, height: number, hash: string) => {
            const aspectRatio = width / height;
            const newCreative: Creative = { file, url: objectUrl, type, width, height, format: aspectRatio >= 1 ? 'square' : 'vertical', hash };
            resolve(newCreative);
        };

        const calculateHash = async (file: File) => {
            const buffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        };

        if (type === 'image') {
            const element = new Image();
            element.onload = async () => {
                const hash = await calculateHash(file);
                processCreative(element.naturalWidth, element.naturalHeight, hash);
            };
            element.onerror = (err) => {
                URL.revokeObjectURL(objectUrl);
                reject(err);
            };
            element.src = objectUrl;
        } else { // video
            const element = document.createElement('video');
            element.onloadedmetadata = async () => {
                const hash = await calculateHash(file);
                processCreative(element.videoWidth, element.videoHeight, hash);
            };
            element.onerror = (err) => {
                URL.revokeObjectURL(objectUrl);
                reject(err);
            };
            element.src = objectUrl;
        }
    });
};

const parseDate = (dateString: string): Date | null => {
    if (!dateString) return null;
    const parts = dateString.split('/');
    if (parts.length === 3) {
        // DD/MM/YYYY
        const [day, month, year] = parts.map(Number);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            return new Date(year, month - 1, day);
        }
    }
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
}

const formatCurrency = (value: number, currency?: string) => {
    const code = currency || 'USD';
    if (!currency) {
        Logger.warn(`[PerformanceView] Missing currency for value ${value}, defaulting to ${code}`);
    }
    try {
        return value.toLocaleString('es-ES', { style: 'currency', currency: code });
    } catch (e) {
        Logger.warn(`[PerformanceView] Currency format failed for ${currency}, using USD`);
        return value.toLocaleString('es-ES', { style: 'currency', currency: 'USD' });
    }
};

interface PerformanceViewProps {
    clients: Client[]; 
    getPerformanceAnalysis: (data: AggregatedAdPerformance[], client: Client) => Promise<string>;
    getFormatAnalysis: (creativeSet: CreativeSet, formatGroup: 'SQUARE_LIKE' | 'VERTICAL', language: 'es' | 'en', context: string, isVideo: boolean) => Promise<AnalysisResult | null>;
    lookerData: AllLookerData;
    setLookerData: React.Dispatch<React.SetStateAction<AllLookerData>>;
    performanceData: { [key: string]: PerformanceRecord[] };
    uploadedVideos: UploadedVideo[];
    setUploadedVideos: React.Dispatch<React.SetStateAction<UploadedVideo[]>>;
    startDate: string;
    endDate: string;
    onDateChange: (start: string, end: string) => void;
}

type View = 'list' | 'detail';

export const PerformanceView: React.FC<PerformanceViewProps> = ({ clients, getPerformanceAnalysis, getFormatAnalysis, lookerData, setLookerData, performanceData, uploadedVideos, setUploadedVideos, startDate, endDate, onDateChange }) => {
    
    // Validación más permisiva - si clients no es un array, usar array vacío
    const safeClients = Array.isArray(clients) ? clients : [];
    const safePerformanceData = performanceData && typeof performanceData === 'object' ? performanceData : {};
    
    // Solo mostrar error si los datos deberían estar cargados (no es loading)
    if (!Array.isArray(clients)) {
        console.warn('[PerformanceView] clients is not an array, using empty array:', clients);
    }
    
    if (!performanceData || typeof performanceData !== 'object') {
        console.warn('[PerformanceView] performanceData is invalid, using empty object:', performanceData);
    }
    
    const [view, setView] = useState<View>('list');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [displayMode, setDisplayMode] = useState<DisplayMode>('cards');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [dimensionalStatus, setDimensionalStatus] = useState<DimensionalStatus>(DimensionalStatus.NOT_INITIALIZED);
    const [dimensionalData, setDimensionalData] = useState<any[]>([]);
    const [useDimensional, setUseDimensional] = useState(false);
    const [dimensionalClientSummaries, setDimensionalClientSummaries] = useState<Record<string, any>>({});

    // Debug: Log whenever performanceData changes
    useEffect(() => {
        Logger.info('[PerformanceView] performanceData changed:', {
            totalClients: Object.keys(safePerformanceData).length,
            dataStructure: Object.keys(safePerformanceData).map(clientId => ({
                clientId,
                recordCount: Array.isArray(safePerformanceData[clientId]) ? safePerformanceData[clientId].length : 'not array',
                firstRecord: Array.isArray(safePerformanceData[clientId]) && safePerformanceData[clientId].length > 0 ? safePerformanceData[clientId][0] : null
            }))
        });
    }, [safePerformanceData]);

    // Verificar estado del sistema dimensional
    useEffect(() => {
        const checkDimensional = async () => {
            try {
                await dimensionalManager.initialize();
                const status = dimensionalManager.getStatus();
                setDimensionalStatus(status);
                
                // Solo usar dimensional si está READY y tiene datos
                let hasData = false;
                if (status === DimensionalStatus.READY) {
                    try {
                        const stats = await dimensionalManager.getSystemStats();
                        hasData = stats && stats.factRecords > 0;
                        Logger.info('[PerformanceView] Sistema dimensional stats:', stats);
                    } catch (error) {
                        Logger.warn('[PerformanceView] Error getting dimensional stats:', error);
                    }
                }
                
                setUseDimensional(status === DimensionalStatus.READY && hasData);
                
                if (status === DimensionalStatus.READY && hasData) {
                    Logger.info('[PerformanceView] Sistema dimensional disponible con datos');
                } else if (status === DimensionalStatus.READY) {
                    Logger.warn('[PerformanceView] Sistema dimensional sin datos, usando sistema tradicional');
                } else {
                    Logger.warn('[PerformanceView] Sistema dimensional no disponible, estado:', status);
                }
            } catch (error) {
                Logger.error('[PerformanceView] Error checking dimensional system:', error);
                setUseDimensional(false);
            }
        };
        
        checkDimensional();
    }, []);

    useEffect(() => {
        if (selectedClient && !safeClients.some(c => c.id === selectedClient.id)) {
            setSelectedClient(null);
        }
    }, [safeClients, selectedClient]);
    const [bulkAnalysisState, setBulkAnalysisState] = useState({ active: false, current: 0, total: 0 });
    const [accountAverages, setAccountAverages] = useState<AccountAverages | null>(null);

    const [generatingAnalysis, setGeneratingAnalysis] = useState<{[adName: string]: boolean}>({});
    
    const [isConclusionModalOpen, setIsConclusionModalOpen] = useState(false);
    const [conclusionContent, setConclusionContent] = useState('');
    const [isConclusionLoading, setIsConclusionLoading] = useState(false);

    const [isAnalysisDetailModalOpen, setIsAnalysisDetailModalOpen] = useState(false);
    const [selectedAdForAnalysisDetail, setSelectedAdForAnalysisDetail] = useState<AggregatedAdPerformance | null>(null);

    const [isMetricsDetailModalOpen, setIsMetricsDetailModalOpen] = useState(false);
    const [selectedAdForMetricsDetail, setSelectedAdForMetricsDetail] = useState<AggregatedAdPerformance | null>(null);
    
    const [isVideoUploadModalOpen, setIsVideoUploadModalOpen] = useState(false);
    const [adForVideoUpload, setAdForVideoUpload] = useState<AggregatedAdPerformance | null>(null);

    useEffect(() => {
        if (!selectedClient || !safePerformanceData[selectedClient.id]) {
            setAccountAverages(null);
            return;
        }

        const allClientData = safePerformanceData[selectedClient.id];
        if (allClientData.length === 0) {
            setAccountAverages(null);
            return;
        }

        const totals = allClientData.reduce((acc, r) => {
            acc.spend += r.spend;
            acc.purchases += r.purchases;
            acc.purchaseValue += r.purchaseValue;
            acc.impressions += r.impressions;
            acc.linkClicks += r.linkClicks;
            acc.frequencyTotal += r.frequency * r.impressions;
            acc.landingPageViews += r.landingPageViews;
            return acc;
        }, { spend: 0, purchases: 0, purchaseValue: 0, impressions: 0, linkClicks: 0, frequencyTotal: 0, landingPageViews: 0 });

        const averages: AccountAverages = {
            roas: totals.spend > 0 ? totals.purchaseValue / totals.spend : 0,
            cpa: totals.purchases > 0 ? totals.spend / totals.purchases : 0,
            ctrLink: totals.impressions > 0 ? (totals.linkClicks / totals.impressions) * 100 : 0,
            cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
            frequency: totals.impressions > 0 ? totals.frequencyTotal / totals.impressions : 0,
            tasaCompra: totals.landingPageViews > 0 ? (totals.purchases / totals.landingPageViews) * 100 : 0,
        };

        setAccountAverages(averages);

    }, [selectedClient, safePerformanceData]);

    // Cargar datos dimensionales cuando sea necesario
    useEffect(() => {
        const loadDimensionalData = async () => {
            if (!useDimensional || !selectedClient) return;
            
            try {
                Logger.info('[PerformanceView] Loading dimensional data for client:', selectedClient.name);
                const filters = {
                    startDate,
                    endDate,
                    accountName: selectedClient.name
                };
                
                const data = await dimensionalManager.getPerformanceData(filters);
                if (data) {
                    setDimensionalData(data);
                    Logger.success(`[PerformanceView] Loaded ${data.length} dimensional records`);
                } else {
                    setDimensionalData([]);
                }
            } catch (error) {
                Logger.error('[PerformanceView] Error loading dimensional data:', error);
                setDimensionalData([]);
            }
        };
        
        loadDimensionalData();
    }, [useDimensional, selectedClient, startDate, endDate]);

    // Cargar resúmenes de clientes dimensionales solo si es necesario
    useEffect(() => {
        const loadDimensionalClientSummaries = async () => {
            if (!useDimensional || safeClients.length === 0) {
                Logger.info('[PerformanceView] Skipping dimensional summaries:', { useDimensional, clientsCount: safeClients.length });
                // Limpiar summaries dimensionales si no los usamos
                setDimensionalClientSummaries({});
                return;
            }
            
            Logger.info('[PerformanceView] Loading dimensional summaries for', safeClients.length, 'clients');
            const summaries: Record<string, any> = {};
            
            for (const client of safeClients) {
                try {
                    const filters = {
                        startDate,
                        endDate,
                        accountName: client.name
                    };
                    
                    Logger.info(`[PerformanceView] Loading data for client ${client.name} with filters:`, filters);
                    const data = await dimensionalManager.getPerformanceData(filters);
                    Logger.info(`[PerformanceView] Got ${data?.length || 0} records for client ${client.name}`);
                    
                    if (!data || data.length === 0) {
                        Logger.warn(`[PerformanceView] No data found for client ${client.name}`);
                        summaries[client.id] = { ...client, gastoTotal: 0, roas: 0, totalAds: 0, matchedCount: 0 };
                        continue;
                    }
                    
                    // Agregar métricas desde datos dimensionales
                    const gastoTotal = data.reduce((acc, row) => acc + (row.spend || 0), 0);
                    const valorTotal = data.reduce((acc, row) => acc + (row.conversion_value || 0), 0);
                    const roas = gastoTotal > 0 ? valorTotal / gastoTotal : 0;
                    
                    const uniqueAds = new Set(data.map(r => r.ad_name));
                    const clientLookerData = lookerData[client.id] || {};
                    const matchedCount = Array.from(uniqueAds).filter(adName => !!clientLookerData[adName]?.imageUrl).length;

                    summaries[client.id] = { ...client, gastoTotal, roas, totalAds: uniqueAds.size, matchedCount };
                    
                } catch (error) {
                    Logger.error(`[PerformanceView] Error loading summary for client ${client.name}:`, error);
                    // En caso de error, desactivar dimensional y usar sistema tradicional
                    setUseDimensional(false);
                    setDimensionalClientSummaries({});
                    return;
                }
            }
            
            setDimensionalClientSummaries(summaries);
            Logger.info('[PerformanceView] Loaded dimensional client summaries for', Object.keys(summaries).length, 'clients');
        };
        
        if (useDimensional) {
            loadDimensionalClientSummaries();
        } else {
            setDimensionalClientSummaries({});
        }
    }, [useDimensional, safeClients, startDate, endDate, lookerData]);

    const filteredPerformanceData = useMemo(() => {
        Logger.info('[PerformanceView] NO FILTERS - Using all data globally');
        
        // SIN FILTROS - Usar todos los datos directamente
        const filtered: { [key: string]: PerformanceRecord[] } = {};
        for (const clientId in safePerformanceData) {
            const clientData = safePerformanceData[clientId];
            if (Array.isArray(clientData)) {
                // NO APLICAR FILTROS - usar todos los datos
                filtered[clientId] = clientData;
                Logger.info(`[PerformanceView] Client ${clientId}: ${clientData.length} total records (NO FILTERS)`);
                
                // Log muestra de datos para debug
                if (clientData.length > 0) {
                    Logger.info(`[PerformanceView] Sample data for client ${clientId}:`, clientData[0]);
                }
            } else {
                console.warn(`[PerformanceView] performanceData[${clientId}] is not an array:`, clientData);
                filtered[clientId] = [];
            }
        }
        return filtered;
    }, [safePerformanceData]);

    const clientSummaries = useMemo(() => {
        // Si el sistema dimensional está activo y tenemos resúmenes cargados, usarlos
        if (useDimensional && Object.keys(dimensionalClientSummaries).length > 0) {
            Logger.info('[PerformanceView] Using dimensional client summaries');
            return safeClients.map(client => dimensionalClientSummaries[client.id] || { ...client, gastoTotal: 0, roas: 0, totalAds: 0, matchedCount: 0 });
        }
        
        // Fallback al sistema tradicional (pero sin filtros restrictivos)
        Logger.info('[PerformanceView] Using traditional data for client summaries');
        return safeClients.map(client => {
            const clientData = filteredPerformanceData[client.id];
            // Validar que clientData es un array
            const data = Array.isArray(clientData) ? clientData : [];
            const clientLookerData = lookerData[client.id] || {};
            
            Logger.info(`[PerformanceView] Processing client ${client.name} with ${data.length} records`);
            
            if (data.length === 0) {
                return { ...client, gastoTotal: 0, roas: 0, totalAds: 0, matchedCount: 0 };
            }
            const gastoTotal = data.reduce((acc, row) => acc + (row.spend || 0), 0);
            const valorTotal = data.reduce((acc, row) => acc + (row.purchaseValue || 0), 0);
            const roas = gastoTotal > 0 ? valorTotal / gastoTotal : 0;
            
            const uniqueAds = new Set(data.map(r => r.adName));
            const matchedCount = Array.from(uniqueAds).filter(adName => !!clientLookerData[adName]?.imageUrl).length;

            const summary = { ...client, gastoTotal, roas, totalAds: uniqueAds.size, matchedCount };
            Logger.info(`[PerformanceView] Client ${client.name} summary:`, summary);
            return summary;
        });
    }, [safeClients, filteredPerformanceData, lookerData, useDimensional, dimensionalClientSummaries]);

    const aggregatedClientData = useMemo<AggregatedAdPerformance[]>(() => {
        if (!selectedClient) return [];
        
        Logger.info(`[PerformanceView] Loading aggregated data for client ${selectedClient.name}`);
        
        // Si usamos datos dimensionales, procesarlos de manera diferente
        if (useDimensional && dimensionalData.length > 0) {
            Logger.info('[PerformanceView] Using dimensional data for aggregated client data');
            return processeDimensionalClientData(selectedClient, dimensionalData);
        }
        
        // Fallback al sistema tradicional
        const allPerformanceDataForClient = performanceData[selectedClient.id] || [];
        const performanceDataForPeriod = filteredPerformanceData[selectedClient.id] || [];
        
        Logger.info(`[PerformanceView] Traditional data - All: ${allPerformanceDataForClient.length}, Period: ${performanceDataForPeriod.length}`);
        
        // QUITAR TODOS LOS FILTROS - Mostrar absolutamente TODO
        const activePerformanceData = performanceDataForPeriod; // SIN FILTROS
        const clientLookerData = lookerData[selectedClient.id] || {};
        
        Logger.info(`[PerformanceView] NO FILTERS - Using ALL data: ${activePerformanceData.length} records`);
        
        if (activePerformanceData.length === 0) {
            Logger.warn('[PerformanceView] No active performance data found after filtering');
            // Vamos a agregar más información para debug
            if (performanceDataForPeriod.length > 0) {
                Logger.info('[PerformanceView] Sample of available data:', performanceDataForPeriod.slice(0, 2));
                const adsWithoutNames = performanceDataForPeriod.filter(r => !r.adName || r.adName.trim().length === 0);
                Logger.warn(`[PerformanceView] Found ${adsWithoutNames.length} records without ad names`);
            }
            return [];
        }

        const adsByName = activePerformanceData.reduce((acc, record) => {
            // Permitir nombres de anuncios vacíos o nulos - asignar un nombre genérico
            const adName = record.adName || `Sin_Nombre_${Math.random().toString(36).substr(2, 9)}`;
            if (!acc[adName]) acc[adName] = [];
            acc[adName].push(record);
            return acc;
        }, {} as Record<string, PerformanceRecord[]>);

        Logger.info(`[PerformanceView] Grouped ads by name: ${Object.keys(adsByName).length} unique ads`);
        Logger.info(`[PerformanceView] Ad names found:`, Object.keys(adsByName));

        const allAggregated = Object.entries(adsByName).map(([adName, records]) => {
            // Validar que records es un array
            const validRecords = Array.isArray(records) ? records : [];
            const totals = validRecords.reduce((acc, r) => {
                // Convertir a números para evitar problemas de suma
                acc.spend += parseFloat(r.spend) || 0;
                acc.purchases += parseInt(r.purchases) || 0;
                acc.purchaseValue += parseFloat(r.purchaseValue) || 0;
                acc.impressions += parseInt(r.impressions) || 0;
                acc.reach += parseInt(r.reach) || 0;
                acc.clicks += parseInt(r.clicksAll) || 0;
                acc.linkClicks += parseInt(r.linkClicks) || 0;
                acc.thruPlays += parseInt(r.thruPlays) || 0;
                acc.frequencyTotal += (parseFloat(r.frequency) || 0) * (parseInt(r.impressions) || 0);
                acc.landingPageViews += parseInt(r.landingPageViews) || 0;
                acc.addsToCart += parseInt(r.addsToCart) || 0;
                acc.checkoutsInitiated += parseInt(r.checkoutsInitiated) || 0;
                acc.postInteractions += parseInt(r.postInteractions) || 0;
                acc.postReactions += parseInt(r.postReactions) || 0;
                acc.postComments += parseInt(r.postComments) || 0;
                acc.postShares += parseInt(r.postShares) || 0;
                acc.pageLikes += parseInt(r.pageLikes) || 0;
                acc.atencion += parseInt(r.attention) || 0;
                acc.interes += parseInt(r.interest) || 0;
                acc.deseo += parseInt(r.desire) || 0;
                
                // Manejar tiempo de video promedio ponderado por impresiones
                const videoTime = parseFloat(r.videoAveragePlayTime) || 0;
                const impressions = parseInt(r.impressions) || 0;
                if (videoTime > 0 && impressions > 0) {
                    acc.videoAveragePlayTimeWeightedTotal += videoTime * impressions;
                    acc.videoImpressions += impressions;
                }
                return acc;
            }, { 
                spend: 0, purchases: 0, purchaseValue: 0, impressions: 0, reach: 0, clicks: 0, 
                linkClicks: 0, thruPlays: 0, videoAveragePlayTimeWeightedTotal: 0, videoImpressions: 0, 
                frequencyTotal: 0, landingPageViews: 0, addsToCart: 0, checkoutsInitiated: 0, 
                postInteractions: 0, postReactions: 0, postComments: 0, postShares: 0, pageLikes: 0,
                atencion: 0, interes: 0, deseo: 0 
            });

            const allRecordsForAd = allPerformanceDataForClient.filter(r => r.adName === adName);
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

            // Cálculos de métricas corregidos con redondeo apropiado
            const roas = totals.spend > 0 ? Math.round((totals.purchaseValue / totals.spend) * 100) / 100 : 0;
            const cpa = totals.purchases > 0 ? Math.round((totals.spend / totals.purchases) * 100) / 100 : 0;
            const cpm = totals.impressions > 0 ? Math.round(((totals.spend / totals.impressions) * 1000) * 100) / 100 : 0;
            const ctr = totals.impressions > 0 ? Math.round(((totals.clicks / totals.impressions) * 100) * 100) / 100 : 0;
            const ctrLink = totals.impressions > 0 ? Math.round(((totals.linkClicks / totals.impressions) * 100) * 100) / 100 : 0;
            const frequency = totals.impressions > 0 ? Math.round((totals.frequencyTotal / totals.impressions) * 100) / 100 : 1;
            const videoAveragePlayTime = totals.videoImpressions > 0 ? Math.round((totals.videoAveragePlayTimeWeightedTotal / totals.videoImpressions) * 100) / 100 : 0;
            const ticketPromedio = totals.purchases > 0 ? Math.round((totals.purchaseValue / totals.purchases) * 100) / 100 : 0;
            const cpc = totals.clicks > 0 ? Math.round((totals.spend / totals.clicks) * 100) / 100 : 0;
            const tasaVisitaLP = totals.linkClicks > 0 ? Math.round(((totals.landingPageViews / totals.linkClicks) * 100) * 100) / 100 : 0;
            const tasaCompra = totals.landingPageViews > 0 ? Math.round(((totals.purchases / totals.landingPageViews) * 100) * 100) / 100 : 0;
            
            const lookerMatch = clientLookerData[adName];
            const inMultipleAdSets = new Set(validRecords.map(r => r.adSetName)).size > 1;
            const videoFileName = validRecords.find(r => r.videoFileName)?.videoFileName;
            
            const isVideo = !!videoFileName || (validRecords.some(r => r.thruPlays > 0) && videoAveragePlayTime > 1);
            const creativeType: 'image' | 'video' | undefined = isVideo ? 'video' : (lookerMatch?.imageUrl ? 'image' : undefined);
            
            const isVideoUploaded = creativeType === 'video' ? uploadedVideos.some(v => v.clientId === selectedClient.id && v.adName === adName) : false;

            return { 
                adName, adSetNames, campaignNames, includedCustomAudiences, excludedCustomAudiences, spend: totals.spend, 
                purchases: totals.purchases, purchaseValue: totals.purchaseValue, impressions: totals.impressions, 
                clicks: totals.clicks, linkClicks: totals.linkClicks, roas, cpa, cpm, ctr, ctrLink, frequency, 
                videoAveragePlayTime, thruPlays: totals.thruPlays, isMatched: !!lookerMatch, 
                creativeDescription: lookerMatch?.creativeDescription, currency: selectedClient.currency, 
                inMultipleAdSets, imageUrl: lookerMatch?.imageUrl, adPreviewLink: lookerMatch?.adPreviewLink, 
                creativeType, analysisResult: lookerMatch?.analysisResult, videoFileName, isVideoUploaded, 
                ticketPromedio, alcance: totals.reach, cpc, visitasLP: totals.landingPageViews, tasaVisitaLP, 
                tasaCompra, addsToCart: totals.addsToCart, checkoutsInitiated: totals.checkoutsInitiated, 
                postInteractions: totals.postInteractions, postReactions: totals.postReactions, 
                postComments: totals.postComments, postShares: totals.postShares, pageLikes: totals.pageLikes,
                activeDays, atencion: totals.atencion, interes: totals.interes, deseo: totals.deseo, demographics: [] 
            };
        }).sort((a,b) => b.roas - a.roas);

        const finalResult = filterMode === 'all' ? allAggregated : allAggregated.filter(ad => ad.creativeType === filterMode);
        Logger.info(`[PerformanceView] Final aggregated data: ${finalResult.length} ads for client ${selectedClient.name}`);
        return finalResult;
    }, [selectedClient, filteredPerformanceData, performanceData, lookerData, filterMode, uploadedVideos, useDimensional, dimensionalData]);

    // Función para procesar datos dimensionales
    const processeDimensionalClientData = (client: Client, dimData: any[]): AggregatedAdPerformance[] => {
        const clientLookerData = lookerData[client.id] || {};
        
        if (dimData.length === 0) return [];

        // Agrupar por nombre de anuncio
        const adsByName = dimData.reduce((acc, record) => {
            const adName = record.ad_name;
            if (!adName) return acc;
            if (!acc[adName]) acc[adName] = [];
            acc[adName].push(record);
            return acc;
        }, {} as Record<string, any[]>);

        const allAggregated = Object.entries(adsByName).map(([adName, records]) => {
            const validRecords = Array.isArray(records) ? records : [];
            const totals = validRecords.reduce((acc, r) => {
                // Convertir a números para evitar problemas de suma (dimensional)
                acc.spend += parseFloat(r.spend) || 0;
                acc.purchases += parseInt(r.purchases) || 0;
                acc.purchaseValue += parseFloat(r.conversion_value) || 0;
                acc.impressions += parseInt(r.impressions) || 0;
                acc.reach += parseInt(r.reach) || 0;
                acc.clicks += parseInt(r.clicks_all) || 0;
                acc.linkClicks += parseInt(r.link_clicks) || 0;
                acc.thruPlays += parseInt(r.thruplays) || 0;
                acc.frequencyTotal += (parseFloat(r.frequency) || 0) * (parseInt(r.impressions) || 0);
                acc.landingPageViews += parseInt(r.landing_page_views) || 0;
                acc.addsToCart += parseInt(r.add_to_cart) || 0;
                acc.checkoutsInitiated += parseInt(r.initiate_checkout) || 0;
                acc.postInteractions += parseInt(r.post_interactions) || 0;
                acc.postReactions += parseInt(r.post_reactions) || 0;
                acc.postComments += parseInt(r.post_comments) || 0;
                acc.postShares += parseInt(r.post_shares) || 0;
                acc.pageLikes += parseInt(r.page_likes) || 0;
                acc.atencion += parseInt(r.atencion) || 0;
                acc.interes += parseInt(r.interes) || 0;
                acc.deseo += parseInt(r.deseo) || 0;
                
                // Manejar tiempo de video promedio ponderado por impresiones
                const videoTime = parseFloat(r.avg_watch_time) || 0;
                const impressions = parseInt(r.impressions) || 0;
                if (videoTime > 0 && impressions > 0) {
                    acc.videoAveragePlayTimeWeightedTotal += videoTime * impressions;
                    acc.videoImpressions += impressions;
                }
                return acc;
            }, { 
                spend: 0, purchases: 0, purchaseValue: 0, impressions: 0, reach: 0, clicks: 0, 
                linkClicks: 0, thruPlays: 0, videoAveragePlayTimeWeightedTotal: 0, videoImpressions: 0, 
                frequencyTotal: 0, landingPageViews: 0, addsToCart: 0, checkoutsInitiated: 0, 
                postInteractions: 0, postReactions: 0, postComments: 0, postShares: 0, pageLikes: 0,
                atencion: 0, interes: 0, deseo: 0 
            });

            // Calcular métricas derivadas con redondeo apropiado (dimensional)
            const roas = totals.spend > 0 ? Math.round((totals.purchaseValue / totals.spend) * 100) / 100 : 0;
            const cpa = totals.purchases > 0 ? Math.round((totals.spend / totals.purchases) * 100) / 100 : 0;
            const cpm = totals.impressions > 0 ? Math.round(((totals.spend / totals.impressions) * 1000) * 100) / 100 : 0;
            const ctr = totals.impressions > 0 ? Math.round(((totals.clicks / totals.impressions) * 100) * 100) / 100 : 0;
            const ctrLink = totals.impressions > 0 ? Math.round(((totals.linkClicks / totals.impressions) * 100) * 100) / 100 : 0;
            const frequency = totals.impressions > 0 ? Math.round((totals.frequencyTotal / totals.impressions) * 100) / 100 : 1;
            const videoAveragePlayTime = totals.videoImpressions > 0 ? Math.round((totals.videoAveragePlayTimeWeightedTotal / totals.videoImpressions) * 100) / 100 : 0;
            const ticketPromedio = totals.purchases > 0 ? Math.round((totals.purchaseValue / totals.purchases) * 100) / 100 : 0;
            const cpc = totals.clicks > 0 ? Math.round((totals.spend / totals.clicks) * 100) / 100 : 0;
            const tasaVisitaLP = totals.linkClicks > 0 ? Math.round(((totals.landingPageViews / totals.linkClicks) * 100) * 100) / 100 : 0;
            const tasaCompra = totals.landingPageViews > 0 ? Math.round(((totals.purchases / totals.landingPageViews) * 100) * 100) / 100 : 0;
            
            const lookerMatch = clientLookerData[adName];
            const isVideo = totals.thruPlays > 0 || videoAveragePlayTime > 1;
            const creativeType: 'image' | 'video' | undefined = isVideo ? 'video' : (lookerMatch?.imageUrl ? 'image' : undefined);
            const isVideoUploaded = creativeType === 'video' ? uploadedVideos.some(v => v.clientId === client.id && v.adName === adName) : false;

            // Obtener información adicional del primer registro
            const firstRecord = validRecords[0] || {};
            const adSetNames = [...new Set(validRecords.map(r => r.adset_name))];
            const campaignNames = [...new Set(validRecords.map(r => r.campaign_name))];

            return { 
                adName, 
                adSetNames, 
                campaignNames, 
                includedCustomAudiences: [], // TODO: implementar desde dimensional
                excludedCustomAudiences: [], // TODO: implementar desde dimensional
                spend: totals.spend, 
                purchases: totals.purchases, 
                purchaseValue: totals.purchaseValue, 
                impressions: totals.impressions, 
                clicks: totals.clicks, 
                linkClicks: totals.linkClicks, 
                roas, 
                cpa, 
                cpm, 
                ctr, 
                ctrLink, 
                frequency, 
                videoAveragePlayTime, 
                thruPlays: totals.thruPlays, 
                isMatched: !!lookerMatch, 
                creativeDescription: lookerMatch?.creativeDescription, 
                currency: client.currency, 
                inMultipleAdSets: adSetNames.length > 1,
                imageUrl: lookerMatch?.imageUrl, 
                adPreviewLink: lookerMatch?.adPreviewLink, 
                creativeType, 
                analysisResult: lookerMatch?.analysisResult, 
                videoFileName: firstRecord.video_filename || undefined, 
                isVideoUploaded, 
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
                activeDays: new Set(validRecords.map(r => r.date)).size,
                atencion: totals.atencion, 
                interes: totals.interes, 
                deseo: totals.deseo, 
                demographics: [] 
            };
        }).sort((a,b) => b.roas - a.roas);

        return filterMode === 'all' ? allAggregated : allAggregated.filter(ad => ad.creativeType === filterMode);
    };
    
    const hasLinkedAdsWithAnalysis = useMemo(() => aggregatedClientData.some(ad => ad.isMatched && ad.creativeDescription), [aggregatedClientData]);
    const adsToAnalyzeCount = useMemo(() => aggregatedClientData.filter(ad => ad.isMatched && ad.imageUrl && !ad.creativeDescription && (ad.creativeType === 'image' || (ad.creativeType === 'video' && ad.isVideoUploaded))).length, [aggregatedClientData]);
    
    const handleClientSelect = (client: Client) => { setSelectedClient(client); setDisplayMode('cards'); setFilterMode('all'); setView('detail'); };
    
    const handleAiConclusion = async () => {
        if (!selectedClient) return;
        const dataToAnalyze = aggregatedClientData.filter(ad => ad.isMatched && ad.creativeDescription);
        if (dataToAnalyze.length === 0) {
            notify("No hay anuncios con análisis de IA en el período y filtro seleccionado. Genere o actualice análisis para algunos anuncios primero.", 'info');
            return;
        }

        setIsConclusionLoading(true); setIsConclusionModalOpen(true); setConclusionContent('');
        const result = await getPerformanceAnalysis(dataToAnalyze, selectedClient);
        setConclusionContent(result); setIsConclusionLoading(false);
    }

    const handleUpdateCreativeAnalysis = async (ad: AggregatedAdPerformance) => {
        if (!selectedClient || !ad.imageUrl) return;
        setGeneratingAnalysis(prev => ({...prev, [ad.adName]: true}));

        try {
            const isVideo = ad.creativeType === 'video';
            let file: File;
            
            if (isVideo) {
                 const uploadedVideo = uploadedVideos.find(v => v.clientId === selectedClient.id && v.adName === ad.adName);
                 if (!uploadedVideo) throw new Error("No se encontró el archivo de video subido.");
                 const response = await fetch(uploadedVideo.dataUrl);
                 const blob = await response.blob();
                 file = new File([blob], uploadedVideo.videoFileName, { type: blob.type });
            } else {
                const response = await fetch(ad.imageUrl);
                const blob = await response.blob();
                file = new File([blob], ad.adName, { type: blob.type });
            }

            const objectUrl = URL.createObjectURL(file);
            const creativeSet: CreativeSet = isVideo
                ? { square: null, vertical: null, videoFile: file }
                : await getCreativeFromFile(file, objectUrl).then(c => {
                    URL.revokeObjectURL(objectUrl);
                    return {
                      square: c.format === 'square' ? c : null,
                      vertical: c.format === 'vertical' ? c : null,
                    }
                });
            
            const formatGroup = isVideo ? 'VERTICAL' : (creativeSet.square ? 'SQUARE_LIKE' : 'VERTICAL');
            
            const context = `Análisis del creativo para el anuncio llamado "${ad.adName}" del cliente "${selectedClient.name}".`;
            const result = await getFormatAnalysis(creativeSet, formatGroup, 'es', context, isVideo);
            
            if (result && !result.overallConclusion.headline.toLowerCase().includes('error')) {
                setLookerData(current => {
                    const newLookerData = JSON.parse(JSON.stringify(current));
                    if (!newLookerData[selectedClient.id]) newLookerData[selectedClient.id] = {};
                    newLookerData[selectedClient.id][ad.adName] = { ...newLookerData[selectedClient.id][ad.adName], imageUrl: ad.imageUrl, creativeDescription: result.creativeDescription, analysisResult: result };
                    return newLookerData;
                });
            } else {
                 throw new Error(result?.overallConclusion?.checklist[0]?.text || 'Unknown analysis error');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Error desconocido";
            notify(`Error al analizar creativo para "${ad.adName}": ${message}`, 'error');
        } finally {
            setGeneratingAnalysis(prev => ({...prev, [ad.adName]: false}));
        }
    };
    
    const handleBulkGenerateAnalysis = async () => {
        const adsToAnalyze = aggregatedClientData.filter(ad => ad.isMatched && ad.imageUrl && !ad.creativeDescription && (ad.creativeType === 'image' || (ad.creativeType === 'video' && ad.isVideoUploaded)));
        if (adsToAnalyze.length === 0) return;
    
        setBulkAnalysisState({ active: true, current: 0, total: adsToAnalyze.length });
    
        for (let i = 0; i < adsToAnalyze.length; i++) {
            const ad = adsToAnalyze[i];
            setBulkAnalysisState(prev => ({ ...prev, current: i + 1 }));
            try {
                await handleUpdateCreativeAnalysis(ad);
            } catch (error: unknown) {
                Logger.error<unknown>(`Bulk analysis failed for ${ad.adName}, continuing...`, error);
            }
        }
    
        setBulkAnalysisState({ active: false, current: 0, total: 0 });
        notify('Análisis en masa completado.', 'success');
    };

    const handleShowAnalysisDetail = (ad: AggregatedAdPerformance) => { setSelectedAdForAnalysisDetail(ad); setIsAnalysisDetailModalOpen(true); };
    
    const handleShowMetricsDetail = (ad: AggregatedAdPerformance) => {
        if (!selectedClient) return;

        const allClientPerfData = performanceData[selectedClient.id] || [];
        const allRecordsForAd = allClientPerfData.filter(r => r.adName === ad.adName);
        
        const demographics = allRecordsForAd.reduce((acc, record) => {
            const age = record.age || 'Unknown';
            const gender = record.gender || 'Unknown';
            const key = `${gender}-${age}`;
            if (!acc[key]) {
                acc[key] = { ageRange: age, gender, spend: 0, purchases: 0, purchaseValue: 0, linkClicks: 0, impressions: 0 };
            }
            acc[key].spend += record.spend;
            acc[key].purchases += record.purchases;
            acc[key].purchaseValue += record.purchaseValue;
            acc[key].linkClicks += record.linkClicks;
            acc[key].impressions += record.impressions;
            return acc;
        }, {} as Record<string, DemographicData>);

        // Previous week metrics calculation
        const start = new Date(startDate);
        const prevEnd = new Date(start.getTime() - (24 * 60 * 60 * 1000));
        const prevStart = new Date(prevEnd.getTime() - (6 * 24 * 60 * 60 * 1000));

        const previousWeekRecords = allRecordsForAd.filter(r => {
            const recordDate = parseDate(r.day);
            return recordDate && recordDate >= prevStart && recordDate <= prevEnd;
        });

        let previousWeekMetrics: AdEvolutionMetrics | undefined = undefined;

        if (previousWeekRecords.length > 0) {
            const totals = previousWeekRecords.reduce((acc, r) => {
                acc.spend += r.spend;
                acc.purchases += r.purchases;
                acc.purchaseValue += r.purchaseValue;
                acc.impressions += r.impressions;
                acc.linkClicks += r.linkClicks;
                acc.landingPageViews += r.landingPageViews;
                acc.frequencyTotal += r.frequency * r.impressions;
                return acc;
            }, { spend: 0, purchases: 0, purchaseValue: 0, impressions: 0, linkClicks: 0, landingPageViews: 0, frequencyTotal: 0 });

            previousWeekMetrics = {
                spend: totals.spend,
                roas: totals.spend > 0 ? totals.purchaseValue / totals.spend : 0,
                cpa: totals.purchases > 0 ? totals.spend / totals.purchases : 0,
                ctrLink: totals.impressions > 0 ? (totals.linkClicks / totals.impressions) * 100 : 0,
                tasaCompra: totals.landingPageViews > 0 ? (totals.purchases / totals.landingPageViews) * 100 : 0,
                purchases: totals.purchases,
                cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
                frequency: totals.impressions > 0 ? totals.frequencyTotal / totals.impressions : 0,
            };
        }
        
        const adWithDetails: AggregatedAdPerformance = { 
            ...ad, 
            demographics: Object.values(demographics),
            previousWeekMetrics 
        };
        
        setSelectedAdForMetricsDetail(adWithDetails);
        setIsMetricsDetailModalOpen(true);
    };

    const handleOpenVideoUpload = (ad: AggregatedAdPerformance) => { setAdForVideoUpload(ad); setIsVideoUploadModalOpen(true); };
    
    const handleVideoSave = async (adName: string, videoFile: File) => {
        if (!selectedClient) return;
        try {
            const dataUrl = await fileToBase64(videoFile);
            const newVideo: UploadedVideo = { id: `${selectedClient.id}_${adName}`, clientId: selectedClient.id, adName: adName, videoFileName: videoFile.name, dataUrl: dataUrl };
            const updatedVideos = [...uploadedVideos.filter(v => v.id !== newVideo.id), newVideo];
            setUploadedVideos(updatedVideos);
        } catch (error) {
            notify("Ocurrió un error al guardar el video.", 'error');
        } finally {
            setIsVideoUploadModalOpen(false);
            setAdForVideoUpload(null);
        }
    };

    if (view === 'list') {
        // Mostrar mensaje informativo si no hay clientes
        if (safeClients.length === 0) {
            return (
                <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
                    <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-brand-text">Rendimiento por Cliente</h2>
                            <p className="text-brand-text-secondary mt-1">Gestiona el rendimiento de las campañas publicitarias.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <DataSourceSwitch />
                            <DateRangePicker onDateChange={onDateChange} startDate={startDate} endDate={endDate} />
                        </div>
                    </header>

                    <div className="bg-blue-900/20 border border-blue-500 rounded-lg p-8 text-center">
                        <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-brand-text mb-2">No hay clientes configurados</h3>
                        <p className="text-brand-text-secondary mb-4">
                            Para ver datos de rendimiento, primero necesitas configurar clientes en el sistema.
                        </p>
                        <p className="text-sm text-brand-text-secondary">
                            Ve a la sección <strong>Clientes</strong> en el menú para agregar clientes, o <strong>Importar</strong> para cargar datos.
                        </p>
                    </div>
                </div>
            );
        }

        return (
            <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
                <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-brand-text">Rendimiento por Cliente</h2>
                        <p className="text-brand-text-secondary mt-1">Selecciona un cliente para ver el detalle de sus anuncios.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <DataSourceSwitch />
                        {useDimensional && (
                            <div className="flex items-center gap-1 bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                DW Activo
                            </div>
                        )}
                        {dimensionalStatus === DimensionalStatus.READY && !useDimensional && (
                            <div className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs font-bold">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                DW Sin Datos
                            </div>
                        )}
                        <DateRangePicker onDateChange={onDateChange} startDate={startDate} endDate={endDate} />
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clientSummaries.map(client => (
                        <button key={client.id} onClick={() => handleClientSelect(client)} className="bg-brand-surface p-4 rounded-lg shadow-md hover:shadow-xl hover:shadow-brand-primary/20 transition-all text-left flex flex-col items-start">
                            <div className="flex items-center gap-3 w-full mb-4">
                                <img src={client.logo} alt={client.name} className="h-10 w-10 rounded-full bg-brand-border" />
                                <h3 className="font-bold text-brand-text flex-1 truncate">{client.name}</h3>
                            </div>
                            <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div className="text-brand-text-secondary">Gasto Total:</div>
                                <div className="font-semibold text-brand-text text-right">{formatCurrency(client.gastoTotal, client.currency)}</div>
                                <div className="text-brand-text-secondary">ROAS:</div>
                                <div className="font-semibold text-brand-text text-right">{client.roas.toFixed(2)}</div>
                                <div className="text-brand-text-secondary">Anuncios:</div>
                                <div className="font-semibold text-brand-text text-right">{client.totalAds}</div>
                                <div className="text-brand-text-secondary">Creativos Vinculados:</div>
                                <div className="font-semibold text-brand-text text-right">{client.matchedCount} / {client.totalAds}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    }
    
    if (view === 'detail' && selectedClient) {
        return (
            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
                <header>
                    <button onClick={() => setView('list')} className="mb-4 flex items-center gap-2 text-sm text-brand-text-secondary hover:text-brand-text">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        Volver a la lista de clientes
                    </button>
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <img src={selectedClient.logo} alt={selectedClient.name} className="h-12 w-12 rounded-full bg-brand-border" />
                            <div>
                                <h2 className="text-2xl font-bold text-brand-text">Rendimiento de {selectedClient.name}</h2>
                                <p className="text-brand-text-secondary">Datos del {new Date(startDate).toLocaleDateString('es-ES')} al {new Date(endDate).toLocaleDateString('es-ES')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <DataSourceSwitch />
                            <DateRangePicker onDateChange={onDateChange} startDate={startDate} endDate={endDate} />
                        </div>
                    </div>
                </header>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-4 bg-brand-surface rounded-lg shadow-md">
                     <div className="flex items-center flex-wrap gap-x-6 gap-y-4">
                        <div className="flex items-center gap-2">
                           <span className="text-sm font-semibold text-brand-text-secondary">Filtro:</span>
                            <div className="flex rounded-lg bg-brand-border p-1">
                                <button onClick={() => setFilterMode('all')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${filterMode === 'all' ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-brand-surface'}`}>Todos</button>
                                <button onClick={() => setFilterMode('image')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${filterMode === 'image' ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-brand-surface'}`}>Imágenes</button>
                                <button onClick={() => setFilterMode('video')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${filterMode === 'video' ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-brand-surface'}`}>Videos</button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-brand-text-secondary">Vista:</span>
                            <div className="flex rounded-lg bg-brand-border p-1">
                                <button onClick={() => setDisplayMode('table')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${displayMode === 'table' ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-brand-surface'}`}>Tabla</button>
                                <button onClick={() => setDisplayMode('cards')} className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${displayMode === 'cards' ? 'bg-brand-primary text-white' : 'text-brand-text-secondary hover:bg-brand-surface'}`}>Tarjetas</button>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 self-end md:self-center">
                        <button
                            onClick={handleBulkGenerateAnalysis}
                            disabled={adsToAnalyzeCount === 0 || bulkAnalysisState.active}
                            title={adsToAnalyzeCount === 0 ? 'No hay creativos sin analizar' : 'Generar análisis para todos los creativos faltantes'}
                            className="bg-brand-border hover:bg-brand-border/70 text-brand-text font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                        >
                            {bulkAnalysisState.active ? `Analizando ${bulkAnalysisState.current}/${bulkAnalysisState.total}...` : `Generar ${adsToAnalyzeCount} Faltantes`}
                        </button>
                        <button 
                            onClick={handleAiConclusion}
                            disabled={!hasLinkedAdsWithAnalysis || isConclusionLoading}
                            title={!hasLinkedAdsWithAnalysis ? 'Se requiere al menos un anuncio con análisis de IA para generar la conclusión.' : 'Generar conclusión estratégica de IA'}
                            className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span>{isConclusionLoading ? 'Analizando...' : 'Conclusión de IA'}</span>
                        </button>
                    </div>
                </div>
                
                <div>
                    {displayMode === 'table' ? (
                        <AggregatedPerformanceTable data={aggregatedClientData} onShowMetricsDetail={handleShowMetricsDetail} onShowAnalysisDetail={handleShowAnalysisDetail} onUpdateAnalysis={handleUpdateCreativeAnalysis} generatingAnalysis={generatingAnalysis} onUploadVideo={handleOpenVideoUpload} />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {aggregatedClientData.length > 0 
                                ? aggregatedClientData.map(ad => <AdPerformanceCard key={ad.adName} ad={ad} onShowMetricsDetail={() => handleShowMetricsDetail(ad)} onShowAnalysisDetail={() => handleShowAnalysisDetail(ad)} onUpdateAnalysis={() => handleUpdateCreativeAnalysis(ad)} generatingAnalysis={generatingAnalysis[ad.adName]} onUploadVideo={() => handleOpenVideoUpload(ad)} />)
                                : <p className="text-brand-text-secondary text-center py-8 col-span-full">No hay datos de rendimiento para la selección actual.</p>
                            }
                        </div>
                    )}
                </div>

                <AiAnalysisModal 
                    isOpen={isConclusionModalOpen}
                    onClose={() => setIsConclusionModalOpen(false)}
                    isLoading={isConclusionLoading}
                    analysisText={conclusionContent}
                />

                <AnalysisDetailModal
                    isOpen={isAnalysisDetailModalOpen}
                    onClose={() => setIsAnalysisDetailModalOpen(false)}
                    adData={selectedAdForAnalysisDetail}
                />

                <MetricsDetailModal
                    isOpen={isMetricsDetailModalOpen}
                    onClose={() => setIsMetricsDetailModalOpen(false)}
                    adData={selectedAdForMetricsDetail}
                    accountAverages={accountAverages}
                />
                
                {adForVideoUpload && (
                     <VideoUploadModal
                        isOpen={isVideoUploadModalOpen}
                        onClose={() => setIsVideoUploadModalOpen(false)}
                        adData={adForVideoUpload}
                        onSave={handleVideoSave}
                    />
                )}
            </div>
        );
    }
    
    return null;
};
