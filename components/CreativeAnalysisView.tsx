import React, { useState, useCallback }from 'react';
import { Client, Creative, CreativeSet, FormatGroup, Language, AnalysisResult } from '../types';
import { FileUpload } from './FileUpload';
import { ClientSelectorModal } from './ClientSelectorModal';
import { PlatformSelector } from './PlatformSelector';
import { LanguageSelector } from './LanguageSelector';
import { PlatformAnalysisView } from './PlatformAnalysisView';
import Logger from '../Logger';

// Helper functions to process files, similar to what's in PerformanceView.
const getCreativeFromFile = (file: File, objectUrl: string): Promise<Creative> => {
    return new Promise((resolve, reject) => {
        const type = file.type.startsWith('image/') ? 'image' : 'video';
        
        const processCreative = (width: number, height: number, hash: string) => {
            const aspectRatio = width / height;
            const newCreative: Creative = { file, url: URL.createObjectURL(file), type, width, height, format: aspectRatio >= 1 ? 'square' : 'vertical', hash };
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
                URL.revokeObjectURL(objectUrl);
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
                URL.revokeObjectURL(objectUrl);
            };
            element.onerror = (err) => {
                URL.revokeObjectURL(objectUrl);
                reject(err);
            };
            element.src = objectUrl;
        }
    });
};


interface CreativeAnalysisViewProps {
    clients: Client[];
    getFormatAnalysis: (creativeSet: CreativeSet, formatGroup: FormatGroup, language: Language, context: string, isVideo: boolean) => Promise<AnalysisResult | null>;
}

type AnalysisStep = 'upload' | 'select_format' | 'analyzing' | 'results';

export const CreativeAnalysisView: React.FC<CreativeAnalysisViewProps> = ({ clients, getFormatAnalysis }) => {
    const [step, setStep] = useState<AnalysisStep>('upload');
    const [creativeSet, setCreativeSet] = useState<CreativeSet | null>(null);
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [language, setLanguage] = useState<Language>('es');
    const [selectedFormat, setSelectedFormat] = useState<FormatGroup | null>(null);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const resetState = () => {
        setStep('upload');
        setCreativeSet(null);
        setIsClientModalOpen(false);
        setSelectedClient(null);
        setSelectedFormat(null);
        setAnalysisResult(null);
        setIsLoading(false);
        Logger.info('Creative analysis flow reset.');
    };

    const handleFileUpload = async (file: File) => {
        Logger.info('File uploaded for analysis', { name: file.name, type: file.type });
        const objectUrl = URL.createObjectURL(file);
        
        try {
            const creative = await getCreativeFromFile(file, objectUrl);
            const isVideo = creative.type === 'video';

            const newCreativeSet: CreativeSet = isVideo
                ? { square: null, vertical: null, videoFile: file }
                : { square: creative.format === 'square' ? creative : null, 
                    vertical: creative.format === 'vertical' ? creative : null, 
                    videoFile: null 
                };
            
            setCreativeSet(newCreativeSet);

            if (clients.length > 0) {
                setIsClientModalOpen(true);
            } else {
                alert("No hay clientes creados. Por favor, crea un cliente en la pestaña 'Clientes' antes de continuar.");
            }
        } catch (error) {
            Logger.error('Error processing uploaded file', error);
            alert("Hubo un error al procesar el archivo. Asegúrate de que es un formato de imagen o video válido.");
            resetState();
        }
    };

    const handleClientSelected = (clientId: string) => {
        const client = clients.find(c => c.id === clientId);
        if (client) {
            setSelectedClient(client);
            setIsClientModalOpen(false);
            setStep('select_format');
            Logger.info('Client selected for analysis', { clientName: client.name });
        }
    };

    const handleFormatSelected = async (formatGroup: FormatGroup) => {
        if (!creativeSet || !selectedClient) return;

        setSelectedFormat(formatGroup);
        setStep('analyzing');
        setIsLoading(true);
        Logger.info('Format selected, starting AI analysis...', { formatGroup, clientName: selectedClient.name });

        const context = `Análisis del creativo para el cliente "${selectedClient.name}".`;
        const isVideo = !!creativeSet.videoFile;
        const result = await getFormatAnalysis(creativeSet, formatGroup, language, context, isVideo);

        setAnalysisResult(result);
        setIsLoading(false);
        setStep('results');
        Logger.success('AI analysis complete.');
    };

    const renderContent = () => {
        switch (step) {
            case 'upload':
                return (
                    <div className="max-w-4xl mx-auto">
                        <FileUpload onFileUpload={handleFileUpload} />
                    </div>
                );
            case 'select_format':
                return (
                     <div className="max-w-4xl mx-auto">
                         <LanguageSelector language={language} onLanguageChange={setLanguage} />
                         <PlatformSelector onSelectFormat={handleFormatSelected} />
                     </div>
                );
            case 'analyzing':
            case 'results':
                if (creativeSet && selectedFormat) {
                    return (
                        <PlatformAnalysisView
                            creativeSet={creativeSet}
                            formatGroup={selectedFormat}
                            analysisResult={analysisResult}
                            isLoading={isLoading}
                            onGoBack={resetState}
                        />
                    );
                }
                return null; // Should not happen
            default:
                return null;
        }
    };

    return (
        <div className="animate-fade-in">
             <header className="text-center mb-10">
                <h1 className="text-4xl font-bold tracking-tight text-brand-text sm:text-5xl">Análisis de Creativos con IA</h1>
                <p className="mt-4 text-lg text-brand-text-secondary">Sube tu imagen o video para recibir un análisis instantáneo y recomendaciones de mejora.</p>
            </header>
            
            {renderContent()}

            <ClientSelectorModal 
                isOpen={isClientModalOpen}
                onClose={() => resetState()}
                clients={clients}
                onClientSelect={handleClientSelected}
                title="Asignar Creativo a Cliente"
                description="Selecciona a qué cliente pertenece este creativo. Esto ayuda a la IA a usar el contexto adecuado."
            />
        </div>
    );
};
