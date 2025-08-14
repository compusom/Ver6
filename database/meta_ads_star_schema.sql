-- =====================================================================================
-- META ADS STAR SCHEMA - DIMENSIONAL MODEL
-- Diseño por capas: Raw → Staging → Dimensional (Star Schema)
-- Optimizado para SQL Server Express con Columnstore Index
-- Basado en análisis de experto en Big Data Meta Ads
-- =====================================================================================

USE [master];
GO

-- Crear base de datos si no existe
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'MetaAdsDW')
BEGIN
    CREATE DATABASE [MetaAdsDW];
    PRINT 'Base de datos MetaAdsDW creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Base de datos MetaAdsDW ya existe';
END
GO

USE [MetaAdsDW];
GO

-- =====================================================================================
-- CAPA 0: RAW LANDING TABLE (Aterrizaje del Excel)
-- =====================================================================================

-- Tabla para aterrizaje directo del Excel (todas las columnas como nvarchar)
IF OBJECT_ID('dbo.raw_meta_rows', 'U') IS NOT NULL
    DROP TABLE dbo.raw_meta_rows;
GO

CREATE TABLE dbo.raw_meta_rows (
    import_batch_id INT NOT NULL,
    row_num INT NOT NULL,
    file_hash CHAR(64) NOT NULL,
    loaded_at DATETIME2 DEFAULT SYSDATETIME(),
    
    -- Columnas exactas del Excel Meta Ads (todas nvarchar para aterrizaje)
    [Nombre de la cuenta] NVARCHAR(255),
    [Nombre de la campaña] NVARCHAR(255),
    [Nombre del conjunto de anuncios] NVARCHAR(255),
    [Nombre del anuncio] NVARCHAR(500),
    [Día] NVARCHAR(50),
    [Edad] NVARCHAR(50),
    [Sexo] NVARCHAR(50),
    [Divisa] NVARCHAR(10),
    [Importe gastado (EUR)] NVARCHAR(50),
    [Impresiones] NVARCHAR(50),
    [Alcance] NVARCHAR(50),
    [Frecuencia] NVARCHAR(50),
    [Clics (todos)] NVARCHAR(50),
    [CTR (todos)] NVARCHAR(50),
    [CPC (todos)] NVARCHAR(50),
    [CPM] NVARCHAR(50),
    [Clics en el enlace] NVARCHAR(50),
    [CTR (porcentaje de clics en el enlace)] NVARCHAR(50),
    [CTR único (porcentaje de clics en el enlace)] NVARCHAR(50),
    [Visitas a la página de destino] NVARCHAR(50),
    [LP View Rate] NVARCHAR(50),
    [Compras] NVARCHAR(50),
    [Valor de conversión de compras] NVARCHAR(50),
    [% Compras] NVARCHAR(50),
    [Impresiones/Compras] NVARCHAR(50),
    [ADC – LPV] NVARCHAR(50),
    [Tasa de conversión de Landing] NVARCHAR(50),
    [Reproducciones de video de 3 segundos] NVARCHAR(50),
    [Reproducciones de video hasta el 25%] NVARCHAR(50),
    [Reproducciones de video hasta el 50%] NVARCHAR(50),
    [Reproducciones de video hasta el 75%] NVARCHAR(50),
    [Reproducciones de video hasta el 95%] NVARCHAR(50),
    [Reproducciones de video hasta el 100%] NVARCHAR(50),
    [ThruPlays] NVARCHAR(50),
    [Tiempo promedio de reproducción del video] NVARCHAR(50),
    [Añadir al carrito] NVARCHAR(50),
    [Iniciar compra] NVARCHAR(50),
    [Interacciones con la publicación] NVARCHAR(50),
    [Reacciones a la publicación] NVARCHAR(50),
    [Comentarios en la publicación] NVARCHAR(50),
    [Publicaciones compartidas] NVARCHAR(50),
    [Me gusta de la página] NVARCHAR(50),
    [Atencion] NVARCHAR(50),
    [Interes] NVARCHAR(50),
    [Deseo] NVARCHAR(50),
    [Objetivo] NVARCHAR(255),
    [Presupuesto de la campaña] NVARCHAR(50),
    [Tipo de presupuesto de la campaña] NVARCHAR(255),
    [URL del sitio web] NVARCHAR(1000),
    [Públicos personalizados incluidos] NVARCHAR(MAX),
    [Públicos personalizados excluidos] NVARCHAR(MAX),
    [Entrega de la campaña] NVARCHAR(100),
    [Entrega del conjunto de anuncios] NVARCHAR(100),
    [Entrega del anuncio] NVARCHAR(100),
    
    CONSTRAINT PK_raw_meta_rows PRIMARY KEY (import_batch_id, row_num)
);
GO

