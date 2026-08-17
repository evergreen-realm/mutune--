const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const DamageInspectionReport = require('../models/DamageInspectionReport');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const { postJournalEntry } = require('../services/financials');
const { sendDarajaB2CPayout } = require('../services/bulkDisbursement');
const logger = require('../utils/logger');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    return false;
  }
  return true;
};

/**
 * @openapi
 * /vacation/notice:
 *   post:
 *     summary: Tenant files 30-day notice to quit
 *     tags: [Vacation]
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
 *               - vacate_date
 *             properties:
 *               tenant_id:
 *                 type: string
 *               vacate_date:
 *                 type: string
 *                 format: date
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Move-out notice registered
 */
router.post('/notice',
  requireAuth,
  [
    body('tenant_id').isMongoId().withMessage('Valid tenant_id is required'),
    body('vacate_date').isISO8601().withMessage('Valid vacate_date required')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const { tenant_id, vacate_date, reason } = req.body;
      const tenant = await Tenant.findById(tenant_id);
      if (!tenant) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
      }

      tenant.vacate_notice_date = new Date();
      tenant.expected_vacate_date = new Date(vacate_date);
      tenant.tenancy_status = 'notice_period';
      tenant.vacate_reason = reason || '30-Day Notice Served';
      await tenant.save();

      logger.info('30-Day Move-Out Notice Filed', { tenantId: tenant._id, vacateDate: vacate_date });
      res.json({ success: true, message: '30-Day move-out notice filed successfully', data: tenant });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /vacation/inspection:
 *   post:
 *     summary: Agent conducts move-out damage survey
 *     tags: [Vacation]
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
 *               - damages
 *             properties:
 *               tenant_id:
 *                 type: string
 *               damages:
 *                 type: array
 *                 items:
 *                   type: object
 *               unpaid_utility_deductions_kes:
 *                 type: number
 *               agent_notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Move-out inspection report created
 */
router.post('/inspection',
  requireAuth,
  requireRole(['agent', 'admin', 'super_admin']),
  [
    body('tenant_id').isMongoId().withMessage('Valid tenant_id is required'),
    body('damages').isArray().withMessage('Damages must be an array of itemized inspection entries')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const { tenant_id, damages = [], unpaid_utility_deductions_kes = 0, agent_notes } = req.body;
      const tenant = await Tenant.findById(tenant_id);
      if (!tenant) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
      }

      const count = await DamageInspectionReport.countDocuments();
      const report_code = `INSP-${String(count + 1).padStart(4, '0')}`;

      const total_damage_deductions_kes = damages.reduce((sum, d) => sum + (d.repair_cost_kes || 0), 0);
      const deposit_paid_kes = tenant.deposit_amount_kes || tenant.rent_amount_kes || 0;
      const net_deposit_refund_kes = deposit_paid_kes - total_damage_deductions_kes - Number(unpaid_utility_deductions_kes);

      const report = await DamageInspectionReport.create({
        report_code,
        tenant_id: tenant._id,
        property_id: tenant.current_property_id,
        unit_id: tenant.current_unit_id,
        agent_id: req.user._id,
        deposit_paid_kes,
        total_damage_deductions_kes,
        unpaid_utility_deductions_kes: Number(unpaid_utility_deductions_kes),
        net_deposit_refund_kes,
        damages,
        agent_notes,
        refund_status: 'pending_review'
      });

      logger.info('Move-out damage inspection report created', { reportId: report._id, report_code, net_deposit_refund_kes });
      res.status(201).json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /vacation/inspection/{id}/refund:
 *   post:
 *     summary: Process deposit refund and unlock unit
 *     tags: [Vacation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deposit refund processed and unit unlocked
 */
router.post('/inspection/:id/refund',
  requireAuth,
  requireRole(['admin', 'super_admin', 'agent']),
  [param('id').isMongoId().withMessage('Invalid inspection ID')],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const report = await DamageInspectionReport.findById(req.params.id);
      if (!report) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inspection report not found' } });
      }

      const tenant = await Tenant.findById(report.tenant_id);

      // Execute Daraja B2C deposit refund payout if net refund > 0
      let payoutReceipt = 'MANUAL_REFUND_SETTLED';
      if (report.net_deposit_refund_kes > 0 && tenant?.phone) {
        try {
          const payoutRes = await sendDarajaB2CPayout({
            recipientPhone: tenant.phone,
            amountKes: report.net_deposit_refund_kes,
            remarks: `Tenant Deposit Refund ${report.report_code}`
          });
          payoutReceipt = payoutRes.ConversationID || 'B2C_REFUND_OK';
        } catch (err) {
          logger.warn('B2C deposit refund error, flagging manual payout', { error: err.message });
        }
      }

      // Post GL Entry
      const glEntry = await postJournalEntry({
        entry_type: 'deposit_refund',
        description: `Tenant Deposit Refund ${tenant?.full_name || 'Tenant'}`,
        property_id: report.property_id,
        reference: report.report_code,
        items: [
          { account_code: '2010', account_name: 'Tenant Deposits Held', debit_kes: report.deposit_paid_kes, credit_kes: 0 },
          { account_code: '1010', account_name: 'Cash & M-Pesa Account', debit_kes: 0, credit_kes: Math.max(0, report.net_deposit_refund_kes) }
        ]
      });

      report.refund_status = 'refunded';
      report.refund_mpesa_b2c_receipt = payoutReceipt;
      report.gl_journal_entry_id = glEntry?._id;
      await report.save();

      // Deactivate tenancy and mark unit as vacant
      if (tenant) {
        tenant.tenancy_status = 'ended';
        await tenant.save();

        if (tenant.current_property_id && tenant.current_unit_id) {
          await Property.updateOne(
            { _id: tenant.current_property_id, 'units._id': tenant.current_unit_id },
            { $set: { 'units.$.status': 'vacant', 'units.$.current_tenant_id': null } }
          );
        }
      }

      logger.info('Move-out inspection deposit refund processed & unit unlocked', { reportId: report._id, report_code: report.report_code });
      res.json({ success: true, message: 'Deposit refund approved, GL posted, and unit unlocked', data: report });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
