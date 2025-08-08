-- A) clients: asegurar columna client_id (o renombrar id -> client_id)
IF COL_LENGTH('dbo.clients','client_id') IS NULL AND COL_LENGTH('dbo.clients','id') IS NOT NULL
BEGIN
  EXEC sp_rename 'dbo.clients.id', 'client_id', 'COLUMN';
END;

-- Si no existe clients, créala completa
IF OBJECT_ID('dbo.clients','U') IS NULL
BEGIN
  CREATE TABLE dbo.clients(
    client_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    name_norm NVARCHAR(255) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_clients PRIMARY KEY (client_id)
  );
END;

-- Índice único por name_norm
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UQ_clients_name_norm' AND object_id=OBJECT_ID('dbo.clients'))
  CREATE UNIQUE INDEX UQ_clients_name_norm ON dbo.clients(name_norm);

-- B) facts_meta: asegurar FK client_id y columna calculada para índice
IF OBJECT_ID('dbo.facts_meta','U') IS NULL
BEGIN
  CREATE TABLE dbo.facts_meta(
    fact_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    client_id UNIQUEIDENTIFIER NOT NULL,
    [date] DATE NOT NULL,
    ad_id NVARCHAR(100) NULL,
    campaign_id NVARCHAR(100) NULL,
    adset_id NVARCHAR(100) NULL,
    impressions BIGINT NULL,
    clicks BIGINT NULL,
    spend DECIMAL(18,4) NULL,
    purchases INT NULL,
    roas DECIMAL(18,4) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_facts_meta_clients FOREIGN KEY (client_id) REFERENCES dbo.clients(client_id)
  );
END
ELSE
BEGIN
  IF COL_LENGTH('dbo.facts_meta','client_id') IS NULL
    ALTER TABLE dbo.facts_meta ADD client_id UNIQUEIDENTIFIER NULL;
  -- (si había otra FK, migrar datos acá)
  IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.facts_meta') AND name='client_id')
    ALTER TABLE dbo.facts_meta ALTER COLUMN client_id UNIQUEIDENTIFIER NOT NULL;
END;

-- Columna calculada para indexar ISNULL(ad_id,'')
IF COL_LENGTH('dbo.facts_meta','ad_id_nz') IS NULL
  ALTER TABLE dbo.facts_meta ADD ad_id_nz AS (ISNULL(ad_id,'')) PERSISTED;

-- Índice único (client_id, date, ad_id_nz)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_facts_meta_client_date_ad_nz' AND object_id=OBJECT_ID('dbo.facts_meta'))
  CREATE UNIQUE INDEX UX_facts_meta_client_date_ad_nz ON dbo.facts_meta(client_id, [date], ad_id_nz);
