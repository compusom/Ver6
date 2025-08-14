-- =====================================================================================
-- CAPA 1: STAGING VIEWS (Normalización de Datos Raw)
-- Vista de staging para transformar datos raw en formato analítico
-- Maneja conversión de tipos, normalización y limpieza de datos
-- =====================================================================================

USE [MetaAdsDW];
GO

-- =====================================================================================
-- VISTA STAGING: stg_meta_daily
-- Normaliza tipos de datos, convierte decimales y fechas desde raw_meta_rows
-- =====================================================================================

IF OBJECT_ID('dbo.stg_meta_daily', 'V') IS NOT NULL
    DROP VIEW dbo.stg_meta_daily;
GO

CREATE VIEW dbo.stg_meta_daily AS
SELECT
    -- Metadatos de control
    import_batch_id,
    row_num,
    file_hash,
    loaded_at,
    
    -- Identificadores principales (limpiados)
    LTRIM(RTRIM(ISNULL([Nombre de la cuenta], ''))) AS account_name,
    LTRIM(RTRIM(ISNULL([Nombre de la campaña], ''))) AS campaign_name,
    LTRIM(RTRIM(ISNULL([Nombre del conjunto de anuncios], ''))) AS adset_name,
    LTRIM(RTRIM(ISNULL([Nombre del anuncio], ''))) AS ad_name,
    
    -- Clave natural normalizada del anuncio (sin acentos, espacios múltiples)
    UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        LTRIM(RTRIM(ISNULL([Nombre del anuncio], ''))),
        'Á','A'), 'É','E'), 'Í','I'), 'Ó','O'), 'Ú','U'),
        'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'
    )) AS ad_name_norm,
    
    -- Fecha normalizada
    TRY_CONVERT(DATE, [Día], 103) AS date, -- DD/MM/YYYY format
    
    -- Dimensiones demográficas (normalizadas)
    CASE 
        WHEN UPPER(LTRIM(RTRIM(ISNULL([Sexo], '')))) IN ('MASCULINO', 'MALE', 'M', 'HOMBRE') THEN 'Masculino'
        WHEN UPPER(LTRIM(RTRIM(ISNULL([Sexo], '')))) IN ('FEMENINO', 'FEMALE', 'F', 'MUJER') THEN 'Femenino'
        WHEN UPPER(LTRIM(RTRIM(ISNULL([Sexo], '')))) IN ('TODOS', 'ALL', 'AMBOS') THEN 'Todos'
        ELSE 'Desconocido'
    END AS gender_label,
    
    LTRIM(RTRIM(ISNULL([Edad], 'Desconocido'))) AS age_label,
    
    -- Moneda normalizada
    UPPER(LTRIM(RTRIM(ISNULL([Divisa], 'EUR')))) AS currency_code,
    
    -- Métricas principales (conversión decimal con manejo de errores)
    TRY_CONVERT(DECIMAL(15,4), REPLACE(REPLACE(ISNULL([Importe gastado (EUR)], '0'), '.', ''), ',', '.')) AS spend,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Impresiones], '0'), '.', '')) AS impressions,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Alcance], '0'), '.', '')) AS reach,
    TRY_CONVERT(DECIMAL(10,4), REPLACE(ISNULL([Frecuencia], '0'), ',', '.')) AS frequency,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Clics (todos)], '0'), '.', '')) AS clicks_all,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Clics en el enlace], '0'), '.', '')) AS link_clicks,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Visitas a la página de destino], '0'), '.', '')) AS landing_page_views,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Compras], '0'), '.', '')) AS purchases,
    TRY_CONVERT(DECIMAL(15,4), REPLACE(REPLACE(ISNULL([Valor de conversión de compras], '0'), '.', ''), ',', '.')) AS conversion_value,
    
    -- Métricas de video (conversión)
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Reproducciones de video de 3 segundos], '0'), '.', '')) AS video_3s,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Reproducciones de video hasta el 25%], '0'), '.', '')) AS video_25,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Reproducciones de video hasta el 50%], '0'), '.', '')) AS video_50,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Reproducciones de video hasta el 75%], '0'), '.', '')) AS video_75,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Reproducciones de video hasta el 95%], '0'), '.', '')) AS video_95,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Reproducciones de video hasta el 100%], '0'), '.', '')) AS video_100,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([ThruPlays], '0'), '.', '')) AS thruplays,
    TRY_CONVERT(DECIMAL(10,4), REPLACE(ISNULL([Tiempo promedio de reproducción del video], '0'), ',', '.')) AS avg_watch_time,
    
    -- Métricas de embudo
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Añadir al carrito], '0'), '.', '')) AS add_to_cart,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Iniciar compra], '0'), '.', '')) AS initiate_checkout,
    
    -- Métricas de engagement
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Interacciones con la publicación], '0'), '.', '')) AS post_interactions,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Reacciones a la publicación], '0'), '.', '')) AS post_reactions,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Comentarios en la publicación], '0'), '.', '')) AS post_comments,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Publicaciones compartidas], '0'), '.', '')) AS post_shares,
    TRY_CONVERT(BIGINT, REPLACE(ISNULL([Me gusta de la página], '0'), '.', '')) AS page_likes,
    
    -- Métricas propietarias (si existen)
    TRY_CONVERT(DECIMAL(15,4), REPLACE(REPLACE(ISNULL([Atencion], '0'), '.', ''), ',', '.')) AS atencion,
    TRY_CONVERT(DECIMAL(15,4), REPLACE(REPLACE(ISNULL([Interes], '0'), '.', ''), ',', '.')) AS interes,
    TRY_CONVERT(DECIMAL(15,4), REPLACE(REPLACE(ISNULL([Deseo], '0'), '.', ''), ',', '.')) AS deseo,
    
    -- Configuración de campañas/adsets/ads
    LTRIM(RTRIM(ISNULL([Objetivo], ''))) AS objective_name,
    TRY_CONVERT(DECIMAL(15,2), REPLACE(REPLACE(ISNULL([Presupuesto de la campaña], '0'), '.', ''), ',', '.')) AS budget,
    LTRIM(RTRIM(ISNULL([Tipo de presupuesto de la campaña], ''))) AS budget_type_name,
    
    -- URLs y públicos (limpiados)
    LTRIM(RTRIM(ISNULL([URL del sitio web], ''))) AS landing_url,
    LTRIM(RTRIM(ISNULL([Públicos personalizados incluidos], ''))) AS audiences_included,
    LTRIM(RTRIM(ISNULL([Públicos personalizados excluidos], ''))) AS audiences_excluded,
    
    -- Estados de entrega (normalizados)
    CASE 
        WHEN UPPER(LTRIM(RTRIM(ISNULL([Entrega de la campaña], '')))) IN ('ACTIVO', 'ACTIVE') THEN 'ACTIVE'
        WHEN UPPER(LTRIM(RTRIM(ISNULL([Entrega de la campaña], '')))) IN ('PAUSADO', 'PAUSED') THEN 'PAUSED'
        WHEN UPPER(LTRIM(RTRIM(ISNULL([Entrega de la campaña], '')))) IN ('ARCHIVADO', 'ARCHIVED') THEN 'ARCHIVED'
        ELSE UPPER(LTRIM(RTRIM(ISNULL([Entrega de la campaña], 'UNKNOWN'))))
    END AS campaign_status,
    
    CASE 
        WHEN UPPER(LTRIM(RTRIM(ISNULL([Entrega del conjunto de anuncios], '')))) IN ('ACTIVO', 'ACTIVE') THEN 'ACTIVE'
        WHEN UPPER(LTRIM(RTRIM(ISNULL([Entrega del conjunto de anuncios], '')))) IN ('PAUSADO', 'PAUSED') THEN 'PAUSED'
        WHEN UPPER(LTRIM(RTRIM(ISNULL([Entrega del conjunto de anuncios], '')))) IN ('ARCHIVADO', 'ARCHIVED') THEN 'ARCHIVED'
        ELSE UPPER(LTRIM(RTRIM(ISNULL([Entrega del conjunto de anuncios], 'UNKNOWN'))))
    END AS adset_status,
    
    CASE 
        WHEN UPPER(LTRIM(RTRIM(ISNULL([Entrega del anuncio], '')))) IN ('ACTIVO', 'ACTIVE') THEN 'ACTIVE'
        WHEN UPPER(LTRIM(RTRIM(ISNULL([Entrega del anuncio], '')))) IN ('PAUSADO', 'PAUSED') THEN 'PAUSED'
        WHEN UPPER(LTRIM(RTRIM(ISNULL([Entrega del anuncio], '')))) IN ('ARCHIVADO', 'ARCHIVED') THEN 'ARCHIVED'
        WHEN UPPER(LTRIM(RTRIM(ISNULL([Entrega del anuncio], '')))) IN ('DESAPROBADO', 'DISAPPROVED') THEN 'DISAPPROVED'
        WHEN UPPER(LTRIM(RTRIM(ISNULL([Entrega del anuncio], '')))) IN ('REVISIÓN', 'PENDING_REVIEW', 'REVISION') THEN 'PENDING_REVIEW'
        ELSE UPPER(LTRIM(RTRIM(ISNULL([Entrega del anuncio], 'UNKNOWN'))))
    END AS ad_status,
    
    -- Claves naturales compuestas para upserts
    LTRIM(RTRIM(ISNULL([Nombre de la cuenta], ''))) + '|' + LTRIM(RTRIM(ISNULL([Nombre de la campaña], ''))) AS campaign_natural_key,
    LTRIM(RTRIM(ISNULL([Nombre de la cuenta], ''))) + '|' + LTRIM(RTRIM(ISNULL([Nombre de la campaña], ''))) + '|' + LTRIM(RTRIM(ISNULL([Nombre del conjunto de anuncios], ''))) AS adset_natural_key,
    LTRIM(RTRIM(ISNULL([Nombre de la cuenta], ''))) + '|' + LTRIM(RTRIM(ISNULL([Nombre de la campaña], ''))) + '|' + LTRIM(RTRIM(ISNULL([Nombre del conjunto de anuncios], ''))) + '|' + UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        LTRIM(RTRIM(ISNULL([Nombre del anuncio], ''))),
        'Á','A'), 'É','E'), 'Í','I'), 'Ó','O'), 'Ú','U'),
        'á','a'), 'é','e'), 'í','i'), 'ó','o'), 'ú','u'
    )) AS ad_natural_key,
    
    -- Flags de validación
    CASE WHEN TRY_CONVERT(DATE, [Día], 103) IS NULL THEN 1 ELSE 0 END AS has_invalid_date,
    CASE WHEN LTRIM(RTRIM(ISNULL([Nombre de la cuenta], ''))) = '' THEN 1 ELSE 0 END AS has_empty_account,
    CASE WHEN LTRIM(RTRIM(ISNULL([Nombre de la campaña], ''))) = '' THEN 1 ELSE 0 END AS has_empty_campaign,
    CASE WHEN LTRIM(RTRIM(ISNULL([Nombre del conjunto de anuncios], ''))) = '' THEN 1 ELSE 0 END AS has_empty_adset,
    CASE WHEN LTRIM(RTRIM(ISNULL([Nombre del anuncio], ''))) = '' THEN 1 ELSE 0 END AS has_empty_ad,
    
    -- Flag de fila válida para procesamiento
    CASE 
        WHEN TRY_CONVERT(DATE, [Día], 103) IS NULL THEN 0
        WHEN LTRIM(RTRIM(ISNULL([Nombre de la cuenta], ''))) = '' THEN 0
        WHEN LTRIM(RTRIM(ISNULL([Nombre de la campaña], ''))) = '' THEN 0
        WHEN LTRIM(RTRIM(ISNULL([Nombre del conjunto de anuncios], ''))) = '' THEN 0
        WHEN LTRIM(RTRIM(ISNULL([Nombre del anuncio], ''))) = '' THEN 0
        ELSE 1
    END AS is_valid_row
    
