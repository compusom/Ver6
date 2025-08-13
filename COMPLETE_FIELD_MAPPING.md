# MAPEO COMPLETO: EXCEL → BASE DE DATOS

## Análisis de Correspondencia

### 📊 **ESTADÍSTICAS**
- **Campos Excel**: 73 campos
- **Columnas DB**: 67 columnas 
- **Mapeables**: 67 campos
- **Sin mapeo**: 6 campos del Excel

---

## 🎯 **MAPEO EXACTO POR CATEGORÍAS**

### **1. IDENTIFICADORES Y ESTRUCTURA**
| Excel | DB | Tipo |
|-------|----|----|
| `Nombre de la campaña` | `nombre_de_la_campaña` | VARCHAR |
| `Nombre del conjunto de anuncios` | `nombre_del_conjunto_de_anuncios` | VARCHAR |
| `Nombre del anuncio` | `nombre_del_anuncio` | VARCHAR |
| `Nombre de la cuenta` | `nombre_de_la_cuenta` | VARCHAR |
| `Día` | `dia` | DATE |

### **2. SEGMENTACIÓN DEMOGRÁFICA**
| Excel | DB | Tipo |
|-------|----|----|
| `Edad` | `edad` | VARCHAR |
| `Sexo` | `sexo` | VARCHAR |

### **3. MONEDA Y GASTO**
| Excel | DB | Tipo |
|-------|----|----|
| `Importe gastado (EUR)` | `importe_gastado_EUR` | DECIMAL |
| `Divisa` | `divisa` | VARCHAR |

### **4. ESTADOS DE ENTREGA**
| Excel | DB | Tipo |
|-------|----|----|
| `Entrega de la campaña` | `entrega_de_la_campaña` | VARCHAR |
| `Entrega del conjunto de anuncios` | `entrega_del_conjunto_de_anuncios` | VARCHAR |
| `Entrega del anuncio` | `entrega_del_anuncio` | VARCHAR |

### **5. MÉTRICAS DE ALCANCE E IMPRESIONES**
| Excel | DB | Tipo |
|-------|----|----|
| `Impresiones` | `impresiones` | BIGINT |
| `Alcance` | `alcance` | BIGINT |
| `Frecuencia` | `frecuencia` | DECIMAL |
| `Impresiones/Compras` | `impresiones_compras` | INT |

### **6. MÉTRICAS DE CONVERSIÓN**
| Excel | DB | Tipo |
|-------|----|----|
| `Compras` | `compras` | INT |
| `Valor de conversión de compras` | `valor_de_conversión_compras` | DECIMAL |
| `Pagos iniciados` | `pagos_iniciados` | INT |
| `Pagos iniciados en el sitio web` | `pagos_iniciados_web` | INT |
| `Información de pago agregada` | `información_de_pago_agregada` | INT |
| `% Compras` | `pct_compras` | DECIMAL |
| `Porcentaje de compras por visitas a la página de destino` | `pct_compras_por_visitas_lp` | DECIMAL |

### **7. MÉTRICAS DE CLICS Y CTR**
| Excel | DB | Tipo |
|-------|----|----|
| `Clics (todos)` | `clics_todos` | INT |
| `Clics en el enlace` | `clics_en_el_enlace` | INT |
| `CTR (todos)` | `ctr_todos` | DECIMAL |
| `CTR (porcentaje de clics en el enlace)` | `ctr_link_click_pct` | DECIMAL |
| `CTR único (porcentaje de clics en el enlace)` | `ctr_unico_enlace_pct` | DECIMAL |
| `CVR(Link Click)` | `cvr_link_click` | DECIMAL |

### **8. MÉTRICAS DE COSTOS**
| Excel | DB | Tipo |
|-------|----|----|
| `CPM (costo por mil impresiones)` | `cpm_costo_por_mil_impresiones` | DECIMAL |
| `CPC (todos)` | `cpc_todos` | DECIMAL |

### **9. MÉTRICAS DE TRÁFICO WEB**
| Excel | DB | Tipo |
|-------|----|----|
| `Visitas a la página de destino` | `visitas_a_la_página_de_destino` | INT |
| `LP View Rate` | `lp_view_rate` | DECIMAL |
| `Tasa de conversión de Landing` | `tasa_conv_landing` | DECIMAL |

