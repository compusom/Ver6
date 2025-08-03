import { PerformanceRecord, Client, ProcessResult } from '../types';

interface MCPConfig {
    testUrl: string;
    productionUrl: string;
    authentication?: string;
    path?: string;
}

interface SupabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    poolMode: string;
}

interface MCPPayload {
    source: 'ver6_excel_import';
    timestamp: string;
    client: {
        id: string;
        name: string;
        currency: string;
        metaAccountName?: string;
    };
    data: {
        totalRecords: number;
        newRecords: number;
        periodStart?: string;
        periodEnd?: string;
        daysDetected?: number;
        performanceData: PerformanceRecord[];
    };
    summary: {
        totalSpend: number;
        totalRevenue: number;
        totalImpressions: number;
        totalPurchases: number;
        overallROAS: number;
        topPerformingAds: Array<{
            adName: string;
            spend: number;
            roas: number;
            purchases: number;
        }>;
    };
}

class MCPConnector {
    private static instance: MCPConnector;
    private config: MCPConfig | null = null;

    private constructor() {
        // Load MCP config from localStorage
        this.loadConfig();
    }

    public static getInstance(): MCPConnector {
        if (!MCPConnector.instance) {
            MCPConnector.instance = new MCPConnector();
        }
        return MCPConnector.instance;
    }

    private loadConfig(): void {
        try {
            const savedConfig = localStorage.getItem('db_mcp_config');
            if (savedConfig) {
                this.config = JSON.parse(savedConfig);
            }
        } catch (error) {
            console.error('[MCP] Error loading config:', error);
        }
    }

    public saveConfig(config: MCPConfig): void {
        try {
            this.config = config;
            localStorage.setItem('db_mcp_config', JSON.stringify(config));
            console.log('[MCP] Configuration saved');
        } catch (error) {
            console.error('[MCP] Error saving config:', error);
        }
    }

    public getConfig(): MCPConfig | null {
        return this.config;
    }

