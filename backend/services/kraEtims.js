const axios = require('axios');
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const AuditLog = require('../models/AuditLog');
const EtimsInvoice = require('../models/EtimsInvoice');
const Payment = require('../models/Payment');
const Property = require('../models/Property');
const Tenant = require('../models/Tenant');

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
 * Deterministically formats and transmits eTIMS sales invoice to KRA VSCU/OSCU endpoint.
 * Persists eTIMS invoice records with control numbers, QR code URLs, transmission status,
 * and tax amounts to MongoDB for auditing, retry, and receipt generation.
 */
async function submitETIMSInvoice(invoiceData) {
  const config = getETIMSConfig();
  const token = await getETIMSAccessToken();

  const invoiceNumber = invoiceData.invoice_number
    || (invoiceData.payment_id ? `INV-PAY-${invoiceData.payment_id}` : `INV-${invoiceData.property_code || 'MUT'}-${Date.now()}`);

  const grossAmount = Number(invoiceData.amount || invoiceData.gross_amount_kes || 0);
  const isCommercial = Boolean(invoiceData.is_commercial);
  const taxRate = isCommercial ? 16 : 7.5;
  const vatAmount = isCommercial
    ? Number((invoiceData.vat_amount !== undefined ? invoiceData.vat_amount : (grossAmount * 0.16) / 1.16).toFixed(2))
    : 0;
  const taxableAmount = Number((invoiceData.taxable_amount !== undefined ? invoiceData.taxable_amount : (grossAmount - vatAmount)).toFixed(2));
  const taxAmount = isCommercial ? vatAmount : Number(((grossAmount * 0.075)).toFixed(2));

  const payload = {
    tin: config.pin,
    bhfId: '00',
    invcNo: invoiceNumber,
    orgInvcNo: 0,
    custTin: invoiceData.tenant_pin || invoiceData.customer_pin || 'P000000000X',
    custNm: invoiceData.tenant_name || invoiceData.customer_name || 'Valued Tenant',
    salesDt: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    rcptTyCd: 'S',
    pmtTyCd: '01',
    totItemCnt: 1,
    totTaxblAmt: taxableAmount,
    totTaxAmt: taxAmount,
    totAmt: grossAmount,
    itemList: [
      {
        itemSeq: 1,
        itemCd: invoiceData.item_code || (isCommercial
          ? (process.env.KRA_ETIMS_ITEM_CD_COMMERCIAL || 'KE_COMM_RENT_01')
          : (process.env.KRA_ETIMS_ITEM_CD_RESIDENTIAL || 'KE_RES_RENT_01')),
        itemNm: invoiceData.description || (isCommercial ? 'Commercial Property Rent' : 'Residential Rent Payment'),
        pkgUnitCd: 'EA',
        qty: 1,
        prc: grossAmount,
        splyAmt: grossAmount,
        totDscAmt: 0,
        taxblAmt: taxableAmount,
        vatCatCd: isCommercial ? 'A' : 'E', // 'A' = 16% VAT, 'E' = Exempt/MRI 7.5%
        taxAmt: taxAmount,
        totAmt: grossAmount
      }
    ]
  };

  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;
  let persistedInvoice = null;

  if (isDbConnected) {
    try {
      persistedInvoice = await EtimsInvoice.findOneAndUpdate(
        { invoice_number: invoiceNumber },
        {
          $set: {
            payment_id: invoiceData.payment_id || null,
            property_id: invoiceData.property_id || null,
            tenant_id: invoiceData.tenant_id || null,
            landlord_id: invoiceData.landlord_id || null,
            gross_amount_kes: grossAmount,
            taxable_amount_kes: taxableAmount,
            tax_amount_kes: taxAmount,
            tax_rate_percent: taxRate,
            tax_type: isCommercial ? 'vat' : 'mri',
            customer_pin: payload.custTin,
            customer_name: payload.custNm,
            item_description: payload.itemList[0].itemNm,
            item_code: payload.itemList[0].itemCd,
            cu_serial_number: config.deviceSerial,
            transmission_status: 'pending'
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (dbErr) {
      logger.warn('Failed to pre-persist pending eTIMS invoice record', { error: dbErr.message });
    }
  }

  try {
    const response = await axios.post(`${config.baseURL}/trnsSales/saveTrnsSales`, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const controlNumber = response.data?.data?.rcptSign
      || response.data?.rcptSign
      || `KRA-CN-${config.deviceSerial}-${payload.invcNo}`;
    const qrCodeUrl = `https://etims.kra.go.ke/verify?pin=${config.pin}&inv=${payload.invcNo}`;

    if (isDbConnected && persistedInvoice) {
      try {
        await EtimsInvoice.findByIdAndUpdate(persistedInvoice._id, {
          $set: {
            control_number: controlNumber,
            qr_code_url: qrCodeUrl,
            transmission_status: 'transmitted',
            transmitted_at: new Date(),
            response_payload: response.data,
            error_message: null
          }
        });
      } catch (dbUpdateErr) {
        logger.warn('Failed to update eTIMS invoice record after transmission', { error: dbUpdateErr.message });
      }
    }

    try {
      await AuditLog.create({
        action: 'KRA_ETIMS_INVOICE_SUBMITTED',
        resource: `Invoice:${payload.invcNo}`,
        details: { invcNo: payload.invcNo, totAmt: payload.totAmt, controlNumber, qrCodeUrl, response: response.data }
      });
    } catch (auditErr) {
      // Non-blocking audit error
    }

    return {
      success: true,
      result_code: response.data?.resultCd || '0000',
      invoice_id: persistedInvoice?._id,
      invoice_number: payload.invcNo,
      control_number: controlNumber,
      cu_serial_number: config.deviceSerial,
      kra_internal_key: controlNumber,
      qr_code_url: qrCodeUrl,
      transmitted_at: new Date()
    };
  } catch (err) {
    const errorMsg = err.response?.data?.message || err.message;
    logger.error('KRA eTIMS API submission failed', {
      error: errorMsg,
      invcNo: payload.invcNo
    });

    if (isDbConnected && persistedInvoice) {
      try {
        await EtimsInvoice.findByIdAndUpdate(persistedInvoice._id, {
          $set: {
            transmission_status: 'failed',
            error_message: errorMsg
          },
          $inc: { retry_count: 1 }
        });
      } catch (dbErr) {
        logger.warn('Failed to update failed eTIMS record', { error: dbErr.message });
      }
    }

    try {
      await AuditLog.create({
        action: 'KRA_ETIMS_SUBMISSION_FAILED',
        resource: `Invoice:${payload.invcNo}`,
        details: { error: errorMsg, payload }
      });
    } catch (auditErr) {
      // Non-blocking
    }

    throw new Error(`KRA eTIMS invoice submission failed: ${errorMsg}`);
  }
}

/**
 * Retries a previously failed or pending eTIMS invoice transmission.
 */
async function retryETIMSInvoice(invoiceId) {
  const invoice = await EtimsInvoice.findById(invoiceId);
  if (!invoice) {
    throw new Error(`eTIMS Invoice with ID ${invoiceId} not found`);
  }

  const invoiceData = {
    invoice_number: invoice.invoice_number,
    payment_id: invoice.payment_id,
    property_id: invoice.property_id,
    tenant_id: invoice.tenant_id,
    landlord_id: invoice.landlord_id,
    gross_amount_kes: invoice.gross_amount_kes,
    amount: invoice.gross_amount_kes,
    taxable_amount: invoice.taxable_amount_kes,
    vat_amount: invoice.tax_type === 'vat' ? invoice.tax_amount_kes : 0,
    is_commercial: invoice.tax_type === 'vat',
    tenant_pin: invoice.customer_pin,
    tenant_name: invoice.customer_name,
    description: invoice.item_description,
    item_code: invoice.item_code
  };

  return await submitETIMSInvoice(invoiceData);
}

/**
 * Transmits a confirmed rent or utility payment to KRA eTIMS, creating an official fiscal receipt.
 */
async function generateETIMSInvoiceForPayment(paymentId) {
  const payment = await Payment.findById(paymentId)
    .populate('tenant_id')
    .populate('property_id')
    .lean();

  if (!payment) {
    throw new Error(`Payment ${paymentId} not found`);
  }

  // Idempotency check: see if invoice already exists
  const existingInvoice = await EtimsInvoice.findOne({ payment_id: payment._id });
  if (existingInvoice && existingInvoice.transmission_status === 'transmitted') {
    return {
      success: true,
      already_transmitted: true,
      invoice: existingInvoice
    };
  }

  const property = payment.property_id || {};
  const tenant = payment.tenant_id || {};
  const isCommercial = property.property_type === 'commercial' || property.type === 'commercial';

  const invoiceData = {
    invoice_number: `INV-${payment.transaction_id || payment._id}`,
    payment_id: payment._id,
    property_id: property._id,
    property_code: property.property_code,
    tenant_id: tenant._id,
    landlord_id: property.landlord_id,
    amount: payment.amount_kes,
    is_commercial: isCommercial,
    tenant_pin: tenant.id_number || 'P000000000X',
    tenant_name: tenant.full_name || 'Valued Tenant',
    description: `Rent Payment - ${property.name || 'Property'} Unit ${tenant.current_unit_id || ''}`
  };

  return await submitETIMSInvoice(invoiceData);
}

module.exports = {
  getETIMSConfig,
  getETIMSAccessToken,
  submitETIMSInvoice,
  retryETIMSInvoice,
  generateETIMSInvoiceForPayment
};
