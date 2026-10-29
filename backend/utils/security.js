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

/**
 * Normalize Kenyan phone numbers into 254XXXXXXXXX format
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '254' + cleaned.slice(1);
  if (!cleaned.startsWith('254') && cleaned.length === 9) cleaned = '254' + cleaned;
  return cleaned;
}

/**
 * Deeply decrypt any string starting with 'enc:' in a plain JavaScript object or array
 */
function decryptLeanDoc(doc) {
  if (!doc) return doc;
  if (Array.isArray(doc)) {
    for (let i = 0; i < doc.length; i++) {
      decryptLeanDoc(doc[i]);
    }
    return doc;
  }
  if (typeof doc === 'object' && !(doc instanceof Date) && !(doc instanceof RegExp) && !doc._bsontype) {
    const isMongooseDoc = typeof doc.$isDefault === 'function' || typeof doc.save === 'function';
    if (!isMongooseDoc) {
      for (const key of Object.keys(doc)) {
        const val = doc[key];
        if (typeof val === 'string' && val.startsWith('enc:')) {
          doc[key] = decryptPII(val);
        } else if (val && typeof val === 'object' && !(val instanceof Date) && !(val instanceof RegExp) && !val._bsontype) {
          decryptLeanDoc(val);
        }
      }
    }
  }
  return doc;
}

/**
 * Constant-time string comparison preventing timing side-channel attacks
 */
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Strictly validates designated administrative accounts:
 * - meshachmaluki3@gmail.com is designated Super Admin
 * - meshachmaluki@gmail.com is designated Admin
 * All other accounts (including meshachmaluki06@gmail.com) are testing accounts
 * and retain their respective roles (tenant, agent, landlord, etc.).
 */
function isDesignatedSuperAdmin(userOrEmail) {
  if (!userOrEmail) return false;
  const email = (typeof userOrEmail === 'string' ? userOrEmail : (userOrEmail.email || '')).toLowerCase().trim();
  const configured = (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim();
  return email === 'meshachmaluki3@gmail.com' || (configured && email === configured);
}

function isDesignatedAdmin(userOrEmail) {
  if (!userOrEmail) return false;
  const email = (typeof userOrEmail === 'string' ? userOrEmail : (userOrEmail.email || '')).toLowerCase().trim();
  return email === 'meshachmaluki@gmail.com';
}

function isDesignatedAdministrativeAccount(userOrEmail) {
  return isDesignatedSuperAdmin(userOrEmail) || isDesignatedAdmin(userOrEmail);
}

module.exports = {
  getAdminPassword,
  escapeRegExp,
  encryptPII,
  decryptPII,
  generateBlindIndex,
  normalizePhone,
  decryptLeanDoc,
  safeCompare,
  isDesignatedSuperAdmin,
  isDesignatedAdmin,
  isDesignatedAdministrativeAccount
};

