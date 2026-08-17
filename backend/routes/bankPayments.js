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
