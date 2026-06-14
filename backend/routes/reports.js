const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const Payment = require('../models/Payment');
const logger = require('../utils/logger');

/**
 * GET /api/v1/reports/kra?month=YYYY-MM
 * Generates a KRA-formatted rent reconciliation CSV.
 * Applies 5% withholding tax for commercial properties.
 * Returns: Content-Type: text/csv with download header.
 */
router.get('/kra',
  requireAuth,
  requireRole(['admin', 'super_admin', 'accountant']),
  [
    query('month')
      .matches(/^\d{4}-\d{2}$/)
      .withMessage('Month must be YYYY-MM format (e.g. 2025-01)')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }

      const { month } = req.query;
      const [year, mon] = month.split('-').map(Number);
      const start = new Date(Date.UTC(year, mon - 1, 1));
      const end = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));

      const payments = await Payment.find({
        status: 'confirmed',
        created_at: { $gte: start, $lte: end }
      })
        .populate('tenant_id', 'full_name tenant_code national_id')
        .populate('property_id', 'property_code name type address')
        .sort({ created_at: 1 })
        .lean();

      if (!payments.length) {
        // Return empty CSV with headers rather than 404
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="kra_reconciliation_${month}.csv"`);
        return res.send('Date,Receipt_No,Tenant_Name,Tenant_Code,National_ID,Property_Code,Property_Name,Area,Unit,Payment_Type,Amount_KES,Tax_Classification,Withholding_Tax_KES,Net_Amount_KES\r\n');
      }

      const COMMERCIAL_WITHHOLDING_RATE = 0.10;
      const RESIDENTIAL_MRI_RATE = 0.075;

      const rows = payments.map((p) => {
        const isCommercial = p.property_id?.type === 'commercial';
        const amountKes = p.amount_kes || 0;
        const taxKes = isCommercial 
          ? Math.round(amountKes * COMMERCIAL_WITHHOLDING_RATE) 
          : Math.round(amountKes * RESIDENTIAL_MRI_RATE);
        const netKes = amountKes - taxKes;
        const taxClassification = isCommercial ? 'Commercial Rent (WHT 10%)' : 'Residential Rent (MRI 7.5%)';

        // Escape CSV fields (wrap in quotes if they contain commas)
        const esc = (v) => {
          const s = String(v == null ? 'N/A' : v);
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        };

        return [
          p.created_at.toISOString().split('T')[0],
          esc(p.mpesa_receipt || p.transaction_id || 'N/A'),
          esc(p.tenant_id?.full_name),
          esc(p.tenant_id?.tenant_code),
          esc(p.tenant_id?.national_id),
          esc(p.property_id?.property_code),
          esc(p.property_id?.name),
          esc(p.property_id?.address?.area),
          esc(p.unit_id),
          esc(p.payment_type),
          amountKes,
          esc(taxClassification),
          taxKes,
          netKes
        ].join(',');
      });

      const totalRevenue = payments.reduce((s, p) => s + (p.amount_kes || 0), 0);
      const totalTax = payments.reduce((s, p) => {
        const amount = p.amount_kes || 0;
        const isCommercial = p.property_id?.type === 'commercial';
        const tax = isCommercial 
          ? Math.round(amount * COMMERCIAL_WITHHOLDING_RATE)
          : Math.round(amount * RESIDENTIAL_MRI_RATE);
        return s + tax;
      }, 0);

      const header = 'Date,Receipt_No,Tenant_Name,Tenant_Code,National_ID,Property_Code,Property_Name,Area,Unit,Payment_Type,Amount_KES,Tax_Classification,Withholding_Tax_KES,Net_Amount_KES';
      const footer = `\r\n,,,,,,,,TOTAL,,${totalRevenue},,${totalTax},${totalRevenue - totalTax}`;
      const csv = [header, ...rows].join('\r\n') + footer;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="kra_reconciliation_${month}.csv"`);
      res.setHeader('X-Record-Count', payments.length.toString());
      res.send('\uFEFF' + csv); // UTF-8 BOM for Excel compatibility

      logger.info('KRA report generated', {
        month,
        records: payments.length,
        totalRevenue,
        totalTax,
        generatedBy: req.user._id
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/reports/summary?month=YYYY-MM
 * JSON summary of monthly stats (for dashboard cards).
 */
router.get('/summary',
  requireAuth,
  requireRole(['admin', 'super_admin', 'accountant']),
  [query('month').matches(/^\d{4}-\d{2}$/).withMessage('Month must be YYYY-MM')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }

      const { month } = req.query;
      const [year, mon] = month.split('-').map(Number);
      const start = new Date(Date.UTC(year, mon - 1, 1));
      const end = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));

      const [confirmedAgg, pendingCount, failedCount, propertyBreakdown] = await Promise.all([
        Payment.aggregate([
          { $match: { status: 'confirmed', created_at: { $gte: start, $lte: end } } },
          { $group: { _id: null, total: { $sum: '$amount_kes' }, count: { $sum: 1 } } }
        ]),
        Payment.countDocuments({ status: 'pending', created_at: { $gte: start, $lte: end } }),
        Payment.countDocuments({ status: 'failed', created_at: { $gte: start, $lte: end } }),
        Payment.aggregate([
          { $match: { status: 'confirmed', created_at: { $gte: start, $lte: end } } },
          { $group: { _id: '$property_id', total: { $sum: '$amount_kes' }, count: { $sum: 1 } } },
          { $lookup: { from: 'properties', localField: '_id', foreignField: '_id', as: 'prop' } },
          { $unwind: '$prop' },
          { $project: { name: '$prop.name', code: '$prop.property_code', total: 1, count: 1 } },
          { $sort: { total: -1 } },
          { $limit: 10 }
        ])
      ]);

      res.json({
        success: true,
        data: {
          month,
          confirmedRevenue: confirmedAgg[0]?.total || 0,
          confirmedCount: confirmedAgg[0]?.count || 0,
          pendingCount,
          failedCount,
          topProperties: propertyBreakdown
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
