// =====================================================================
// FUNCIONES DE IMPORTACIÓN PARA MODELO ESTRELLA
// Reemplaza la lógica de importación actual con modelo estrella
// =====================================================================

/**
 * Función helper para buscar o crear dimensión de cliente
 */
async function getOrCreateClient(sqlPool, clientName) {
    try {
        // Simular AccountFBID basado en el nombre (en producción vendría del Excel)
        const accountFBID = Buffer.from(clientName).toString('base64').slice(0, 16);
        const fbidNumber = parseInt(accountFBID.replace(/[^0-9]/g, '').slice(0, 10) || '1000000000');
        
        // Buscar cliente existente
        let result = await sqlPool.request()
            .input('clientName', sql.VarChar(255), clientName)
            .query('SELECT ClientID FROM dim_Clients WHERE ClientName = @clientName');
        
        if (result.recordset.length > 0) {
            return result.recordset[0].ClientID;
        }
        
        // Crear nuevo cliente
        result = await sqlPool.request()
            .input('accountFBID', sql.BigInt, fbidNumber)
            .input('clientName', sql.VarChar(255), clientName)
            .query(`
                INSERT INTO dim_Clients (AccountFBID, ClientName) 
                OUTPUT INSERTED.ClientID 
                VALUES (@accountFBID, @clientName)
            `);
        
        return result.recordset[0].ClientID;
    } catch (error) {
        logger.error('[Star Schema] Error in getOrCreateClient:', error.message);
        throw error;
    }
}

/**
 * Función helper para buscar o crear dimensión de campaña
 */
async function getOrCreateCampaign(sqlPool, clientID, campaignName, objective = null) {
    try {
        // Simular CampaignFBID
        const campaignFBID = parseInt(
            Buffer.from(campaignName).toString('base64').replace(/[^0-9]/g, '').slice(0, 12) || '2000000000'
        );
        
        // Buscar campaña existente
        let result = await sqlPool.request()
            .input('campaignFBID', sql.BigInt, campaignFBID)
            .query('SELECT CampaignID FROM dim_Campaigns WHERE CampaignFBID = @campaignFBID');
        
        if (result.recordset.length > 0) {
            return result.recordset[0].CampaignID;
        }
        
        // Crear nueva campaña
        result = await sqlPool.request()
            .input('clientID', sql.Int, clientID)
            .input('campaignFBID', sql.BigInt, campaignFBID)
            .input('campaignName', sql.VarChar(255), campaignName)
            .input('objective', sql.VarChar(100), objective)
            .query(`
                INSERT INTO dim_Campaigns (ClientID, CampaignFBID, CampaignName, Objective) 
                OUTPUT INSERTED.CampaignID 
                VALUES (@clientID, @campaignFBID, @campaignName, @objective)
            `);
        
        return result.recordset[0].CampaignID;
    } catch (error) {
        logger.error('[Star Schema] Error in getOrCreateCampaign:', error.message);
        throw error;
    }
}

/**
 * Función helper para buscar o crear dimensión de conjunto de anuncios
 */
async function getOrCreateAdSet(sqlPool, campaignID, adSetName) {
    try {
        // Simular AdSetFBID
        const adSetFBID = parseInt(
            Buffer.from(adSetName).toString('base64').replace(/[^0-9]/g, '').slice(0, 12) || '3000000000'
        );
        
        // Buscar adset existente
        let result = await sqlPool.request()
            .input('adSetFBID', sql.BigInt, adSetFBID)
            .query('SELECT AdSetID FROM dim_AdSets WHERE AdSetFBID = @adSetFBID');
        
        if (result.recordset.length > 0) {
            return result.recordset[0].AdSetID;
        }
        
        // Crear nuevo adset
        result = await sqlPool.request()
            .input('campaignID', sql.Int, campaignID)
            .input('adSetFBID', sql.BigInt, adSetFBID)
            .input('adSetName', sql.VarChar(255), adSetName)
            .query(`
                INSERT INTO dim_AdSets (CampaignID, AdSetFBID, AdSetName) 
                OUTPUT INSERTED.AdSetID 
                VALUES (@campaignID, @adSetFBID, @adSetName)
            `);
        
        return result.recordset[0].AdSetID;
    } catch (error) {
        logger.error('[Star Schema] Error in getOrCreateAdSet:', error.message);
        throw error;
    }
}

/**
 * Función helper para buscar o crear dimensión de anuncio
 */
