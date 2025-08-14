-- =====================================================================================
-- STORED PROCEDURE OPTIMIZADO PARA CARGA MASIVA DE DATOS META ADS
-- Versión set-based de alta performance para SQL Server
-- Implementa SCD2 automático y carga dimensional completa
-- =====================================================================================

CREATE OR ALTER PROCEDURE dbo.sp_load_meta_excel_batch_setbased
  @import_batch_id int
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    BEGIN TRAN;

    ------------------------------------------------------------------
    -- 0) Materializar el staging del batch (para performance/consistencia)
    ------------------------------------------------------------------
    IF OBJECT_ID('tempdb..#stg') IS NOT NULL DROP TABLE #stg;
    SELECT *
    INTO #stg
    FROM dbo.stg_meta_daily
    WHERE import_batch_id = @import_batch_id;

    -- Nada que cargar
    IF NOT EXISTS (SELECT 1 FROM #stg)
    BEGIN
      COMMIT; RETURN;
    END

    ------------------------------------------------------------------
    -- 1) Dimensión fecha
    ------------------------------------------------------------------
    INSERT INTO dbo.dim_date([date], y, m, d, dow, week, is_weekend)
    SELECT s.dte,
           YEAR(s.dte), MONTH(s.dte), DAY(s.dte),
           DATEPART(weekday, s.dte),
           DATEPART(iso_week, s.dte),
           CASE WHEN DATEPART(weekday, s.dte) IN (1,7) THEN 1 ELSE 0 END
    FROM (SELECT DISTINCT dte FROM #stg WHERE dte IS NOT NULL) s
    WHERE NOT EXISTS (SELECT 1 FROM dbo.dim_date d WHERE d.[date] = s.dte);

    ------------------------------------------------------------------
    -- 2) Dimensiones "simples": currency, account, objective, budget_type,
    --    age, gender, status (3 scopes), url
    ------------------------------------------------------------------

    -- 2.1 Currency
    MERGE dbo.dim_currency AS t
    USING (SELECT DISTINCT currency_code AS code
           FROM #stg WHERE currency_code IS NOT NULL AND currency_code <> '') s
    ON t.code = s.code
    WHEN NOT MATCHED THEN INSERT (code) VALUES (s.code);

    -- 2.2 Accounts (set currency si estaba NULL)
    MERGE dbo.dim_account AS t
    USING (
      SELECT DISTINCT account_name, currency_id = c.currency_id
      FROM #stg s
      LEFT JOIN dbo.dim_currency c ON c.code = s.currency_code
      WHERE s.account_name IS NOT NULL AND s.account_name <> ''
    ) AS s
    ON t.account_name = s.account_name
    WHEN NOT MATCHED THEN INSERT (account_name, currency_id) VALUES (s.account_name, s.currency_id)
    WHEN MATCHED AND t.currency_id IS NULL AND s.currency_id IS NOT NULL
      THEN UPDATE SET t.currency_id = s.currency_id;

    -- 2.3 Objective
    MERGE dbo.dim_objective AS t
    USING (SELECT DISTINCT objective_name FROM #stg WHERE objective_name IS NOT NULL AND objective_name <> '') s
    ON t.objective_name = s.objective_name
    WHEN NOT MATCHED THEN INSERT (objective_name) VALUES (s.objective_name);

    -- 2.4 Budget type
    MERGE dbo.dim_budget_type AS t
    USING (SELECT DISTINCT budget_type_name FROM #stg WHERE budget_type_name IS NOT NULL AND budget_type_name <> '') s
    ON t.name = s.budget_type_name
    WHEN NOT MATCHED THEN INSERT (name) VALUES (s.budget_type_name);

    -- 2.5 Age
    MERGE dbo.dim_age AS t
    USING (SELECT DISTINCT age_label FROM #stg WHERE age_label IS NOT NULL AND age_label <> '') s
    ON t.label = s.age_label
    WHEN NOT MATCHED THEN INSERT (label) VALUES (s.age_label);

    -- 2.6 Gender
    MERGE dbo.dim_gender AS t
    USING (SELECT DISTINCT gender_label FROM #stg WHERE gender_label IS NOT NULL AND gender_label <> '') s
    ON t.label = s.gender_label
    WHEN NOT MATCHED THEN INSERT (label) VALUES (s.gender_label);

    -- 2.7 Status por scope
    MERGE dbo.dim_status AS t
    USING (SELECT DISTINCT 'campaign' AS scope, campaign_status AS status_name
           FROM #stg WHERE campaign_status IS NOT NULL AND campaign_status <> '') s
    ON t.scope = s.scope AND t.status_name = s.status_name
    WHEN NOT MATCHED THEN INSERT (scope, status_name) VALUES (s.scope, s.status_name);

    MERGE dbo.dim_status AS t
    USING (SELECT DISTINCT 'adset' AS scope, adset_status AS status_name
           FROM #stg WHERE adset_status IS NOT NULL AND adset_status <> '') s
    ON t.scope = s.scope AND t.status_name = s.status_name
    WHEN NOT MATCHED THEN INSERT (scope, status_name) VALUES (s.scope, s.status_name);

    MERGE dbo.dim_status AS t
    USING (SELECT DISTINCT 'ad' AS scope, ad_status AS status_name
           FROM #stg WHERE ad_status IS NOT NULL AND ad_status <> '') s
    ON t.scope = s.scope AND t.status_name = s.status_name
    WHEN NOT MATCHED THEN INSERT (scope, status_name) VALUES (s.scope, s.status_name);

    -- 2.8 URL
    ;WITH urls AS (
      SELECT DISTINCT landing_url
      FROM #stg
      WHERE landing_url IS NOT NULL AND LEN(landing_url) > 0
    )
    MERGE dbo.dim_url AS t
    USING (
      SELECT landing_url AS url, dbo.fn_domain(landing_url) AS domain
      FROM urls
    ) s
    ON t.url = s.url
    WHEN NOT MATCHED THEN INSERT (url, domain) VALUES (s.url, s.domain);

    ------------------------------------------------------------------
    -- 3) Dimensiones jerárquicas con SCD2 liviano: campaign, adset, ad
    --    (cerramos versión vigente si cambian atributos clave)
    ------------------------------------------------------------------

    -- Prepara lookups comunes
    IF OBJECT_ID('tempdb..#lk') IS NOT NULL DROP TABLE #lk;
    SELECT
      s.dte,
      a.account_id,
      s.account_name,
      s.campaign_name,
      s.adset_name,
      s.ad_name,
      s.ad_name_norm = dbo.fn_norm_text(s.ad_name),
      obj.objective_id,
      bt.budget_type_id,
      cs.status_id AS camp_status_id,
      ss.status_id AS adset_status_id,
      ads.status_id AS ad_status_id,
      s.budget,
      u.landing_url_id
    INTO #lk
    FROM #stg s
    JOIN dbo.dim_account a   ON a.account_name = s.account_name
    LEFT JOIN dbo.dim_objective obj ON obj.objective_name = s.objective_name
    LEFT JOIN dbo.dim_budget_type bt ON bt.name = s.budget_type_name
    LEFT JOIN dbo.dim_status cs ON cs.scope='campaign' AND cs.status_name = s.campaign_status
    LEFT JOIN dbo.dim_status ss ON ss.scope='adset'    AND ss.status_name = s.adset_status
    LEFT JOIN dbo.dim_status ads ON ads.scope='ad'     AND ads.status_name = s.ad_status
    LEFT JOIN dbo.dim_url u ON u.url = s.landing_url;

    -- 3.1 Campaign: crear faltantes (versión vigente)
    MERGE dbo.dim_campaign AS t
    USING (
      SELECT DISTINCT account_id, campaign_name, objective_id, budget, budget_type_id, camp_status_id
      FROM #lk
    ) s
    ON  t.account_id = s.account_id
    AND t.campaign_name = s.campaign_name
    AND t.scd_valid_to = '9999-12-31'
    WHEN NOT MATCHED THEN
      INSERT (account_id, campaign_name, objective_id, budget, budget_type_id, status_id)
      VALUES (s.account_id, s.campaign_name, s.objective_id, s.budget, s.budget_type_id, s.camp_status_id);

    -- 3.1.b Detecta cambios (objetivo/presupuesto/status) y aplica SCD2
    ;WITH cur AS (
      SELECT c.*
      FROM dbo.dim_campaign c
      WHERE c.scd_valid_to = '9999-12-31'
    ),
    src AS (
      SELECT DISTINCT account_id, campaign_name, objective_id, budget, budget_type_id, camp_status_id
      FROM #lk
    ),
    chg AS (
      SELECT cur.campaign_id, cur.account_id, cur.campaign_name,
             src.objective_id, src.budget, src.budget_type_id, src.camp_status_id
      FROM cur
      JOIN src
        ON cur.account_id = src.account_id AND cur.campaign_name = src.campaign_name
      WHERE ISNULL(cur.objective_id,-1)     <> ISNULL(src.objective_id,-1)
         OR ISNULL(cur.budget,-1)           <> ISNULL(src.budget,-1)
         OR ISNULL(cur.budget_type_id,-1)   <> ISNULL(src.budget_type_id,-1)
         OR ISNULL(cur.status_id,-1)        <> ISNULL(src.camp_status_id,-1)
    )
    -- Cierra versión
    UPDATE c
      SET scd_valid_to = CAST(GETDATE() AS date)
    FROM dbo.dim_campaign c
    JOIN chg ON chg.campaign_id = c.campaign_id
    WHERE c.scd_valid_to = '9999-12-31';

    -- Inserta nueva versión
    INSERT INTO dbo.dim_campaign(account_id, campaign_name, objective_id, budget, budget_type_id, status_id, scd_valid_from)
    SELECT account_id, campaign_name, objective_id, budget, budget_type_id, camp_status_id, CAST(GETDATE() AS date)
    FROM (SELECT DISTINCT account_id, campaign_name, objective_id, budget, budget_type_id, camp_status_id FROM #lk) s
    WHERE EXISTS (
      SELECT 1 FROM dbo.dim_campaign c
      WHERE c.account_id = s.account_id AND c.campaign_name = s.campaign_name AND c.scd_valid_to = CAST(GETDATE() AS date)
    );

    -- 3.2 Adset: crear faltantes (vigentes)
    MERGE dbo.dim_adset AS t
    USING (
      SELECT DISTINCT c.campaign_id, k.adset_name, k.adset_status_id
      FROM #lk k
      JOIN dbo.dim_campaign c
        ON c.account_id = k.account_id AND c.campaign_name = k.campaign_name AND c.scd_valid_to='9999-12-31'
    ) s
    ON  t.campaign_id = s.campaign_id
    AND t.adset_name = s.adset_name
    AND t.scd_valid_to = '9999-12-31'
    WHEN NOT MATCHED THEN
      INSERT (campaign_id, adset_name, status_id)
      VALUES (s.campaign_id, s.adset_name, s.adset_status_id);

    -- 3.2.b SCD2 adset (si cambia status)
    ;WITH cur AS (
      SELECT s.* FROM dbo.dim_adset s WHERE s.scd_valid_to='9999-12-31'
    ),
    src AS (
      SELECT DISTINCT c.campaign_id, k.adset_name, k.adset_status_id
      FROM #lk k
      JOIN dbo.dim_campaign c
        ON c.account_id = k.account_id AND c.campaign_name = k.campaign_name AND c.scd_valid_to='9999-12-31'
    ),
    chg AS (
      SELECT cur.adset_id, cur.campaign_id, cur.adset_name, src.adset_status_id
      FROM cur
      JOIN src ON cur.campaign_id=src.campaign_id AND cur.adset_name=src.adset_name
      WHERE ISNULL(cur.status_id,-1) <> ISNULL(src.adset_status_id,-1)
    )
    UPDATE a SET scd_valid_to = CAST(GETDATE() AS date)
    FROM dbo.dim_adset a
    JOIN chg ON chg.adset_id = a.adset_id
    WHERE a.scd_valid_to='9999-12-31';

    INSERT INTO dbo.dim_adset(campaign_id, adset_name, status_id, scd_valid_from)
    SELECT s.campaign_id, s.adset_name, s.adset_status_id, CAST(GETDATE() AS date)
    FROM (
      SELECT DISTINCT c.campaign_id, k.adset_name, k.adset_status_id
      FROM #lk k
      JOIN dbo.dim_campaign c
        ON c.account_id = k.account_id AND c.campaign_name = k.campaign_name AND c.scd_valid_to='9999-12-31'
    ) s
    WHERE EXISTS (
      SELECT 1 FROM dbo.dim_adset a
      WHERE a.campaign_id = s.campaign_id AND a.adset_name=s.adset_name AND a.scd_valid_to = CAST(GETDATE() AS date)
    );

    -- 3.3 Ad: crear faltantes (vigentes)
    MERGE dbo.dim_ad AS t
    USING (
      SELECT DISTINCT ds.adset_id, k.ad_name, k.ad_name_norm, k.ad_status_id, k.landing_url_id
      FROM #lk k
      JOIN dbo.dim_campaign c
        ON c.account_id = k.account_id AND c.campaign_name=k.campaign_name AND c.scd_valid_to='9999-12-31'
      JOIN dbo.dim_adset ds
        ON ds.campaign_id = c.campaign_id AND ds.adset_name = k.adset_name AND ds.scd_valid_to='9999-12-31'
    ) s
    ON  t.adset_id = s.adset_id
    AND t.ad_name_norm = s.ad_name_norm
    AND t.scd_valid_to = '9999-12-31'
    WHEN NOT MATCHED THEN
      INSERT (adset_id, ad_name, ad_name_norm, status_id, landing_url_id)
      VALUES (s.adset_id, s.ad_name, s.ad_name_norm, s.ad_status_id, s.landing_url_id);

    -- 3.3.b SCD2 ad (si cambia status o landing_url)
    ;WITH cur AS (
      SELECT a.* FROM dbo.dim_ad a WHERE a.scd_valid_to='9999-12-31'
    ),
    src AS (
      SELECT DISTINCT ds.adset_id, k.ad_name_norm, k.ad_status_id, k.landing_url_id
      FROM #lk k
      JOIN dbo.dim_campaign c
        ON c.account_id=k.account_id AND c.campaign_name=k.campaign_name AND c.scd_valid_to='9999-12-31'
      JOIN dbo.dim_adset ds
        ON ds.campaign_id=c.campaign_id AND ds.adset_name=k.adset_name AND ds.scd_valid_to='9999-12-31'
    ),
    chg AS (
      SELECT cur.ad_id, cur.adset_id, cur.ad_name_norm, src.ad_status_id, src.landing_url_id
      FROM cur
      JOIN src ON cur.adset_id=src.adset_id AND cur.ad_name_norm=src.ad_name_norm
      WHERE ISNULL(cur.status_id,-1)      <> ISNULL(src.ad_status_id,-1)
         OR ISNULL(cur.landing_url_id,-1) <> ISNULL(src.landing_url_id,-1)
    )
    UPDATE a SET scd_valid_to = CAST(GETDATE() AS date)
    FROM dbo.dim_ad a
    JOIN chg ON chg.ad_id = a.ad_id
    WHERE a.scd_valid_to='9999-12-31';

    INSERT INTO dbo.dim_ad(adset_id, ad_name, ad_name_norm, status_id, landing_url_id, scd_valid_from)
    SELECT s.adset_id, a2.ad_name, s.ad_name_norm, s.ad_status_id, s.landing_url_id, CAST(GETDATE() AS date)
    FROM (
      SELECT DISTINCT ds.adset_id, k.ad_name_norm, k.ad_status_id, k.landing_url_id, k.ad_name
      FROM #lk k
      JOIN dbo.dim_campaign c
        ON c.account_id=k.account_id AND c.campaign_name=k.campaign_name AND c.scd_valid_to='9999-12-31'
      JOIN dbo.dim_adset ds
        ON ds.campaign_id=c.campaign_id AND ds.adset_name=k.adset_name AND ds.scd_valid_to='9999-12-31'
    ) a2
    JOIN (
      SELECT DISTINCT adset_id, ad_name_norm, ad_status_id, landing_url_id
      FROM (
        SELECT DISTINCT ds.adset_id, k.ad_name_norm, k.ad_status_id, k.landing_url_id
        FROM #lk k
        JOIN dbo.dim_campaign c ON c.account_id=k.account_id AND c.campaign_name=k.campaign_name AND c.scd_valid_to='9999-12-31'
        JOIN dbo.dim_adset ds    ON ds.campaign_id=c.campaign_id AND ds.adset_name=k.adset_name AND ds.scd_valid_to='9999-12-31'
      ) z
    ) s
      ON s.adset_id=a2.adset_id AND s.ad_name_norm=a2.ad_name_norm
    WHERE EXISTS (
      SELECT 1 FROM dbo.dim_ad d
      WHERE d.adset_id=s.adset_id AND d.ad_name_norm=s.ad_name_norm AND d.scd_valid_to = CAST(GETDATE() AS date)
    );

    ------------------------------------------------------------------
    -- 4) Audiencias (incluidas / excluidas) set-based
    ------------------------------------------------------------------
    -- Incluidas
    IF OBJECT_ID('tempdb..#aud_in') IS NOT NULL DROP TABLE #aud_in;
    SELECT DISTINCT ds.adset_id, TRIM(value) AS audience_name
    INTO #aud_in
    FROM #stg s
    JOIN dbo.dim_account a ON a.account_name=s.account_name
    JOIN dbo.dim_campaign c ON c.account_id=a.account_id AND c.campaign_name=s.campaign_name AND c.scd_valid_to='9999-12-31'
    JOIN dbo.dim_adset ds ON ds.campaign_id=c.campaign_id AND ds.adset_name=s.adset_name AND ds.scd_valid_to='9999-12-31'
    CROSS APPLY STRING_SPLIT(REPLACE(REPLACE(s.audiences_included_raw, CHAR(10), ';'), ',', ';'), ';')
    WHERE TRIM(value) <> '';

    MERGE dbo.dim_audience t
    USING (SELECT DISTINCT audience_name FROM #aud_in) s
    ON t.audience_name = s.audience_name
    WHEN NOT MATCHED THEN INSERT (audience_name) VALUES (s.audience_name);

    INSERT INTO dbo.bridge_adset_audience_included(adset_id, audience_id)
    SELECT i.adset_id, a.audience_id
    FROM #aud_in i
    JOIN dbo.dim_audience a ON a.audience_name=i.audience_name
    EXCEPT
    SELECT adset_id, audience_id FROM dbo.bridge_adset_audience_included;

    -- Excluidas
    IF OBJECT_ID('tempdb..#aud_ex') IS NOT NULL DROP TABLE #aud_ex;
    SELECT DISTINCT ds.adset_id, TRIM(value) AS audience_name
    INTO #aud_ex
    FROM #stg s
    JOIN dbo.dim_account a ON a.account_name=s.account_name
    JOIN dbo.dim_campaign c ON c.account_id=a.account_id AND c.campaign_name=s.campaign_name AND c.scd_valid_to='9999-12-31'
    JOIN dbo.dim_adset ds ON ds.campaign_id=c.campaign_id AND ds.adset_name=s.adset_name AND ds.scd_valid_to='9999-12-31'
    CROSS APPLY STRING_SPLIT(REPLACE(REPLACE(s.audiences_excluded_raw, CHAR(10), ';'), ',', ';'), ';')
    WHERE TRIM(value) <> '';

    MERGE dbo.dim_audience t
    USING (SELECT DISTINCT audience_name FROM #aud_ex) s
    ON t.audience_name = s.audience_name
    WHEN NOT MATCHED THEN INSERT (audience_name) VALUES (s.audience_name);

    INSERT INTO dbo.bridge_adset_audience_excluded(adset_id, audience_id)
    SELECT i.adset_id, a.audience_id
    FROM #aud_ex i
    JOIN dbo.dim_audience a ON a.audience_name=i.audience_name
    EXCEPT
    SELECT adset_id, audience_id FROM dbo.bridge_adset_audience_excluded;

    ------------------------------------------------------------------
    -- 5) Insert/Upsert FACT set-based
    ------------------------------------------------------------------
    ;WITH keys AS (
      SELECT
        d.date_id,
        a.account_id,
        c.campaign_id,
        s.adset_id,
        ad.ad_id,
        ag.age_id,
        g.gender_id,
        cur.currency_id,
        x.*
      FROM #stg x
      JOIN dbo.dim_date d      ON d.[date] = x.dte
      JOIN dbo.dim_account a   ON a.account_name = x.account_name
      JOIN dbo.dim_campaign c  ON c.account_id=a.account_id AND c.campaign_name=x.campaign_name AND c.scd_valid_to='9999-12-31'
      JOIN dbo.dim_adset s     ON s.campaign_id=c.campaign_id AND s.adset_name=x.adset_name AND s.scd_valid_to='9999-12-31'
      JOIN dbo.dim_ad ad       ON ad.adset_id=s.adset_id AND ad.ad_name_norm=dbo.fn_norm_text(x.ad_name) AND ad.scd_valid_to='9999-12-31'
      JOIN dbo.dim_age ag      ON ag.label = x.age_label
      JOIN dbo.dim_gender g    ON g.label = x.gender_label
      LEFT JOIN dbo.dim_currency cur ON cur.code = x.currency_code
    )
    MERGE dbo.fact_meta_daily AS tgt
    USING (
      SELECT
        date_id, account_id, campaign_id, adset_id, ad_id, age_id, gender_id, currency_id,
        SUM(spend) AS spend,
        SUM(impressions) AS impressions,
        SUM(reach) AS reach,
        AVG(CAST(frequency AS decimal(12,6))) AS frequency,  -- si viene por fila, promedia
        SUM(clicks_all) AS clicks_all,
        SUM(link_clicks) AS link_clicks,
        SUM(lpv) AS landing_page_views,
        SUM(purchases) AS purchases,
        SUM(conversion_value) AS conversion_value,
        SUM(v3s) AS video_3s,
        SUM(v25) AS video_25,
        SUM(v50) AS video_50,
        SUM(v75) AS video_75,
        SUM(v95) AS video_95,
        SUM(v100) AS video_100,
        SUM(thruplays) AS thruplays,
        AVG(CAST(avg_watch AS decimal(12,4))) AS avg_watch_time
      FROM keys
      GROUP BY date_id, account_id, campaign_id, adset_id, ad_id, age_id, gender_id, currency_id
    ) AS src
    ON (tgt.date_id=src.date_id AND tgt.account_id=src.account_id AND tgt.campaign_id=src.campaign_id
        AND tgt.adset_id=src.adset_id AND tgt.ad_id=src.ad_id AND tgt.age_id=src.age_id AND tgt.gender_id=src.gender_id)
    WHEN MATCHED THEN UPDATE SET
      tgt.currency_id = src.currency_id,
      tgt.spend = src.spend,
      tgt.impressions = src.impressions,
      tgt.reach = src.reach,
      tgt.frequency = src.frequency,
      tgt.clicks_all = src.clicks_all,
      tgt.link_clicks = src.link_clicks,
      tgt.landing_page_views = src.landing_page_views,
      tgt.purchases = src.purchases,
      tgt.conversion_value = src.conversion_value,
      tgt.video_3s = src.video_3s,
      tgt.video_25 = src.video_25,
      tgt.video_50 = src.video_50,
      tgt.video_75 = src.video_75,
      tgt.video_95 = src.video_95,
      tgt.video_100 = src.video_100,
      tgt.thruplays = src.thruplays,
      tgt.avg_watch_time = src.avg_watch_time
    WHEN NOT MATCHED THEN INSERT
      (date_id, account_id, campaign_id, adset_id, ad_id, age_id, gender_id, currency_id,
       spend, impressions, reach, frequency, clicks_all, link_clicks, landing_page_views,
       purchases, conversion_value, video_3s, video_25, video_50, video_75, video_95, video_100, thruplays, avg_watch_time)
    VALUES
      (src.date_id, src.account_id, src.campaign_id, src.adset_id, src.ad_id, src.age_id, src.gender_id, src.currency_id,
       src.spend, src.impressions, src.reach, src.frequency, src.clicks_all, src.link_clicks, src.landing_page_views,
       src.purchases, src.conversion_value, src.video_3s, src.video_25, src.video_50, src.video_75, src.video_95, src.video_100, src.thruplays, src.avg_watch_time);

    COMMIT;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    THROW;
  END CATCH
END
GO