    public async sendExcelData(processResult: ProcessResult): Promise<boolean> {
        console.log('[MCP] ========== INICIO ENVÍO AL MCP ==========');
        console.log('[MCP] Config presente:', !!this.config);
        console.log('[MCP] Config actual:', this.config);
        
        if (!this.config) {
            console.warn('[MCP] No configuration found, skipping MCP sync');
            return false;
        }

        try {
            console.log('[MCP] Preparing Excel data for MCP server...');
            console.log('[MCP] ProcessResult recibido:', {
                client: processResult.client.name,
                recordsCount: processResult.records.length,
                newRecordsCount: processResult.newRecordsCount
            });

            // Calculate summary metrics
            const records = processResult.records;
            const totalSpend = records.reduce((sum, r) => sum + r.spend, 0);
            const totalRevenue = records.reduce((sum, r) => sum + r.purchaseValue, 0);
            const totalImpressions = records.reduce((sum, r) => sum + r.impressions, 0);
            const totalPurchases = records.reduce((sum, r) => sum + r.purchases, 0);
            const overallROAS = totalSpend > 0 ? totalRevenue / totalSpend : 0;

            console.log('[MCP] Métricas calculadas:', {
                totalSpend,
                totalRevenue,
                totalImpressions,
                totalPurchases,
                overallROAS
            });

            // Get top performing ads
            const adPerformance = new Map<string, { spend: number; revenue: number; purchases: number }>();
            records.forEach(record => {
                const existing = adPerformance.get(record.adName) || { spend: 0, revenue: 0, purchases: 0 };
                adPerformance.set(record.adName, {
                    spend: existing.spend + record.spend,
                    revenue: existing.revenue + record.purchaseValue,
                    purchases: existing.purchases + record.purchases
                });
            });

            const topPerformingAds = Array.from(adPerformance.entries())
                .map(([adName, metrics]) => ({
                    adName,
                    spend: metrics.spend,
                    roas: metrics.spend > 0 ? metrics.revenue / metrics.spend : 0,
                    purchases: metrics.purchases
                }))
                .sort((a, b) => b.roas - a.roas)
                .slice(0, 10);

            // Prepare payload
            const payload: MCPPayload = {
                source: 'ver6_excel_import',
                timestamp: new Date().toISOString(),
                client: {
                    id: processResult.client.id,
                    name: processResult.client.name,
                    currency: processResult.client.currency,
                    metaAccountName: processResult.client.metaAccountName
                },
                data: {
                    totalRecords: records.length,
                    newRecords: processResult.newRecordsCount,
                    periodStart: processResult.periodStart,
                    periodEnd: processResult.periodEnd,
                    daysDetected: processResult.daysDetected,
                    performanceData: records
                },
                summary: {
                    totalSpend,
                    totalRevenue,
                    totalImpressions,
                    totalPurchases,
                    overallROAS,
                    topPerformingAds
                }
            };

            console.log('[MCP] Payload preparado:', {
                source: payload.source,
                timestamp: payload.timestamp,
                client: payload.client,
                dataSize: JSON.stringify(payload).length + ' bytes',
                recordsCount: payload.data.performanceData.length
            });

            // Use test URL for now
            const url = this.constructUrl(this.config.testUrl, this.config.path);
            
            console.log('[MCP] URL final construida:', url);
            console.log('[MCP] Headers que se envían:', {
                'Content-Type': 'application/json',
                'Authorization': this.config.authentication ? '***configurado***' : 'no configurado'
            });

            console.log('[MCP] ========== INICIANDO FETCH ==========');
            
            // Try direct CORS request first for honest feedback
            console.log('[MCP] Intentando envío directo con CORS...');
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            console.log('[MCP] Response status:', response.status);
            console.log('[MCP] Response ok:', response.ok);
            console.log('[MCP] Response headers:', Object.fromEntries(response.headers.entries()));

            if (response.ok) {
                const responseData = await response.text();
                console.log('[MCP] ✅ SUCCESS - Response data:', responseData);
                console.log('[MCP] ========== ENVÍO EXITOSO ==========');
                return true;
            } else {
                console.error('[MCP] ❌ FAILED - Status:', response.status, response.statusText);
                const errorText = await response.text();
                console.error('[MCP] Error response body:', errorText);
                console.log('[MCP] ========== ENVÍO FALLIDO ==========');
                return false;
            }

        } catch (error) {
            console.error('[MCP] ❌ EXCEPTION durante el envío:', error);
            console.error('[MCP] Error stack:', error instanceof Error ? error.stack : 'No stack available');
            console.log('[MCP] ========== ERROR EN ENVÍO ==========');
            
            // Even if MCP fails, try Supabase
            console.log('[MCP] MCP falló, intentando con Supabase...');
            try {
                const supabaseResult = await this.sendToSupabase(processResult);
                if (supabaseResult) {
                    console.log('[MCP] ✅ Datos guardados en Supabase como respaldo');
                    return true; // Consider it a success if Supabase works
                }
            } catch (supabaseError) {
                console.error('[MCP] Supabase también falló:', supabaseError);
            }
            
            return false;
        }
        
        // Also try to send to Supabase as backup
        console.log('[MCP] ========== ENVIANDO TAMBIÉN A SUPABASE ==========');
        try {
            await this.sendToSupabase(processResult);
            console.log('[MCP] ✅ Datos también guardados en Supabase');
        } catch (supabaseError) {
            console.error('[MCP] ⚠️ Supabase backup failed:', supabaseError);
        }
        
        return true;
    }

    private constructUrl(baseUrl: string, path?: string): string {
        if (!path) return baseUrl;
        
        // Remove trailing slash from baseUrl and leading slash from path
        const cleanBaseUrl = baseUrl.replace(/\/$/, '');
        const cleanPath = path.replace(/^\//, '');
        
        return `${cleanBaseUrl}/${cleanPath}`;
    }

    public async testConnection(): Promise<{ success: boolean; message: string }> {
        console.log('[MCP] ========== INICIO TEST DE CONEXIÓN ==========');
        console.log('[MCP] Config presente:', !!this.config);
        console.log('[MCP] Config completa:', this.config);
        
        if (!this.config) {
            return { success: false, message: 'No MCP configuration found' };
        }

        const url = this.constructUrl(this.config.testUrl, this.config.path);
        console.log('[MCP] URL de test construida:', url);
        
        const testPayload = {
            source: 'ver6_connection_test',
            timestamp: new Date().toISOString(),
            message: 'Test connection from Ver6 Creative Assistant'
        };

        console.log('[MCP] Payload de test:', testPayload);

        try {
            // Try regular CORS first - this will give us real feedback
            console.log('[MCP] ========== INTENTANDO CORS DIRECTO ==========');
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(testPayload)
            });

            console.log('[MCP] Response status:', response.status);
            console.log('[MCP] Response ok:', response.ok);
            console.log('[MCP] Response headers:', Object.fromEntries(response.headers.entries()));

            if (response.ok) {
                const responseText = await response.text();
                console.log('[MCP] ✅ TEST EXITOSO - Response:', responseText);
                return { 
                    success: true, 
                    message: `✅ Connection successful! Response: ${responseText}` 
                };
            } else {
                const errorText = await response.text();
                console.error('[MCP] ❌ TEST FALLIDO - Status:', response.status, response.statusText);
                console.error('[MCP] Error response:', errorText);
                return { 
                    success: false, 
                    message: `❌ HTTP Error ${response.status}: ${response.statusText}. Response: ${errorText}` 
                };
            }

        } catch (error) {
            console.error('[MCP] ❌ EXCEPTION en test:', error);
            console.error('[MCP] Error tipo:', error.constructor.name);
            console.error('[MCP] Error message:', error instanceof Error ? error.message : 'Unknown');
            
            // Check if it's specifically a CORS error
            if (error instanceof TypeError) {
                if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                    return { 
                        success: false, 
                        message: '❌ CORS/Network Error: Cannot reach n8n server. Check if:\n1. The URL is correct\n2. n8n server is running\n3. CORS is enabled on n8n webhook\n4. No firewall blocking the connection' 
                    };
                }
            }
            
