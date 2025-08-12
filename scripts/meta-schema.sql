-- Idempotent creation of clients and facts_meta tables
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'clients') AND type in (N'U'))
BEGIN
    CREATE TABLE clients (
        client_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        name NVARCHAR(255) NOT NULL,
        name_norm NVARCHAR(255) NOT NULL UNIQUE,
        created_at DATETIME DEFAULT GETDATE(),
        CONSTRAINT PK_clients PRIMARY KEY (client_id)
    );
END;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'facts_meta') AND type in (N'U'))
BEGIN
    CREATE TABLE facts_meta (
        client_id UNIQUEIDENTIFIER NOT NULL,
        [date] DATE NOT NULL,
        ad_id NVARCHAR(255) NOT NULL,
        spend DECIMAL(18,2) NULL,
        days_detected INT DEFAULT 0,
        PRIMARY KEY (client_id, [date], ad_id)
    );
    CREATE UNIQUE INDEX UX_facts_meta_client_date_ad ON facts_meta (client_id, [date], ad_id);
END;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'ads') AND type in (N'U'))
BEGIN
    CREATE TABLE ads (
        client_id UNIQUEIDENTIFIER NOT NULL,
        ad_id NVARCHAR(255) NOT NULL,
        ad_name_norm NVARCHAR(255) NOT NULL,
        name NVARCHAR(255) NULL,
        ad_preview_link NVARCHAR(MAX) NULL,
        ad_creative_thumbnail_url NVARCHAR(MAX) NULL,
        PRIMARY KEY (client_id, ad_id)
    );
    CREATE UNIQUE INDEX UX_ads_client_name_norm ON ads (client_id, ad_name_norm);
END;
GO
