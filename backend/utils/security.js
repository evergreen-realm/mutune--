const logger = require('./logger');

function getAdminPassword() {
  const envPass = process.env.ADMIN_HARDCODED_PASSWORD || process.env.ADMIN_PASSWORD;
  if (envPass) return envPass;

  if (process.env.NODE_ENV === 'test') {
    return 'MutuneAdmin2026!'; // Keep test suites green
  }

  throw new Error('ADMIN_PASSWORD or ADMIN_HARDCODED_PASSWORD environment variable is required. Set it in your .env file.');
}

function escapeRegExp(string) {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  getAdminPassword,
  escapeRegExp
};
