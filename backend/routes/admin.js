const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const Payment = require('../models/Payment');
const Property = require('../models/Property');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
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

module.exports = router;
