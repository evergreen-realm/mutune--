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
const crypto = require('crypto');
const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const { postJournalEntry } = require('../services/financials');
const logger = require('../utils/logger');

/**
 * @openapi
 * /payments/initiate-stk:
 *   post:
 *     summary: Initiate M-Pesa STK Push
 *     description: Triggers an M-Pesa STK Push prompt to tenant's mobile phone for rent, deposit, or utility payment.
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenant_id
 *               - unit_id
 *               - amount
 *             properties:
 *               tenant_id:
 *                 type: string
 *               unit_id:
 *                 type: string
 *               amount:
 *                 type: number
 *                 example: 35000
 *               payment_type:
 *                 type: string
 *                 enum: [rent, deposit, penalty, water, electricity, service_charge]
 *                 default: rent
 *     responses:
 *       200:
 *         description: STK push initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 checkoutRequestId:
 *                   type: string
 */
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
      const transactionId = `MUT-${crypto.randomUUID()}`;
      const stk = await mpesaService.initiateSTKPush({
        phone: tenant.phone,
        amount,
        accountReference: `TNT-${tenant._id.toString().slice(-6).toUpperCase()}-${property.property_code}`,
        transactionDesc: `${payment_type} for ${property.name}`
      });
      const payment = await Payment.create({
        transaction_id: stk.checkoutRequestId || transactionId,
        tenant_id,
        property_id: property._id,
        unit_id,
        amount_kes: amount,
        amount_cents: Math.round(amount * 100),
        payment_type,
        channel: 'mpesa_stk',
        status: 'pending',
        workflow_state: 'PENDING_VIEWING'
      });
      logger.info('STK Push sent', { checkoutRequestId: stk.checkoutRequestId, tenantId: tenant_id });
      res.json({ success: true, checkout_request_id: stk.checkoutRequestId, status: 'pending', message: stk.customerMessage || 'STK Push sent to tenant phone' });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/auto-initiate',
  requireAuth,
  requirePermission('pay:rent'),
  async (req, res, next) => {
    try {
      const tenant = await Tenant.findOne({ user_id: req.user._id }).lean();
      if (!tenant) {
        return res.status(404).json({ success: false, error: { code: 'TENANT_NOT_FOUND', message: 'No tenant profile found for this user' } });
      }

      if (!tenant.current_property_id || !tenant.current_unit_id) {
        return res.status(400).json({ success: false, error: { code: 'UNIT_NOT_ASSIGNED', message: 'No unit currently assigned to this tenant' } });
      }

      const outstanding = (tenant.rent_amount_kes || 0) + (tenant.arrears_kes || 0);
      if (outstanding <= 0) {
        return res.status(400).json({ success: false, error: { code: 'NO_OUTSTANDING_BALANCE', message: 'You have no outstanding rent or arrears to pay' } });
      }

      const property = await Property.findById(tenant.current_property_id).lean();
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found' } });
      }

      const transactionId = `MUT-${crypto.randomUUID()}`;
      const stk = await mpesaService.initiateSTKPush({
        phone: tenant.phone,
        amount: outstanding,
        accountReference: `${property.property_code}-${tenant.current_unit_id}`,
        transactionDesc: `Rent Payment for ${property.name}`
      });

      const payment = await Payment.create({
        transaction_id: stk.checkoutRequestId || transactionId,
        tenant_id: tenant._id,
        property_id: property._id,
        unit_id: tenant.current_unit_id,
        amount_kes: outstanding,
        amount_cents: Math.round(outstanding * 100),
        payment_type: 'rent',
        channel: 'mpesa_stk',
        status: 'pending',
        workflow_state: 'PENDING_VIEWING'
      });

      const Notification = require('../models/Notification');
      if (Notification) {
        await Notification.create({
          type: 'general',
          recipient_role: 'tenant',
          recipient_ids: [req.user._id],
          title: 'Rent Payment Initiated',
          message: `An M-Pesa STK push for KES ${outstanding} has been sent to your phone.`,
          related_entity_id: payment._id
        });
      }

      try {
        await smsService.send(tenant.phone, `MutuneRent Pro: An M-Pesa STK Push of KES ${outstanding} has been initiated to your phone for unit ${tenant.current_unit_id}. Please enter your M-Pesa PIN.`);
      } catch (smsErr) {
        logger.warn('Failed to send SMS on auto-initiate', { message: smsErr.message });
      }

      logger.info('Auto-initiated STK push', { tenantId: tenant._id, amount: outstanding, checkoutRequestId: stk.checkoutRequestId });
      res.json({
        success: true,
        checkout_request_id: stk.checkoutRequestId,
        amount: outstanding,
        status: 'pending',
        message: stk.customerMessage || 'STK Push sent to your phone'
      });
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

  let session = null;
  let useTransaction = false;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    useTransaction = true;
  } catch (e) {
    session = null;
    useTransaction = false;
  }

  const executeCallback = async (opts = {}) => {
    const sessionOpt = opts.session ? { session: opts.session } : {};
    const payment = await Payment.findOne({ transaction_id: checkoutRequestId }, null, sessionOpt);
    if (!payment) {
      logger.error('Payment not found for callback', { checkoutRequestId });
      return;
    }

    if (payment.status === 'confirmed' || payment.status === 'failed') {
      logger.info('Callback ignored — payment already finalized', { checkoutRequestId, status: payment.status });
      return;
    }

    if (resultCode !== 0) {
      payment.status = 'failed';
      payment.workflow_state = 'MANUAL_REVIEW';
      payment.discrepancy_flag = true;
      payment.discrepancy_reason = `STK Failed: ${resultDesc}`;
      payment.mpesa_callback = { ResultCode: resultCode, ResultDesc: resultDesc, received_at: new Date() };
      await payment.save(sessionOpt);
      return;
    }

    const items = stk.CallbackMetadata?.Item || [];
    const amount = items.find(i => i.Name === 'Amount')?.Value;
    const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;

    if (receipt) {
      const existingReceipt = await Payment.findOne({ mpesa_receipt: receipt }, null, sessionOpt);
      if (existingReceipt && existingReceipt._id.toString() !== payment._id.toString()) {
        logger.warn('Duplicate M-Pesa receipt detected', { receipt, existingPaymentId: existingReceipt._id });
        payment.status = 'failed';
        payment.discrepancy_flag = true;
        payment.discrepancy_reason = `Duplicate M-Pesa receipt: ${receipt}`;
        await payment.save(sessionOpt);
        return;
      }
    }

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
    await payment.save(sessionOpt);

    await Property.updateOne(
      { 'units._id': payment.unit_id },
      { $set: { 'units.$.lock_status': payment.workflow_state === 'PAYMENT_CONFIRMED' ? 'payment_confirmed' : 'pending_viewing' } },
      sessionOpt
    );

    const deduction = payment.amount_kes;
    const deductionCents = Math.round(deduction * 100);
    const month = new Date().toISOString().slice(0, 7);

    const tenantDoc = await Tenant.findById(payment.tenant_id).session(sessionOpt.session || null);
    if (tenantDoc) {
      tenantDoc.arrears_kes = Math.max(0, (tenantDoc.arrears_kes || 0) - deduction);
      tenantDoc.payment_history.push({
        month,
        amount_kes: payment.amount_kes,
        amount_cents: deductionCents,
        status: 'paid',
        payment_id: payment._id
      });
      tenantDoc.updated_at = new Date();
      await tenantDoc.save(sessionOpt);
    }

    logger.info('Payment auto-confirmed', { paymentId: payment._id, receipt, amount, atomic: true });

    try {
      const tenant = await Tenant.findById(payment.tenant_id).lean();
      if (tenant) await smsService.send(tenant.phone, `Payment received! KES ${payment.amount_kes}. Receipt: ${receipt}. Unit reserved.`);
    } catch (e) { logger.warn('SMS notification failed', { message: e.message }); }
  };

  if (useTransaction && session) {
    try {
      await executeCallback({ session });
      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();
      if (err.message && err.message.includes('replica set member')) {
        await executeCallback({});
      } else {
        logger.error('STK Callback execution error', { error: err.message });
      }
    }
  } else {
    try {
      await executeCallback({});
    } catch (err) {
      logger.error('STK Callback execution error', { error: err.message });
    }
  }
}

