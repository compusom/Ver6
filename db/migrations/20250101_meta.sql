-- Schema changes for Meta report import
ALTER TABLE metricas
  ALTER COLUMN públicos_personalizados_incluidos NVARCHAR(MAX),
  ALTER COLUMN públicos_personalizados_excluidos NVARCHAR(MAX);

ALTER TABLE metricas
  ALTER COLUMN ad_preview_link NVARCHAR(512),
  ALTER COLUMN ad_creative_thumbnail_url NVARCHAR(512);

ALTER TABLE metricas
  ADD CONSTRAINT UQ_metricas_reporte UNIQUE(id_reporte, unique_id);

ALTER TABLE ads ADD is_synthetic BIT NOT NULL DEFAULT(0);

CREATE UNIQUE INDEX UX_facts_meta_client_date_ad ON facts_meta(client_id, [date], ad_id);
CREATE UNIQUE INDEX UX_ads_client_name_norm ON ads(client_id, ad_name_norm);