-- Índice para búsquedas por hash de archivo (deduplicación)
CREATE NONCLUSTERED INDEX IX_raw_meta_rows_file_hash 
ON dbo.raw_meta_rows (file_hash);
GO

-- =====================================================================================
-- CAPA 2: DIMENSIONES (Star Schema)
-- =====================================================================================

-- Dimensión Fecha
IF OBJECT_ID('dbo.dim_date', 'U') IS NOT NULL
    DROP TABLE dbo.dim_date;
GO

CREATE TABLE dbo.dim_date (
    date_id INT IDENTITY(1,1) NOT NULL,
    date DATE NOT NULL,
    year_num INT NOT NULL,
    quarter_num INT NOT NULL,
    month_num INT NOT NULL,
    week_num INT NOT NULL,
    day_of_week INT NOT NULL,
    day_name NVARCHAR(20) NOT NULL,
    month_name NVARCHAR(20) NOT NULL,
    is_weekend BIT NOT NULL,
    is_holiday BIT DEFAULT 0,
    fiscal_year INT,
    fiscal_quarter INT,
    
    CONSTRAINT PK_dim_date PRIMARY KEY (date_id),
    CONSTRAINT UQ_dim_date_date UNIQUE (date)
);
GO

-- Dimensión Moneda
IF OBJECT_ID('dbo.dim_currency', 'U') IS NOT NULL
    DROP TABLE dbo.dim_currency;
GO

CREATE TABLE dbo.dim_currency (
    currency_id INT IDENTITY(1,1) NOT NULL,
    currency_code NVARCHAR(10) NOT NULL,
    currency_name NVARCHAR(100),
    symbol NVARCHAR(10),
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    
    CONSTRAINT PK_dim_currency PRIMARY KEY (currency_id),
    CONSTRAINT UQ_dim_currency_code UNIQUE (currency_code)
);
GO

-- Dimensión Cuenta
IF OBJECT_ID('dbo.dim_account', 'U') IS NOT NULL
    DROP TABLE dbo.dim_account;
GO

CREATE TABLE dbo.dim_account (
    account_id INT IDENTITY(1,1) NOT NULL,
    account_name NVARCHAR(255) NOT NULL,
    currency_id INT NOT NULL,
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    updated_at DATETIME2 DEFAULT SYSDATETIME(),
    is_active BIT DEFAULT 1,
    
    CONSTRAINT PK_dim_account PRIMARY KEY (account_id),
    CONSTRAINT UQ_dim_account_name UNIQUE (account_name),
    CONSTRAINT FK_dim_account_currency FOREIGN KEY (currency_id) REFERENCES dbo.dim_currency(currency_id)
);
GO

-- Dimensión Objetivo
IF OBJECT_ID('dbo.dim_objective', 'U') IS NOT NULL
    DROP TABLE dbo.dim_objective;
GO

CREATE TABLE dbo.dim_objective (
    objective_id INT IDENTITY(1,1) NOT NULL,
    objective_name NVARCHAR(255) NOT NULL,
    objective_category NVARCHAR(100),
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    
    CONSTRAINT PK_dim_objective PRIMARY KEY (objective_id),
    CONSTRAINT UQ_dim_objective_name UNIQUE (objective_name)
);
GO

-- Dimensión Tipo de Presupuesto
IF OBJECT_ID('dbo.dim_budget_type', 'U') IS NOT NULL
    DROP TABLE dbo.dim_budget_type;
