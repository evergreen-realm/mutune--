const logger = require('./logger');

function getAdminPassword() {
  const adminPass = process.env.ADMIN_HARDCODED_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!adminPass) {
    logger.error('CRITICAL: ADMIN_PASSWORD environment variable is not configured!');
    throw new Error('ADMIN_PASSWORD environment variable is not configured!');
  }
  return adminPass;
}

function escapeRegExp(string) {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  getAdminPassword,
  escapeRegExp
};
