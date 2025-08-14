// =====================================================================================
// ETL PROCEDURES PARA INTEGRACIÓN DIMENSIONAL
// Funciones JavaScript para cargar datos del Excel a las tablas dimensionales
// Optimizado para SQLite y compatible con el sistema existente
// =====================================================================================

/**
 * Utilidades para normalización de datos
 */
const ETLUtils = {
    /**
     * Normaliza nombre de anuncio (sin tildes, espacios múltiples)
     */
    normalizeAdName(name) {
        if (!name) return '';
        return name
            .toString()
            .trim()
            .toUpperCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
            .replace(/\s+/g, ' ') // Espacios múltiples a uno
            .substring(0, 255); // Limitar longitud
    },

    /**
     * Extrae dominio de URL
     */
    extractDomain(url) {
        if (!url) return null;
        try {
            const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
            return urlObj.hostname;
        } catch {
            // Extracción manual si URL no es válida
            const match = url.match(/\/\/([^\/]+)/);
            return match ? match[1] : url.split('/')[0];
        }
    },

    /**
     * Convierte fecha DD/MM/YYYY a YYYY-MM-DD
     */
    parseDate(dateString) {
        if (!dateString) return null;
        
        // Intentar formato DD/MM/YYYY primero
        const ddmmyyyy = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyy) {
            const [, day, month, year] = ddmmyyyy;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        
        // Intentar otros formatos comunes
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
        
        return null;
    },

    /**
     * Convierte string con formato español a número
     */
    parseNumber(value, decimals = 4) {
        if (value === null || value === undefined || value === '') return 0;
        
        const str = value.toString()
            .replace(/\./g, '') // Quitar separadores de miles
            .replace(/,/g, '.'); // Coma decimal a punto
        
        const num = parseFloat(str);
        return isNaN(num) ? 0 : Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
    },

    /**
     * Convierte string a entero
     */
    parseInt(value) {
        if (value === null || value === undefined || value === '') return 0;
        
        const str = value.toString().replace(/\./g, ''); // Quitar separadores de miles
        const num = parseInt(str, 10);
        return isNaN(num) ? 0 : num;
    },

    /**
     * Normaliza género a formato estándar
     */
    normalizeGender(gender) {
        if (!gender) return 'DESCONOCIDO';
        
        const normalized = gender.toString().trim().toUpperCase();
        
        if (['MASCULINO', 'MALE', 'M', 'HOMBRE'].includes(normalized)) return 'MASCULINO';
        if (['FEMENINO', 'FEMALE', 'F', 'MUJER'].includes(normalized)) return 'FEMENINO';
        if (['TODOS', 'ALL', 'AMBOS'].includes(normalized)) return 'TODOS';
        
        return 'DESCONOCIDO';
    },

    /**
     * Normaliza estado de entrega
     */
    normalizeStatus(status) {
        if (!status) return 'UNKNOWN';
        
        const normalized = status.toString().trim().toUpperCase();
        
        if (['ACTIVO', 'ACTIVE'].includes(normalized)) return 'ACTIVE';
        if (['PAUSADO', 'PAUSED'].includes(normalized)) return 'PAUSED';
        if (['ARCHIVADO', 'ARCHIVED'].includes(normalized)) return 'ARCHIVED';
        if (['DESAPROBADO', 'DISAPPROVED'].includes(normalized)) return 'DISAPPROVED';
        if (['REVISIÓN', 'PENDING_REVIEW', 'REVISION'].includes(normalized)) return 'PENDING_REVIEW';
        
        return normalized;
    },

    /**
     * Parsea lista de audiencias separadas por ; o ,
     */
    parseAudiences(audienceString) {
        if (!audienceString) return [];
        
        return audienceString
            .toString()
            .split(/[;,\n]/)
            .map(item => item.trim())
            .filter(item => item.length > 0)
            .slice(0, 50); // Limitar a 50 audiencias por adset
    },

    /**
     * Genera clave natural para SCD Tipo 2
     */
    generateNaturalKey(...parts) {
        return parts
            .filter(part => part && part.toString().trim())
            .map(part => part.toString().trim())
            .join('|');
    }
};

/**
 * Clase principal para ETL dimensional
 */
class DimensionalETL {
    constructor(dbExecutor) {
        this.db = dbExecutor; // Función para ejecutar SQL
        this.batchId = null;
        this.errors = [];
        this.stats = {
            recordsProcessed: 0,
            recordsSuccess: 0,
            recordsFailed: 0
        };
    }

