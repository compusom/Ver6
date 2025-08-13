/*
=====================================================================
  CONSULTAS DE ANÁLISIS - MODELO ESTRELLA
  5 consultas SQL para demostrar el poder analítico del modelo estrella
  Base de Datos: Meta Ads Analytics - SQL Server Express
=====================================================================
*/

-- =====================================================================
-- CONSULTA 1: RESUMEN EJECUTIVO POR CAMPAÑA
-- Pregunta: ¿Cuál es el rendimiento general de cada campaña?
-- =====================================================================

SELECT 
    c.CampaignName,
    c.Objective,
    cl.ClientName,
    SUM(f.Spend) AS TotalSpend,
    SUM(f.Impressions) AS TotalImpressions,
    SUM(f.Clicks) AS TotalClicks,
    SUM(f.Purchases) AS TotalPurchases,
    SUM(f.PurchaseValue) AS TotalPurchaseValue,
    
    -- Costo por Compra (Total Spend / Total Purchases)
    CASE 
        WHEN SUM(f.Purchases) > 0 
        THEN ROUND(SUM(f.Spend) / SUM(f.Purchases), 2)
        ELSE NULL 
    END AS CostPerPurchase,
    
    -- ROAS (Total Purchase Value / Total Spend)
    CASE 
        WHEN SUM(f.Spend) > 0 
        THEN ROUND(SUM(f.PurchaseValue) / SUM(f.Spend), 2)
        ELSE NULL 
    END AS ROAS,
    
    -- CTR (Click Through Rate)
    CASE 
        WHEN SUM(f.Impressions) > 0 
        THEN ROUND((SUM(f.Clicks) * 100.0) / SUM(f.Impressions), 2)
        ELSE NULL 
    END AS CTR_Percentage

FROM fact_Metrics f
INNER JOIN dim_Campaigns c ON f.CampaignID = c.CampaignID
INNER JOIN dim_Clients cl ON f.ClientID = cl.ClientID
GROUP BY c.CampaignName, c.Objective, cl.ClientName
ORDER BY TotalSpend DESC;

-- =====================================================================
-- CONSULTA 2: ANÁLISIS DE RENDIMIENTO POR SEXO Y EDAD
-- Pregunta: Para una campaña específica, ¿qué segmentos de edad y género 
--           están generando más compras y a qué costo?
-- =====================================================================

SELECT 
    d.AgeBracket,
    d.Gender,
    SUM(f.Spend) AS Spend,
    SUM(f.Purchases) AS Purchases,
    SUM(f.Impressions) AS Impressions,
    SUM(f.Clicks) AS Clicks,
    
    -- Costo por Compra por segmento
    CASE 
        WHEN SUM(f.Purchases) > 0 
        THEN ROUND(SUM(f.Spend) / SUM(f.Purchases), 2)
        ELSE NULL 
    END AS CostPerPurchase,
    
    -- Porcentaje de compras del total
    ROUND(
        (SUM(f.Purchases) * 100.0) / 
        (SELECT SUM(Purchases) FROM fact_Metrics fm2 
         INNER JOIN dim_Campaigns c2 ON fm2.CampaignID = c2.CampaignID 
         WHERE c2.CampaignID = 1), 2
    ) AS PurchasePercentage

FROM fact_Metrics f
INNER JOIN dim_Demographics d ON f.DemographicID = d.DemographicID
INNER JOIN dim_Campaigns c ON f.CampaignID = c.CampaignID
WHERE c.CampaignID = 1  -- Filtrar por campaña específica (cambiar según necesidad)
GROUP BY d.AgeBracket, d.Gender
ORDER BY Purchases DESC, Spend DESC;

-- =====================================================================
-- CONSULTA 3: TOP 5 ANUNCIOS CON MEJOR RETORNO DE INVERSIÓN (ROAS)
-- Pregunta: ¿Cuáles son nuestros anuncios más rentables en toda la cuenta?
-- =====================================================================

SELECT TOP 5
    a.AdName,
    c.CampaignName,
    cl.ClientName,
    SUM(f.Spend) AS TotalSpend,
    SUM(f.PurchaseValue) AS TotalPurchaseValue,
    SUM(f.Purchases) AS TotalPurchases,
    
    -- ROAS (Return on Ad Spend)
    CASE 
        WHEN SUM(f.Spend) > 0 
        THEN ROUND(SUM(f.PurchaseValue) / SUM(f.Spend), 2)
        ELSE NULL 
    END AS ROAS

FROM fact_Metrics f
INNER JOIN dim_Ads a ON f.AdID = a.AdID
INNER JOIN dim_AdSets ads ON a.AdSetID = ads.AdSetID
INNER JOIN dim_Campaigns c ON ads.CampaignID = c.CampaignID
INNER JOIN dim_Clients cl ON c.ClientID = cl.ClientID
WHERE f.Spend > 0 AND f.PurchaseValue > 0  -- Solo anuncios con inversión y ventas
GROUP BY a.AdName, c.CampaignName, cl.ClientName
ORDER BY ROAS DESC, TotalPurchaseValue DESC;

-- =====================================================================
-- CONSULTA 4: EVOLUCIÓN DIARIA DEL GASTO VS. COMPRAS
-- Pregunta: ¿Cómo ha evolucionado nuestra inversión y nuestras ventas 
--           día a día durante el último mes?
-- =====================================================================

