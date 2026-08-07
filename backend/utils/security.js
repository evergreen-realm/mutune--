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

const crypto = require('crypto');

const ENCRYPTION_KEY = crypto.scryptSync(process.env.ENCRYPTION_SECRET || 'mutune_default_kdpa_secret_key_2026', 'mutune_salt', 32);
const BLIND_INDEX_KEY = crypto.scryptSync(process.env.ENCRYPTION_SECRET || 'mutune_default_kdpa_secret_key_2026', 'bindex_salt', 32);

/**
 * Encrypt plain text using AES-256-GCM (KDPA 2019 Section 41)
 */
function encryptPII(text) {
  if (!text || typeof text !== 'string') return text;
  if (text.startsWith('enc:')) return text;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `enc:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt ciphertext encrypted with AES-256-GCM
 */
function decryptPII(cipherText) {
  if (!cipherText || typeof cipherText !== 'string' || !cipherText.startsWith('enc:')) return cipherText;

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 4) return cipherText;
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encryptedText = parts[3];

    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    logger.warn('Failed to decrypt PII field', { error: err.message });
    return cipherText;
  }
}

/**
 * Generate deterministic HMAC-SHA256 blind index for exact query lookup
 */
function generateBlindIndex(text) {
  if (!text || typeof text !== 'string') return '';
  const normalized = text.trim().toLowerCase();
  return crypto.createHmac('sha256', BLIND_INDEX_KEY).update(normalized).digest('hex');
}

module.exports = {
  getAdminPassword,
  escapeRegExp,
  encryptPII,
  decryptPII,
  generateBlindIndex
};
