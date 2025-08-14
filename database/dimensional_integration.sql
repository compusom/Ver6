-- =====================================================================================
-- INTEGRACIÓN DIMENSIONAL CON SISTEMA EXISTENTE
-- Estrategia híbrida que mantiene compatibilidad y agrega capacidades analíticas
-- =====================================================================================

-- =====================================================================================
-- 1. NUEVAS TABLAS DIMENSIONALES (Conviven con las existentes)
-- =====================================================================================

-- Tabla de control para migration y estado dimensional
CREATE TABLE IF NOT EXISTS dw_control (
    control_id INTEGER PRIMARY KEY AUTOINCREMENT,
    system_version TEXT NOT NULL,
    dimensional_enabled BOOLEAN DEFAULT 0,
    last_migration_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    migration_status TEXT DEFAULT 'pending' -- 'pending', 'in_progress', 'completed', 'failed'
);

-- Tabla de lotes ETL para tracking
CREATE TABLE IF NOT EXISTS etl_batches (
    batch_id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_name TEXT NOT NULL,
    source_type TEXT NOT NULL, -- 'excel', 'api', 'manual'
    file_hash TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    records_processed INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    error_message TEXT
);

-- =====================================================================================
-- 2. DIMENSIONAL TABLES (Optimizadas para SQLite)
-- =====================================================================================

-- Dimensión Fecha (poblada automáticamente)
CREATE TABLE IF NOT EXISTS dim_date (
    date_id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE UNIQUE NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    week_of_year INTEGER NOT NULL,
    is_weekend BOOLEAN NOT NULL,
    quarter INTEGER NOT NULL,
    month_name TEXT NOT NULL,
    day_name TEXT NOT NULL
);

-- Dimensión Moneda
CREATE TABLE IF NOT EXISTS dim_currency (
    currency_id INTEGER PRIMARY KEY AUTOINCREMENT,
    currency_code TEXT UNIQUE NOT NULL,
    currency_name TEXT,
    symbol TEXT
);

-- Dimensión Cuenta (evolución de clients)
CREATE TABLE IF NOT EXISTS dim_account (
    account_id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_name TEXT UNIQUE NOT NULL,
    currency_id INTEGER,
    legacy_client_id TEXT, -- Referencia al ID de clients existente
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (currency_id) REFERENCES dim_currency(currency_id)
);

-- Dimensión Objetivo
CREATE TABLE IF NOT EXISTS dim_objective (
    objective_id INTEGER PRIMARY KEY AUTOINCREMENT,
    objective_name TEXT UNIQUE NOT NULL,
    objective_category TEXT
);

-- Dimensión Tipo de Presupuesto
CREATE TABLE IF NOT EXISTS dim_budget_type (
    budget_type_id INTEGER PRIMARY KEY AUTOINCREMENT,
    budget_type_name TEXT UNIQUE NOT NULL
);

-- Dimensión Estado (scope: campaign, adset, ad)
CREATE TABLE IF NOT EXISTS dim_status (
    status_id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope TEXT NOT NULL, -- 'campaign', 'adset', 'ad'
    status_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    UNIQUE(scope, status_name)
);

-- Dimensión URL
CREATE TABLE IF NOT EXISTS dim_url (
    url_id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_url TEXT UNIQUE NOT NULL,
    domain TEXT,
    path TEXT
);

-- Dimensión Edad
CREATE TABLE IF NOT EXISTS dim_age (
    age_id INTEGER PRIMARY KEY AUTOINCREMENT,
    age_label TEXT UNIQUE NOT NULL,
    age_min INTEGER,
    age_max INTEGER,
    sort_order INTEGER
);

-- Dimensión Género
CREATE TABLE IF NOT EXISTS dim_gender (
    gender_id INTEGER PRIMARY KEY AUTOINCREMENT,
    gender_label TEXT UNIQUE NOT NULL,
    gender_code TEXT,
    sort_order INTEGER
);

