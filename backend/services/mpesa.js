const axios = require('axios');
const logger = require('../utils/logger');

class MpesaService {
  constructor() {
    this.baseURL = process.env.MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.shortcode = process.env.MPESA_SHORTCODE || '174379';
    this.passkey = process.env.MPESA_PASSKEY;
    this.callbackURL = process.env.MPESA_CALLBACK_URL;
    this.initiatorName = process.env.MPESA_INITIATOR_NAME || 'testapi';
    this.initiatorPassword = process.env.MPESA_INITIATOR_PASSWORD || 'Safaricom99#';
    this.cachedToken = null;
    this.tokenExpiry = null;

    // Cache for Organization Account Balance (5 minutes TTL)
    this.cachedBalance = null;
    this.balanceExpiry = 0;
  }

  async getAccessToken() {
    if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 60000) {
      return this.cachedToken;
    }
    if (!this.consumerKey || !this.consumerSecret) {
      logger.warn('M-Pesa consumer credentials missing');
      return 'SANDBOX_MOCK_TOKEN';
    }
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    const res = await axios.get(`${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 10000
    });
    this.cachedToken = res.data.access_token;
    const expiresInSeconds = parseInt(res.data.expires_in, 10) || 3599;
    this.tokenExpiry = Date.now() + (expiresInSeconds * 1000);
    return this.cachedToken;
  }

  generatePassword(timestamp) {
    const str = `${this.shortcode}${this.passkey || 'default_passkey'}${timestamp}`;
    return Buffer.from(str).toString('base64');
  }

  async initiateSTKPush({ phone, amount, accountReference, transactionDesc }) {
    const token = await this.getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = this.generatePassword(timestamp);
    const payload = {
      BusinessShortCode: this.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: this.formatPhone(phone),
      PartyB: this.shortcode,
      PhoneNumber: this.formatPhone(phone),
      CallBackURL: this.callbackURL || `${process.env.BACKEND_URL || 'https://mutunerent-api.onrender.com'}/api/v1/payments/callback`,
      AccountReference: accountReference.slice(0, 12),
      TransactionDesc: transactionDesc.slice(0, 13)
    };
    logger.info('STK Push initiated', { phone: payload.PhoneNumber, amount, accountReference });
    const res = await axios.post(`${this.baseURL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 15000
    });
    return {
      checkoutRequestId: res.data.CheckoutRequestID,
      merchantRequestId: res.data.MerchantRequestID,
      responseCode: res.data.ResponseCode,
      responseDescription: res.data.ResponseDescription,
      customerMessage: res.data.CustomerMessage
    };
  }

  async registerUrls() {
    const token = await this.getAccessToken();
    const payload = {
      ShortCode: this.shortcode,
      ResponseType: 'Completed',
      ConfirmationURL: `${this.callbackURL}/confirm`,
      ValidationURL: `${this.callbackURL}/validate`
    };
    const res = await axios.post(`${this.baseURL}/mpesa/c2b/v1/registerurl`, payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000
    });
    return res.data;
  }

  /**
   * Step 3.3 — Queries Safaricom Daraja for status of a transaction.
   */
  async queryTransactionStatus(transactionId) {
    const token = await this.getAccessToken();
    const payload = {
      Initiator: this.initiatorName,
      SecurityCredential: this.initiatorPassword,
      CommandID: 'TransactionStatusQuery',
      TransactionID: transactionId,
      PartyA: this.shortcode,
      IdentifierType: '4', // 4 = Organization ShortCode
      ResultURL: `${process.env.BACKEND_URL || 'https://mutunerent-api.onrender.com'}/api/v1/payments/status/result`,
      QueueTimeOutURL: `${process.env.BACKEND_URL || 'https://mutunerent-api.onrender.com'}/api/v1/payments/status/timeout`,
      Remarks: `Query Status ${transactionId}`,
      Occasion: 'StatusQuery'
    };

    if (token === 'SANDBOX_MOCK_TOKEN') {
      return {
        ResponseCode: '0',
        ResponseDescription: 'Accept the service request successfully (Mock)',
        ConversationID: `AG_${Date.now()}_CONV`,
        OriginatorConversationID: `AG_${Date.now()}_ORIG`
      };
    }

    const res = await axios.post(`${this.baseURL}/mpesa/transactionstatus/v1/query`, payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 15000
    });
    return res.data;
  }

  /**
   * Step 3.3 — Reverses an M-Pesa transaction.
   */
  async reverseTransaction({ transactionId, amount, reason = 'Disputed rent transaction reversal', receiverParty }) {
    const token = await this.getAccessToken();
    const payload = {
      Initiator: this.initiatorName,
      SecurityCredential: this.initiatorPassword,
      CommandID: 'TransactionReversal',
      TransactionID: transactionId,
      Amount: Math.round(amount),
      ReceiverParty: receiverParty || this.shortcode,
      RecieverIdentifierType: '11', // 11 = MSISDN, 4 = Organization
      ResultURL: `${process.env.BACKEND_URL || 'https://mutunerent-api.onrender.com'}/api/v1/payments/reversal/result`,
      QueueTimeOutURL: `${process.env.BACKEND_URL || 'https://mutunerent-api.onrender.com'}/api/v1/payments/reversal/timeout`,
      Remarks: reason.slice(0, 100),
      Occasion: 'Reversal'
    };

    if (token === 'SANDBOX_MOCK_TOKEN') {
      return {
        ResponseCode: '0',
        ResponseDescription: 'Accept the service request successfully (Mock)',
        ConversationID: `AG_${Date.now()}_REV_CONV`,
        OriginatorConversationID: `AG_${Date.now()}_REV_ORIG`
      };
    }

    const res = await axios.post(`${this.baseURL}/mpesa/reversal/v1/request`, payload, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 15000
    });
    return res.data;
  }

  /**
   * Step 3.4 — Queries M-Pesa Organization Working Float Balance (5 min cache).
   */
  async queryAccountBalance() {
    const now = Date.now();
    if (this.cachedBalance && now < this.balanceExpiry) {
      return this.cachedBalance;
    }

    const token = await this.getAccessToken();
    const payload = {
      Initiator: this.initiatorName,
      SecurityCredential: this.initiatorPassword,
      CommandID: 'AccountBalance',
      PartyA: this.shortcode,
      IdentifierType: '4', // Organization ShortCode
      Remarks: 'Working Float Query',
      QueueTimeOutURL: `${process.env.BACKEND_URL || 'https://mutunerent-api.onrender.com'}/api/v1/payments/balance/timeout`,
      ResultURL: `${process.env.BACKEND_URL || 'https://mutunerent-api.onrender.com'}/api/v1/payments/balance/result`
    };

    if (token === 'SANDBOX_MOCK_TOKEN') {
      const mockBalance = {
        success: true,
        shortcode: this.shortcode,
        working_float_kes: 450000.00,
        utility_balance_kes: 85000.00,
        charges_paid_kes: 1200.00,
        query_timestamp: new Date().toISOString(),
        is_cached: false
      };
      this.cachedBalance = mockBalance;
      this.balanceExpiry = now + (5 * 60 * 1000);
      return mockBalance;
    }

    try {
      const res = await axios.post(`${this.baseURL}/mpesa/accountbalance/v1/query`, payload, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 15000
      });

      const balanceData = {
        success: true,
        shortcode: this.shortcode,
        response_code: res.data.ResponseCode,
        response_description: res.data.ResponseDescription,
        conversation_id: res.data.ConversationID,
        query_timestamp: new Date().toISOString(),
        is_cached: false
      };

      this.cachedBalance = balanceData;
      this.balanceExpiry = now + (5 * 60 * 1000);
      return balanceData;
    } catch (err) {
      logger.error('Failed to query M-Pesa account balance', { error: err.message });
      throw new Error(`Account balance query failed: ${err.response?.data?.errorMessage || err.message}`);
    }
  }

  async registerC2BUrls() {
    const token = await this.getAccessToken();
    const payload = {
      ShortCode: this.shortcode,
      ResponseType: 'Completed',
      ConfirmationURL: process.env.MPESA_C2B_CONFIRMATION_URL || `${process.env.BACKEND_URL || 'https://mutunerent-api.onrender.com'}/api/v1/payments/c2b/confirm`,
      ValidationURL: process.env.MPESA_C2B_VALIDATION_URL || `${process.env.BACKEND_URL || 'https://mutunerent-api.onrender.com'}/api/v1/payments/c2b/validate`
    };

    if (token === 'SANDBOX_MOCK_TOKEN') {
      return {
        OriginatorCoversationID: 'MOCK-C2B-REG-001',
        ResponseCode: '0',
        ResponseDescription: 'Success (Sandbox Mock)'
      };
    }

    const response = await axios.post(
      `${this.baseURL}/mpesa/c2b/v1/registerurl`,
      payload,
      {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );
    return response.data;
  }

  formatPhone(phone) {
    let cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '254' + cleaned.slice(1);
    if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
    return cleaned;
  }
}

module.exports = new MpesaService();
