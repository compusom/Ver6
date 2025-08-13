/*
=====================================================================
  MIGRACIÓN A MODELO ESTRELLA - Meta Ads Analytics
  Migra la estructura actual a modelo estrella optimizado
=====================================================================
*/

-- Configuración inicial
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- =====================================================================
-- PASO 1: ELIMINAR TABLAS OBSOLETAS (si existen)
-- =====================================================================

-- Eliminar constraints primero
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_metricas_archivos')
    ALTER TABLE metricas DROP CONSTRAINT FK_metricas_archivos;

IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_archivos_reporte_clients')
    ALTER TABLE archivos_reporte DROP CONSTRAINT FK_archivos_reporte_clients;

-- Eliminar tablas en orden inverso
DROP TABLE IF EXISTS metricas;
DROP TABLE IF EXISTS archivos_reporte;
DROP TABLE IF EXISTS vistas_preview;
DROP TABLE IF EXISTS archivos_url;
DROP TABLE IF EXISTS processed_files_hashes;
DROP TABLE IF EXISTS _staging_facts;

-- =====================================================================
-- PASO 2: CREAR TABLAS DE DIMENSIONES
-- =====================================================================

-- Dimensión: Clientes
CREATE TABLE dim_Clients (
    ClientID INT IDENTITY(1,1) PRIMARY KEY,
    AccountFBID BIGINT NOT NULL,
    ClientName NVARCHAR(255) NOT NULL,
    CreatedDate DATETIME2 DEFAULT GETDATE(),
    
    CONSTRAINT UQ_dim_Clients_AccountFBID UNIQUE (AccountFBID)
);

-- Dimensión: Campañas
CREATE TABLE dim_Campaigns (
    CampaignID INT IDENTITY(1,1) PRIMARY KEY,
    ClientID INT NOT NULL,
    CampaignFBID BIGINT NOT NULL,
    CampaignName NVARCHAR(255) NOT NULL,
    Objective NVARCHAR(100),
    CreatedDate DATETIME2 DEFAULT GETDATE(),
    
    CONSTRAINT UQ_dim_Campaigns_CampaignFBID UNIQUE (CampaignFBID)
);

-- Dimensión: Conjuntos de Anuncios
CREATE TABLE dim_AdSets (
    AdSetID INT IDENTITY(1,1) PRIMARY KEY,
    CampaignID INT NOT NULL,
    AdSetFBID BIGINT NOT NULL,
    AdSetName NVARCHAR(255) NOT NULL,
    CreatedDate DATETIME2 DEFAULT GETDATE(),
    
    CONSTRAINT UQ_dim_AdSets_AdSetFBID UNIQUE (AdSetFBID)
);

-- Dimensión: Anuncios
CREATE TABLE dim_Ads (
    AdID INT IDENTITY(1,1) PRIMARY KEY,
    AdSetID INT NOT NULL,
    AdFBID BIGINT NOT NULL,
    AdName NVARCHAR(500) NOT NULL,
    AdBody NVARCHAR(MAX),
    AdThumbnailURL NVARCHAR(1024),
    PermanentLink NVARCHAR(1024),
    CreatedDate DATETIME2 DEFAULT GETDATE(),
    
    CONSTRAINT UQ_dim_Ads_AdFBID UNIQUE (AdFBID)
);

-- Dimensión: Fechas
CREATE TABLE dim_Date (
    DateID INT PRIMARY KEY,  -- Formato YYYYMMDD
    FullDate DATE NOT NULL,
    [Year] SMALLINT NOT NULL,
    [Month] TINYINT NOT NULL,
    [Day] TINYINT NOT NULL,
    DayOfWeek TINYINT NOT NULL,
    [Quarter] TINYINT NOT NULL,
    WeekOfYear TINYINT NOT NULL,
    MonthName NVARCHAR(20) NOT NULL,
    DayName NVARCHAR(20) NOT NULL,
    IsWeekend BIT NOT NULL
);

-- Dimensión: Demografía
CREATE TABLE dim_Demographics (
    DemographicID INT IDENTITY(1,1) PRIMARY KEY,
    AgeBracket VARCHAR(50) NOT NULL,
    Gender VARCHAR(50) NOT NULL,
    
    CONSTRAINT UQ_dim_Demographics_AgeBracket_Gender UNIQUE (AgeBracket, Gender)
);

-- Dimensión: Ubicaciones de Anuncio
CREATE TABLE dim_Placements (
    PlacementID INT IDENTITY(1,1) PRIMARY KEY,
    Platform NVARCHAR(100) NOT NULL,
    Device NVARCHAR(100) NOT NULL,
    Position NVARCHAR(100) NOT NULL,
    
    CONSTRAINT UQ_dim_Placements_Platform_Device_Position UNIQUE (Platform, Device, Position)
);

