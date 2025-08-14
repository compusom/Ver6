-- =====================================================================================
-- QUERIES ANALÍTICAS DE EJEMPLO - META ADS DATA WAREHOUSE
-- Conjunto de queries pre-construidas para análisis común de Meta Ads
-- Copiar y personalizar según necesidades específicas
-- =====================================================================================

USE [MetaAdsDW];
GO

-- =====================================================================================
-- 1. DASHBOARD EJECUTIVO - KPIs PRINCIPALES
-- =====================================================================================

-- Resumen ejecutivo por cuenta (últimos 30 días)
-- Incluye métricas principales y tendencia
SELECT 
    a.account_name,
    curr.currency_code,
    
    -- Métricas totales
    FORMAT(SUM(f.spend), 'C', 'es-ES') AS total_spend,
    FORMAT(SUM(f.impressions), 'N0') AS total_impressions,
    FORMAT(SUM(f.purchases), 'N0') AS total_purchases,
    FORMAT(SUM(f.conversion_value), 'C', 'es-ES') AS total_revenue,
    
    -- KPIs principales
    FORMAT(SUM(f.conversion_value) / NULLIF(SUM(f.spend), 0), 'N2') AS roas,
    FORMAT(SUM(f.spend) / NULLIF(SUM(f.purchases), 0), 'C', 'es-ES') AS cpa,
    FORMAT(100.0 * SUM(f.link_clicks) / NULLIF(SUM(f.impressions), 0), 'N2') + '%' AS ctr_link,
    FORMAT(1000.0 * SUM(f.spend) / NULLIF(SUM(f.impressions), 0), 'C', 'es-ES') AS cpm,
    
    -- Métricas adicionales
    COUNT(DISTINCT f.campaign_id) AS active_campaigns,
    COUNT(DISTINCT f.ad_id) AS active_ads,
    
    -- Tendencia (comparación con período anterior)
    CASE 
        WHEN SUM(CASE WHEN d.date >= DATEADD(DAY, -15, GETDATE()) THEN f.spend ELSE 0 END) >
             SUM(CASE WHEN d.date < DATEADD(DAY, -15, GETDATE()) THEN f.spend ELSE 0 END) 
        THEN '📈 Creciente'
        ELSE '📉 Decreciente'
    END AS trend_spend
    
FROM fact_meta_daily f
INNER JOIN dim_date d ON f.date_id = d.date_id
INNER JOIN dim_account a ON f.account_id = a.account_id
INNER JOIN dim_currency curr ON f.currency_id = curr.currency_id
WHERE d.date >= DATEADD(DAY, -30, GETDATE())
GROUP BY a.account_name, curr.currency_code
ORDER BY SUM(f.spend) DESC;

-- =====================================================================================
-- 2. ANÁLISIS DEMOGRÁFICO DETALLADO
-- =====================================================================================

-- Performance por segmento demográfico con ranking
WITH demographic_analysis AS (
    SELECT 
        a.account_name,
        age.age_label,
        g.gender_label,
        SUM(f.spend) AS spend,
        SUM(f.impressions) AS impressions,
        SUM(f.link_clicks) AS link_clicks,
        SUM(f.purchases) AS purchases,
        SUM(f.conversion_value) AS revenue,
        COUNT(DISTINCT f.ad_id) AS unique_ads,
        
        -- KPIs calculados
        SUM(f.conversion_value) / NULLIF(SUM(f.spend), 0) AS roas,
        SUM(f.spend) / NULLIF(SUM(f.purchases), 0) AS cpa,
        100.0 * SUM(f.link_clicks) / NULLIF(SUM(f.impressions), 0) AS ctr,
        1000.0 * SUM(f.spend) / NULLIF(SUM(f.impressions), 0) AS cpm,
        100.0 * SUM(f.purchases) / NULLIF(SUM(f.link_clicks), 0) AS cvr
        
    FROM fact_meta_daily f
    INNER JOIN dim_date d ON f.date_id = d.date_id
    INNER JOIN dim_account a ON f.account_id = a.account_id
    INNER JOIN dim_age age ON f.age_id = age.age_id
    INNER JOIN dim_gender g ON f.gender_id = g.gender_id
    WHERE d.date >= DATEADD(DAY, -60, GETDATE())
      AND g.gender_label != 'Todos'  -- Excluir agregado
    GROUP BY a.account_name, age.age_label, g.gender_label
    HAVING SUM(f.spend) > 50  -- Filtrar segmentos con inversión mínima
)
SELECT 
    *,
    -- Ranking dentro de cada cuenta
    ROW_NUMBER() OVER (PARTITION BY account_name ORDER BY roas DESC) AS roas_rank,
    ROW_NUMBER() OVER (PARTITION BY account_name ORDER BY ctr DESC) AS ctr_rank,
    ROW_NUMBER() OVER (PARTITION BY account_name ORDER BY cvr DESC) AS cvr_rank,
    
    -- Participación en inversión
    FORMAT(100.0 * spend / SUM(spend) OVER (PARTITION BY account_name), 'N1') + '%' AS spend_share,
    
    -- Etiquetas de performance
    CASE 
        WHEN roas >= 4.0 THEN '🟢 Excelente'
        WHEN roas >= 2.0 THEN '🟡 Bueno'
        WHEN roas >= 1.0 THEN '🟠 Regular'
        ELSE '🔴 Bajo'
    END AS roas_label
    