async function handleC2BCallback(data) {
  const receipt = data.TransID || data.TransactionID;
  const existing = await Payment.findOne({ mpesa_receipt: receipt });
  if (existing) return;
  await Payment.create({
    transaction_id: `C2B-${Date.now()}`,
    mpesa_receipt: receipt,
    amount_kes: data.TransAmount || data.Amount,
    payment_type: 'rent',
    status: 'confirmed',
    workflow_state: 'MANUAL_REVIEW',
    channel: 'mpesa_c2b',
    discrepancy_flag: true,
    discrepancy_reason: 'Auto-matching failed: no pending payment found',
    tenant_id: null,
    property_id: null
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
        const tenant = await Tenant.findOne({ user_id: req.user._id }).select('_id').lean();
        filter.tenant_id = tenant ? tenant._id : new (require('mongoose')).Types.ObjectId();
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
    const { reason, new_status = 'confirmed' } = req.body;
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

    if (new_status === 'confirmed') {
      await Property.updateOne(
        { 'units._id': payment.unit_id },
        { $set: { 'units.$.lock_status': 'payment_confirmed' } }
      );
      
      const tenantDoc = await Tenant.findById(payment.tenant_id);
      if (tenantDoc) {
        let remainingPayment = payment.amount_kes;
        if (tenantDoc.arrears_kes > 0) {
          const deduction = Math.min(tenantDoc.arrears_kes, remainingPayment);
          tenantDoc.arrears_kes = Math.max(0, tenantDoc.arrears_kes - deduction);
          remainingPayment -= deduction;
        }
        const month = new Date().toISOString().slice(0, 7);
        tenantDoc.payment_history.push({
          month,
          amount_kes: payment.amount_kes,
          status: 'paid',
          payment_id: payment._id
        });
        tenantDoc.updated_at = new Date();
        await tenantDoc.save();
      }

      try {
        const tenant = await Tenant.findById(payment.tenant_id).lean();
        if (tenant) {
          await smsService.send(tenant.phone, `Payment manual override confirmed! KES ${payment.amount_kes}. Receipt updated.`);
        }
      } catch (smsErr) {
        logger.warn('SMS notification failed on manual override', { message: smsErr.message });
      }
    }

    logger.info('Payment manually overridden', { paymentId: id, by: req.user.email, newStatus: new_status });
    res.json({ success: true, payment });
  } catch (error) { next(error); }
});

