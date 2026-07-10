const logger = require('./logger');

function getAdminPassword() {
  const envPass = process.env.ADMIN_HARDCODED_PASSWORD || process.env.ADMIN_PASSWORD;
  if (envPass) return envPass;

  if (process.env.NODE_ENV === 'production') {
    logger.warn('⚠️ CRITICAL SECURITY WARNING: ADMIN_HARDCODED_PASSWORD or ADMIN_PASSWORD environment variable is not configured in production! Falling back to default admin password.');
  } else {
    logger.warn('Using default admin password fallback. Set ADMIN_HARDCODED_PASSWORD in production.');
  }

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
