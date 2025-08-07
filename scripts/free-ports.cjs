// scripts/free-ports.cjs
// Libera los puertos 5173 (frontend) y 3001 (backend) en Windows antes de iniciar el sistema

const { execSync } = require('child_process');

const ports = [5173, 5174, 5175, 3001];

function killPort(port) {
  try {
    // Buscar el PID que usa el puerto
    const findPid = execSync(`netstat -ano | findstr :${port}`).toString();
    const lines = findPid.split('\n').filter(l => l.includes('LISTENING'));
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        try {
          execSync(`taskkill /PID ${pid} /F`);
          console.log(`Puerto ${port} liberado (PID ${pid})`);
        } catch (e) {
          console.log(`No se pudo matar el proceso ${pid} en puerto ${port}`);
        }
      }
    });
  } catch (e) {
    // Si no hay proceso, no hacer nada
  }
}

ports.forEach(killPort);
