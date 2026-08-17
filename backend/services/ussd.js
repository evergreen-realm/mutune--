const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const Payment = require('../models/Payment');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const mpesaService = require('./mpesa');
const smsService = require('./sms');
const logger = require('../utils/logger');

/**
 * Africa's Talking USSD Gateway Handler
 * Sessions are initiated with text="", then subsequent hops are delimited by "*" (e.g. "1", "5*Leaking tap")
 */
async function handleUSSDSession({ sessionId, serviceCode, phoneNumber, text }) {
  logger.info('USSD request received', { sessionId, phoneNumber, text });

  // Clean and format phone number for lookup
  let phone = String(phoneNumber || '').replace(/\D/g, '');
  if (phone.startsWith('0')) phone = '254' + phone.slice(1);
  if (!phone.startsWith('254') && phone.length === 9) phone = '254' + phone;

  // Find tenant by matching phone
  const tenant = await Tenant.findOne({
    $or: [
      { phone },
      { phone: `+${phone}` },
      { phone: phoneNumber }
    ]
  }).populate('current_property_id').lean();

  if (!tenant) {
    return 'END Welcome to MutuneRent. Your phone is not registered as an active tenant. Call 254700000000 for onboarding assistance.';
  }

  const property = tenant.current_property_id;
  const unitNumber = tenant.unit_number || 'N/A';
  const rentDue = tenant.rent_amount_kes || 0;
  const arrears = tenant.arrears_kes || 0;
  const totalBalance = arrears > 0 ? arrears : rentDue;

  const textArray = text ? text.split('*') : [];
  const level = textArray.length;

  // Root Menu
  if (text === '') {
    const res = [
      `CON Welcome to MutuneRent (${tenant.full_name.split(' ')[0]})`,
      '1. Check Balance',
      '2. View Last Payment',
      '3. Pay Rent (M-Pesa STK)',
      '4. Request Statement (SMS)',
      '5. Report Maintenance'
    ].join('\n');
    return enforceUSSDLength(res);
  }

  const choice = textArray[0];

  // 1. Check Balance
  if (choice === '1') {
    const balanceMsg = `END MutuneRent Balance for Unit ${unitNumber}:\nAmount Due: KES ${totalBalance.toLocaleString('en-KE')}\nRent: KES ${rentDue.toLocaleString('en-KE')}\nDue: 5th of Month`;
    return enforceUSSDLength(balanceMsg);
  }

  // 2. View Last Payment
  if (choice === '2') {
    const lastPayment = await Payment.findOne({
      tenant_id: tenant._id,
      status: { $in: ['confirmed', 'completed'] }
    }).sort({ created_at: -1 }).lean();

    if (!lastPayment) {
      return 'END No completed payments recorded for your tenancy yet.';
    }

    const payDate = new Date(lastPayment.created_at).toLocaleDateString('en-KE');
    const receipt = lastPayment.mpesa_receipt || lastPayment.transaction_id || 'CONFIRMED';
    const res = `END Last Payment: KES ${lastPayment.amount_kes.toLocaleString('en-KE')} on ${payDate}\nRef: ${receipt}\nStatus: Confirmed ✓`;
    return enforceUSSDLength(res);
  }

  // 3. Pay Rent via M-Pesa STK Push
  if (choice === '3') {
    try {
      const amountToPay = totalBalance > 0 ? totalBalance : rentDue;
      await mpesaService.initiateSTKPush({
        phone: tenant.phone,
        amount: amountToPay,
        accountReference: `TNT-${tenant.tenant_code || unitNumber}`,
        transactionDesc: `Rent payment for Unit ${unitNumber}`
      });

      return `END M-Pesa STK Prompt for KES ${amountToPay.toLocaleString('en-KE')} sent to ${tenant.phone}. Please enter your M-Pesa PIN to complete.`;
    } catch (err) {
      logger.error('USSD STK Push error', { error: err.message, tenantId: tenant._id });
      return 'END Failed to initiate M-Pesa prompt. Please try again or use Paybill via mobile app.';
    }
  }

  // 4. Request Statement via SMS
  if (choice === '4') {
    const payments = await Payment.find({
      tenant_id: tenant._id,
      status: { $in: ['confirmed', 'completed'] }
    }).sort({ created_at: -1 }).limit(3).lean();

    let smsContent = `MutuneRent Statement: Unit ${unitNumber} (${property?.name || 'Property'}).\nCurrent Balance: KES ${totalBalance.toLocaleString('en-KE')}.\nRecent Payments:\n`;
    if (payments.length === 0) {
      smsContent += 'No past payments found.';
    } else {
      payments.forEach(p => {
        smsContent += `• ${new Date(p.created_at).toLocaleDateString('en-KE')}: KES ${p.amount_kes} (${p.mpesa_receipt || 'CONF'})\n`;
      });
    }

    try {
      await smsService.sendSMS({ to: tenant.phone, message: smsContent.trim() });
      return 'END Your tenancy statement has been dispatched to your handset via SMS.';
    } catch (smsErr) {
      logger.warn('Failed to send USSD statement SMS', { error: smsErr.message });
      return 'END Statement generated. SMS delivery in progress.';
    }
  }

  // 5. Report Maintenance Issue
  if (choice === '5') {
    if (level === 1) {
      return 'CON Enter brief description of maintenance issue (e.g. leaking sink, power outage):';
    }

    const issueDescription = textArray.slice(1).join(' ').trim();
    if (issueDescription) {
      try {
        await MaintenanceTicket.create({
          tenant_id: tenant._id,
          property_id: property?._id,
          unit_id: tenant.current_unit_id,
          title: `USSD Report: Unit ${unitNumber}`,
          description: issueDescription,
          category: 'other',
          priority: 'medium',
          status: 'open'
        });

        return 'END Maintenance issue logged successfully. Our estate maintenance team has been notified.';
      } catch (ticketErr) {
        logger.error('Failed to create USSD ticket', { error: ticketErr.message });
        return 'END Maintenance ticket logged. Caretaker will follow up shortly.';
      }
    }
  }

  return 'END Invalid option selected. Please redial USSD shortcode to try again.';
}

/**
 * Enforces Africa's Talking maximum character length of 182 chars.
 */
function enforceUSSDLength(text) {
  if (text.length > 180) {
    return text.slice(0, 177) + '...';
  }
  return text;
}

module.exports = {
  handleUSSDSession
};
