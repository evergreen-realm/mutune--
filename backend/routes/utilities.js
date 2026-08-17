const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const UtilityMeter = require('../models/UtilityMeter');
const UtilityReading = require('../models/UtilityReading');
const Tenant = require('../models/Tenant');
const {
  validateMeter,
  purchasePrepaidToken,
  queryPostpaidBill,
  payPostpaidBill,
  validateWaterAccount,
  queryWaterBill,
  payWaterBill,
  getSupportedProviders
} = require('../services/utilityProvider');
const logger = require('../utils/logger');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    return false;
  }
  return true;
};

// ─── GET /api/v1/utilities/providers — Supported Water & Electricity Providers ─
router.get('/providers', (req, res) => {
  res.json({
    success: true,
    data: getSupportedProviders()
  });
});

/**
 * @openapi
 * /utilities/prepaid/purchase-token:
 *   post:
 *     summary: Purchase KPLC Prepaid Electricity Token
 *     description: Vend KPLC prepaid electricity tokens directly through Kyanda utility vending gateway.
 *     tags:
 *       - Utilities
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - meter_number
 *               - amount_kes
 *             properties:
 *               meter_number:
 *                 type: string
 *                 example: "14234567890"
 *               amount_kes:
 *                 type: number
 *                 example: 500
 *     responses:
 *       200:
 *         description: Token successfully generated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UtilityTokenResponse'
 */