-- Dimensión Campaña (SCD Tipo 2)
CREATE TABLE IF NOT EXISTS dim_campaign (
    campaign_id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    campaign_name TEXT NOT NULL,
    campaign_natural_key TEXT NOT NULL, -- account_name|campaign_name para tracking
    objective_id INTEGER,
    budget DECIMAL(18,2),
    budget_type_id INTEGER,
    status_id INTEGER,
    
    -- SCD Tipo 2 fields
    scd_valid_from DATE DEFAULT '1900-01-01',
    scd_valid_to DATE DEFAULT '9999-12-31',
    scd_is_current BOOLEAN DEFAULT 1,
    scd_version INTEGER DEFAULT 1,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (account_id) REFERENCES dim_account(account_id),
    FOREIGN KEY (objective_id) REFERENCES dim_objective(objective_id),
    FOREIGN KEY (budget_type_id) REFERENCES dim_budget_type(budget_type_id),
    FOREIGN KEY (status_id) REFERENCES dim_status(status_id)
);

-- Dimensión AdSet (SCD Tipo 2)
CREATE TABLE IF NOT EXISTS dim_adset (
    adset_id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    adset_name TEXT NOT NULL,
    adset_natural_key TEXT NOT NULL, -- account_name|campaign_name|adset_name
    status_id INTEGER,
    
    -- SCD Tipo 2 fields
    scd_valid_from DATE DEFAULT '1900-01-01',
    scd_valid_to DATE DEFAULT '9999-12-31',
    scd_is_current BOOLEAN DEFAULT 1,
    scd_version INTEGER DEFAULT 1,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (campaign_id) REFERENCES dim_campaign(campaign_id),
    FOREIGN KEY (status_id) REFERENCES dim_status(status_id)
);

-- Dimensión Ad (evolución de ads, SCD Tipo 2)
CREATE TABLE IF NOT EXISTS dim_ad (
    ad_id INTEGER PRIMARY KEY AUTOINCREMENT,
    adset_id INTEGER NOT NULL,
    ad_name TEXT NOT NULL,
    ad_name_norm TEXT NOT NULL, -- Normalizado para matching
    ad_natural_key TEXT NOT NULL, -- account_name|campaign_name|adset_name|ad_name_norm
    status_id INTEGER,
    landing_url_id INTEGER,
    ad_preview_link TEXT,
    creative_thumb_url TEXT,
    
    -- Campos de compatibilidad con ads existente
    legacy_ad_id TEXT, -- Referencia al ID de ads existente
    
    -- SCD Tipo 2 fields
    scd_valid_from DATE DEFAULT '1900-01-01',
    scd_valid_to DATE DEFAULT '9999-12-31',
    scd_is_current BOOLEAN DEFAULT 1,
    scd_version INTEGER DEFAULT 1,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (adset_id) REFERENCES dim_adset(adset_id),
    FOREIGN KEY (status_id) REFERENCES dim_status(status_id),
    FOREIGN KEY (landing_url_id) REFERENCES dim_url(url_id)
);

-- Dimensión Audiencia
CREATE TABLE IF NOT EXISTS dim_audience (
    audience_id INTEGER PRIMARY KEY AUTOINCREMENT,
    audience_name TEXT UNIQUE NOT NULL,
    audience_type TEXT, -- 'custom', 'lookalike', 'interest', etc.
    description TEXT
);

-- =====================================================================================
-- 3. BRIDGES (Relaciones Many-to-Many)
-- =====================================================================================

-- Bridge: AdSet - Audiencias Incluidas
CREATE TABLE IF NOT EXISTS bridge_adset_audience_included (
    adset_id INTEGER NOT NULL,
    audience_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (adset_id, audience_id),
    FOREIGN KEY (adset_id) REFERENCES dim_adset(adset_id),
    FOREIGN KEY (audience_id) REFERENCES dim_audience(audience_id)
);

-- Bridge: AdSet - Audiencias Excluidas
CREATE TABLE IF NOT EXISTS bridge_adset_audience_excluded (
    adset_id INTEGER NOT NULL,
    audience_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (adset_id, audience_id),
    FOREIGN KEY (adset_id) REFERENCES dim_adset(adset_id),
    FOREIGN KEY (audience_id) REFERENCES dim_audience(audience_id)
);

-- =====================================================================================
-- 4. FACT TABLE (Convive con performance_records)
-- =====================================================================================

