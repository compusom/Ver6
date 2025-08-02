import React, { useState, useEffect, useMemo } from 'react';
import { Client, PerformanceRecord, AggregatedAdPerformance, AllLookerData, CreativeSet, AnalysisResult, UploadedVideo, Creative, AppView, AccountAverages, DemographicData, AdEvolutionMetrics } from '../types';
import { AdPerformanceCard } from './AdPerformanceCard';
import { AggregatedPerformanceTable } from './AggregatedPerformanceTable';
import { DateRangePicker } from './DateRangePicker';
import { AiAnalysisModal } from './AiAnalysisModal';
import { AnalysisDetailModal } from './AnalysisDetailModal';
import { VideoUploadModal } from './VideoUploadModal';
import { dbTyped } from '../database';
import Logger from '../Logger';
import { MetricsDetailModal } from './MetricsDetailModal';

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
    const [view, setView] = useState<View>('list');
    const [filterMode, setFilterMode] = useState<FilterMode>('all');
    const [displayMode, setDisplayMode] = useState<DisplayMode>('cards');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
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
        if (!selectedClient || !performanceData[selectedClient.id]) {
            setAccountAverages(null);
            return;
        }

        const allClientData = performanceData[selectedClient.id];
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

    }, [selectedClient, performanceData]);

    const filteredPerformanceData = useMemo(() => {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        const filtered: { [key: string]: PerformanceRecord[] } = {};
        for (const clientId in performanceData) {
            filtered[clientId] = performanceData[clientId].filter(record => {
                const recordDate = parseDate(record.day);
                if (!recordDate) return false;
                return recordDate >= start && recordDate <= end;
            });
        }
        return filtered;
    }, [performanceData, startDate, endDate]);

    const clientSummaries = useMemo(() => {
        return clients.map(client => {
            const data = filteredPerformanceData[client.id] || [];
            const clientLookerData = lookerData[client.id] || {};
            
            if (data.length === 0) {
                return { ...client, gastoTotal: 0, roas: 0, totalAds: 0, matchedCount: 0 };
            }
            const gastoTotal = data.reduce((acc, row) => acc + (row.spend || 0), 0);
            const valorTotal = data.reduce((acc, row) => acc + (row.purchaseValue || 0), 0);
            const roas = gastoTotal > 0 ? valorTotal / gastoTotal : 0;
            
            const uniqueAds = new Set(data.map(r => r.adName));
            const matchedCount = Array.from(uniqueAds).filter(adName => !!clientLookerData[adName]?.imageUrl).length;

            return { ...client, gastoTotal, roas, totalAds: uniqueAds.size, matchedCount };
        });
    }, [clients, filteredPerformanceData, lookerData]);

    const aggregatedClientData = useMemo<AggregatedAdPerformance[]>(() => {
        if (!selectedClient) return [];
        
        const allPerformanceDataForClient = performanceData[selectedClient.id] || [];
        const performanceDataForPeriod = filteredPerformanceData[selectedClient.id] || [];
        const activePerformanceData = performanceDataForPeriod.filter(r => r.adDelivery?.toLowerCase() === 'active' && r.impressions > 0);
        const clientLookerData = lookerData[selectedClient.id] || {};
        
        if (activePerformanceData.length === 0) return [];

        const adsByName = activePerformanceData.reduce((acc, record) => {
            if (!record.adName) return acc;
            if (!acc[record.adName]) acc[record.adName] = [];
            acc[record.adName].push(record);
            return acc;
        }, {} as Record<string, PerformanceRecord[]>);

        const allAggregated = Object.entries(adsByName).map(([adName, records]) => {
            const totals = records.reduce((acc, r) => {
                acc.spend += r.spend;
                acc.purchases += r.purchases;
                acc.purchaseValue += r.purchaseValue;
                acc.impressions += r.impressions;
                acc.reach += r.reach;
                acc.clicks += r.clicksAll;
                acc.linkClicks += r.linkClicks;
                acc.thruPlays += r.thruPlays;
                acc.frequencyTotal += r.frequency * r.impressions;
                acc.landingPageViews += r.landingPageViews;
                acc.addsToCart += r.addsToCart;
                acc.checkoutsInitiated += r.checkoutsInitiated;
                acc.postInteractions += r.postInteractions;
                acc.postReactions += r.postReactions;
                acc.postComments += r.postComments;
                acc.postShares += r.postShares;
                acc.pageLikes += r.pageLikes;
                acc.atencion += r.attention;
                acc.interes += r.interest;
                acc.deseo += r.desire;
                if (r.videoAveragePlayTime > 0 && r.impressions > 0) {
                    acc.videoAveragePlayTimeWeightedTotal += r.videoAveragePlayTime * r.impressions;
                    acc.videoImpressions += r.impressions;
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

            const roas = totals.spend > 0 ? totals.purchaseValue / totals.spend : 0;
            const cpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0;
            const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
            const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
            const ctrLink = totals.impressions > 0 ? (totals.linkClicks / totals.impressions) * 100 : 0;
            const frequency = totals.impressions > 0 ? totals.frequencyTotal / totals.impressions : 1;
            const videoAveragePlayTime = totals.videoImpressions > 0 ? totals.videoAveragePlayTimeWeightedTotal / totals.videoImpressions : 0;
            const ticketPromedio = totals.purchases > 0 ? totals.purchaseValue / totals.purchases : 0;
            const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
            const tasaVisitaLP = totals.linkClicks > 0 ? (totals.landingPageViews / totals.linkClicks) * 100 : 0;
            const tasaCompra = totals.landingPageViews > 0 ? (totals.purchases / totals.landingPageViews) * 100 : 0;
            
            const lookerMatch = clientLookerData[adName];
            const inMultipleAdSets = new Set(records.map(r => r.adSetName)).size > 1;
            const videoFileName = records.find(r => r.videoFileName)?.videoFileName;
            
            const isVideo = !!videoFileName || (records.some(r => r.thruPlays > 0) && videoAveragePlayTime > 1);
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

        return filterMode === 'all' ? allAggregated : allAggregated.filter(ad => ad.creativeType === filterMode);
    }, [selectedClient, filteredPerformanceData, performanceData, lookerData, filterMode, uploadedVideos]);
    
    const hasLinkedAdsWithAnalysis = useMemo(() => aggregatedClientData.some(ad => ad.isMatched && ad.creativeDescription), [aggregatedClientData]);
    const adsToAnalyzeCount = useMemo(() => aggregatedClientData.filter(ad => ad.isMatched && ad.imageUrl && !ad.creativeDescription && (ad.creativeType === 'image' || (ad.creativeType === 'video' && ad.isVideoUploaded))).length, [aggregatedClientData]);
    
    const handleClientSelect = (client: Client) => { setSelectedClient(client); setDisplayMode('cards'); setFilterMode('all'); setView('detail'); };
    
    const handleAiConclusion = async () => {
        if (!selectedClient) return;
        const dataToAnalyze = aggregatedClientData.filter(ad => ad.isMatched && ad.creativeDescription);
        if (dataToAnalyze.length === 0) {
            alert("No hay anuncios con análisis de IA en el período y filtro seleccionado. Genere o actualice análisis para algunos anuncios primero.");
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
            alert(`Error al analizar creativo para "${ad.adName}": ${message}`);
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
            try { await handleUpdateCreativeAnalysis(ad); } catch (error) { Logger.error(`Bulk analysis failed for ${ad.adName}, continuing...`, error); }
        }
    
        setBulkAnalysisState({ active: false, current: 0, total: 0 });
        alert('Análisis en masa completado.');
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
            alert("Ocurrió un error al guardar el video.");
        } finally {
            setIsVideoUploadModalOpen(false);
            setAdForVideoUpload(null);
        }
    };

    if (view === 'list') {
        return (
            <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
                <header className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-brand-text">Rendimiento por Cliente</h2>
                        <p className="text-brand-text-secondary mt-1">Selecciona un cliente para ver el detalle de sus anuncios.</p>
                    </div>
                    <DateRangePicker onDateChange={onDateChange} startDate={startDate} endDate={endDate} />
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
                                <div className="font-semibold text-brand-text text-right">{client.gastoTotal.toLocaleString('es-ES', { style: 'currency', currency: client.currency })}</div>
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
                         <DateRangePicker onDateChange={onDateChange} startDate={startDate} endDate={endDate} />
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