export const TABLES = {
  dim_Clients: {
    create: `
        IF OBJECT_ID('dim_Clients', 'U') IS NULL
        CREATE TABLE dim_Clients (
            ClientID INT IDENTITY(1,1) PRIMARY KEY,
            AccountFBID BIGINT NOT NULL,
            ClientName NVARCHAR(255)
        );
        CREATE NONCLUSTERED INDEX IX_dim_Clients_AccountFBID ON dim_Clients(AccountFBID);
    `,
    dependencies: []
  },
  dim_Campaigns: {
    create: `
        IF OBJECT_ID('dim_Campaigns', 'U') IS NULL
        CREATE TABLE dim_Campaigns (
            CampaignID INT IDENTITY(1,1) PRIMARY KEY,
            ClientID INT NOT NULL,
            CampaignFBID BIGINT NOT NULL,
            CampaignName NVARCHAR(255),
            Objective NVARCHAR(100),
            FOREIGN KEY (ClientID) REFERENCES dim_Clients(ClientID)
        );
        CREATE NONCLUSTERED INDEX IX_dim_Campaigns_CampaignFBID ON dim_Campaigns(CampaignFBID);
    `,
    dependencies: ['dim_Clients']
  },
  dim_AdSets: {
    create: `
        IF OBJECT_ID('dim_AdSets', 'U') IS NULL
        CREATE TABLE dim_AdSets (
            AdSetID INT IDENTITY(1,1) PRIMARY KEY,
            CampaignID INT NOT NULL,
            AdSetFBID BIGINT NOT NULL,
            AdSetName NVARCHAR(255),
            FOREIGN KEY (CampaignID) REFERENCES dim_Campaigns(CampaignID)
        );
        CREATE NONCLUSTERED INDEX IX_dim_AdSets_AdSetFBID ON dim_AdSets(AdSetFBID);
    `,
    dependencies: ['dim_Campaigns']
  },
  dim_Ads: {
    create: `
        IF OBJECT_ID('dim_Ads', 'U') IS NULL
        CREATE TABLE dim_Ads (
            AdID INT IDENTITY(1,1) PRIMARY KEY,
            AdSetID INT NOT NULL,
            AdFBID BIGINT NOT NULL,
            AdName NVARCHAR(500),
            AdBody NVARCHAR(MAX),
            AdThumbnailURL NVARCHAR(1024),
            PermanentLink NVARCHAR(1024),
            FOREIGN KEY (AdSetID) REFERENCES dim_AdSets(AdSetID)
        );
        CREATE NONCLUSTERED INDEX IX_dim_Ads_AdFBID ON dim_Ads(AdFBID);
    `,
    dependencies: ['dim_AdSets']
  },
  dim_Date: {
    create: `
        IF OBJECT_ID('dim_Date', 'U') IS NULL
        CREATE TABLE dim_Date (
            DateID INT PRIMARY KEY,
            FullDate DATE NOT NULL,
            Year SMALLINT,
            Month TINYINT,
            Day TINYINT,
            DayOfWeek TINYINT
        );
    `,
    dependencies: []
  },
  dim_Demographics: {
    create: `
        IF OBJECT_ID('dim_Demographics', 'U') IS NULL
        CREATE TABLE dim_Demographics (
            DemographicID INT IDENTITY(1,1) PRIMARY KEY,
            AgeBracket VARCHAR(50),
            Gender VARCHAR(50)
        );
    `,
    dependencies: []
  },
  dim_Placements: {
    create: `
        IF OBJECT_ID('dim_Placements', 'U') IS NULL
        CREATE TABLE dim_Placements (
            PlacementID INT IDENTITY(1,1) PRIMARY KEY,
            Platform NVARCHAR(100),
            Device NVARCHAR(100),
            Position NVARCHAR(100)
        );
    `,
    dependencies: []
  },
  fact_Metrics: {
    create: `
        IF OBJECT_ID('fact_Metrics', 'U') IS NULL
        CREATE TABLE fact_Metrics (
            MetricID BIGINT IDENTITY(1,1) PRIMARY KEY,
            DateID INT NOT NULL,
            ClientID INT NOT NULL,
            CampaignID INT NOT NULL,
            AdSetID INT NOT NULL,
            AdID INT NOT NULL,
            DemographicID INT NOT NULL,
            PlacementID INT NOT NULL,
            Spend DECIMAL(18,4),
            Impressions INT,
            Reach INT,
            Clicks INT,
            Purchases INT,
            PurchaseValue DECIMAL(18,4),
            VideoPlays_25_Pct INT,
            VideoPlays_50_Pct INT,
            VideoPlays_75_Pct INT,
            VideoPlays_95_Pct INT,
            VideoPlays_100_Pct INT,
            Results INT,
            CostPerResult DECIMAL(18,4),
            FOREIGN KEY (DateID) REFERENCES dim_Date(DateID),
            FOREIGN KEY (ClientID) REFERENCES dim_Clients(ClientID),
            FOREIGN KEY (CampaignID) REFERENCES dim_Campaigns(CampaignID),
            FOREIGN KEY (AdSetID) REFERENCES dim_AdSets(AdSetID),
            FOREIGN KEY (AdID) REFERENCES dim_Ads(AdID),
            FOREIGN KEY (DemographicID) REFERENCES dim_Demographics(DemographicID),
            FOREIGN KEY (PlacementID) REFERENCES dim_Placements(PlacementID)
        );
        CREATE NONCLUSTERED INDEX IX_factMetrics_Date_Campaign_Ad ON fact_Metrics(DateID, CampaignID, AdID);
    `,
    dependencies: ['dim_Clients','dim_Campaigns','dim_AdSets','dim_Ads','dim_Date','dim_Demographics','dim_Placements']
  },
  import_history: {
    create: `
        IF OBJECT_ID('import_history', 'U') IS NULL
        CREATE TABLE import_history (
            id INT IDENTITY(1,1) PRIMARY KEY,
            source VARCHAR(50) NOT NULL DEFAULT 'sql',
            batch_data NVARCHAR(MAX) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `,
    dependencies: []
  }
};

export function getCreationOrder() {
  const visited = new Set();
  const order = [];
  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    (TABLES[name].dependencies || []).forEach(visit);
    order.push(name);
  }
  Object.keys(TABLES).forEach(visit);
  return order;
}

export function getDeletionOrder() {
  return getCreationOrder().slice().reverse();
}

export const SQL_TABLE_DEFINITIONS = Object.fromEntries(
  Object.entries(TABLES).map(([k, v]) => [k, v.create])
);