FROM demographic_analysis
ORDER BY account_name, roas DESC;

-- =====================================================================================
-- 3. ANÁLISIS DE AUDIENCIAS - ROI POR PÚBLICO
-- =====================================================================================

-- Rendimiento de audiencias incluidas vs excluidas
WITH audience_performance AS (
    SELECT 
        'Incluida' AS audience_type,
        au.audience_name,
        au.audience_type AS audience_category,
        COUNT(DISTINCT f.adset_id) AS adsets_count,
        COUNT(DISTINCT f.ad_id) AS ads_count,
        SUM(f.spend) AS total_spend,
        SUM(f.conversion_value) AS total_revenue,
        SUM(f.purchases) AS total_purchases,
        SUM(f.impressions) AS total_impressions
    FROM fact_meta_daily f
    INNER JOIN dim_date d ON f.date_id = d.date_id
    INNER JOIN bridge_adset_audience_included b ON f.adset_id = b.adset_id
    INNER JOIN dim_audience au ON b.audience_id = au.audience_id
    WHERE d.date >= DATEADD(DAY, -90, GETDATE())
    GROUP BY au.audience_name, au.audience_type
    
    UNION ALL
    
    SELECT 
        'Excluida' AS audience_type,
        au.audience_name,
        au.audience_type AS audience_category,
        COUNT(DISTINCT f.adset_id) AS adsets_count,
        COUNT(DISTINCT f.ad_id) AS ads_count,
        SUM(f.spend) AS total_spend,
        SUM(f.conversion_value) AS total_revenue,
        SUM(f.purchases) AS total_purchases,
        SUM(f.impressions) AS total_impressions
    FROM fact_meta_daily f
    INNER JOIN dim_date d ON f.date_id = d.date_id
    INNER JOIN bridge_adset_audience_excluded b ON f.adset_id = b.adset_id
    INNER JOIN dim_audience au ON b.audience_id = au.audience_id
    WHERE d.date >= DATEADD(DAY, -90, GETDATE())
    GROUP BY au.audience_name, au.audience_type
)
SELECT 
    audience_type,
    audience_name,
    audience_category,
    adsets_count,
    ads_count,
    FORMAT(total_spend, 'C', 'es-ES') AS spend,
    FORMAT(total_revenue, 'C', 'es-ES') AS revenue,
    FORMAT(total_purchases, 'N0') AS purchases,
    
    -- KPIs
    FORMAT(total_revenue / NULLIF(total_spend, 0), 'N2') AS roas,
    FORMAT(total_spend / NULLIF(total_purchases, 0), 'C', 'es-ES') AS cpa,
    FORMAT(1000.0 * total_spend / NULLIF(total_impressions, 0), 'C', 'es-ES') AS cpm,
    
    -- Clasificación por volumen
    CASE 
        WHEN total_spend >= 5000 THEN '🔥 Alto volumen'
        WHEN total_spend >= 1000 THEN '⭐ Medio volumen'
        WHEN total_spend >= 100 THEN '💡 Bajo volumen'
        ELSE '🔍 Minimal'
    END AS volume_tier
    
FROM audience_performance
WHERE total_spend > 100  -- Filtrar audiencias con inversión mínima
ORDER BY audience_type, total_revenue / NULLIF(total_spend, 0) DESC;

-- =====================================================================================
-- 4. ANÁLISIS TEMPORAL - TENDENCIAS Y ESTACIONALIDAD
-- =====================================================================================

