const levels = ['error', 'warn', 'info', 'debug'];
const current = process.env.LOG_LEVEL || 'info';
function shouldLog(level){
  return levels.indexOf(level) <= levels.indexOf(current);
}
export default {
  info: (...args) => { if (shouldLog('info')) console.log('[INFO]', ...args); },
  warn: (...args) => { if (shouldLog('warn')) console.warn('[WARN]', ...args); },
  error: (...args) => { if (shouldLog('error')) console.error('[ERROR]', ...args); },
  debug: (...args) => { if (shouldLog('debug')) console.debug('[DEBUG]', ...args); }
};
