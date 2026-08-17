const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const AuditLog = require('../models/AuditLog');
const { paginate } = require('../utils/paginate');

/**
 * @openapi
 * /audit/logs:
 *   get:
 *     summary: List audit trail entries for compliance
 *     description: Retrieve system-wide audit trail logs with filtering and pagination.
 *     tags:
 *       - Audit
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of audit log records
 */
router.get('/logs',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    try {
      const { page = 1, limit = 50, action, user_id } = req.query;
      const filter = {};
      if (action) filter.action = action;
      if (user_id) filter.user_id = user_id;

      const result = await paginate(AuditLog, filter, {
        page,
        limit,
        sort: { createdAt: -1, timestamp: -1 }
      });

      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
