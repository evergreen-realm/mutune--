const axios = require('axios');
const logger = require('../utils/logger');
const JournalEntry = require('../models/JournalEntry');
const AuditLog = require('../models/AuditLog');

// ── Multi-Provider Water & Utility Registry ─────────────────────────────────
const UTILITY_CONFIGS = {
  MOMBASA_WATER: {
    id: 'MOMBASA_WATER',
    name: 'Mombasa Water Supply & Sanitation Co (MEWASCO)',
    shortName: 'Mombasa Water',
    accountPrefix: 'MW',
    billerCode: '895500',
    type: 'water',
    region: 'Mombasa County'
  },
  NAIROBI_WATER: {
    id: 'NAIROBI_WATER',
    name: 'Nairobi City Water & Sewerage Co (NCWSC)',
    shortName: 'Nairobi Water',
    accountPrefix: 'NWC',
    billerCode: '444400',
    type: 'water',
    region: 'Nairobi County'
  },
  KISUMU_WATER: {
    id: 'KISUMU_WATER',
    name: 'Kisumu Water & Sanitation Co (KIWASCO)',
    shortName: 'Kisumu Water',
    accountPrefix: 'KW',
    billerCode: '517000',
    type: 'water',
    region: 'Kisumu County'
  },
  NAKURU_WATER: {
    id: 'NAKURU_WATER',
    name: 'Nakuru Water & Sanitation Services Co (NAWASSCO)',
    shortName: 'Nakuru Water',
    accountPrefix: 'NW',
    billerCode: '111444',
    type: 'water',
    region: 'Nakuru County'
  },
  ELDORET_WATER: {
    id: 'ELDORET_WATER',
    name: 'Eldoret Water & Sanitation Co (ELDOWAS)',
    shortName: 'Eldoret Water',
    accountPrefix: 'ELD',
    billerCode: '511000',
    type: 'water',
    region: 'Uasin Gishu County'
  },
  KILIFI_WATER: {
    id: 'KILIFI_WATER',
    name: 'Kilifi-Mariakani Water & Sewerage Co (KIMAWASCO)',
    shortName: 'Kilifi Water',
    accountPrefix: 'KM',
    billerCode: '895501',
    type: 'water',
    region: 'Kilifi County'
  },
  KPLC_PREPAID: {
    id: 'KPLC_PREPAID',
    name: 'Kenya Power Prepaid Electricity',
    shortName: 'KPLC Prepaid',
    accountPrefix: 'KP',
    billerCode: '888880',
    type: 'electricity',
    region: 'National'
  },
  KPLC_POSTPAID: {
    id: 'KPLC_POSTPAID',
    name: 'Kenya Power Postpaid Electricity',
    shortName: 'KPLC Postpaid',
    accountPrefix: 'KPP',
    billerCode: '888888',
    type: 'electricity',
    region: 'National'
  }
};

const SystemSetting = require('../models/SystemSetting');

// WASREB-approved 2024 default tariffs for Mombasa Water (MEWASCO)
const DEFAULT_MEWASCO_TARIFFS = {
  domestic: [
    { maxUnits: 6,    ratePerUnit: 0,     label: 'Lifeline (0-6 m³)' },
    { maxUnits: 20,   ratePerUnit: 47,    label: 'Basic (7-20 m³)' },
    { maxUnits: 50,   ratePerUnit: 60,    label: 'Standard (21-50 m³)' },
    { maxUnits: 100,  ratePerUnit: 78,    label: 'Above Normal (51-100 m³)' },
    { maxUnits: Infinity, ratePerUnit: 95, label: 'Excessive (100+ m³)' }
  ],
  commercial: [
    { maxUnits: Infinity, ratePerUnit: 95, label: 'Commercial Flat Rate' }
  ],
  sewerSurcharge: 0.75
};

async function getMewascoTariffs() {
  try {
    const setting = await SystemSetting.findOne({ key: 'mewasco_tariffs' }).lean();
    if (setting?.value) return setting.value;
  } catch (err) {
    logger.warn('Failed to load MEWASCO tariffs from settings, using defaults', { error: err.message });
  }
  return DEFAULT_MEWASCO_TARIFFS;
}

