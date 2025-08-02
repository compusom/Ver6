
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { AppView, Placement, Creative, AnalysisResult, FormatGroup, Language, CreativeSet, Client, AggregatedAdPerformance, User, AllLookerData, PerformanceRecord, TrendsAnalysisResult, TrendCardData, MetaApiConfig, BitacoraReport, UploadedVideo, ImportBatch, ProcessResult } from './types';
import { PLACEMENTS, META_ADS_GUIDELINES } from './constants';
import { PlatformAnalysisView } from './components/PlatformAnalysisView';
import { Navbar } from './components/Navbar';
import { SettingsView } from './components/SettingsView';
import { ControlPanelView } from './components/ControlPanelView';
import { ClientManager } from './components/ClientManager';
import { PerformanceView } from './components/PerformanceView';
import { LoginView } from './components/LoginView';
import { UserManager } from './components/UserManager';
import { ImportView } from './components/ImportView';
import { HelpView } from './components/HelpView';
import { LogView } from './components/LogView';
import { TrendsView } from './components/TrendsView';
import { ReportsView } from './components/ReportsView';
import { dbTyped, dbConnectionStatus } from './database';
import Logger from './Logger';
import { syncFromMetaAPI } from './lib/metaApiConnector';
import { processPerformanceData } from './lib/dataProcessor';
import { CreativeAnalysisView } from './components/CreativeAnalysisView';

