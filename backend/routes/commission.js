const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const User = require('../models/User');
const AgentSalary = require('../models/AgentSalary');
const CommissionConfig = require('../models/CommissionConfig');
const { calculateAgentCommission, processAgentPayroll } = require('../services/agentCommission');
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
 * /commission/config:
 *   get:
 *     summary: Retrieve global commission and agent salary configuration
 *     tags: [Commission]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Commission and salary configuration
 */
router.get('/config',
  requireAuth,
  requireRole(['admin', 'super_admin', 'accountant']),
  async (req, res, next) => {
    try {
      let config = await CommissionConfig.findOne({ config_name: 'GLOBAL_FINANCIAL_CONFIG' }).lean();
      if (!config) {
        config = await CommissionConfig.create({
          config_name: 'GLOBAL_FINANCIAL_CONFIG',
          base_salary_kes: 0,
          letting_commission_percent: 100,
          management_commission_percent: 10,
          lease_renewal_commission_percent: 25,
          agent_initiation_fee_kes: 2500,
          withholding_tax_rate_resident: 5
        });
      }
      res.json({
        success: true,
        data: {
          ...config,
          letting_commission_rate: (config.letting_commission_percent ?? 100) / 100,
          management_commission_rate: (config.management_commission_percent ?? 10) / 100,
          withholding_tax_rate: (config.withholding_tax_rate_resident ?? 5) / 100,
          tenant_onboarding_initiation_fee_kes: config.agent_initiation_fee_kes ?? 2500
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /commission/config:
 *   put:
 *     summary: Update global commission and agent salary configuration
 *     tags: [Commission]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Updated commission configuration
 */
router.put('/config',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    body('base_salary_kes').optional().isFloat({ min: 0 }).withMessage('Base salary must be >= 0'),
    body('letting_commission_percent').optional().isFloat({ min: 0, max: 200 }).withMessage('Letting commission must be 0-200%'),
    body('letting_commission_rate').optional().isFloat({ min: 0, max: 200 }).withMessage('Letting commission must be 0-200%'),
    body('management_commission_percent').optional().isFloat({ min: 0, max: 100 }).withMessage('Management commission must be 0-100%'),
    body('management_commission_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Management commission must be 0-100%'),
    body('lease_renewal_commission_percent').optional().isFloat({ min: 0, max: 100 }).withMessage('Renewal commission must be 0-100%'),
    body('agent_initiation_fee_kes').optional().isFloat({ min: 0 }).withMessage('Initiation fee must be >= 0'),
    body('tenant_onboarding_initiation_fee_kes').optional().isFloat({ min: 0 }).withMessage('Initiation fee must be >= 0'),
    body('withholding_tax_rate_resident').optional().isFloat({ min: 0, max: 100 }).withMessage('Withholding tax must be 0-100%'),
    body('withholding_tax_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Withholding tax must be 0-100%')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const update = { updated_by_user_id: req.user._id, updated_at: new Date() };

      if (req.body.base_salary_kes !== undefined) {
        update.base_salary_kes = Number(req.body.base_salary_kes);
      }
      if (req.body.letting_commission_percent !== undefined) {
        update.letting_commission_percent = Number(req.body.letting_commission_percent);
      } else if (req.body.letting_commission_rate !== undefined) {
        const val = Number(req.body.letting_commission_rate);
        update.letting_commission_percent = val <= 1 && val > 0 ? val * 100 : val;
      }
      if (req.body.management_commission_percent !== undefined) {
        update.management_commission_percent = Number(req.body.management_commission_percent);
      } else if (req.body.management_commission_rate !== undefined) {
        const val = Number(req.body.management_commission_rate);
        update.management_commission_percent = val <= 1 && val > 0 ? val * 100 : val;
      }
      if (req.body.withholding_tax_rate_resident !== undefined) {
        update.withholding_tax_rate_resident = Number(req.body.withholding_tax_rate_resident);
      } else if (req.body.withholding_tax_rate !== undefined) {
        const val = Number(req.body.withholding_tax_rate);
        update.withholding_tax_rate_resident = val <= 1 && val > 0 ? val * 100 : val;
      }
      if (req.body.agent_initiation_fee_kes !== undefined) {
        update.agent_initiation_fee_kes = Number(req.body.agent_initiation_fee_kes);
      } else if (req.body.tenant_onboarding_initiation_fee_kes !== undefined) {
        update.agent_initiation_fee_kes = Number(req.body.tenant_onboarding_initiation_fee_kes);
      }
      if (req.body.lease_renewal_commission_percent !== undefined) {
        update.lease_renewal_commission_percent = Number(req.body.lease_renewal_commission_percent);
      }
      if (req.body.agent_payroll_day_of_month !== undefined) {
        update.agent_payroll_day_of_month = Number(req.body.agent_payroll_day_of_month);
      }

      const config = await CommissionConfig.findOneAndUpdate(
        { config_name: 'GLOBAL_FINANCIAL_CONFIG' },
        { $set: update },
        { new: true, upsert: true, runValidators: true }
      );

      logger.info('Commission configuration updated by admin', { userId: req.user._id, update });
      res.json({
        success: true,
        message: 'Commission settings updated successfully',
        data: {
          ...config.toObject(),
          letting_commission_rate: (config.letting_commission_percent ?? 100) / 100,
          management_commission_rate: (config.management_commission_percent ?? 10) / 100,
          withholding_tax_rate: (config.withholding_tax_rate_resident ?? 5) / 100,
          tenant_onboarding_initiation_fee_kes: config.agent_initiation_fee_kes ?? 2500
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /commission/agents/{id}/config:
 *   put:
 *     summary: Update individual agent salary and commission rates
 *     tags: [Commission]
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
 *         description: Updated agent rates
 */
router.put('/agents/:id/config',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('id').isMongoId().withMessage('Invalid agent ID'),
    body('base_salary_kes').optional().isFloat({ min: 0 }).withMessage('Base salary must be >= 0'),
    body('letting_commission_rate').optional().isFloat({ min: 0, max: 200 }).withMessage('Letting commission must be 0-200%'),
    body('management_commission_rate').optional().isFloat({ min: 0, max: 100 }).withMessage('Management commission must be 0-100%')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const update = {};
      if (req.body.base_salary_kes !== undefined) update.base_salary_kes = Number(req.body.base_salary_kes);
      if (req.body.letting_commission_rate !== undefined) {
        const val = Number(req.body.letting_commission_rate);
        update.letting_commission_rate = val <= 1 && val > 0 ? val * 100 : val;
      }
      if (req.body.management_commission_rate !== undefined) {
        const val = Number(req.body.management_commission_rate);
        update.management_commission_rate = val <= 1 && val > 0 ? val * 100 : val;
      }

      const agent = await User.findOneAndUpdate(
        { _id: req.params.id, role: 'agent' },
        { $set: update },
        { new: true }
      ).select('_id full_name email phone user_code base_salary_kes letting_commission_rate management_commission_rate');

      if (!agent) {
        return res.status(404).json({ success: false, error: { message: 'Agent not found' } });
      }

      logger.info('Agent commission config updated', { agentId: agent._id, update });
      res.json({ success: true, message: 'Agent commission rates updated', data: agent });
    } catch (error) {

      next(error);
    }
  }
);

/**
 * @openapi
 * /commission/agents:
 *   get:
 *     summary: List all agents with current payroll status
 *     tags: [Commission]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           example: "2026-08"
 *     responses:
 *       200:
 *         description: List of agent payroll summaries
 */
router.get('/agents',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    try {
      const month = req.query.month || new Date().toISOString().slice(0, 7);
      const agents = await User.find({ role: 'agent' })
        .select('_id full_name email phone earb_license user_code is_active base_salary_kes letting_commission_rate management_commission_rate')
        .lean();

      let globalConfig = await CommissionConfig.findOne({ config_name: 'GLOBAL_FINANCIAL_CONFIG' }).lean();
      if (!globalConfig) {
        globalConfig = {
          base_salary_kes: 0,
          letting_commission_percent: 100,
          management_commission_percent: 10,
          withholding_tax_rate_resident: 5
        };
      }

      const payrollList = [];
      for (const agent of agents) {
        let salary = await AgentSalary.findOne({ agent_id: agent._id, billing_month: month }).lean();
        if (!salary) {
          const calc = await calculateAgentCommission(agent._id, month);
          salary = { ...calc, payment_status: 'pending' };
        }
        payrollList.push({
          agent,
          payroll: salary
        });
      }

      res.json({
        success: true,
        data: payrollList,
        billing_month: month,
        config: globalConfig
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /commission/salary/{agentId}:
 *   get:
 *     summary: Get specific agent salary record
 *     tags: [Commission]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detailed agent salary and commission breakdown
 */
router.get('/salary/:agentId',
  requireAuth,
  [param('agentId').isMongoId()],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      // Scope check: Agent can only view own salary
      if (req.user.role === 'agent' && req.user._id.toString() !== req.params.agentId) {
        return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Cannot view salary of another agent' } });
      }

      const month = req.query.month || new Date().toISOString().slice(0, 7);
      let salary = await AgentSalary.findOne({ agent_id: req.params.agentId, billing_month: month }).lean();
      if (!salary) {
        const calc = await calculateAgentCommission(req.params.agentId, month);
        salary = { ...calc, payment_status: 'pending' };
      }

      res.json({ success: true, data: salary });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /commission/payroll/process:
 *   post:
 *     summary: Process and disburse agent payroll and commission
 *     tags: [Commission]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - agent_id
 *               - billing_month
 *             properties:
 *               agent_id:
 *                 type: string
 *               billing_month:
 *                 type: string
 *                 example: "2026-08"
 *     responses:
 *       200:
 *         description: Agent payroll processed successfully
 */
router.post('/payroll/process',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    body('agent_id').isMongoId().withMessage('Valid agent_id required'),
    body('billing_month').matches(/^\d{4}-\d{2}$/).withMessage('Valid billing_month (YYYY-MM) required')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const { agent_id, billing_month } = req.body;
      const salary = await processAgentPayroll(agent_id, billing_month, req.user._id);

      res.json({ success: true, message: 'Agent payroll processed successfully', data: salary });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