    /**
     * Inicia un nuevo batch ETL
     */
    async startBatch(batchName, sourceType = 'excel', fileHash = null) {
        const result = await this.db(`
            INSERT INTO etl_batches (batch_name, source_type, file_hash, status)
            VALUES (?, ?, ?, 'processing')
        `, [batchName, sourceType, fileHash]);
        
        this.batchId = result.lastInsertRowid;
        this.errors = [];
        this.stats = { recordsProcessed: 0, recordsSuccess: 0, recordsFailed: 0 };
        
        console.log(`[ETL] Started batch ${this.batchId}: ${batchName}`);
        return this.batchId;
    }

    /**
     * Finaliza el batch ETL
     */
    async completeBatch(status = 'completed') {
        if (!this.batchId) return;

        const errorMessage = this.errors.length > 0 ? this.errors.join('; ') : null;
        
        await this.db(`
            UPDATE etl_batches 
            SET status = ?, 
                records_processed = ?, 
                records_failed = ?,
                completed_at = datetime('now'),
                error_message = ?
            WHERE batch_id = ?
        `, [status, this.stats.recordsProcessed, this.stats.recordsFailed, errorMessage, this.batchId]);

        console.log(`[ETL] Completed batch ${this.batchId}: ${status}`);
        console.log(`[ETL] Stats:`, this.stats);
        
        return {
            batchId: this.batchId,
            status,
            stats: this.stats,
            errors: this.errors
        };
    }

