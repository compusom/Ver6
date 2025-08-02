import { read, utils, WorkBook, WorkSheet } from 'xlsx';
import { Client, PerformanceRecord, AllLookerData, ClientLookerData } from '../types';

// --- UTILITY FUNCTIONS ---
const normalizeHeader = (header: string): string => {
    return header.toLowerCase().trim();
};

const parseNumber = (value: any): number => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const cleaned = value.replace(/[€$]/g, '').trim().replace(/\./g, '').replace(/,/g, '.');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
    }
    return 0;
};

const parseDateForSort = (dateStr: string): Date | null => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        // Assuming DD/MM/YYYY
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
};

// --- COLUMN MAPPING ---
// Bilingual support for column headers
const META_COLUMN_MAP: { [key: string]: keyof PerformanceRecord } = {
    // Spanish keys
    'nombre de la campaña': 'campaignName',
    'nombre del conjunto de anuncios': 'adSetName',
    'nombre del anuncio': 'adName',
    'día': 'day',
    'edad': 'age',
    'sexo': 'gender',
    'importe gastado (eur)': 'spend',
    'entrega de la campaña': 'campaignDelivery',
    'entrega del conjunto de anuncios': 'adSetDelivery',
    'entrega del anuncio': 'adDelivery',
    'impresiones': 'impressions',
    'alcance': 'reach',
    'frecuencia': 'frequency',
    'compras': 'purchases',
    'visitas a la página de destino': 'landingPageViews',
    'clics (todos)': 'clicksAll',
    'cpm (costo por mil impresiones)': 'cpm',
    'ctr (todos)': 'ctrAll',
    'cpc (todos)': 'cpcAll',
    'reproducciones de video de 3 segundos': 'videoPlays3s',
    'pagos iniciados': 'checkoutsInitiated',
    'me gusta en facebook': 'pageLikes',
    'artículos agregados al carrito': 'addsToCart',
    'pagos iniciados en el sitio web': 'checkoutsInitiatedOnWebsite',
    'presupuesto de la campaña': 'campaignBudget',
    'tipo de presupuesto de la campaña': 'campaignBudgetType',
    'públicos personalizados incluidos': 'includedCustomAudiences',
    'públicos personalizados excluidos': 'excludedCustomAudiences',
    'clics en el enlace': 'linkClicks',
    'información de pago agregada': 'paymentInfoAdds',
    'interacción con la página': 'pageEngagement',
    'comentarios de publicaciones': 'postComments',
    'interacciones con la publicación': 'postInteractions',
    'reacciones a publicaciones': 'postReactions',
    'veces que se compartieron las publicaciones': 'postShares',
    'puja': 'bid',
    'tipo de puja': 'bidType',
    'url del sitio web': 'websiteUrl',
    'ctr (porcentaje de clics en el enlace)': 'ctrLink',
    'divisa': 'currency',
    'valor de conversión de compras': 'purchaseValue',
    'objetivo': 'objective',
    'tipo de compra': 'purchaseType',
    'inicio del informe': 'reportStart',
    'fin del informe': 'reportEnd',
    'atencion': 'attention',
    'deseo': 'desire',
    'interes': 'interest',
    'reproducciones de video hasta el 25%': 'videoPlays25percent',
    'reproducciones de video hasta el 50%': 'videoPlays50percent',
    'reproducciones de video hasta el 75%': 'videoPlays75percent',
    'reproducciones de video hasta el 95%': 'videoPlays95percent',
    'reproducciones de video hasta el 100%': 'videoPlays100percent',
    'porcentaje de reproducciones de video de 3 segundos por impresiones': 'videoPlayRate3s',
    'aov': 'aov',
    'lp view rate': 'lpViewRate',
    'adc – lpv': 'adcToLpv',
    'captura de video': 'videoCapture',
    'captura video': 'videoCapture',
    'tasa de conversión de landing': 'landingConversionRate',
    '% compras': 'percentPurchases',
    'visualizaciones': 'visualizations',
    'cvr(link click)': 'cvrLinkClick',
    'retencion video': 'videoRetentionProprietary',
    'retención de video': 'videoRetentionMeta',
    'tiempo promedio de reproducción del video': 'videoAveragePlayTime',
    'thruplays': 'thruPlays',
    'reproducciones de video': 'videoPlays',
    'reproducciones de video continuas de 2 segundos únicas': 'videoPlays2sContinuousUnique',
    'ctr único (porcentaje de clics en el enlace)': 'ctrUniqueLink',
    'nombre de la cuenta': 'accountName',
    'impresiones/compras': 'impressionsPerPurchase',
    'nombre del video': 'videoFileName',
    'imagen, video y presentación': 'creativeIdentifier',
    'porcentaje de compras por visitas a la página de destino': 'purchaseRateFromLandingPageViews',
    'nombre de la imagen': 'imageName',
    // English keys
    'campaign name': 'campaignName',
    'ad set name': 'adSetName',
    'ad name': 'adName',
    'day': 'day',
    'age': 'age',
    'gender': 'gender',
    'amount spent (eur)': 'spend',
    'campaign delivery': 'campaignDelivery',
    'ad set delivery': 'adSetDelivery',
    'ad delivery': 'adDelivery',
    'impressions': 'impressions',
    'reach': 'reach',
    'frequency': 'frequency',
    'purchases': 'purchases',
    'landing page views': 'landingPageViews',
    'clicks (all)': 'clicksAll',
    'cpm (cost per 1,000 impressions)': 'cpm',
    'ctr (all)': 'ctrAll',
    'cpc (all)': 'cpcAll',
    '3-second video plays': 'videoPlays3s',
    'checkouts initiated': 'checkoutsInitiated',
    'page likes': 'pageLikes',
    'adds to cart': 'addsToCart',
    'checkouts initiated on website': 'checkoutsInitiatedOnWebsite',
    'campaign budget': 'campaignBudget',
    'campaign budget type': 'campaignBudgetType',
    'included custom audiences': 'includedCustomAudiences',
    'excluded custom audiences': 'excludedCustomAudiences',
    'link clicks': 'linkClicks',
    'payment info adds': 'paymentInfoAdds',
    'page engagement': 'pageEngagement',
    'post comments': 'postComments',
    'post interactions': 'postInteractions',
    'post reactions': 'postReactions',
    'post shares': 'postShares',
    'bid': 'bid',
    'bid type': 'bidType',
    'website url': 'websiteUrl',
    'ctr (link click-through rate)': 'ctrLink',
    'currency': 'currency',
    'purchase conversion value': 'purchaseValue',
    'objective': 'objective',
    'purchase type': 'purchaseType',
    'reporting starts': 'reportStart',
    'reporting ends': 'reportEnd',
    'attention': 'attention',
    'desire': 'desire',
    'interest': 'interest',
    'video plays at 25%': 'videoPlays25percent',
    'video plays at 50%': 'videoPlays50percent',
    'video plays at 75%': 'videoPlays75percent',
    'video plays at 95%': 'videoPlays95percent',
    'video plays at 100%': 'videoPlays100percent',
    '3-second video play rate': 'videoPlayRate3s',
    'video capture': 'videoCapture',
    'landing page conversion rate': 'landingConversionRate',
    '% purchases': 'percentPurchases',
    'cvr (link click)': 'cvrLinkClick',
    'video retention (proprietary)': 'videoRetentionProprietary',
    'video retention (meta)': 'videoRetentionMeta',
    'average video play time': 'videoAveragePlayTime',
    'video plays': 'videoPlays',
    '2-second continuous video plays (unique)': 'videoPlays2sContinuousUnique',
    'unique ctr (link click-through rate)': 'ctrUniqueLink',
    'account name': 'accountName',
    'impressions/purchases': 'impressionsPerPurchase',
    'video file name': 'videoFileName',
    'image name': 'imageName',
    'creative asset': 'creativeIdentifier'
};

