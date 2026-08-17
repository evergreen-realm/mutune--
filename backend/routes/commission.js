const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const User = require('../models/User');
const AgentSalary = require('../models/AgentSalary');
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
      const agents = await User.find({ role: 'agent' }).select('_id full_name email phone earb_license_number').lean();

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

      res.json({ success: true, data: payrollList, billing_month: month });
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
