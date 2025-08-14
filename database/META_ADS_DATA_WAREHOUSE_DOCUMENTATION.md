# Meta Ads Data Warehouse - Documentación Completa

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Modelo de Datos](#modelo-de-datos)
4. [Instalación y Configuración](#instalación-y-configuración)
5. [Proceso ETL](#proceso-etl)
6. [Queries Analíticas](#queries-analíticas)
7. [Monitoreo y Mantenimiento](#monitoreo-y-mantenimiento)
8. [Troubleshooting](#troubleshooting)
9. [Optimización y Performance](#optimización-y-performance)
10. [Roadmap](#roadmap)

---

## 🎯 Visión General

### Propósito
Este Data Warehouse dimensional está diseñado específicamente para analizar datos de Meta Ads (Facebook/Instagram) con un enfoque empresarial robusto. Implementa las mejores prácticas de Business Intelligence y está optimizado para SQL Server Express.

### Características Principales
- **Arquitectura por Capas**: Raw → Staging → Dimensional (Star Schema)
- **Modelo Dimensional**: Fact table con 13+ dimensiones relacionadas
- **SCD Tipo 2**: Para tracking de cambios en campañas, adsets y ads
- **Performance Optimizado**: Índices Columnstore para agregaciones rápidas
- **ETL Robusto**: Validaciones, logging y manejo de errores completo
- **Analítica Avanzada**: Queries pre-construidas para insights clave

### Beneficios de Negocio
- **Análisis Demográfico**: Rendimiento por edad y género
- **Optimización de Audiencias**: Qué públicos generan mejor ROAS
- **Evolución Temporal**: Tracking de cambios en configuraciones
- **Performance Insights**: CTR, CPC, ROAS, frequency analysis
- **Escalabilidad**: Preparado para múltiples cuentas y países

---

## 🏗️ Arquitectura del Sistema

### Capas de Datos

```
┌─────────────────────────┐
│   CAPA 2: DIMENSIONAL   │
│   (Star Schema)         │
│                         │
│  ┌─────────────────┐   │
│  │   Fact Table    │   │
│  │ fact_meta_daily │   │
│  └─────────┬───────┘   │
│            │           │
│  ┌─────────┴───────┐   │
│  │   Dimensions    │   │
│  │  13 dim_* tabs  │   │
│  └─────────────────┘   │
└─────────────────────────┘
            ↑
┌─────────────────────────┐
│   CAPA 1: STAGING       │
│   (Normalización)       │
│                         │
│  ┌─────────────────┐   │
│  │ stg_meta_daily  │   │
│  │    (Vista)      │   │
│  └─────────────────┘   │
└─────────────────────────┘
            ↑
┌─────────────────────────┐
│   CAPA 0: RAW           │
│   (Landing)             │
│                         │
│  ┌─────────────────┐   │
│  │ raw_meta_rows   │   │
│  │  (Tabla física) │   │
│  └─────────────────┘   │
└─────────────────────────┘
```

### Flujo de Datos

1. **Aterrizaje (Raw)**: Excel → `raw_meta_rows` (todas las columnas como nvarchar)
2. **Normalización (Staging)**: `stg_meta_daily` vista que limpia y convierte tipos
3. **Dimensionalización**: Upserts en dimensiones con SCD Tipo 2
4. **Agregación**: Insert en `fact_meta_daily` con grano día+cuenta+campaña+adset+ad+edad+género

---

## 📊 Modelo de Datos

### Grano del Fact Table
**Una fila por**: Día + Cuenta + Campaña + AdSet + Ad + Edad + Género

### Dimensiones

| Dimensión | Tipo SCD | Descripción |
|-----------|----------|-------------|
| `dim_date` | N/A | Calendario con atributos fiscales |
| `dim_account` | Tipo 1 | Cuentas de Meta Ads |
| `dim_currency` | Tipo 1 | Monedas (EUR, USD, etc.) |
| `dim_campaign` | **Tipo 2** | Campañas con historial de cambios |
| `dim_adset` | **Tipo 2** | AdSets con historial de cambios |
| `dim_ad` | **Tipo 2** | Anuncios con historial de cambios |
| `dim_age` | Tipo 1 | Rangos etarios (18-24, 25-34, etc.) |
| `dim_gender` | Tipo 1 | Género (Masculino, Femenino, Todos) |
| `dim_audience` | Tipo 1 | Públicos personalizados |
| `dim_objective` | Tipo 1 | Objetivos de campaña |
| `dim_budget_type` | Tipo 1 | Tipos de presupuesto |
| `dim_status` | Tipo 1 | Estados (Active, Paused, etc.) |
| `dim_url` | Tipo 1 | URLs de landing pages |

### Bridges (Many-to-Many)
- `bridge_adset_audience_included`: AdSets ↔ Audiencias incluidas
- `bridge_adset_audience_excluded`: AdSets ↔ Audiencias excluidas

### Fact Table: `fact_meta_daily`

#### Métricas Principales
```sql
-- Inversión y alcance
spend DECIMAL(15,4)
impressions BIGINT
reach BIGINT
frequency DECIMAL(10,4)

-- Clics y conversiones
clicks_all BIGINT
link_clicks BIGINT
landing_page_views BIGINT
purchases BIGINT
conversion_value DECIMAL(15,4)

-- Video metrics
video_3s, video_25, video_50, video_75, video_95, video_100 BIGINT
thruplays BIGINT
avg_watch_time DECIMAL(10,4)

-- Engagement
post_interactions, post_reactions, post_comments BIGINT
post_shares, page_likes BIGINT

-- Embudo
add_to_cart, initiate_checkout BIGINT

-- Métricas propietarias (si aplican)
atencion, interes, deseo DECIMAL(15,4)
```

#### Métricas Calculadas (NO almacenadas)
- **CTR**: `clicks_all / NULLIF(impressions,0)`
- **CPC**: `spend / NULLIF(clicks_all,0)`
- **CPM**: `1000 * spend / NULLIF(impressions,0)`
- **ROAS**: `conversion_value / NULLIF(spend,0)`
- **CVR**: `purchases / NULLIF(link_clicks,0)`

---

## 🚀 Instalación y Configuración

### 1. Prerrequisitos
- SQL Server Express 2019+ (o versión completa)
- Permisos de creación de base de datos
- Excel con datos de Meta Ads

### 2. Instalación

```sql
-- Paso 1: Crear la estructura dimensional
sqlcmd -S localhost -i meta_ads_star_schema.sql

-- Paso 2: Crear vistas de staging
sqlcmd -S localhost -i staging_views.sql

-- Paso 3: Crear procedimientos de upsert
sqlcmd -S localhost -i dimension_upsert_procedures.sql

-- Paso 4: Crear procedimiento maestro
sqlcmd -S localhost -i master_load_procedure.sql
```

### 3. Verificación de Instalación

```sql
USE MetaAdsDW;

-- Verificar tablas creadas
SELECT TABLE_NAME, TABLE_TYPE 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_SCHEMA = 'dbo'
ORDER BY TABLE_NAME;

-- Verificar dimensiones pobladas
SELECT 'dim_currency' as tabla, COUNT(*) as filas FROM dim_currency
UNION ALL SELECT 'dim_gender', COUNT(*) FROM dim_gender
UNION ALL SELECT 'dim_age', COUNT(*) FROM dim_age;

-- Verificar procedimientos
SELECT ROUTINE_NAME 
FROM INFORMATION_SCHEMA.ROUTINES 
WHERE ROUTINE_TYPE = 'PROCEDURE';
```

---

## ⚙️ Proceso ETL

### Flujo Completo

#### 1. Preparación del Excel
- Asegurar que tiene todas las columnas requeridas
- Formato de fecha: DD/MM/YYYY
- Decimales con coma (,) para importes
- Separador de miles con punto (.) para impresiones

#### 2. Carga Raw

```sql
-- Ejemplo de carga desde Excel (ajustar según método)
-- Opción A: SQL Server Import Wizard hacia raw_meta_rows
-- Opción B: BULK INSERT (requiere archivo CSV)

-- Generar batch_id único
DECLARE @batch_id INT = NEXT VALUE FOR seq_batch_id; -- Crear secuencia previamente

-- BULK INSERT ejemplo (ajustar ruta)
BULK INSERT MetaAdsDW.dbo.raw_meta_rows
FROM 'C:\data\meta_ads_export.csv'
WITH (
    FIELDTERMINATOR = ';',
    ROWTERMINATOR = '\n',
    FIRSTROW = 2,
    CODEPAGE = '65001' -- UTF-8
);

-- Actualizar import_batch_id y metadata
UPDATE raw_meta_rows 
SET import_batch_id = @batch_id,
    file_hash = 'HASH_DEL_ARCHIVO',
    row_num = ROW_NUMBER() OVER (ORDER BY (SELECT NULL))
WHERE import_batch_id IS NULL;
```

#### 3. Validación Previa

```sql
-- Validar calidad de datos
EXEC sp_load_meta_excel_batch 
    @batch_id = 123,
    @validate_only = 1;  -- Solo validar, no cargar
```

#### 4. Carga Completa

```sql
-- Carga completa con validaciones
EXEC sp_load_meta_excel_batch 
    @batch_id = 123,
    @validate_only = 0,
    @force_reload = 0,
    @max_error_percentage = 5.0;
```

### Monitoreo de Carga

```sql
-- Ver estado de batches
SELECT * FROM v_etl_batch_summary 
ORDER BY batch_start_time DESC;

-- Ver log detallado de un batch
SELECT * FROM etl_log 
WHERE batch_id = 123 
ORDER BY start_time;

-- Ver errores de validación
SELECT * FROM etl_rejections 
WHERE batch_id = 123;

-- Ver filas problemáticas
SELECT * FROM stg_meta_daily_errors 
WHERE import_batch_id = 123;
```

---

## 📈 Queries Analíticas

### 1. Dashboard Ejecutivo

```sql
-- Resumen de performance por cuenta (últimos 30 días)
SELECT 
    a.account_name,
    SUM(f.spend) AS total_spend,
    SUM(f.impressions) AS total_impressions,
    SUM(f.purchases) AS total_purchases,
    SUM(f.conversion_value) AS total_revenue,
    
    -- KPIs calculados
    CAST(SUM(f.conversion_value) / NULLIF(SUM(f.spend), 0) AS DECIMAL(10,2)) AS roas,
    CAST(SUM(f.spend) / NULLIF(SUM(f.purchases), 0) AS DECIMAL(10,2)) AS cpa,
    CAST(100.0 * SUM(f.link_clicks) / NULLIF(SUM(f.impressions), 0) AS DECIMAL(5,2)) AS ctr_link,
    CAST(1000.0 * SUM(f.spend) / NULLIF(SUM(f.impressions), 0) AS DECIMAL(10,2)) AS cpm
    
FROM fact_meta_daily f
INNER JOIN dim_date d ON f.date_id = d.date_id
INNER JOIN dim_account a ON f.account_id = a.account_id
WHERE d.date >= DATEADD(DAY, -30, GETDATE())
GROUP BY a.account_name
ORDER BY total_spend DESC;
```

### 2. Análisis Demográfico

```sql
-- Performance por edad y género (configurable por fecha)
WITH demographic_performance AS (
    SELECT 
        a.account_name,
        age.age_label,
        g.gender_label,
        SUM(f.spend) AS spend,
        SUM(f.impressions) AS impressions,
        SUM(f.purchases) AS purchases,
        SUM(f.conversion_value) AS revenue,
        COUNT(DISTINCT CONCAT(f.campaign_id, '|', f.ad_id)) AS unique_ads
    FROM fact_meta_daily f
    INNER JOIN dim_date d ON f.date_id = d.date_id
    INNER JOIN dim_account a ON f.account_id = a.account_id
    INNER JOIN dim_age age ON f.age_id = age.age_id
    INNER JOIN dim_gender g ON f.gender_id = g.gender_id
    WHERE d.date BETWEEN '2024-01-01' AND '2024-12-31'
    GROUP BY a.account_name, age.age_label, g.gender_label
)
SELECT 
    *,
    CAST(revenue / NULLIF(spend, 0) AS DECIMAL(10,2)) AS roas,
    CAST(spend / NULLIF(purchases, 0) AS DECIMAL(10,2)) AS cpa,
    -- Ranking por ROAS dentro de cada cuenta
    ROW_NUMBER() OVER (PARTITION BY account_name ORDER BY revenue / NULLIF(spend, 0) DESC) AS roas_rank
FROM demographic_performance
WHERE spend > 100  -- Filtrar segmentos con inversión mínima
ORDER BY account_name, roas DESC;
```

### 3. Análisis de Audiencias

```sql
-- ¿Qué audiencias incluidas generan mejor ROAS?
WITH audience_performance AS (
    SELECT 
        au.audience_name,
        COUNT(DISTINCT f.adset_id) AS adsets_using,
        SUM(f.spend) AS total_spend,
        SUM(f.conversion_value) AS total_revenue,
        SUM(f.purchases) AS total_purchases,
        AVG(CAST(f.conversion_value / NULLIF(f.spend, 0) AS DECIMAL(10,4))) AS avg_roas
    FROM fact_meta_daily f
    INNER JOIN dim_date d ON f.date_id = d.date_id
    INNER JOIN bridge_adset_audience_included b ON f.adset_id = b.adset_id
    INNER JOIN dim_audience au ON b.audience_id = au.audience_id
    WHERE d.date >= DATEADD(DAY, -90, GETDATE())  -- Últimos 3 meses
    GROUP BY au.audience_name
    HAVING SUM(f.spend) > 500  -- Mínimo de inversión para ser relevante
)
SELECT 
    *,
    CAST(total_revenue / NULLIF(total_spend, 0) AS DECIMAL(10,2)) AS actual_roas,
    CAST(total_spend / NULLIF(total_purchases, 0) AS DECIMAL(10,2)) AS cpa
FROM audience_performance
ORDER BY actual_roas DESC;
```

### 4. Análisis de Evolución (SCD Tipo 2)

```sql
-- Tracking de cambios en campañas y su impacto
WITH campaign_versions AS (
    SELECT 
        c.campaign_natural_key,
        c.campaign_name,
        c.scd_version,
        c.scd_valid_from,
        c.scd_valid_to,
        o.objective_name,
        st.status_name,
        bt.budget_type_name,
        
        -- Performance de cada versión
        SUM(f.spend) AS version_spend,
        SUM(f.conversion_value) AS version_revenue,
        COUNT(DISTINCT f.date_id) AS days_active
        
    FROM dim_campaign c
    LEFT JOIN fact_meta_daily f ON c.campaign_id = f.campaign_id
    LEFT JOIN dim_objective o ON c.objective_id = o.objective_id
    LEFT JOIN dim_status st ON c.status_id = st.status_id
    LEFT JOIN dim_budget_type bt ON c.budget_type_id = bt.budget_type_id
    WHERE c.scd_version > 1  -- Solo campañas que han cambiado
    GROUP BY c.campaign_natural_key, c.campaign_name, c.scd_version, 
             c.scd_valid_from, c.scd_valid_to, o.objective_name, 
             st.status_name, bt.budget_type_name
)
SELECT 
    *,
    CAST(version_revenue / NULLIF(version_spend, 0) AS DECIMAL(10,2)) AS version_roas,
    DATEDIFF(DAY, scd_valid_from, ISNULL(scd_valid_to, GETDATE())) AS version_duration_days
FROM campaign_versions
ORDER BY campaign_natural_key, scd_version;
```

### 5. Análisis de Video Performance

```sql
-- Performance de contenido de video vs estático
SELECT 
    CASE 
        WHEN SUM(f.video_3s) > 0 THEN 'Video'
        ELSE 'Estático'
    END AS creative_type,
    
    COUNT(DISTINCT f.ad_id) AS unique_ads,
    SUM(f.spend) AS total_spend,
    SUM(f.impressions) AS total_impressions,
    SUM(f.link_clicks) AS total_link_clicks,
    SUM(f.purchases) AS total_purchases,
    SUM(f.conversion_value) AS total_revenue,
    
    -- Métricas específicas de video
    SUM(f.video_3s) AS total_3s_views,
    SUM(f.video_100) AS total_complete_views,
    AVG(f.avg_watch_time) AS avg_watch_time,
    
    -- KPIs
    CAST(SUM(f.conversion_value) / NULLIF(SUM(f.spend), 0) AS DECIMAL(10,2)) AS roas,
    CAST(100.0 * SUM(f.link_clicks) / NULLIF(SUM(f.impressions), 0) AS DECIMAL(5,2)) AS ctr,
    CAST(100.0 * SUM(f.video_100) / NULLIF(SUM(f.video_3s), 0) AS DECIMAL(5,2)) AS completion_rate
    
FROM fact_meta_daily f
INNER JOIN dim_date d ON f.date_id = d.date_id
WHERE d.date >= DATEADD(DAY, -60, GETDATE())
GROUP BY CASE WHEN SUM(f.video_3s) > 0 THEN 'Video' ELSE 'Estático' END
ORDER BY total_spend DESC;
```

### 6. Cohort Analysis por Día de Lanzamiento

```sql
-- Análisis de cohorte: performance por día de lanzamiento de anuncio
WITH ad_launch_dates AS (
    SELECT 
        ad.ad_id,
        ad.ad_name,
        MIN(d.date) AS launch_date
    FROM fact_meta_daily f
    INNER JOIN dim_ad ad ON f.ad_id = ad.ad_id
    INNER JOIN dim_date d ON f.date_id = d.date_id
    GROUP BY ad.ad_id, ad.ad_name
),
cohort_performance AS (
    SELECT 
        YEAR(ald.launch_date) AS launch_year,
        MONTH(ald.launch_date) AS launch_month,
        DATEDIFF(DAY, ald.launch_date, d.date) AS days_since_launch,
        
        COUNT(DISTINCT f.ad_id) AS active_ads,
        SUM(f.spend) AS cohort_spend,
        SUM(f.conversion_value) AS cohort_revenue
        
    FROM fact_meta_daily f
    INNER JOIN dim_date d ON f.date_id = d.date_id
    INNER JOIN ad_launch_dates ald ON f.ad_id = ald.ad_id
    WHERE DATEDIFF(DAY, ald.launch_date, d.date) BETWEEN 0 AND 30  -- Primeros 30 días
    GROUP BY YEAR(ald.launch_date), MONTH(ald.launch_date), 
             DATEDIFF(DAY, ald.launch_date, d.date)
)
SELECT 
    CONCAT(launch_year, '-', FORMAT(launch_month, '00')) AS launch_month,
    days_since_launch,
    active_ads,
    cohort_spend,
    cohort_revenue,
    CAST(cohort_revenue / NULLIF(cohort_spend, 0) AS DECIMAL(10,2)) AS cohort_roas
FROM cohort_performance
ORDER BY launch_year, launch_month, days_since_launch;
```

---

## 📊 Vistas Analíticas Pre-construidas

### Crear Vistas para BI Tools

```sql
-- Vista para Tableau/Power BI: Resumen diario por campaña
CREATE VIEW v_daily_campaign_performance AS
SELECT 
    d.date,
    a.account_name,
    c.campaign_name,
    o.objective_name,
    SUM(f.spend) AS spend,
    SUM(f.impressions) AS impressions,
    SUM(f.link_clicks) AS link_clicks,
    SUM(f.purchases) AS purchases,
    SUM(f.conversion_value) AS revenue,
    
    -- KPIs calculados
    CAST(SUM(f.conversion_value) / NULLIF(SUM(f.spend), 0) AS DECIMAL(10,4)) AS roas,
    CAST(SUM(f.spend) / NULLIF(SUM(f.purchases), 0) AS DECIMAL(10,2)) AS cpa,
    CAST(100.0 * SUM(f.link_clicks) / NULLIF(SUM(f.impressions), 0) AS DECIMAL(6,4)) AS ctr_link,
    CAST(1000.0 * SUM(f.spend) / NULLIF(SUM(f.impressions), 0) AS DECIMAL(10,4)) AS cpm
    
FROM fact_meta_daily f
INNER JOIN dim_date d ON f.date_id = d.date_id
INNER JOIN dim_account a ON f.account_id = a.account_id
INNER JOIN dim_campaign c ON f.campaign_id = c.campaign_id
INNER JOIN dim_objective o ON c.objective_id = o.objective_id
GROUP BY d.date, a.account_name, c.campaign_name, o.objective_name;

-- Vista para análisis de anuncios con métricas completas
CREATE VIEW v_ad_performance_complete AS
SELECT 
    a.account_name,
    c.campaign_name,
    ads.adset_name,
    ad.ad_name,
    d.date,
    age.age_label,
    g.gender_label,
    
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
    
    -- Video métricas
    f.video_3s,
    f.video_25,
    f.video_50,
    f.video_75,
    f.video_100,
    f.thruplays,
    f.avg_watch_time,
    
    -- Métricas calculadas
    CAST(f.conversion_value / NULLIF(f.spend, 0) AS DECIMAL(10,4)) AS roas,
    CAST(f.spend / NULLIF(f.purchases, 0) AS DECIMAL(10,2)) AS cpa,
    CAST(100.0 * f.link_clicks / NULLIF(f.impressions, 0) AS DECIMAL(6,4)) AS ctr_link,
    CAST(1000.0 * f.spend / NULLIF(f.impressions, 0) AS DECIMAL(10,4)) AS cpm,
    CAST(100.0 * f.purchases / NULLIF(f.link_clicks, 0) AS DECIMAL(6,4)) AS cvr_link,
    CAST(100.0 * f.video_100 / NULLIF(f.video_3s, 0) AS DECIMAL(6,4)) AS video_completion_rate
    
FROM fact_meta_daily f
INNER JOIN dim_date d ON f.date_id = d.date_id
INNER JOIN dim_account a ON f.account_id = a.account_id
INNER JOIN dim_campaign c ON f.campaign_id = c.campaign_id
INNER JOIN dim_adset ads ON f.adset_id = ads.adset_id
INNER JOIN dim_ad ad ON f.ad_id = ad.ad_id
INNER JOIN dim_age age ON f.age_id = age.age_id
INNER JOIN dim_gender g ON f.gender_id = g.gender_id;
```

---

## 🔧 Monitoreo y Mantenimiento

### 1. Queries de Salud del Sistema

```sql
-- Verificar integridad referencial
SELECT 
    'Fact records with missing dimensions' AS check_type,
    COUNT(*) AS issue_count
FROM fact_meta_daily f
WHERE NOT EXISTS (SELECT 1 FROM dim_date d WHERE f.date_id = d.date_id)
   OR NOT EXISTS (SELECT 1 FROM dim_account a WHERE f.account_id = a.account_id)
   OR NOT EXISTS (SELECT 1 FROM dim_campaign c WHERE f.campaign_id = c.campaign_id);

-- Verificar SCD Tipo 2 consistency
SELECT 
    'Campaigns with overlapping valid periods' AS check_type,
    COUNT(*) AS issue_count
FROM dim_campaign c1
INNER JOIN dim_campaign c2 ON c1.campaign_natural_key = c2.campaign_natural_key
    AND c1.campaign_id != c2.campaign_id
    AND c1.scd_valid_from < c2.scd_valid_to
    AND c2.scd_valid_from < c1.scd_valid_to;

-- Estadísticas de volumen por tabla
SELECT 
    'fact_meta_daily' AS table_name,
    COUNT(*) AS row_count,
    MIN(created_at) AS oldest_record,
    MAX(created_at) AS newest_record
FROM fact_meta_daily
UNION ALL
SELECT 'raw_meta_rows', COUNT(*), MIN(loaded_at), MAX(loaded_at) FROM raw_meta_rows
UNION ALL
SELECT 'etl_log', COUNT(*), MIN(start_time), MAX(start_time) FROM etl_log;
```

### 2. Performance Monitoring

```sql
-- Query performance más lentas
SELECT 
    qs.sql_handle,
    qs.total_elapsed_time / qs.execution_count AS avg_duration_ms,
    qs.execution_count,
    qt.text AS query_text
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) qt
WHERE qt.text LIKE '%fact_meta_daily%'
ORDER BY avg_duration_ms DESC;

-- Utilización de índices Columnstore
SELECT 
    i.name AS index_name,
    ios.leaf_insert_count,
    ios.leaf_delete_count,
    ios.leaf_update_count,
    ios.nonleaf_insert_count
FROM sys.dm_db_index_operational_stats(DB_ID(), OBJECT_ID('fact_meta_daily'), NULL, NULL) ios
INNER JOIN sys.indexes i ON ios.object_id = i.object_id AND ios.index_id = i.index_id
WHERE i.type = 6;  -- Columnstore
```

### 3. Mantenimiento Automático

```sql
-- Procedimiento de limpieza de datos antiguos
CREATE PROCEDURE usp_cleanup_old_data
    @retention_days INT = 1095  -- 3 años por defecto
AS
BEGIN
    DECLARE @cutoff_date DATE = DATEADD(DAY, -@retention_days, GETDATE());
    
    -- Limpiar raw data antigua
    DELETE FROM raw_meta_rows 
    WHERE loaded_at < @cutoff_date;
    
    -- Limpiar logs antiguos (mantener 1 año)
    DELETE FROM etl_log 
    WHERE start_time < DATEADD(DAY, -365, GETDATE());
    
    -- Limpiar rechazos antiguos
    DELETE FROM etl_rejections 
    WHERE created_at < DATEADD(DAY, -365, GETDATE());
    
    PRINT CONCAT('Cleanup completed for data older than ', @cutoff_date);
END;

-- Programar con SQL Server Agent (si disponible)
-- O ejecutar mensualmente
```

### 4. Backup y Recovery

```sql
-- Backup completo
BACKUP DATABASE MetaAdsDW 
TO DISK = 'C:\Backup\MetaAdsDW_Full.bak'
WITH COMPRESSION, CHECKSUM;

-- Backup diferencial (diario)
BACKUP DATABASE MetaAdsDW 
TO DISK = 'C:\Backup\MetaAdsDW_Diff.bak'
WITH DIFFERENTIAL, COMPRESSION, CHECKSUM;

-- Backup de log (si en modo FULL)
BACKUP LOG MetaAdsDW 
TO DISK = 'C:\Backup\MetaAdsDW_Log.trn';
```

---

## 🚨 Troubleshooting

### Problemas Comunes

#### 1. Error en Carga ETL

**Síntoma**: `sp_load_meta_excel_batch` falla
```sql
-- Diagnóstico
SELECT * FROM etl_log 
WHERE batch_id = [BATCH_ID] AND step_status = 'FAILED'
ORDER BY start_time DESC;

-- Ver errores específicos
SELECT * FROM etl_rejections 
WHERE batch_id = [BATCH_ID];

-- Ver datos problemáticos
SELECT * FROM stg_meta_daily_errors 
WHERE import_batch_id = [BATCH_ID];
```

**Soluciones**:
- Verificar formato de fechas en Excel (DD/MM/YYYY)
- Validar que no falten columnas obligatorias
- Revisar caracteres especiales en nombres de anuncios

#### 2. Performance Lenta

**Síntoma**: Queries analíticas muy lentas
```sql
-- Verificar fragmentación de índices
SELECT 
    i.name AS index_name,
    ps.avg_fragmentation_in_percent,
    ps.page_count
FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('fact_meta_daily'), NULL, NULL, 'DETAILED') ps
INNER JOIN sys.indexes i ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE ps.avg_fragmentation_in_percent > 30;

-- Reconstruir índices si es necesario
ALTER INDEX IX_fact_meta_daily_cs ON fact_meta_daily REBUILD;
```

#### 3. Datos Duplicados

**Síntoma**: Fact table con duplicados
```sql
-- Detectar duplicados
SELECT 
    date_id, account_id, campaign_id, adset_id, ad_id, age_id, gender_id,
    COUNT(*) AS duplicate_count
FROM fact_meta_daily
GROUP BY date_id, account_id, campaign_id, adset_id, ad_id, age_id, gender_id
HAVING COUNT(*) > 1;

-- Limpiar duplicados (mantener el más reciente)
WITH duplicates AS (
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY date_id, account_id, campaign_id, adset_id, ad_id, age_id, gender_id 
            ORDER BY created_at DESC
        ) AS rn
    FROM fact_meta_daily
)
DELETE FROM duplicates WHERE rn > 1;
```

### Logs de Auditoría

```sql
-- Query para análisis completo de un batch
SELECT 
    'ETL Steps' AS section,
    step_name,
    step_status,
    duration_ms,
    rows_processed,
    error_message
FROM etl_log 
WHERE batch_id = [BATCH_ID]

UNION ALL

SELECT 
    'Data Quality' AS section,
    'Total Rows' AS step_name,
    CAST(total_rows AS NVARCHAR(20)) AS step_status,
    NULL AS duration_ms,
    valid_rows AS rows_processed,
    CONCAT('Error %: ', FORMAT(100.0 * (total_rows - valid_rows) / total_rows, 'F2')) AS error_message
FROM stg_meta_daily_validation 
WHERE import_batch_id = [BATCH_ID]

ORDER BY section, step_name;
```

---

## ⚡ Optimización y Performance

### 1. Índices Especializados

```sql
-- Para análisis de trending (queries por fecha reciente)
CREATE NONCLUSTERED INDEX IX_fact_meta_daily_recent_date 
ON fact_meta_daily (date_id DESC) 
WHERE date_id >= (SELECT date_id FROM dim_date WHERE date = DATEADD(DAY, -90, GETDATE()))
INCLUDE (account_id, spend, conversion_value);

-- Para análisis por campaña específica
CREATE NONCLUSTERED INDEX IX_fact_meta_daily_campaign_performance 
ON fact_meta_daily (campaign_id, date_id) 
INCLUDE (spend, impressions, purchases, conversion_value);
```

### 2. Partitioning (Si SQL Server Standard/Enterprise)

```sql
-- Función de partición por año
CREATE PARTITION FUNCTION pf_year_range (DATE)
AS RANGE RIGHT FOR VALUES 
('2022-01-01', '2023-01-01', '2024-01-01', '2025-01-01');

-- Esquema de partición
CREATE PARTITION SCHEME ps_year_range
AS PARTITION pf_year_range
ALL TO ([PRIMARY]);

-- Aplicar a fact table (requiere reconstrucción)
-- CREATE TABLE fact_meta_daily_new (...) ON ps_year_range(date_id)
```

### 3. Vistas Materializadas (Simuladas)

```sql
-- Crear tabla agregada para dashboards ejecutivos
CREATE TABLE agg_daily_account_summary (
    date_id INT,
    account_id INT,
    total_spend DECIMAL(15,4),
    total_impressions BIGINT,
    total_purchases BIGINT,
    total_revenue DECIMAL(15,4),
    avg_cpm DECIMAL(10,4),
    avg_roas DECIMAL(10,4),
    updated_at DATETIME2 DEFAULT SYSDATETIME(),
    
    PRIMARY KEY (date_id, account_id)
);

-- Procedimiento para refrescar agregados
CREATE PROCEDURE usp_refresh_daily_aggregates
    @start_date DATE = NULL
AS
BEGIN
    SET @start_date = ISNULL(@start_date, DATEADD(DAY, -7, GETDATE()));
    
    -- Limpiar datos existentes del rango
    DELETE FROM agg_daily_account_summary 
    WHERE date_id IN (SELECT date_id FROM dim_date WHERE date >= @start_date);
    
    -- Insertar nuevos agregados
    INSERT INTO agg_daily_account_summary (
        date_id, account_id, total_spend, total_impressions, 
        total_purchases, total_revenue, avg_cpm, avg_roas
    )
    SELECT 
        f.date_id,
        f.account_id,
        SUM(f.spend),
        SUM(f.impressions),
        SUM(f.purchases),
        SUM(f.conversion_value),
        AVG(CAST(1000.0 * f.spend / NULLIF(f.impressions, 0) AS DECIMAL(10,4))),
        AVG(CAST(f.conversion_value / NULLIF(f.spend, 0) AS DECIMAL(10,4)))
    FROM fact_meta_daily f
    INNER JOIN dim_date d ON f.date_id = d.date_id
    WHERE d.date >= @start_date
    GROUP BY f.date_id, f.account_id;
END;
```

---

## 🗺️ Roadmap

### Fase 2: Expansión Dimensional
- **dim_placement**: Desktop, Mobile, Instagram, etc.
- **dim_device**: Device targeting analysis
- **dim_geography**: Country/region performance
- **dim_creative_format**: Single image, carousel, video, etc.

### Fase 3: Machine Learning Integration
- **Tablas de Features**: Para alimentar modelos ML
- **Predicciones**: Forecast de performance
- **Anomaly Detection**: Alertas automáticas
- **Optimization**: Recomendaciones de bid/budget

### Fase 4: Advanced Analytics
- **Attribution Modeling**: Multi-touch attribution
- **Incrementality**: Test vs control analysis
- **Customer Journey**: Cross-platform tracking
- **Advanced Segmentation**: RFM, CLV analysis

### Fase 5: Cloud Migration
- **Azure Synapse**: Para procesamiento masivo
- **Power BI Premium**: Dashboards corporativos
- **Azure ML**: Modelos de IA/ML
- **Real-time Analytics**: Event streaming

---

## 📞 Soporte

### Contacto
- **Arquitecto de Datos**: [Tu información]
- **Documentación**: Este archivo + comentarios en código
- **Repositorio**: [URL del repositorio]

### Recursos Adicionales
- [Microsoft SQL Server Best Practices](https://docs.microsoft.com/sql)
- [Kimball Dimensional Modeling](https://www.kimballgroup.com/)
- [Meta Ads API Documentation](https://developers.facebook.com/docs/marketing-api/)

---

**© 2024 - Meta Ads Data Warehouse v1.0**
*Diseñado con metodología Kimball para análisis empresarial de Meta Ads*