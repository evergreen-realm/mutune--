const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { computeKRATaxSummary, generateETIMSReportCSV, generateITMRI01ReportCSV } = require('../services/etimsTax');
const { submitETIMSInvoice } = require('../services/kraEtims');
const Payment = require('../models/Payment');
const logger = require('../utils/logger');

/**
 * @openapi
 * /tax/etims/summary:
 *   get:
 *     summary: Fetch KRA eTIMS tax summary & monthly collection metrics
 *     tags: [Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           example: "2026-08"
 *     responses:
 *       200:
 *         description: Monthly tax computation and withholding tax summary
 */
router.get('/etims/summary',
  requireAuth,
  requireRole(['admin', 'super_admin', 'landlord', 'accountant']),
  async (req, res, next) => {
    try {
      const month = req.query.month || new Date().toISOString().slice(0, 7);
      const summary = await computeKRATaxSummary(month);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /tax/etims/export-csv:
 *   get:
 *     summary: Download KRA eTIMS tax reconciliation CSV
 *     tags: [Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file download
 */
router.get('/etims/export-csv',
  requireAuth,
  requireRole(['admin', 'super_admin', 'accountant']),
  async (req, res, next) => {
    try {
      const month = req.query.month || new Date().toISOString().slice(0, 7);
      const summary = await computeKRATaxSummary(month);
      const payments = await Payment.find({ status: { $in: ['completed', 'confirmed'] } }).limit(500).lean();
      const csvContent = generateETIMSReportCSV(summary, payments);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="KRA_eTIMS_Report_${month}.csv"`);
      res.send(csvContent);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /tax/etims/mri-return:
 *   get:
 *     summary: Download official KRA IT-MRI-01 monthly rental income return CSV
 *     tags: [Tax]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: KRA IT-MRI-01 CSV return file
 */
router.get('/etims/mri-return',
  requireAuth,
  requireRole(['admin', 'super_admin', 'accountant', 'landlord']),
  async (req, res, next) => {
    try {
      const month = req.query.month || new Date().toISOString().slice(0, 7);
      const csvContent = await generateITMRI01ReportCSV(month);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="KRA_IT-MRI-01_Return_${month}.csv"`);
      res.send('\uFEFF' + csvContent); // UTF-8 BOM for Excel compatibility
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /tax/etims/submit-invoice:
 *   post:
 *     summary: Transmit electronic invoice to KRA eTIMS gateway
 *     tags: [Tax]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: eTIMS fiscal invoice confirmation
 */
router.post('/etims/submit-invoice',
  requireAuth,
  requireRole(['admin', 'super_admin', 'accountant']),
  async (req, res, next) => {
    try {
      const result = await submitETIMSInvoice(req.body);
      res.json({ success: true, message: 'Invoice submitted to KRA eTIMS', data: result });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