router.post('/:id/void', requireAuth, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Reason for voiding is required' } });
    }
    const payment = await Payment.findById(id);
    if (!payment) throw Object.assign(new Error('Payment not found'), { status: 404, code: 'PAYMENT_NOT_FOUND' });

    if (payment.status === 'failed' || payment.status === 'reversed') {
      return res.status(400).json({ success: false, error: { code: 'ALREADY_VOIDED', message: 'Payment is already void or failed' } });
    }

    const previousStatus = payment.status;
    payment.status = 'failed';
    payment.workflow_state = 'MANUAL_REVIEW';
    payment.discrepancy_flag = true;
    payment.discrepancy_reason = `Voided by admin (${req.user.email}). Reason: ${reason}`;
    await payment.save();

    if (previousStatus === 'confirmed') {
      const tenantDoc = await Tenant.findById(payment.tenant_id);
      if (tenantDoc) {
        tenantDoc.arrears_kes += payment.amount_kes;
        tenantDoc.payment_history = tenantDoc.payment_history.filter(h => h.payment_id?.toString() !== payment._id.toString());
        tenantDoc.updated_at = new Date();
        await tenantDoc.save();
      }
      await Property.updateOne(
        { 'units._id': payment.unit_id },
        { $set: { 'units.$.lock_status': 'pending_viewing' } }
      );
    }

    logger.info('Payment voided', { paymentId: id, by: req.user.email, reason });
    res.json({ success: true, message: 'Payment voided successfully', data: payment });
  } catch (error) { next(error); }
});

// ─── GET /api/v1/payments/unmatched — List unmatched payment queue ───────────
router.get('/unmatched', requireAuth, requireRole(['admin', 'super_admin', 'agent']), async (req, res, next) => {
  try {
    const unmatched = await Payment.find({
      $or: [
        { status: 'pending' },
        { status: 'discrepancy' },
        { tenant_id: { $exists: false } },
        { tenant_id: null }
      ]
    })
      .sort({ created_at: -1 })
      .lean();

    res.json({ success: true, data: unmatched, count: unmatched.length });
  } catch (error) { next(error); }
});

// ─── POST /api/v1/payments/unmatched/:id/assign — Manually assign unmatched payment ─
router.post('/unmatched/:id/assign',
  requireAuth,
  requireRole(['admin', 'super_admin', 'agent']),
  [
    body('tenant_id').isMongoId().withMessage('Valid tenant_id is required')
  ],
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { tenant_id } = req.body;

      const payment = await Payment.findById(id);
      if (!payment) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } });
      }

      const tenant = await Tenant.findById(tenant_id);
      if (!tenant) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
      }

      payment.tenant_id = tenant._id;
      payment.property_id = tenant.current_property_id;
      payment.unit_id = tenant.current_unit_id;
      payment.status = 'completed';
      payment.discrepancy_flag = false;
      payment.notes = `${payment.notes || ''}\n[RECONCILED] Manually assigned to ${tenant.full_name} (${tenant.tenant_code}) by ${req.user.email}`.trim();
      await payment.save();

      // Deduct tenant arrears
      tenant.arrears_kes = Math.max(0, (tenant.arrears_kes || 0) - payment.amount_kes);
      await tenant.save();

      logger.info('Unmatched payment manually assigned', { paymentId: id, tenantId: tenant._id, by: req.user._id });
      res.json({ success: true, message: 'Payment successfully matched to tenant', data: payment });
    } catch (error) { next(error); }
  }
);

