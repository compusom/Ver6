
import React, { useMemo, useState } from 'react';
import { Recommendations } from './Recommendations';
import { AnalysisResult, FormatGroup, OverallConclusion, ChecklistItem, CreativeSet, Placement } from '../types';
import { PLACEMENTS } from '../constants';

const severityIcons: Record<ChecklistItem['severity'], JSX.Element> = {
    CRITICAL: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.03-1.742 3.03H4.42c-1.532 0-2.492-1.696-1.742-3.03l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-4a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" /></svg>,
    ACTIONABLE: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>,
    POSITIVE: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>,
};

const UnsafeZonesOverlay: React.FC<{ safeZone: Placement['safeZone'] }> = ({ safeZone }) => (
    <>
        <div className="absolute top-0 left-0 right-0 bg-red-500/30 pointer-events-none z-30 rounded-t-md" style={{ height: safeZone.top }}></div>
        <div className="absolute bottom-0 left-0 right-0 bg-red-500/30 pointer-events-none z-30 rounded-b-md" style={{ height: safeZone.bottom }}></div>
        {safeZone.left && <div className="absolute top-0 bottom-0 left-0 bg-red-500/30 pointer-events-none z-30" style={{ width: safeZone.left }}></div>}
        {safeZone.right && <div className="absolute top-0 bottom-0 right-0 bg-red-500/30 pointer-events-none z-30" style={{ width: safeZone.right }}></div>}
    </>
);

const ConclusionCard: React.FC<{ conclusion: OverallConclusion }> = ({ conclusion }) => {
    return (
        <div className="bg-brand-surface rounded-lg shadow-lg p-6">
            <h2 className="text-xl md:text-2xl font-bold text-brand-text mb-4">{conclusion.headline}</h2>
            <ul className="space-y-3">
                {conclusion.checklist.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                        {severityIcons[item.severity]}
                        <span className="text-brand-text-secondary">{item.text}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const LoadingSkeleton: React.FC = () => (
     <div className="animate-pulse flex flex-col gap-8">
        <div className="h-10 bg-brand-border rounded-md w-64"></div>
        
        {/* Preview Skeleton */}
        <div className="bg-brand-surface rounded-lg p-4 shadow-lg">
            <div className="w-full max-w-lg mx-auto bg-brand-border rounded-md aspect-video"></div>
            <div className="h-8 bg-brand-border rounded-md w-48 mx-auto mt-4"></div>
        </div>

        {/* Analysis Skeleton */}
        <div className="space-y-8">
            <Recommendations analysisResult={null} isLoading={true} />
            <div className="bg-brand-surface rounded-lg shadow-lg p-6 mt-8">
                <div className="h-6 bg-brand-border rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                    <div className="flex gap-3 items-start"><div className="w-5 h-5 rounded-full bg-brand-border/50 flex-shrink-0"></div><div className="h-4 bg-brand-border rounded w-full"></div></div>
                    <div className="flex gap-3 items-start"><div className="w-5 h-5 rounded-full bg-brand-border/50 flex-shrink-0"></div><div className="h-4 bg-brand-border rounded w-5/6"></div></div>
                </div>
            </div>
        </div>
    </div>
);

interface PlatformAnalysisViewProps {
    creativeSet: CreativeSet;
    formatGroup: FormatGroup;
    analysisResult: AnalysisResult | null;
    isLoading: boolean;
    onGoBack: () => void;
}

export const PlatformAnalysisView: React.FC<PlatformAnalysisViewProps> = ({ creativeSet, formatGroup, analysisResult, isLoading, onGoBack }) => {
    const [showUnsafeZones, setShowUnsafeZones] = useState(true);

    const representativePlacement = useMemo(() => {
        return PLACEMENTS.find(p => p.group === formatGroup)!;
    }, [formatGroup]);
    
    const creativeToDisplay = useMemo(() => {
        if(creativeSet.videoFile) {
            return {
                file: creativeSet.videoFile,
                url: URL.createObjectURL(creativeSet.videoFile),
                type: 'video',
                width: 1080, // Placeholder
                height: 1920, // Placeholder
                format: 'vertical',
                hash: ''
            }
        }
        const isVerticalPlacement = formatGroup === 'VERTICAL';
        return isVerticalPlacement 
            ? (creativeSet.vertical || creativeSet.square)
            : (creativeSet.square || creativeSet.vertical);
    }, [creativeSet, formatGroup]);

    if (isLoading) {
        return <LoadingSkeleton />;
    }
    
    return (
        <div className="animate-fade-in flex flex-col gap-8">
             <button 
                onClick={onGoBack} 
                className="self-start -mb-2 bg-brand-border/50 text-brand-text-secondary hover:bg-brand-border px-4 py-2 rounded-md transition-colors flex items-center gap-2"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Seleccionar otro formato
            </button>
            
            {/* New Horizontal Preview Section */}
            <div className="bg-brand-surface rounded-lg p-4 shadow-lg">
                <div className="relative w-full max-w-lg mx-auto bg-brand-bg rounded-md">
                     {creativeToDisplay ? (
                        <div className="relative">
                            { creativeToDisplay.type === 'image' ? (
                                <img src={creativeToDisplay.url} alt="Creative Preview" className="w-full h-auto max-h-[60vh] object-contain rounded-md" />
                            ) : (
                                <video src={creativeToDisplay.url} className="w-full h-auto max-h-[60vh] object-contain rounded-md" loop autoPlay muted playsInline />
                            )}
                            {showUnsafeZones && (
                                <UnsafeZonesOverlay safeZone={representativePlacement.safeZone} />
                            )}
                        </div>
                    ) : (
                        <div className="aspect-video flex items-center justify-center text-brand-text-secondary">
                            <span>No creative available</span>
                        </div>
                    )}
                </div>
                 <div className="mt-4 flex justify-center items-center gap-3">
                     <label htmlFor="safe-zone-toggle" className="text-sm text-brand-text-secondary">
                         Mostrar Zonas Rojas
                     </label>
                    <button
                        id="safe-zone-toggle"
                        onClick={() => setShowUnsafeZones(!showUnsafeZones)}
                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${showUnsafeZones ? 'bg-brand-primary' : 'bg-brand-border'}`}
                        aria-pressed={showUnsafeZones}
                    >
                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${showUnsafeZones ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </div>

            {/* Analysis Section */}
            <div className="space-y-8">
                <Recommendations analysisResult={analysisResult} isLoading={isLoading} />
                {analysisResult && <ConclusionCard conclusion={analysisResult.overallConclusion} />}
            </div>
        </div>
    );
};