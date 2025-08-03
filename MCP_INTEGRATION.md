# Sistema MCP (Model Context Protocol) Integration

## ¿Qué es el Sistema MCP?

El Sistema MCP permite enviar automáticamente los datos procesados del Excel al servidor MCP configurado, creando un flujo de trabajo automático entre Ver6 y sistemas externos.

## Funcionalidades Implementadas

### 1. Configuración MCP
- **Ubicación**: Configuración → Pestaña "Servidor MCP"
- **Campos configurables**:
  - Test URL (obligatorio)
  - Production URL (opcional)
  - Path adicional (opcional)
  - Authentication Header (opcional)

### 2. Envío Automático
- **Trigger**: Cada vez que se procesa un archivo Excel de Meta Ads
- **Datos enviados**:
  - Información completa del cliente
  - Todos los registros de performance procesados
  - Métricas de resumen (ROAS, gasto total, etc.)
  - Top 10 anuncios con mejor rendimiento
  - Metadata del proceso (período, número de registros, etc.)

### 3. Estructura del Payload JSON

```json
{
  "source": "ver6_excel_import",
  "timestamp": "2025-08-02T23:15:00.000Z",
  "client": {
    "id": "client-uuid",
    "name": "Nombre del Cliente",
    "currency": "EUR",
    "metaAccountName": "Cuenta Meta"
  },
  "data": {
    "totalRecords": 1500,
    "newRecords": 850,
    "periodStart": "2025-07-01",
    "periodEnd": "2025-07-31",
    "daysDetected": 31,
    "performanceData": [...]
  },
  "summary": {
    "totalSpend": 15000.50,
    "totalRevenue": 45000.75,
    "totalImpressions": 2500000,
    "totalPurchases": 320,
    "overallROAS": 3.0,
    "topPerformingAds": [...]
  }
}
```

## Cómo Configurar

### Paso 1: Configurar URLs
1. Ve a **Configuración** en la aplicación
2. Selecciona la pestaña **"Servidor MCP"**
3. Ingresa tu Test URL (ej: `https://ads-analists.app.n8n.cloud/mcp-test/`)
4. Opcionalmente configura Production URL, Path y Authentication

### Paso 2: Probar Conexión
1. Haz clic en **"Probar Conexión"**
2. Verifica que aparezca "Conexión exitosa"
3. Guarda la configuración

### Paso 3: Usar el Sistema
1. Sube un archivo Excel de Meta Ads como normalmente
2. El sistema automáticamente enviará los datos al MCP
3. Verifica en el mensaje de confirmación: "✅ Datos enviados al MCP"

## Manejo de Errores

- **Si el MCP falla**: La importación de Excel continúa normalmente, solo se registra el error
- **Sin configuración MCP**: Aparece "⚠️ MCP no configurado" en el mensaje
- **Errores de conexión**: Se muestran en la consola del navegador para debugging

## Archivos Implementados

1. **`lib/mcpConnector.ts`**: Servicio principal de comunicación con MCP
2. **`components/MCPConfigView.tsx`**: Interfaz de configuración
3. **`components/SettingsView.tsx`**: Modificado para incluir pestañas
4. **`components/ImportView.tsx`**: Modificado para envío automático

## Testing

- Utiliza la función "Probar Conexión" para verificar conectividad
- Revisa la consola del navegador (F12) para logs detallados
- El sistema envía un payload de prueba al hacer test de conexión

## Notas Técnicas

- Los datos se envían como POST request con Content-Type: application/json
- Authentication header se incluye si está configurado
- El sistema es tolerante a fallos: si MCP falla, la importación continúa
- La configuración se guarda en localStorage del navegador
