const logger = require('./logger');

function getAdminPassword() {
  const envPass = process.env.ADMIN_HARDCODED_PASSWORD || process.env.ADMIN_PASSWORD;
  if (envPass) return envPass;

  const errMsg = 'CRITICAL CONFIGURATION ERROR: Neither ADMIN_HARDCODED_PASSWORD nor ADMIN_PASSWORD environment variable is set. The application cannot start without an admin password configured.';
  logger.error(errMsg);
  throw new Error(errMsg);
}

function escapeRegExp(string) {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  getAdminPassword,
  escapeRegExp
};
