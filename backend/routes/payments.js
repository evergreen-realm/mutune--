const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/rbac');
const { requireSafaricomIP } = require('../middleware/security');
const mpesaService = require('../services/mpesa');
const smsService = require('../services/sms');
const Payment = require('../models/Payment');
const Property = require('../models/Property');
const Tenant = require('../models/Tenant');
const { transition } = require('../utils/stateMachine');
const logger = require('../utils/logger');

router.post('/initiate-stk',
  requireAuth,
  requirePermission('pay:rent'),
  [
    body('tenant_id').isMongoId().withMessage('Invalid tenant ID'),
    body('unit_id').notEmpty().withMessage('Unit ID required'),
    body('amount').isInt({ min: 1 }).withMessage('Amount must be positive integer'),
    body('payment_type').optional().isIn(['rent', 'deposit', 'penalty', 'water', 'electricity', 'service_charge'])
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }
      const { tenant_id, unit_id, amount, payment_type = 'rent' } = req.body;
      const tenant = await Tenant.findById(tenant_id).lean();
      if (!tenant) throw Object.assign(new Error('Tenant not found'), { status: 404, code: 'TENANT_NOT_FOUND' });
      const property = await Property.findOne({ 'units._id': unit_id }).lean();
      if (!property) throw Object.assign(new Error('Unit not found'), { status: 404, code: 'UNIT_NOT_FOUND' });
      const transactionId = `MUT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
      const payment = await Payment.create({
        transaction_id: transactionId,
        tenant_id,
        property_id: property._id,
        unit_id,
        amount_kes: amount,
        payment_type,
        channel: 'mpesa_stk',
        status: 'pending',
        workflow_state: 'PENDING_VIEWING'
      });
      const stk = await mpesaService.initiateSTKPush({
        phone: tenant.phone,
        amount,
        accountReference: `${property.property_code}-${unit_id}`,
        transactionDesc: `${payment_type} for ${property.name}`
      });
      payment.transaction_id = stk.checkoutRequestId || transactionId;
      await payment.save();
      logger.info('STK Push sent', { checkoutRequestId: stk.checkoutRequestId, tenantId: tenant_id });
      res.json({ success: true, checkout_request_id: stk.checkoutRequestId, status: 'pending', message: stk.customerMessage || 'STK Push sent to tenant phone' });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/callback/validate', async (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

router.post('/callback', requireSafaricomIP, async (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  try {
    const body = req.body;
    const stkCallback = body.Body?.stkCallback;
    if (stkCallback) {
      await handleSTKCallback(stkCallback);
    } else if (body.TransactionType || body.TransID) {
      await handleC2BCallback(body);
    } else {
      logger.warn('Unknown callback format', { body: JSON.stringify(body).slice(0, 200) });
    }
  } catch (error) {
    logger.error('Callback processing failed', { message: error.message, stack: error.stack });
  }
});

async function handleSTKCallback(stk) {
  const checkoutRequestId = stk.CheckoutRequestID;
  const resultCode = stk.ResultCode;
  const resultDesc = stk.ResultDesc;
  const payment = await Payment.findOne({ transaction_id: checkoutRequestId });
  if (!payment) {
    logger.error('Payment not found for callback', { checkoutRequestId });
    return;
  }
  if (resultCode !== 0) {
    payment.status = 'failed';
    payment.workflow_state = 'MANUAL_REVIEW';
    payment.discrepancy_flag = true;
    payment.discrepancy_reason = `STK Failed: ${resultDesc}`;
    payment.mpesa_callback = { ResultCode: resultCode, ResultDesc: resultDesc, received_at: new Date() };
    await payment.save();
    return;
  }
  const items = stk.CallbackMetadata?.Item || [];
  const amount = items.find(i => i.Name === 'Amount')?.Value;
  const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
  payment.status = 'confirmed';
  payment.mpesa_receipt = receipt;
  payment.mpesa_callback = { ResultCode: resultCode, ResultDesc: resultDesc, CallbackMetadata: stk.CallbackMetadata, received_at: new Date() };
  const amountDiff = amount ? Math.abs(amount - payment.amount_kes) : Infinity;
  if (amountDiff <= 100) {
    payment.verification_method = 'auto_mpesa';
    payment.discrepancy_flag = false;
    transition(payment, 'PAYMENT_CONFIRMED');
  } else {
    payment.discrepancy_flag = true;
    payment.discrepancy_reason = `Amount mismatch: expected ${payment.amount_kes}, got ${amount}`;
    payment.workflow_state = 'MANUAL_REVIEW';
  }
  await payment.save();
  await Property.updateOne({ 'units._id': payment.unit_id }, { $set: { 'units.$.lock_status': payment.workflow_state === 'PAYMENT_CONFIRMED' ? 'PAYMENT_CONFIRMED' : 'pending_viewing' } });
  const month = new Date().toISOString().slice(0, 7);
  await Tenant.updateOne(
    { _id: payment.tenant_id },
    { $push: { payment_history: { month, amount_kes: payment.amount_kes, status: 'paid', payment_id: payment._id } }, $set: { updated_at: new Date() } }
  );
  logger.info('Payment auto-confirmed', { paymentId: payment._id, receipt, amount });
  try {
    const tenant = await Tenant.findById(payment.tenant_id).lean();
    if (tenant) await smsService.send(tenant.phone, `Payment received! KES ${payment.amount_kes}. Receipt: ${receipt}. Unit reserved.`);
  } catch (e) { logger.warn('SMS notification failed', { message: e.message }); }
}

async function handleC2BCallback(data) {
  const receipt = data.TransID || data.TransactionID;
  const existing = await Payment.findOne({ mpesa_receipt: receipt });
  if (existing) return;
  await Payment.create({
    transaction_id: `C2B-${Date.now()}`,
    mpesa_receipt: receipt,
    amount_kes: data.TransAmount || data.Amount,
    status: 'confirmed',
    workflow_state: 'MANUAL_REVIEW',
    channel: 'mpesa_c2b',
    discrepancy_flag: true,
    discrepancy_reason: 'Auto-matching failed: no pending payment found',
    tenant_id: null,
    property_id: null,
    unit_id: 'unknown'
  });
  logger.info('Unmatched C2B payment recorded', { receipt, amount: data.TransAmount });
}

// ─── GET /payments ────────────────────────────────────────────────────────────
router.get('/',
  requireAuth,
  requirePermission('view:payments'),
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20, status, search, property_id } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      const filter = {};

      // Role-based scoping
      if (req.user.role === 'agent') {
        filter.property_id = { $in: req.user.assigned_property_ids || [] };
      } else if (req.user.role === 'landlord') {
        const ownedProps = await Property.find({ landlord_id: req.user._id }).select('_id').lean();
        filter.property_id = { $in: ownedProps.map(p => p._id) };
      } else if (req.user.role === 'tenant') {
        filter.tenant_id = req.user._id;
      }

      if (status) filter.status = status;
      if (property_id) {
        // Double check agent/landlord scope matches the requested property_id
        if (req.user.role === 'agent') {
          const isAssigned = (req.user.assigned_property_ids || []).some(id => id.toString() === property_id);
          if (!isAssigned) {
            return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Property not assigned' } });
          }
        } else if (req.user.role === 'landlord') {
          const isOwned = await Property.exists({ _id: property_id, landlord_id: req.user._id });
          if (!isOwned) {
            return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Property not owned' } });
          }
        }
        filter.property_id = property_id;
      }

      if (search) {
        const matchingTenants = await Tenant.find({
          $or: [
            { full_name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
            { tenant_code: { $regex: search, $options: 'i' } }
          ]
        }).select('_id').lean();
        const tenantIds = matchingTenants.map(t => t._id);

        filter.$or = [
          { mpesa_receipt: { $regex: search, $options: 'i' } },
          { transaction_id: { $regex: search, $options: 'i' } },
          { tenant_id: { $in: tenantIds } }
        ];
      }

      const [payments, total] = await Promise.all([
        Payment.find(filter)
          .populate('tenant_id', 'full_name phone tenant_code')
          .populate('property_id', 'name property_code address')
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        Payment.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: payments,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/test-sms', requireAuth, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const { phone, message } = req.body;
    const result = await smsService.send(phone, message);
    res.json({ success: result.success, result });
  } catch (error) { next(error); }
});

router.post('/:id/override', requireAuth, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, new_status } = req.body;
    const payment = await Payment.findById(id);
    if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404, code: 'PAYMENT_NOT_FOUND' });
    if (payment.amount_kes > 100000 && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Requires super_admin for payments > KES 100,000' } });
    }
    payment.status = new_status;
    payment.workflow_state = new_status === 'confirmed' ? 'PAYMENT_CONFIRMED' : 'MANUAL_REVIEW';
    payment.discrepancy_flag = true;
    payment.discrepancy_reason = `Manual override by ${req.user.email}: ${reason}`;
    payment.verified_by_agent_id = req.user._id;
    payment.verification_method = 'manual_override';
    await payment.save();
    logger.info('Payment manually overridden', { paymentId: id, by: req.user.email, newStatus: new_status });
    res.json({ success: true, payment });
  } catch (error) { next(error); }
});

module.exports = router;
