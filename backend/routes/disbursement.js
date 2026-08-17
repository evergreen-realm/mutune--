const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const CommissionConfig = require('../models/CommissionConfig');
const AgentSalary = require('../models/AgentSalary');
const { executePriorityBulkDisbursement, getPendingDisbursementMetrics } = require('../services/bulkDisbursement');
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
 * /disbursement/priority:
 *   get:
 *     summary: Get current priority queue & pending amounts
 *     tags: [Disbursement]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Priority order and pending amount totals
 */
router.get('/priority',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    try {
      const config = await CommissionConfig.findOne({ config_name: 'GLOBAL_FINANCIAL_CONFIG' }).lean();
      const priorityOrder = config?.disbursement_priority || ['landlords', 'agents', 'suppliers', 'staff', 'tenants'];

      const metrics = await getPendingDisbursementMetrics();

      let totalPendingKes = 0;
      const queueSummary = priorityOrder.map((cat, idx) => {
        const catMetric = metrics[cat] || { count: 0, amount_kes: 0 };
        totalPendingKes += catMetric.amount_kes;
        return {
          priority_rank: idx + 1,
          category: cat,
          pending_count: catMetric.count,
          pending_amount_kes: catMetric.amount_kes,
          status: 'ready'
        };
      });

      res.json({
        success: true,
        data: {
          priority_order: priorityOrder,
          queue_summary: queueSummary,
          total_pending_kes: totalPendingKes
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /disbursement/priority:
 *   put:
 *     summary: Update disbursement priority order
 *     tags: [Disbursement]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - disbursement_priority
 *             properties:
 *               disbursement_priority:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Priority order updated successfully
 */
router.put('/priority',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    body('disbursement_priority').isArray().withMessage('disbursement_priority must be an array of categories')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const { disbursement_priority } = req.body;
      const config = await CommissionConfig.findOneAndUpdate(
        { config_name: 'GLOBAL_FINANCIAL_CONFIG' },
        { $set: { disbursement_priority, updated_by_user_id: req.user._id } },
        { new: true, upsert: true }
      );

      logger.info('Disbursement priority updated', { userId: req.user._id, priority: disbursement_priority });
      res.json({ success: true, message: 'Priority order updated successfully', data: config.disbursement_priority });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /disbursement/execute:
 *   post:
 *     summary: Execute priority bulk disbursement
 *     tags: [Disbursement]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payout execution summary
 */
router.post('/execute',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    try {
      const result = await executePriorityBulkDisbursement(req.user._id);
      res.json({ success: true, message: 'Priority bulk disbursement completed', data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /disbursement/b2c/result:
 *   post:
 *     summary: Daraja B2C payout result callback webhook
 *     tags: [Disbursement]
 *     responses:
 *       200:
 *         description: Callback acknowledged
 */
router.post('/b2c/result', async (req, res) => {
  logger.info('Daraja B2C Result Webhook received', { body: req.body });
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

/**
 * @openapi
 * /disbursement/b2c/queue-timeout:
 *   post:
 *     summary: Daraja B2C queue timeout callback webhook
 *     tags: [Disbursement]
 *     responses:
 *       200:
 *         description: Callback acknowledged
 */
router.post('/b2c/queue-timeout', async (req, res) => {
  logger.warn('Daraja B2C Queue Timeout Webhook received', { body: req.body });
  res.json({ ResultCode: 0, ResultDesc: 'Timeout acknowledged' });
});

module.exports = router;
