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
const rateLimit = require('express-rate-limit');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    return false;
  }
  return true;
};

const verifyPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, error: { code: 'RATE_LIMIT', message: 'Too many password verification attempts. Please try again after 15 minutes.' } })
});

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
  requireRole(['admin', 'super_admin', 'agent']),
  async (req, res, next) => {
    try {
      const fromDate = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400000);
      const toDate   = req.query.to   ? new Date(req.query.to)   : new Date();

      let agents = [];
      if (['admin', 'super_admin'].includes(req.user.role)) {
        agents = await User.find({ role: 'agent', is_active: true }).lean();
      } else if (req.user.role === 'agent') {
        agents = await User.find({ _id: req.user._id, role: 'agent' }).lean();
      } else {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not authorized' } });
      }

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
const smsService = require('../services/sms');

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


/**
 * POST /api/v1/admin/verify-password
 * Verifies admin password against hardcoded hash.
 */
router.post('/verify-password',
  verifyPasswordLimiter,
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    body('password').trim().notEmpty().withMessage('Password required')
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { password } = req.body;
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ success: false, error: { message: 'User not found' } });
      }
      
      const bcrypt = require('bcryptjs');
      const { getAdminPassword } = require('../utils/security');
      if (!user.admin_hardcoded_hash) {
        const defaultPassword = getAdminPassword();
        user.admin_hardcoded_hash = await bcrypt.hash(defaultPassword, 10);
        await user.save();
      }

      const isMatch = await bcrypt.compare(password, user.admin_hardcoded_hash);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: { message: 'Incorrect password' } });
      }

      logger.info('Admin hardcoded password verified successfully', { userId: req.user._id });
      res.json({ success: true, message: 'Password verified successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/admin/landlords/pending
 * List all landlords pending approval.
 */
router.get('/landlords/pending',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    try {
      const pending = await User.find({ role: 'landlord', landlord_approval_status: 'pending' })
        .select('-password_hash')
        .lean();
      res.json({ success: true, data: pending });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/admin/landlords/:id/approve
 * Approves a pending landlord, sets active to true, generates unique 6-digit landlord ID, and sends email.
 */
router.patch('/landlords/:id/approve',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('id').isMongoId().withMessage('Invalid landlord ID')
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const landlord = await User.findOne({ _id: req.params.id, role: 'landlord' });
      if (!landlord) {
        return res.status(404).json({ success: false, error: { message: 'Landlord not found' } });
      }
      if (landlord.landlord_approval_status === 'approved') {
        return res.status(400).json({ success: false, error: { message: 'Landlord already approved' } });
      }

      const count = await User.countDocuments({ role: 'landlord', landlord_approval_status: 'approved' });
      const landlordIdCode = String(100000 + count + 1);

      landlord.landlord_approval_status = 'approved';
      landlord.is_active = true;
      landlord.landlord_id = landlordIdCode;
      await landlord.save();

      // Create notification
      await Notification.create({
        type: 'general',
        recipient_role: 'landlord',
        recipient_ids: [landlord._id],
        title: 'Landlord Application Approved',
        message: `Your landlord application has been approved. Your unique Landlord ID is ${landlordIdCode}.`,
        related_entity_id: landlord._id
      });

      // Send email
      await sendEmail(
        landlord.email,
        'Welcome to MutuneRent Pro - Landlord Account Approved!',
        `<h1>Welcome, ${landlord.full_name}!</h1>
         <p>Your landlord application has been approved by Mutune Estate Agency.</p>
         <p><strong>Your Unique 6-Digit Landlord ID:</strong> ${landlordIdCode}</p>
         <p>You can now log in to the MutuneRent Pro dashboard using Google and enter your Landlord ID.</p>
         <br/>
         <p>Regards,<br/>Mutune Estate Agency Management</p>`
      );

      logger.info('Landlord approved successfully', { landlordId: landlord._id, landlordIdCode, by: req.user._id });
      res.json({ success: true, message: 'Landlord approved successfully', data: landlord });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/admin/landlords/:id/reject
 * Rejects a pending landlord and records the reason.
 */
router.patch('/landlords/:id/reject',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('id').isMongoId().withMessage('Invalid landlord ID'),
    body('reason').trim().notEmpty().withMessage('Rejection reason is required')
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const landlord = await User.findOne({ _id: req.params.id, role: 'landlord' });
      if (!landlord) {
        return res.status(404).json({ success: false, error: { message: 'Landlord not found' } });
      }

      const { reason } = req.body;
      landlord.landlord_approval_status = 'rejected';
      landlord.is_active = false;
      await landlord.save();

      await Notification.create({
        type: 'general',
        recipient_role: 'landlord',
        recipient_ids: [landlord._id],
        title: 'Landlord Application Rejected',
        message: `Your landlord application was not approved. Reason: ${reason}`,
        related_entity_id: landlord._id
      });

      await sendEmail(
        landlord.email,
        'Landlord Application Update',
        `<h1>Application Status: Rejected</h1>
         <p>Dear ${landlord.full_name},</p>
         <p>Thank you for registering on MutuneRent Pro. Unfortunately, your landlord application was rejected for the following reason:</p>
         <blockquote><em>${reason}</em></blockquote>
         <p>If you believe this is a mistake, please contact support.</p>`
      );

      logger.info('Landlord registration rejected', { landlordId: landlord._id, reason, by: req.user._id });
      res.json({ success: true, message: 'Landlord application rejected', data: landlord });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/admin/landlords
 * Admin manually creates a landlord (auto-approved).
 */
router.post('/landlords',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('landlord_verification_doc_url').optional().trim().notEmpty().withMessage('Document URL cannot be empty'),
    body('assigned_property_ids').optional().isArray().withMessage('Assigned property IDs must be an array')
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { full_name, email, phone, landlord_verification_doc_url, assigned_property_ids = [] } = req.body;
      
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ success: false, error: { message: 'User with this email already exists' } });
      }

      const count = await User.countDocuments({ role: 'landlord', landlord_approval_status: 'approved' });
      const landlordIdCode = String(100000 + count + 1);
      
      const userCount = await User.countDocuments();
      const userCode = `USR-LLD-${String(userCount + 1).padStart(4, '0')}`;

      const landlord = await User.create({
        user_code: userCode,
        role: 'landlord',
        full_name,
        email,
        phone,
        landlord_id: landlordIdCode,
        landlord_approval_status: 'approved',
        ...(landlord_verification_doc_url ? { landlord_verification_doc_url } : {}),
        assigned_property_ids,
        is_active: true
      });


      // Send email
      await sendEmail(
        email,
        'MutuneRent Pro - Landlord Account Created',
        `<h1>Hello, ${full_name}!</h1>
         <p>An administrator has manually registered your landlord account on MutuneRent Pro.</p>
         <p><strong>Your Unique Landlord ID:</strong> ${landlordIdCode}</p>
         <p>To access your portal, log in with Google using this email address: <strong>${email}</strong> and verify your Landlord ID.</p>
         <br/>
         <p>Regards,<br/>Mutune Estate Agency Management</p>`
      );

      logger.info('Landlord manually created by admin', { landlordId: landlord._id, landlordIdCode, by: req.user._id });
      res.status(201).json({ success: true, message: 'Landlord created successfully', data: landlord });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/admin/tiers
 * Get all property tiers.
 */
router.get('/tiers',
  requireAuth,
  requireRole(['admin', 'super_admin', 'agent']),
  async (req, res, next) => {
    try {
      const PropertyTier = require('../models/PropertyTier');
      const tiers = await PropertyTier.find({ is_active: true }).sort({ created_at: -1 }).lean();
      res.json({ success: true, data: tiers });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/admin/tiers
 * Admin creates a property tier.
 */
router.post('/tiers',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    body('name').trim().notEmpty().withMessage('Tier name required'),
    body('min_rent_kes').isNumeric().withMessage('Min rent must be numeric'),
    body('max_rent_kes').isNumeric().withMessage('Max rent must be numeric'),
    body('description').optional().trim(),
    body('criteria').optional().trim()
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const PropertyTier = require('../models/PropertyTier');
      const { name, min_rent_kes, max_rent_kes, description, criteria } = req.body;
      
      const existing = await PropertyTier.findOne({ name });
      if (existing) {
        return res.status(409).json({ success: false, error: { message: 'Property tier with this name already exists' } });
      }

      const tier = await PropertyTier.create({
        name,
        min_rent_kes: Number(min_rent_kes),
        max_rent_kes: Number(max_rent_kes),
        description,
        criteria,
        created_by: req.user._id
      });

      logger.info('Property tier created', { tierId: tier._id, name, by: req.user._id });
      res.status(201).json({ success: true, data: tier });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/admin/tiers/:id
 * Admin updates a property tier.
 */
router.patch('/tiers/:id',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('id').isMongoId().withMessage('Invalid tier ID'),
    body('name').optional().trim().notEmpty().withMessage('Tier name cannot be empty'),
    body('min_rent_kes').optional().isNumeric().withMessage('Min rent must be numeric'),
    body('max_rent_kes').optional().isNumeric().withMessage('Max rent must be numeric'),
    body('description').optional().trim(),
    body('criteria').optional().trim(),
    body('is_active').optional().isBoolean()
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const PropertyTier = require('../models/PropertyTier');
      const tier = await PropertyTier.findById(req.params.id);
      if (!tier) {
        return res.status(404).json({ success: false, error: { message: 'Property tier not found' } });
      }

      const fields = ['name', 'min_rent_kes', 'max_rent_kes', 'description', 'criteria', 'is_active'];
      fields.forEach(f => {
        if (req.body[f] !== undefined) {
          tier[f] = req.body[f];
        }
      });

      await tier.save();
      logger.info('Property tier updated', { tierId: tier._id, by: req.user._id });
      res.json({ success: true, data: tier });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/admin/properties/:id/verify-tier
 * Admin verifies and validates property tier classification.
 */
router.patch('/properties/:id/verify-tier',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('id').isMongoId().withMessage('Invalid property ID'),
    body('action').isIn(['approve', 'reject']).withMessage('Action must be approve or reject'),
    body('tier_id').optional().isMongoId().withMessage('Valid tier ID required'),
    body('reason').optional().trim()
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const property = await Property.findById(req.params.id);
      if (!property) {
        return res.status(404).json({ success: false, error: { message: 'Property not found' } });
      }

      const { action, tier_id, reason } = req.body;

      if (action === 'approve') {
        const approvedTierId = tier_id || property.proposed_tier_id;
        if (!approvedTierId) {
          return res.status(400).json({ success: false, error: { message: 'Property tier selection is required for approval' } });
        }

        property.tier_id = approvedTierId;
        property.review_status = 'approved';
        property.status = 'active';
        property.tier_approved_by = req.user._id;
        property.tier_approved_at = new Date();
        await property.save();

        // Notify landlord
        if (property.landlord_id) {
          await Notification.create({
            type: 'property_approval',
            recipient_role: 'landlord',
            recipient_ids: [property.landlord_id],
            title: 'Property Tier Approved',
            message: `Your property "${property.name}" has been tier-verified and is now active on MutuneRent Pro.`,
            related_entity_id: property._id
          });
          
          const landlord = await User.findById(property.landlord_id).lean();
          if (landlord && landlord.phone) {
            try {
              await smsService.send(landlord.phone, `MutuneRent Pro: Your property "${property.name}" has been approved and listing is active.`);
            } catch (smsErr) {
              logger.warn('SMS notification failed for property approval', { message: smsErr.message });
            }
          }
        }

        // Notify tenants about new property
        try {
          const PropertyTier = require('../models/PropertyTier');
          const tierObj = await PropertyTier.findById(approvedTierId).lean();
          const tierName = tierObj ? tierObj.name : 'Unknown';
          const startingRent = property.units && property.units.length > 0
            ? Math.min(...property.units.map(u => u.rent_kes || 0))
            : 0;

          await Notification.create({
            type: 'property_approval',
            recipient_role: 'tenant',
            recipient_ids: [],
            title: 'New Property Available',
            message: `New property listed: ${property.name} in ${property.address?.area || ''} – Tier: ${tierName} – Rent: KES ${startingRent}`,
            related_entity_id: property._id,
            property_name: property.name,
            property_area: property.address?.area || '',
            property_tier_name: tierName,
            property_rent: startingRent
          });
        } catch (notifErr) {
          logger.warn('Failed to create tenant notification for property approval', { message: notifErr.message });
        }

        logger.info('Property tier approved by admin', { propertyId: property._id, tierId: approvedTierId, by: req.user._id });
        res.json({ success: true, message: 'Property tier approved and listing activated successfully', data: property });
      } else {
        property.review_status = 'rejected';
        property.status = 'inactive';
        await property.save();

        if (property.landlord_id) {
          await Notification.create({
            type: 'property_approval',
            recipient_role: 'landlord',
            recipient_ids: [property.landlord_id],
            title: 'Property Tier Verification Rejected',
            message: `Your property "${property.name}" tier classification was not approved. Reason: ${reason || 'Not specified'}.`,
            related_entity_id: property._id
          });
        }

        logger.info('Property tier rejected by admin', { propertyId: property._id, reason, by: req.user._id });
        res.json({ success: true, message: 'Property tier verification rejected successfully', data: property });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/admin/settings/customer-care
 * Public settings getter for authenticated users (tenants need to display this).
 */
router.get('/settings/customer-care',
  requireAuth,
  async (req, res, next) => {
    try {
      const SystemSetting = require('../models/SystemSetting');
      let setting = await SystemSetting.findOne({ key: 'customer_care' });
      if (!setting) {
        setting = await SystemSetting.create({
          key: 'customer_care',
          value: '254700000000',
          description: 'Default Mutune Estate Agency customer care phone number'
        });
      }
      res.json({ success: true, number: setting.value });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/admin/settings/customer-care
 * Updates the customer care phone number setting (admin only).
 */
router.post('/settings/customer-care',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    body('number').trim().notEmpty().withMessage('Phone number is required')
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { number } = req.body;
      const SystemSetting = require('../models/SystemSetting');
      let setting = await SystemSetting.findOne({ key: 'customer_care' });
      if (!setting) {
        setting = new SystemSetting({ key: 'customer_care' });
      }
      setting.value = number;
      await setting.save();

      logger.info('Customer care number updated', { number, by: req.user._id });
      res.json({ success: true, number: setting.value, message: 'Customer care number updated successfully' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;


