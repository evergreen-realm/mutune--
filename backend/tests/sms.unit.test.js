const smsService = require('../services/sms');

describe('SMSService Unit Tests', () => {
  describe('formatPhone', () => {
    test('formats local Kenyan numbers with 07/01 to 254', () => {
      expect(smsService.formatPhone('0712345678')).toBe('254712345678');
      expect(smsService.formatPhone('0112345678')).toBe('254112345678');
    });

    test('preserves valid 254 numbers and strips leading plus', () => {
      expect(smsService.formatPhone('+254712345678')).toBe('254712345678');
      expect(smsService.formatPhone('254712345678')).toBe('254712345678');
    });

    test('returns null for invalid numbers', () => {
      expect(smsService.formatPhone('12345')).toBeNull();
      expect(smsService.formatPhone('invalid-phone')).toBeNull();
      expect(smsService.formatPhone('')).toBeNull();
    });
  });

  describe('constructor env validation', () => {
    test('throws if AT_API_KEY is missing', () => {
      const origKey = process.env.AT_API_KEY;
      try {
        delete process.env.AT_API_KEY;
        expect(() => {
          jest.isolateModules(() => {
            require('../services/sms');
          });
        }).toThrow('AT_API_KEY environment variable is required');
      } finally {
        process.env.AT_API_KEY = origKey || 'test-at-api-key';
      }
    });
  });
});
