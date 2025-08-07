export const TABLES = {
  clientes: {
    create: `
        CREATE TABLE clientes (
            id_cliente INT IDENTITY(1,1) PRIMARY KEY,
            nombre_cuenta VARCHAR(255) UNIQUE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `,
    dependencies: []
  },
  archivos_reporte: {
    create: `
        CREATE TABLE archivos_reporte (
            id_reporte INT IDENTITY(1,1) PRIMARY KEY,
            id_cliente INT NOT NULL,
            nombre_archivo VARCHAR(255),
            hash_archivo CHAR(64) UNIQUE NOT NULL,
            period_start DATE,
            period_end DATE,
            days_detected INT,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
        )
    `,
    dependencies: ['clientes']
  },
  metricas: {
    create: `
        CREATE TABLE metricas (
            id_metricas BIGINT IDENTITY(1,1) PRIMARY KEY,
            id_reporte INT NOT NULL,
            [unique_id] VARCHAR(255) NOT NULL,
            [nombre_de_la_campaña] VARCHAR(255),
            [nombre_del_conjunto_de_anuncios] VARCHAR(255),
            [nombre_del_anuncio] VARCHAR(255),
            [dia] DATE,
            [edad] VARCHAR(50),
            [sexo] VARCHAR(50),
            [importe_gastado_EUR] DECIMAL(12,2),
            [entrega_de_la_campaña] VARCHAR(50),
            [entrega_del_conjunto_de_anuncios] VARCHAR(50),
            [entrega_del_anuncio] VARCHAR(50),
            [impresiones] BIGINT,
            [alcance] BIGINT,
            [frecuencia] DECIMAL(5,2),
            [compras] INT,
            [visitas_a_la_página_de_destino] INT,
            [clics_todos] INT,
            [cpm_costo_por_mil_impresiones] DECIMAL(12,2),
            [ctr_todos] DECIMAL(5,2),
            [cpc_todos] DECIMAL(12,2),
            [reproducciones_3s] BIGINT,
            [pagos_iniciados] INT,
            [pct_compras_por_visitas_lp] DECIMAL(5,2),
            [me_gusta_en_facebook] INT,
            [artículos_agregados_al_carrito] INT,
            [pagos_iniciados_web] INT,
            [presupuesto_de_la_campaña] DECIMAL(12,2),
            [tipo_de_presupuesto_de_la_campaña] VARCHAR(50),
            [públicos_personalizados_incluidos] TEXT,
            [públicos_personalizados_excluidos] TEXT,
            [clics_en_el_enlace] INT,
            [información_de_pago_agregada] INT,
            [interacción_con_la_página] INT,
            [comentarios_de_publicaciones] INT,
            [interacciones_con_la_publicación] INT,
            [reacciones_a_publicaciones] INT,
            [veces_compartidas_publicaciones] INT,
            [puja] DECIMAL(12,2),
            [tipo_de_puja] VARCHAR(50),
            [url_del_sitio_web] TEXT,
            [ctr_link_click_pct] DECIMAL(5,2),
            [divisa] VARCHAR(10),
            [valor_de_conversión_compras] DECIMAL(12,2),
            [objetivo] VARCHAR(100),
            [tipo_de_compra] VARCHAR(50),
            [inicio_del_informe] DATE,
            [fin_del_informe] DATE,
            [atencion] INT,
            [deseo] INT,
            [interes] INT,
            [rep_video_25_pct] BIGINT,
            [rep_video_50_pct] BIGINT,
            [rep_video_100_pct] BIGINT,
            [pct_rep_3s_por_impresiones] DECIMAL(5,2),
            [aov] DECIMAL(12,2),
            [lp_view_rate] DECIMAL(5,2),
            [adc_lpv] DECIMAL(12,2),
            [captura_de_video] INT,
            [tasa_conv_landing] DECIMAL(5,2),
            [pct_compras] DECIMAL(5,2),
            [visualizaciones] INT,
            [nombre_de_la_imagen] VARCHAR(255),
            [cvr_link_click] DECIMAL(5,2),
            [retencion_video_short] DECIMAL(5,2),
            [retención_de_video] DECIMAL(5,2),
            [rep_video_75_pct] BIGINT,
            [rep_video_95_pct] BIGINT,
            [tiempo_promedio_video] DECIMAL(6,2),
            [thruplays] INT,
            [rep_video] INT,
            [rep_video_2s_unicas] INT,
            [ctr_unico_enlace_pct] DECIMAL(5,2),
            [nombre_de_la_cuenta] VARCHAR(255),
            [impresiones_compras] INT,
            [captura_video_final] INT,
            inserted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (unique_id, id_reporte),
            FOREIGN KEY (id_reporte) REFERENCES archivos_reporte(id_reporte)
        )
    `,
    dependencies: ['archivos_reporte']
  },
  archivos_url: {
    create: `
        CREATE TABLE archivos_url (
            id_url INT IDENTITY(1,1) PRIMARY KEY,
            id_cliente INT NOT NULL,
            nombre_archivo VARCHAR(255),
            hash_archivo CHAR(64) UNIQUE NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
        )
    `,
    dependencies: ['clientes']
  },
  vistas_preview: {
    create: `
        CREATE TABLE vistas_preview (
            id_cliente INT NOT NULL,
            [Account name] VARCHAR(255),
            [Ad name] VARCHAR(255),
            [Reach] BIGINT,
            [Ad Preview Link] TEXT,
            [Ad Creative Thumbnail Url] TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id_cliente, [Ad name]),
            FOREIGN KEY (id_cliente) REFERENCES clientes(id_cliente)
        )
    `,
    dependencies: ['clientes']
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