const LOOKER_COLUMN_MAP: { [key: string]: string } = {
    'account name': 'accountName',
    'nombre de la cuenta': 'accountName',
    'ad creative thumbnail url': 'imageUrl',
    'ad name': 'adName',
    'nombre del anuncio': 'adName',
    'ad preview link': 'adPreviewLink',
};

const REQUIRED_META_COLUMNS = ['nombre de la cuenta', 'account name', 'nombre del anuncio', 'ad name', 'día', 'day'];
const REQUIRED_LOOKER_COLUMNS = ['nombre de la cuenta', 'account name', 'nombre del anuncio', 'ad name', 'ad creative thumbnail url'];

type ProcessResult = { client: Client; records: PerformanceRecord[]; undoKeys: string[]; newRecordsCount: number; periodStart?: string; periodEnd?: string; daysDetected?: number; };
type LookerProcessResult = { client: Client; lookerDataPatch: ClientLookerData; undoKeys: string[]; newRecordsCount: number; };

// --- DATA PROCESSING FOR LOOKER (Creatives) ---
export const processLookerData = async (
    file: File,
    clients: Client[],
    currentLookerData: AllLookerData,
    checkOnly: boolean = false
): Promise<{ newAccountNames: string[] } | LookerProcessResult[]> => {
    const data = await file.arrayBuffer();
    const workbook: WorkBook = read(data);
    const sheetName = workbook.SheetNames[0];
    const sheet: WorkSheet = workbook.Sheets[sheetName];
    const json: any[] = utils.sheet_to_json(sheet);

    if (json.length === 0) {
        throw new Error("El archivo de Looker está vacío o tiene un formato no válido.");
    }

    const headers = Object.keys(json[0]).map(normalizeHeader);
    const hasRequiredCols = REQUIRED_LOOKER_COLUMNS.some(col => headers.includes(col));
    if (!hasRequiredCols) {
        throw new Error(`Columnas requeridas para Looker no encontradas. Asegúrate de que el reporte es correcto.`);
    }

    const accountNameKey = headers.find(h => h === 'nombre de la cuenta' || h === 'account name');
    if (!accountNameKey) throw new Error("Columna de nombre de cuenta no encontrada en el archivo de Looker.");

    const originalHeaders = Object.keys(json[0]);
    const accountNameOriginalKey = originalHeaders.find(h => normalizeHeader(h) === accountNameKey)!;
    
    const uniqueAccountNames = [...new Set(json.map(row => row[accountNameOriginalKey]))].filter(name => name && typeof name === 'string' && name.trim() !== '') as string[];
    const newAccountNames = uniqueAccountNames.filter(name => !clients.some(c => c.metaAccountName === name || c.name === name));

    if (checkOnly) {
        return { newAccountNames };
    }

    if (newAccountNames.length > 0) {
        throw new Error(`Nuevas cuentas encontradas en archivo de Looker: ${newAccountNames.join(', ')}. Por favor, créalas primero.`);
    }

    const results: LookerProcessResult[] = [];
    const knownAccountNames = uniqueAccountNames.filter(name => clients.some(c => c.metaAccountName === name || c.name === name));
    
    const adNameOriginalKey = originalHeaders.find(h => normalizeHeader(h) === 'nombre del anuncio' || normalizeHeader(h) === 'ad name')!;
    const imageUrlOriginalKey = originalHeaders.find(h => normalizeHeader(h) === 'ad creative thumbnail url')!;
    const adPreviewLinkOriginalKey = originalHeaders.find(h => normalizeHeader(h) === 'ad preview link');

    for (const accountName of knownAccountNames) {
        const client = clients.find(c => c.metaAccountName === accountName || c.name === accountName)!;
        const clientJsonData = json.filter(row => row[accountNameOriginalKey] === accountName);
        
        const existingLookerData = currentLookerData[client.id] || {};
        const lookerDataPatch: ClientLookerData = {};
        const undoKeys: string[] = [];
        let newRecordsCount = 0;
        
        clientJsonData.forEach(row => {
            const adName = row[adNameOriginalKey];
            const imageUrl = row[imageUrlOriginalKey];

            if (adName && imageUrl && !existingLookerData[adName]) {
                lookerDataPatch[adName] = {
                    imageUrl: imageUrl,
                    adPreviewLink: adPreviewLinkOriginalKey ? row[adPreviewLinkOriginalKey] : undefined,
                };
                undoKeys.push(adName);
                newRecordsCount++;
            }
        });

        if (newRecordsCount > 0) {
            results.push({
                client,
                lookerDataPatch,
                undoKeys,
                newRecordsCount
            });
        }
    }
    
    return results;
}

