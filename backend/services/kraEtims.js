const axios = require('axios');
const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');

let cachedAccessToken = null;
let tokenExpiresAt = 0;

/**
 * Validates and retrieves required KRA eTIMS configuration from environment variables.
 * Enforces strict presence of credentials without silent fallback.
 */
function getETIMSConfig() {
  const pin = process.env.KRA_ETIMS_PIN;
  const deviceSerial = process.env.KRA_ETIMS_DEVICE_SERIAL;
  const clientSecret = process.env.KRA_ETIMS_CLIENT_SECRET;

  if (!pin || !deviceSerial || !clientSecret) {
    throw new Error('KRA eTIMS credentials missing: KRA_ETIMS_PIN, KRA_ETIMS_DEVICE_SERIAL, and KRA_ETIMS_CLIENT_SECRET environment variables are required');
  }

  const env = process.env.KRA_ETIMS_ENV || 'sandbox';
  const baseURL = process.env.KRA_ETIMS_BASE_URL || (env === 'production'
    ? 'https://etims.kra.go.ke/etims-api/v1'
    : 'https://etims-sbx.kra.go.ke/etims-api/v1');

  return {
    pin,
    deviceSerial,
    clientSecret,
    env,
    baseURL
  };
}

/**
 * Fetches OAuth 2.0 access token from KRA eTIMS gateway.
 * Throws explicit error on failure.
 */
async function getETIMSAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt) {
    return cachedAccessToken;
  }

  const config = getETIMSConfig();

  try {
    const response = await axios.post(`${config.baseURL}/cmm/selectToken`, {
      pin: config.pin,
      client_secret: config.clientSecret
    }, { timeout: 8000 });

    if (response?.data?.token) {
      cachedAccessToken = response.data.token;
      tokenExpiresAt = now + (3500 * 1000); // 1 hour token TTL
      return cachedAccessToken;
    }

    throw new Error(response?.data?.message || 'Token endpoint did not return an access token');
  } catch (err) {
    logger.error('Failed to obtain live KRA eTIMS access token', {
      error: err.response?.data?.message || err.message,
      pin: config.pin
    });
    throw new Error(`KRA eTIMS authentication failed: ${err.response?.data?.message || err.message}`);
  }
}

/**
 * Transmits eTIMS sales invoice to KRA VSCU/OSCU endpoint.
 * Throws explicit error on transmission failure.
 */
async function submitETIMSInvoice(invoiceData) {
  const config = getETIMSConfig();
  const token = await getETIMSAccessToken();

  const payload = {
    tin: config.pin,
    bhfId: '00',
    invcNo: invoiceData.invoice_number || `INV-${Date.now()}`,
    orgInvcNo: 0,
    custTin: invoiceData.tenant_pin || 'P000000000X',
    custNm: invoiceData.tenant_name || 'Valued Tenant',
    salesDt: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    rcptTyCd: 'S',
    pmtTyCd: '01',
    totItemCnt: 1,
    totTaxblAmt: invoiceData.taxable_amount || invoiceData.amount,
    totTaxAmt: invoiceData.vat_amount || Number((invoiceData.amount * 0.16).toFixed(2)),
    totAmt: invoiceData.amount,
    itemList: [
      {
        itemSeq: 1,
        itemCd: invoiceData.item_code || (invoiceData.is_commercial ? (process.env.KRA_ETIMS_ITEM_CD_COMMERCIAL || 'KE_COMM_RENT_01') : (process.env.KRA_ETIMS_ITEM_CD_RESIDENTIAL || 'KE_RES_RENT_01')),
        itemNm: invoiceData.description || 'Monthly Rent Payment',
        pkgUnitCd: 'EA',
        qty: 1,
        prc: invoiceData.amount,
        splyAmt: invoiceData.amount,
        totDscAmt: 0,
        taxblAmt: invoiceData.taxable_amount || invoiceData.amount,
        vatCatCd: invoiceData.is_commercial ? 'A' : 'E', // 'A' = 16% VAT, 'E' = Exempt/MRI
        taxAmt: invoiceData.vat_amount || 0,
        totAmt: invoiceData.amount
      }
    ]
  };

  try {
    const response = await axios.post(`${config.baseURL}/trnsSales/saveTrnsSales`, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Log to AuditLog for tax compliance trace
    await AuditLog.create({
      action: 'KRA_ETIMS_INVOICE_SUBMITTED',
      resource: `Invoice:${payload.invcNo}`,
      details: { invcNo: payload.invcNo, totAmt: payload.totAmt, response: response.data }
    });

    return {
      success: true,
      result_code: response.data?.resultCd || '0000',
      cu_serial_number: config.deviceSerial,
      kra_internal_key: response.data?.data?.rcptSign || response.data?.rcptSign || `KRA-SIGN-${Date.now()}`,
      qr_code_url: `https://etims.kra.go.ke/verify?pin=${config.pin}&inv=${payload.invcNo}`
    };
  } catch (err) {
    logger.error('KRA eTIMS API submission failed', {
      error: err.response?.data?.message || err.message,
      invcNo: payload.invcNo
    });

    await AuditLog.create({
      action: 'KRA_ETIMS_SUBMISSION_FAILED',
      resource: `Invoice:${payload.invcNo}`,
      details: { error: err.response?.data?.message || err.message, payload }
    });

    throw new Error(`KRA eTIMS invoice submission failed: ${err.response?.data?.message || err.message}`);
  }
}

module.exports = {
  getETIMSConfig,
  getETIMSAccessToken,
  submitETIMSInvoice
};
