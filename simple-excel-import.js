// =====================================================================
// IMPORTACIÓN SIMPLIFICADA PARA ESTRUCTURA ACTUAL
// Usa las tablas existentes: clients, metricas, archivos_reporte
// =====================================================================

import sql from 'mssql';

/**
 * Función helper para buscar o crear cliente en tabla 'clients'
 */
export async function getOrCreateClientSimple(sqlPool, clientName, currency = 'EUR') {
    try {
        // Buscar cliente existente (sin usar currency)
        let result = await sqlPool.request()
            .input('clientName', sql.VarChar(255), clientName)
            .query('SELECT client_id FROM clients WHERE name = @clientName');
        
        if (result.recordset.length > 0) {
            console.log(`[Simple Import] Found existing client: ${clientName}`);
            return result.recordset[0].client_id;
        }
        
        // Crear nuevo cliente (sin currency)
        const normalizedName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        result = await sqlPool.request()
            .input('name', sql.VarChar(255), clientName)
            .input('name_norm', sql.VarChar(255), normalizedName)
            .query(`
                INSERT INTO clients (name, name_norm) 
                OUTPUT INSERTED.client_id 
                VALUES (@name, @name_norm)
            `);
        
        console.log(`[Simple Import] Created new client: ${clientName}`);
        return result.recordset[0].client_id;
    } catch (error) {
        console.error('[Simple Import] Error in getOrCreateClientSimple:', error.message);
        throw error;
    }
}

/**
 * Función helper para obtener DateID en formato YYYYMMDD
 */
export function getDateIDSimple(dateValue) {
    if (!dateValue) return null;
    
    let date;
    if (typeof dateValue === 'string') {
        date = new Date(dateValue);
    } else if (dateValue instanceof Date) {
        date = dateValue;
    } else {
        return null;
    }
    
    if (isNaN(date.getTime())) return null;
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return parseInt(`${year}${month}${day}`);
}

/**
 * Función helper para normalizar nombres de columnas
 */
export function normalizeKeySimple(key) {
    return key
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
        .toLowerCase();
}

/**
 * Función helper para parsear números
 */