async function getOrCreateAd(sqlPool, adSetID, adName) {
    try {
        // Simular AdFBID
        const adFBID = parseInt(
            Buffer.from(adName).toString('base64').replace(/[^0-9]/g, '').slice(0, 12) || '4000000000'
        );
        
        // Buscar ad existente
        let result = await sqlPool.request()
            .input('adFBID', sql.BigInt, adFBID)
            .query('SELECT AdID FROM dim_Ads WHERE AdFBID = @adFBID');
        
        if (result.recordset.length > 0) {
            return result.recordset[0].AdID;
        }
        
        // Crear nuevo ad
        result = await sqlPool.request()
            .input('adSetID', sql.Int, adSetID)
            .input('adFBID', sql.BigInt, adFBID)
            .input('adName', sql.VarChar(500), adName)
            .query(`
                INSERT INTO dim_Ads (AdSetID, AdFBID, AdName) 
                OUTPUT INSERTED.AdID 
                VALUES (@adSetID, @adFBID, @adName)
            `);
        
        return result.recordset[0].AdID;
    } catch (error) {
        logger.error('[Star Schema] Error in getOrCreateAd:', error.message);
        throw error;
    }
}

/**
 * Función helper para buscar o crear dimensión demográfica
 */
async function getOrCreateDemographic(sqlPool, ageBracket, gender) {
    try {
        const cleanAge = ageBracket || 'Desconocido';
        const cleanGender = gender || 'Desconocido';
        
        // Buscar demografía existente
        let result = await sqlPool.request()
            .input('ageBracket', sql.VarChar(50), cleanAge)
            .input('gender', sql.VarChar(50), cleanGender)
            .query('SELECT DemographicID FROM dim_Demographics WHERE AgeBracket = @ageBracket AND Gender = @gender');
        
        if (result.recordset.length > 0) {
            return result.recordset[0].DemographicID;
        }
        
        // Crear nueva demografía
        result = await sqlPool.request()
            .input('ageBracket', sql.VarChar(50), cleanAge)
            .input('gender', sql.VarChar(50), cleanGender)
            .query(`
                INSERT INTO dim_Demographics (AgeBracket, Gender) 
                OUTPUT INSERTED.DemographicID 
                VALUES (@ageBracket, @gender)
            `);
        
        return result.recordset[0].DemographicID;
    } catch (error) {
        logger.error('[Star Schema] Error in getOrCreateDemographic:', error.message);
        throw error;
    }
}

/**
 * Función helper para obtener DateID
 */