-- Análisis de tendencias por día de semana y hora (simulada)
WITH weekly_patterns AS (
    SELECT 
        d.day_name,
        d.day_of_week,
        COUNT(DISTINCT d.date) AS days_analyzed,
        AVG(daily_spend) AS avg_daily_spend,
        AVG(daily_roas) AS avg_daily_roas,
        AVG(daily_impressions) AS avg_daily_impressions
    FROM (
        SELECT 
            f.date_id,
            SUM(f.spend) AS daily_spend,
            SUM(f.conversion_value) / NULLIF(SUM(f.spend), 0) AS daily_roas,
            SUM(f.impressions) AS daily_impressions
        FROM fact_meta_daily f
        INNER JOIN dim_date d ON f.date_id = d.date_id
        WHERE d.date >= DATEADD(DAY, -90, GETDATE())
        GROUP BY f.date_id
    ) daily_metrics
    INNER JOIN dim_date d ON daily_metrics.date_id = d.date_id
    GROUP BY d.day_name, d.day_of_week
),
weekly_ranking AS (
    SELECT *,
        ROW_NUMBER() OVER (ORDER BY avg_daily_spend DESC) AS spend_rank,
        ROW_NUMBER() OVER (ORDER BY avg_daily_roas DESC) AS roas_rank
    FROM weekly_patterns
)
SELECT 
    day_name,
    FORMAT(avg_daily_spend, 'C', 'es-ES') AS avg_spend,
    FORMAT(avg_daily_roas, 'N2') AS avg_roas,
    FORMAT(avg_daily_impressions, 'N0') AS avg_impressions,
    
    -- Índices vs promedio semanal
    FORMAT(100.0 * avg_daily_spend / AVG(avg_daily_spend) OVER (), 'N0') + '%' AS spend_index,
    FORMAT(100.0 * avg_daily_roas / AVG(avg_daily_roas) OVER (), 'N0') + '%' AS roas_index,
    
    -- Rankings
    CASE spend_rank 
        WHEN 1 THEN '🥇 Mayor gasto'
        WHEN 2 THEN '🥈 Segundo lugar'
        WHEN 3 THEN '🥉 Tercer lugar'
        ELSE CAST(spend_rank AS NVARCHAR(2)) + '°'
    END AS spend_position,
    
    -- Recomendaciones
    CASE 
        WHEN avg_daily_roas > AVG(avg_daily_roas) OVER () * 1.1 THEN '✅ Día óptimo'
        WHEN avg_daily_roas < AVG(avg_daily_roas) OVER () * 0.9 THEN '⚠️ Revisar estrategia'
        ELSE '📊 Promedio'
    END AS recommendation
    
FROM weekly_ranking
ORDER BY day_of_week;

-- =====================================================================================
-- 5. ANÁLISIS DE EVOLUCIÓN (SCD TIPO 2)
-- =====================================================================================

