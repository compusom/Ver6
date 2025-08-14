-- =====================================================================================
-- PROCEDIMIENTOS DE UPSERT PARA DIMENSIONES
-- Manejo de SCD Tipo 1 y Tipo 2 para dimensional model
-- Optimizados para carga masiva y consistencia de datos
-- =====================================================================================

USE [MetaAdsDW];
GO

-- =====================================================================================
-- UPSERT: dim_account (SCD Tipo 1)
-- =====================================================================================

IF OBJECT_ID('dbo.usp_upsert_dim_account', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_upsert_dim_account;
GO

CREATE PROCEDURE dbo.usp_upsert_dim_account
    @batch_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @rows_inserted INT = 0, @rows_updated INT = 0;
    
    BEGIN TRY
        -- Upsert accounts from staging
        WITH source_accounts AS (
            SELECT DISTINCT 
                account_name,
                currency_code
            FROM dbo.stg_meta_daily s
            WHERE (@batch_id IS NULL OR s.import_batch_id = @batch_id)
              AND s.is_valid_row = 1
              AND s.account_name != ''
        )
        MERGE dbo.dim_account AS target
        USING (
            SELECT 
                sa.account_name,
                ISNULL(c.currency_id, 1) AS currency_id -- Default to EUR (id=1)
            FROM source_accounts sa
            LEFT JOIN dbo.dim_currency c ON sa.currency_code = c.currency_code
        ) AS source ON target.account_name = source.account_name
        
        WHEN MATCHED AND target.currency_id != source.currency_id THEN
            UPDATE SET 
                currency_id = source.currency_id,
                updated_at = SYSDATETIME()
                
        WHEN NOT MATCHED BY TARGET THEN
            INSERT (account_name, currency_id)
            VALUES (source.account_name, source.currency_id);
        
        SET @rows_inserted = @@ROWCOUNT;
        
        PRINT CONCAT('usp_upsert_dim_account: ', @rows_inserted, ' accounts processed');
        
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;
GO

-- =====================================================================================
-- UPSERT: dim_url (SCD Tipo 1)
-- =====================================================================================

IF OBJECT_ID('dbo.usp_upsert_dim_url', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_upsert_dim_url;
GO

CREATE PROCEDURE dbo.usp_upsert_dim_url
    @batch_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @rows_inserted INT = 0;
    
    BEGIN TRY
        -- Insert new URLs
        WITH source_urls AS (
            SELECT DISTINCT 
                landing_url AS full_url,
                CASE 
                    WHEN landing_url LIKE 'http%://%' THEN 
                        SUBSTRING(landing_url, CHARINDEX('://', landing_url) + 3, 
                                 CASE WHEN CHARINDEX('/', landing_url, CHARINDEX('://', landing_url) + 3) > 0
                                      THEN CHARINDEX('/', landing_url, CHARINDEX('://', landing_url) + 3) - CHARINDEX('://', landing_url) - 3
                                      ELSE LEN(landing_url) 
                                 END)
                    ELSE NULL
                END AS domain,
                CASE 
                    WHEN landing_url LIKE 'http%://%' AND CHARINDEX('/', landing_url, CHARINDEX('://', landing_url) + 3) > 0 THEN 
                        SUBSTRING(landing_url, CHARINDEX('/', landing_url, CHARINDEX('://', landing_url) + 3), LEN(landing_url))
                    ELSE '/'
                END AS path
            FROM dbo.stg_meta_daily s
            WHERE (@batch_id IS NULL OR s.import_batch_id = @batch_id)
              AND s.is_valid_row = 1
              AND s.landing_url != ''
              AND s.landing_url IS NOT NULL
        )
        INSERT INTO dbo.dim_url (full_url, domain, path)
        SELECT full_url, domain, path
        FROM source_urls
        WHERE NOT EXISTS (
            SELECT 1 FROM dbo.dim_url u WHERE u.full_url = source_urls.full_url
        );
        
        SET @rows_inserted = @@ROWCOUNT;
        PRINT CONCAT('usp_upsert_dim_url: ', @rows_inserted, ' URLs inserted');
        
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;
GO

-- =====================================================================================
-- UPSERT: dim_audience (SCD Tipo 1) 
-- =====================================================================================

IF OBJECT_ID('dbo.usp_upsert_dim_audience', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_upsert_dim_audience;
GO

CREATE PROCEDURE dbo.usp_upsert_dim_audience
    @batch_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @rows_inserted INT = 0;
    
    BEGIN TRY
        -- Parse audiences from staging data
        WITH audience_splits AS (
            SELECT DISTINCT
                LTRIM(RTRIM(value)) AS audience_name,
                'Custom' AS audience_type
            FROM dbo.stg_meta_daily s
            CROSS APPLY STRING_SPLIT(s.audiences_included, ';')
            WHERE (@batch_id IS NULL OR s.import_batch_id = @batch_id)
              AND s.is_valid_row = 1
              AND s.audiences_included != ''
              AND LTRIM(RTRIM(value)) != ''
              
            UNION 
            
            SELECT DISTINCT
                LTRIM(RTRIM(value)) AS audience_name,
                'Custom' AS audience_type
            FROM dbo.stg_meta_daily s
            CROSS APPLY STRING_SPLIT(s.audiences_excluded, ';')
            WHERE (@batch_id IS NULL OR s.import_batch_id = @batch_id)
              AND s.is_valid_row = 1
              AND s.audiences_excluded != ''
              AND LTRIM(RTRIM(value)) != ''
        )
        INSERT INTO dbo.dim_audience (audience_name, audience_type)
        SELECT audience_name, audience_type
        FROM audience_splits
        WHERE NOT EXISTS (
            SELECT 1 FROM dbo.dim_audience a WHERE a.audience_name = audience_splits.audience_name
        );
        
        SET @rows_inserted = @@ROWCOUNT;
        PRINT CONCAT('usp_upsert_dim_audience: ', @rows_inserted, ' audiences inserted');
        
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;
GO

-- =====================================================================================
-- UPSERT: dim_campaign (SCD Tipo 2) 
-- =====================================================================================

IF OBJECT_ID('dbo.usp_upsert_dim_campaign', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_upsert_dim_campaign;
GO

CREATE PROCEDURE dbo.usp_upsert_dim_campaign
    @batch_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @rows_inserted INT = 0, @rows_updated INT = 0;
    DECLARE @current_time DATETIME2 = SYSDATETIME();
    
    BEGIN TRY
        -- Source data with all campaign attributes
        WITH source_campaigns AS (
            SELECT DISTINCT 
                s.campaign_natural_key,
                a.account_id,
                s.campaign_name,
                o.objective_id,
                s.budget,
                bt.budget_type_id,
                st.status_id
            FROM dbo.stg_meta_daily s
            INNER JOIN dbo.dim_account a ON s.account_name = a.account_name
            LEFT JOIN dbo.dim_objective o ON s.objective_name = o.objective_name
            LEFT JOIN dbo.dim_budget_type bt ON s.budget_type_name = bt.budget_type_name
            LEFT JOIN dbo.dim_status st ON s.campaign_status = st.status_name AND st.scope = 'campaign'
            WHERE (@batch_id IS NULL OR s.import_batch_id = @batch_id)
              AND s.is_valid_row = 1
        ),
        current_campaigns AS (
            SELECT *
            FROM dbo.dim_campaign
            WHERE scd_is_current = 1
        )
        
        -- Handle SCD Type 2 logic
        
        -- 1. Close expired versions (campaigns that changed)
        UPDATE dbo.dim_campaign 
        SET scd_valid_to = @current_time,
            scd_is_current = 0,
            updated_at = @current_time
        FROM dbo.dim_campaign dc
        INNER JOIN source_campaigns sc ON dc.campaign_natural_key = sc.campaign_natural_key
        WHERE dc.scd_is_current = 1
          AND (
              ISNULL(dc.objective_id, -1) != ISNULL(sc.objective_id, -1) OR
              ISNULL(dc.budget, -1) != ISNULL(sc.budget, -1) OR
              ISNULL(dc.budget_type_id, -1) != ISNULL(sc.budget_type_id, -1) OR
              ISNULL(dc.status_id, -1) != ISNULL(sc.status_id, -1)
          );
        
        SET @rows_updated = @@ROWCOUNT;
        
        -- 2. Insert new versions (new campaigns + changed campaigns)
        INSERT INTO dbo.dim_campaign (
            campaign_natural_key, account_id, campaign_name, 
            objective_id, budget, budget_type_id, status_id,
            scd_valid_from, scd_version
        )
        SELECT 
            sc.campaign_natural_key,
            sc.account_id,
            sc.campaign_name,
            sc.objective_id,
            sc.budget,
            sc.budget_type_id,
            sc.status_id,
            @current_time,
            ISNULL((SELECT MAX(scd_version) FROM dbo.dim_campaign WHERE campaign_natural_key = sc.campaign_natural_key), 0) + 1
        FROM source_campaigns sc
        WHERE NOT EXISTS (
            SELECT 1 
            FROM current_campaigns cc 
            WHERE cc.campaign_natural_key = sc.campaign_natural_key
              AND ISNULL(cc.objective_id, -1) = ISNULL(sc.objective_id, -1)
              AND ISNULL(cc.budget, -1) = ISNULL(sc.budget, -1)
              AND ISNULL(cc.budget_type_id, -1) = ISNULL(sc.budget_type_id, -1)
              AND ISNULL(cc.status_id, -1) = ISNULL(sc.status_id, -1)
        );
        
        SET @rows_inserted = @@ROWCOUNT;
        
        PRINT CONCAT('usp_upsert_dim_campaign: ', @rows_inserted, ' inserted, ', @rows_updated, ' updated');
        
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;
GO

-- =====================================================================================
-- UPSERT: dim_adset (SCD Tipo 2)
-- =====================================================================================

IF OBJECT_ID('dbo.usp_upsert_dim_adset', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_upsert_dim_adset;
GO

CREATE PROCEDURE dbo.usp_upsert_dim_adset
    @batch_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @rows_inserted INT = 0, @rows_updated INT = 0;
    DECLARE @current_time DATETIME2 = SYSDATETIME();
    
    BEGIN TRY
        WITH source_adsets AS (
            SELECT DISTINCT 
                s.adset_natural_key,
                c.campaign_id,
                s.adset_name,
                st.status_id
            FROM dbo.stg_meta_daily s
            INNER JOIN dbo.dim_account a ON s.account_name = a.account_name
            INNER JOIN dbo.dim_campaign c ON s.campaign_natural_key = c.campaign_natural_key AND c.scd_is_current = 1
            LEFT JOIN dbo.dim_status st ON s.adset_status = st.status_name AND st.scope = 'adset'
            WHERE (@batch_id IS NULL OR s.import_batch_id = @batch_id)
              AND s.is_valid_row = 1
        ),
        current_adsets AS (
            SELECT *
            FROM dbo.dim_adset
            WHERE scd_is_current = 1
        )
        
        -- Close expired versions
        UPDATE dbo.dim_adset 
        SET scd_valid_to = @current_time,
            scd_is_current = 0,
            updated_at = @current_time
        FROM dbo.dim_adset da
        INNER JOIN source_adsets sa ON da.adset_natural_key = sa.adset_natural_key
        WHERE da.scd_is_current = 1
          AND (
              ISNULL(da.campaign_id, -1) != ISNULL(sa.campaign_id, -1) OR
              ISNULL(da.status_id, -1) != ISNULL(sa.status_id, -1)
          );
        
        SET @rows_updated = @@ROWCOUNT;
        
        -- Insert new versions
        INSERT INTO dbo.dim_adset (
            adset_natural_key, campaign_id, adset_name, status_id,
            scd_valid_from, scd_version
        )
        SELECT 
            sa.adset_natural_key,
            sa.campaign_id,
            sa.adset_name,
            sa.status_id,
            @current_time,
            ISNULL((SELECT MAX(scd_version) FROM dbo.dim_adset WHERE adset_natural_key = sa.adset_natural_key), 0) + 1
        FROM source_adsets sa
        WHERE NOT EXISTS (
            SELECT 1 
            FROM current_adsets ca 
            WHERE ca.adset_natural_key = sa.adset_natural_key
              AND ISNULL(ca.campaign_id, -1) = ISNULL(sa.campaign_id, -1)
              AND ISNULL(ca.status_id, -1) = ISNULL(sa.status_id, -1)
        );
        
        SET @rows_inserted = @@ROWCOUNT;
        
        PRINT CONCAT('usp_upsert_dim_adset: ', @rows_inserted, ' inserted, ', @rows_updated, ' updated');
        
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;
GO

-- =====================================================================================
-- UPSERT: dim_ad (SCD Tipo 2)
-- =====================================================================================

IF OBJECT_ID('dbo.usp_upsert_dim_ad', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_upsert_dim_ad;
GO

CREATE PROCEDURE dbo.usp_upsert_dim_ad
    @batch_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @rows_inserted INT = 0, @rows_updated INT = 0;
    DECLARE @current_time DATETIME2 = SYSDATETIME();
    
    BEGIN TRY
        WITH source_ads AS (
            SELECT DISTINCT 
                s.ad_natural_key,
                ads.adset_id,
                s.ad_name,
                s.ad_name_norm,
                st.status_id,
                u.url_id AS landing_url_id
            FROM dbo.stg_meta_daily s
            INNER JOIN dbo.dim_account a ON s.account_name = a.account_name
            INNER JOIN dbo.dim_campaign c ON s.campaign_natural_key = c.campaign_natural_key AND c.scd_is_current = 1
            INNER JOIN dbo.dim_adset ads ON s.adset_natural_key = ads.adset_natural_key AND ads.scd_is_current = 1
            LEFT JOIN dbo.dim_status st ON s.ad_status = st.status_name AND st.scope = 'ad'
            LEFT JOIN dbo.dim_url u ON s.landing_url = u.full_url
            WHERE (@batch_id IS NULL OR s.import_batch_id = @batch_id)
              AND s.is_valid_row = 1
        ),
        current_ads AS (
            SELECT *
            FROM dbo.dim_ad
            WHERE scd_is_current = 1
        )
        
        -- Close expired versions
        UPDATE dbo.dim_ad 
        SET scd_valid_to = @current_time,
            scd_is_current = 0,
            updated_at = @current_time
        FROM dbo.dim_ad da
        INNER JOIN source_ads sa ON da.ad_natural_key = sa.ad_natural_key
        WHERE da.scd_is_current = 1
          AND (
              ISNULL(da.adset_id, -1) != ISNULL(sa.adset_id, -1) OR
              ISNULL(da.status_id, -1) != ISNULL(sa.status_id, -1) OR
              ISNULL(da.landing_url_id, -1) != ISNULL(sa.landing_url_id, -1)
          );
        
        SET @rows_updated = @@ROWCOUNT;
        
        -- Insert new versions
        INSERT INTO dbo.dim_ad (
            ad_natural_key, adset_id, ad_name, ad_name_norm, 
            status_id, landing_url_id, scd_valid_from, scd_version
        )
        SELECT 
            sa.ad_natural_key,
            sa.adset_id,
            sa.ad_name,
            sa.ad_name_norm,
            sa.status_id,
            sa.landing_url_id,
            @current_time,
            ISNULL((SELECT MAX(scd_version) FROM dbo.dim_ad WHERE ad_natural_key = sa.ad_natural_key), 0) + 1
        FROM source_ads sa
        WHERE NOT EXISTS (
            SELECT 1 
            FROM current_ads ca 
            WHERE ca.ad_natural_key = sa.ad_natural_key
              AND ISNULL(ca.adset_id, -1) = ISNULL(sa.adset_id, -1)
              AND ISNULL(ca.status_id, -1) = ISNULL(sa.status_id, -1)
              AND ISNULL(ca.landing_url_id, -1) = ISNULL(sa.landing_url_id, -1)
        );
        
        SET @rows_inserted = @@ROWCOUNT;
        
        PRINT CONCAT('usp_upsert_dim_ad: ', @rows_inserted, ' inserted, ', @rows_updated, ' updated');
        
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;
GO

-- =====================================================================================
-- UPSERT: bridge_adset_audience_included
-- =====================================================================================

IF OBJECT_ID('dbo.usp_upsert_bridge_adset_audience_included', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_upsert_bridge_adset_audience_included;
GO

CREATE PROCEDURE dbo.usp_upsert_bridge_adset_audience_included
    @batch_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @rows_inserted INT = 0;
    
    BEGIN TRY
        -- Clear existing relationships for adsets in this batch
        DELETE b
        FROM dbo.bridge_adset_audience_included b
        INNER JOIN dbo.dim_adset ads ON b.adset_id = ads.adset_id
        WHERE ads.scd_is_current = 1
          AND EXISTS (
              SELECT 1 FROM dbo.stg_meta_daily s
              WHERE s.adset_natural_key = ads.adset_natural_key
                AND (@batch_id IS NULL OR s.import_batch_id = @batch_id)
                AND s.is_valid_row = 1
          );
        
        -- Insert new relationships
        WITH audience_relationships AS (
            SELECT DISTINCT
                ads.adset_id,
                au.audience_id
            FROM dbo.stg_meta_daily s
            INNER JOIN dbo.dim_adset ads ON s.adset_natural_key = ads.adset_natural_key AND ads.scd_is_current = 1
            CROSS APPLY STRING_SPLIT(s.audiences_included, ';') ss
            INNER JOIN dbo.dim_audience au ON LTRIM(RTRIM(ss.value)) = au.audience_name
            WHERE (@batch_id IS NULL OR s.import_batch_id = @batch_id)
              AND s.is_valid_row = 1
              AND s.audiences_included != ''
              AND LTRIM(RTRIM(ss.value)) != ''
        )
        INSERT INTO dbo.bridge_adset_audience_included (adset_id, audience_id)
        SELECT adset_id, audience_id
        FROM audience_relationships;
        
        SET @rows_inserted = @@ROWCOUNT;
        PRINT CONCAT('usp_upsert_bridge_adset_audience_included: ', @rows_inserted, ' relationships inserted');
        
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;
GO

-- =====================================================================================
-- UPSERT: bridge_adset_audience_excluded
-- =====================================================================================

IF OBJECT_ID('dbo.usp_upsert_bridge_adset_audience_excluded', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_upsert_bridge_adset_audience_excluded;
GO

CREATE PROCEDURE dbo.usp_upsert_bridge_adset_audience_excluded
    @batch_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @rows_inserted INT = 0;
    
    BEGIN TRY
        -- Clear existing relationships for adsets in this batch
        DELETE b
        FROM dbo.bridge_adset_audience_excluded b
        INNER JOIN dbo.dim_adset ads ON b.adset_id = ads.adset_id
        WHERE ads.scd_is_current = 1
          AND EXISTS (
              SELECT 1 FROM dbo.stg_meta_daily s
              WHERE s.adset_natural_key = ads.adset_natural_key
                AND (@batch_id IS NULL OR s.import_batch_id = @batch_id)
                AND s.is_valid_row = 1
          );
        
        -- Insert new relationships
        WITH audience_relationships AS (
            SELECT DISTINCT
                ads.adset_id,
                au.audience_id
            FROM dbo.stg_meta_daily s
            INNER JOIN dbo.dim_adset ads ON s.adset_natural_key = ads.adset_natural_key AND ads.scd_is_current = 1
            CROSS APPLY STRING_SPLIT(s.audiences_excluded, ';') ss
            INNER JOIN dbo.dim_audience au ON LTRIM(RTRIM(ss.value)) = au.audience_name
            WHERE (@batch_id IS NULL OR s.import_batch_id = @batch_id)
              AND s.is_valid_row = 1
              AND s.audiences_excluded != ''
              AND LTRIM(RTRIM(ss.value)) != ''
        )
        INSERT INTO dbo.bridge_adset_audience_excluded (adset_id, audience_id)
        SELECT adset_id, audience_id
        FROM audience_relationships;
        
        SET @rows_inserted = @@ROWCOUNT;
        PRINT CONCAT('usp_upsert_bridge_adset_audience_excluded: ', @rows_inserted, ' relationships inserted');
        
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
END;
GO

-- =====================================================================================
-- PROCEDIMIENTO MAESTRO: Ejecutar todos los upserts en orden
-- =====================================================================================

IF OBJECT_ID('dbo.usp_upsert_all_dimensions', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_upsert_all_dimensions;
GO

CREATE PROCEDURE dbo.usp_upsert_all_dimensions
    @batch_id INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @start_time DATETIME2 = SYSDATETIME();
    DECLARE @step_start DATETIME2;
    
    BEGIN TRY
        PRINT CONCAT('=== INICIANDO UPSERT DE DIMENSIONES - Batch ID: ', ISNULL(@batch_id, 'ALL'), ' ===');
        PRINT CONCAT('Hora inicio: ', FORMAT(@start_time, 'yyyy-MM-dd HH:mm:ss'));
        
        -- Step 1: Accounts (base)
        SET @step_start = SYSDATETIME();
        EXEC dbo.usp_upsert_dim_account @batch_id;
        PRINT CONCAT('Accounts completado en: ', DATEDIFF(ms, @step_start, SYSDATETIME()), 'ms');
        
        -- Step 2: URLs
        SET @step_start = SYSDATETIME();
        EXEC dbo.usp_upsert_dim_url @batch_id;
        PRINT CONCAT('URLs completado en: ', DATEDIFF(ms, @step_start, SYSDATETIME()), 'ms');
        
        -- Step 3: Audiences
        SET @step_start = SYSDATETIME();
        EXEC dbo.usp_upsert_dim_audience @batch_id;
        PRINT CONCAT('Audiences completado en: ', DATEDIFF(ms, @step_start, SYSDATETIME()), 'ms');
        
        -- Step 4: Campaigns (depends on accounts)
        SET @step_start = SYSDATETIME();
        EXEC dbo.usp_upsert_dim_campaign @batch_id;
        PRINT CONCAT('Campaigns completado en: ', DATEDIFF(ms, @step_start, SYSDATETIME()), 'ms');
        
        -- Step 5: AdSets (depends on campaigns)
        SET @step_start = SYSDATETIME();
        EXEC dbo.usp_upsert_dim_adset @batch_id;
        PRINT CONCAT('AdSets completado en: ', DATEDIFF(ms, @step_start, SYSDATETIME()), 'ms');
        
        -- Step 6: Ads (depends on adsets)
        SET @step_start = SYSDATETIME();
        EXEC dbo.usp_upsert_dim_ad @batch_id;
        PRINT CONCAT('Ads completado en: ', DATEDIFF(ms, @step_start, SYSDATETIME()), 'ms');
        
        -- Step 7: Bridge tables
        SET @step_start = SYSDATETIME();
        EXEC dbo.usp_upsert_bridge_adset_audience_included @batch_id;
        EXEC dbo.usp_upsert_bridge_adset_audience_excluded @batch_id;
        PRINT CONCAT('Bridges completado en: ', DATEDIFF(ms, @step_start, SYSDATETIME()), 'ms');
        
        PRINT CONCAT('=== UPSERT COMPLETADO - Tiempo total: ', DATEDIFF(ms, @start_time, SYSDATETIME()), 'ms ===');
        
    END TRY
    BEGIN CATCH
        DECLARE @error_message NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @error_line INT = ERROR_LINE();
        
        PRINT CONCAT('ERROR en upsert de dimensiones - Línea: ', @error_line);
        PRINT CONCAT('Mensaje: ', @error_message);
        
        THROW;
    END CATCH
END;
GO

PRINT 'Procedimientos de upsert de dimensiones creados exitosamente';
PRINT 'Uso: EXEC usp_upsert_all_dimensions @batch_id = NULL (para todos) o específico';
PRINT 'SCD Tipo 2 implementado para campaigns, adsets y ads';
PRINT 'SCD Tipo 1 para accounts, URLs y audiences';
GO