
import React from 'react';
import { AdPreview } from './AdPreview';
import { AnalysisResult, CreativeSet, Placement } from '../types';

interface PreviewGridProps {
    placements: Placement[];
    creativeSet: CreativeSet;
    analysisResult: AnalysisResult | null;
    showUnsafeZones: boolean;
    onPreviewClick: (placement: Placement) => void;
}

export const PreviewGrid: React.FC<PreviewGridProps> = ({ placements, creativeSet, analysisResult, showUnsafeZones, onPreviewClick }) => {
    
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {placements.map((placement) => {
                const summary = analysisResult?.placementSummaries.find(s => s.placementId === String(placement.id));
                return (
                    <button
                        key={placement.id}
                        onClick={() => onPreviewClick(placement)}
                        className="text-left h-full w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-brand-bg transition-shadow duration-300 hover:shadow-xl hover:shadow-brand-primary/20"
                        aria-label={`Ver vista previa ampliada para ${placement.name}`}
                    >
                        <AdPreview
                            creativeSet={creativeSet}
                            placement={placement}
                            size="small"
                            criticalSummary={summary?.summary}
                            showUnsafeZones={showUnsafeZones}
                        />
                    </button>
                );
            })}
        </div>
    );
};