-- Fact Table Principal (grano: día + cuenta + campaña + adset + ad + edad + género)
CREATE TABLE IF NOT EXISTS fact_meta_daily (
    fact_id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Claves dimensionales
    date_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    campaign_id INTEGER NOT NULL,
    adset_id INTEGER NOT NULL,
    ad_id INTEGER NOT NULL,
    age_id INTEGER NOT NULL,
    gender_id INTEGER NOT NULL,
    currency_id INTEGER,
    
    -- Métricas atómicas principales
    spend DECIMAL(18,4) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    frequency DECIMAL(12,6) DEFAULT 0,
    clicks_all INTEGER DEFAULT 0,
    link_clicks INTEGER DEFAULT 0,
    landing_page_views INTEGER DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    conversion_value DECIMAL(18,4) DEFAULT 0,
    
    -- Métricas de video
    video_3s INTEGER DEFAULT 0,
    video_25 INTEGER DEFAULT 0,
    video_50 INTEGER DEFAULT 0,
    video_75 INTEGER DEFAULT 0,
    video_95 INTEGER DEFAULT 0,
    video_100 INTEGER DEFAULT 0,
    thruplays INTEGER DEFAULT 0,
    avg_watch_time DECIMAL(12,4) DEFAULT 0,
    
    -- Métricas de embudo
    add_to_cart INTEGER DEFAULT 0,
    initiate_checkout INTEGER DEFAULT 0,
    
    -- Métricas de engagement
    post_interactions INTEGER DEFAULT 0,
    post_reactions INTEGER DEFAULT 0,
    post_comments INTEGER DEFAULT 0,
    post_shares INTEGER DEFAULT 0,
    page_likes INTEGER DEFAULT 0,
    
    -- Métricas propietarias (si existen)
    atencion DECIMAL(15,4) DEFAULT 0,
    interes DECIMAL(15,4) DEFAULT 0,
    deseo DECIMAL(15,4) DEFAULT 0,
    
    -- Auditoría
    batch_id INTEGER,
    legacy_record_id TEXT, -- Referencia al record original
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint de unicidad para el grano
    UNIQUE(date_id, account_id, campaign_id, adset_id, ad_id, age_id, gender_id),
    
    FOREIGN KEY (date_id) REFERENCES dim_date(date_id),
    FOREIGN KEY (account_id) REFERENCES dim_account(account_id),
    FOREIGN KEY (campaign_id) REFERENCES dim_campaign(campaign_id),
    FOREIGN KEY (adset_id) REFERENCES dim_adset(adset_id),
    FOREIGN KEY (ad_id) REFERENCES dim_ad(ad_id),
    FOREIGN KEY (age_id) REFERENCES dim_age(age_id),
    FOREIGN KEY (gender_id) REFERENCES dim_gender(gender_id),
    FOREIGN KEY (currency_id) REFERENCES dim_currency(currency_id),
    FOREIGN KEY (batch_id) REFERENCES etl_batches(batch_id)
);

-- =====================================================================================
-- 5. ÍNDICES PARA PERFORMANCE
-- =====================================================================================

-- Índices en fact table
CREATE INDEX IF NOT EXISTS idx_fact_meta_daily_date_account ON fact_meta_daily(date_id, account_id);
CREATE INDEX IF NOT EXISTS idx_fact_meta_daily_campaign_date ON fact_meta_daily(campaign_id, date_id);
CREATE INDEX IF NOT EXISTS idx_fact_meta_daily_adset_date ON fact_meta_daily(adset_id, date_id);
CREATE INDEX IF NOT EXISTS idx_fact_meta_daily_ad_date ON fact_meta_daily(ad_id, date_id);
CREATE INDEX IF NOT EXISTS idx_fact_meta_daily_demographics ON fact_meta_daily(age_id, gender_id);
CREATE INDEX IF NOT EXISTS idx_fact_meta_daily_batch ON fact_meta_daily(batch_id);

-- Índices en dimensiones para SCD
CREATE INDEX IF NOT EXISTS idx_dim_campaign_natural_current ON dim_campaign(campaign_natural_key, scd_is_current);
CREATE INDEX IF NOT EXISTS idx_dim_adset_natural_current ON dim_adset(adset_natural_key, scd_is_current);
CREATE INDEX IF NOT EXISTS idx_dim_ad_natural_current ON dim_ad(ad_natural_key, scd_is_current);

-- Índices para búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_dim_ad_name_norm ON dim_ad(ad_name_norm);
CREATE INDEX IF NOT EXISTS idx_dim_account_legacy ON dim_account(legacy_client_id);
CREATE INDEX IF NOT EXISTS idx_etl_batches_status ON etl_batches(status, started_at);

-- =====================================================================================
-- 6. VISTAS DE COMPATIBILIDAD
-- =====================================================================================

