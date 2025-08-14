-- =====================================================================================
-- PROCEDIMIENTO MAESTRO DE CARGA ETL
-- sp_load_meta_excel_batch: Orquesta la carga completa desde raw hasta fact table
-- Incluye transacciones, validaciones, logging y manejo de errores
-- =====================================================================================

USE [MetaAdsDW];
GO

-- =====================================================================================
-- TABLA DE LOG ETL (para auditoría y troubleshooting)
-- =====================================================================================

IF OBJECT_ID('dbo.etl_log', 'U') IS NOT NULL
    DROP TABLE dbo.etl_log;
GO

CREATE TABLE dbo.etl_log (
    log_id INT IDENTITY(1,1) NOT NULL,
    batch_id INT NOT NULL,
    step_name NVARCHAR(100) NOT NULL,
    step_status NVARCHAR(20) NOT NULL, -- 'STARTED', 'COMPLETED', 'FAILED'
    start_time DATETIME2 NOT NULL,
    end_time DATETIME2 NULL,
    duration_ms INT NULL,
    rows_processed INT NULL,
    error_message NVARCHAR(MAX) NULL,
    additional_info NVARCHAR(MAX) NULL,
    
    CONSTRAINT PK_etl_log PRIMARY KEY (log_id)
);
GO

CREATE NONCLUSTERED INDEX IX_etl_log_batch_step 
ON dbo.etl_log (batch_id, step_name);
GO

-- =====================================================================================
-- TABLA DE RECHAZO DE DATOS (filas que no pasaron validación)
-- =====================================================================================

IF OBJECT_ID('dbo.etl_rejections', 'U') IS NOT NULL
    DROP TABLE dbo.etl_rejections;
GO

CREATE TABLE dbo.etl_rejections (
    rejection_id INT IDENTITY(1,1) NOT NULL,
    batch_id INT NOT NULL,
    row_num INT NOT NULL,
    rejection_reason NVARCHAR(500) NOT NULL,
    raw_data NVARCHAR(MAX) NULL,
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    
    CONSTRAINT PK_etl_rejections PRIMARY KEY (rejection_id)
);
GO

-- =====================================================================================
-- PROCEDIMIENTO DE LOGGING
-- =====================================================================================

