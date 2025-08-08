// Simple in-memory log buffer for backend messages
// This will be imported and used in server.js

const logBuffer = [];
const MAX_LOGS = 100;

export function addLog(level, ...args) {
    const msg = `[${level.toUpperCase()}] ${args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')}`;
    logBuffer.push({ timestamp: new Date().toISOString(), level, msg });
    if (logBuffer.length > MAX_LOGS) logBuffer.shift();
}

export function getLogs() {
    return logBuffer.slice(-MAX_LOGS);
}
