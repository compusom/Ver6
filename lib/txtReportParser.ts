import { BitacoraReport, ReportMetadata, ReportTable, ReportRow, ParsedMetricValue } from '../types';

const parseMetricValue = (valueStr: string): ParsedMetricValue | string => {
    if (!valueStr || valueStr.trim() === '-') return valueStr;

    const cleanedStr = valueStr.trim();

    // Match currency, numbers, percentages, and symbols
    const match = cleanedStr.match(/^(€|£|\$)?\s*([0-9.,]+)\s*(x|%|s)?\s*(\(([-+]?[0-9.,]+)%\s*(🔺|🔻|▲|▼|✅|🏆)\))?$/i);

    if (match) {
        const [, symbol, value, unit, , change, changeSymbol] = match;
        
        const parsedValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
        if (isNaN(parsedValue)) return cleanedStr;

        const result: ParsedMetricValue = { value: parsedValue };
        
        if (symbol) result.symbol = symbol;
        if (unit) {
            result.symbol = (result.symbol || '') + unit;
        } else if (value.includes(',')) { // Heuristic for non-currency values that use comma decimal
            // No unit symbol
        }
        
        if (change) {
            result.change = parseFloat(change.replace(',', '.')) / 100;
            if (changeSymbol === '🔺' || changeSymbol === '▲' || changeSymbol === '✅' || changeSymbol === '🏆') result.direction = 'up';
            else if (changeSymbol === '🔻' || changeSymbol === '▼') result.direction = 'down';
            else result.direction = 'neutral';
        }
        return result;
    }
    
    // For values like "77% 🏆"
    const stabilityMatch = cleanedStr.match(/^([0-9.,]+)%\s*(✅|🏆)$/);
     if (stabilityMatch) {
        const [, value, symbol] = stabilityMatch;
        const parsedValue = parseFloat(value.replace(',', '.'));
        if (isNaN(parsedValue)) return cleanedStr;

        return {
            value: parsedValue,
            symbol: '% ' + symbol,
            direction: 'up'
        };
    }

    return cleanedStr;
};


const parseMarkdownTable = (tableLines: string[], title: string): ReportTable => {
    if (tableLines.length < 2) {
        return { title, headers: [], rows: [] };
    }

    const headers = tableLines[0].split('|').map(h => h.trim()).filter(Boolean);
    const rows: ReportRow[] = [];

    for (let i = 2; i < tableLines.length; i++) {
        const columns = tableLines[i].split('|').map(c => c.trim()).filter(Boolean);
        if (columns.length === 0 || headers.length === 0) continue;

        const row: ReportRow = {};
        headers.forEach((header, index) => {
             row[header] = parseMetricValue(columns[index] || '');
        });
        rows.push(row);
    }
    
    return { title, headers, rows };
};

export const parseBitacoraReport = (content: string): Omit<BitacoraReport, 'id' | 'clientId' | 'fileName' | 'importDate'> => {
    const lines = content.split('\n');
    const metadata: Partial<ReportMetadata> = {};
    const tables: ReportTable[] = [];
    
    let currentTableTitle = '';
    let currentTableLines: string[] = [];
    let inTable = false;

    lines.forEach(line => {
        // Metadata
        if (line.startsWith('Reporte Bitácora')) metadata.reportType = line.split('(')[1]?.split(')')[0] || 'Unknown';
        if (line.startsWith('Moneda Detectada:')) metadata.currency = line.split(':')[1]?.trim();
        if (line.startsWith('Campaña Filtrada:')) metadata.campaignFilter = line.split(':')[1]?.trim();
        if (line.startsWith('AdSets Filtrados:')) metadata.adSetFilter = line.split(':')[1]?.trim();

        const titleMatch = line.match(/^\s*\*{2}\s*(.*?)\s*\*{2}\s*$/) || line.match(/^-{3,}\s*(.*?)\s*-{3,}$/) || line.match(/^={3,}\s*(.*?)\s*={3,}$/) || line.match(/^\s*TABLA:\s*(.*?)\s*$/);
        
        if (titleMatch && titleMatch[1]) {
             currentTableTitle = titleMatch[1].trim();
        }
        
        const isTableDelimiter = line.trim().match(/^\|-.*-\|$/);
        const isTableStart = line.trim().startsWith('|') && !isTableDelimiter;

        if (isTableStart && !inTable) {
            inTable = true;
            currentTableLines.push(line.trim());
        } else if (inTable) {
            if (line.trim().startsWith('|')) {
                currentTableLines.push(line.trim());
            } else {
                if(currentTableLines.length > 1) {
                    tables.push(parseMarkdownTable(currentTableLines, currentTableTitle || `Tabla Sin Título ${tables.length + 1}`));
                }
                currentTableLines = [];
                currentTableTitle = '';
                inTable = false;
            }
        }
    });

    if (inTable && currentTableLines.length > 1) {
        tables.push(parseMarkdownTable(currentTableLines, currentTableTitle || `Tabla Sin Título ${tables.length + 1}`));
    }
    
    const findTableByTitle = (partialTitle: string): ReportTable | undefined => {
        return tables.find(t => t.title.toLowerCase().includes(partialTitle.toLowerCase()));
    };

    const findTablesByTitle = (partialTitle: string): ReportTable[] => {
        return tables.filter(t => t.title.toLowerCase().includes(partialTitle.toLowerCase()));
    };

    return {
        metadata: metadata as ReportMetadata,
        mainSummaryTable: findTableByTitle('cuenta completa'),
        funnelAnalysisTable: findTableByTitle('análisis de embudo'),
        topAdsTables: findTablesByTitle('top 20 ads'),
        topAdSetsTables: findTablesByTitle('top 20 adsets'),
        topCampaignsTables: findTablesByTitle('top 10 campañas'),
        audiencePerformanceTable: findTableByTitle('performance_publico'),
        ratioTrendsTable: findTableByTitle('tendencia_ratios'),
    };
};
