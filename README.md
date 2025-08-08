
# 🚨 SUPER IMPORTANTE: Cómo iniciar el sistema correctamente 🚨


Para que el sistema funcione correctamente, SIEMPRE debes iniciar **frontend y backend juntos** usando el siguiente comando:

```
npm run start
```

Este comando ahora **libera automáticamente los puertos 5173, 5174, 5175 y 3001** antes de iniciar el sistema. Así te aseguras que no haya conflictos y la app funcione siempre.

Luego ejecuta el servidor local (API y base de datos) y la aplicación web al mismo tiempo. Si solo ejecutas `npm run dev` o `npm run server` por separado, algunas funciones (como la conexión SQL) pueden no funcionar.

---

# Run and deploy your AI Studio app

Este repositorio contiene todo lo necesario para ejecutar la app localmente.

## Run Locally

**Prerequisitos:** Node.js

1. Instala las dependencias:
   `npm install`
2. Configura la variable `GEMINI_API_KEY` en [.env.local](.env.local) con tu API key de Gemini
3. Inicia el sistema:
   `npm run start` (esto ejecuta frontend y backend juntos)

### Pruebas de importación de Meta

Para verificar el nuevo flujo de importación de reportes de Meta:

1. Prepara un archivo XLSX con columnas `account_name`, `date` y `ad_id` más métricas.
2. Caso 1: si el `account_name` no existe, al importar se crea un nuevo cliente y se insertan las métricas.
3. Caso 2: si el cliente ya existe, se actualizan o insertan métricas sin duplicados gracias al índice `(client_id,date,ad_id)`.
4. Reimportar el mismo archivo no debe generar filas duplicadas; el log mostrará conteos de filas insertadas y actualizadas.

## Número de compilación

El número de compilación del sistema se mantiene en [`build-info.ts`](build-info.ts).
Debe incrementarse manualmente en cada cambio que modifique el código y es visible en toda la aplicación.
Para actualizarlo:

1. Edita `build-info.ts` y aumenta `BUILD_NUMBER` en 1.
2. Asegúrate de commitear este cambio junto con tus modificaciones.