GO

CREATE TABLE dbo.dim_budget_type (
    budget_type_id INT IDENTITY(1,1) NOT NULL,
    budget_type_name NVARCHAR(255) NOT NULL,
    description NVARCHAR(500),
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    
    CONSTRAINT PK_dim_budget_type PRIMARY KEY (budget_type_id),
    CONSTRAINT UQ_dim_budget_type_name UNIQUE (budget_type_name)
);
GO

-- Dimensión Estado (para campañas, adsets, ads)
IF OBJECT_ID('dbo.dim_status', 'U') IS NOT NULL
    DROP TABLE dbo.dim_status;
GO

CREATE TABLE dbo.dim_status (
    status_id INT IDENTITY(1,1) NOT NULL,
    scope NVARCHAR(50) NOT NULL, -- 'campaign', 'adset', 'ad'
    status_name NVARCHAR(100) NOT NULL,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    
    CONSTRAINT PK_dim_status PRIMARY KEY (status_id),
    CONSTRAINT UQ_dim_status_scope_name UNIQUE (scope, status_name),
    CONSTRAINT CK_dim_status_scope CHECK (scope IN ('campaign', 'adset', 'ad'))
);
GO

-- Dimensión URL
IF OBJECT_ID('dbo.dim_url', 'U') IS NOT NULL
    DROP TABLE dbo.dim_url;
GO

CREATE TABLE dbo.dim_url (
    url_id INT IDENTITY(1,1) NOT NULL,
    full_url NVARCHAR(1000) NOT NULL,
    domain NVARCHAR(255),
    path NVARCHAR(500),
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    
    CONSTRAINT PK_dim_url PRIMARY KEY (url_id),
    CONSTRAINT UQ_dim_url_full UNIQUE (full_url)
);
GO

-- Dimensión Campaña (SCD Tipo 2)
IF OBJECT_ID('dbo.dim_campaign', 'U') IS NOT NULL
    DROP TABLE dbo.dim_campaign;
GO

CREATE TABLE dbo.dim_campaign (
    campaign_id INT IDENTITY(1,1) NOT NULL,
    campaign_natural_key NVARCHAR(500) NOT NULL, -- account_id + campaign_name combinado
    account_id INT NOT NULL,
    campaign_name NVARCHAR(255) NOT NULL,
    objective_id INT,
    budget DECIMAL(15,2),
    budget_type_id INT,
    status_id INT,
    
    -- SCD Tipo 2 fields
    scd_valid_from DATETIME2 DEFAULT SYSDATETIME(),
    scd_valid_to DATETIME2 DEFAULT '9999-12-31 23:59:59',
    scd_is_current BIT DEFAULT 1,
    scd_version INT DEFAULT 1,
    
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    updated_at DATETIME2 DEFAULT SYSDATETIME(),
    
    CONSTRAINT PK_dim_campaign PRIMARY KEY (campaign_id),
    CONSTRAINT FK_dim_campaign_account FOREIGN KEY (account_id) REFERENCES dbo.dim_account(account_id),
    CONSTRAINT FK_dim_campaign_objective FOREIGN KEY (objective_id) REFERENCES dbo.dim_objective(objective_id),
    CONSTRAINT FK_dim_campaign_budget_type FOREIGN KEY (budget_type_id) REFERENCES dbo.dim_budget_type(budget_type_id),
    CONSTRAINT FK_dim_campaign_status FOREIGN KEY (status_id) REFERENCES dbo.dim_status(status_id)
);
GO

-- Índice para SCD y búsquedas
CREATE NONCLUSTERED INDEX IX_dim_campaign_natural_key_current 
ON dbo.dim_campaign (campaign_natural_key, scd_is_current);
GO

CREATE NONCLUSTERED INDEX IX_dim_campaign_account_current 
ON dbo.dim_campaign (account_id, scd_is_current);
GO

-- Dimensión AdSet (SCD Tipo 2)
IF OBJECT_ID('dbo.dim_adset', 'U') IS NOT NULL
    DROP TABLE dbo.dim_adset;
