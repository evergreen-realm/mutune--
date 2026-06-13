const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const aiService = require('../services/ai');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const logger = require('../utils/logger');

// ── POST /api/v1/ai/chat ──────────────────────────────────────────────────────
router.post(
  '/chat',
  requireAuth,
  [
    body('message').trim().notEmpty().isLength({ max: 2000 }).withMessage('Message required (max 2000 chars)'),
    body('session_id').optional().trim().isLength({ max: 128 }),
    body('context').optional().isObject()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }

      const { message, session_id, context = {} } = req.body;

      // Enrich context with tenant + property details when role is tenant
      const enrichedContext = { ...context };
      if (req.user.role === 'tenant') {
        const tenant = await Tenant.findOne({ user_id: req.user._id }).lean();
        if (tenant) {
          enrichedContext.tenantName = tenant.full_name;
          enrichedContext.unitId     = tenant.current_unit_id;
          enrichedContext.preferredChannel = tenant.preferred_channel;
          if (tenant.current_property_id) {
            const property = await Property.findById(tenant.current_property_id).select('name address property_code').lean();
            if (property) {
              enrichedContext.propertyName = property.name;
              enrichedContext.propertyCode = property.property_code;
              enrichedContext.propertyArea = property.address?.area;
            }
          }
        }
      }

      const result = await aiService.chat({
        message,
        sessionId: session_id || `sess_${req.user._id}_${Date.now()}`,
        userId: req.user._id.toString(),
        role: req.user.role,
        context: enrichedContext,
        user: req.user
      });

      res.json({
        success: true,
        data: {
          response: result.response,
          session_id: result.sessionId,
          tool_intent: result.toolIntent,
          tokens_used: result.tokensUsed
        }
      });
    } catch (error) {
      if (error.status === 429) {
        return res.status(429).json({ success: false, error: { code: 'RATE_LIMIT', message: error.message } });
      }
      next(error);
    }
  }
);

// ── GET /api/v1/ai/history/:session_id ───────────────────────────────────────
router.get('/history/:session_id', requireAuth, async (req, res, next) => {
  try {
    // Security: session_id must contain the requesting user's ID
    if (!req.params.session_id.includes(req.user._id.toString())) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your session' } });
    }
    const history = aiService.getHistory(req.params.session_id);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

// ── DELETE /api/v1/ai/history/:session_id ────────────────────────────────────
router.delete('/history/:session_id', requireAuth, async (req, res, next) => {
  try {
    if (!req.params.session_id.includes(req.user._id.toString())) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your session' } });
    }
    const result = aiService.clearHistory(req.params.session_id);
    logger.info('AI session cleared', { userId: req.user._id, sessionId: req.params.session_id });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