function getDateID(dateValue) {
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
 * Función helper para obtener PlacementID por defecto
 */
async function getDefaultPlacement(sqlPool) {
    const result = await sqlPool.request()
        .query("SELECT PlacementID FROM dim_Placements WHERE Platform = 'Desconocido'");
    
    return result.recordset[0]?.PlacementID || 1;
}

/**
 * Función principal de procesamiento de fila de Excel para modelo estrella
 */
async function processRowForStarSchema(sqlPool, row, clientID) {
    const transaction = new sql.Transaction(sqlPool);
    await transaction.begin();
    
    try {
        // 1. Extraer datos de la fila
        const campaignName = row['Nombre de la campaña'] || row['nombre_de_la_campaña'] || 'Sin campaña';
        const adSetName = row['Nombre del conjunto de anuncios'] || row['nombre_del_conjunto_de_anuncios'] || campaignName;
        const adName = row['Nombre del anuncio'] || row['nombre_del_anuncio'] || 'Sin anuncio';
        const objective = row['Objetivo'] || row['objetivo'] || null;
        const ageBracket = row['Edad'] || row['edad'] || 'Desconocido';
        const gender = row['Sexo'] || row['sexo'] || 'Desconocido';
        const dayValue = row['Día'] || row['dia'] || null;
        
        // 2. Obtener IDs de dimensiones
        const campaignID = await getOrCreateCampaign(transaction, clientID, campaignName, objective);
        const adSetID = await getOrCreateAdSet(transaction, campaignID, adSetName);
        const adID = await getOrCreateAd(transaction, adSetID, adName);
        const demographicID = await getOrCreateDemographic(transaction, ageBracket, gender);
        const dateID = getDateID(dayValue);
        const placementID = await getDefaultPlacement(transaction);
        
        if (!dateID) {
            logger.warn('[Star Schema] Skipping row with invalid date:', dayValue);
            await transaction.rollback();
            return { success: false, reason: 'Invalid date' };
        }
        
        // 3. Extraer métricas
        const spend = parseFloat(row['Importe gastado (EUR)'] || row['importe_gastado_eur'] || 0);
        const impressions = parseInt(row['Impresiones'] || row['impresiones'] || 0);
        const reach = parseInt(row['Alcance'] || row['alcance'] || 0);
        const clicks = parseInt(row['Clics (todos)'] || row['clics_todos'] || 0);
        const purchases = parseInt(row['Compras'] || row['compras'] || 0);
        const purchaseValue = parseFloat(row['Valor de conversión de compras'] || row['valor_de_conversion_de_compras'] || 0);
        
        // Métricas de video
        const videoPlays25 = parseInt(row['Reproducciones de video hasta el 25%'] || row['rep_video_25_pct'] || 0);
        const videoPlays50 = parseInt(row['Reproducciones de video hasta el 50%'] || row['rep_video_50_pct'] || 0);
        const videoPlays75 = parseInt(row['Reproducciones de video hasta el 75%'] || row['rep_video_75_pct'] || 0);
        const videoPlays95 = parseInt(row['Reproducciones de video hasta el 95%'] || row['rep_video_95_pct'] || 0);
        const videoPlays100 = parseInt(row['Reproducciones de video hasta el 100%'] || row['rep_video_100_pct'] || 0);
        
        const results = purchases; // Asumimos que Results = Purchases para este caso
        const costPerResult = results > 0 ? spend / results : 0;
        
        // 4. Eliminar registro existente (si existe)
        await transaction.request()
            .input('dateID', sql.Int, dateID)
            .input('clientID', sql.Int, clientID)
            .input('campaignID', sql.Int, campaignID)
            .input('adSetID', sql.Int, adSetID)
            .input('adID', sql.Int, adID)
            .input('demographicID', sql.Int, demographicID)
            .input('placementID', sql.Int, placementID)
            .query(`
                DELETE FROM fact_Metrics 
                WHERE DateID = @dateID 
                  AND ClientID = @clientID 
                  AND CampaignID = @campaignID 
                  AND AdSetID = @adSetID 
                  AND AdID = @adID 
                  AND DemographicID = @demographicID 
                  AND PlacementID = @placementID
            `);
        
        // 5. Insertar nueva métrica
        await transaction.request()
            .input('dateID', sql.Int, dateID)
            .input('clientID', sql.Int, clientID)
            .input('campaignID', sql.Int, campaignID)
            .input('adSetID', sql.Int, adSetID)
            .input('adID', sql.Int, adID)
            .input('demographicID', sql.Int, demographicID)
            .input('placementID', sql.Int, placementID)
            .input('spend', sql.Decimal(18, 4), spend)
            .input('impressions', sql.Int, impressions)
            .input('reach', sql.Int, reach)
            .input('clicks', sql.Int, clicks)
            .input('purchases', sql.Int, purchases)
            .input('purchaseValue', sql.Decimal(18, 4), purchaseValue)
            .input('videoPlays25', sql.Int, videoPlays25)
            .input('videoPlays50', sql.Int, videoPlays50)
            .input('videoPlays75', sql.Int, videoPlays75)
            .input('videoPlays95', sql.Int, videoPlays95)
            .input('videoPlays100', sql.Int, videoPlays100)
            .input('results', sql.Int, results)
            .input('costPerResult', sql.Decimal(18, 4), costPerResult)
            .query(`
                INSERT INTO fact_Metrics (
                    DateID, ClientID, CampaignID, AdSetID, AdID, DemographicID, PlacementID,
                    Spend, Impressions, Reach, Clicks, Purchases, PurchaseValue,
                    VideoPlays_25_Pct, VideoPlays_50_Pct, VideoPlays_75_Pct, VideoPlays_95_Pct, VideoPlays_100_Pct,
                    Results, CostPerResult
                ) VALUES (
                    @dateID, @clientID, @campaignID, @adSetID, @adID, @demographicID, @placementID,
                    @spend, @impressions, @reach, @clicks, @purchases, @purchaseValue,
                    @videoPlays25, @videoPlays50, @videoPlays75, @videoPlays95, @videoPlays100,
                    @results, @costPerResult
                )
            `);
        
        await transaction.commit();
        return { success: true };
        
    } catch (error) {
        await transaction.rollback();
        logger.error('[Star Schema] Error processing row:', error.message);
        throw error;
    }
}

export {
    getOrCreateClient,
    getOrCreateCampaign,
    getOrCreateAdSet,
    getOrCreateAd,
    getOrCreateDemographic,
    getDateID,
    getDefaultPlacement,
    processRowForStarSchema
};