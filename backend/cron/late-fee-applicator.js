const cron = require('node-cron');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const Payment = require('../models/Payment');
const LateFeeRule = require('../models/LateFeeRule');
const Notification = require('../models/Notification');
const { sendEmail } = require('../services/email');
const smsService = require('../services/sms');
const logger = require('../utils/logger');

/**
 * Late fee penalty applicator cron job — runs daily at 00:10 AM EAT (UTC+3).
 * 
 * Rules:
 * 1. Checks all active rules by property type.
 * 2. Identifies tenants with no confirmed rent payment for the current month.
 * 3. Checks grace days and applies penalty (fixed or percentage).
 * 4. Checks idempotency (no duplicate penalty per tenant in the same month).
 * 5. Updates tenant arrears balance, logs a penalty Payment, and sends SMS/email/in-app notifications.
 */
const runLateFeeApplicator = async () => {
  // 21:10 UTC = 00:10 EAT
  logger.info('Late fee penalty applicator cron started');
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  try {
    const rules = await LateFeeRule.find({ is_active: true }).lean();
    if (rules.length === 0) {
      logger.info('No active late fee rules found, skipping applicator');
      return;
    }

    const tenants = await Tenant.find({
      tenancy_status: { $in: ['active', 'notice', 'expired'] }
    });

    const properties = await Property.find().lean();
    let processedCount = 0;
    let appliedCount = 0;

    for (const tenant of tenants) {
      if (!tenant.current_property_id) continue;

      const property = properties.find(p => p._id.toString() === tenant.current_property_id.toString());
      if (!property) continue;

      const propertyType = property.type;
      
      // Select best matching rule
      let matchedRule = rules.find(r => 
        (r.applies_to === 'residential' && ['apartment', 'single_family'].includes(propertyType)) ||
        (r.applies_to === 'commercial' && ['commercial', 'mixed_use'].includes(propertyType))
      );

      if (!matchedRule) {
        matchedRule = rules.find(r => r.applies_to === 'all');
      }

      if (!matchedRule) continue;

      processedCount++;

      // Check grace days
      const todayDay = now.getDate();
      if (todayDay <= matchedRule.grace_days) {
        continue;
      }

      // Check if tenant has paid rent for this month
      const rentPayment = await Payment.findOne({
        tenant_id: tenant._id,
        payment_type: 'rent',
        status: 'confirmed',
        created_at: { $gte: startOfMonth, $lte: endOfMonth }
      }).lean();

      if (rentPayment) {
        continue;
      }

      // Check if penalty has already been applied this month
      const existingPenalty = await Payment.findOne({
        tenant_id: tenant._id,
        payment_type: 'penalty',
        created_at: { $gte: startOfMonth, $lte: endOfMonth }
      }).lean();

      if (existingPenalty) {
        continue;
      }

      // Calculate penalty amount
      let penaltyAmount = 0;
      const rentAmount = tenant.rent_amount_kes || 0;
      if (matchedRule.penalty_type === 'percentage') {
        penaltyAmount = (matchedRule.penalty_value / 100) * rentAmount;
      } else if (matchedRule.penalty_type === 'fixed') {
        penaltyAmount = matchedRule.penalty_value;
      }

      if (matchedRule.max_penalty_per_month && penaltyAmount > matchedRule.max_penalty_per_month) {
        penaltyAmount = matchedRule.max_penalty_per_month;
      }

      if (penaltyAmount <= 0) continue;

      // Update tenant arrears
      tenant.arrears_kes = (tenant.arrears_kes || 0) + penaltyAmount;
      await tenant.save();

      // Create Payment invoice/record
      const transactionId = `PEN-${tenant.tenant_code}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const payment = await Payment.create({
        transaction_id: transactionId,
        tenant_id: tenant._id,
        property_id: property._id,
        unit_id: tenant.current_unit_id,
        amount_kes: penaltyAmount,
        payment_type: 'penalty',
        channel: 'cash',
        status: 'confirmed',
        workflow_state: 'MANUAL_REVIEW'
      });

      appliedCount++;

      // In-app Notification for the tenant
      if (tenant.user_id) {
        await Notification.create({
          type: 'payment_alert',
          recipient_role: 'tenant',
          recipient_ids: [tenant.user_id],
          title: 'Late Payment Penalty Applied',
          message: `A late payment fee of KES ${penaltyAmount.toLocaleString()} has been applied to your account for this month. Please pay outstanding rent to avoid further action.`,
          related_entity_id: payment._id
        });
      }

      // Send SMS
      if (tenant.phone) {
        try {
          await smsService.send(
            tenant.phone,
            `Hello ${tenant.full_name}, a late payment fee of KES ${penaltyAmount.toLocaleString()} has been added to your arrears for your unit at ${property.name}. Please settle your balance. - Mutune Estate Agency`
          );
        } catch (smsErr) {
          logger.warn('Failed to send penalty SMS notification', { tenantId: tenant._id, message: smsErr.message });
        }
      }

      // Send Email
      if (tenant.email) {
        try {
          const currentMonthName = now.toLocaleString('default', { month: 'long' });
          await sendEmail(
            tenant.email,
            'Late Payment Penalty Applied - MutuneRent Pro',
            `<h1>Late Payment Penalty</h1>
             <p>Dear ${tenant.full_name},</p>
             <p>This is to notify you that a late payment fee of <strong>KES ${penaltyAmount.toLocaleString()}</strong> has been applied to your account for the month of ${currentMonthName} ${now.getFullYear()}.</p>
             <p>Your current outstanding arrears are now KES ${tenant.arrears_kes.toLocaleString()}.</p>
             <p>Please pay your outstanding rent as soon as possible to avoid further penalties or lease termination.</p>
             <br/>
             <p>Regards,<br/>Mutune Estate Agency Management</p>`
          );
        } catch (emailErr) {
          logger.warn('Failed to send penalty Email notification', { tenantId: tenant._id, message: emailErr.message });
        }
      }
    }

    logger.info('Late fee penalty applicator cron completed', {
      totalProcessed: processedCount,
      penaltiesApplied: appliedCount
    });

  } catch (error) {
    logger.error('Late fee penalty applicator cron failed', { message: error.message, stack: error.stack });
  }
};

const lateFeeApplicator = cron.schedule('10 21 * * *', runLateFeeApplicator, {
  scheduled: false,
  timezone: 'Africa/Nairobi'
});

lateFeeApplicator.run = runLateFeeApplicator;

module.exports = lateFeeApplicator;