-- Tracking de cambios en campañas y su impacto en performance
WITH campaign_evolution AS (
    SELECT 
        c.campaign_natural_key,
        c.campaign_name,
        c.scd_version,
        FORMAT(c.scd_valid_from, 'yyyy-MM-dd') AS version_start,
        FORMAT(ISNULL(c.scd_valid_to, GETDATE()), 'yyyy-MM-dd') AS version_end,
        DATEDIFF(DAY, c.scd_valid_from, ISNULL(c.scd_valid_to, GETDATE())) AS days_active,
        
        -- Configuración de la versión
        o.objective_name,
        c.budget,
        bt.budget_type_name,
        st.status_name,
        
        -- Performance de la versión
        ISNULL(SUM(f.spend), 0) AS version_spend,
        ISNULL(SUM(f.conversion_value), 0) AS version_revenue,
        ISNULL(SUM(f.purchases), 0) AS version_purchases,
        COUNT(DISTINCT f.date_id) AS days_with_data
        
    FROM dim_campaign c
    LEFT JOIN dim_objective o ON c.objective_id = o.objective_id
    LEFT JOIN dim_budget_type bt ON c.budget_type_id = bt.budget_type_id
    LEFT JOIN dim_status st ON c.status_id = st.status_id
    LEFT JOIN fact_meta_daily f ON c.campaign_id = f.campaign_id
    WHERE c.scd_version > 1  -- Solo campañas que han evolucionado
    GROUP BY c.campaign_natural_key, c.campaign_name, c.scd_version,
             c.scd_valid_from, c.scd_valid_to, o.objective_name,
             c.budget, bt.budget_type_name, st.status_name
),
version_comparison AS (
    SELECT *,
        version_revenue / NULLIF(version_spend, 0) AS version_roas,
        version_spend / NULLIF(version_purchases, 0) AS version_cpa,
        
        -- Comparación con versión anterior
        LAG(version_spend) OVER (PARTITION BY campaign_natural_key ORDER BY scd_version) AS prev_spend,
        LAG(version_revenue / NULLIF(version_spend, 0)) OVER (PARTITION BY campaign_natural_key ORDER BY scd_version) AS prev_roas,
        
        -- Cambios detectados
        CASE 
            WHEN LAG(objective_name) OVER (PARTITION BY campaign_natural_key ORDER BY scd_version) != objective_name 
            THEN '🎯 Objetivo'
            WHEN LAG(budget) OVER (PARTITION BY campaign_natural_key ORDER BY scd_version) != budget 
            THEN '💰 Presupuesto'
            WHEN LAG(status_name) OVER (PARTITION BY campaign_natural_key ORDER BY scd_version) != status_name 
            THEN '⏸️ Estado'
            ELSE '🔧 Otros'
        END AS change_type
        
    FROM campaign_evolution
)
SELECT 
    campaign_name,
    scd_version,
    version_start,
    version_end,
    days_active,
    change_type,
    objective_name,
    FORMAT(budget, 'C', 'es-ES') AS budget,
    status_name,
    
    -- Performance metrics
    FORMAT(version_spend, 'C', 'es-ES') AS spend,
    FORMAT(version_revenue, 'C', 'es-ES') AS revenue,
    FORMAT(version_roas, 'N2') AS roas,
    FORMAT(version_cpa, 'C', 'es-ES') AS cpa,
    
    -- Comparación con versión anterior
    CASE 
        WHEN prev_roas IS NULL THEN '🆕 Primera versión'
        WHEN version_roas > prev_roas * 1.1 THEN '📈 Mejoró +10%'
        WHEN version_roas < prev_roas * 0.9 THEN '📉 Empeoró -10%'
        ELSE '📊 Similar'
    END AS roas_evolution,
    
    FORMAT((version_roas - prev_roas) / NULLIF(prev_roas, 0) * 100, 'N1') + '%' AS roas_change
    
FROM version_comparison
WHERE version_spend > 0  -- Solo versiones con datos
ORDER BY campaign_natural_key, scd_version;

-- =====================================================================================
-- 6. ANÁLISIS DE VIDEO PERFORMANCE
-- =====================================================================================

