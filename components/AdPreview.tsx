
import React from 'react';
import type { Creative, Placement, CreativeSet, UiType, PlacementSpecificSummary } from '../types';

// --- UI Simulation Subcomponents ---

const FeedUI: React.FC = () => (
  <div className="absolute inset-0 text-white pointer-events-none text-[8px] sm:text-xs">
    {/* Header */}
    <div className="absolute top-0 left-0 right-0 p-2 sm:p-3 flex items-center gap-2 bg-gradient-to-b from-black/20 to-transparent">
      <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-400/80 rounded-full flex-shrink-0"></div>
      <div className="flex-1">
        <div className="font-bold">mutolongevity</div>
        <div className="text-[10px] text-gray-300">Publicidad</div>
      </div>
      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
    </div>
    {/* Footer */}
    <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-3 bg-gradient-to-t from-black/20 to-transparent">
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
        <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
      </div>
      <p className="mt-2 text-[10px] sm:text-sm"><span className="font-bold">mutolongevity</span> Age Smarter This Sum...</p>
    </div>
  </div>
);

const StoriesUI: React.FC = () => (
    <div className="absolute inset-0 text-white pointer-events-none text-xs">
        <div className="absolute top-2 left-2 right-2 p-2 flex items-center gap-2 bg-gradient-to-b from-black/20 to-transparent">
            <div className="w-8 h-8 bg-gray-400/80 rounded-full"></div>
            <span className="font-bold">Muto Longev...</span>
        </div>
        <div className="absolute bottom-4 left-4 right-4 text-center">
            <div className="bg-white/90 text-black font-bold p-3 rounded-lg text-sm">Age Smarter This Summer</div>
        </div>
    </div>
);

const ReelsUI: React.FC = () => (
     <div className="absolute inset-0 text-white pointer-events-none text-xs">
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/50 to-transparent">
             <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-gray-400/80 rounded-full"></div>
                <span className="font-bold">mutolongevity</span>
                <span className="border border-white/50 rounded px-1.5 py-0.5 text-xs">Seguir</span>
            </div>
            <p className="mb-2 text-sm">en serio creí que</p>
            <div className="w-full bg-blue-500 text-white text-center font-bold p-2 rounded-md text-sm">Comprar</div>
        </div>
    </div>
);

const MarketplaceUI: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="w-full h-full bg-white text-black p-2 sm:p-3 flex flex-col pointer-events-none">
        <div className="w-full flex-grow relative mb-2">{children}</div>
        <div className="flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-400/80 rounded-full"></div>
                <p className="text-xs sm:text-sm font-bold">Muto Longev...</p>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-500 mb-1">Sponsored</p>
            <p className="text-xs sm:text-sm">Age Smarter This Summer</p>
        </div>
    </div>
);

const UIOverlay: React.FC<{ placement: Placement; children: React.ReactNode }> = ({ placement, children }) => {
  switch(placement.uiType) {
    case 'FEED': return <><div className="relative w-full h-full">{children}</div><FeedUI /></>;
    case 'STORIES': return <><div className="relative w-full h-full">{children}</div><StoriesUI /></>;
    case 'REELS': return <><div className="relative w-full h-full">{children}</div><ReelsUI /></>;
    case 'MARKETPLACE': return <MarketplaceUI>{children}</MarketplaceUI>;
    default: return <div className="relative w-full h-full">{children}</div>;
  }
}

// --- Main Component ---

const getAspectRatioClass = (aspectRatio: string) => {
    switch (aspectRatio) {
        case '1:1': return 'aspect-[1/1]';
        case '4:5': return 'aspect-[4/5]';
        case '9:16': return 'aspect-[9/16]';
        case '1.91:1': return 'aspect-[191/100]';
        default: return 'aspect-[1/1]';
    }
};

const parseAspectRatio = (ratioStr: string): number => {
    const parts = ratioStr.split(':').map(Number);
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1]) || parts[1] === 0) return 1;
    return parts[0] / parts[1];
};

const UnsafeZonesOverlay: React.FC<{ safeZone: Placement['safeZone'] }> = ({ safeZone }) => (
    <>
        <div className="absolute top-0 left-0 right-0 bg-red-500/30 pointer-events-none z-30" style={{ height: safeZone.top }}></div>
        <div className="absolute bottom-0 left-0 right-0 bg-red-500/30 pointer-events-none z-30" style={{ height: safeZone.bottom }}></div>
        {safeZone.left && <div className="absolute top-0 bottom-0 left-0 bg-red-500/30 pointer-events-none z-30" style={{ width: safeZone.left }}></div>}
        {safeZone.right && <div className="absolute top-0 bottom-0 right-0 bg-red-500/30 pointer-events-none z-30" style={{ width: safeZone.right }}></div>}
    </>
);