            return { 
                success: false, 
                message: `❌ Connection error: ${error instanceof Error ? error.message : 'Unknown error'}` 
            };
        }
    }

    // Supabase Integration Methods
    private getSupabaseConfig(): SupabaseConfig {
        return {
            host: 'aws-0-us-east-1.pooler.supabase.com',
            port: 6543,
            database: 'postgres',
            user: 'postgres.rqdahffythodugjlxsz',
            password: 'Cataclismoss',
            poolMode: 'transaction'
        };
    }

    public async sendToSupabase(processResult: ProcessResult): Promise<boolean> {
        console.log('[SUPABASE] ========== INICIO ENVÍO A SUPABASE ==========');
        
        try {
            // Prepare the payload similar to MCP
            const payload = {
                source: 'ver6_excel_import',
                timestamp: new Date().toISOString(),
                client_id: processResult.client.id,
                client_name: processResult.client.name,
                client_currency: processResult.client.currency,
                meta_account_name: processResult.client.metaAccountName,
                total_records: processResult.records.length,
                new_records: processResult.newRecordsCount,
                period_start: processResult.periodStart,
                period_end: processResult.periodEnd,
                days_detected: processResult.daysDetected,
                total_spend: processResult.records.reduce((sum, r) => sum + r.spend, 0),
                total_revenue: processResult.records.reduce((sum, r) => sum + r.purchaseValue, 0),
                total_impressions: processResult.records.reduce((sum, r) => sum + r.impressions, 0),
                total_purchases: processResult.records.reduce((sum, r) => sum + r.purchases, 0),
                performance_data: JSON.stringify(processResult.records)
            };

            console.log('[SUPABASE] Payload preparado:', {
                source: payload.source,
                client: payload.client_name,
                records: payload.total_records,
                dataSize: JSON.stringify(payload).length + ' bytes'
            });

            // Use Supabase REST API to insert data
            const supabaseUrl = 'https://rqdahffythodugjlxsz.supabase.co/rest/v1/excel_imports';
            const serviceRoleKey = 'sb_secret_OXLvWnnDiWEkwC2AuyR4aA_6s171714'; // Using service role key for write operations

            console.log('[SUPABASE] Enviando a:', supabaseUrl);
            console.log('[SUPABASE] Payload size:', JSON.stringify(payload).length, 'bytes');
            console.log('[SUPABASE] Headers:', {
                'Content-Type': 'application/json',
                'apikey': serviceRoleKey.substring(0, 20) + '...',
                'Authorization': 'Bearer ' + serviceRoleKey.substring(0, 20) + '...',
                'Prefer': 'return=minimal'
            });

            console.log('[SUPABASE] ========== INICIANDO FETCH REAL A SUPABASE ==========');

            const response = await fetch(supabaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': serviceRoleKey,
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(payload)
            });

            console.log('[SUPABASE] Response status:', response.status);
            console.log('[SUPABASE] Response statusText:', response.statusText);
            console.log('[SUPABASE] Response ok:', response.ok);
            console.log('[SUPABASE] Response headers:', Object.fromEntries(response.headers.entries()));

            if (response.ok) {
                const responseText = await response.text();
                console.log('[SUPABASE] ✅ SUCCESS - Data sent to Supabase');
                console.log('[SUPABASE] Response body:', responseText);
                return true;
            } else {
                const errorText = await response.text();
                console.error('[SUPABASE] ❌ FAILED - Status:', response.status, response.statusText);
                console.error('[SUPABASE] Error response:', errorText);
                console.error('[SUPABASE] Error response headers:', Object.fromEntries(response.headers.entries()));
                
                // Try to parse and log structured error
                try {
                    const errorJson = JSON.parse(errorText);
                    console.error('[SUPABASE] Parsed error:', errorJson);
                } catch (e) {
                    console.error('[SUPABASE] Raw error (not JSON):', errorText);
                }
                
                return false;
            }

        } catch (error) {
            console.error('[SUPABASE] ❌ EXCEPTION:', error);
            console.error('[SUPABASE] Error stack:', error instanceof Error ? error.stack : 'No stack available');
            return false;
        }
    }

    public async testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
        console.log('[SUPABASE] ========== INICIO TEST SUPABASE ==========');
        
        try {
            const testPayload = {
                source: 'ver6_connection_test',
                timestamp: new Date().toISOString(),
                client_id: 'test-client',
                client_name: 'Test Client',
                client_currency: 'USD',
                meta_account_name: 'Test Account',
                total_records: 1,
                new_records: 1,
                period_start: '2025-08-01',
                period_end: '2025-08-02',
                days_detected: 2,
                total_spend: 100,
                total_revenue: 200,
                total_impressions: 1000,
                total_purchases: 5,
                performance_data: JSON.stringify([{
                    adName: 'Test Ad',
                    spend: 100,
                    purchases: 5,
                    purchaseValue: 200,
                    impressions: 1000
                }])
            };

            const supabaseUrl = 'https://rqdahffythodugjlxsz.supabase.co/rest/v1/excel_imports';
            const serviceRoleKey = 'sb_secret_OXLvWnnDiWEkwC2AuyR4aA_6s171714';

            console.log('[SUPABASE] Testing connection to:', supabaseUrl);
            console.log('[SUPABASE] Service Role Key presente:', !!serviceRoleKey);
            console.log('[SUPABASE] Service Role Key length:', serviceRoleKey.length);
            console.log('[SUPABASE] Test payload:', testPayload);
            console.log('[SUPABASE] Headers:', {
                'Content-Type': 'application/json',
                'apikey': serviceRoleKey.substring(0, 20) + '...',
                'Authorization': 'Bearer ' + serviceRoleKey.substring(0, 20) + '...',
                'Prefer': 'return=minimal'
            });

            console.log('[SUPABASE] ========== INICIANDO FETCH A SUPABASE ==========');

            const response = await fetch(supabaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': serviceRoleKey,
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(testPayload)
            });

            console.log('[SUPABASE] Test response status:', response.status);
            console.log('[SUPABASE] Test response statusText:', response.statusText);
            console.log('[SUPABASE] Test response headers:', Object.fromEntries(response.headers.entries()));

            if (response.ok) {
                const responseText = await response.text();
                console.log('[SUPABASE] ✅ TEST EXITOSO - Response text:', responseText);
                return { 
                    success: true, 
                    message: `✅ Supabase connection successful! Status: ${response.status}. Response: ${responseText || 'Empty response (normal for minimal return)'}` 
                };
            } else {
                const errorText = await response.text();
                console.error('[SUPABASE] ❌ TEST FALLIDO - Status:', response.status, response.statusText);
                console.error('[SUPABASE] Error response body:', errorText);
                console.error('[SUPABASE] Error response headers:', Object.fromEntries(response.headers.entries()));
                
                // Parse error details if possible
                let errorDetails = errorText;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorDetails = `Code: ${errorJson.code || 'Unknown'}, Message: ${errorJson.message || errorText}, Details: ${errorJson.details || 'None'}`;
                } catch (e) {
                    // Keep original error text if not JSON
                }
                
                return { 
                    success: false, 
                    message: `❌ Supabase Error ${response.status} (${response.statusText}): ${errorDetails}` 
                };
            }

        } catch (error) {
            console.error('[SUPABASE] ❌ EXCEPTION en test:', error);
            console.error('[SUPABASE] Exception type:', error?.constructor?.name);
            console.error('[SUPABASE] Exception message:', error instanceof Error ? error.message : 'Unknown');
            console.error('[SUPABASE] Exception stack:', error instanceof Error ? error.stack : 'No stack');
            
            let errorMessage = 'Unknown error';
            if (error instanceof TypeError) {
                if (error.message.includes('Failed to fetch')) {
                    errorMessage = 'Network error - Cannot reach Supabase servers. Check internet connection or firewall.';
                } else if (error.message.includes('CORS')) {
                    errorMessage = 'CORS error - Browser blocking request to Supabase.';
                } else {
                    errorMessage = `Network/Fetch error: ${error.message}`;
                }
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            
            return { 
                success: false, 
                message: `❌ Supabase connection error: ${errorMessage}` 
            };
        }
    }
}

export const mcpConnector = MCPConnector.getInstance();