-- Comparación video vs contenido estático con métricas de engagement
WITH creative_type_analysis AS (
    SELECT 
        ad.ad_name,
        CASE 
            WHEN SUM(f.video_3s) > 0 THEN 'Video'
            ELSE 'Estático'
        END AS creative_type,
        
        -- Métricas básicas
        SUM(f.spend) AS spend,
        SUM(f.impressions) AS impressions,
        SUM(f.link_clicks) AS link_clicks,
        SUM(f.purchases) AS purchases,
        SUM(f.conversion_value) AS revenue,
        
        -- Métricas de video específicas
        SUM(f.video_3s) AS video_views_3s,
        SUM(f.video_25) AS video_views_25,
        SUM(f.video_50) AS video_views_50,
        SUM(f.video_75) AS video_views_75,
        SUM(f.video_100) AS video_views_100,
        SUM(f.thruplays) AS thruplays,
        AVG(f.avg_watch_time) AS avg_watch_time,
        
        -- Engagement
        SUM(f.post_reactions) AS reactions,
        SUM(f.post_comments) AS comments,
        SUM(f.post_shares) AS shares
        
    FROM fact_meta_daily f
    INNER JOIN dim_date d ON f.date_id = d.date_id
    INNER JOIN dim_ad ad ON f.ad_id = ad.ad_id
    WHERE d.date >= DATEADD(DAY, -60, GETDATE())
    GROUP BY ad.ad_name
    HAVING SUM(f.spend) > 100  -- Filtro de inversión mínima
),
performance_by_type AS (
    SELECT 
        creative_type,
        COUNT(*) AS ad_count,
        SUM(spend) AS total_spend,
        SUM(revenue) AS total_revenue,
        SUM(impressions) AS total_impressions,
        SUM(link_clicks) AS total_link_clicks,
        SUM(purchases) AS total_purchases,
        
        -- Video metrics (solo para videos)
        SUM(video_views_3s) AS total_video_views,
        SUM(video_views_100) AS total_completions,
        AVG(CASE WHEN creative_type = 'Video' THEN avg_watch_time END) AS avg_watch_time,
        
        -- Engagement
        SUM(reactions + comments + shares) AS total_engagement
        
    FROM creative_type_analysis
    GROUP BY creative_type
)
SELECT 
    creative_type,
    ad_count,
    FORMAT(total_spend, 'C', 'es-ES') AS spend,
    FORMAT(total_revenue, 'C', 'es-ES') AS revenue,
    FORMAT(total_impressions, 'N0') AS impressions,
    
    -- KPIs principales
    FORMAT(total_revenue / NULLIF(total_spend, 0), 'N2') AS roas,
    FORMAT(total_spend / NULLIF(total_purchases, 0), 'C', 'es-ES') AS cpa,
    FORMAT(100.0 * total_link_clicks / NULLIF(total_impressions, 0), 'N2') + '%' AS ctr,
    
    -- Métricas específicas de video
    CASE 
        WHEN creative_type = 'Video' THEN FORMAT(100.0 * total_completions / NULLIF(total_video_views, 0), 'N1') + '%'
        ELSE 'N/A'
    END AS completion_rate,
    
    CASE 
        WHEN creative_type = 'Video' THEN FORMAT(avg_watch_time, 'N1') + 's'
        ELSE 'N/A'
    END AS avg_watch_time,
    
    -- Engagement rate
    FORMAT(total_engagement / NULLIF(total_impressions, 0) * 1000, 'N2') AS engagement_per_1k_impr,
    
    -- Comparación relativa
    FORMAT(100.0 * (total_revenue / NULLIF(total_spend, 0)) / 
           AVG(total_revenue / NULLIF(total_spend, 0)) OVER (), 'N0') + '%' AS roas_vs_avg
    
FROM performance_by_type
ORDER BY total_revenue / NULLIF(total_spend, 0) DESC;

-- =====================================================================================
-- 7. COHORT ANALYSIS - PERFORMANCE POR PERÍODO DE LANZAMIENTO
-- =====================================================================================

-- Análisis de cohorte por mes de lanzamiento de anuncios
WITH ad_cohorts AS (
    SELECT 
        ad.ad_id,
        ad.ad_name,
        MIN(d.date) AS launch_date,
        FORMAT(MIN(d.date), 'yyyy-MM') AS launch_cohort
    FROM fact_meta_daily f
    INNER JOIN dim_ad ad ON f.ad_id = ad.ad_id
    INNER JOIN dim_date d ON f.date_id = d.date_id
    GROUP BY ad.ad_id, ad.ad_name
),
cohort_performance AS (
    SELECT 
        ac.launch_cohort,
        DATEDIFF(DAY, ac.launch_date, d.date) AS days_since_launch,
        
        COUNT(DISTINCT f.ad_id) AS active_ads,
        SUM(f.spend) AS cohort_spend,
        SUM(f.conversion_value) AS cohort_revenue,
        SUM(f.purchases) AS cohort_purchases,
        SUM(f.impressions) AS cohort_impressions
        
    FROM fact_meta_daily f
    INNER JOIN dim_date d ON f.date_id = d.date_id
    INNER JOIN ad_cohorts ac ON f.ad_id = ac.ad_id
    WHERE DATEDIFF(DAY, ac.launch_date, d.date) BETWEEN 0 AND 30  -- Primeros 30 días
      AND ac.launch_date >= DATEADD(MONTH, -6, GETDATE())  -- Últimos 6 meses
    GROUP BY ac.launch_cohort, DATEDIFF(DAY, ac.launch_date, d.date)
),
cohort_summary AS (
    SELECT 
        launch_cohort,
        SUM(cohort_spend) AS total_spend_30d,
        SUM(cohort_revenue) AS total_revenue_30d,
        SUM(cohort_purchases) AS total_purchases_30d,
        AVG(active_ads) AS avg_active_ads,
        
        -- Performance día 1 vs día 30
        MAX(CASE WHEN days_since_launch = 0 THEN cohort_spend END) AS day1_spend,
        MAX(CASE WHEN days_since_launch = 29 THEN cohort_spend END) AS day30_spend
        
    FROM cohort_performance
    GROUP BY launch_cohort
)
SELECT 
    launch_cohort,
    FORMAT(total_spend_30d, 'C', 'es-ES') AS spend_30d,
    FORMAT(total_revenue_30d, 'C', 'es-ES') AS revenue_30d,
    FORMAT(total_purchases_30d, 'N0') AS purchases_30d,
    FORMAT(avg_active_ads, 'N0') AS avg_ads,
    
    -- KPIs de cohorte
    FORMAT(total_revenue_30d / NULLIF(total_spend_30d, 0), 'N2') AS roas_30d,
    FORMAT(total_spend_30d / NULLIF(total_purchases_30d, 0), 'C', 'es-ES') AS cpa_30d,
    
    -- Velocidad de escalado (día 1 vs día 30)
    CASE 
        WHEN day30_spend > day1_spend * 2 THEN '🚀 Escalado rápido'
        WHEN day30_spend > day1_spend * 1.2 THEN '📈 Escalado gradual'
        WHEN day30_spend < day1_spend * 0.8 THEN '📉 Desescalado'
        ELSE '📊 Estable'
    END AS scaling_pattern,
    
    -- Ranking de cohortes
    ROW_NUMBER() OVER (ORDER BY total_revenue_30d / NULLIF(total_spend_30d, 0) DESC) AS roas_rank
    
