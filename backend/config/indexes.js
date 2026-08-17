/**
 * Database Index Definitions — MutuneRent Pro
 *
 * Compound indexes that supplement the per-field indexes already declared
 * in each Mongoose schema.  Called once at startup via ensureIndexes().
 *
 * Mongoose calls Model.init() automatically on first access, but this
 * module explicitly awaits syncIndexes() for every model so that:
 *   1. New compound indexes are created on deploy without manual migration.
 *   2. Indexes that were removed from schemas are dropped automatically.
 */
const logger = require('../utils/logger');

async function ensureIndexes() {
  try {
    const mongoose = require('mongoose');

    // Import every model that needs runtime index verification
    const Payment        = require('../models/Payment');
    const Property       = require('../models/Property');
    const Tenant         = require('../models/Tenant');
    const AuditLog       = require('../models/AuditLog');
    const UtilityReading = require('../models/UtilityReading');
    const JournalEntry   = require('../models/JournalEntry');

    // Await syncIndexes on each model — this is idempotent
    await Promise.all([
      Payment.syncIndexes(),
      Property.syncIndexes(),
      Tenant.syncIndexes(),
      AuditLog.syncIndexes(),
      UtilityReading.syncIndexes(),
      JournalEntry.syncIndexes()
    ]);

    logger.info('Database indexes synced successfully', {
      models: ['Payment', 'Property', 'Tenant', 'AuditLog', 'UtilityReading', 'JournalEntry']
    });
  } catch (err) {
    // Non-fatal: the app can still function without perfect indexes,
    // but queries will be slower.  Log prominently so ops can investigate.
    logger.error('Failed to sync database indexes', { error: err.message });
  }
}

module.exports = ensureIndexes;