const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });

    return {
        inlineData: {
            data: await base64EncodedDataPromise,
            mimeType: file.type,
        },
    };
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export const getFormatAnalysis = async (creativeSet: CreativeSet, formatGroup: FormatGroup, language: Language, context: string, isVideo: boolean): Promise<AnalysisResult | null> => {
    const isSpanish = language === 'es';

    if (!process.env.API_KEY) {
        return { 
            creativeDescription: isSpanish ? "Error: API Key no configurada." : "Error: API Key not set.",
            effectivenessScore: 0,
            effectivenessJustification: isSpanish ? "API Key no configurada." : "API Key not set.",
            clarityScore: 0,
            clarityJustification: isSpanish ? "API Key no configurada." : "API Key not set.",
            textToImageRatio: 0,
            textToImageRatioJustification: isSpanish ? "API Key no configurada." : "API Key not set.",
            funnelStage: "N/A",
            funnelStageJustification: isSpanish ? "API Key no configurada." : "API Key not set.",
            recommendations: [],
            advantagePlusAnalysis: [],
            placementSummaries: [],
            overallConclusion: { 
                headline: isSpanish ? "Error de Configuración" : "Configuration Error",
                checklist: [{ 
                    severity: 'CRITICAL', 
                    text: isSpanish 
                        ? "La API Key de Gemini no está configurada. Por favor, asegúrate de que la variable de entorno API_KEY esté disponible."
                        : "The Gemini API Key is not configured. Please ensure the API_KEY environment variable is available."
                }] 
            },
        };
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const placementsForFormat = PLACEMENTS.filter(p => p.group === formatGroup);
    const placementListForPrompt = placementsForFormat.map(p => `- ${p.name} (ID: ${p.id})`).join('\n');
    const languageInstruction = isSpanish ? 'ESPAÑOL' : 'ENGLISH';
    
    const representativePlacement = placementsForFormat.length > 0 ? placementsForFormat[0] : PLACEMENTS.find(p => p.group === formatGroup);
    const safeZoneTop = representativePlacement?.safeZone.top ?? '14%';
    const safeZoneBottom = representativePlacement?.safeZone.bottom ?? '20%';
    
    const videoAnalysisInstruction = `Estás analizando un ${isVideo ? 'VIDEO' : 'IMAGEN ESTÁTICA'}. ${isVideo ? 'Tu descripción y recomendaciones deben reflejar el flujo dinámico del video.' : ''}`;


    const prompt = `
      **Instrucción Maestra:**
      Actúas como un director de arte y estratega de marketing para Meta Ads, con un ojo extremadamente crítico, amigable y detallista. Tu tarea es realizar un análisis HOLÍSTICO del creativo proporcionado (imagen o video) para el grupo de formatos '${formatGroup}'. Tu análisis debe ser específico, accionable y basarse en el creativo y las especificaciones. TODO el texto de tu respuesta debe estar exclusivamente en ${languageInstruction}.

      **Contexto Adicional:**
      ${context}
      
      **Análisis de Formato:**
      ${videoAnalysisInstruction}

      **Paso 0: Comprensión del Objetivo del Creativo (ACCIÓN FUNDAMENTAL):**
      Antes de CUALQUIER otra cosa, tu primera acción es entender a fondo qué está vendiendo o qué oferta clave está comunicando el creativo. Identifica el producto, servicio, o mensaje principal. TODO tu análisis posterior (puntuaciones, justificaciones, recomendaciones) debe estar rigurosamente fundamentado en este objetivo central que has identificado. Esta comprensión inicial es la base de un feedback útil y relevante.

      **Ubicaciones a Considerar en tu Análisis para '${formatGroup}':**
      ${placementListForPrompt}

      **TAREAS DE ANÁLISİS OBLIGATORIAS (Basadas en el Paso 0):**
      
      **1. DESCRIPCIÓN DETALLADA DEL CREATIVO (NUEVO Y CRÍTICO):**
      - **creativeDescription**: Describe la imagen o el video de forma precisa y detallada. Menciona los elementos clave (productos, personas, texto principal, ambiente, colores dominantes) y cómo evolucionan si es un video. Esta descripción es fundamental, ya que se usará como contexto para futuros análisis. Sé específico.

      **2. ANÁLISIS ESTRATÉGICO GLOBAL:**
      - **effectivenessJustification**: Para la justificación de efectividad, sé coherente. Si el puntaje es BAJO (<50), la justificación DEBE explicar por qué el creativo falla en comunicar su objetivo principal. Si es ALTO (>=50), debe resaltar cómo logra exitosamente comunicar dicho objetivo.
      - **textToImageRatio**: Al calcular este porcentaje, ignora por completo los subtítulos generados o incrustados que transcriben el audio. Céntrate únicamente en texto gráfico superpuesto, logos o llamadas a la acción que formen parte del diseño.
      - **recommendations**: Proporciona recomendaciones generales para mejorar cómo el creativo comunica su objetivo.

      **3. ANÁLISIS DE ZONAS DE SEGURIDAD (LA TAREA MÁS IMPORTANTE):**
      - **placementSummaries**: Tu MÁXIMA PRIORIDAD. Para el grupo de formatos '${formatGroup}', las zonas seguras son cruciales. La interfaz de usuario (UI) generalmente ocupa el **${safeZoneTop} superior** y el **${safeZoneBottom} inferior** del lienzo en ubicaciones como Stories y Reels. Tu tarea es analizar si algún elemento clave del creativo cae en estas zonas de riesgo.
      Para hacerlo de forma precisa, sigue este proceso mental:
      1.  **Localización de Elementos:** Primero, identifica los elementos más importantes (logo, titular principal, oferta, producto, CTA). Para cada uno, determina su ubicación precisa en el lienzo (ej: "el logo está en la esquina superior izquierda", "la oferta está justo en el centro", "el texto legal está en el borde inferior").
      2.  **Verificación de Zonas de Riesgo:** Ahora, compara la ubicación de cada elemento con las zonas de riesgo que te he indicado (${safeZoneTop} superior y ${safeZoneBottom} inferior).
      3.  **Elaboración del Resumen:** En tu \`summary\`, sé muy específico y literal. Si un elemento como "POR TIEMPO LIMITADO" está claramente en el centro, DEBES reportarlo como "colocado correctamente en una zona segura". Si el logo "MARAN CONCEPT" está en la parte superior, entonces sí debes marcarlo como un riesgo CRÍTICO porque cae dentro del ${safeZoneTop} superior. Tu objetivo es evitar a toda costa los 'falsos positivos' (marcar como riesgoso algo que está en una zona segura). Si no hay problemas, indícalo explícitamente como algo positivo.

      **4. ANÁLISIS DE MEJORAS ADVANTAGE+:**
      - **advantagePlusAnalysis**: Utiliza el documento "Mejoras automáticas de Meta Advantage+" que se te proporciona más abajo para analizar CADA una de las mejoras listadas en el documento. Indica si se recomienda 'ACTIVATE' o si se debe usar con 'CAUTION', y justifica tu respuesta basándote en cómo la mejora potenciaría (o perjudicaría) el objetivo principal del creativo.

      **5. CONCLUSIÓN FINAL:**
      - **overallConclusion**: Un objeto con un 'headline' conciso y un 'checklist' accionable y priorizado, enfocado en el objetivo del creativo.

      **Formato de Salida Obligatorio (JSON ÚNICAMENTE):**
      Debes responder con un único objeto JSON. TODO el texto debe estar en ${languageInstruction}.

      --- DOCUMENTO DE ESPECIFICACIONES (META ADS Y ADVANTAGE+) ---
      ${META_ADS_GUIDELINES}
      --- FIN DEL DOCUMENTO ---
    `;
    
    const analysisSchema = {
        type: Type.OBJECT,
        properties: {
            creativeDescription: { 
                type: Type.STRING,
                description: 'Una descripción detallada del contenido visual del creativo. Menciona elementos clave como productos, personas, texto, ambiente y colores. Esto se usará como contexto para análisis futuros.'
            },
            effectivenessScore: { type: Type.NUMBER },
            effectivenessJustification: { type: Type.STRING },
            clarityScore: { type: Type.NUMBER },
            clarityJustification: { type: Type.STRING },
            textToImageRatio: { type: Type.NUMBER },
            textToImageRatioJustification: { type: Type.STRING },
            funnelStage: { type: Type.STRING, enum: ['TOFU', 'MOFU', 'BOFU'] },
            funnelStageJustification: { type: Type.STRING },
            recommendations: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        headline: { type: Type.STRING },
                        points: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['headline', 'points'],
                },
            },
            advantagePlusAnalysis: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        enhancement: { type: Type.STRING },
                        applicable: { type: Type.STRING, enum: ['ACTIVATE', 'CAUTION'] },
                        justification: { type: Type.STRING },
                    },
                    required: ['enhancement', 'applicable', 'justification'],
                },
            },
            placementSummaries: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        placementId: { type: Type.STRING },
                        summary: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['placementId', 'summary'],
                }
            },
            overallConclusion: {
                type: Type.OBJECT,
                properties: {
                    headline: { type: Type.STRING },
                    checklist: { 
                        type: Type.ARRAY, 
                        items: { 
                            type: Type.OBJECT,
                            properties: {
                                severity: { type: Type.STRING, enum: ['CRITICAL', 'ACTIONABLE', 'POSITIVE'] },
                                text: { type: Type.STRING },
                            },
                            required: ['severity', 'text'],
                        } 
                    },
                },
                required: ['headline', 'checklist'],
            }
        },
        required: [
            'creativeDescription',
            'effectivenessScore', 'effectivenessJustification', 
            'clarityScore', 'clarityJustification',
            'textToImageRatio', 'textToImageRatioJustification',
            'funnelStage', 'funnelStageJustification',
            'recommendations', 'advantagePlusAnalysis', 'placementSummaries', 'overallConclusion'
        ],
    };

    try {
        const parts: ({ text: string; } | { inlineData: { data: string; mimeType: string; }; })[] = [{ text: prompt }];
        
        if (isVideo) {
             const base64Video = await fileToBase64(creativeSet.videoFile!);
             parts.push({ inlineData: { data: base64Video.split(',')[1], mimeType: creativeSet.videoFile!.type } });
        } else {
            const relevantCreative = formatGroup === 'SQUARE_LIKE' ? creativeSet.square : creativeSet.vertical;
            const creativeToAnalyze = relevantCreative || (formatGroup === 'SQUARE_LIKE' ? creativeSet.vertical : creativeSet.square);
            if (!creativeToAnalyze) throw new Error("No creative available for analysis.");
            parts.push(await fileToGenerativePart(creativeToAnalyze.file));
        }
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: analysisSchema,
            },
        });

        if (!response.text) {
            throw new Error(isSpanish 
                ? 'La respuesta de la IA está vacía. Esto puede deberse a que el formato del archivo es inválido, el contenido no es claro, o hubo un problema al generar la respuesta estructurada.' 
                : 'The AI response is empty. This might be because the file format is invalid, the content is unclear, or there was an issue generating the structured response.');
        }

        const jsonText = response.text.trim();
        const cleanedJson = jsonText.replace(/^```json\n?/, '').replace(/```$/, '');
        return JSON.parse(cleanedJson);

    } catch (error) {
        console.error("Error fetching or parsing Gemini recommendations:", error);
        
        let headline = isSpanish ? "Error de Análisis" : "Analysis Error";
        let errorMessage = isSpanish 
            ? "Hubo un error al generar las recomendaciones."
            : "There was an error generating the recommendations.";

        if (error instanceof Error) {
            errorMessage = error.message;
        }
        
        return {
            creativeDescription: "Error", effectivenessScore: 0, effectivenessJustification: "Error", clarityScore: 0, clarityJustification: "Error", textToImageRatio: 0, textToImageRatioJustification: "Error", funnelStage: "Error", funnelStageJustification: "Error", recommendations: [], advantagePlusAnalysis: [], placementSummaries: [],
            overallConclusion: { headline, checklist: [{ severity: 'CRITICAL', text: errorMessage }] },
        };
    }
};

const parseNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const cleaned = value.replace(/\./g, '').replace(/,/g, '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    }
    return 0;
};

const App: React.FC = () => {
    // App State
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [mainView, setMainView] = useState<AppView>('creative_analysis');
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Data State
    const [users, setUsers] = useState<User[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [lookerData, setLookerData] = useState<AllLookerData>({});
    const [metaApiConfig, setMetaApiConfig] = useState<MetaApiConfig | null>(null);
    const [bitacoraReports, setBitacoraReports] = useState<BitacoraReport[]>([]);
    const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>([]);
    const [importHistory, setImportHistory] = useState<ImportBatch[]>([]);
    const [performanceData, setPerformanceData] = useState<{ [key: string]: PerformanceRecord[] }>({});

    // Shared State for Date Range
    const today = new Date();
    const defaultStartDate = new Date(today);
    defaultStartDate.setDate(today.getDate() - 7);
    const [startDate, setStartDate] = useState(defaultStartDate.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

    // --- DATABASE & PERSISTENCE ---
    useEffect(() => {
        const initializeApp = async () => {
            Logger.info('Application initializing...');
            setIsLoading(true);
            dbConnectionStatus.connected = true; 
            try {
                const [
                    loadedUsers, loadedClients, loadedLookerData, loggedInUser,
                    loadedApiConfig, loadedReports, loadedVideos, loadedHistory, loadedPerfData
                ] = await Promise.all([
                    dbTyped.getUsers(), dbTyped.getClients(), dbTyped.getLookerData(), dbTyped.getLoggedInUser(),
                    dbTyped.getMetaApiConfig(), dbTyped.getBitacoraReports(), dbTyped.getUploadedVideos(), dbTyped.getImportHistory(), dbTyped.getPerformanceData()
                ]);

                if (loadedUsers.length === 0) {
                    Logger.warn('No users found in DB. Creating default Admin user.');
                    const defaultAdmin: User = { id: crypto.randomUUID(), username: 'Admin', password: 'Admin', role: 'admin' };
                    setUsers([defaultAdmin]);
                    await dbTyped.saveUsers([defaultAdmin]);
                } else {
                    setUsers(loadedUsers);
                }
                
                setClients(loadedClients);
                setLookerData(loadedLookerData);
                setMetaApiConfig(loadedApiConfig);
                setBitacoraReports(loadedReports);
                setUploadedVideos(loadedVideos);
                setImportHistory(loadedHistory);
                setPerformanceData(loadedPerfData);
                
                Logger.success(`Loaded ${loadedUsers.length} users, ${loadedClients.length} clients, and data for ${Object.keys(loadedLookerData).length} accounts.`);

                if (loggedInUser && (loadedUsers.length > 0 ? loadedUsers : [ { id: crypto.randomUUID(), username: 'Admin', password: 'Admin', role: 'admin' } ]).some(u => u.id === loggedInUser.id)) {
                    Logger.info(`Found logged in user: ${loggedInUser.username}`);
                    setCurrentUser(loggedInUser);
                    setIsLoggedIn(true);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown DB error';
                Logger.error('Failed to load data from database.', { error: message });
                dbConnectionStatus.connected = false;
                alert("Error crítico: No se pudieron cargar los datos de la base de datos.");
            } finally {
                setIsLoading(false);
            }
        };
        initializeApp();
    }, []);
    
    // Persist data changes to DB
    useEffect(() => { if (users.length > 0) dbTyped.saveUsers(users); }, [users]);
    useEffect(() => { dbTyped.saveClients(clients); }, [clients]);
    useEffect(() => { dbTyped.saveLookerData(lookerData); }, [lookerData]);
    useEffect(() => { dbTyped.saveMetaApiConfig(metaApiConfig); }, [metaApiConfig]);
    useEffect(() => { dbTyped.saveBitacoraReports(bitacoraReports); }, [bitacoraReports]);
    useEffect(() => { dbTyped.saveUploadedVideos(uploadedVideos); }, [uploadedVideos]);
    useEffect(() => { dbTyped.saveImportHistory(importHistory); }, [importHistory]);
    useEffect(() => { dbTyped.savePerformanceData(performanceData); }, [performanceData]);

    // --- LOGIC ---
    
    const visibleClients = useMemo(() => {
        if (currentUser?.role === 'admin') return clients;
        if (currentUser) return clients.filter(c => c.userId === currentUser.id);
        return [];
    }, [clients, currentUser]);
    
    const getPerformanceAnalysis = useCallback(async (performanceData: AggregatedAdPerformance[], client: Client): Promise<string> => {
        if (!process.env.API_KEY) return "Error: API Key de Gemini no configurada.";
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
        const formatAdDataForPrompt = (ad: AggregatedAdPerformance) => {
            const commonMetrics = `
- Gasto: ${ad.spend.toLocaleString('es-ES', { style: 'currency', currency: ad.currency })}
- ROAS: ${ad.roas.toFixed(2)} (Valor/Gasto)
- Compras: ${ad.purchases}
- CPA (Coste por Compra): ${ad.cpa.toLocaleString('es-ES', { style: 'currency', currency: ad.currency })}
- Impresiones: ${ad.impressions.toLocaleString('es-ES')}
- CPM (Coste por Mil): ${ad.cpm.toLocaleString('es-ES', { style: 'currency', currency: ad.currency })}
- Clics (Enlace): ${ad.linkClicks.toLocaleString('es-ES')}
- CTR (Enlace): ${ad.ctrLink.toFixed(2)}%
- Frecuencia: ${ad.frequency.toFixed(2)}
- Descripción del creativo (Análisis IA previo): "${ad.creativeDescription || 'No disponible'}"
            `;
    
        if (ad.creativeType === 'video') {
            const videoMetrics = `- Tipo: Video\n- Tiempo Promedio de Reproducción: ${ad.videoAveragePlayTime.toFixed(2)}s\n- ThruPlays (Reproducciones completas o +15s): ${ad.thruPlays.toLocaleString('es-ES')}`;
            return `Anuncio: "${ad.adName}"\n${videoMetrics}\n${commonMetrics}`;
        }
    
        return `Anuncio: "${ad.adName}"\n- Tipo: Imagen\n${commonMetrics}`;
    };

    const dataSummary = performanceData.map(formatAdDataForPrompt).join('\n---\n');
    
        const prompt = `
            **Instrucción Maestra:**
            Actúas como un estratega de medios senior y director de marketing para el cliente "${client.name}". Tu tarea es realizar un análisis profundo y holístico del rendimiento de sus campañas en Meta, basándote en los datos cuantitativos y cualitativos proporcionados. El objetivo es encontrar patrones de éxito y fracaso para establecer un plan de acción claro y estratégico. La respuesta debe estar exclusivamente en ESPAÑOL y usar formato Markdown.

            **Datos de Rendimiento y Creativos a Analizar (Periodo Seleccionado):**
            ${dataSummary}

            **Tareas Fundamentales:**

            1.  **Análisis de Ganadores ("Top Performers"):**
                - Identifica los 2-3 anuncios con mejor rendimiento. Usa el ROAS como métrica principal, pero considera también el CPA, el Gasto total y el CTR (Enlace) para validar su impacto.
                - Para cada ganador, crea una hipótesis DETALLADA de **POR QUÉ** funcionó. Cruza los datos cuantitativos con la "Descripción del creativo".
                - **Ejemplo de análisis profundo (Videos):** "El anuncio 'Video Testimonial' tuvo un ROAS de 5.2 y un excelente CTR de enlace del 2.5%. Su 'Tiempo Promedio de Reproducción' de 12 segundos, superando los 10s de otros videos, sugiere que la historia del testimonio enganchó a la audiencia desde el principio. Esto se alinea con la descripción de la IA que menciona 'una narrativa emocional y un rostro humano creíble', lo que probablemente generó la confianza necesaria para hacer clic y comprar."
                - **Ejemplo de análisis profundo (Imágenes):** "La 'Imagen Oferta Flash' fue un claro ganador con un CPA bajo. Su alto CTR del 3% indica que el mensaje visual fue muy efectivo. La descripción de la IA menciona 'un texto grande y contrastante con un CTA claro', lo que explica por qué capturó la atención y generó clics inmediatos."

            2.  **Análisis de Perdedores ("Underperformers"):**
                - Identifica 1-2 anuncios con bajo rendimiento (bajo ROAS, CPA alto, bajo CTR).
                - De manera similar, explica la posible razón de su fracaso, conectando métricas con la descripción del creativo.
                - **Ejemplo de análisis:** "El anuncio 'Video Corporativo' tuvo el peor ROAS y un tiempo de reproducción de solo 3 segundos. Esto, junto a su bajo CTR, sugiere que no logró captar el interés. La descripción 'video muy producido pero sin un mensaje claro en los primeros 3 segundos' confirma que la propuesta de valor no fue comunicada a tiempo para evitar que el usuario hiciera scroll."

            3.  **Conclusiones Estratégicas Clave:**
                - Sintetiza los hallazgos en 2-3 conclusiones generales. ¿Qué patrones emergen?
                - ¿Qué funciona mejor para este cliente? (Ej: "Los videos con testimonios personales superan a los videos de producto", "Las imágenes con ofertas claras y directas generan más clics que las imágenes de estilo de vida").

            4.  **Plan de Acción (Próximos Pasos):**
                - Proporciona una lista de 3 a 5 recomendaciones accionables y priorizadas. Sé específico.
                - **Ejemplo de Plan de Acción:**
                    - **Inmediato:** "Pausar la campaña del 'Video Corporativo' para detener el gasto ineficiente."
                    - **Corto Plazo:** "Asignar un 20% más de presupuesto al 'Video Testimonial' y crear una campaña de retargeting con él."
                    - **Próximo Sprint Creativo:** "Producir 2 nuevos videos siguiendo la fórmula del ganador: testimonios reales, cortos y directos. Testearlos contra una versión con subtítulos dinámicos."
                    - **Test de Hipótesis:** "Lanzar un A/B test con imágenes estáticas: una con el precio bien visible vs. una sin precio, para validar si la transparencia total es un factor clave."

            **Formato de Salida:**
            Usa Markdown para una fácil lectura (títulos con \`##\`, negritas con \`**\`, y listas con \`-\`). No uses formato JSON.
        `;
    
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
            return response.text;
        } catch (error) {
            console.error("Error en el análisis de rendimiento por IA:", error);
            if (error instanceof Error) {
                return `Error al contactar la IA: ${error.message}`;
            }
            return "Ocurrió un error desconocido al generar el análisis.";
        }
    }, []);

    const getTrendsAnalysis = useCallback(async (topAds: AggregatedAdPerformance[], client: Client, period: string, dailyData: PerformanceRecord[]): Promise<TrendsAnalysisResult> => {
        if (!process.env.API_KEY) return { trends: [] };
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
        const formatAdDataForPrompt = (ad: AggregatedAdPerformance) => {
            const demographicData = dailyData.filter(d => d.adName === ad.adName).reduce((acc, d) => {
                const key = `${d.gender}-${d.age}`;
                if (!acc[key]) {
                    acc[key] = { spend: 0, purchaseValue: 0 };
                }
                acc[key].spend += parseNumber(d.spend);
                acc[key].purchaseValue += parseNumber(d.purchaseValue);
                return acc;
            }, {} as Record<string, { spend: number, purchaseValue: number }>);
            
            const demographicSummary = Object.entries(demographicData).map(([key, data]) => {
                const roas = data.spend > 0 ? data.purchaseValue / data.spend : 0;
                return `    - Segmento [${key}]: Gasto ${data.spend.toFixed(2)}, ROAS ${roas.toFixed(2)}`;
            }).join('\n');

            return `
### Anuncio: "${ad.adName}" (${ad.creativeType})
- **Resumen Rendimiento Agregado:**
  - ROAS: ${ad.roas.toFixed(2)}, Gasto Total: ${ad.spend.toLocaleString('es-ES', { style: 'currency', currency: ad.currency })}, CPA: ${ad.cpa.toLocaleString('es-ES', { style: 'currency', currency: ad.currency })}
- **Descripción Cualitativa (Análisis IA Previo):**
  - "${ad.creativeDescription || 'No disponible'}"
- **Rendimiento Diario (para análisis de fatiga):**
${dailyData.filter(d => d.adName === ad.adName).map(d => `  - ${d.day}: ROAS ${((parseNumber(d.purchaseValue) / parseNumber(d.spend)) || 0).toFixed(2)}, Frecuencia ${parseNumber(d.frequency).toFixed(2)}`).join('\n')}
- **Rendimiento por Segmento Demográfico:**
${demographicSummary || '  - No disponible'}
        `;
        };
    
        const dataSummary = topAds.map(formatAdDataForPrompt).join('\n---\n');
    
        const prompt = `
            **Instrucción Maestra:**
            Actúas como un Director de Estrategia y Head of Growth para el cliente "${client.name}". Tu misión es analizar en profundidad un conjunto de anuncios del período (${period}) para descubrir tendencias, patrones ocultos y formular un plan de acción estratégico y fundamentado. Tu análisis debe ir más allá de lo obvio, conectando datos cuantitativos (diarios y demográficos) con las descripciones cualitativas de los creativos. Tu respuesta debe ser exclusivamente un objeto JSON.

            **Contexto:** Se ha seleccionado un grupo de anuncios clave basado en su rendimiento general para un análisis profundo.

            **Datos de Anuncios y Rendimiento a Analizar:**
            ${dataSummary}

            **Tus Tareas Críticas (estructuradas en tarjetas de tendencia):**
            Genera un array de "tarjetas de tendencia". Cada tarjeta debe ser un insight accionable y autocontenido. Debes generar entre 3 y 5 tarjetas.

            Para cada tarjeta, sigue esta lógica:
            1.  **Identifica un Patrón o Tendencia Clave:** Puede ser un patrón en los creativos ganadores, un insight sobre la fatiga de un anuncio, un hallazgo demográfico sorprendente, o una oportunidad de optimización.
            2.  **Define un Título Claro:** El 'title' debe resumir el hallazgo. (Ej: "Los Videos Testimoniales Superan a los de Producto", "Fatiga Detectada en la Campaña de Verano", "El Segmento Femenino 25-34 Responde Mejor a Ofertas Directas").
            3.  **Proporciona una Explicación Detallada:** El campo 'explanation' debe desarrollar el porqué de tu hallazgo, basándose en los datos. Conecta la descripción cualitativa del creativo con las métricas.
            4.  **Añade Métricas de Soporte:** En 'supportingMetrics', incluye 2-3 métricas clave que validen tu conclusión. Sé específico. (Ej: { metricName: "ROAS (Videos Testimoniales)", value: "5.2 vs 2.1" }, { metricName: "Tiempo Repr. Video", value: "12s vs 4s" }).
            5.  **Formula una Recomendación Accionable:** El campo 'recommendation' debe ser un paso siguiente claro y conciso. (Ej: "Priorizar la producción de 2 nuevos videos testimoniales para el próximo sprint y asignarles el 60% del presupuesto de testeo.").
            6.  **(Opcional pero recomendado) Análisis de Fatiga:** Si la tarjeta trata sobre fatiga, usa 'fatigueAnalysis' para explicar cómo la frecuencia creciente impactó el ROAS o CTR, usando los datos diarios.
            7.  **(Opcional pero recomendado) Insights Demográficos:** Si la tarjeta trata sobre un segmento, usa 'demographicInsights' para detallar qué creativos resonaron con qué grupos de edad/género.
        `;

        const trendsSchema = {
            type: Type.OBJECT,
            properties: {
                trends: {
                    type: Type.ARRAY,
                    description: "Un array de 3 a 5 tarjetas de tendencia, cada una representando un hallazgo estratégico clave.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            explanation: { type: Type.STRING },
                            supportingMetrics: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        metricName: { type: Type.STRING },
                                        value: { type: Type.STRING }
                                    },
                                    required: ["metricName", "value"]
                                }
                            },
                            recommendation: { type: Type.STRING },
                            demographicInsights: { type: Type.STRING },
                            fatigueAnalysis: { type: Type.STRING }
                        },
                        required: ["title", "explanation", "supportingMetrics", "recommendation"]
                    }
                }
            },
            required: ["trends"]
        };
    
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                 config: {
                    responseMimeType: "application/json",
                    responseSchema: trendsSchema
                },
            });

            if (!response.text) {
                throw new Error("La respuesta de la IA para el análisis de tendencias está vacía.");
            }
            
            const jsonText = response.text.trim().replace(/^```json\n?/, '').replace(/```$/, '');
            return JSON.parse(jsonText) as TrendsAnalysisResult;

        } catch (error) {
            console.error("Error en el análisis de tendencias por IA:", error);
            const errorMessage = error instanceof Error ? error.message : "Ocurrió un error desconocido.";
            alert(`Error al generar el análisis de tendencias: ${errorMessage}`);
            return { trends: [] };
        }
    }, []);

    const handleSyncFromMeta = async (clientId: string) => {
        if (!metaApiConfig) {
            alert("La configuración de la API de Meta no está definida.");
            return;
        }
        const client = clients.find(c => c.id === clientId);
        if (!client || !client.metaAccountName) {
            alert("El cliente seleccionado no tiene un 'Nombre de Cuenta de Meta' configurado.");
            return;
        }

        setIsLoading(true);
        try {
            const apiData = await syncFromMetaAPI(metaApiConfig, client.metaAccountName);
            const apiResults = await processPerformanceData(apiData, clients, performanceData, 'meta', false) as ProcessResult[];

            if (!Array.isArray(apiResults)) {
                throw new Error("La respuesta del procesador de datos no es válida.");
            }
            
            if (apiResults.length === 0) {
                alert(`Sincronización completada. No se encontraron nuevos registros.`);
                Logger.info(`Synced from Meta API for client ${client.name}. No new records.`);
                setIsLoading(false);
                return;
            }

            let totalNewRecords = 0;
            
            for (const result of apiResults) {
                const { newRecordsCount, client: processedClient, records, undoKeys } = result;
                
                if (processedClient && newRecordsCount > 0) {
                     totalNewRecords += newRecordsCount;
                     setPerformanceData(current => ({
                        ...current,
                        [processedClient.id]: [...(current[processedClient.id] || []), ...records],
                    }));
                    
                     const newBatch: Omit<ImportBatch, 'id' | 'timestamp' | 'fileHash'> = {
                        source: 'meta',
                        fileName: `API Sync @ ${new Date().toLocaleString()}`,
                        clientName: processedClient.name,
                        description: `${newRecordsCount} filas sincronizadas desde la API`,
                        undoData: { type: 'meta', keys: undoKeys, clientId: processedClient.id } 
                    };
                    const history = await dbTyped.getImportHistory();
                    await dbTyped.saveImportHistory([{ ...newBatch, id: crypto.randomUUID(), timestamp: new Date().toISOString(), fileHash: `api_sync_${Date.now()}` }, ...history]);
                    setImportHistory(await dbTyped.getImportHistory());
                }
            }
            
            alert(`Sincronización completada. Se añadieron ${totalNewRecords} nuevos registros.`);
            if(totalNewRecords > 0) {
                Logger.success(`Synced from Meta API. Added ${totalNewRecords} records.`);
            }

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Error desconocido';
            alert(`Error durante la sincronización: ${message}`);
            Logger.error('Meta API sync failed', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = (username: string, pass: string): boolean => {
        const foundUser = users.find(u => u.username === username && u.password === pass);
        if (foundUser) {
            Logger.success(`User login successful: ${username}`);
            setCurrentUser(foundUser);
            setIsLoggedIn(true);
            dbTyped.saveLoggedInUser(foundUser);
            return true;
        }
        Logger.warn(`User login failed for username: ${username}`);
        return false;
    };

    const handleLogout = () => {
        Logger.info(`User logout: ${currentUser?.username}`);
        setIsLoggedIn(false);
        setCurrentUser(null);
        dbTyped.saveLoggedInUser(null);
        setMainView('creative_analysis');
    };

    const renderMainContent = () => {
        if (isLoading) {
             return (
                <div className="fixed inset-0 bg-brand-bg flex items-center justify-center z-50">
                    <div className="flex flex-col items-center gap-4">
                         <svg className="animate-spin h-10 w-10 text-brand-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-lg font-semibold text-brand-text">Cargando aplicación...</p>
                    </div>
                </div>
            )
        }
        
        return (
             <div className="min-h-screen text-brand-text p-4 sm:p-6 lg:p-8">
                <Navbar 
                    currentView={mainView}
                    onNavigate={setMainView}
                    currentUser={currentUser!}
                    onLogout={handleLogout}
                />
                
                {mainView === 'creative_analysis' && <CreativeAnalysisView clients={visibleClients} getFormatAnalysis={getFormatAnalysis} />}
                {mainView === 'performance' && <PerformanceView clients={visibleClients} getPerformanceAnalysis={getPerformanceAnalysis} getFormatAnalysis={getFormatAnalysis} lookerData={lookerData} setLookerData={setLookerData} performanceData={performanceData} uploadedVideos={uploadedVideos} setUploadedVideos={setUploadedVideos} startDate={startDate} endDate={endDate} onDateChange={(start, end) => { setStartDate(start); setEndDate(end); }} />}
                {mainView === 'strategies' && <TrendsView clients={visibleClients} lookerData={lookerData} getTrendsAnalysis={getTrendsAnalysis} performanceData={performanceData} startDate={startDate} endDate={endDate} onDateChange={(start, end) => { setStartDate(start); setEndDate(end); }} />}
                {mainView === 'reports' && <ReportsView clients={visibleClients} lookerData={lookerData} bitacoraReports={bitacoraReports} />}
                {mainView === 'settings' && <SettingsView metaApiConfig={metaApiConfig} setMetaApiConfig={setMetaApiConfig} />}
                {mainView === 'control_panel' && currentUser?.role === 'admin' && <ControlPanelView />}
                {mainView === 'clients' && <ClientManager clients={clients} setClients={setClients} currentUser={currentUser!} />}
                {mainView === 'import' && currentUser?.role === 'admin' && <ImportView clients={clients} setClients={setClients} lookerData={lookerData} setLookerData={setLookerData} performanceData={performanceData} setPerformanceData={setPerformanceData} bitacoraReports={bitacoraReports} setBitacoraReports={setBitacoraReports} onSyncFromMeta={handleSyncFromMeta} metaApiConfig={metaApiConfig} currentUser={currentUser} />}
                {mainView === 'users' && currentUser?.role === 'admin' && <UserManager users={users} setUsers={setUsers} currentUser={currentUser!} />}
                {mainView === 'help' && <HelpView />}
                {mainView === 'logs' && currentUser?.role === 'admin' && <LogView />}
            </div>
        )
    }

    if (!isLoggedIn) {
        return <LoginView onLogin={handleLogin} />;
    }
    
    return renderMainContent();
};

export default App;