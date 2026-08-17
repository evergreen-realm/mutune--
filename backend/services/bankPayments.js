const axios = require('axios');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const { postJournalEntry } = require('./financials');
const logger = require('../utils/logger');

function getIntaSendConfig() {
  const publishableKey = process.env.INTASEND_PUBLISHABLE_KEY;
  const secretKey = process.env.INTASEND_SECRET_KEY;
  const env = process.env.INTASEND_ENVIRONMENT || 'sandbox';

  if (!publishableKey || !secretKey) {
    logger.warn('IntaSend credentials missing in environment variables');
  }

  const baseURL = env === 'production'
    ? 'https://payment.intasend.com/api/v1'
    : 'https://sandbox.intasend.com/api/v1';

  return {
    publishableKey,
    secretKey,
    env,
    baseURL
  };
}

/**
 * Creates an IntaSend multi-bank / card checkout session for rent collection.
 */
async function createCollectionCheckout({ tenant_id, unit_id, property_id, amount_kes, email, phone, redirect_url, payment_type = 'rent' }) {
  const config = getIntaSendConfig();
  if (!config.secretKey) {
    throw new Error('INTASEND_SECRET_KEY environment variable is required for bank payment operations');
  }

  const tenant = await Tenant.findById(tenant_id).lean();
  if (!tenant) throw new Error('Tenant not found');

  const property = property_id ? await Property.findById(property_id).lean() : null;
  const transactionId = `BNK-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  const payload = {
    public_key: config.publishableKey,
    amount: Math.round(amount_kes),
    currency: 'KES',
    email: email || tenant.email || 'tenant@mutunerent.co.ke',
    phone_number: phone || tenant.phone || '254700000000',
    narrative: `Rent Payment - ${tenant.full_name} (${property ? property.name : 'Unit'})`,
    redirect_url: redirect_url || `${process.env.FRONTEND_URL || 'https://mutune-alpha.vercel.app'}/tenant-portal?payment=success`,
    api_ref: transactionId
  };

  try {
    const response = await axios.post(`${config.baseURL}/checkout/`, payload, {
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const checkoutData = response.data;

    // Create pending payment record
    const payment = await Payment.create({
      transaction_id: transactionId,
      external_reference: checkoutData.id || checkoutData.invoice_id,
      tenant_id,
      property_id: property?._id || tenant.current_property_id,
      unit_id: unit_id || tenant.current_unit_id,
      amount_kes: Math.round(amount_kes),
      amount_cents: Math.round(amount_kes * 100),
      payment_type,
      channel: 'bank_transfer',
      status: 'pending',
      workflow_state: 'PENDING_VIEWING'
    });

    logger.info('IntaSend checkout session created', { transactionId, checkoutId: checkoutData.id });

    return {
      success: true,
      transaction_id: transactionId,
      checkout_url: checkoutData.url,
      checkout_id: checkoutData.id,
      payment_id: payment._id
    };
  } catch (err) {
    logger.error('Failed to create IntaSend checkout session', {
      error: err.response?.data || err.message,
      tenant_id
    });
    throw new Error(`Bank payment initiation failed: ${err.response?.data?.message || err.message}`);
  }
}

/**
 * Handles IntaSend Webhook (IPN) notifications.
 */
async function handleBankWebhook(payload, signature) {
  const config = getIntaSendConfig();
  logger.info('IntaSend webhook received', { state: payload.state, invoiceId: payload.invoice_id });

  if (payload.state === 'COMPLETE' || payload.state === 'SUCCESSFUL') {
    const transactionId = payload.api_ref;
    const invoiceId = payload.invoice_id || payload.id;

    let payment = null;
    if (transactionId) {
      payment = await Payment.findOne({ transaction_id: transactionId });
    }
    if (!payment && invoiceId) {
      payment = await Payment.findOne({ external_reference: invoiceId });
    }

    if (payment) {
      payment.status = 'confirmed';
      payment.mpesa_receipt = payload.mpesa_reference || payload.provider_ref || invoiceId;
      payment.paid_at = new Date();
      payment.workflow_state = 'CONFIRMED';
      await payment.save();

      // Post Double-Entry Journal Entry
      try {
        await postJournalEntry({
          reference_type: 'rent_payment',
          reference_id: payment._id,
          property_id: payment.property_id,
          line_items: [
            { account_code: '1020', debit_kes: payment.amount_kes, credit_kes: 0, description: `Bank Rent Collection ${payment.transaction_id}` },
            { account_code: '1100', debit_kes: 0, credit_kes: payment.amount_kes, description: `Rent Receivable Cleared` }
          ],
          notes: `Multi-Bank Collection: Ref ${invoiceId}`
        });
      } catch (glErr) {
        logger.error('Failed to post GL entry for bank payment', { error: glErr.message });
      }

      logger.info('Bank payment confirmed and reconciled', { paymentId: payment._id, transactionId });
      return { success: true, reconciled: true, payment_id: payment._id };
    }
  }

  return { success: true, processed: true };
}

/**
 * Polls IntaSend for real-time payment status.
 */
async function getBankTransactionStatus(invoiceId) {
  const config = getIntaSendConfig();
  if (!config.secretKey) {
    throw new Error('INTASEND_SECRET_KEY is required to check payment status');
  }

  try {
    const response = await axios.post(`${config.baseURL}/payment/status/`, {
      invoice_id: invoiceId
    }, {
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const data = response.data;
    return {
      success: true,
      invoice_id: data.invoice?.invoice_id || invoiceId,
      state: data.invoice?.state,
      amount: data.invoice?.net_amount || data.invoice?.value,
      currency: data.invoice?.currency,
      provider: data.invoice?.provider,
      provider_ref: data.invoice?.provider_ref,
      created_at: data.invoice?.created_at
    };
  } catch (err) {
    logger.error('Failed to query IntaSend payment status', { error: err.message, invoiceId });
    throw new Error(`Failed to query transaction status: ${err.response?.data?.message || err.message}`);
  }
}

/**
 * Executes a B2C bank payout via IntaSend.
 */
async function disburseToBank({ account_number, bank_code, amount_kes, narrative, recipient_name }) {
  const config = getIntaSendConfig();
  if (!config.secretKey) {
    throw new Error('INTASEND_SECRET_KEY is required for bank disbursement');
  }

  const payload = {
    currency: 'KES',
    transactions: [
      {
        account: account_number,
        bank_code: bank_code || '01', // Default KCB Bank code
        amount: Math.round(amount_kes),
        narrative: narrative || 'MutuneRent Landlord Remittance',
        name: recipient_name || 'Landlord'
      }
    ]
  };

  try {
    const response = await axios.post(`${config.baseURL}/send-money/initiate/`, payload, {
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    return {
      success: true,
      tracking_id: response.data.tracking_id,
      status: response.data.status || 'Processing',
      channel: 'bank_transfer'
    };
  } catch (err) {
    logger.error('Failed IntaSend bank disbursement', {
      error: err.response?.data || err.message,
      account_number
    });
    throw new Error(`Bank disbursement failed: ${err.response?.data?.message || err.message}`);
  }
}

module.exports = {
  createCollectionCheckout,
  handleBankWebhook,
  getBankTransactionStatus,
  disburseToBank
};
