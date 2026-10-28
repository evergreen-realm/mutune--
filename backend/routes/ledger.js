const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { getTrialBalance, postJournalEntry, seedDefaultAccounts } = require('../services/financials');
const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');
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
 * /ledger:
 *   get:
 *     summary: Query General Ledger journal entries
 *     tags: [Ledger]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of journal entries
 */
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, property_id, reference_type, start_date, end_date } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};

    if (property_id) filter.property_id = property_id;
    if (reference_type) filter.reference_type = reference_type;
    if (start_date || end_date) {
      filter.posting_date = {};
      if (start_date) filter.posting_date.$gte = new Date(start_date);
      if (end_date) filter.posting_date.$lte = new Date(end_date);
    }

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

/**
 * @openapi
 * /ledger/{id}:
 *   get:
 *     summary: Retrieve single journal entry details
 *     tags: [Ledger]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Journal entry details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const entry = await JournalEntry.findById(req.params.id)
      .populate('posted_by_user_id', 'full_name email role')
      .populate('property_id', 'name property_code')
      .lean();

    if (!entry) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
    }

    res.json({ success: true, data: entry });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /ledger:
 *   post:
 *     summary: Post a manual journal entry to the General Ledger
 *     tags: [Ledger]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Journal entry successfully recorded
 */
router.post('/',
  [
    body('line_items').isArray({ min: 2 }).withMessage('At least 2 line items are required for double-entry bookkeeping')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const entry = await postJournalEntry({
        ...req.body,
        posted_by_user_id: req.user._id
      });
      logger.info('Manual journal entry posted via ledger route', { entry_code: entry.entry_code, by: req.user._id });
      res.status(201).json({ success: true, data: entry });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /ledger/trial-balance:
 *   get:
 *     summary: Get General Ledger Trial Balance
 *     tags: [Ledger]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current Trial Balance
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
 * /ledger/accounts:
 *   get:
 *     summary: Get Chart of Accounts
 *     tags: [Ledger]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chart of Accounts
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

module.exports = router;