router.post('/prepaid/purchase-token',
  requireAuth,
  [
    body('meter_number').notEmpty().withMessage('Prepaid meter number is required'),
    body('amount_kes').isFloat({ min: 50 }).withMessage('Minimum token purchase amount is KES 50')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const { meter_number, amount_kes, payment_method = 'mpesa', tenant_id, unit_id, property_id } = req.body;

      const vendingResult = await purchasePrepaidToken(meter_number, Number(amount_kes), payment_method);

      // Store in UtilityReading for audit trail if context is provided
      if (meter_number) {
        try {
          await UtilityReading.create({
            property_id: property_id || undefined,
            unit_id: unit_id || undefined,
            tenant_id: tenant_id || req.user._id,
            billing_month: new Date().toISOString().slice(0, 7),
            previous_reading: 0,
            current_reading: vendingResult.units_kwh,
            consumption_units: vendingResult.units_kwh,
            rate_per_unit_kes: Number((amount_kes / (vendingResult.units_kwh || 1)).toFixed(2)),
            total_amount_kes: Number(amount_kes)
          });
        } catch (readErr) {
          logger.warn('Failed to log utility reading audit for token purchase', { error: readErr.message });
        }
      }

      res.status(200).json({
        success: true,
        message: 'KPLC prepaid electricity token vended successfully ✓',
        data: vendingResult
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /api/v1/utilities/postpaid/bill/:accountNumber — Step 6.2 Bill Query ─
router.get('/postpaid/bill/:accountNumber',
  requireAuth,
  async (req, res, next) => {
    try {
      const { accountNumber } = req.params;
      const { provider } = req.query;

      const bill = await queryPostpaidBill(accountNumber, provider || 'KPLC_POSTPAID');
      res.json({ success: true, data: bill });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/v1/utilities/postpaid/pay — Step 6.2 Pay Postpaid Bill ─────────
router.post('/postpaid/pay',
  requireAuth,
  requireRole(['agent', 'admin', 'super_admin', 'landlord']),
  [
    body('account_number').notEmpty().withMessage('Account number is required'),
    body('amount_kes').isFloat({ min: 10 }).withMessage('Valid amount is required')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const { account_number, amount_kes, property_id } = req.body;

      const paymentResult = await payPostpaidBill(account_number, Number(amount_kes), property_id);
      res.json({
        success: true,
        message: 'Postpaid electricity bill paid successfully ✓',
        data: paymentResult
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/v1/utilities/water/validate — Step 6.3 Validate Water Account ──
router.post('/water/validate',
  requireAuth,
  [
    body('account_number').notEmpty().withMessage('Water account number is required')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const { account_number, provider_id } = req.body;

      const result = await validateWaterAccount(account_number, provider_id || 'MOMBASA_WATER');
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /api/v1/utilities/water/bill/:accountNumber — Step 6.3 Query Water Bill ─
router.get('/water/bill/:accountNumber',
  requireAuth,
  async (req, res, next) => {
    try {
      const { accountNumber } = req.params;
      const { provider_id } = req.query;

      const bill = await queryWaterBill(accountNumber, provider_id || 'MOMBASA_WATER');
      res.json({ success: true, data: bill });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/v1/utilities/water/pay — Step 6.3 Pay Water Bill ───────────────
router.post('/water/pay',
  requireAuth,
  requireRole(['agent', 'admin', 'super_admin', 'landlord']),
  [
    body('account_number').notEmpty().withMessage('Water account number is required'),
    body('amount_kes').isFloat({ min: 10 }).withMessage('Valid amount is required')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const { account_number, amount_kes, provider_id, property_id } = req.body;

      const paymentResult = await payWaterBill(account_number, Number(amount_kes), provider_id || 'MOMBASA_WATER', property_id);
      res.json({
        success: true,
        message: 'Water utility bill paid successfully ✓',
        data: paymentResult
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/v1/utilities/meters — Register utility meter ───────────────────
router.post('/meters', requireAuth, async (req, res, next) => {
  try {
    const { property_id, unit_id, floor_number, grouping_level, meter_type, provider, token_number } = req.body;
    
    // Direct validation via Kyanda utility aggregator if API key is configured
    if (provider && token_number && process.env.KYANDA_API_KEY) {
      try {
        await validateMeter(token_number, provider);
      } catch (valErr) {
        logger.warn('Meter validation warning during registration', { error: valErr.message });
      }
    }

    const meter = await UtilityMeter.create({
      property_id,
      unit_id,
      floor_number,
      grouping_level: grouping_level || 'unit',
      meter_type,
      provider,
      token_number
    });

    res.status(201).json({ success: true, data: meter });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/v1/utilities/readings — Log meter reading ──────────────────────
router.post('/readings', requireAuth, async (req, res, next) => {
  try {
    const { meter_id, property_id, unit_id, tenant_id, billing_month, previous_reading, current_reading, rate_per_unit_kes } = req.body;

    if (req.user.role === 'caretaker' && property_id) {
      const assigned = (req.user.assigned_properties || req.user.assigned_property_ids || []).map(id => id.toString());
      if (!assigned.includes(property_id.toString())) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot record reading for unassigned property' } });
      }
    }

    const consumption_units = Math.max(0, current_reading - (previous_reading || 0));
    const total_amount_kes = Number((consumption_units * (rate_per_unit_kes || 50)).toFixed(2));

    const reading = await UtilityReading.create({
      meter_id,
      property_id,
      unit_id,
      tenant_id,
      billing_month,
      previous_reading,
      current_reading,
      consumption_units,
      rate_per_unit_kes: rate_per_unit_kes || 50,
      total_amount_kes
    });

    res.status(201).json({ success: true, data: reading });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/v1/utilities/invoice/:tenantId — Itemized Combined Invoice ──────
router.get('/invoice/:tenantId', requireAuth, async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const readings = await UtilityReading.find({ tenant_id: tenantId, billing_month: currentMonth }).lean();

    const waterCost = readings.filter(r => r.total_amount_kes).reduce((sum, r) => sum + r.total_amount_kes, 0);
    const baseRent = tenant.rent_amount_kes || 0;
    const totalInvoiceKes = baseRent + waterCost;

    res.json({
      success: true,
      data: {
        tenant_name: tenant.full_name,
        billing_month: currentMonth,
        base_rent_kes: baseRent,
        utility_charges_kes: waterCost,
        itemized_readings: readings,
        total_invoice_kes: totalInvoiceKes
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /utilities/water/analytics/{propertyId}:
 *   get:
 *     summary: Water consumption analytics with monthly trend for a property
 *     tags: [Utilities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 6
 *     responses:
 *       200:
 *         description: Monthly water consumption trend and average metrics
 */
router.get('/water/analytics/:propertyId', requireAuth, async (req, res, next) => {
  try {
    const { propertyId } = req.params;
    const { months = 6 } = req.query;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - Number(months));

    const readings = await UtilityReading.find({
      property_id: propertyId,
      billing_month: { $gte: startDate.toISOString().slice(0, 7) }
    }).sort({ billing_month: 1 }).lean();

    const monthlyTotals = {};
    for (const r of readings) {
      if (!monthlyTotals[r.billing_month]) {
        monthlyTotals[r.billing_month] = { month: r.billing_month, total_units: 0, total_kes: 0, readings: 0 };
      }
      monthlyTotals[r.billing_month].total_units += r.consumption_units || 0;
      monthlyTotals[r.billing_month].total_kes += r.total_amount_kes || 0;
      monthlyTotals[r.billing_month].readings += 1;
    }

    const trend = Object.values(monthlyTotals);
    const avgConsumption = trend.length > 0
      ? Math.round(trend.reduce((s, t) => s + t.total_units, 0) / trend.length)
      : 0;

    res.json({
      success: true,
      data: {
        property_id: propertyId,
        period_months: Number(months),
        average_monthly_consumption_units: avgConsumption,
        trend,
        total_readings: readings.length
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /utilities/readings/bulk:
 *   post:
 *     summary: Bulk import water and utility meter readings
 *     tags: [Utilities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - readings
 *             properties:
 *               readings:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Bulk import results with success count and failed details
 */
router.post('/readings/bulk',
  requireAuth,
  requireRole(['agent', 'admin', 'caretaker', 'super_admin']),
  [
    body('readings').isArray({ min: 1, max: 500 }).withMessage('Readings array must contain between 1 and 500 items')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const { readings } = req.body;
      const details = [];
      let imported = 0;
      let failed = 0;

      for (const item of readings) {
        try {
          if (!item.property_id || !item.unit_id || item.current_reading === undefined) {
            failed++;
            details.push({ item, status: 'failed', reason: 'Missing property_id, unit_id, or current_reading' });
            continue;
          }

          const consumption = Math.max(0, Number(item.current_reading) - Number(item.previous_reading || 0));
          const rate = Number(item.rate_per_unit_kes || 50);
          const totalKes = Number(item.total_amount_kes || (consumption * rate));

          const created = await UtilityReading.create({
            meter_id: item.meter_id || undefined,
            property_id: item.property_id,
            unit_id: item.unit_id,
            tenant_id: item.tenant_id || undefined,
            billing_month: item.billing_month || new Date().toISOString().slice(0, 7),
            previous_reading: Number(item.previous_reading || 0),
            current_reading: Number(item.current_reading),
            consumption_units: consumption,
            rate_per_unit_kes: rate,
            total_amount_kes: totalKes,
            photo_proof_url: item.photo_proof_url || null
          });

          imported++;
          details.push({ reading_id: created._id, status: 'success' });
        } catch (itemErr) {
          failed++;
          details.push({ item, status: 'failed', reason: itemErr.message });
        }
      }

      res.json({
        success: true,
        data: {
          total: readings.length,
          imported,
          failed,
          details
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /utilities/water/calculate-bill:
 *   post:
 *     summary: Calculate tiered water bill (e.g. MEWASCO WASREB rates)
 *     tags: [Utilities]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - consumption_m3
 *             properties:
 *               consumption_m3:
 *                 type: number
 *                 example: 25
 *               category:
 *                 type: string
 *                 enum: [domestic, commercial, industrial]
 *                 default: domestic
 *               provider_id:
 *                 type: string
 *                 default: MOMBASA_WATER
 *     responses:
 *       200:
 *         description: Calculated water bill with tiered breakdown and sewer surcharge
 */
router.post('/water/calculate-bill', requireAuth, async (req, res, next) => {
  try {
    const { consumption_m3, category = 'domestic', provider_id = 'MOMBASA_WATER' } = req.body;
    if (consumption_m3 === undefined || consumption_m3 === null || Number(consumption_m3) < 0) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid consumption_m3 is required' } });
    }
    const { calculateMewascoWaterBill } = require('../services/utilityProvider');
    const bill = await calculateMewascoWaterBill(Number(consumption_m3), category);
    res.json({ success: true, data: { provider_id, ...bill } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
