const AfricasTalking = require('africastalking');
const logger = require('../utils/logger');

class SMSService {
  constructor() {
    this.client = AfricasTalking({
      apiKey: process.env.AFRICAS_TALKING_API_KEY || process.env.AT_API_KEY,
      username: process.env.AFRICAS_TALKING_USERNAME || process.env.AT_USERNAME || 'sandbox'
    });
    this.sms = this.client.SMS;
    this.from = process.env.AFRICAS_TALKING_SMS_FROM || process.env.AT_FROM || 'MutuneRent';
  }

  async send(phone, message) {
    const formatted = this.formatPhone(phone);
    if (!formatted) {
      logger.error('Invalid phone number', { phone });
      return { success: false, error: 'Invalid phone number' };
    }
    try {
      const result = await this.sms.send({
        to: [formatted],
        message: message.slice(0, 480),
        from: this.from
      });
      const recipient = result.SMSMessageData?.Recipients?.[0];
      logger.info('SMS sent', { phone: formatted, status: recipient?.status, messageId: recipient?.messageId });
      return { success: true, messageId: recipient?.messageId, status: recipient?.status, cost: recipient?.cost };
    } catch (error) {
      logger.error('SMS send failed', { phone: formatted, error: error.message });
      return { success: false, error: error.message };
    }
  }

  async sendBulk(recipients) {
    const results = [];
    for (const r of recipients) {
      results.push(await this.send(r.phone, r.message));
    }
    return results;
  }

  formatPhone(phone) {
    let cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '254' + cleaned.slice(1);
    if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);
    if (cleaned.length !== 12 || !cleaned.startsWith('254')) return null;
    return cleaned;
  }
}

module.exports = new SMSService();
