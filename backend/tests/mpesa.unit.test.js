const axios = require('axios');
const mpesaService = require('../services/mpesa');

describe('MpesaService Unit Tests', () => {
  let getSpy, postSpy;

  afterEach(() => {
    if (getSpy) getSpy.mockRestore();
    if (postSpy) postSpy.mockRestore();
  });

  describe('formatPhone', () => {
    test('formats standard Kenyan local phone to 254', () => {
      expect(mpesaService.formatPhone('0712345678')).toBe('254712345678');
      expect(mpesaService.formatPhone('0112345678')).toBe('254112345678');
    });

    test('preserves valid 254 phone', () => {
      expect(mpesaService.formatPhone('254712345678')).toBe('254712345678');
      expect(mpesaService.formatPhone('+254712345678')).toBe('254712345678');
    });
  });

  describe('generatePassword', () => {
    test('generates base64 encoded password matching Daraja format', () => {
      const timestamp = '20260817103000';
      const expected = Buffer.from(`${mpesaService.shortcode}${mpesaService.passkey}${timestamp}`).toString('base64');
      expect(mpesaService.generatePassword(timestamp)).toBe(expected);
    });
  });

  describe('getAccessToken', () => {
    test('fetches and caches OAuth token from Daraja', async () => {
      mpesaService.cachedToken = null;
      getSpy = jest.spyOn(axios, 'get').mockResolvedValueOnce({
        data: { access_token: 'mock-daraja-token-12345', expires_in: '3599' }
      });

      const token = await mpesaService.getAccessToken();
      expect(token).toBe('mock-daraja-token-12345');
      expect(getSpy).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/v1/generate'),
        expect.any(Object)
      );
    });
  });

  describe('initiateSTKPush', () => {
    test('formats STK push payload and calls Safaricom API', async () => {
      mpesaService.cachedToken = 'mock-daraja-token';
      mpesaService.tokenExpiry = Date.now() + 1000000;

      postSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
        data: {
          MerchantRequestID: '29115-34620561-1',
          CheckoutRequestID: 'ws_CO_17082026103000',
          ResponseCode: '0',
          ResponseDescription: 'Success. Request accepted for processing',
          CustomerMessage: 'Success. Request accepted for processing'
        }
      });

      const result = await mpesaService.initiateSTKPush({
        phone: '0712345678',
        amount: 15000,
        accountReference: 'NYA-001',
        transactionDesc: 'Rent payment'
      });

      expect(result.checkoutRequestId).toBe('ws_CO_17082026103000');
      expect(postSpy).toHaveBeenCalledWith(
        expect.stringContaining('/mpesa/stkpush/v1/processrequest'),
        expect.objectContaining({
          Amount: 15000,
          PartyA: '254712345678',
          PhoneNumber: '254712345678',
          TransactionType: 'CustomerPayBillOnline'
        }),
        expect.any(Object)
      );
    });
  });

  describe('registerC2BUrls', () => {
    test('calls Daraja C2B URL registration endpoint', async () => {
      mpesaService.cachedToken = 'mock-daraja-token';
      mpesaService.tokenExpiry = Date.now() + 1000000;

      postSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
        data: {
          ConversationID: 'AG_20260817_001',
          OriginatorConversationID: '12345',
          ResponseDescription: 'success'
        }
      });

      const res = await mpesaService.registerC2BUrls();
      expect(res.ResponseDescription).toBe('success');
    });
  });
});
