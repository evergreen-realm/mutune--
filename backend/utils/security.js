const logger = require('./logger');

function getAdminPassword() {
  const envPass = process.env.ADMIN_HARDCODED_PASSWORD || process.env.ADMIN_PASSWORD;
  if (envPass) return envPass;

  if (process.env.NODE_ENV === 'production') {
    logger.error('ADMIN_HARDCODED_PASSWORD or ADMIN_PASSWORD environment variable must be set in production');
    throw new Error('Admin password environment variable is required in production');
  }

  logger.warn('Using default admin password fallback. Set ADMIN_HARDCODED_PASSWORD in production.');
  return 'MutuneAdmin2026!';
}

function escapeRegExp(string) {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  getAdminPassword,
  escapeRegExp
};
