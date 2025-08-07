
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