-- Vista que simula la tabla clients existente
CREATE VIEW IF NOT EXISTS v_clients_compatibility AS
SELECT 
    CAST(account_id AS TEXT) as id,
    account_name as name,
    '' as token, -- Vacío por seguridad
    c.currency_code as currency,
    '' as logo, -- Se mantiene vacío, se puede agregar campo después
    da.created_at
FROM dim_account da
LEFT JOIN dim_currency c ON da.currency_id = c.currency_id;

-- Vista que simula metricas con ratios calculados
CREATE VIEW IF NOT EXISTS v_performance_metrics AS
SELECT 
    f.fact_id,
    d.date,
    a.account_name,
    c.campaign_name,
    ads.adset_name,
    ad.ad_name,
    age.age_label as age,
    g.gender_label as gender,
    
    -- Métricas base
    f.spend,
    f.impressions,
    f.reach,
    f.frequency,
    f.clicks_all,
    f.link_clicks,
    f.landing_page_views,
    f.purchases,
    f.conversion_value,
    
    -- Ratios calculados (como en el sistema original)
    CASE WHEN f.impressions > 0 THEN ROUND(f.clicks_all * 100.0 / f.impressions, 4) ELSE 0 END as ctr,
    CASE WHEN f.impressions > 0 THEN ROUND(f.spend * 1000.0 / f.impressions, 4) ELSE 0 END as cpm,
    CASE WHEN f.clicks_all > 0 THEN ROUND(f.spend / f.clicks_all, 4) ELSE 0 END as cpc,
    CASE WHEN f.spend > 0 THEN ROUND(f.conversion_value / f.spend, 4) ELSE 0 END as roas,
    CASE WHEN f.purchases > 0 THEN ROUND(f.spend / f.purchases, 4) ELSE 0 END as cpa,
    CASE WHEN f.link_clicks > 0 THEN ROUND(f.landing_page_views * 100.0 / f.link_clicks, 4) ELSE 0 END as lp_view_rate,
    CASE WHEN f.landing_page_views > 0 THEN ROUND(f.purchases * 100.0 / f.landing_page_views, 4) ELSE 0 END as conversion_rate,
    
    -- Video metrics
    f.video_3s,
    f.video_100,
    f.thruplays,
    f.avg_watch_time,
    CASE WHEN f.video_3s > 0 THEN ROUND(f.video_100 * 100.0 / f.video_3s, 4) ELSE 0 END as video_completion_rate,
    
    -- Meta info
    curr.currency_code as currency,
    f.batch_id,
    f.created_at
    
FROM fact_meta_daily f
JOIN dim_date d ON f.date_id = d.date_id
JOIN dim_account a ON f.account_id = a.account_id
JOIN dim_campaign c ON f.campaign_id = c.campaign_id
JOIN dim_adset ads ON f.adset_id = ads.adset_id
JOIN dim_ad ad ON f.ad_id = ad.ad_id
JOIN dim_age age ON f.age_id = age.age_id
JOIN dim_gender g ON f.gender_id = g.gender_id
LEFT JOIN dim_currency curr ON f.currency_id = curr.currency_id;

-- Vista agregada por anuncio (compatible con PerformanceView actual)
CREATE VIEW IF NOT EXISTS v_ad_performance_summary AS
SELECT 
    a.account_name,
    c.campaign_name,
    ads.adset_name,
    ad.ad_name,
    ad.ad_name_norm,
    
    -- Métricas agregadas
    SUM(f.spend) as spend,
    SUM(f.impressions) as impressions,
    SUM(f.reach) as reach,
    AVG(f.frequency) as frequency,
    SUM(f.clicks_all) as clicks_all,
    SUM(f.link_clicks) as link_clicks,
    SUM(f.landing_page_views) as landing_page_views,
    SUM(f.purchases) as purchases,
    SUM(f.conversion_value) as conversion_value,
    
    -- Estados actuales
    cs.status_name as campaign_status,
    adss.status_name as adset_status,
    ads_status.status_name as ad_status,
    
    -- KPIs calculados
    CASE WHEN SUM(f.impressions) > 0 THEN ROUND(SUM(f.link_clicks) * 100.0 / SUM(f.impressions), 4) ELSE 0 END as ctr_link,
    CASE WHEN SUM(f.spend) > 0 THEN ROUND(SUM(f.conversion_value) / SUM(f.spend), 4) ELSE 0 END as roas,
    CASE WHEN SUM(f.purchases) > 0 THEN ROUND(SUM(f.spend) / SUM(f.purchases), 4) ELSE 0 END as cpa,
    CASE WHEN SUM(f.impressions) > 0 THEN ROUND(SUM(f.spend) * 1000.0 / SUM(f.impressions), 4) ELSE 0 END as cpm,
    
    -- Metadata
    curr.currency_code as currency,
    COUNT(DISTINCT f.date_id) as days_active,
    MIN(d.date) as first_active_date,
    MAX(d.date) as last_active_date,
    ad.ad_preview_link,
    ad.creative_thumb_url,
    
    -- Compatibilidad con sistema existente
    CASE WHEN cs.status_name = 'ACTIVE' THEN 'active' ELSE 'inactive' END as adDelivery,
    CASE WHEN SUM(f.impressions) > 0 THEN 1 ELSE 0 END as hasImpressions
    