SELECT 
    d.FullDate,
    d.DayName,
    d.IsWeekend,
    SUM(f.Spend) AS DailySpend,
    SUM(f.Purchases) AS DailyPurchases,
    SUM(f.PurchaseValue) AS DailyRevenue,
    SUM(f.Impressions) AS DailyImpressions,
    SUM(f.Clicks) AS DailyClicks,
    
    -- ROAS diario
    CASE 
        WHEN SUM(f.Spend) > 0 
        THEN ROUND(SUM(f.PurchaseValue) / SUM(f.Spend), 2)
        ELSE NULL 
    END AS DailyROAS,
    
    -- CTR diario
    CASE 
        WHEN SUM(f.Impressions) > 0 
        THEN ROUND((SUM(f.Clicks) * 100.0) / SUM(f.Impressions), 2)
        ELSE NULL 
    END AS DailyCTR

FROM fact_Metrics f
INNER JOIN dim_Date d ON f.DateID = d.DateID
WHERE d.FullDate >= DATEADD(DAY, -30, GETDATE())  -- Últimos 30 días
GROUP BY d.FullDate, d.DayName, d.IsWeekend
ORDER BY d.FullDate DESC;

-- =====================================================================
-- CONSULTA 5: ANÁLISIS DE RENDIMIENTO POR PLATAFORMA Y DISPOSITIVO
-- Pregunta: ¿En qué plataforma y dispositivo se concentra nuestra inversión 
--           y cuáles convierten mejor?
-- =====================================================================

SELECT 
    p.Platform,
    p.Device,
    p.Position,
    SUM(f.Spend) AS TotalSpend,
    SUM(f.Purchases) AS TotalPurchases,
    SUM(f.Clicks) AS TotalClicks,
    SUM(f.Impressions) AS TotalImpressions,
    
    -- Tasa de conversión (Total Purchases * 100.0 / Total Clicks)
    CASE 
        WHEN SUM(f.Clicks) > 0 
        THEN ROUND((SUM(f.Purchases) * 100.0) / SUM(f.Clicks), 2)
        ELSE NULL 
    END AS ConversionRate,
    
    -- Costo por conversión
    CASE 
        WHEN SUM(f.Purchases) > 0 
        THEN ROUND(SUM(f.Spend) / SUM(f.Purchases), 2)
        ELSE NULL 
    END AS CostPerConversion,
    
    -- CTR por plataforma
    CASE 
        WHEN SUM(f.Impressions) > 0 
        THEN ROUND((SUM(f.Clicks) * 100.0) / SUM(f.Impressions), 2)
        ELSE NULL 
    END AS CTR,
    
    -- Porcentaje del gasto total
    ROUND(
        (SUM(f.Spend) * 100.0) / 
        (SELECT SUM(Spend) FROM fact_Metrics), 2
    ) AS SpendPercentage

FROM fact_Metrics f
INNER JOIN dim_Placements p ON f.PlacementID = p.PlacementID
GROUP BY p.Platform, p.Device, p.Position
ORDER BY TotalSpend DESC;

-- =====================================================================
-- CONSULTA BONUS: ANÁLISIS COMPARATIVO DE RENDIMIENTO POR CLIENTE
-- Pregunta: ¿Cómo se compara el rendimiento entre diferentes clientes?
-- =====================================================================

SELECT 
    cl.ClientName,
    COUNT(DISTINCT c.CampaignID) AS TotalCampaigns,
    COUNT(DISTINCT a.AdID) AS TotalAds,
    SUM(f.Spend) AS TotalSpend,
    SUM(f.Purchases) AS TotalPurchases,
    SUM(f.PurchaseValue) AS TotalRevenue,
    
    -- ROAS por cliente
    CASE 
        WHEN SUM(f.Spend) > 0 
        THEN ROUND(SUM(f.PurchaseValue) / SUM(f.Spend), 2)
        ELSE NULL 
    END AS ROAS,
    
    -- Costo promedio por compra
    CASE 
        WHEN SUM(f.Purchases) > 0 
        THEN ROUND(SUM(f.Spend) / SUM(f.Purchases), 2)
        ELSE NULL 
    END AS AvgCostPerPurchase,
    
    -- Gasto promedio por campaña
    CASE 
        WHEN COUNT(DISTINCT c.CampaignID) > 0 
        THEN ROUND(SUM(f.Spend) / COUNT(DISTINCT c.CampaignID), 2)
        ELSE NULL 
    END AS AvgSpendPerCampaign

FROM fact_Metrics f
INNER JOIN dim_Clients cl ON f.ClientID = cl.ClientID
INNER JOIN dim_Campaigns c ON f.CampaignID = c.CampaignID
INNER JOIN dim_Ads a ON f.AdID = a.AdID
GROUP BY cl.ClientName
ORDER BY TotalSpend DESC;

/*
=====================================================================
INSTRUCCIONES DE USO:

1. Ejecute el script create-star-schema.sql primero para crear la estructura
2. Importe datos de Excel usando la nueva funcionalidad del servidor
3. Ejecute estas consultas para análisis de rendimiento

NOTAS:
- Ajuste el CampaignID en la consulta 2 según sus necesidades
- Los últimos 30 días en la consulta 4 se calculan desde GETDATE()
- Todas las consultas incluyen validaciones para evitar división por cero
- Los porcentajes se redondean a 2 decimales para mejor legibilidad
=====================================================================
*/