const cron = require('node-cron');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const JournalEntry = require('../models/JournalEntry');
const { postJournalEntry } = require('../services/financials');
const { acquireCronLock } = require('../utils/cronLock');
const logger = require('../utils/logger');

/**
 * Monthly Rent Accrual Cron Engine
 * Runs on the 1st of every month at 00:01 AM EAT (UTC+3) to recognize monthly rent accrual.
 * Accrual Accounting GL Posting:
 * - Debit:  Account 1100 (Tenant Rent Receivable)
 * - Credit: Account 4010 (Gross Rental Income)
 */
async function processMonthlyRentAccrual(billingMonth) {
  const currentMonth = billingMonth || new Date().toISOString().slice(0, 7);
  logger.info(`Starting monthly rent accrual job for ${currentMonth} (EAT UTC+3)...`);

  const hasLock = await acquireCronLock('accrue_rent', currentMonth);
  if (!hasLock) {
    logger.info(`Monthly rent accrual for ${currentMonth} already locked by another worker. Skipping duplicate run.`);
    return { success: true, skipped: true, currentMonth, reason: 'Distributed lock held by another process' };
  }

  const activeTenants = await Tenant.find({ tenancy_status: 'active' }).lean();
  let accruedCount = 0;
  let totalAccruedKes = 0;
  let failedCount = 0;

  for (const tenant of activeTenants) {
    if (!tenant.rent_amount_kes || tenant.rent_amount_kes <= 0) continue;

    // Idempotency: verify rent has not already been accrued for this tenant in currentMonth
    const alreadyAccrued = await JournalEntry.findOne({
      reference_type: 'rent_accrual',
      reference_id: tenant._id,
      notes: { $regex: currentMonth }
    }).lean();
    if (alreadyAccrued) continue;

    const rentKes = tenant.rent_amount_kes;

    try {
      await postJournalEntry({
        reference_type: 'rent_accrual',
        reference_id: tenant._id,
        property_id: tenant.current_property_id,
        line_items: [
          { account_code: '1100', debit_kes: rentKes, credit_kes: 0, description: `Rent Receivable - ${tenant.full_name}` },
          { account_code: '4010', debit_kes: 0, credit_kes: rentKes, description: `Rental Income Accrual (${currentMonth})` }
        ],
        notes: `Monthly rent accrual for tenant ${tenant.full_name} (${currentMonth})`
      });

      await Tenant.findByIdAndUpdate(tenant._id, { $inc: { arrears_kes: rentKes } });

      accruedCount++;
      totalAccruedKes += rentKes;
    } catch (err) {
      failedCount++;
      logger.error(`Failed to accrue rent for tenant ${tenant._id}: ${err.message}`);
    }
  }

  logger.info(`Completed monthly rent accrual job for ${currentMonth}`, {
    accruedCount,
    totalAccruedKes,
    failedCount,
    timestamp_eat: new Date().toISOString()
  });

  return { success: true, currentMonth, accruedCount, totalAccruedKes, failedCount };
}

const accrueRentCron = cron.schedule('1 0 1 * *', () => processMonthlyRentAccrual(), {
  scheduled: false, // Started manually in server.js after DB connection
  timezone: 'Africa/Nairobi'
});

accrueRentCron.processMonthlyRentAccrual = processMonthlyRentAccrual;

module.exports = accrueRentCron;