GO

CREATE TABLE dbo.dim_adset (
    adset_id INT IDENTITY(1,1) NOT NULL,
    adset_natural_key NVARCHAR(700) NOT NULL, -- campaign_id + adset_name combinado
    campaign_id INT NOT NULL,
    adset_name NVARCHAR(255) NOT NULL,
    status_id INT,
    
    -- SCD Tipo 2 fields
    scd_valid_from DATETIME2 DEFAULT SYSDATETIME(),
    scd_valid_to DATETIME2 DEFAULT '9999-12-31 23:59:59',
    scd_is_current BIT DEFAULT 1,
    scd_version INT DEFAULT 1,
    
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    updated_at DATETIME2 DEFAULT SYSDATETIME(),
    
    CONSTRAINT PK_dim_adset PRIMARY KEY (adset_id),
    CONSTRAINT FK_dim_adset_campaign FOREIGN KEY (campaign_id) REFERENCES dbo.dim_campaign(campaign_id),
    CONSTRAINT FK_dim_adset_status FOREIGN KEY (status_id) REFERENCES dbo.dim_status(status_id)
);
GO

-- Índice para SCD y búsquedas
CREATE NONCLUSTERED INDEX IX_dim_adset_natural_key_current 
ON dbo.dim_adset (adset_natural_key, scd_is_current);
GO

CREATE NONCLUSTERED INDEX IX_dim_adset_campaign_current 
ON dbo.dim_adset (campaign_id, scd_is_current);
GO

-- Dimensión Ad (SCD Tipo 2)
IF OBJECT_ID('dbo.dim_ad', 'U') IS NOT NULL
    DROP TABLE dbo.dim_ad;
GO

CREATE TABLE dbo.dim_ad (
    ad_id INT IDENTITY(1,1) NOT NULL,
    ad_natural_key NVARCHAR(800) NOT NULL, -- adset_id + ad_name_norm combinado
    adset_id INT NOT NULL,
    ad_name NVARCHAR(500) NOT NULL,
    ad_name_norm NVARCHAR(500) NOT NULL, -- Normalizado sin acentos/espacios
    status_id INT,
    landing_url_id INT,
    preview_link NVARCHAR(1000),
    creative_thumb_url NVARCHAR(1000),
    
    -- SCD Tipo 2 fields
    scd_valid_from DATETIME2 DEFAULT SYSDATETIME(),
    scd_valid_to DATETIME2 DEFAULT '9999-12-31 23:59:59',
    scd_is_current BIT DEFAULT 1,
    scd_version INT DEFAULT 1,
    
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    updated_at DATETIME2 DEFAULT SYSDATETIME(),
    
    CONSTRAINT PK_dim_ad PRIMARY KEY (ad_id),
    CONSTRAINT FK_dim_ad_adset FOREIGN KEY (adset_id) REFERENCES dbo.dim_adset(adset_id),
    CONSTRAINT FK_dim_ad_status FOREIGN KEY (status_id) REFERENCES dbo.dim_status(status_id),
    CONSTRAINT FK_dim_ad_landing_url FOREIGN KEY (landing_url_id) REFERENCES dbo.dim_url(url_id)
);
GO

-- Índice para SCD y búsquedas
CREATE NONCLUSTERED INDEX IX_dim_ad_natural_key_current 
ON dbo.dim_ad (ad_natural_key, scd_is_current);
GO

CREATE NONCLUSTERED INDEX IX_dim_ad_adset_current 
ON dbo.dim_ad (adset_id, scd_is_current);
GO

CREATE NONCLUSTERED INDEX IX_dim_ad_name_norm 
ON dbo.dim_ad (ad_name_norm);
GO

-- Dimensión Edad
IF OBJECT_ID('dbo.dim_age', 'U') IS NOT NULL
    DROP TABLE dbo.dim_age;
GO