FROM dbo.raw_meta_rows;
GO

-- =====================================================================================
-- VISTA DE VALIDACIÓN: stg_meta_daily_validation
-- Proporciona métricas de calidad de datos para cada batch
-- =====================================================================================

IF OBJECT_ID('dbo.stg_meta_daily_validation', 'V') IS NOT NULL
    DROP VIEW dbo.stg_meta_daily_validation;
GO

CREATE VIEW dbo.stg_meta_daily_validation AS
SELECT 
    import_batch_id,
    file_hash,
    COUNT(*) AS total_rows,
    SUM(is_valid_row) AS valid_rows,
    COUNT(*) - SUM(is_valid_row) AS invalid_rows,
    CAST(100.0 * SUM(is_valid_row) / COUNT(*) AS DECIMAL(5,2)) AS valid_percentage,
    
    -- Detalles de validación
    SUM(has_invalid_date) AS rows_with_invalid_date,
    SUM(has_empty_account) AS rows_with_empty_account,
    SUM(has_empty_campaign) AS rows_with_empty_campaign,
    SUM(has_empty_adset) AS rows_with_empty_adset,
    SUM(has_empty_ad) AS rows_with_empty_ad,
    
    -- Métricas de negocio
    COUNT(DISTINCT account_name) AS unique_accounts,
    COUNT(DISTINCT campaign_natural_key) AS unique_campaigns,
    COUNT(DISTINCT adset_natural_key) AS unique_adsets,
    COUNT(DISTINCT ad_natural_key) AS unique_ads,
    
    -- Rangos de fechas
    MIN(date) AS min_date,
    MAX(date) AS max_date,
    
    -- Totales de inversión
    SUM(CASE WHEN is_valid_row = 1 THEN spend ELSE 0 END) AS total_spend,
    SUM(CASE WHEN is_valid_row = 1 THEN impressions ELSE 0 END) AS total_impressions,
    SUM(CASE WHEN is_valid_row = 1 THEN purchases ELSE 0 END) AS total_purchases,
    
    MIN(loaded_at) AS first_loaded_at,
    MAX(loaded_at) AS last_loaded_at
    