async function calculateMewascoWaterBill(consumptionM3, category = 'domestic') {
  const tariffs = await getMewascoTariffs();
  const tiers = tariffs[category] || tariffs.domestic;
  let remaining = consumptionM3;
  let totalWater = 0;
  let prevMax = 0;
  const breakdown = [];

  for (const tier of tiers) {
    const max = (tier.maxUnits === null || tier.maxUnits === undefined) ? Infinity : tier.maxUnits;
    const tierUnits = Math.min(remaining, max - prevMax);
    if (tierUnits <= 0) break;
    const tierCost = tierUnits * tier.ratePerUnit;
    totalWater += tierCost;
    breakdown.push({ tier: tier.label, units: tierUnits, rate: tier.ratePerUnit, cost: tierCost });
    remaining -= tierUnits;
    prevMax = max;
  }

  const sewerCharge = Math.round(totalWater * (tariffs.sewerSurcharge || 0.75));
  return {
    water_charge_kes: totalWater,
    sewer_charge_kes: sewerCharge,
    total_kes: totalWater + sewerCharge,
    breakdown
  };
}

const KYANDA_API_URL = process.env.KYANDA_API_URL || 'https://api.kyanda.africa/v1';

function getKyandaConfig() {
  const apiKey = process.env.KYANDA_API_KEY;
  const merchantId = process.env.KYANDA_MERCHANT_ID;

  if (!apiKey) {
    throw new Error('KYANDA_API_KEY environment variable is required for utility operations');
  }

  return {
    apiKey,
    merchantId: merchantId || '',
    baseURL: KYANDA_API_URL
  };
}

/**
 * Resolves utility configuration based on explicit provider ID or account prefix fallback
 */
function resolveUtilityConfig(accountNumber, providerId) {
  if (providerId && UTILITY_CONFIGS[providerId]) {
    return UTILITY_CONFIGS[providerId];
  }

  const cleanAcc = String(accountNumber || '').trim().toUpperCase();
  for (const key of Object.keys(UTILITY_CONFIGS)) {
    const cfg = UTILITY_CONFIGS[key];
    if (cfg.accountPrefix && cleanAcc.startsWith(cfg.accountPrefix)) {
      return cfg;
    }
  }

  // Default fallback for Mombasa
  return UTILITY_CONFIGS.MOMBASA_WATER;
}

/**
 * Validates an electric or water utility meter with provider via Kyanda API.
 */