CREATE TABLE dbo.dim_age (
    age_id INT IDENTITY(1,1) NOT NULL,
    age_label NVARCHAR(50) NOT NULL, -- '18-24', '25-34', etc.
    age_min INT,
    age_max INT,
    sort_order INT,
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    
    CONSTRAINT PK_dim_age PRIMARY KEY (age_id),
    CONSTRAINT UQ_dim_age_label UNIQUE (age_label)
);
GO

-- Dimensión Género
IF OBJECT_ID('dbo.dim_gender', 'U') IS NOT NULL
    DROP TABLE dbo.dim_gender;
GO

CREATE TABLE dbo.dim_gender (
    gender_id INT IDENTITY(1,1) NOT NULL,
    gender_label NVARCHAR(50) NOT NULL, -- 'Masculino', 'Femenino', 'Desconocido'
    gender_code NVARCHAR(10), -- 'M', 'F', 'U'
    sort_order INT,
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    
    CONSTRAINT PK_dim_gender PRIMARY KEY (gender_id),
    CONSTRAINT UQ_dim_gender_label UNIQUE (gender_label)
);
GO

-- Dimensión Audiencia
IF OBJECT_ID('dbo.dim_audience', 'U') IS NOT NULL
    DROP TABLE dbo.dim_audience;
GO

CREATE TABLE dbo.dim_audience (
    audience_id INT IDENTITY(1,1) NOT NULL,
    audience_name NVARCHAR(255) NOT NULL,
    audience_type NVARCHAR(100), -- 'Custom', 'Lookalike', 'Interest', etc.
    description NVARCHAR(500),
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    
    CONSTRAINT PK_dim_audience PRIMARY KEY (audience_id),
    CONSTRAINT UQ_dim_audience_name UNIQUE (audience_name)
);
GO

-- =====================================================================================
-- BRIDGES (Relaciones Many-to-Many)
-- =====================================================================================

-- Bridge: AdSet - Audiencias Incluidas
IF OBJECT_ID('dbo.bridge_adset_audience_included', 'U') IS NOT NULL
    DROP TABLE dbo.bridge_adset_audience_included;
GO

CREATE TABLE dbo.bridge_adset_audience_included (
    adset_id INT NOT NULL,
    audience_id INT NOT NULL,
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    
    CONSTRAINT PK_bridge_adset_audience_included PRIMARY KEY (adset_id, audience_id),
    CONSTRAINT FK_bridge_included_adset FOREIGN KEY (adset_id) REFERENCES dbo.dim_adset(adset_id),
    CONSTRAINT FK_bridge_included_audience FOREIGN KEY (audience_id) REFERENCES dbo.dim_audience(audience_id)
);
GO

-- Bridge: AdSet - Audiencias Excluidas
IF OBJECT_ID('dbo.bridge_adset_audience_excluded', 'U') IS NOT NULL
    DROP TABLE dbo.bridge_adset_audience_excluded;
GO

CREATE TABLE dbo.bridge_adset_audience_excluded (
    adset_id INT NOT NULL,
    audience_id INT NOT NULL,
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    
    CONSTRAINT PK_bridge_adset_audience_excluded PRIMARY KEY (adset_id, audience_id),
    CONSTRAINT FK_bridge_excluded_adset FOREIGN KEY (adset_id) REFERENCES dbo.dim_adset(adset_id),
    CONSTRAINT FK_bridge_excluded_audience FOREIGN KEY (audience_id) REFERENCES dbo.dim_audience(audience_id)
);
GO

-- =====================================================================================
-- FACT TABLE
-- =====================================================================================

-- Tabla de Hechos: Meta Daily (Grano: día + cuenta + campaña + adset + ad + edad + género)
IF OBJECT_ID('dbo.fact_meta_daily', 'U') IS NOT NULL
    DROP TABLE dbo.fact_meta_daily;
GO

