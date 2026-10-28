const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { getTrialBalance, postJournalEntry, seedDefaultAccounts } = require('../services/financials');
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const logger = require('../utils/logger');

// Enforce that only admin, super_admin, and accountant roles have read/write access
router.use(requireAuth, requireRole(['admin', 'super_admin', 'accountant']));

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
 * /financials/trial-balance:
 *   get:
 *     summary: Retrieve General Ledger Trial Balance
 *     tags: [Financials]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trial balance balances
 */
router.get('/trial-balance', async (req, res, next) => {
  try {
    const trialBalance = await getTrialBalance();
    res.json({ success: true, data: trialBalance });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /financials/accounts:
 *   get:
 *     summary: Fetch chart of accounts
 *     tags: [Financials]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chart of accounts
 */
router.get('/accounts', async (req, res, next) => {
  try {
    await seedDefaultAccounts();
    const accounts = await Account.find({ is_active: true }).sort({ account_code: 1 }).lean();
    res.json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /financials/accounts:
 *   post:
 *     summary: Create or update an account in the chart of accounts
 *     tags: [Financials]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [account_code, account_name, account_type]
 *     responses:
 *       201:
 *         description: Account created or updated
 */
router.post('/accounts',
  [
    body('account_code').trim().notEmpty().withMessage('account_code is required'),
    body('account_name').trim().notEmpty().withMessage('account_name is required'),
    body('account_type').isIn(['asset', 'liability', 'equity', 'income', 'expense']).withMessage('Invalid account_type')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const { account_code, account_name, account_type, account_subtype, description } = req.body;
      const account = await Account.findOneAndUpdate(
        { account_code },
        {
          $set: {
            account_name,
            account_type,
            account_subtype: account_subtype || 'general',
            description: description || ''
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      logger.info('Account created or updated', { account_code, by: req.user._id });
      res.status(201).json({ success: true, data: account });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /financials/journal-entries:
 *   post:
 *     summary: Post a double-entry journal entry
 *     tags: [Financials]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Journal entry posted
 */
router.post('/journal-entries',
  [
    body('line_items').isArray({ min: 2 }).withMessage('At least 2 line items are required for double entry')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const entry = await postJournalEntry({
        ...req.body,
        posted_by_user_id: req.user._id
      });
      res.status(201).json({ success: true, data: entry });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /financials/journal-entries:
 *   get:
 *     summary: List posted journal entries
 *     tags: [Financials]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of journal entries
 */
router.get('/journal-entries', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, property_id, reference_type } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};
    if (property_id) filter.property_id = property_id;
    if (reference_type) filter.reference_type = reference_type;

    const [entries, total] = await Promise.all([
      JournalEntry.find(filter)
        .sort({ posting_date: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('posted_by_user_id', 'full_name email role')
        .populate('property_id', 'name property_code')
        .lean(),
      JournalEntry.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: entries,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
