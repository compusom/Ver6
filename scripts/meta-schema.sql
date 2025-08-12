IF DB_ID('MarketingDW') IS NULL
BEGIN
    CREATE DATABASE MarketingDW;
END;
GO
USE MarketingDW;
GO

-- ============================================================
-- Dimensional Tables
-- ============================================================
IF OBJECT_ID('dbo.dim_Clients','U') IS NULL
BEGIN
    CREATE TABLE dbo.dim_Clients (
        ClientID    INT IDENTITY(1,1) PRIMARY KEY,
        AccountFBID BIGINT      NOT NULL,
        ClientName  NVARCHAR(255)
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_dim_Clients_AccountFBID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_dim_Clients_AccountFBID ON dbo.dim_Clients(AccountFBID);
END;
GO

IF OBJECT_ID('dbo.dim_Campaigns','U') IS NULL
BEGIN
    CREATE TABLE dbo.dim_Campaigns (
        CampaignID   INT IDENTITY(1,1) PRIMARY KEY,
        ClientID     INT         NOT NULL,
        CampaignFBID BIGINT      NOT NULL,
        CampaignName NVARCHAR(255),
        Objective    NVARCHAR(100),
        CONSTRAINT FK_dim_Campaigns_dim_Clients FOREIGN KEY (ClientID)
            REFERENCES dbo.dim_Clients(ClientID)
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_dim_Campaigns_CampaignFBID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_dim_Campaigns_CampaignFBID ON dbo.dim_Campaigns(CampaignFBID);
END;
GO

IF OBJECT_ID('dbo.dim_AdSets','U') IS NULL
BEGIN
    CREATE TABLE dbo.dim_AdSets (
        AdSetID   INT IDENTITY(1,1) PRIMARY KEY,
        CampaignID INT        NOT NULL,
        AdSetFBID  BIGINT     NOT NULL,
        AdSetName  NVARCHAR(255),
        CONSTRAINT FK_dim_AdSets_dim_Campaigns FOREIGN KEY (CampaignID)
            REFERENCES dbo.dim_Campaigns(CampaignID)
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_dim_AdSets_AdSetFBID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_dim_AdSets_AdSetFBID ON dbo.dim_AdSets(AdSetFBID);
END;
GO

IF OBJECT_ID('dbo.dim_Ads','U') IS NULL
BEGIN
    CREATE TABLE dbo.dim_Ads (
        AdID           INT IDENTITY(1,1) PRIMARY KEY,
        AdSetID        INT         NOT NULL,
        AdFBID         BIGINT      NOT NULL,
        AdName         NVARCHAR(500),
        AdBody         NVARCHAR(MAX),
        AdThumbnailURL NVARCHAR(1024),
        PermanentLink  NVARCHAR(1024),
        CONSTRAINT FK_dim_Ads_dim_AdSets FOREIGN KEY (AdSetID)
            REFERENCES dbo.dim_AdSets(AdSetID)
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_dim_Ads_AdFBID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_dim_Ads_AdFBID ON dbo.dim_Ads(AdFBID);
END;
GO

IF OBJECT_ID('dbo.dim_Date','U') IS NULL
BEGIN
    CREATE TABLE dbo.dim_Date (
        DateID    INT      PRIMARY KEY,
        FullDate  DATE     NOT NULL,
        Year      SMALLINT,
        Month     TINYINT,
        Day       TINYINT,
        DayOfWeek TINYINT
    );
END;
GO

IF OBJECT_ID('dbo.dim_Demographics','U') IS NULL
BEGIN
    CREATE TABLE dbo.dim_Demographics (
        DemographicID INT IDENTITY(1,1) PRIMARY KEY,
        AgeBracket    VARCHAR(50),
        Gender        VARCHAR(50)
    );
END;
GO

IF OBJECT_ID('dbo.dim_Placements','U') IS NULL
BEGIN
    CREATE TABLE dbo.dim_Placements (
        PlacementID INT IDENTITY(1,1) PRIMARY KEY,
        Platform    NVARCHAR(100),
        Device      NVARCHAR(100),
        Position    NVARCHAR(100)
    );
END;
GO

-- ============================================================
-- Fact Table
-- ============================================================
IF OBJECT_ID('dbo.fact_Metrics','U') IS NULL
BEGIN
    CREATE TABLE dbo.fact_Metrics (
        MetricID           BIGINT IDENTITY(1,1) PRIMARY KEY,
        DateID             INT NOT NULL,
        ClientID           INT NOT NULL,
        CampaignID         INT NOT NULL,
        AdSetID            INT NOT NULL,
        AdID               INT NOT NULL,
        DemographicID      INT NOT NULL,
        PlacementID        INT NOT NULL,
        Spend              DECIMAL(18,4),
        Impressions        INT,
        Reach              INT,
        Clicks             INT,
        Purchases          INT,
        PurchaseValue      DECIMAL(18,4),
        VideoPlays_25_Pct  INT,
        VideoPlays_50_Pct  INT,
        VideoPlays_75_Pct  INT,
        VideoPlays_95_Pct  INT,
        VideoPlays_100_Pct INT,
        Results            INT,
        CostPerResult      DECIMAL(18,4),
        CONSTRAINT FK_fact_Date        FOREIGN KEY (DateID)        REFERENCES dbo.dim_Date(DateID),
        CONSTRAINT FK_fact_Client      FOREIGN KEY (ClientID)      REFERENCES dbo.dim_Clients(ClientID),
        CONSTRAINT FK_fact_Campaign    FOREIGN KEY (CampaignID)    REFERENCES dbo.dim_Campaigns(CampaignID),
        CONSTRAINT FK_fact_AdSet       FOREIGN KEY (AdSetID)       REFERENCES dbo.dim_AdSets(AdSetID),
        CONSTRAINT FK_fact_Ad          FOREIGN KEY (AdID)          REFERENCES dbo.dim_Ads(AdID),
        CONSTRAINT FK_fact_Demographic FOREIGN KEY (DemographicID) REFERENCES dbo.dim_Demographics(DemographicID),
        CONSTRAINT FK_fact_Placement   FOREIGN KEY (PlacementID)   REFERENCES dbo.dim_Placements(PlacementID)
    );
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_factMetrics_Date_Campaign_Ad')
BEGIN
    CREATE NONCLUSTERED INDEX IX_factMetrics_Date_Campaign_Ad
        ON dbo.fact_Metrics(DateID, CampaignID, AdID);
END;
GO