FROM cohort_summary
WHERE total_spend_30d > 500  -- Filtrar cohortes con inversión mínima
ORDER BY launch_cohort DESC;

-- =====================================================================================
-- 8. ALERTAS Y ANOMALÍAS
-- =====================================================================================

-- Detección de anomalías en performance diaria
WITH daily_metrics AS (
    SELECT 
        d.date,
        a.account_name,
        SUM(f.spend) AS daily_spend,
        SUM(f.conversion_value) / NULLIF(SUM(f.spend), 0) AS daily_roas,
        SUM(f.impressions) AS daily_impressions,
        100.0 * SUM(f.link_clicks) / NULLIF(SUM(f.impressions), 0) AS daily_ctr
    FROM fact_meta_daily f
    INNER JOIN dim_date d ON f.date_id = d.date_id
    INNER JOIN dim_account a ON f.account_id = a.account_id
    WHERE d.date >= DATEADD(DAY, -30, GETDATE())
    GROUP BY d.date, a.account_name
),
baseline_metrics AS (
    SELECT 
        account_name,
        AVG(daily_spend) AS avg_spend,
        STDEV(daily_spend) AS stdev_spend,
        AVG(daily_roas) AS avg_roas,
        STDEV(daily_roas) AS stdev_roas,
        AVG(daily_ctr) AS avg_ctr,
        STDEV(daily_ctr) AS stdev_ctr
    FROM daily_metrics
    WHERE date <= DATEADD(DAY, -7, GETDATE())  -- Baseline: hace 1 semana o más
    GROUP BY account_name
),
anomaly_detection AS (
    SELECT 
        dm.*,
        bm.avg_spend,
        bm.avg_roas,
        bm.avg_ctr,
        
        -- Z-scores (desviaciones estándar del promedio)
        (dm.daily_spend - bm.avg_spend) / NULLIF(bm.stdev_spend, 0) AS spend_zscore,
        (dm.daily_roas - bm.avg_roas) / NULLIF(bm.stdev_roas, 0) AS roas_zscore,
        (dm.daily_ctr - bm.avg_ctr) / NULLIF(bm.stdev_ctr, 0) AS ctr_zscore
        
    FROM daily_metrics dm
    INNER JOIN baseline_metrics bm ON dm.account_name = bm.account_name
    WHERE dm.date > DATEADD(DAY, -7, GETDATE())  -- Solo últimos 7 días
)
SELECT 
    date,
    account_name,
    FORMAT(daily_spend, 'C', 'es-ES') AS spend,
    FORMAT(daily_roas, 'N2') AS roas,
    FORMAT(daily_ctr, 'N2') + '%' AS ctr,
    
    -- Alertas basadas en Z-score (|z| > 2 = anómalo)
    CASE 
        WHEN ABS(spend_zscore) > 2 THEN 
            CASE WHEN spend_zscore > 0 THEN '🔥 Gasto muy alto' ELSE '❄️ Gasto muy bajo' END
        ELSE '✅ Gasto normal'
    END AS spend_alert,
    
    CASE 
        WHEN ABS(roas_zscore) > 2 THEN 
            CASE WHEN roas_zscore > 0 THEN '🎯 ROAS excepcional' ELSE '⚠️ ROAS bajo' END
        ELSE '✅ ROAS normal'
    END AS roas_alert,
    
    CASE 
        WHEN ABS(ctr_zscore) > 2 THEN 
            CASE WHEN ctr_zscore > 0 THEN '📈 CTR alto' ELSE '📉 CTR bajo' END
        ELSE '✅ CTR normal'
    END AS ctr_alert,
    
    -- Prioridad de alerta
    CASE 
        WHEN ABS(roas_zscore) > 2 AND roas_zscore < 0 THEN '🚨 Alta'
        WHEN ABS(spend_zscore) > 2 OR ABS(ctr_zscore) > 2 THEN '⚠️ Media'
        ELSE '✅ Baja'
    END AS alert_priority
    
