const logger = require('./logger');

function getAdminPassword() {
  const adminPass = process.env.ADMIN_HARDCODED_PASSWORD || process.env.ADMIN_PASSWORD || 'MutuneAdmin2026!';
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
