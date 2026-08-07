const axios = require('axios');
const logger = require('../utils/logger');

class MpesaService {
  constructor() {
    this.baseURL = process.env.MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.shortcode = process.env.MPESA_SHORTCODE;
    this.passkey = process.env.MPESA_PASSKEY;
    this.callbackURL = process.env.MPESA_CALLBACK_URL;
    this.cachedToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.cachedToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 60000) {
      return this.cachedToken;
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
    const str = `${this.shortcode}${this.passkey}${timestamp}`;
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
      CallBackURL: this.callbackURL,
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

  formatPhone(phone) {
    let cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '254' + cleaned.slice(1);
    if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
    return cleaned;
  }
}

module.exports = new MpesaService();
