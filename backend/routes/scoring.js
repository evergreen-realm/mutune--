const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { calculateTenantScore } = require('../services/tenantScoring');

/**
 * @openapi
 * /scoring/tenant/{tenantId}:
 *   get:
 *     summary: Fetch AI & behavioral financial health score for a tenant
 *     tags: [Scoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tenant creditworthiness & payment reliability metrics
 */
router.get('/tenant/:tenantId', requireAuth, async (req, res, next) => {
  try {
    const scoreData = await calculateTenantScore(req.params.tenantId);
    res.json({ success: true, data: scoreData });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