// ─── POST /api/v1/payments/mpesa/query-status — Query M-Pesa Transaction Status ─
router.post('/mpesa/query-status',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    body('transaction_id').notEmpty().withMessage('Transaction ID is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }

      const { transaction_id } = req.body;
      const statusRes = await mpesaService.queryTransactionStatus(transaction_id);

      await AuditLog.create({
        action: 'MPESA_TRANSACTION_STATUS_QUERY',
        resource: `Payment:${transaction_id}`,
        user_id: req.user._id,
        details: { transaction_id, response: statusRes }
      });

      res.json({ success: true, data: statusRes });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/v1/payments/mpesa/reverse — Initiate M-Pesa Transaction Reversal ─
router.post('/mpesa/reverse',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    body('transaction_id').notEmpty().withMessage('Transaction ID is required'),
    body('amount').isNumeric().withMessage('Reversal amount required'),
    body('reason').optional().isString()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }

      const { transaction_id, amount, reason = 'Disputed rent reversal' } = req.body;
      const payment = await Payment.findOne({
        $or: [
          { transaction_id },
          { mpesa_receipt: transaction_id }
        ]
      });

      const reversalRes = await mpesaService.reverseTransaction({
        transactionId: payment?.mpesa_receipt || transaction_id,
        amount,
        reason
      });

      if (payment) {
        payment.status = 'reversed';
        payment.workflow_state = 'MANUAL_REVIEW';
        payment.notes = `${payment.notes || ''}\n[REVERSED] Reversed by ${req.user.email} on ${new Date().toISOString()}: ${reason}`.trim();
        await payment.save();

        // Post Reversing Double-Entry Journal Entry
        try {
          await postJournalEntry({
            reference_type: 'manual_adjustment',
            reference_id: payment._id,
            property_id: payment.property_id,
            line_items: [
              { account_code: '1100', debit_kes: Number(amount), credit_kes: 0, description: `Rent Receivable Restored (Reversal: ${transaction_id})` },
              { account_code: '1010', debit_kes: 0, credit_kes: Number(amount), description: `M-Pesa Operating Account (Reversed: ${transaction_id})` }
            ],
            posted_by_user_id: req.user._id,
            notes: `M-Pesa Transaction Reversal: ${reason}`
          });
        } catch (glErr) {
          logger.error('Failed to post GL reversal entry', { error: glErr.message });
        }
      }

      await AuditLog.create({
        action: 'MPESA_TRANSACTION_REVERSED',
        resource: `Payment:${transaction_id}`,
        user_id: req.user._id,
        details: { transaction_id, amount, reason, response: reversalRes }
      });

      logger.info('M-Pesa reversal requested', { transaction_id, amount, by: req.user._id });
      res.json({ success: true, message: 'Reversal request submitted to Safaricom', data: reversalRes });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /api/v1/payments/mpesa/balance — Query M-Pesa Organization Working Float ──
router.get('/mpesa/balance',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    try {
      const balance = await mpesaService.queryAccountBalance();
      res.json({ success: true, data: balance });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/v1/payments/mpesa/register-urls — Register C2B URLs with Safaricom ─
/**
 * @openapi
 * /payments/mpesa/register-urls:
 *   post:
 *     summary: Register M-Pesa C2B confirmation and validation URLs with Safaricom
 *     description: Registers C2B Callback URLs with Safaricom Daraja gateway for automated payment notifications.
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: C2B URLs registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 */
router.post('/mpesa/register-urls',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    try {
      const result = await mpesaService.registerC2BUrls();
      res.json({ success: true, message: 'C2B URLs registered with Safaricom', data: result });
    } catch (error) {
      next(error);
    }
  }
);

// Callback listeners for M-Pesa Async Endpoints
router.post('/status/result', (req, res) => { logger.info('Status Result Callback', req.body); res.json({ ResultCode: 0 }); });
router.post('/status/timeout', (req, res) => { logger.warn('Status Timeout Callback', req.body); res.json({ ResultCode: 0 }); });
router.post('/reversal/result', (req, res) => { logger.info('Reversal Result Callback', req.body); res.json({ ResultCode: 0 }); });
router.post('/reversal/timeout', (req, res) => { logger.warn('Reversal Timeout Callback', req.body); res.json({ ResultCode: 0 }); });
router.post('/balance/result', (req, res) => { logger.info('Balance Result Callback', req.body); res.json({ ResultCode: 0 }); });
router.post('/balance/timeout', (req, res) => { logger.warn('Balance Timeout Callback', req.body); res.json({ ResultCode: 0 }); });

module.exports = router;