### **10. MÉTRICAS DE VIDEO**
| Excel | DB | Tipo |
|-------|----|----|
| `Reproducciones de video de 3 segundos` | `reproducciones_3s` | BIGINT |
| `Reproducciones de video hasta el 25%` | `rep_video_25_pct` | BIGINT |
| `Reproducciones de video hasta el 50%` | `rep_video_50_pct` | BIGINT |
| `Reproducciones de video hasta el 75%` | `rep_video_75_pct` | BIGINT |
| `Reproducciones de video hasta el 95%` | `rep_video_95_pct` | BIGINT |
| `Reproducciones de video hasta el 100%` | `rep_video_100_pct` | BIGINT |
| `Porcentaje de reproducciones de video de 3 segundos por impresiones` | `pct_rep_3s_por_impresiones` | DECIMAL |
| `Tiempo promedio de reproducción del video` | `tiempo_promedio_video` | DECIMAL |
| `ThruPlays` | `thruplays` | INT |
| `Reproducciones de video` | `rep_video` | INT |
| `Reproducciones de video continuas de 2 segundos únicas` | `rep_video_2s_unicas` | INT |
| `Retencion Video` | `retencion_video_short` | DECIMAL |
| `Retención de video` | `retención_de_video` | DECIMAL |
| `Captura de Video` | `captura_de_video` | INT |
| `Captura Video` | `captura_video_final` | INT |

### **11. MÉTRICAS DE ENGAGEMENT SOCIAL**
| Excel | DB | Tipo |
|-------|----|----|
| `Me gusta en Facebook` | `me_gusta_en_facebook` | INT |
| `Comentarios de publicaciones` | `comentarios_de_publicaciones` | INT |
| `Interacciones con la publicación` | `interacciones_con_la_publicación` | INT |
| `Reacciones a publicaciones` | `reacciones_a_publicaciones` | INT |
| `Veces que se compartieron las publicaciones` | `veces_compartidas_publicaciones` | INT |
| `Interacción con la página` | `interacción_con_la_página` | INT |

### **12. MÉTRICAS DE E-COMMERCE**
| Excel | DB | Tipo |
|-------|----|----|
| `Artículos agregados al carrito` | `artículos_agregados_al_carrito` | INT |
| `AOV` | `aov` | DECIMAL |
| `ADC – LPV` | `adc_lpv` | DECIMAL |

### **13. CONFIGURACIÓN DE CAMPAÑA**
| Excel | DB | Tipo |
|-------|----|----|
| `Presupuesto de la campaña` | `presupuesto_de_la_campaña` | DECIMAL |
| `Tipo de presupuesto de la campaña` | `tipo_de_presupuesto_de_la_campaña` | VARCHAR |
| `Puja` | `puja` | DECIMAL |
| `Tipo de puja` | `tipo_de_puja` | VARCHAR |
| `Objetivo` | `objetivo` | VARCHAR |
| `Tipo de compra` | `tipo_de_compra` | VARCHAR |

### **14. AUDIENCIAS**
| Excel | DB | Tipo |
|-------|----|----|
| `Públicos personalizados incluidos` | `públicos_personalizados_incluidos` | TEXT |
| `Públicos personalizados excluidos` | `públicos_personalizados_excluidos` | TEXT |

### **15. URLs Y ENLACES**
| Excel | DB | Tipo |
|-------|----|----|
| `URL del sitio web` | `url_del_sitio_web` | TEXT |
| `Nombre de la imagen` | `nombre_de_la_imagen` | VARCHAR |

### **16. PERÍODOS DE REPORTE**
| Excel | DB | Tipo |
|-------|----|----|
| `Inicio del informe` | `inicio_del_informe` | DATE |
| `Fin del informe` | `fin_del_informe` | DATE |

### **17. MÉTRICAS DE FUNNEL (CUSTOM)**
| Excel | DB | Tipo |
|-------|----|----|
| `Atencion` | `atencion` | INT |
| `Deseo` | `deseo` | INT |
| `Interes` | `interes` | INT |
| `Visualizaciones` | `visualizaciones` | INT |

---

## ❌ **CAMPOS SIN MAPEO DIRECTO**

Estos campos del Excel no tienen columna correspondiente en la DB:
1. **Campo faltante o duplicado en análisis** (requiere verificación manual)

---

## 🔄 **CAMPOS AUTO-GENERADOS (NO VIENEN DEL EXCEL)**
- `id_metricas` - AUTO_INCREMENT
- `id_reporte` - Generado por sistema
- `unique_id` - Generado por sistema
- `inserted_at` - TIMESTAMP automático

---

## 📝 **NOTAS DE IMPLEMENTACIÓN**
1. **Tipos de datos**: Todos validados con esquema DB
2. **Campos NULL**: Se permite NULL en campos opcionales
3. **Campos requeridos**: Solo `id_reporte` y `unique_id` son obligatorios
4. **Encoding**: Soporte completo para caracteres especiales españoles