// --- CORE DATA PROCESSING LOGIC FOR META ---
export const processPerformanceData = async (
    fileOrData: File | any[],
    clients: Client[],
    currentPerformanceData: { [key: string]: PerformanceRecord[] },
    source: 'meta',
    checkOnly: boolean = false
): Promise<{ newAccountNames: string[] } | ProcessResult[]> => {
    let json: any[];
    if (fileOrData instanceof File) {
        const data = await fileOrData.arrayBuffer();
        const workbook: WorkBook = read(data);
        const sheetName = workbook.SheetNames[0];
        const sheet: WorkSheet = workbook.Sheets[sheetName];
        json = utils.sheet_to_json(sheet);
    } else {
        json = fileOrData;
    }

    if (json.length === 0) {
        throw new Error("El archivo está vacío o tiene un formato no válido.");
    }
    
    const headers = Object.keys(json[0]).map(normalizeHeader);
    const hasRequiredCols = REQUIRED_META_COLUMNS.some(col => headers.includes(col));
    if (!hasRequiredCols) {
         throw new Error(`Columnas requeridas no encontradas. Asegúrate de que el reporte es correcto. Faltan: ${REQUIRED_META_COLUMNS.join(', ')}`);
    }

    const accountNameKey = headers.find(h => h === 'nombre de la cuenta' || h === 'account name');
    if (!accountNameKey) throw new Error("Columna 'Nombre de la cuenta' o 'Account name' no encontrada.");
    
    const dayKey = headers.find(h => h === 'día' || h === 'day');
    if (!dayKey) throw new Error("Columna 'Día' o 'Day' no encontrada.");

    const originalHeaders = Object.keys(json[0]);
    const accountNameOriginalKey = originalHeaders.find(h => normalizeHeader(h) === accountNameKey)!;
    const dayOriginalKey = originalHeaders.find(h => normalizeHeader(h) === dayKey)!;


    const uniqueAccountNames = [...new Set(json.map(row => row[accountNameOriginalKey]))].filter(name => name && typeof name === 'string' && name.trim() !== '') as string[];
    const newAccountNames = uniqueAccountNames.filter(name => !clients.some(c => c.metaAccountName === name));

    if (checkOnly) {
        return { newAccountNames };
    }

    if (newAccountNames.length > 0) {
        throw new Error(`Nuevas cuentas encontradas: ${newAccountNames.join(', ')}. Por favor, créalas primero.`);
    }
    
    const results: ProcessResult[] = [];
    const knownAccountNames = uniqueAccountNames.filter(name => clients.some(c => c.metaAccountName === name));

    if (knownAccountNames.length === 0) {
        throw new Error('Ninguna de las cuentas en el archivo está registrada en el sistema.');
    }
    
    const columnMap = headers.reduce((acc, header) => {
        const key = META_COLUMN_MAP[header];
        if (key) acc[header] = key;
        return acc;
    }, {} as { [key: string]: keyof PerformanceRecord });


    for (const accountName of knownAccountNames) {
        const client = clients.find(c => c.metaAccountName === accountName)!;
        const clientJsonData = json.filter(row => row[accountNameOriginalKey] === accountName);
        
        const existingKeys = new Set((currentPerformanceData[client.id] || []).map(r => r.uniqueId));
        const newRecords: PerformanceRecord[] = [];
        const undoKeys: string[] = [];
        const uniqueDaysInImport = new Set<string>();

        clientJsonData.forEach(row => {
            const record: Partial<PerformanceRecord> = { clientId: client!.id };
            const originalRow = originalHeaders.reduce((acc, key) => {
                acc[normalizeHeader(key)] = row[key];
                return acc;
            }, {} as any);
            
            Object.keys(columnMap).forEach(header => {
                const mappedKey = columnMap[header];
                if (mappedKey) {
                    // @ts-ignore
                    record[mappedKey] = originalRow[header];
                }
            });
            
            const r = record as PerformanceRecord;
            const uniqueId = `${r.day}_${r.campaignName}_${r.adName}_${r.age}_${r.gender}`;
            
            if (!existingKeys.has(uniqueId)) {
                const numericRecord: PerformanceRecord = {
                    ...r,
                    uniqueId,
                    spend: parseNumber(r.spend),
                    impressions: parseNumber(r.impressions),
                    reach: parseNumber(r.reach),
                    frequency: parseNumber(r.frequency),
                    purchases: parseNumber(r.purchases),
                    landingPageViews: parseNumber(r.landingPageViews),
                    clicksAll: parseNumber(r.clicksAll),
                    cpm: parseNumber(r.cpm),
                    ctrAll: parseNumber(r.ctrAll),
                    cpcAll: parseNumber(r.cpcAll),
                    videoPlays3s: parseNumber(r.videoPlays3s),
                    checkoutsInitiated: parseNumber(r.checkoutsInitiated),
                    pageLikes: parseNumber(r.pageLikes),
                    addsToCart: parseNumber(r.addsToCart),
                    checkoutsInitiatedOnWebsite: parseNumber(r.checkoutsInitiatedOnWebsite),
                    linkClicks: parseNumber(r.linkClicks),
                    paymentInfoAdds: parseNumber(r.paymentInfoAdds),
                    pageEngagement: parseNumber(r.pageEngagement),
                    postComments: parseNumber(r.postComments),
                    postInteractions: parseNumber(r.postInteractions),
                    postReactions: parseNumber(r.postReactions),
                    postShares: parseNumber(r.postShares),
                    ctrLink: parseNumber(r.ctrLink),
                    purchaseValue: parseNumber(r.purchaseValue),
                    attention: parseNumber(r.attention),
                    desire: parseNumber(r.desire),
                    interest: parseNumber(r.interest),
                    videoPlays25percent: parseNumber(r.videoPlays25percent),
                    videoPlays50percent: parseNumber(r.videoPlays50percent),
                    videoPlays75percent: parseNumber(r.videoPlays75percent),
                    videoPlays95percent: parseNumber(r.videoPlays95percent),
                    videoPlays100percent: parseNumber(r.videoPlays100percent),
                    videoPlayRate3s: parseNumber(r.videoPlayRate3s),
                    aov: parseNumber(r.aov),
                    lpViewRate: parseNumber(r.lpViewRate),
                    adcToLpv: parseNumber(r.adcToLpv),
                    landingConversionRate: parseNumber(r.landingConversionRate),
                    percentPurchases: parseNumber(r.percentPurchases),
                    visualizations: parseNumber(r.visualizations),
                    cvrLinkClick: parseNumber(r.cvrLinkClick),
                    videoRetentionProprietary: parseNumber(r.videoRetentionProprietary),
                    videoRetentionMeta: parseNumber(r.videoRetentionMeta),
                    videoAveragePlayTime: parseNumber(r.videoAveragePlayTime),
                    thruPlays: parseNumber(r.thruPlays),
                    videoPlays: parseNumber(r.videoPlays),
                    videoPlays2sContinuousUnique: parseNumber(r.videoPlays2sContinuousUnique),
                    ctrUniqueLink: parseNumber(r.ctrUniqueLink),
                    impressionsPerPurchase: parseNumber(r.impressionsPerPurchase),
                    purchaseRateFromLandingPageViews: parseNumber(r.purchaseRateFromLandingPageViews),
                };
                newRecords.push(numericRecord);
                undoKeys.push(uniqueId);
                uniqueDaysInImport.add(r.day);
            }
        });
        
        const sortedDates = newRecords.map(r => parseDateForSort(r.day)).filter(d => d !== null) as Date[];
        const periodStart = sortedDates.length > 0 ? new Date(Math.min(...sortedDates.map(d => d.getTime()))).toISOString().split('T')[0] : undefined;
        const periodEnd = sortedDates.length > 0 ? new Date(Math.max(...sortedDates.map(d => d.getTime()))).toISOString().split('T')[0] : undefined;

        if (newRecords.length > 0) {
            results.push({
                client,
                records: newRecords,
                undoKeys,
                newRecordsCount: newRecords.length,
                periodStart,
                periodEnd,
                daysDetected: uniqueDaysInImport.size
            });
        }
    }

    return results;
};