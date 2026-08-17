const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const CommissionConfig = require('../models/CommissionConfig');
const { getTrialBalance } = require('../services/financials');
const logger = require('../utils/logger');

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
 * /settings/financial:
 *   get:
 *     summary: Fetch global financial & commission configuration settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current financial settings
 */
router.get('/financial',
  requireAuth,
  requireRole(['admin', 'super_admin', 'agent', 'landlord']),
  async (req, res, next) => {
    try {
      let config = await CommissionConfig.findOne({ config_name: 'GLOBAL_FINANCIAL_CONFIG' }).lean();
      if (!config) {
        config = await CommissionConfig.create({ config_name: 'GLOBAL_FINANCIAL_CONFIG' });
      }
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /settings/financial:
 *   put:
 *     summary: Update global financial, commission rates, and tax configuration
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               withholding_tax_rate_resident:
 *                 type: number
 *               withholding_tax_rate_non_resident:
 *                 type: number
 *               letting_commission_percent:
 *                 type: number
 *               management_commission_percent:
 *                 type: number
 *               lease_renewal_commission_percent:
 *                 type: number
 *               agent_initiation_fee_kes:
 *                 type: number
 *               agent_payroll_day_of_month:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Financial settings updated
 */
router.put('/financial',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    body('withholding_tax_rate_resident').optional().isFloat({ min: 0, max: 100 }),
    body('withholding_tax_rate_non_resident').optional().isFloat({ min: 0, max: 100 }),
    body('letting_commission_percent').optional().isFloat({ min: 0, max: 200 }),
    body('management_commission_percent').optional().isFloat({ min: 0, max: 100 }),
    body('lease_renewal_commission_percent').optional().isFloat({ min: 0, max: 100 }),
    body('agent_initiation_fee_kes').optional().isFloat({ min: 0 }),
    body('agent_payroll_day_of_month').optional().isInt({ min: 1, max: 31 }),
    body('disbursement_priority').optional().isArray()
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const allowedFields = [
        'withholding_tax_rate_resident',
        'withholding_tax_rate_non_resident',
        'letting_commission_percent',
        'management_commission_percent',
        'lease_renewal_commission_percent',
        'agent_initiation_fee_kes',
        'agent_payroll_day_of_month',
        'disbursement_priority',
        'etims_pin',
        'etims_device_serial'
      ];

      const update = { updated_by_user_id: req.user._id };
      allowedFields.forEach(f => {
        if (req.body[f] !== undefined) update[f] = req.body[f];
      });

      const config = await CommissionConfig.findOneAndUpdate(
        { config_name: 'GLOBAL_FINANCIAL_CONFIG' },
        { $set: update },
        { new: true, upsert: true, runValidators: true }
      );

      logger.info('Financial settings updated by admin', { userId: req.user._id, update });
      res.json({ success: true, message: 'Financial settings updated successfully', data: config });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /settings/trial-balance:
 *   get:
 *     summary: Generate system-wide General Ledger Trial Balance
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trial balance report data
 */
router.get('/trial-balance',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    try {
      const trialBalance = await getTrialBalance();
      res.json({ success: true, data: trialBalance });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /settings/mewasco-tariffs:
 *   put:
 *     summary: Update MEWASCO tariff tiers and sewer surcharge
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tariffs
 *             properties:
 *               tariffs:
 *                 type: object
 *     responses:
 *       200:
 *         description: Tariff configuration saved
 */
router.put('/mewasco-tariffs', requireAuth, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const { tariffs } = req.body;
    const SystemSetting = require('../models/SystemSetting');
    await SystemSetting.findOneAndUpdate(
      { key: 'mewasco_tariffs' },
      { key: 'mewasco_tariffs', value: tariffs, updated_by: req.user._id },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'MEWASCO tariff rates updated' });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /settings/mewasco-tariffs:
 *   get:
 *     summary: Get active MEWASCO tariff tiers
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active MEWASCO tariffs
 */
router.get('/mewasco-tariffs', requireAuth, async (req, res, next) => {
  try {
    const { getMewascoTariffs } = require('../services/utilityProvider');
    const tariffs = await getMewascoTariffs();
    res.json({ success: true, data: tariffs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