-- =====================================================================
-- PASO 3: CREAR TABLA DE HECHOS
-- =====================================================================

CREATE TABLE fact_Metrics (
    MetricID BIGINT IDENTITY(1,1) PRIMARY KEY,
    DateID INT NOT NULL,
    ClientID INT NOT NULL,
    CampaignID INT NOT NULL,
    AdSetID INT NOT NULL,
    AdID INT NOT NULL,
    DemographicID INT NOT NULL,
    PlacementID INT NOT NULL,
    
    -- Métricas principales
    Spend DECIMAL(18, 4) DEFAULT 0,
    Impressions INT DEFAULT 0,
    Reach INT DEFAULT 0,
    Clicks INT DEFAULT 0,
    Purchases INT DEFAULT 0,
    PurchaseValue DECIMAL(18, 4) DEFAULT 0,
    VideoPlays_25_Pct INT DEFAULT 0,
    VideoPlays_50_Pct INT DEFAULT 0,
    VideoPlays_75_Pct INT DEFAULT 0,
    VideoPlays_95_Pct INT DEFAULT 0,
    VideoPlays_100_Pct INT DEFAULT 0,
    Results INT DEFAULT 0,
    CostPerResult DECIMAL(18, 4) DEFAULT 0,
    
    -- Auditoría
    CreatedDate DATETIME2 DEFAULT GETDATE(),
    ModifiedDate DATETIME2 DEFAULT GETDATE(),
    
    -- Restricción de unicidad
    CONSTRAINT UQ_fact_Metrics_Combination UNIQUE (
        DateID, ClientID, CampaignID, AdSetID, AdID, DemographicID, PlacementID
    )
);

-- =====================================================================
-- PASO 4: CREAR FOREIGN KEYS
-- =====================================================================

-- Foreign Keys jerárquicas
ALTER TABLE dim_Campaigns
ADD CONSTRAINT FK_dim_Campaigns_ClientID 
    FOREIGN KEY (ClientID) REFERENCES dim_Clients(ClientID);

ALTER TABLE dim_AdSets
ADD CONSTRAINT FK_dim_AdSets_CampaignID 
    FOREIGN KEY (CampaignID) REFERENCES dim_Campaigns(CampaignID);

ALTER TABLE dim_Ads
ADD CONSTRAINT FK_dim_Ads_AdSetID 
    FOREIGN KEY (AdSetID) REFERENCES dim_AdSets(AdSetID);

-- Foreign Keys de tabla de hechos
ALTER TABLE fact_Metrics
ADD CONSTRAINT FK_fact_Metrics_DateID 
    FOREIGN KEY (DateID) REFERENCES dim_Date(DateID);

ALTER TABLE fact_Metrics
ADD CONSTRAINT FK_fact_Metrics_ClientID 
    FOREIGN KEY (ClientID) REFERENCES dim_Clients(ClientID);

ALTER TABLE fact_Metrics
ADD CONSTRAINT FK_fact_Metrics_CampaignID 
    FOREIGN KEY (CampaignID) REFERENCES dim_Campaigns(CampaignID);

ALTER TABLE fact_Metrics
ADD CONSTRAINT FK_fact_Metrics_AdSetID 
    FOREIGN KEY (AdSetID) REFERENCES dim_AdSets(AdSetID);

ALTER TABLE fact_Metrics
ADD CONSTRAINT FK_fact_Metrics_AdID 
    FOREIGN KEY (AdID) REFERENCES dim_Ads(AdID);

ALTER TABLE fact_Metrics
ADD CONSTRAINT FK_fact_Metrics_DemographicID 
    FOREIGN KEY (DemographicID) REFERENCES dim_Demographics(DemographicID);

ALTER TABLE fact_Metrics
ADD CONSTRAINT FK_fact_Metrics_PlacementID 
    FOREIGN KEY (PlacementID) REFERENCES dim_Placements(PlacementID);

-- =====================================================================
-- PASO 5: CREAR ÍNDICES DE OPTIMIZACIÓN
-- =====================================================================

-- Índices en identificadores de Facebook
CREATE NONCLUSTERED INDEX IX_dim_Clients_AccountFBID 
    ON dim_Clients (AccountFBID);

CREATE NONCLUSTERED INDEX IX_dim_Campaigns_CampaignFBID 
    ON dim_Campaigns (CampaignFBID);

