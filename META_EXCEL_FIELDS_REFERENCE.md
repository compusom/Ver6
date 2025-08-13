# REFERENCIA COMPLETA DE CAMPOS - META ADS EXCEL

## Lista Completa de Campos del Excel (71 campos)

### **Identificadores y Estructura**
1. `Nombre de la campaña`
2. `Nombre del conjunto de anuncios`
3. `Nombre del anuncio`
4. `Nombre de la cuenta`
5. `Día`

### **Segmentación Demográfica**
6. `Edad`
7. `Sexo`

### **Métricas de Gasto y Moneda**
8. `Importe gastado (EUR)` - *Puede ser (USD), (GBP), etc.*
9. `Divisa` - *Campo que especifica la moneda (EUR, USD, GBP, etc.)*

### **Estados de Entrega**
10. `Entrega de la campaña`
11. `Entrega del conjunto de anuncios`
12. `Entrega del anuncio`

### **Métricas de Alcance e Impresiones**
13. `Impresiones`
14. `Alcance`
15. `Frecuencia`
16. `Impresiones/Compras`

### **Métricas de Conversión**
17. `Compras`
18. `Valor de conversión de compras`
19. `Pagos iniciados`
20. `Pagos iniciados en el sitio web`
21. `Información de pago agregada`
22. `% Compras`
23. `Porcentaje de compras por visitas a la página de destino`

### **Métricas de Clics y CTR**
24. `Clics (todos)`
25. `Clics en el enlace`
26. `CTR (todos)`
27. `CTR (porcentaje de clics en el enlace)`
28. `CTR único (porcentaje de clics en el enlace)`
29. `CVR(Link Click)`

### **Métricas de Costos**
30. `CPM (costo por mil impresiones)`
31. `CPC (todos)`

### **Métricas de Tráfico Web**
32. `Visitas a la página de destino`
33. `LP View Rate`
34. `Tasa de conversión de Landing`

### **Métricas de Video**
35. `Reproducciones de video de 3 segundos`
36. `Reproducciones de video hasta el 25%`
37. `Reproducciones de video hasta el 50%`
38. `Reproducciones de video hasta el 75%`
39. `Reproducciones de video hasta el 95%`
40. `Reproducciones de video hasta el 100%`
41. `Porcentaje de reproducciones de video de 3 segundos por impresiones`
42. `Tiempo promedio de reproducción del video`
43. `ThruPlays`
44. `Reproducciones de video`
45. `Reproducciones de video continuas de 2 segundos únicas`
46. `Retencion Video`
47. `Retención de video`
48. `Captura de Video`
49. `Captura Video`

### **Métricas de Engagement Social**
50. `Me gusta en Facebook`
51. `Comentarios de publicaciones`
52. `Interacciones con la publicación`
53. `Reacciones a publicaciones`
54. `Veces que se compartieron las publicaciones`
55. `Interacción con la página`

### **Métricas de E-commerce**
56. `Artículos agregados al carrito`
57. `AOV` - *Average Order Value*
58. `ADC – LPV` - *Add to Cart - Landing Page View*

### **Configuración de Campaña**
59. `Presupuesto de la campaña`
60. `Tipo de presupuesto de la campaña`
61. `Puja`
62. `Tipo de puja`
63. `Objetivo`
64. `Tipo de compra`

### **Audiencias**
65. `Públicos personalizados incluidos`
66. `Públicos personalizados excluidos`

### **URLs y Enlaces**
67. `URL del sitio web`

### **Períodos de Reporte**
68. `Inicio del informe`
69. `Fin del informe`

### **Métricas de Funnel (Custom)**
70. `Atencion`
71. `Deseo`
72. `Interes`
73. `Visualizaciones`

---

## Mapeo a Base de Datos

### **Campos Principales Mapeados**
- `Nombre de la campaña` → `nombre_de_la_campaña`
- `Nombre del conjunto de anuncios` → `nombre_del_conjunto_de_anuncios`
- `Nombre del anuncio` → `nombre_del_anuncio`
- `Día` → `dia`
- `Edad` → `edad`
- `Sexo` → `sexo`
- `Importe gastado (EUR)` → `importe_gastado_EUR`
- `Divisa` → Se usa para detectar moneda del cliente
- `Impresiones` → `impresiones`
- `Alcance` → `alcance`
- `Compras` → `compras`
- `Clics (todos)` → `clics_todos`
- `Valor de conversión de compras` → `valor_de_conversión_compras`

### **Campos de Video Mapeados**
- `Reproducciones de video hasta el 25%` → `rep_video_25_pct`
- `Reproducciones de video hasta el 50%` → `rep_video_50_pct`
- `Reproducciones de video hasta el 75%` → `rep_video_75_pct`
- `Reproducciones de video hasta el 95%` → `rep_video_95_pct`
- `Reproducciones de video hasta el 100%` → `rep_video_100_pct`

---

## Notas de Implementación

### **Detección Automática de Moneda**
1. **Campo "Divisa"**: Se lee directamente del Excel
2. **Campo "Importe gastado"**: Se detecta patrón `(EUR)`, `(USD)`, etc.
3. **Fallback**: EUR por defecto

### **Campos Dinámicos**
- El campo de gasto puede ser `Importe gastado (EUR)`, `Importe gastado (USD)`, etc.
- El sistema detecta automáticamente el patrón y extrae la moneda

### **Campos Pendientes**
Campos del Excel que aún no están mapeados en la base de datos:
- Métricas de engagement social (Me gusta, Comentarios, etc.)
- Métricas avanzadas de video (Tiempo promedio, ThruPlays, etc.)
- Configuración de campaña (Presupuesto, Puja, etc.)
- Audiencias personalizadas
- Métricas de funnel custom (Atencion, Deseo, Interes)

---

**Fecha de actualización**: 2025-08-12
**Total de campos**: 73 campos identificados