CREATE TABLE dbo.fact_meta_daily (
    -- Claves foráneas (dimensiones)
    date_id INT NOT NULL,
    account_id INT NOT NULL,
    campaign_id INT NOT NULL,
    adset_id INT NOT NULL,
    ad_id INT NOT NULL,
    age_id INT NOT NULL,
    gender_id INT NOT NULL,
    currency_id INT NOT NULL,
    
    -- Métricas atómicas principales
    spend DECIMAL(15,4) DEFAULT 0,
    impressions BIGINT DEFAULT 0,
    reach BIGINT DEFAULT 0,
    frequency DECIMAL(10,4) DEFAULT 0,
    clicks_all BIGINT DEFAULT 0,
    link_clicks BIGINT DEFAULT 0,
    landing_page_views BIGINT DEFAULT 0,
    purchases BIGINT DEFAULT 0,
    conversion_value DECIMAL(15,4) DEFAULT 0,
    
    -- Métricas de video
    video_3s BIGINT DEFAULT 0,
    video_25 BIGINT DEFAULT 0,
    video_50 BIGINT DEFAULT 0,
    video_75 BIGINT DEFAULT 0,
    video_95 BIGINT DEFAULT 0,
    video_100 BIGINT DEFAULT 0,
    thruplays BIGINT DEFAULT 0,
    avg_watch_time DECIMAL(10,4) DEFAULT 0,
    
    -- Métricas de embudo
    add_to_cart BIGINT DEFAULT 0,
    initiate_checkout BIGINT DEFAULT 0,
    
    -- Métricas de engagement
    post_interactions BIGINT DEFAULT 0,
    post_reactions BIGINT DEFAULT 0,
    post_comments BIGINT DEFAULT 0,
    post_shares BIGINT DEFAULT 0,
    page_likes BIGINT DEFAULT 0,
    
    -- Métricas propietarias (si aplican)
    atencion DECIMAL(15,4) DEFAULT 0,
    interes DECIMAL(15,4) DEFAULT 0,
    deseo DECIMAL(15,4) DEFAULT 0,
    
    -- Auditoría
    created_at DATETIME2 DEFAULT SYSDATETIME(),
    import_batch_id INT,
    
    CONSTRAINT PK_fact_meta_daily PRIMARY KEY (date_id, account_id, campaign_id, adset_id, ad_id, age_id, gender_id),
    CONSTRAINT FK_fact_meta_date FOREIGN KEY (date_id) REFERENCES dbo.dim_date(date_id),
    CONSTRAINT FK_fact_meta_account FOREIGN KEY (account_id) REFERENCES dbo.dim_account(account_id),
    CONSTRAINT FK_fact_meta_campaign FOREIGN KEY (campaign_id) REFERENCES dbo.dim_campaign(campaign_id),
    CONSTRAINT FK_fact_meta_adset FOREIGN KEY (adset_id) REFERENCES dbo.dim_adset(adset_id),
    CONSTRAINT FK_fact_meta_ad FOREIGN KEY (ad_id) REFERENCES dbo.dim_ad(ad_id),
    CONSTRAINT FK_fact_meta_age FOREIGN KEY (age_id) REFERENCES dbo.dim_age(age_id),
    CONSTRAINT FK_fact_meta_gender FOREIGN KEY (gender_id) REFERENCES dbo.dim_gender(gender_id),
    CONSTRAINT FK_fact_meta_currency FOREIGN KEY (currency_id) REFERENCES dbo.dim_currency(currency_id)
);
GO

-- =====================================================================================
-- ÍNDICES DE PERFORMANCE
-- =====================================================================================

-- Índice principal para filtros comunes (fecha + cuenta)
CREATE NONCLUSTERED INDEX IX_fact_meta_daily_date_account 
ON dbo.fact_meta_daily (date_id, account_id) 
INCLUDE (impressions, clicks_all, spend, purchases, conversion_value);
GO

-- Índices para agregaciones por nivel
CREATE NONCLUSTERED INDEX IX_fact_meta_daily_campaign_date 
ON dbo.fact_meta_daily (campaign_id, date_id);
GO

CREATE NONCLUSTERED INDEX IX_fact_meta_daily_adset_date 
ON dbo.fact_meta_daily (adset_id, date_id);
GO

CREATE NONCLUSTERED INDEX IX_fact_meta_daily_ad_date 
ON dbo.fact_meta_daily (ad_id, date_id);
GO

