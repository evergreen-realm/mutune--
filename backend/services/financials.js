const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const logger = require('../utils/logger');

// Default Chart of Accounts initializer for MutuneRent Pro
const DEFAULT_ACCOUNTS = [
  { account_code: '1010', account_name: 'M-Pesa Operating Account', account_type: 'asset', account_subtype: 'cash', description: 'Primary M-Pesa collections' },
  { account_code: '1020', account_name: 'Bank Operating Account', account_type: 'asset', account_subtype: 'bank', description: 'Commercial bank collections' },
  { account_code: '1100', account_name: 'Tenant Rent Receivable', account_type: 'asset', account_subtype: 'accounts_receivable', description: 'Outstanding rent invoices' },
  { account_code: '2010', account_name: 'Tenant Security Deposit Liability', account_type: 'liability', account_subtype: 'tenant_deposit_liability', description: 'Held tenant security deposits' },
  { account_code: '2020', account_name: 'Landlord Remittance Payable', account_type: 'liability', account_subtype: 'current_liability', description: 'Net landlord rent payouts owed' },
  { account_code: '2030', account_name: 'KRA Withholding Tax Payable', account_type: 'liability', account_subtype: 'current_liability', description: '7.5%/10% tax held for KRA' },
  { account_code: '3010', account_name: 'Owner Capital & Equity', account_type: 'equity', account_subtype: 'owner_equity', description: 'Company equity' },
  { account_code: '4010', account_name: 'Gross Rental Income', account_type: 'income', account_subtype: 'rental_income', description: 'Gross collected rent' },
  { account_code: '4020', account_name: 'Agency Management Commission Income', account_type: 'income', account_subtype: 'commission_income', description: 'Management % income' },
  { account_code: '4030', account_name: 'Late Fee Income', account_type: 'income', account_subtype: 'late_fee_income', description: 'Late fee penalties' },
  { account_code: '5010', account_name: 'Agent Commission Expense', account_type: 'expense', account_subtype: 'management_expense', description: 'Agent payroll payouts' },
  { account_code: '5020', account_name: 'Property Maintenance Expense', account_type: 'expense', account_subtype: 'maintenance_expense', description: 'Repairs & maintenance' }
];

async function seedDefaultAccounts() {
  for (const acc of DEFAULT_ACCOUNTS) {
    await Account.updateOne(
      { account_code: acc.account_code },
      { $setOnInsert: acc },
      { upsert: true }
    );
  }
}

async function postJournalEntry({ reference_type, reference_id, property_id, line_items, posted_by_user_id, notes }) {
  await seedDefaultAccounts();

  // Validate line items
  let sumDebit = 0;
  let sumCredit = 0;
  const enrichedItems = [];

  for (const item of line_items) {
    const acc = await Account.findOne({ account_code: item.account_code });
    if (!acc) {
      throw new Error(`Account with code ${item.account_code} not found in Chart of Accounts`);
    }
    const debit = Number(item.debit_kes || 0);
    const credit = Number(item.credit_kes || 0);
    sumDebit += debit;
    sumCredit += credit;

    enrichedItems.push({
      account_id: acc._id,
      account_code: acc.account_code,
      debit_kes: debit,
      credit_kes: credit,
      description: item.description || acc.account_name
    });
  }

  const count = await JournalEntry.countDocuments();
  const entry_code = `JE-${String(count + 1).padStart(6, '0')}`;

  const entry = new JournalEntry({
    entry_code,
    posting_date: new Date(),
    reference_type,
    reference_id,
    property_id,
    line_items: enrichedItems,
    total_debit_kes: Number(sumDebit.toFixed(2)),
    total_credit_kes: Number(sumCredit.toFixed(2)),
    posted_by_user_id,
    notes
  });

  await entry.save();

  // Update account balances
  for (const item of enrichedItems) {
    const change = item.debit_kes - item.credit_kes;
    await Account.findByIdAndUpdate(item.account_id, { $inc: { balance_kes: change } });
  }

  logger.info('Journal entry posted successfully', { entry_code, reference_type, reference_id });
  return entry;
}

async function getTrialBalance() {
  await seedDefaultAccounts();
  const accounts = await Account.find({ is_active: true }).sort({ account_code: 1 }).lean();
  let totalDebit = 0;
  let totalCredit = 0;

  const rows = accounts.map(acc => {
    let debit = 0;
    let credit = 0;
    if (['asset', 'expense'].includes(acc.account_type)) {
      if (acc.balance_kes >= 0) debit = acc.balance_kes;
      else credit = Math.abs(acc.balance_kes);
    } else {
      if (acc.balance_kes <= 0) credit = Math.abs(acc.balance_kes);
      else debit = acc.balance_kes;
    }
    totalDebit += debit;
    totalCredit += credit;

    return {
      account_code: acc.account_code,
      account_name: acc.account_name,
      account_type: acc.account_type,
      debit_kes: Number(debit.toFixed(2)),
      credit_kes: Number(credit.toFixed(2))
    };
  });

  return {
    rows,
    total_debit_kes: Number(totalDebit.toFixed(2)),
    total_credit_kes: Number(totalCredit.toFixed(2)),
    is_balanced: Math.abs(totalDebit - totalCredit) < 0.01
  };
}

/**
 * Calculates Stamp Duty on Kenyan Tenancy Leases (Section 19, Stamp Duty Act Cap 480).
 * - Under 1 year: KES 200 flat
 * - 1 to 3 years: 1% of annual rent
 * - Over 3 years: 2% of annual rent
 */
function calculateStampDuty({ monthlyRentKes = 0, leaseDurationMonths = 12 }) {
  const rent = Number(monthlyRentKes || 0);
  const durationMonths = Number(leaseDurationMonths || 12);
  const annualRent = rent * 12;

  let stampDutyKes = 0;
  let rateDescription = '';

  if (durationMonths < 12) {
    stampDutyKes = 200;
    rateDescription = 'Flat KES 200 (Lease duration under 1 year)';
  } else if (durationMonths <= 36) {
    stampDutyKes = Math.round(annualRent * 0.01);
    rateDescription = '1.0% of Annual Rent (Lease duration 1–3 years)';
  } else {
    stampDutyKes = Math.round(annualRent * 0.02);
    rateDescription = '2.0% of Annual Rent (Lease duration over 3 years)';
  }

  return {
    monthly_rent_kes: rent,
    lease_duration_months: durationMonths,
    annual_rent_kes: annualRent,
    stamp_duty_payable_kes: stampDutyKes,
    rate_description: rateDescription,
    legal_basis: 'Section 19, Kenya Stamp Duty Act (Cap 480)'
  };
}

module.exports = {
  seedDefaultAccounts,
  postJournalEntry,
  getTrialBalance,
  calculateStampDuty
};
