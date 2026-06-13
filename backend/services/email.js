const { Resend } = require('resend');
const logger = require('../utils/logger');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

/**
 * Send an email using Resend.
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML email body
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function sendEmail(to, subject, html) {
  if (!resend) {
    logger.warn('Resend API key not configured, skipping email send', { to, subject });
    return { success: false, error: 'Not configured' };
  }
  try {
    const data = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html
    });
    logger.info('Email sent successfully', { to, subject, id: data.id });
    return { success: true, data };
  } catch (error) {
    logger.error('Failed to send email', { to, subject, message: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = { sendEmail };