const CreativeContent: React.FC<{ creative: Creative; areRatiosMismatched: boolean }> = ({ creative, areRatiosMismatched }) => {
    const commonProps = { src: creative.url, autoPlay: true, loop: true, muted: true, playsInline: true };
    const foregroundClasses = "relative z-10 w-full h-full object-contain";
    const backgroundClasses = "absolute inset-0 w-full h-full object-cover filter blur-md scale-110 z-0";
    const normalClasses = "w-full h-full object-cover";

    if (areRatiosMismatched) {
        return (
            <>
                {creative.type === 'image' ? <img alt="Blurred background" {...commonProps} className={backgroundClasses} /> : <video {...commonProps} className={backgroundClasses} />}
                {creative.type === 'image' ? <img alt="Creative preview" {...commonProps} className={foregroundClasses} /> : <video {...commonProps} className={foregroundClasses} />}
            </>
        );
    }
    return creative.type === 'image' ? <img alt="Creative preview" {...commonProps} className={normalClasses} /> : <video {...commonProps} className={normalClasses} />;
};

interface PhoneSimulationProps {
    creativeToDisplay: Creative | null;
    placement: Placement;
    areRatiosMismatched: boolean;
    showUnsafeZones: boolean;
}

const PhoneSimulation: React.FC<PhoneSimulationProps> = ({ creativeToDisplay, placement, areRatiosMismatched, showUnsafeZones }) => {
    return (
        <div className={`relative mx-auto bg-gray-900 border-gray-700 shadow-xl border-[6px] rounded-[1.5rem]`}>
            <div className={`w-full overflow-hidden bg-brand-bg rounded-[1.2rem] ${getAspectRatioClass(placement.aspectRatios[0])}`}>
                {creativeToDisplay ? (
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                        <UIOverlay placement={placement}>
                            <CreativeContent creative={creativeToDisplay} areRatiosMismatched={areRatiosMismatched} />
                        </UIOverlay>
                        {showUnsafeZones && <UnsafeZonesOverlay safeZone={placement.safeZone} />}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-brand-border" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>
                        <p className="mt-2 text-brand-text-secondary text-sm">Falta el creativo</p>
                    </div>
                )}
            </div>
        </div>
    );
};


interface AdPreviewProps {
    creativeSet: CreativeSet;
    placement: Placement;
    size?: 'large' | 'small';
    criticalSummary?: string[];
    showUnsafeZones?: boolean;
}

export const AdPreview: React.FC<AdPreviewProps> = ({ creativeSet, placement, size = 'large', criticalSummary, showUnsafeZones = true }) => {
    const isVerticalPlacement = placement.group === 'VERTICAL';
    const creativeToDisplay = isVerticalPlacement 
        ? (creativeSet.vertical || creativeSet.square)
        : (creativeSet.square || creativeSet.vertical);

    const areRatiosMismatched = creativeToDisplay ? Math.abs((creativeToDisplay.width / creativeToDisplay.height) - parseAspectRatio(placement.aspectRatios[0])) > 0.05 : false;
    
    if (size === 'large') {
        return (
            <div className="w-[300px] sm:w-[350px]">
                <PhoneSimulation 
                    creativeToDisplay={creativeToDisplay}
                    placement={placement}
                    areRatiosMismatched={areRatiosMismatched}
                    showUnsafeZones={showUnsafeZones}
                />
            </div>
        );
    }

    return (
        <div 
            className="flex flex-col h-full bg-brand-surface rounded-lg shadow-lg p-4 transition-all"
        >
            <p className="text-center text-brand-text font-semibold text-base mb-3 truncate">
                {placement.platform} - {placement.name}
            </p>
            <div className="flex-grow flex items-center justify-center mb-3">
                 <div className="w-full max-w-[200px]">
                     <PhoneSimulation 
                        creativeToDisplay={creativeToDisplay}
                        placement={placement}
                        areRatiosMismatched={areRatiosMismatched}
                        showUnsafeZones={showUnsafeZones}
                    />
                 </div>
            </div>
            {criticalSummary && criticalSummary.length > 0 && (
                <div className="pt-3 mt-auto border-t border-brand-border/50 text-center">
                    <ul className="space-y-1.5 list-disc list-inside text-left">
                        {criticalSummary.map((point, index) => (
                           <li key={index} className="text-brand-text-secondary text-sm leading-snug">
                            {point}
                           </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};