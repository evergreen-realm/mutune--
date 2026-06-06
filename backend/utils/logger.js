/* eslint-disable no-console */
/**
 * Structured JSON logger (stdout/stderr).
 * console.* is intentional here — this IS the logging abstraction.
 * All other files must import this module instead of using console directly.
 */
const logger = {
  info:  (msg, meta = {}) => console.log(JSON.stringify({ level: 'info',  timestamp: new Date().toISOString(), message: msg, ...meta })),
  error: (msg, meta = {}) => console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message: msg, ...meta })),
  warn:  (msg, meta = {}) => console.warn(JSON.stringify({ level: 'warn',  timestamp: new Date().toISOString(), message: msg, ...meta }))
};

module.exports = logger;