FROM dbo.stg_meta_daily
GROUP BY import_batch_id, file_hash;
GO

-- =====================================================================================
-- VISTA DE ERRORES: stg_meta_daily_errors  
-- Filas que no pasaron validación para revisión manual
-- =====================================================================================

IF OBJECT_ID('dbo.stg_meta_daily_errors', 'V') IS NOT NULL
    DROP VIEW dbo.stg_meta_daily_errors;
GO

CREATE VIEW dbo.stg_meta_daily_errors AS
SELECT 
    import_batch_id,
    row_num,
    file_hash,
    loaded_at,
    
    -- Datos problemáticos
    [Nombre de la cuenta] AS raw_account_name,
    [Nombre de la campaña] AS raw_campaign_name,
    [Nombre del conjunto de anuncios] AS raw_adset_name,
    [Nombre del anuncio] AS raw_ad_name,
    [Día] AS raw_date,
    
    -- Flags de error
    has_invalid_date,
    has_empty_account,
    has_empty_campaign,
    has_empty_adset,
    has_empty_ad,
    
    -- Descripciones de errores
    CASE 
        WHEN has_invalid_date = 1 THEN 'Fecha inválida: ' + ISNULL([Día], 'NULL')
        WHEN has_empty_account = 1 THEN 'Nombre de cuenta vacío'
        WHEN has_empty_campaign = 1 THEN 'Nombre de campaña vacío'
        WHEN has_empty_adset = 1 THEN 'Nombre de adset vacío'
        WHEN has_empty_ad = 1 THEN 'Nombre de anuncio vacío'
        ELSE 'Error desconocido'
    END AS error_description
    
FROM dbo.stg_meta_daily
WHERE is_valid_row = 0;
GO

-- =====================================================================================
-- ÍNDICES EN VISTAS (Si SQL Server lo soporta con vistas indexadas)
-- =====================================================================================

-- Nota: Para SQL Server Express, las vistas indexadas tienen limitaciones
-- Estos índices se pueden crear si se convierte stg_meta_daily a tabla física

PRINT 'Vistas de staging creadas exitosamente';
PRINT 'Vista principal: stg_meta_daily - Normaliza datos raw';
PRINT 'Vista validación: stg_meta_daily_validation - Métricas de calidad';
PRINT 'Vista errores: stg_meta_daily_errors - Filas problemáticas';
GO