export function parseNumberSimple(value) {
    if (value === null || value === undefined || value === '') return null;
    
    const str = value.toString().replace(/[,%\s]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
}

/**
 * Función para detectar el campo de gasto y extraer la moneda
 */
export function detectSpendFieldAndCurrency(row) {
    const keys = Object.keys(row);
    
    // Buscar patrón "Importe gastado (XXX)" o "Amount spent (XXX)"
    const spendFieldRegex = /^(Importe\s+gastado|Amount\s+spent)\s*\(([A-Z]{3})\)$/i;
    
    for (const key of keys) {
        const match = key.match(spendFieldRegex);
        if (match) {
            return {
                field: key,
                currency: match[2].toUpperCase(),
                normalizedField: normalizeKeySimple(key)
            };
        }
    }
    
    // Fallback: buscar campos que contengan "gastado", "spent", "cost", "spend"
    const fallbackPatterns = [
        /importe.*gastado/i,
        /amount.*spent/i,
        /spend/i,
        /cost/i,
        /gasto/i
    ];
    
    for (const pattern of fallbackPatterns) {
        const foundKey = keys.find(key => pattern.test(key));
        if (foundKey) {
            // Intentar extraer moneda del campo "Divisa" si existe
            const currency = row['Divisa'] || row['Currency'] || 'EUR';
            
            return {
                field: foundKey,
                currency: currency.toString().toUpperCase(),
                normalizedField: normalizeKeySimple(foundKey)
            };
        }
    }
    
    // Última opción: usar importe_gastado_EUR como default
    return {
        field: 'Importe gastado (EUR)',
        currency: 'EUR',
        normalizedField: 'importe_gastado_eur'
    };
}

/**
 * Función para extraer información de moneda de una fila
 */
export function extractCurrencyFromRow(row) {
    // 1. Buscar campo "Divisa" directamente (prioritario)
    if (row['Divisa']) {
        const divisa = row['Divisa'].toString().trim().toUpperCase();
        console.log(`[Currency Detection] Found 'Divisa' field: ${divisa}`);
        return divisa;
    }
    
    // 2. Buscar campo "Currency" (alternativo)
    if (row['Currency']) {
        const currency = row['Currency'].toString().trim().toUpperCase();
        console.log(`[Currency Detection] Found 'Currency' field: ${currency}`);
        return currency;
    }
    
    // 3. Extraer de campo de gasto como fallback
    const spendInfo = detectSpendFieldAndCurrency(row);
    console.log(`[Currency Detection] Extracted from spend field: ${spendInfo.currency}`);
    return spendInfo.currency;
}

/**
 * MAPEO COMPLETO: 67 CAMPOS EXCEL → DB
 * Mapea todos los campos disponibles del Excel a sus columnas correspondientes en la DB
 */
export const SIMPLE_FIELD_MAPPING = new Map([
    // === IDENTIFICADORES Y ESTRUCTURA ===
    ['nombre_de_la_campana', 'nombre_de_la_campaña'],
    ['nombre_del_conjunto_de_anuncios', 'nombre_del_conjunto_de_anuncios'],
    ['nombre_del_anuncio', 'nombre_del_anuncio'],
    ['nombre_de_la_cuenta', 'nombre_de_la_cuenta'],
    ['dia', 'dia'],
    
    // === SEGMENTACIÓN DEMOGRÁFICA ===
    ['edad', 'edad'],
    ['sexo', 'sexo'],
    
    // === MONEDA Y GASTO ===
    ['importe_gastado_eur', 'importe_gastado_EUR'],  // Dinámico según moneda
    ['divisa', 'divisa'],
    
    // === ESTADOS DE ENTREGA ===
    ['entrega_de_la_campana', 'entrega_de_la_campaña'],
    ['entrega_del_conjunto_de_anuncios', 'entrega_del_conjunto_de_anuncios'],
    ['entrega_del_anuncio', 'entrega_del_anuncio'],
    
    // === MÉTRICAS DE ALCANCE E IMPRESIONES ===
    ['impresiones', 'impresiones'],
    ['alcance', 'alcance'],
    ['frecuencia', 'frecuencia'],
    ['impresiones_compras', 'impresiones_compras'],
    
    // === MÉTRICAS DE CONVERSIÓN ===
    ['compras', 'compras'],
    ['valor_de_conversion_de_compras', 'valor_de_conversión_compras'],
    ['pagos_iniciados', 'pagos_iniciados'],
    ['pagos_iniciados_en_el_sitio_web', 'pagos_iniciados_web'],
    ['informacion_de_pago_agregada', 'información_de_pago_agregada'],
    ['pct_compras', 'pct_compras'],
    ['porcentaje_de_compras_por_visitas_a_la_pagina_de_destino', 'pct_compras_por_visitas_lp'],
    
    // === MÉTRICAS DE CLICS Y CTR ===
    ['clics_todos', 'clics_todos'],
    ['clics_en_el_enlace', 'clics_en_el_enlace'],
    ['ctr_todos', 'ctr_todos'],
    ['ctr_porcentaje_de_clics_en_el_enlace', 'ctr_link_click_pct'],
    ['ctr_unico_porcentaje_de_clics_en_el_enlace', 'ctr_unico_enlace_pct'],
    ['cvr_link_click', 'cvr_link_click'],
    
    // === MÉTRICAS DE COSTOS ===
    ['cpm_costo_por_mil_impresiones', 'cpm_costo_por_mil_impresiones'],
    ['cpc_todos', 'cpc_todos'],
    
    // === MÉTRICAS DE TRÁFICO WEB ===
    ['visitas_a_la_pagina_de_destino', 'visitas_a_la_página_de_destino'],
    ['lp_view_rate', 'lp_view_rate'],
    ['tasa_de_conversion_de_landing', 'tasa_conv_landing'],
    
    // === MÉTRICAS DE VIDEO ===
    ['reproducciones_de_video_de_3_segundos', 'reproducciones_3s'],
    ['reproducciones_de_video_hasta_el_25', 'rep_video_25_pct'],
    ['reproducciones_de_video_hasta_el_50', 'rep_video_50_pct'],
    ['reproducciones_de_video_hasta_el_75', 'rep_video_75_pct'],
    ['reproducciones_de_video_hasta_el_95', 'rep_video_95_pct'],
    ['reproducciones_de_video_hasta_el_100', 'rep_video_100_pct'],
    ['porcentaje_de_reproducciones_de_video_de_3_segundos_por_impresiones', 'pct_rep_3s_por_impresiones'],
    ['tiempo_promedio_de_reproduccion_del_video', 'tiempo_promedio_video'],
    ['thruplays', 'thruplays'],
    ['reproducciones_de_video', 'rep_video'],
    ['reproducciones_de_video_continuas_de_2_segundos_unicas', 'rep_video_2s_unicas'],
    ['retencion_video', 'retencion_video_short'],
    ['retencion_de_video', 'retención_de_video'],
    ['captura_de_video', 'captura_de_video'],
    ['captura_video', 'captura_video_final'],
    
    // === MÉTRICAS DE ENGAGEMENT SOCIAL ===
    ['me_gusta_en_facebook', 'me_gusta_en_facebook'],
    ['comentarios_de_publicaciones', 'comentarios_de_publicaciones'],
    ['interacciones_con_la_publicacion', 'interacciones_con_la_publicación'],
    ['reacciones_a_publicaciones', 'reacciones_a_publicaciones'],
    ['veces_que_se_compartieron_las_publicaciones', 'veces_compartidas_publicaciones'],
    ['interaccion_con_la_pagina', 'interacción_con_la_página'],
    
    // === MÉTRICAS DE E-COMMERCE ===
    ['articulos_agregados_al_carrito', 'artículos_agregados_al_carrito'],
    ['aov', 'aov'],
    ['adc_lpv', 'adc_lpv'],
    
    // === CONFIGURACIÓN DE CAMPAÑA ===
    ['presupuesto_de_la_campana', 'presupuesto_de_la_campaña'],
    ['tipo_de_presupuesto_de_la_campana', 'tipo_de_presupuesto_de_la_campaña'],
    ['puja', 'puja'],
    ['tipo_de_puja', 'tipo_de_puja'],
    ['objetivo', 'objetivo'],
    ['tipo_de_compra', 'tipo_de_compra'],
    
    // === AUDIENCIAS ===
    ['publicos_personalizados_incluidos', 'públicos_personalizados_incluidos'],
    ['publicos_personalizados_excluidos', 'públicos_personalizados_excluidos'],
    
    // === URLs Y ENLACES ===
    ['url_del_sitio_web', 'url_del_sitio_web'],
    ['nombre_de_la_imagen', 'nombre_de_la_imagen'],
    
    // === PERÍODOS DE REPORTE ===
    ['inicio_del_informe', 'inicio_del_informe'],
    ['fin_del_informe', 'fin_del_informe'],
    
    // === MÉTRICAS DE FUNNEL (CUSTOM) ===
    ['atencion', 'atencion'],
    ['deseo', 'deseo'],
    ['interes', 'interes'],
    ['visualizaciones', 'visualizaciones']
]);

/**
 * Campos numéricos para el parsing (COMPLETO)
 */
export const SIMPLE_NUMERIC_COLUMNS = new Set([
    // === MONEDA Y GASTO ===
    'importe_gastado_EUR',
    
    // === MÉTRICAS DE ALCANCE E IMPRESIONES ===
    'impresiones',
    'alcance',
    'frecuencia',
    'impresiones_compras',
    
    // === MÉTRICAS DE CONVERSIÓN ===
    'compras',
    'valor_de_conversión_compras',
    'pagos_iniciados',
    'pagos_iniciados_web',
    'información_de_pago_agregada',
    'pct_compras',
    'pct_compras_por_visitas_lp',
    
    // === MÉTRICAS DE CLICS Y CTR ===
    'clics_todos',
    'clics_en_el_enlace',
    'ctr_todos',
    'ctr_link_click_pct',
    'ctr_unico_enlace_pct',
    'cvr_link_click',
    
    // === MÉTRICAS DE COSTOS ===
    'cpm_costo_por_mil_impresiones',
    'cpc_todos',
    
    // === MÉTRICAS DE TRÁFICO WEB ===
    'visitas_a_la_página_de_destino',
    'lp_view_rate',
    'tasa_conv_landing',
    
    // === MÉTRICAS DE VIDEO ===
    'reproducciones_3s',
    'rep_video_25_pct',
    'rep_video_50_pct',
    'rep_video_75_pct',
    'rep_video_95_pct',
    'rep_video_100_pct',
    'pct_rep_3s_por_impresiones',
    'tiempo_promedio_video',
    'thruplays',
    'rep_video',
    'rep_video_2s_unicas',
    'retencion_video_short',
    'retención_de_video',
    'captura_de_video',
    'captura_video_final',
    
    // === MÉTRICAS DE ENGAGEMENT SOCIAL ===
    'me_gusta_en_facebook',
    'comentarios_de_publicaciones',
    'interacciones_con_la_publicación',
    'reacciones_a_publicaciones',
    'veces_compartidas_publicaciones',
    'interacción_con_la_página',
    
    // === MÉTRICAS DE E-COMMERCE ===
    'artículos_agregados_al_carrito',
    'aov',
    'adc_lpv',
    
    // === CONFIGURACIÓN DE CAMPAÑA ===
    'presupuesto_de_la_campaña',
    'puja',
    
    // === MÉTRICAS DE FUNNEL (CUSTOM) ===
    'atencion',
    'deseo',
    'interes',
    'visualizaciones'
]);

/**
 * Función principal para procesar una fila de Excel (versión simple)
 */
export async function processRowSimple(sqlPool, row, clientId, reportId, spendInfo = null) {
    try {
        // 1. Detectar campo de gasto dinámicamente (solo si no se pasó)
        if (!spendInfo) {
            spendInfo = detectSpendFieldAndCurrency(row);
        }
        
        // 2. Extraer y normalizar datos
        const normalized = {};
        const original = {};
        
        for (const [k, v] of Object.entries(row)) {
            const nk = normalizeKeySimple(k);
            original[nk] = v;
            
            // Mapear el campo de gasto dinámicamente
            let colName = SIMPLE_FIELD_MAPPING.get(nk);
            
            // Si es el campo de gasto detectado, mapearlo a importe_gastado_EUR
            if (k === spendInfo.field) {
                colName = 'importe_gastado_EUR';
            }
            
            if (colName) {
                if (v === null || v === undefined || v === '' || v === '-') {
                    normalized[colName] = null;
                } else if (SIMPLE_NUMERIC_COLUMNS.has(colName)) {
                    normalized[colName] = parseNumberSimple(v);
                } else if (colName === 'dia' || colName === 'inicio_del_informe' || colName === 'fin_del_informe') {
                    normalized[colName] = new Date(v);
                } else {
                    normalized[colName] = String(v).trim();
                }
            }
        }
        
        // 2. Crear unique_id para evitar duplicados
        const uniqueId = `${original.dia || 'no_date'}_${
            original.nombre_de_la_campana || 'no_campaign'
        }_${
            original.nombre_del_anuncio || 'no_ad'
        }_${original.edad || 'no_age'}_${original.sexo || 'no_gender'}`;
        
        normalized.unique_id = uniqueId;
        normalized.id_reporte = reportId;
        
        // 3. Eliminar registro existente si existe
        await sqlPool.request()
            .input('unique_id', sql.VarChar(255), uniqueId)
            .input('id_reporte', sql.Int, reportId)
            .query(`
                DELETE FROM metricas 
                WHERE unique_id = @unique_id AND id_reporte = @id_reporte
            `);
        
        // 4. Insertar nuevo registro
        const req = sqlPool.request();
        
        // Mapear TODOS los campos disponibles (67 campos)
        const fieldsToInsert = {
            // === CAMPOS REQUERIDOS ===
            'id_reporte': reportId,
            'unique_id': uniqueId,
            
            // === IDENTIFICADORES Y ESTRUCTURA ===
            'nombre_de_la_campaña': normalized['nombre_de_la_campaña'] || null,
            'nombre_del_conjunto_de_anuncios': normalized['nombre_del_conjunto_de_anuncios'] || null,
            'nombre_del_anuncio': normalized['nombre_del_anuncio'] || null,
            'nombre_de_la_cuenta': normalized['nombre_de_la_cuenta'] || null,
            'dia': normalized['dia'] || null,
            
            // === SEGMENTACIÓN DEMOGRÁFICA ===
            'edad': normalized['edad'] || null,
            'sexo': normalized['sexo'] || null,
            
            // === MONEDA Y GASTO ===
            'importe_gastado_EUR': normalized['importe_gastado_EUR'] || 0,
            'divisa': normalized['divisa'] || spendInfo.currency,
            
            // === ESTADOS DE ENTREGA ===
            'entrega_de_la_campaña': normalized['entrega_de_la_campaña'] || null,
            'entrega_del_conjunto_de_anuncios': normalized['entrega_del_conjunto_de_anuncios'] || null,
            'entrega_del_anuncio': normalized['entrega_del_anuncio'] || null,
            
            // === MÉTRICAS DE ALCANCE E IMPRESIONES ===
            'impresiones': normalized['impresiones'] || 0,
            'alcance': normalized['alcance'] || 0,
            'frecuencia': normalized['frecuencia'] || null,
            'impresiones_compras': normalized['impresiones_compras'] || null,
            
            // === MÉTRICAS DE CONVERSIÓN ===
            'compras': normalized['compras'] || 0,
            'valor_de_conversión_compras': normalized['valor_de_conversión_compras'] || 0,
            'pagos_iniciados': normalized['pagos_iniciados'] || null,
            'pagos_iniciados_web': normalized['pagos_iniciados_web'] || null,
            'información_de_pago_agregada': normalized['información_de_pago_agregada'] || null,
            'pct_compras': normalized['pct_compras'] || null,
            'pct_compras_por_visitas_lp': normalized['pct_compras_por_visitas_lp'] || null,
            
            // === MÉTRICAS DE CLICS Y CTR ===
            'clics_todos': normalized['clics_todos'] || 0,
            'clics_en_el_enlace': normalized['clics_en_el_enlace'] || null,
            'ctr_todos': normalized['ctr_todos'] || null,
            'ctr_link_click_pct': normalized['ctr_link_click_pct'] || null,
            'ctr_unico_enlace_pct': normalized['ctr_unico_enlace_pct'] || null,
            'cvr_link_click': normalized['cvr_link_click'] || null,
            
            // === MÉTRICAS DE COSTOS ===
            'cpm_costo_por_mil_impresiones': normalized['cpm_costo_por_mil_impresiones'] || null,
            'cpc_todos': normalized['cpc_todos'] || null,
            
            // === MÉTRICAS DE TRÁFICO WEB ===
            'visitas_a_la_página_de_destino': normalized['visitas_a_la_página_de_destino'] || null,
            'lp_view_rate': normalized['lp_view_rate'] || null,
            'tasa_conv_landing': normalized['tasa_conv_landing'] || null,
            
            // === MÉTRICAS DE VIDEO ===
            'reproducciones_3s': normalized['reproducciones_3s'] || null,
            'rep_video_25_pct': normalized['rep_video_25_pct'] || 0,
            'rep_video_50_pct': normalized['rep_video_50_pct'] || 0,
            'rep_video_75_pct': normalized['rep_video_75_pct'] || 0,
            'rep_video_95_pct': normalized['rep_video_95_pct'] || 0,
            'rep_video_100_pct': normalized['rep_video_100_pct'] || 0,
            'pct_rep_3s_por_impresiones': normalized['pct_rep_3s_por_impresiones'] || null,
            'tiempo_promedio_video': normalized['tiempo_promedio_video'] || null,
            'thruplays': normalized['thruplays'] || null,
            'rep_video': normalized['rep_video'] || null,
            'rep_video_2s_unicas': normalized['rep_video_2s_unicas'] || null,
            'retencion_video_short': normalized['retencion_video_short'] || null,
            'retención_de_video': normalized['retención_de_video'] || null,
            'captura_de_video': normalized['captura_de_video'] || null,
            'captura_video_final': normalized['captura_video_final'] || null,
            
            // === MÉTRICAS DE ENGAGEMENT SOCIAL ===
            'me_gusta_en_facebook': normalized['me_gusta_en_facebook'] || null,
            'comentarios_de_publicaciones': normalized['comentarios_de_publicaciones'] || null,
            'interacciones_con_la_publicación': normalized['interacciones_con_la_publicación'] || null,
            'reacciones_a_publicaciones': normalized['reacciones_a_publicaciones'] || null,
            'veces_compartidas_publicaciones': normalized['veces_compartidas_publicaciones'] || null,
            'interacción_con_la_página': normalized['interacción_con_la_página'] || null,
            
            // === MÉTRICAS DE E-COMMERCE ===
            'artículos_agregados_al_carrito': normalized['artículos_agregados_al_carrito'] || null,
            'aov': normalized['aov'] || null,
            'adc_lpv': normalized['adc_lpv'] || null,
            
            // === CONFIGURACIÓN DE CAMPAÑA ===
            'presupuesto_de_la_campaña': normalized['presupuesto_de_la_campaña'] || null,
            'tipo_de_presupuesto_de_la_campaña': normalized['tipo_de_presupuesto_de_la_campaña'] || null,
            'puja': normalized['puja'] || null,
            'tipo_de_puja': normalized['tipo_de_puja'] || null,
            'objetivo': normalized['objetivo'] || null,
            'tipo_de_compra': normalized['tipo_de_compra'] || null,
            
            // === AUDIENCIAS ===
            'públicos_personalizados_incluidos': normalized['públicos_personalizados_incluidos'] || null,
            'públicos_personalizados_excluidos': normalized['públicos_personalizados_excluidos'] || null,
            
            // === URLs Y ENLACES ===
            'url_del_sitio_web': normalized['url_del_sitio_web'] || null,
            'nombre_de_la_imagen': normalized['nombre_de_la_imagen'] || null,
            
            // === PERÍODOS DE REPORTE ===
            'inicio_del_informe': normalized['inicio_del_informe'] || null,
            'fin_del_informe': normalized['fin_del_informe'] || null,
            
            // === MÉTRICAS DE FUNNEL (CUSTOM) ===
            'atencion': normalized['atencion'] || null,
            'deseo': normalized['deseo'] || null,
            'interes': normalized['interes'] || null,
            'visualizaciones': normalized['visualizaciones'] || null
        };
        
        // Añadir parámetros con tipos correctos
        for (const [field, value] of Object.entries(fieldsToInsert)) {
            const paramName = `p_${field.replace(/[^a-zA-Z0-9]/g, '_')}`;
            
            if (field === 'id_reporte') {
                req.input(paramName, sql.Int, value);
            } else if (field === 'dia' || field === 'inicio_del_informe' || field === 'fin_del_informe') {
                req.input(paramName, sql.Date, value);
            } else if (typeof value === 'number') {
                // Usar tipos más específicos según el campo
                if (field.includes('pct') || field.includes('rate') || field.includes('ctr') || field.includes('cvr') || field === 'frecuencia' || field.includes('cpm') || field.includes('cpc') || field === 'aov' || field === 'tiempo_promedio_video') {
                    req.input(paramName, sql.Decimal(10, 4), value);
                } else if ((field.includes('impresiones') || field.includes('alcance') || field.includes('rep_video')) && Number.isInteger(value)) {
                    req.input(paramName, sql.BigInt, value);
                } else {
                    req.input(paramName, sql.Decimal(12, 2), value);
                }
            } else if (field === 'públicos_personalizados_incluidos' || field === 'públicos_personalizados_excluidos' || field === 'url_del_sitio_web') {
                req.input(paramName, sql.Text, value);
            } else {
                req.input(paramName, sql.VarChar(255), value);
            }
        }
        
        // Generar dinámicamente la consulta SQL INSERT con todos los campos
        const columnNames = Object.keys(fieldsToInsert).filter(k => k !== 'id_reporte' && k !== 'unique_id');
        const allColumns = ['id_reporte', 'unique_id', ...columnNames.map(col => `[${col}]`)].join(', ');
        const allParams = ['@p_id_reporte', '@p_unique_id', ...columnNames.map(col => `@p_${col.replace(/[^a-zA-Z0-9]/g, '_')}`)].join(', ');
        
        await req.query(`
            INSERT INTO metricas (${allColumns})
            VALUES (${allParams})
        `);
        
        return { success: true };
        
    } catch (error) {
        console.error('[Simple Import] Error processing row:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Función para crear reporte en archivos_reporte
 */
export async function createReportRecord(sqlPool, clientId, fileName, fileHash, periodStart, periodEnd, daysDetected) {
    try {
        const result = await sqlPool.request()
            .input('client_id', sql.Int, clientId)
            .input('nombre_archivo', sql.VarChar(255), fileName)
            .input('hash_archivo', sql.Char(64), fileHash)
            .input('period_start', sql.Date, periodStart)
            .input('period_end', sql.Date, periodEnd)
            .input('days_detected', sql.Int, daysDetected)
            .query(`
                INSERT INTO archivos_reporte 
                (client_id, nombre_archivo, hash_archivo, period_start, period_end, days_detected) 
                OUTPUT INSERTED.id_reporte 
                VALUES (@client_id, @nombre_archivo, @hash_archivo, @period_start, @period_end, @days_detected)
            `);
        
        return result.recordset[0].id_reporte;
    } catch (error) {
        console.error('[Simple Import] Error creating report record:', error.message);
        throw error;
    }
}