CREATE NONCLUSTERED INDEX IX_dim_AdSets_AdSetFBID 
    ON dim_AdSets (AdSetFBID);

CREATE NONCLUSTERED INDEX IX_dim_Ads_AdFBID 
    ON dim_Ads (AdFBID);

-- Índices jerárquicos
CREATE NONCLUSTERED INDEX IX_dim_Campaigns_ClientID 
    ON dim_Campaigns (ClientID);

CREATE NONCLUSTERED INDEX IX_dim_AdSets_CampaignID 
    ON dim_AdSets (CampaignID);

CREATE NONCLUSTERED INDEX IX_dim_Ads_AdSetID 
    ON dim_Ads (AdSetID);

-- Índices compuestos en tabla de hechos
CREATE NONCLUSTERED INDEX IX_fact_Metrics_DateID_CampaignID_AdID 
    ON fact_Metrics (DateID, CampaignID, AdID);

CREATE NONCLUSTERED INDEX IX_fact_Metrics_ClientID_DateID 
    ON fact_Metrics (ClientID, DateID);

CREATE NONCLUSTERED INDEX IX_fact_Metrics_CampaignID_DateID 
    ON fact_Metrics (CampaignID, DateID);

CREATE NONCLUSTERED INDEX IX_fact_Metrics_DateID_DemographicID 
    ON fact_Metrics (DateID, DemographicID);

-- =====================================================================
-- PASO 6: INSERTAR DATOS MAESTROS
-- =====================================================================

-- Demografías básicas
INSERT INTO dim_Demographics (AgeBracket, Gender) VALUES
('18-24', 'Hombre'),
('18-24', 'Mujer'),
('25-34', 'Hombre'),
('25-34', 'Mujer'),
('35-44', 'Hombre'),
('35-44', 'Mujer'),
('45-54', 'Hombre'),
('45-54', 'Mujer'),
('55-64', 'Hombre'),
('55-64', 'Mujer'),
('65+', 'Hombre'),
('65+', 'Mujer'),
('Desconocido', 'Desconocido');

-- Ubicaciones básicas
INSERT INTO dim_Placements (Platform, Device, Position) VALUES
('Facebook', 'Desktop', 'Feed'),
('Facebook', 'Mobile', 'Feed'),
('Instagram', 'Mobile', 'Feed'),
('Instagram', 'Mobile', 'Stories'),
('Facebook', 'Desktop', 'Right Column'),
('Messenger', 'Mobile', 'Inbox'),
('Audience Network', 'Mobile', 'Banner'),
('Desconocido', 'Desconocido', 'Desconocido');

-- =====================================================================
-- PASO 7: POBLAR DIMENSIÓN DE FECHAS
-- =====================================================================

DECLARE @StartDate DATE = '2020-01-01';
DECLARE @EndDate DATE = '2030-12-31';
DECLARE @CurrentDate DATE = @StartDate;

WHILE @CurrentDate <= @EndDate
BEGIN
    INSERT INTO dim_Date (
        DateID, FullDate, [Year], [Month], [Day], DayOfWeek,
        [Quarter], WeekOfYear, MonthName, DayName, IsWeekend
    )
    VALUES (
        CAST(FORMAT(@CurrentDate, 'yyyyMMdd') AS INT),
        @CurrentDate,
        YEAR(@CurrentDate),
        MONTH(@CurrentDate),
        DAY(@CurrentDate),
        DATEPART(WEEKDAY, @CurrentDate),
        DATEPART(QUARTER, @CurrentDate),
        DATEPART(WEEK, @CurrentDate),
        DATENAME(MONTH, @CurrentDate),
        DATENAME(WEEKDAY, @CurrentDate),
        CASE WHEN DATEPART(WEEKDAY, @CurrentDate) IN (1, 7) THEN 1 ELSE 0 END
    );
    
    SET @CurrentDate = DATEADD(DAY, 1, @CurrentDate);
END;

-- =====================================================================
-- PASO 8: MANTENER TABLA IMPORT_HISTORY SIMPLIFICADA
-- =====================================================================

-- Mantener solo import_history para tracking
CREATE TABLE import_history (
    id INT IDENTITY(1,1) PRIMARY KEY,
    source VARCHAR(50) NOT NULL DEFAULT 'meta-excel',
    file_name NVARCHAR(255),
    records_processed INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

PRINT 'Migración a Modelo Estrella completada exitosamente.';
PRINT 'Estructura creada: 7 dimensiones + 1 tabla de hechos + import_history';
PRINT 'Datos maestros insertados y dimensión de fechas poblada.';