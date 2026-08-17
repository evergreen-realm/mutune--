const cron = require('node-cron');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const { postJournalEntry } = require('../services/financials');
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
  logger.info(`Starting monthly rent accrual job for ${currentMonth}...`);

  const activeTenants = await Tenant.find({ tenancy_status: 'active' }).lean();
  let accruedCount = 0;
  let totalAccruedKes = 0;

  for (const tenant of activeTenants) {
    if (!tenant.rent_amount_kes || tenant.rent_amount_kes <= 0) continue;

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

      accruedCount++;
      totalAccruedKes += rentKes;
    } catch (err) {
      logger.error(`Failed to accrue rent for tenant ${tenant._id}: ${err.message}`);
    }
  }

  logger.info(`Completed monthly rent accrual job for ${currentMonth}`, { accruedCount, totalAccruedKes });
  return { success: true, currentMonth, accruedCount, totalAccruedKes };
}

const accrueRentCron = cron.schedule('1 0 1 * *', () => processMonthlyRentAccrual(), {
  scheduled: false, // Started manually in server.js after DB connection
  timezone: 'Africa/Nairobi'
});

accrueRentCron.processMonthlyRentAccrual = processMonthlyRentAccrual;

module.exports = accrueRentCron;
