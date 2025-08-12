-- Resumen Ejecutivo por Campaña
SELECT
    c.CampaignName,
    SUM(f.Spend)        AS TotalSpend,
    SUM(f.Impressions)  AS TotalImpressions,
    SUM(f.Clicks)       AS TotalClicks,
    SUM(f.Purchases)    AS TotalPurchases,
    CASE WHEN SUM(f.Purchases) > 0 THEN SUM(f.Spend) / SUM(f.Purchases) END AS CostPerPurchase,
    CASE WHEN SUM(f.Spend) > 0 THEN SUM(f.PurchaseValue) / SUM(f.Spend) END AS ROAS
FROM dbo.fact_Metrics f
JOIN dbo.dim_Campaigns c ON f.CampaignID = c.CampaignID
GROUP BY c.CampaignName;

-- Análisis de Rendimiento por Sexo y Edad para CampaignID = 1
SELECT
    d.AgeBracket,
    d.Gender,
    SUM(f.Spend)     AS TotalSpend,
    SUM(f.Purchases) AS TotalPurchases,
    CASE WHEN SUM(f.Purchases) > 0 THEN SUM(f.Spend) / SUM(f.Purchases) END AS CostPerPurchase
FROM dbo.fact_Metrics f
JOIN dbo.dim_Demographics d ON f.DemographicID = d.DemographicID
WHERE f.CampaignID = 1
GROUP BY d.AgeBracket, d.Gender
ORDER BY d.AgeBracket, d.Gender;

-- Top 5 Anuncios con Mejor Retorno de Inversión (ROAS)
SELECT TOP 5
    a.AdName,
    c.CampaignName,
    CASE WHEN SUM(f.Spend) > 0 THEN SUM(f.PurchaseValue) / SUM(f.Spend) END AS ROAS
FROM dbo.fact_Metrics f
JOIN dbo.dim_Ads a ON f.AdID = a.AdID
JOIN dbo.dim_Campaigns c ON f.CampaignID = c.CampaignID
GROUP BY a.AdName, c.CampaignName
ORDER BY ROAS DESC;

-- Evolución Diaria del Gasto vs. Compras (últimos 30 días)
SELECT
    d.FullDate,
    SUM(f.Spend)     AS TotalSpend,
    SUM(f.Purchases) AS TotalPurchases
FROM dbo.fact_Metrics f
JOIN dbo.dim_Date d ON f.DateID = d.DateID
WHERE d.FullDate >= DATEADD(day, -30, CAST(GETDATE() AS DATE))
GROUP BY d.FullDate
ORDER BY d.FullDate;

-- Análisis de Rendimiento por Plataforma y Dispositivo
SELECT
    p.Platform,
    p.Device,
    SUM(f.Spend)     AS TotalSpend,
    SUM(f.Purchases) AS TotalPurchases,
    CASE WHEN SUM(f.Clicks) > 0 THEN (SUM(f.Purchases) * 100.0) / SUM(f.Clicks) END AS ConversionRatePct
FROM dbo.fact_Metrics f
JOIN dbo.dim_Placements p ON f.PlacementID = p.PlacementID
GROUP BY p.Platform, p.Device
ORDER BY p.Platform, p.Device;
