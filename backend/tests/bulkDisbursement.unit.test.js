const axios = require('axios');

const {
  getDarajaAccessToken,
  sendDarajaB2CPayout
} = require('../services/bulkDisbursement');

describe('BulkDisbursement Service Unit Tests', () => {
  let getSpy;

  afterEach(() => {
    if (getSpy) getSpy.mockRestore();
  });

  test('getDarajaAccessToken returns sandbox mock or token', async () => {
    const token = await getDarajaAccessToken();
    expect(token).toBeDefined();
  });

  test('sendDarajaB2CPayout validates phone requirement', async () => {
    await expect(sendDarajaB2CPayout({ phone: '', amount_kes: 5000, remarks: 'Salary' }))
      .rejects.toThrow('Phone number is required for B2C disbursement');
  });

  test('sendDarajaB2CPayout executes payout format in sandbox mode', async () => {
    const result = await sendDarajaB2CPayout({
      phone: '0712345678',
      amount_kes: 12000,
      remarks: 'Agent Commission',
      occasion: 'August 2026'
    });

    expect(result).toBeDefined();
    expect(result.ResponseCode).toBe('0');
  });
});
