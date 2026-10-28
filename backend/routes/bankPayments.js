const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const {
  createCollectionCheckout,
  handleBankWebhook,
  getBankTransactionStatus
} = require('../services/bankPayments');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * @openapi
 * /bank-payments/checkout:
 *   post:
 *     summary: Initiate multi-bank checkout via IntaSend
 *     tags: [BankPayments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount_kes
 *               - tenant_id
 *             properties:
 *               amount_kes:
 *                 type: number
 *                 example: 45000
 *               tenant_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Checkout session created
 */
router.post('/checkout',
  requireAuth,
  [
    body('amount_kes').isNumeric().withMessage('Amount must be a valid number'),
    body('tenant_id').isMongoId().withMessage('Valid tenant ID required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }

      const checkout = await createCollectionCheckout(req.body);
      res.status(201).json({ success: true, data: checkout });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /bank-payments/webhook:
 *   post:
 *     summary: IntaSend IPN payment webhook callback
 *     tags: [BankPayments]
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['x-intasend-signature'];
    const webhookSecret = process.env.INTASEND_WEBHOOK_SECRET || process.env.INTASEND_SECRET_KEY || process.env.WEBHOOK_SECRET;

    if (webhookSecret) {
      const authHeader = req.headers['x-webhook-secret'] || req.headers['authorization'];
      const querySecret = req.query.secret;

      let verified = false;

      // 1. Check direct token/secret match
      if (authHeader === webhookSecret || authHeader === `Bearer ${webhookSecret}` || querySecret === webhookSecret || signature === webhookSecret) {
        verified = true;
      }

      // 2. If signature provided, check HMAC-SHA256 signature
      if (!verified && signature) {
        const rawPayload = req.rawBody
          ? (Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : String(req.rawBody))
          : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

        const computedHex = crypto.createHmac('sha256', webhookSecret).update(rawPayload).digest('hex');
        const computedBase64 = crypto.createHmac('sha256', webhookSecret).update(rawPayload).digest('base64');

        if (signature === computedHex || signature === computedBase64) {
          verified = true;
        }
      }

      if (!verified) {
        logger.warn('Unauthorized bank webhook callback attempt', { ip: req.ip, signatureProvided: !!signature });
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED_WEBHOOK', message: 'Webhook signature or secret verification failed' }
        });
      }
    } else if (process.env.NODE_ENV === 'production') {
      logger.error('INTASEND_WEBHOOK_SECRET is not configured in production');
      return res.status(500).json({ success: false, error: { code: 'CONFIG_ERROR', message: 'Webhook secret not configured' } });
    }

    const result = await handleBankWebhook(req.body, signature);
    res.json({ success: true, message: 'Webhook processed successfully', data: result });
  } catch (error) {
    logger.error('Bank payment webhook error', { error: error.message });
    res.status(500).json({ success: false, error: { code: 'WEBHOOK_ERROR', message: error.message } });
  }
});

/**
 * @openapi
 * /bank-payments/status/{txnId}:
 *   get:
 *     summary: Query bank payment transaction status
 *     tags: [BankPayments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: txnId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transaction status details
 */
router.get('/status/:txnId',
  requireAuth,
  async (req, res, next) => {
    try {
      const status = await getBankTransactionStatus(req.params.txnId);
      res.json({ success: true, data: status });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
