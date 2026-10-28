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
      const landlordId = req.user.role === 'landlord' ? req.user._id : (req.query.landlord_id || null);
      const summary = await computeKRATaxSummary(month, landlordId);
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
  requireRole(['admin', 'super_admin', 'accountant', 'landlord']),
  async (req, res, next) => {
    try {
      const month = req.query.month || new Date().toISOString().slice(0, 7);
      const landlordId = req.user.role === 'landlord' ? req.user._id : (req.query.landlord_id || null);
      const summary = await computeKRATaxSummary(month, landlordId);

      const paymentFilter = { status: { $in: ['completed', 'confirmed'] } };
      if (landlordId) {
        const Property = require('../models/Property');
        const landlordProps = await Property.find({ landlord_id: landlordId }).select('_id').lean();
        paymentFilter.property_id = { $in: landlordProps.map(p => p._id) };
      }

      const payments = await Payment.find(paymentFilter).limit(500).lean();
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
      const landlordId = req.user.role === 'landlord' ? req.user._id : (req.query.landlord_id || null);
      const csvContent = await generateITMRI01ReportCSV(month, landlordId);

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

/**
 * @openapi
 * /tax/etims/invoices:
 *   get:
 *     summary: List persisted KRA eTIMS invoices with transmission and audit records
 *     tags: [Tax]
 *     security:
 *       - bearerAuth: []
 */
router.get('/etims/invoices',
  requireAuth,
  requireRole(['admin', 'super_admin', 'accountant', 'landlord']),
  async (req, res, next) => {
    try {
      const EtimsInvoice = require('../models/EtimsInvoice');
      const { page = 1, limit = 20, status, tax_type, search } = req.query;
      const filter = {};

      if (req.user.role === 'landlord') {
        filter.landlord_id = req.user._id;
      }
      if (status) {
        filter.transmission_status = status;
      }
      if (tax_type) {
        filter.tax_type = tax_type;
      }
      if (search) {
        filter.$or = [
          { invoice_number: { $regex: search, $options: 'i' } },
          { control_number: { $regex: search, $options: 'i' } },
          { customer_name: { $regex: search, $options: 'i' } }
        ];
      }

      const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
      const take = Math.min(100, Math.max(1, parseInt(limit, 10)));

      const [invoices, total] = await Promise.all([
        EtimsInvoice.find(filter)
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(take)
          .populate('property_id', 'name property_code address')
          .populate('tenant_id', 'full_name tenant_code')
          .lean(),
        EtimsInvoice.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: invoices,
        pagination: {
          page: parseInt(page, 10),
          limit: take,
          total,
          pages: Math.ceil(total / take)
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /tax/etims/invoices/{id}:
 *   get:
 *     summary: Retrieve single eTIMS invoice details
 *     tags: [Tax]
 */
router.get('/etims/invoices/:id',
  requireAuth,
  requireRole(['admin', 'super_admin', 'accountant', 'landlord']),
  async (req, res, next) => {
    try {
      const EtimsInvoice = require('../models/EtimsInvoice');
      const invoice = await EtimsInvoice.findById(req.params.id)
        .populate('property_id', 'name property_code address')
        .populate('tenant_id', 'full_name tenant_code')
        .lean();

      if (!invoice) {
        return res.status(404).json({ success: false, error: { message: 'Invoice not found' } });
      }

      if (req.user.role === 'landlord' && invoice.landlord_id?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: { message: 'Unauthorized access to invoice' } });
      }

      res.json({ success: true, data: invoice });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /tax/etims/invoices/{id}/retry:
 *   post:
 *     summary: Retry a failed eTIMS invoice transmission
 *     tags: [Tax]
 */
router.post('/etims/invoices/:id/retry',
  requireAuth,
  requireRole(['admin', 'super_admin', 'accountant']),
  async (req, res, next) => {
    try {
      const { retryETIMSInvoice } = require('../services/kraEtims');
      const result = await retryETIMSInvoice(req.params.id);
      res.json({ success: true, message: 'Invoice transmission retried', data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /tax/etims/generate-from-payment/{paymentId}:
 *   post:
 *     summary: Generate and transmit official KRA eTIMS invoice for a confirmed payment
 *     tags: [Tax]
 */
router.post('/etims/generate-from-payment/:paymentId',
  requireAuth,
  requireRole(['admin', 'super_admin', 'accountant']),
  async (req, res, next) => {
    try {
      const { generateETIMSInvoiceForPayment } = require('../services/kraEtims');
      const result = await generateETIMSInvoiceForPayment(req.params.paymentId);
      res.json({ success: true, message: 'eTIMS invoice created from payment', data: result });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