    /**
     * Upsert dimension con manejo de errores
     */
    async upsertDimension(tableName, data, uniqueFields, additionalFields = {}) {
        try {
            // Construir WHERE clause para búsqueda
            const whereClause = uniqueFields.map(field => `${field} = ?`).join(' AND ');
            const whereValues = uniqueFields.map(field => data[field]);

            // Verificar si existe
            const existing = await this.db(
                `SELECT * FROM ${tableName} WHERE ${whereClause}`,
                whereValues
            );

            if (existing.length > 0) {
                // Actualizar si hay campos adicionales diferentes
                const updates = Object.keys(additionalFields)
                    .filter(field => existing[0][field] !== additionalFields[field])
                    .map(field => `${field} = ?`);

                if (updates.length > 0) {
                    const updateValues = updates.map(update => {
                        const field = update.split(' = ')[0];
                        return additionalFields[field];
                    });

                    await this.db(
                        `UPDATE ${tableName} SET ${updates.join(', ')}, updated_at = datetime('now') WHERE ${whereClause}`,
                        [...updateValues, ...whereValues]
                    );
                }

                return existing[0];
            } else {
                // Insertar nuevo
                const allFields = { ...data, ...additionalFields };
                const fieldNames = Object.keys(allFields);
                const placeholders = fieldNames.map(() => '?').join(', ');
                const values = Object.values(allFields);

                const result = await this.db(
                    `INSERT INTO ${tableName} (${fieldNames.join(', ')}) VALUES (${placeholders})`,
                    values
                );

                return { ...allFields, [tableName.replace('dim_', '') + '_id']: result.lastInsertRowid };
            }
        } catch (error) {
            this.errors.push(`Error in ${tableName}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Obtiene o crea fecha en dim_date
     */
    async getOrCreateDate(dateString) {
        const normalizedDate = ETLUtils.parseDate(dateString);
        if (!normalizedDate) {
            throw new Error(`Invalid date: ${dateString}`);
        }

        const existing = await this.db(
            'SELECT date_id FROM dim_date WHERE date = ?',
            [normalizedDate]
        );

        if (existing.length > 0) {
            return existing[0].date_id;
        }

        // Si no existe, crearla (aunque debería estar pre-poblada)
        const date = new Date(normalizedDate);
        const result = await this.db(`
            INSERT INTO dim_date (
                date, year, month, day, day_of_week, week_of_year, 
                is_weekend, quarter, month_name, day_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            normalizedDate,
            date.getFullYear(),
            date.getMonth() + 1,
            date.getDate(),
            date.getDay(),
            Math.ceil(date.getDate() / 7),
            [0, 6].includes(date.getDay()) ? 1 : 0,
            Math.ceil((date.getMonth() + 1) / 3),
            date.toLocaleDateString('es-ES', { month: 'long' }),
            date.toLocaleDateString('es-ES', { weekday: 'long' })
        ]);

        return result.lastInsertRowid;
    }

    /**
     * Procesa audiencias para un adset
     */
    async processAudiences(adsetId, includedAudiences, excludedAudiences) {
        // Limpiar audiencias existentes para este adset
        await this.db('DELETE FROM bridge_adset_audience_included WHERE adset_id = ?', [adsetId]);
        await this.db('DELETE FROM bridge_adset_audience_excluded WHERE adset_id = ?', [adsetId]);

        // Procesar audiencias incluidas
        const includedList = ETLUtils.parseAudiences(includedAudiences);
        for (const audienceName of includedList) {
            const audience = await this.upsertDimension(
                'dim_audience',
                { audience_name: audienceName },
                ['audience_name'],
                { audience_type: 'custom' }
            );

            await this.db(
                'INSERT OR IGNORE INTO bridge_adset_audience_included (adset_id, audience_id) VALUES (?, ?)',
                [adsetId, audience.audience_id]
            );
        }

        // Procesar audiencias excluidas
        const excludedList = ETLUtils.parseAudiences(excludedAudiences);
        for (const audienceName of excludedList) {
            const audience = await this.upsertDimension(
                'dim_audience',
                { audience_name: audienceName },
                ['audience_name'],
                { audience_type: 'custom' }
            );

            await this.db(
                'INSERT OR IGNORE INTO bridge_adset_audience_excluded (adset_id, audience_id) VALUES (?, ?)',
                [adsetId, audience.audience_id]
            );
        }
    }

    /**
     * Maneja SCD Tipo 2 para una dimensión
     */
    async handleSCDType2(tableName, naturalKey, currentData, dateField) {
        // Buscar versión actual
        const current = await this.db(
            `SELECT * FROM ${tableName} WHERE ${naturalKey.field} = ? AND scd_is_current = 1`,
            [naturalKey.value]
        );

        if (current.length === 0) {
            // Primera vez - insertar como versión 1
            const result = await this.db(`
                INSERT INTO ${tableName} (
                    ${Object.keys(currentData).join(', ')},
                    ${naturalKey.field},
                    scd_valid_from,
                    scd_is_current,
                    scd_version
                ) VALUES (
                    ${Object.keys(currentData).map(() => '?').join(', ')},
                    ?, ?, 1, 1
                )
            `, [...Object.values(currentData), naturalKey.value, dateField]);

            return result.lastInsertRowid;
        }

        const currentRecord = current[0];
        
        // Verificar si hay cambios en campos rastreados
        const trackedFields = Object.keys(currentData).filter(field => 
            !['created_at', 'updated_at'].includes(field)
        );
        
        const hasChanges = trackedFields.some(field => 
            currentRecord[field] !== currentData[field]
        );

        if (!hasChanges) {
            // No hay cambios - retornar ID actual
            return currentRecord[tableName.replace('dim_', '') + '_id'];
        }

        // Hay cambios - cerrar versión actual y crear nueva
        await this.db(
            `UPDATE ${tableName} 
             SET scd_valid_to = date('now', '-1 day'), scd_is_current = 0 
             WHERE ${naturalKey.field} = ? AND scd_is_current = 1`,
            [naturalKey.value]
        );

        // Crear nueva versión
        const newVersion = (currentRecord.scd_version || 1) + 1;
        const result = await this.db(`
            INSERT INTO ${tableName} (
                ${Object.keys(currentData).join(', ')},
                ${naturalKey.field},
                scd_valid_from,
                scd_is_current,
                scd_version
            ) VALUES (
                ${Object.keys(currentData).map(() => '?').join(', ')},
                ?, ?, 1, ?
            )
        `, [...Object.values(currentData), naturalKey.value, dateField, newVersion]);

        return result.lastInsertRowid;
    }

    /**
     * Procesa una fila del Excel hacia las tablas dimensionales
     */
    async processExcelRow(row) {
        try {
            this.stats.recordsProcessed++;

            // 1. Validaciones básicas
            const date = ETLUtils.parseDate(row['Día']);
            if (!date) {
                throw new Error(`Invalid date: ${row['Día']}`);
            }

            const accountName = row['Nombre de la cuenta']?.toString().trim();
            const campaignName = row['Nombre de la campaña']?.toString().trim();
            const adsetName = row['Nombre del conjunto de anuncios']?.toString().trim();
            const adName = row['Nombre del anuncio']?.toString().trim();

            if (!accountName || !campaignName || !adsetName || !adName) {
                throw new Error('Missing required fields: account, campaign, adset, or ad name');
            }

            // 2. Obtener IDs de dimensiones básicas
            const dateId = await this.getOrCreateDate(row['Día']);

            // Currency
            const currencyCode = row['Divisa']?.toString().trim() || 'EUR';
            const currency = await this.upsertDimension(
                'dim_currency',
                { currency_code: currencyCode },
                ['currency_code'],
                { currency_name: currencyCode === 'EUR' ? 'Euro' : currencyCode }
            );

            // Account
            const account = await this.upsertDimension(
                'dim_account',
                { account_name: accountName },
                ['account_name'],
                { currency_id: currency.currency_id }
            );

            // Age y Gender
            const ageLabel = row['Edad']?.toString().trim() || 'Desconocido';
            const age = await this.upsertDimension(
                'dim_age',
                { age_label: ageLabel },
                ['age_label']
            );

            const genderLabel = ETLUtils.normalizeGender(row['Sexo']);
            const gender = await this.upsertDimension(
                'dim_gender',
                { gender_label: genderLabel },
                ['gender_label']
            );

            // Objective y Budget Type
            let objectiveId = null;
            if (row['Objetivo']) {
                const objective = await this.upsertDimension(
                    'dim_objective',
                    { objective_name: row['Objetivo'].toString().trim() },
                    ['objective_name']
                );
                objectiveId = objective.objective_id;
            }

            let budgetTypeId = null;
            if (row['Tipo de presupuesto de la campaña']) {
                const budgetType = await this.upsertDimension(
                    'dim_budget_type',
                    { budget_type_name: row['Tipo de presupuesto de la campaña'].toString().trim() },
                    ['budget_type_name']
                );
                budgetTypeId = budgetType.budget_type_id;
            }

            // Status dimensions
            const campaignStatusName = ETLUtils.normalizeStatus(row['Entrega de la campaña']);
            const campaignStatus = await this.upsertDimension(
                'dim_status',
                { scope: 'campaign', status_name: campaignStatusName },
                ['scope', 'status_name']
            );

            const adsetStatusName = ETLUtils.normalizeStatus(row['Entrega del conjunto de anuncios']);
            const adsetStatus = await this.upsertDimension(
                'dim_status',
                { scope: 'adset', status_name: adsetStatusName },
                ['scope', 'status_name']
            );

            const adStatusName = ETLUtils.normalizeStatus(row['Entrega del anuncio']);
            const adStatus = await this.upsertDimension(
                'dim_status',
                { scope: 'ad', status_name: adStatusName },
                ['scope', 'status_name']
            );

            // URL dimension
            let urlId = null;
            if (row['URL del sitio web']) {
                const fullUrl = row['URL del sitio web'].toString().trim();
                const domain = ETLUtils.extractDomain(fullUrl);
                const url = await this.upsertDimension(
                    'dim_url',
                    { full_url: fullUrl },
                    ['full_url'],
                    { 
                        domain: domain,
                        path: fullUrl.split(domain)[1] || '/'
                    }
                );
                urlId = url.url_id;
            }

            // 3. SCD Tipo 2 para Campaign
            const campaignNaturalKey = ETLUtils.generateNaturalKey(accountName, campaignName);
            const campaignData = {
                account_id: account.account_id,
                campaign_name: campaignName,
                objective_id: objectiveId,
                budget: ETLUtils.parseNumber(row['Presupuesto de la campaña'], 2),
                budget_type_id: budgetTypeId,
                status_id: campaignStatus.status_id
            };

            const campaignId = await this.handleSCDType2(
                'dim_campaign',
                { field: 'campaign_natural_key', value: campaignNaturalKey },
                campaignData,
                date
            );

            // 4. SCD Tipo 2 para AdSet
            const adsetNaturalKey = ETLUtils.generateNaturalKey(accountName, campaignName, adsetName);
            const adsetData = {
                campaign_id: campaignId,
                adset_name: adsetName,
                status_id: adsetStatus.status_id
            };

            const adsetId = await this.handleSCDType2(
                'dim_adset',
                { field: 'adset_natural_key', value: adsetNaturalKey },
                adsetData,
                date
            );

            // 5. SCD Tipo 2 para Ad
            const adNameNorm = ETLUtils.normalizeAdName(adName);
            const adNaturalKey = ETLUtils.generateNaturalKey(accountName, campaignName, adsetName, adNameNorm);
            const adData = {
                adset_id: adsetId,
                ad_name: adName,
                ad_name_norm: adNameNorm,
                status_id: adStatus.status_id,
                landing_url_id: urlId
            };

            const adId = await this.handleSCDType2(
                'dim_ad',
                { field: 'ad_natural_key', value: adNaturalKey },
                adData,
                date
            );

            // 6. Procesar audiencias
            await this.processAudiences(
                adsetId,
                row['Públicos personalizados incluidos'],
                row['Públicos personalizados excluidos']
            );

            // 7. Insertar/actualizar fact table
            const factData = {
                date_id: dateId,
                account_id: account.account_id,
                campaign_id: campaignId,
                adset_id: adsetId,
                ad_id: adId,
                age_id: age.age_id,
                gender_id: gender.gender_id,
                currency_id: currency.currency_id,
                
                // Métricas
                spend: ETLUtils.parseNumber(row['Importe gastado (EUR)']),
                impressions: ETLUtils.parseInt(row['Impresiones']),
                reach: ETLUtils.parseInt(row['Alcance']),
                frequency: ETLUtils.parseNumber(row['Frecuencia'], 6),
                clicks_all: ETLUtils.parseInt(row['Clics (todos)']),
                link_clicks: ETLUtils.parseInt(row['Clics en el enlace']),
                landing_page_views: ETLUtils.parseInt(row['Visitas a la página de destino']),
                purchases: ETLUtils.parseInt(row['Compras']),
                conversion_value: ETLUtils.parseNumber(row['Valor de conversión de compras']),
                
                // Video metrics
                video_3s: ETLUtils.parseInt(row['Reproducciones de video de 3 segundos']),
                video_25: ETLUtils.parseInt(row['Reproducciones de video hasta el 25%']),
                video_50: ETLUtils.parseInt(row['Reproducciones de video hasta el 50%']),
                video_75: ETLUtils.parseInt(row['Reproducciones de video hasta el 75%']),
                video_95: ETLUtils.parseInt(row['Reproducciones de video hasta el 95%']),
                video_100: ETLUtils.parseInt(row['Reproducciones de video hasta el 100%']),
                thruplays: ETLUtils.parseInt(row['ThruPlays']),
                avg_watch_time: ETLUtils.parseNumber(row['Tiempo promedio de reproducción del video']),
                
                // Engagement metrics (si existen en el Excel)
                add_to_cart: ETLUtils.parseInt(row['Añadir al carrito']),
                initiate_checkout: ETLUtils.parseInt(row['Iniciar compra']),
                post_interactions: ETLUtils.parseInt(row['Interacciones con la publicación']),
                post_reactions: ETLUtils.parseInt(row['Reacciones a la publicación']),
                post_comments: ETLUtils.parseInt(row['Comentarios en la publicación']),
                post_shares: ETLUtils.parseInt(row['Publicaciones compartidas']),
                page_likes: ETLUtils.parseInt(row['Me gusta de la página']),
                
                // Métricas propietarias (si existen)
                atencion: ETLUtils.parseNumber(row['Atencion']),
                interes: ETLUtils.parseNumber(row['Interes']),
                deseo: ETLUtils.parseNumber(row['Deseo']),
                
                batch_id: this.batchId
            };

            // UPSERT fact table (replace si existe la combinación de claves)
            await this.db(`
                INSERT OR REPLACE INTO fact_meta_daily (
                    ${Object.keys(factData).join(', ')}
                ) VALUES (
                    ${Object.keys(factData).map(() => '?').join(', ')}
                )
            `, Object.values(factData));

            this.stats.recordsSuccess++;
            
        } catch (error) {
            this.stats.recordsFailed++;
            this.errors.push(`Row ${this.stats.recordsProcessed}: ${error.message}`);
            console.error(`[ETL] Error processing row ${this.stats.recordsProcessed}:`, error);
            
            // No re-throw para continuar con otras filas
        }
    }

    /**
     * Procesa un archivo Excel completo
     */
    async processExcelFile(excelData, fileName) {
        const fileHash = this.generateFileHash(excelData);
        
        // Verificar si ya fue procesado
        const existing = await this.db(
            'SELECT batch_id FROM etl_batches WHERE file_hash = ? AND status = "completed"',
            [fileHash]
        );

        if (existing.length > 0) {
            throw new Error(`File already processed in batch ${existing[0].batch_id}`);
        }

        // Iniciar batch
        await this.startBatch(`Excel Import: ${fileName}`, 'excel', fileHash);

        try {
            // Procesar cada fila
            for (let i = 0; i < excelData.length; i++) {
                await this.processExcelRow(excelData[i]);
                
                // Log progreso cada 100 filas
                if ((i + 1) % 100 === 0) {
                    console.log(`[ETL] Processed ${i + 1}/${excelData.length} rows`);
                }
            }

            // Completar batch
            const result = await this.completeBatch(
                this.stats.recordsFailed === 0 ? 'completed' : 'completed_with_errors'
            );

            return result;

        } catch (error) {
            await this.completeBatch('failed');
            throw error;
        }
    }

    /**
     * Genera hash simple del archivo para deduplicación
     */
    generateFileHash(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }
}

// Exportar para uso en el sistema
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DimensionalETL, ETLUtils };
} else {
    window.DimensionalETL = DimensionalETL;
    window.ETLUtils = ETLUtils;
}