FROM fact_meta_daily f
JOIN dim_date d ON f.date_id = d.date_id
JOIN dim_account a ON f.account_id = a.account_id
JOIN dim_campaign c ON f.campaign_id = c.campaign_id AND c.scd_is_current = 1
JOIN dim_adset ads ON f.adset_id = ads.adset_id AND ads.scd_is_current = 1
JOIN dim_ad ad ON f.ad_id = ad.ad_id AND ad.scd_is_current = 1
LEFT JOIN dim_status cs ON c.status_id = cs.status_id
LEFT JOIN dim_status adss ON ads.status_id = adss.status_id  
LEFT JOIN dim_status ads_status ON ad.status_id = ads_status.status_id
LEFT JOIN dim_currency curr ON f.currency_id = curr.currency_id
GROUP BY a.account_name, c.campaign_name, ads.adset_name, ad.ad_name, ad.ad_name_norm,
         cs.status_name, adss.status_name, ads_status.status_name, curr.currency_code,
         ad.ad_preview_link, ad.creative_thumb_url;

-- =====================================================================================
-- 7. POBLADO INICIAL DE DIMENSIONES DE REFERENCIA
-- =====================================================================================

-- Poblar dim_currency
INSERT OR IGNORE INTO dim_currency (currency_code, currency_name, symbol) VALUES
('EUR', 'Euro', '€'),
('USD', 'US Dollar', '$'),
('GBP', 'British Pound', '£'),
('CAD', 'Canadian Dollar', 'C$'),
('AUD', 'Australian Dollar', 'A$'),
('MXN', 'Mexican Peso', '$'),
('COP', 'Colombian Peso', '$');

-- Poblar dim_gender
INSERT OR IGNORE INTO dim_gender (gender_label, gender_code, sort_order) VALUES
('MASCULINO', 'M', 1),
('FEMENINO', 'F', 2),
('TODOS', 'A', 3),
('DESCONOCIDO', 'U', 4);

-- Poblar dim_age con rangos típicos de Meta
INSERT OR IGNORE INTO dim_age (age_label, age_min, age_max, sort_order) VALUES
('13-17', 13, 17, 1),
('18-24', 18, 24, 2),
('25-34', 25, 34, 3),
('35-44', 35, 44, 4),
('45-54', 45, 54, 5),
('55-64', 55, 64, 6),
('65+', 65, 999, 7),
('18-65+', 18, 999, 8),
('25-54', 25, 54, 9),
('Desconocido', 0, 0, 10);

-- Poblar dim_status con estados típicos de Meta
INSERT OR IGNORE INTO dim_status (scope, status_name, is_active) VALUES
('campaign', 'ACTIVE', 1),
('campaign', 'PAUSED', 0),
('campaign', 'ARCHIVED', 0),
('campaign', 'DELETED', 0),
('adset', 'ACTIVE', 1),
('adset', 'PAUSED', 0),
('adset', 'ARCHIVED', 0),
('adset', 'DELETED', 0),
('ad', 'ACTIVE', 1),
('ad', 'PAUSED', 0),
('ad', 'ARCHIVED', 0),
('ad', 'DELETED', 0),
('ad', 'DISAPPROVED', 0),
('ad', 'PENDING_REVIEW', 0);