IF OBJECT_ID('dbo.usp_etl_log', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_etl_log;
GO

CREATE PROCEDURE dbo.usp_etl_log
    @batch_id INT,
    @step_name NVARCHAR(100),
    @step_status NVARCHAR(20),
    @start_time DATETIME2 = NULL,
    @end_time DATETIME2 = NULL,
    @rows_processed INT = NULL,
    @error_message NVARCHAR(MAX) = NULL,
    @additional_info NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @duration_ms INT = NULL;
    
    IF @start_time IS NOT NULL AND @end_time IS NOT NULL
        SET @duration_ms = DATEDIFF(millisecond, @start_time, @end_time);
    
    INSERT INTO dbo.etl_log (
        batch_id, step_name, step_status, start_time, end_time, 
        duration_ms, rows_processed, error_message, additional_info
    )
    VALUES (
        @batch_id, @step_name, @step_status, 
        ISNULL(@start_time, SYSDATETIME()), @end_time,
        @duration_ms, @rows_processed, @error_message, @additional_info
    );
END;
GO

-- =====================================================================================
-- PROCEDIMIENTO PRINCIPAL: sp_load_meta_excel_batch
-- =====================================================================================

IF OBJECT_ID('dbo.sp_load_meta_excel_batch', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_load_meta_excel_batch;
GO

CREATE PROCEDURE dbo.sp_load_meta_excel_batch
    @batch_id INT,
    @validate_only BIT = 0,           -- Solo validar sin cargar
    @force_reload BIT = 0,            -- Forzar recarga si ya existe
    @max_error_percentage DECIMAL(5,2) = 5.0  -- % máximo de errores permitidos
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;  -- Importante para transacciones anidadas
    
    DECLARE @procedure_start DATETIME2 = SYSDATETIME();
    DECLARE @step_start DATETIME2;
    DECLARE @step_end DATETIME2;
    DECLARE @total_rows INT = 0;
    DECLARE @valid_rows INT = 0;
    DECLARE @error_percentage DECIMAL(5,2) = 0.0;
    DECLARE @rows_inserted INT = 0;
    
    -- Verificaciones iniciales
    BEGIN TRY
        
        -- Log inicio del proceso
        EXEC dbo.usp_etl_log @batch_id, 'PROCESS_START', 'STARTED', @procedure_start, NULL, NULL, NULL, 
             CONCAT('validate_only=', @validate_only, ', force_reload=', @force_reload);
        
        PRINT CONCAT('=== INICIANDO CARGA ETL - Batch ID: ', @batch_id, ' ===');
        PRINT CONCAT('Validar solo: ', CASE WHEN @validate_only = 1 THEN 'SI' ELSE 'NO' END);
        PRINT CONCAT('Forzar recarga: ', CASE WHEN @force_reload = 1 THEN 'SI' ELSE 'NO' END);
        PRINT CONCAT('Máximo % errores: ', @max_error_percentage, '%');
        
        -- =====================================================================================
        -- PASO 1: VALIDACIONES INICIALES
        -- =====================================================================================
        
        SET @step_start = SYSDATETIME();
        EXEC dbo.usp_etl_log @batch_id, 'VALIDATION', 'STARTED', @step_start;
        
        -- Verificar que existe el batch en raw_meta_rows
        IF NOT EXISTS (SELECT 1 FROM dbo.raw_meta_rows WHERE import_batch_id = @batch_id)
        BEGIN
            DECLARE @error_msg NVARCHAR(500) = CONCAT('Batch ID ', @batch_id, ' no existe en raw_meta_rows');
            EXEC dbo.usp_etl_log @batch_id, 'VALIDATION', 'FAILED', @step_start, SYSDATETIME(), 0, NULL, @error_msg;
            THROW 50001, @error_msg, 1;
        END;
        
        -- Verificar si ya se procesó el batch (a menos que force_reload = 1)
        IF @force_reload = 0 AND EXISTS (SELECT 1 FROM dbo.fact_meta_daily WHERE import_batch_id = @batch_id)
        BEGIN
            SET @error_msg = CONCAT('Batch ID ', @batch_id, ' ya fue procesado. Use @force_reload = 1 para recargar');
            EXEC dbo.usp_etl_log @batch_id, 'VALIDATION', 'FAILED', @step_start, SYSDATETIME(), 0, NULL, @error_msg;
            THROW 50002, @error_msg, 1;
        END;
        
        -- Obtener estadísticas de calidad de datos
        SELECT 
            @total_rows = total_rows,
            @valid_rows = valid_rows
        FROM dbo.stg_meta_daily_validation 
        WHERE import_batch_id = @batch_id;
        
        IF @total_rows = 0
        BEGIN
            SET @error_msg = CONCAT('No hay filas válidas en batch ', @batch_id);
            EXEC dbo.usp_etl_log @batch_id, 'VALIDATION', 'FAILED', @step_start, SYSDATETIME(), 0, NULL, @error_msg;
            THROW 50003, @error_msg, 1;
        END;
        
        SET @error_percentage = CASE WHEN @total_rows > 0 THEN (100.0 * (@total_rows - @valid_rows)) / @total_rows ELSE 0 END;
        
        IF @error_percentage > @max_error_percentage
        BEGIN
            SET @error_msg = CONCAT('Porcentaje de errores (', FORMAT(@error_percentage, 'F2'), '%) excede el máximo permitido (', @max_error_percentage, '%)');
            EXEC dbo.usp_etl_log @batch_id, 'VALIDATION', 'FAILED', @step_start, SYSDATETIME(), @total_rows, NULL, @error_msg;
            THROW 50004, @error_msg, 1;
        END;
        
        -- Registrar filas rechazadas
        INSERT INTO dbo.etl_rejections (batch_id, row_num, rejection_reason, raw_data)
        SELECT 
            @batch_id,
            row_num,
            error_description,
            CONCAT('Account: ', raw_account_name, ' | Campaign: ', raw_campaign_name, ' | Ad: ', raw_ad_name, ' | Date: ', raw_date)
        FROM dbo.stg_meta_daily_errors
        WHERE import_batch_id = @batch_id;
        
        SET @step_end = SYSDATETIME();
        EXEC dbo.usp_etl_log @batch_id, 'VALIDATION', 'COMPLETED', @step_start, @step_end, @total_rows, NULL,
             CONCAT('Valid: ', @valid_rows, ' | Invalid: ', (@total_rows - @valid_rows), ' | Error %: ', FORMAT(@error_percentage, 'F2'));
        
        PRINT CONCAT('Validación completada - Total: ', @total_rows, ', Válidas: ', @valid_rows, ', Error %: ', FORMAT(@error_percentage, 'F2'));
        
        -- Si solo validación, terminar aquí
        IF @validate_only = 1
        BEGIN
            EXEC dbo.usp_etl_log @batch_id, 'PROCESS_END', 'COMPLETED', @procedure_start, SYSDATETIME(), @total_rows, NULL, 'VALIDATION ONLY';
            PRINT 'Validación completada exitosamente - Modo solo validación';
            RETURN;
        END;
        
        -- =====================================================================================
        -- PASO 2: LIMPIAR DATOS EXISTENTES (si force_reload = 1)
        -- =====================================================================================
        
        IF @force_reload = 1
        BEGIN
            SET @step_start = SYSDATETIME();
            EXEC dbo.usp_etl_log @batch_id, 'CLEANUP', 'STARTED', @step_start;
            
            -- Eliminar fact data existente para este batch
            DELETE FROM dbo.fact_meta_daily WHERE import_batch_id = @batch_id;
            SET @rows_inserted = @@ROWCOUNT;
            
            SET @step_end = SYSDATETIME();
            EXEC dbo.usp_etl_log @batch_id, 'CLEANUP', 'COMPLETED', @step_start, @step_end, @rows_inserted;
            PRINT CONCAT('Limpieza completada - ', @rows_inserted, ' filas eliminadas');
        END;
        
        -- =====================================================================================
        -- PASO 3: TRANSACCIÓN PRINCIPAL DE CARGA
        -- =====================================================================================
        
        BEGIN TRANSACTION ETL_Load;
        
        BEGIN TRY
            
            -- Paso 3.1: Upsert de todas las dimensiones
            SET @step_start = SYSDATETIME();
            EXEC dbo.usp_etl_log @batch_id, 'DIMENSIONS', 'STARTED', @step_start;
            
            EXEC dbo.usp_upsert_all_dimensions @batch_id;
            
            SET @step_end = SYSDATETIME();
            EXEC dbo.usp_etl_log @batch_id, 'DIMENSIONS', 'COMPLETED', @step_start, @step_end;
            PRINT 'Dimensiones actualizadas exitosamente';
            
            -- Paso 3.2: Carga del fact table
            SET @step_start = SYSDATETIME();
            EXEC dbo.usp_etl_log @batch_id, 'FACT_LOAD', 'STARTED', @step_start;
            
            INSERT INTO dbo.fact_meta_daily (
                date_id, account_id, campaign_id, adset_id, ad_id, age_id, gender_id, currency_id,
                spend, impressions, reach, frequency, clicks_all, link_clicks, landing_page_views,
                purchases, conversion_value, video_3s, video_25, video_50, video_75, video_95, 
                video_100, thruplays, avg_watch_time, add_to_cart, initiate_checkout,
                post_interactions, post_reactions, post_comments, post_shares, page_likes,
                atencion, interes, deseo, import_batch_id
            )
            SELECT 
                d.date_id,
                a.account_id,
                c.campaign_id,
                ads.adset_id,
                ad.ad_id,
                age.age_id,
                g.gender_id,
                curr.currency_id,
                
                -- Métricas agregadas por grano (fecha + cuenta + campaña + adset + ad + edad + género)
                SUM(s.spend) AS spend,
                SUM(s.impressions) AS impressions,
                SUM(s.reach) AS reach,
                AVG(s.frequency) AS frequency, -- Promedio ponderado sería mejor, pero simplificamos
                SUM(s.clicks_all) AS clicks_all,
                SUM(s.link_clicks) AS link_clicks,
                SUM(s.landing_page_views) AS landing_page_views,
                SUM(s.purchases) AS purchases,
                SUM(s.conversion_value) AS conversion_value,
                SUM(s.video_3s) AS video_3s,
                SUM(s.video_25) AS video_25,
                SUM(s.video_50) AS video_50,
                SUM(s.video_75) AS video_75,
                SUM(s.video_95) AS video_95,
                SUM(s.video_100) AS video_100,
                SUM(s.thruplays) AS thruplays,
                AVG(s.avg_watch_time) AS avg_watch_time,
                SUM(s.add_to_cart) AS add_to_cart,
                SUM(s.initiate_checkout) AS initiate_checkout,
                SUM(s.post_interactions) AS post_interactions,
                SUM(s.post_reactions) AS post_reactions,
                SUM(s.post_comments) AS post_comments,
                SUM(s.post_shares) AS post_shares,
                SUM(s.page_likes) AS page_likes,
                SUM(s.atencion) AS atencion,
                SUM(s.interes) AS interes,
                SUM(s.deseo) AS deseo,
                @batch_id
                
            FROM dbo.stg_meta_daily s
            INNER JOIN dbo.dim_date d ON s.date = d.date
            INNER JOIN dbo.dim_account a ON s.account_name = a.account_name
            INNER JOIN dbo.dim_campaign c ON s.campaign_natural_key = c.campaign_natural_key AND c.scd_is_current = 1
            INNER JOIN dbo.dim_adset ads ON s.adset_natural_key = ads.adset_natural_key AND ads.scd_is_current = 1
            INNER JOIN dbo.dim_ad ad ON s.ad_natural_key = ad.ad_natural_key AND ad.scd_is_current = 1
            INNER JOIN dbo.dim_age age ON s.age_label = age.age_label
            INNER JOIN dbo.dim_gender g ON s.gender_label = g.gender_label
            INNER JOIN dbo.dim_currency curr ON s.currency_code = curr.currency_code
            WHERE s.import_batch_id = @batch_id
              AND s.is_valid_row = 1
            GROUP BY 
                d.date_id, a.account_id, c.campaign_id, ads.adset_id, ad.ad_id, 
                age.age_id, g.gender_id, curr.currency_id;
            
            SET @rows_inserted = @@ROWCOUNT;
            
            SET @step_end = SYSDATETIME();
            EXEC dbo.usp_etl_log @batch_id, 'FACT_LOAD', 'COMPLETED', @step_start, @step_end, @rows_inserted;
            PRINT CONCAT('Fact table cargado - ', @rows_inserted, ' filas insertadas');
            
            -- =====================================================================================
            -- PASO 4: VALIDACIONES POST-CARGA
            -- =====================================================================================
            
            SET @step_start = SYSDATETIME();
            EXEC dbo.usp_etl_log @batch_id, 'POST_VALIDATION', 'STARTED', @step_start;
            
            -- Validar que no hay duplicados en el fact
            DECLARE @duplicate_count INT;
            SELECT @duplicate_count = COUNT(*) - COUNT(DISTINCT CONCAT(date_id, '|', account_id, '|', campaign_id, '|', adset_id, '|', ad_id, '|', age_id, '|', gender_id))
            FROM dbo.fact_meta_daily
            WHERE import_batch_id = @batch_id;
            
            IF @duplicate_count > 0
            BEGIN
                SET @error_msg = CONCAT('Se detectaron ', @duplicate_count, ' filas duplicadas en fact table');
                EXEC dbo.usp_etl_log @batch_id, 'POST_VALIDATION', 'FAILED', @step_start, SYSDATETIME(), NULL, NULL, @error_msg;
                THROW 50005, @error_msg, 1;
            END;
            
            -- Validar totales de inversión
            DECLARE @staging_spend DECIMAL(15,4), @fact_spend DECIMAL(15,4);
            SELECT @staging_spend = SUM(spend) FROM dbo.stg_meta_daily WHERE import_batch_id = @batch_id AND is_valid_row = 1;
            SELECT @fact_spend = SUM(spend) FROM dbo.fact_meta_daily WHERE import_batch_id = @batch_id;
            
            IF ABS(@staging_spend - @fact_spend) > 0.01 -- Tolerancia de centavos
            BEGIN
                SET @error_msg = CONCAT('Discrepancia en totales de inversión - Staging: ', @staging_spend, ', Fact: ', @fact_spend);
                EXEC dbo.usp_etl_log @batch_id, 'POST_VALIDATION', 'FAILED', @step_start, SYSDATETIME(), NULL, NULL, @error_msg;
                THROW 50006, @error_msg, 1;
            END;
            
            SET @step_end = SYSDATETIME();
            EXEC dbo.usp_etl_log @batch_id, 'POST_VALIDATION', 'COMPLETED', @step_start, @step_end, NULL, NULL,
                 CONCAT('Spend validation: ', FORMAT(@fact_spend, 'C'));
            
            PRINT 'Validaciones post-carga completadas exitosamente';
            
            -- Confirmar transacción
            COMMIT TRANSACTION ETL_Load;
            
        END TRY
        BEGIN CATCH
            -- Rollback en caso de error
            IF @@TRANCOUNT > 0
                ROLLBACK TRANSACTION ETL_Load;
                
            DECLARE @error_number INT = ERROR_NUMBER();
            DECLARE @error_line INT = ERROR_LINE();
            DECLARE @error_message_catch NVARCHAR(4000) = ERROR_MESSAGE();
            
            SET @error_msg = CONCAT('Error ', @error_number, ' en línea ', @error_line, ': ', @error_message_catch);
            EXEC dbo.usp_etl_log @batch_id, 'ETL_ERROR', 'FAILED', @step_start, SYSDATETIME(), NULL, NULL, @error_msg;
            
            THROW;
        END CATCH;
        
        -- =====================================================================================
        -- FINALIZACIÓN EXITOSA
        -- =====================================================================================
        
        DECLARE @procedure_end DATETIME2 = SYSDATETIME();
        DECLARE @total_duration_ms INT = DATEDIFF(millisecond, @procedure_start, @procedure_end);
        
        EXEC dbo.usp_etl_log @batch_id, 'PROCESS_END', 'COMPLETED', @procedure_start, @procedure_end, @rows_inserted, NULL,
             CONCAT('Total rows loaded: ', @rows_inserted, ' | Duration: ', @total_duration_ms, 'ms');
        
        PRINT '=== CARGA ETL COMPLETADA EXITOSAMENTE ===';
        PRINT CONCAT('Filas cargadas: ', @rows_inserted);
        PRINT CONCAT('Duración total: ', @total_duration_ms, 'ms (', FORMAT(@total_duration_ms/1000.0, 'F2'), 's)');
        PRINT CONCAT('Rendimiento: ', FORMAT(@rows_inserted/NULLIF(@total_duration_ms/1000.0, 0), 'F0'), ' filas/segundo');
        
    END TRY
    BEGIN CATCH
        -- Log de error general
        DECLARE @final_error NVARCHAR(4000) = ERROR_MESSAGE();
        EXEC dbo.usp_etl_log @batch_id, 'PROCESS_ERROR', 'FAILED', @procedure_start, SYSDATETIME(), NULL, NULL, @final_error;
        
        PRINT '=== ERROR EN CARGA ETL ===';
        PRINT CONCAT('Error: ', @final_error);
        PRINT 'Revise la tabla etl_log para más detalles';
        
        THROW;
    END CATCH;
END;
GO

-- =====================================================================================
-- VISTAS DE MONITOREO ETL
-- =====================================================================================

-- Vista de resumen de batches procesados
IF OBJECT_ID('dbo.v_etl_batch_summary', 'V') IS NOT NULL
    DROP VIEW dbo.v_etl_batch_summary;
GO

CREATE VIEW dbo.v_etl_batch_summary AS
SELECT 
    l.batch_id,
    MIN(l.start_time) AS batch_start_time,
    MAX(l.end_time) AS batch_end_time,
    MAX(l.duration_ms) AS total_duration_ms,
    SUM(CASE WHEN l.step_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_steps,
    SUM(CASE WHEN l.step_status = 'FAILED' THEN 1 ELSE 0 END) AS failed_steps,
    MAX(CASE WHEN l.step_name = 'FACT_LOAD' AND l.step_status = 'COMPLETED' THEN l.rows_processed ELSE 0 END) AS rows_loaded,
    CASE 
        WHEN SUM(CASE WHEN l.step_status = 'FAILED' THEN 1 ELSE 0 END) > 0 THEN 'FAILED'
        WHEN MAX(CASE WHEN l.step_name = 'PROCESS_END' AND l.step_status = 'COMPLETED' THEN 1 ELSE 0 END) = 1 THEN 'COMPLETED'
        ELSE 'IN_PROGRESS'
    END AS batch_status
FROM dbo.etl_log l
GROUP BY l.batch_id;
GO

PRINT 'Procedimiento maestro de carga ETL creado exitosamente';
PRINT 'Uso: EXEC sp_load_meta_excel_batch @batch_id = [ID], @validate_only = 0, @force_reload = 0';
PRINT 'Incluye logging completo, validaciones y manejo de errores';
PRINT 'Vistas de monitoreo: v_etl_batch_summary, etl_log, etl_rejections';
GO