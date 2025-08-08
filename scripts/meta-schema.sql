-- Idempotent creation of clients and facts_meta tables
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'clients') AND type in (N'U'))
BEGIN
    CREATE TABLE clients (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        name_norm NVARCHAR(255) NOT NULL UNIQUE,
        created_at DATETIME DEFAULT GETDATE()
    );
END;
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'facts_meta') AND type in (N'U'))
BEGIN
    CREATE TABLE facts_meta (
        client_id INT NOT NULL,
        [date] DATE NOT NULL,
        ad_id NVARCHAR(255) NOT NULL,
        spend DECIMAL(18,2) NULL,
        days_detected INT DEFAULT 0,
        PRIMARY KEY (client_id, [date], ad_id)
    );
    CREATE UNIQUE INDEX UX_facts_meta_client_date_ad ON facts_meta (client_id, [date], ad_id);
END;
GO