-- Poblar dim_objective con objetivos típicos de Meta
INSERT OR IGNORE INTO dim_objective (objective_name, objective_category) VALUES
('OUTCOME_LEADS', 'Lead Generation'),
('OUTCOME_SALES', 'Conversions'),
('OUTCOME_TRAFFIC', 'Traffic'),
('OUTCOME_ENGAGEMENT', 'Engagement'),
('OUTCOME_APP_PROMOTION', 'App Promotion'),
('OUTCOME_AWARENESS', 'Awareness'),
('LINK_CLICKS', 'Traffic'),
('CONVERSIONS', 'Conversions'),
('LEAD_GENERATION', 'Lead Generation'),
('MESSAGES', 'Engagement'),
('REACH', 'Awareness'),
('BRAND_AWARENESS', 'Awareness'),
('VIDEO_VIEWS', 'Engagement'),
('PAGE_LIKES', 'Engagement');

-- Poblar dim_budget_type
INSERT OR IGNORE INTO dim_budget_type (budget_type_name) VALUES
('DAILY'),
('LIFETIME'),
('CAMPAIGN_GROUP');

-- Poblar dim_date con rango de fechas (últimos 2 años + próximo año)
WITH RECURSIVE date_range(date_val) AS (
    SELECT date('2023-01-01') 
    UNION ALL 
    SELECT date(date_val, '+1 day') 
    FROM date_range 
    WHERE date_val < date('2025-12-31')
)
INSERT OR IGNORE INTO dim_date (
    date, year, month, day, day_of_week, week_of_year, 
    is_weekend, quarter, month_name, day_name
)
SELECT 
    date_val,
    CAST(strftime('%Y', date_val) AS INTEGER),
    CAST(strftime('%m', date_val) AS INTEGER),
    CAST(strftime('%d', date_val) AS INTEGER),
    CAST(strftime('%w', date_val) AS INTEGER),
    CAST(strftime('%W', date_val) AS INTEGER),
    CASE WHEN CAST(strftime('%w', date_val) AS INTEGER) IN (0,6) THEN 1 ELSE 0 END,
    CASE 
        WHEN CAST(strftime('%m', date_val) AS INTEGER) BETWEEN 1 AND 3 THEN 1
        WHEN CAST(strftime('%m', date_val) AS INTEGER) BETWEEN 4 AND 6 THEN 2
        WHEN CAST(strftime('%m', date_val) AS INTEGER) BETWEEN 7 AND 9 THEN 3
        ELSE 4
    END,
    CASE CAST(strftime('%m', date_val) AS INTEGER)
        WHEN 1 THEN 'Enero' WHEN 2 THEN 'Febrero' WHEN 3 THEN 'Marzo'
        WHEN 4 THEN 'Abril' WHEN 5 THEN 'Mayo' WHEN 6 THEN 'Junio'
        WHEN 7 THEN 'Julio' WHEN 8 THEN 'Agosto' WHEN 9 THEN 'Septiembre'
        WHEN 10 THEN 'Octubre' WHEN 11 THEN 'Noviembre' WHEN 12 THEN 'Diciembre'
    END,
    CASE CAST(strftime('%w', date_val) AS INTEGER)
        WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Lunes' WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles' WHEN 4 THEN 'Jueves' WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sábado'
    END
FROM date_range;

-- Inicializar control dimensional
INSERT OR IGNORE INTO dw_control (system_version, dimensional_enabled) 
VALUES ('v6.1.0', 0);

-- =====================================================================================
-- 8. TRIGGERS PARA COMPATIBILIDAD
-- =====================================================================================

-- Trigger para mantener sincronía con tabla clients existente (si es necesario)
CREATE TRIGGER IF NOT EXISTS sync_clients_to_dim_account
AFTER INSERT ON clients
BEGIN
    INSERT OR IGNORE INTO dim_account (account_name, legacy_client_id, currency_id)
    VALUES (
        NEW.name, 
        NEW.id,
        (SELECT currency_id FROM dim_currency WHERE currency_code = COALESCE(NEW.currency, 'EUR'))
    );
END;

-- =====================================================================================
-- SCRIPT COMPLETADO
-- =====================================================================================

-- Verificar instalación
SELECT 'Dimensional tables created successfully' as status;
SELECT COUNT(*) as dim_tables FROM sqlite_master WHERE type='table' AND name LIKE 'dim_%';
SELECT COUNT(*) as dates_loaded FROM dim_date;
SELECT COUNT(*) as currencies_loaded FROM dim_currency;
SELECT COUNT(*) as statuses_loaded FROM dim_status;