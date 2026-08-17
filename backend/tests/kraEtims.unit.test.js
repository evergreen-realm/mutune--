const axios = require('axios');

describe('KRA eTIMS Service Unit Tests', () => {
  const origEnv = { ...process.env };
  let postSpy;

  beforeEach(() => {
    process.env.KRA_ETIMS_PIN = 'P051234567Z';
    process.env.KRA_ETIMS_DEVICE_SERIAL = 'KRA-CU-0012345';
    process.env.KRA_ETIMS_CLIENT_SECRET = 'secret-test-key';
    process.env.KRA_ETIMS_ENV = 'sandbox';
  });

  afterEach(() => {
    if (postSpy) postSpy.mockRestore();
  });

  afterAll(() => {
    process.env = origEnv;
  });

  test('throws error if KRA_ETIMS_PIN is missing', () => {
    delete process.env.KRA_ETIMS_PIN;
    const { getETIMSConfig } = require('../services/kraEtims');
    expect(() => getETIMSConfig()).toThrow(/KRA eTIMS credentials missing/);
  });

  test('getETIMSAccessToken requests token with credentials', async () => {
    postSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { token: 'mock-etims-jwt-token-12345' }
    });

    const { getETIMSAccessToken } = require('../services/kraEtims');
    const token = await getETIMSAccessToken();
    expect(token).toBe('mock-etims-jwt-token-12345');
    expect(postSpy).toHaveBeenCalledWith(
      expect.stringContaining('/cmm/selectToken'),
      {
        pin: 'P051234567Z',
        client_secret: 'secret-test-key'
      },
      expect.any(Object)
    );
  });

  test('submitETIMSInvoice transmits eTIMS payload', async () => {
    postSpy = jest.spyOn(axios, 'post')
      .mockResolvedValueOnce({ data: { token: 'mock-etims-jwt-token-12345' } })
      .mockResolvedValueOnce({
        data: {
          resultCd: '0000',
          resultMsg: 'Success',
          rcptSign: 'SIGN-12345-KRA-QR'
        }
      });

    const { submitETIMSInvoice } = require('../services/kraEtims');
    const result = await submitETIMSInvoice({
      invoice_number: 'INV-2026-001',
      tenant_pin: 'A009876543B',
      tenant_name: 'Test Tenant',
      amount: 25000,
      taxable_amount: 21551.72,
      vat_amount: 3448.28,
      property_code: 'NYA-001'
    });

    expect(result.success).toBe(true);
    expect(result.result_code).toBe('0000');
  });
});
