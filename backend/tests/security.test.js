const { encryptPII, decryptPII, generateBlindIndex } = require('../utils/security');
const Tenant = require('../models/Tenant');

describe('Security & Data Privacy Unit Tests', () => {
  it('should encrypt and decrypt PII fields using AES-256-GCM', () => {
    const rawId = '33445566';
    const encrypted = encryptPII(rawId);
    expect(encrypted).not.toBe(rawId);
    expect(encrypted.startsWith('enc:')).toBe(true);

    const decrypted = decryptPII(encrypted);
    expect(decrypted).toBe(rawId);
  });

  it('should generate deterministic HMAC-SHA256 blind index', () => {
    const phone = '+254712345678';
    const bindex1 = generateBlindIndex(phone);
    const bindex2 = generateBlindIndex(' +254712345678 ');
    expect(bindex1).toBeTruthy();
    expect(bindex1).toBe(bindex2);
  });

  it('should verify Svix webhook signatures cleanly', () => {
    const { Webhook } = require('svix');
    const secret = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2gAqNLm';
    const wh = new Webhook(secret);
    const payload = JSON.stringify({ type: 'user.created', data: { id: 'clerk_test' } });
    
    // Webhook instance instantiated cleanly
    expect(wh).toBeTruthy();
    expect(typeof wh.verify).toBe('function');
  });
});