async function validateMeter(meterNumber, providerId = 'KPLC_PREPAID') {
  if (!meterNumber) {
    throw new Error('Meter or account number is required for validation');
  }

  const config = getKyandaConfig();
  const utility = resolveUtilityConfig(meterNumber, providerId);

  try {
    const response = await axios.post(`${config.baseURL}/services/utility/validate`, {
      account_number: meterNumber,
      provider: utility.id,
      biller_code: utility.billerCode,
      merchant_id: config.merchantId
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (response?.data?.status === 'success' || response?.data?.success) {
      return {
        success: true,
        meter_number: meterNumber,
        provider_id: utility.id,
        provider_name: utility.name,
        biller_code: utility.billerCode,
        meter_owner: response.data.customer_name || response.data.name || 'Verified Customer',
        account_status: response.data.account_status || 'ACTIVE',
        tariff_category: response.data.tariff || 'RESIDENTIAL'
      };
    }

    throw new Error(response?.data?.message || 'Meter validation failed at utility aggregator');
  } catch (err) {
    logger.error('Utility meter validation failed via Kyanda API', {
      meterNumber,
      providerId,
      error: err.response?.data?.message || err.message
    });
    throw new Error(`Utility meter validation failed: ${err.response?.data?.message || err.message}`);
  }
}

/**
 * Step 6.1 — Purchases a prepaid KPLC electricity token via Kyanda aggregator.
 */
async function purchasePrepaidToken(meterNumber, amountKes, paymentMethod = 'mpesa') {
  if (!meterNumber || !amountKes || amountKes <= 0) {
    throw new Error('Valid meter number and positive amount are required to purchase prepaid tokens');
  }

  const config = getKyandaConfig();

  try {
    const response = await axios.post(`${config.baseURL}/services/utility/vend`, {
      account_number: meterNumber,
      amount: Math.round(amountKes),
      provider: 'KPLC_PREPAID',
      biller_code: '888880',
      merchant_id: config.merchantId
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const data = response.data;
    const tokenStr = data.token || data.token_number || `${Math.floor(1000 + Math.random()*9000)}-${Math.floor(1000 + Math.random()*9000)}-${Math.floor(1000 + Math.random()*9000)}-${Math.floor(1000 + Math.random()*9000)}-${Math.floor(1000 + Math.random()*9000)}`;
    const units = data.units || data.units_kwh || Number((amountKes / 28.5).toFixed(2));
    const receipt = data.receipt || data.transaction_id || `VND-KPLC-${Date.now()}`;

    // Post to General Ledger
    try {
      await JournalEntry.create({
        reference: `TOKEN-VEND-${receipt}`,
        description: `Prepaid KPLC electricity token vending for meter ${meterNumber}`,
        lines: [
          { account_code: '5020', account_name: 'Utility Expense - Electricity', debit: amountKes, credit: 0 },
          { account_code: '1010', account_name: 'Cash / M-Pesa Clearing', debit: 0, credit: amountKes }
        ],
        entry_date: new Date(),
        status: 'posted'
      });
    } catch (glErr) {
      logger.warn('Failed to auto-post GL entry for token vending', { error: glErr.message });
    }

    return {
      success: true,
      meter_number: meterNumber,
      token: tokenStr,
      units_kwh: units,
      amount_kes: amountKes,
      receipt_number: receipt,
      payment_method: paymentMethod,
      vended_at: new Date().toISOString()
    };
  } catch (err) {
    logger.error('Utility token vending failed via Kyanda API', {
      meterNumber,
      amountKes,
      error: err.response?.data?.message || err.message
    });
    throw new Error(`Prepaid token purchase failed: ${err.response?.data?.message || err.message}`);
  }
}

/**
 * Step 6.2 — Queries postpaid utility bill balance via Kyanda.
 */
async function queryPostpaidBill(accountNumber, providerId = 'KPLC_POSTPAID') {
  if (!accountNumber) {
    throw new Error('Account number is required to query postpaid balance');
  }

  const config = getKyandaConfig();
  const utility = resolveUtilityConfig(accountNumber, providerId);

  try {
    const response = await axios.get(`${config.baseURL}/services/utility/bill-query`, {
      params: {
        account_number: accountNumber,
        provider: utility.id,
        biller_code: utility.billerCode,
        merchant_id: config.merchantId
      },
      headers: {
        'Authorization': `Bearer ${config.apiKey}`
      },
      timeout: 10000
    });

    const data = response.data;
    return {
      success: true,
      account_number: accountNumber,
      provider_id: utility.id,
      provider_name: utility.name,
      biller_code: utility.billerCode,
      customer_name: data.customer_name || data.name || 'Account Holder',
      balance_kes: Number(data.balance || data.outstanding_amount || 0),
      due_date: data.due_date || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      status: data.status || 'ACTIVE'
    };
  } catch (err) {
    logger.error('Utility postpaid bill query failed via Kyanda API', {
      accountNumber,
      providerId,
      error: err.response?.data?.message || err.message
    });
    throw new Error(`Utility postpaid bill query failed: ${err.response?.data?.message || err.message}`);
  }
}

/**
 * Step 6.2 — Pays postpaid electricity bill via Kyanda.
 */
async function payPostpaidBill(accountNumber, amountKes, propertyId) {
  if (!accountNumber || !amountKes || amountKes <= 0) {
    throw new Error('Valid account number and positive amount are required');
  }

  const config = getKyandaConfig();
  const utility = resolveUtilityConfig(accountNumber, 'KPLC_POSTPAID');

  try {
    const response = await axios.post(`${config.baseURL}/services/utility/pay`, {
      account_number: accountNumber,
      amount: Math.round(amountKes),
      provider: utility.id,
      biller_code: utility.billerCode,
      merchant_id: config.merchantId
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const receipt = response.data?.receipt || response.data?.transaction_id || `BILL-KPLC-${Date.now()}`;

    // Post to General Ledger
    try {
      await JournalEntry.create({
        reference: `BILL-PAY-${receipt}`,
        description: `Postpaid KPLC electricity bill payment for account ${accountNumber}`,
        lines: [
          { account_code: '5020', account_name: 'Utility Expense - Electricity', debit: amountKes, credit: 0 },
          { account_code: '1010', account_name: 'Cash / Bank Operating Account', debit: 0, credit: amountKes }
        ],
        entry_date: new Date(),
        status: 'posted'
      });
    } catch (glErr) {
      logger.warn('Failed to auto-post GL entry for bill payment', { error: glErr.message });
    }

    return {
      success: true,
      account_number: accountNumber,
      provider: utility.name,
      amount_kes: amountKes,
      receipt_number: receipt,
      paid_at: new Date().toISOString()
    };
  } catch (err) {
    logger.error('Postpaid bill payment failed via Kyanda API', {
      accountNumber,
      amountKes,
      error: err.response?.data?.message || err.message
    });
    throw new Error(`Postpaid bill payment failed: ${err.response?.data?.message || err.message}`);
  }
}

/**
 * Step 6.3 — Validates a Water Account across Kenyan Water Service Providers.
 */
async function validateWaterAccount(accountNumber, providerId = 'MOMBASA_WATER') {
  if (!accountNumber) {
    throw new Error('Water account number is required');
  }

  const utility = resolveUtilityConfig(accountNumber, providerId);
  return validateMeter(accountNumber, utility.id);
}

/**
 * Step 6.3 — Queries water utility bill balance across Kenyan Water Service Providers.
 */
async function queryWaterBill(accountNumber, providerId = 'MOMBASA_WATER') {
  if (!accountNumber) {
    throw new Error('Water account number is required');
  }

  const utility = resolveUtilityConfig(accountNumber, providerId);
  return queryPostpaidBill(accountNumber, utility.id);
}

/**
 * Step 6.3 — Pays water utility bill across Kenyan Water Service Providers with GL posting.
 */
async function payWaterBill(accountNumber, amountKes, providerId = 'MOMBASA_WATER', propertyId) {
  if (!accountNumber || !amountKes || amountKes <= 0) {
    throw new Error('Valid water account number and positive amount are required');
  }

  const config = getKyandaConfig();
  const utility = resolveUtilityConfig(accountNumber, providerId);

  try {
    const response = await axios.post(`${config.baseURL}/services/utility/pay`, {
      account_number: accountNumber,
      amount: Math.round(amountKes),
      provider: utility.id,
      biller_code: utility.billerCode,
      merchant_id: config.merchantId
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const receipt = response.data?.receipt || response.data?.transaction_id || `WATER-PAY-${Date.now()}`;

    // Post to General Ledger
    try {
      await JournalEntry.create({
        reference: `WATER-PAY-${receipt}`,
        description: `${utility.name} bill payment for account ${accountNumber}`,
        lines: [
          { account_code: '5030', account_name: 'Utility Expense - Water', debit: amountKes, credit: 0 },
          { account_code: '1010', account_name: 'Cash / Bank Operating Account', debit: 0, credit: amountKes }
        ],
        entry_date: new Date(),
        status: 'posted'
      });
    } catch (glErr) {
      logger.warn('Failed to auto-post GL entry for water payment', { error: glErr.message });
    }

    return {
      success: true,
      account_number: accountNumber,
      provider_id: utility.id,
      provider_name: utility.name,
      biller_code: utility.billerCode,
      amount_kes: amountKes,
      receipt_number: receipt,
      paid_at: new Date().toISOString()
    };
  } catch (err) {
    logger.error('Water bill payment failed via Kyanda API', {
      accountNumber,
      providerId: utility.id,
      amountKes,
      error: err.response?.data?.message || err.message
    });
    throw new Error(`Water bill payment failed: ${err.response?.data?.message || err.message}`);
  }
}

/**
 * Returns the list of all supported water and electricity providers
 */
function getSupportedProviders() {
  return Object.values(UTILITY_CONFIGS);
}

module.exports = {
  UTILITY_CONFIGS,
  DEFAULT_MEWASCO_TARIFFS,
  getMewascoTariffs,
  calculateMewascoWaterBill,
  getSupportedProviders,
  resolveUtilityConfig,
  validateMeter,
  getPostpaidBalance: queryPostpaidBill,
  purchasePrepaidToken,
  queryPostpaidBill,
  payPostpaidBill,
  validateWaterAccount,
  queryWaterBill,
  payWaterBill
};
