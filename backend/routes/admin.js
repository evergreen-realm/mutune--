const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const Payment = require('../models/Payment');
const Property = require('../models/Property');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Task = require('../models/Task');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const logger = require('../utils/logger');

/**
 * GET /api/v1/admin/stats
 * Aggregated KPIs for admin dashboard: summary counts, 6-month revenue,
 * unit occupancy trend, and top-performing agents.
 */
router.get('/stats',
  requireAuth,
  requireRole(['admin', 'super_admin', 'accountant']),
  async (req, res, next) => {
    try {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const [
        totalProperties,
        totalTenants,
        totalAgents,
        monthlyRevenue,
        occupancyData,
        agentPerformance,
        paymentStatusBreakdown
      ] = await Promise.all([
        Property.countDocuments(),

        Tenant.countDocuments({ tenancy_status: 'active' }),

        User.countDocuments({ role: 'agent', is_active: true }),

        // Monthly confirmed revenue for last 6 months
        Payment.aggregate([
          { $match: { status: 'confirmed', created_at: { $gte: sixMonthsAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$created_at' } },
              total: { $sum: '$amount_kes' },
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]),

        // Occupancy across all properties
        Property.aggregate([
          { $unwind: { path: '$units', preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: null,
              totalUnits: { $sum: 1 },
              occupiedUnits: {
                $sum: { $cond: [{ $eq: ['$units.status', 'occupied'] }, 1, 0] }
              }
            }
          }
        ]),

        // Top 10 agents by revenue collected
        Payment.aggregate([
          {
            $match: {
              status: 'confirmed',
              verified_by_agent_id: { $exists: true, $ne: null },
              created_at: { $gte: sixMonthsAgo }
            }
          },
          {
            $group: {
              _id: '$verified_by_agent_id',
              total: { $sum: '$amount_kes' },
              count: { $sum: 1 }
            }
          },
          { $sort: { total: -1 } },
          { $limit: 10 },
          { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'agent' } },
          { $unwind: '$agent' },
          {
            $project: {
              name: '$agent.full_name',
              email: '$agent.email',
              total: 1,
              count: 1
            }
          }
        ]),

        // Payment status breakdown (all time)
        Payment.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount_kes' } } }
        ])
      ]);

      const occ = occupancyData[0] || { totalUnits: 0, occupiedUnits: 0 };
      const occupancyRate = occ.totalUnits
        ? Math.round((occ.occupiedUnits / occ.totalUnits) * 100)
        : 0;

      logger.info('Admin stats fetched', { by: req.user._id });

      res.json({
        success: true,
        data: {
          summary: {
            totalProperties,
            totalTenants,
            totalAgents,
            totalUnits: occ.totalUnits,
            occupiedUnits: occ.occupiedUnits,
            occupancyRate
          },
          revenue: monthlyRevenue.map((r) => ({
            month: r._id,
            amount: r.total,
            transactions: r.count
          })),
          topAgents: agentPerformance,
          paymentBreakdown: paymentStatusBreakdown.map((s) => ({
            status: s._id,
            count: s.count,
            total: s.total
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/admin/overdue
 * Returns tenants whose rent is overdue (last payment >30 days ago or missing).
 */
router.get('/overdue',
  requireAuth,
  requireRole(['admin', 'super_admin', 'accountant']),
  async (req, res, next) => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

      // Find tenants with no confirmed payment in last 30 days
      const recentPayers = await Payment.distinct('tenant_id', {
        status: 'confirmed',
        created_at: { $gte: thirtyDaysAgo }
      });

      const overdueTenants = await Tenant.find({
        tenancy_status: 'active',
        _id: { $nin: recentPayers }
      })
        .populate('current_property_id', 'name property_code')
        .select('full_name phone tenant_code rent_amount_kes arrears_kes current_property_id')
        .lean();

      res.json({ success: true, data: overdueTenants, count: overdueTenants.length });
    } catch (error) {
      next(error);
    }
  }
);


/**
 * GET /api/v1/admin/agent-performance
 * Aggregated KPIs per agent: tasks completion rate, rent collected, maintenance resolution time.
 * Optional query: ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/agent-performance',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    try {
      const fromDate = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400000);
      const toDate   = req.query.to   ? new Date(req.query.to)   : new Date();

      const agents = await User.find({ role: 'agent', is_active: true }).lean();

      const agentIds = agents.map(a => a._id);

      const [taskStats, paymentStats, ticketStats] = await Promise.all([
        // Task stats per agent
        Task.aggregate([
          {
            $match: {
              assigned_to: { $in: agentIds },
              created_at: { $gte: fromDate, $lte: toDate }
            }
          },
          {
            $group: {
              _id: '$assigned_to',
              total_tasks: { $sum: 1 },
              completed_tasks: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              overdue_tasks: { $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] } },
              avg_completion_ms: {
                $avg: {
                  $cond: [
                    { $and: [{ $eq: ['$status', 'completed'] }, { $ifNull: ['$completed_at', false] }] },
                    { $subtract: ['$completed_at', '$created_at'] },
                    null
                  ]
                }
              }
            }
          }
        ]),

        // Payment collection per agent (verified_by_agent_id)
        Payment.aggregate([
          {
            $match: {
              status: 'confirmed',
              verified_by_agent_id: { $in: agentIds },
              created_at: { $gte: fromDate, $lte: toDate }
            }
          },
          {
            $group: {
              _id: '$verified_by_agent_id',
              total_collected_kes: { $sum: '$amount_kes' },
              transactions: { $sum: 1 }
            }
          }
        ]),

        // Maintenance tickets resolved per agent
        MaintenanceTicket.aggregate([
          {
            $match: {
              assigned_agent_id: { $in: agentIds },
              status: 'resolved',
              updated_at: { $gte: fromDate, $lte: toDate }
            }
          },
          {
            $group: {
              _id: '$assigned_agent_id',
              resolved_tickets: { $sum: 1 },
              avg_resolution_ms: { $avg: { $subtract: ['$updated_at', '$created_at'] } }
            }
          }
        ])
      ]);

      // Build lookup maps
      const taskMap = Object.fromEntries(taskStats.map(t => [t._id.toString(), t]));
      const payMap  = Object.fromEntries(paymentStats.map(p => [p._id.toString(), p]));
      const tickMap = Object.fromEntries(ticketStats.map(t => [t._id.toString(), t]));

      const report = agents.map(agent => {
        const id = agent._id.toString();
        const tasks = taskMap[id] || { total_tasks: 0, completed_tasks: 0, overdue_tasks: 0, avg_completion_ms: null };
        const pay   = payMap[id]  || { total_collected_kes: 0, transactions: 0 };
        const tick  = tickMap[id] || { resolved_tickets: 0, avg_resolution_ms: null };

        const completionRate = tasks.total_tasks > 0
          ? Math.round((tasks.completed_tasks / tasks.total_tasks) * 100)
          : 0;

        return {
          agent_id: agent._id,
          name: agent.full_name,
          email: agent.email,
          phone: agent.phone,
          task_completion_rate_pct: completionRate,
          total_tasks: tasks.total_tasks,
          completed_tasks: tasks.completed_tasks,
          overdue_tasks: tasks.overdue_tasks,
          avg_task_completion_hours: tasks.avg_completion_ms
            ? Math.round(tasks.avg_completion_ms / 3600000 * 10) / 10
            : null,
          rent_collected_kes: pay.total_collected_kes,
          transactions: pay.transactions,
          tickets_resolved: tick.resolved_tickets,
          avg_ticket_resolution_hours: tick.avg_resolution_ms
            ? Math.round(tick.avg_resolution_ms / 3600000 * 10) / 10
            : null
        };
      });

      // Sort by rent collected descending (leaderboard)
      report.sort((a, b) => b.rent_collected_kes - a.rent_collected_kes);

      logger.info('Agent performance report generated', { agents: report.length, by: req.user._id });
      res.json({ success: true, data: report, period: { from: fromDate, to: toDate } });
    } catch (error) {
      next(error);
    }
  }
);

// ─── AGENT APPROVAL ENDPOINTS ────────────────────────────────────────────────

const Notification = require('../models/Notification');
const LateFeeRule = require('../models/LateFeeRule');
const { sendEmail } = require('../services/email');

/**
 * GET /api/v1/admin/agents/pending
 * List all agents with pending approval status.
 */
router.get('/agents/pending',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    try {
      const pendingAgents = await User.find({ role: 'agent', agent_approval_status: 'pending' })
        .select('-password_hash')
        .lean();
      res.json({ success: true, data: pendingAgents });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/admin/agents/:id/approve
 * Approves a pending agent, sets active to true, and generates their unique agent ID code.
 */
router.patch('/agents/:id/approve',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('id').isMongoId().withMessage('Invalid agent ID')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    }

    try {
      const agent = await User.findOne({ _id: req.params.id, role: 'agent' });
      if (!agent) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } });
      }

      if (agent.agent_approval_status === 'approved') {
        return res.status(400).json({ success: false, error: { code: 'ALREADY_APPROVED', message: 'Agent is already approved' } });
      }

      const count = await User.countDocuments({ role: 'agent', agent_approval_status: 'approved' });
      const agentCode = `AGT-MOM-${String(count + 1).padStart(3, '0')}`;

      agent.agent_approval_status = 'approved';
      agent.is_active = true;
      agent.user_code = agentCode;
      await agent.save();

      // Create an in-app notification for the approved agent
      await Notification.create({
        type: 'general',
        recipient_role: 'agent',
        recipient_ids: [agent._id],
        title: 'Account Application Approved',
        message: `Your agent account has been approved. Your unique Agent ID is ${agentCode}.`,
        related_entity_id: agent._id
      });

      // Send welcome email
      await sendEmail(
        agent.email,
        'Welcome to MutuneRent Pro - Account Approved!',
        `<h1>Welcome, ${agent.full_name}!</h1>
         <p>We are pleased to inform you that your Estate Agent application has been approved by the Mutune Estate Agency admin team.</p>
         <p><strong>Your Unique Agent ID:</strong> ${agentCode}</p>
         <p>You can now log in to the MutuneRent Pro dashboard using your registered account credentials.</p>
         <br/>
         <p>Regards,<br/>Mutune Estate Agency Management</p>`
      );

      logger.info('Agent approved successfully', { agentId: agent._id, agentCode, by: req.user._id });
      res.json({ success: true, message: 'Agent approved successfully', data: agent });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/admin/agents/:id/reject
 * Rejects a pending agent and records the rejection reason.
 */
router.patch('/agents/:id/reject',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('id').isMongoId().withMessage('Invalid agent ID'),
    body('reason').trim().notEmpty().withMessage('Rejection reason is required')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    }

    try {
      const agent = await User.findOne({ _id: req.params.id, role: 'agent' });
      if (!agent) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Agent not found' } });
      }

      const { reason } = req.body;
      agent.agent_approval_status = 'rejected';
      agent.is_active = false;
      agent.agent_rejection_reason = reason;
      await agent.save();

      // Create notification
      await Notification.create({
        type: 'general',
        recipient_role: 'agent',
        recipient_ids: [agent._id],
        title: 'Account Application Rejected',
        message: `Your agent account application was rejected. Reason: ${reason}`,
        related_entity_id: agent._id
      });

      // Send rejection email
      await sendEmail(
        agent.email,
        'Agent Application Update',
        `<h1>Application Status: Rejected</h1>
         <p>Dear ${agent.full_name},</p>
         <p>Thank you for applying to be an agent on MutuneRent Pro. Unfortunately, your application could not be approved at this time for the following reason:</p>
         <blockquote><em>${reason}</em></blockquote>
         <p>If you believe this is a mistake, please contact Mutune Estate Agency administration or update your details.</p>`
      );

      logger.info('Agent rejected', { agentId: agent._id, reason, by: req.user._id });
      res.json({ success: true, message: 'Agent application rejected', data: agent });
    } catch (error) {
      next(error);
    }
  }
);

// ─── LATE FEE RULES ENDPOINTS ────────────────────────────────────────────────

/**
 * GET /api/v1/admin/late-fee-rules
 * List all late fee rules.
 */
router.get('/late-fee-rules',
  requireAuth,
  requireRole(['admin', 'super_admin', 'accountant']),
  async (req, res, next) => {
    try {
      const rules = await LateFeeRule.find().sort({ created_at: -1 }).lean();
      res.json({ success: true, data: rules });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/admin/late-fee-rules
 * Create a new late fee rule.
 */
router.post('/late-fee-rules',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    body('name').trim().notEmpty().withMessage('Rule name is required'),
    body('grace_days').isInt({ min: 0 }).withMessage('Grace days must be a non-negative integer'),
    body('penalty_type').isIn(['percentage', 'fixed']).withMessage('Penalty type must be percentage or fixed'),
    body('penalty_value').isFloat({ min: 0 }).withMessage('Penalty value must be non-negative'),
    body('max_penalty_per_month').optional().isFloat({ min: 0 }).withMessage('Max penalty must be non-negative'),
    body('applies_to').isIn(['all', 'residential', 'commercial']).withMessage('Applies to must be all, residential, or commercial')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    }

    try {
      const { name, grace_days, penalty_type, penalty_value, max_penalty_per_month, applies_to, is_active } = req.body;
      const rule = await LateFeeRule.create({
        name,
        grace_days,
        penalty_type,
        penalty_value,
        max_penalty_per_month,
        applies_to,
        is_active: is_active !== undefined ? is_active : true,
        created_by: req.user._id
      });

      logger.info('Late fee rule created', { ruleId: rule._id, by: req.user._id });
      res.status(201).json({ success: true, data: rule });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/admin/late-fee-rules/:id
 * Update an existing late fee rule.
 */
router.patch('/late-fee-rules/:id',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('id').isMongoId().withMessage('Invalid rule ID'),
    body('name').optional().trim().notEmpty().withMessage('Rule name cannot be empty'),
    body('grace_days').optional().isInt({ min: 0 }).withMessage('Grace days must be a non-negative integer'),
    body('penalty_type').optional().isIn(['percentage', 'fixed']).withMessage('Penalty type must be percentage or fixed'),
    body('penalty_value').optional().isFloat({ min: 0 }).withMessage('Penalty value must be non-negative'),
    body('max_penalty_per_month').optional().isFloat({ min: 0 }).withMessage('Max penalty must be non-negative'),
    body('applies_to').optional().isIn(['all', 'residential', 'commercial']).withMessage('Applies to must be all, residential, or commercial'),
    body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    }

    try {
      const rule = await LateFeeRule.findById(req.params.id);
      if (!rule) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Late fee rule not found' } });
      }

      const fields = ['name', 'grace_days', 'penalty_type', 'penalty_value', 'max_penalty_per_month', 'applies_to', 'is_active'];
      for (const field of fields) {
        if (req.body[field] !== undefined) {
          rule[field] = req.body[field];
        }
      }
      rule.updated_at = new Date();
      await rule.save();

      logger.info('Late fee rule updated', { ruleId: rule._id, by: req.user._id });
      res.json({ success: true, data: rule });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/admin/late-fee-rules/:id
 * Delete an existing late fee rule.
 */
router.delete('/late-fee-rules/:id',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('id').isMongoId().withMessage('Invalid rule ID')
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    }

    try {
      const rule = await LateFeeRule.findByIdAndDelete(req.params.id);
      if (!rule) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Late fee rule not found' } });
      }

      logger.info('Late fee rule deleted', { ruleId: req.params.id, by: req.user._id });
      res.json({ success: true, message: 'Late fee rule deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