FROM anomaly_detection
WHERE ABS(spend_zscore) > 1.5 OR ABS(roas_zscore) > 1.5 OR ABS(ctr_zscore) > 1.5
ORDER BY date DESC, ABS(roas_zscore) DESC;

-- =====================================================================================
-- 9. EXPORTACIÓN PARA REPORTES EJECUTIVOS
-- =====================================================================================

-- Query para dashboard ejecutivo semanal (Power BI / Excel)
DECLARE @report_date DATE = GETDATE();
DECLARE @start_date DATE = DATEADD(DAY, -7, @report_date);

SELECT 
    'RESUMEN EJECUTIVO SEMANAL' AS report_title,
    FORMAT(@start_date, 'dd/MM/yyyy') + ' - ' + FORMAT(@report_date, 'dd/MM/yyyy') AS period,
    
    -- KPIs principales
    FORMAT(SUM(f.spend), 'C', 'es-ES') AS total_inversion,
    FORMAT(SUM(f.conversion_value), 'C', 'es-ES') AS total_ingresos,
    FORMAT(SUM(f.conversion_value) / NULLIF(SUM(f.spend), 0), 'N2') AS roas_general,
    FORMAT(SUM(f.purchases), 'N0') AS total_conversiones,
    
    -- Distribución por cuenta
    (SELECT STRING_AGG(
        account_name + ': ' + FORMAT(account_spend, 'C', 'es-ES'), 
        ' | '
    ) FROM (
        SELECT TOP 3
            a.account_name,
            SUM(f2.spend) AS account_spend
        FROM fact_meta_daily f2
        INNER JOIN dim_account a ON f2.account_id = a.account_id
        INNER JOIN dim_date d2 ON f2.date_id = d2.date_id
        WHERE d2.date BETWEEN @start_date AND @report_date
        GROUP BY a.account_name
        ORDER BY SUM(f2.spend) DESC
    ) top_accounts) AS top_cuentas,
    
    -- Mejor segmento demográfico
    (SELECT TOP 1
        age.age_label + ' ' + g.gender_label + ' (ROAS: ' + 
        FORMAT(SUM(f3.conversion_value) / NULLIF(SUM(f3.spend), 0), 'N2') + ')'
    FROM fact_meta_daily f3
    INNER JOIN dim_age age ON f3.age_id = age.age_id
    INNER JOIN dim_gender g ON f3.gender_id = g.gender_id
    INNER JOIN dim_date d3 ON f3.date_id = d3.date_id
    WHERE d3.date BETWEEN @start_date AND @report_date
      AND g.gender_label != 'Todos'
    GROUP BY age.age_label, g.gender_label
    HAVING SUM(f3.spend) > 100
    ORDER BY SUM(f3.conversion_value) / NULLIF(SUM(f3.spend), 0) DESC
    ) AS mejor_segmento,
    
    -- Conteo de campañas activas
    COUNT(DISTINCT f.campaign_id) AS campanas_activas,
    COUNT(DISTINCT f.ad_id) AS anuncios_activos

FROM fact_meta_daily f
INNER JOIN dim_date d ON f.date_id = d.date_id
WHERE d.date BETWEEN @start_date AND @report_date;

PRINT '✅ Queries analíticas cargadas exitosamente';
PRINT 'Personalizar fechas y filtros según necesidades específicas';
PRINT 'Optimizar WHERE clauses para mejor performance en datasets grandes';