-- Índice para análisis demográfico
CREATE NONCLUSTERED INDEX IX_fact_meta_daily_demographics 
ON dbo.fact_meta_daily (age_id, gender_id, date_id) 
INCLUDE (spend, impressions, purchases, conversion_value);
GO

-- Columnstore Index para acelerar agregaciones analíticas (SQL Server Express compatible)
CREATE NONCLUSTERED COLUMNSTORE INDEX IX_fact_meta_daily_cs
ON dbo.fact_meta_daily (
    account_id, campaign_id, adset_id, ad_id, age_id, gender_id, date_id,
    impressions, clicks_all, link_clicks, landing_page_views, spend, purchases, conversion_value,
    video_3s, video_25, video_50, video_75, video_95, video_100, thruplays, avg_watch_time,
    add_to_cart, initiate_checkout, post_interactions, atencion, interes, deseo
);
GO

-- =====================================================================================
-- POBLADO INICIAL DE DIMENSIONES DE REFERENCIA
-- =====================================================================================

-- Poblar dim_currency
INSERT INTO dbo.dim_currency (currency_code, currency_name, symbol) VALUES
('EUR', 'Euro', '€'),
('USD', 'US Dollar', '$'),
('GBP', 'British Pound', '£'),
('CAD', 'Canadian Dollar', 'C$'),
('AUD', 'Australian Dollar', 'A$');
GO

-- Poblar dim_gender
INSERT INTO dbo.dim_gender (gender_label, gender_code, sort_order) VALUES
('Masculino', 'M', 1),
('Femenino', 'F', 2),
('Desconocido', 'U', 3),
('Todos', 'A', 4);
GO

-- Poblar dim_age con rangos típicos de Meta
INSERT INTO dbo.dim_age (age_label, age_min, age_max, sort_order) VALUES
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
GO

-- Poblar dim_status con estados típicos de Meta
INSERT INTO dbo.dim_status (scope, status_name, is_active) VALUES
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
GO

-- Poblar dim_objective con objetivos típicos de Meta
INSERT INTO dbo.dim_objective (objective_name, objective_category) VALUES
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
GO

-- Poblar dim_budget_type
INSERT INTO dbo.dim_budget_type (budget_type_name, description) VALUES
('DAILY', 'Presupuesto diario'),
('LIFETIME', 'Presupuesto total'),
('CAMPAIGN_GROUP', 'Presupuesto de grupo de campañas');
GO

-- Poblar dim_date con rango de fechas (últimos 3 años + próximo año)
WITH DateRange AS (
    SELECT CAST('2022-01-01' AS DATE) AS DateValue
    UNION ALL
    SELECT DATEADD(day, 1, DateValue)
    FROM DateRange
    WHERE DateValue < '2025-12-31'
)
INSERT INTO dbo.dim_date (
    date, year_num, quarter_num, month_num, week_num, 
    day_of_week, day_name, month_name, is_weekend,
    fiscal_year, fiscal_quarter
)
SELECT 
    DateValue,
    YEAR(DateValue),
    DATEPART(quarter, DateValue),
    MONTH(DateValue),
    DATEPART(week, DateValue),
    DATEPART(weekday, DateValue),
    DATENAME(weekday, DateValue),
    DATENAME(month, DateValue),
    CASE WHEN DATEPART(weekday, DateValue) IN (1,7) THEN 1 ELSE 0 END,
    CASE 
        WHEN MONTH(DateValue) >= 4 THEN YEAR(DateValue) + 1
        ELSE YEAR(DateValue)
    END,
    CASE 
        WHEN MONTH(DateValue) IN (4,5,6) THEN 1
        WHEN MONTH(DateValue) IN (7,8,9) THEN 2
        WHEN MONTH(DateValue) IN (10,11,12) THEN 3
        ELSE 4
    END
FROM DateRange
OPTION (MAXRECURSION 0);
GO

PRINT 'Star Schema creado exitosamente';
PRINT 'Dimensiones pobladas con datos de referencia';
PRINT 'Índices de performance creados';
PRINT 'Sistema listo para carga de datos Excel Meta Ads';
GO