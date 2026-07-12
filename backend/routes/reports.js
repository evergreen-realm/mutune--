const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
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

/**
 * GET /api/v1/reports/income-statement?month=YYYY-MM
 * Returns a structured income statement for the given month.
 * Revenue is aggregated from confirmed payments.
 * Expenses are not yet tracked — returns empty array with a note.
 */
router.get('/income-statement',
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
      const end   = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999));

      const COMMERCIAL_WHT_RATE   = 0.10;
      const RESIDENTIAL_MRI_RATE  = 0.075;

      // Aggregate confirmed payments broken down by property type
      const revenueAgg = await Payment.aggregate([
        { $match: { status: 'confirmed', created_at: { $gte: start, $lte: end } } },
        {
          $lookup: {
            from: 'properties',
            localField: 'property_id',
            foreignField: '_id',
            as: 'prop'
          }
        },
        { $unwind: { path: '$prop', preserveNullAndEmpty: true } },
        {
          $group: {
            _id: { type: { $ifNull: ['$prop.type', 'unknown'] } },
            total: { $sum: '$amount_kes' },
            count: { $sum: 1 }
          }
        },
        { $sort: { total: -1 } }
      ]);

      // Compute tax per type
      let totalMRI = 0;
      let totalWHT = 0;
      const revenueBreakdown = revenueAgg.map(row => {
        const type  = row._id.type;
        const isCommercial = type === 'commercial';
        const taxRate = isCommercial ? COMMERCIAL_WHT_RATE : RESIDENTIAL_MRI_RATE;
        const taxAmount = Math.round(row.total * taxRate);
        if (isCommercial) totalWHT += taxAmount;
        else totalMRI += taxAmount;
        return {
          property_type: type,
          gross_kes: row.total,
          count: row.count,
          tax_rate: taxRate,
          tax_kes: taxAmount,
          net_kes: row.total - taxAmount
        };
      });

      const totalRevenue = revenueBreakdown.reduce((s, r) => s + r.gross_kes, 0);

      // Aggregate expenses by category
      const expenseAgg = await Expense.aggregate([
        { $match: { payment_date: { $gte: start, $lte: end }, status: 'paid' } },
        {
          $group: {
            _id: '$category',
            total: { $sum: '$amount_kes' },
            count: { $sum: 1 }
          }
        },
        { $sort: { total: -1 } }
      ]);

      const totalExpenses = expenseAgg.reduce((s, r) => s + r.total, 0);
      const expenseBreakdown = expenseAgg.map(row => ({
        category: row._id,
        amount_kes: row.total,
        count: row.count
      }));

      logger.info('Income statement generated', { month, totalRevenue, totalExpenses, generatedBy: req.user._id });

      res.json({
        success: true,
        data: {
          month,
          revenue: {
            total: totalRevenue,
            breakdown: revenueBreakdown
          },
          expenses: {
            total: totalExpenses,
            breakdown: expenseBreakdown
          },
          netIncome: totalRevenue - totalExpenses,
          taxLiability: {
            mri: totalMRI,
            wht: totalWHT
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

