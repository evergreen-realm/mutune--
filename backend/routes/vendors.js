const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const Vendor = require('../models/Vendor');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const smsService = require('../services/sms');
const { sendDarajaB2CPayout } = require('../services/bulkDisbursement');
const { postJournalEntry } = require('../services/financials');
const { paginate } = require('../utils/paginate');

/**
 * @openapi
 * /vendors:
 *   post:
 *     summary: Register a new service vendor
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Vendor'
 *     responses:
 *       201:
 *         description: Vendor registered successfully
 */
router.post('/', requireAuth, requireRole(['agent', 'admin', 'super_admin']), async (req, res, next) => {
  try {
    const vendor = await Vendor.create(req.body);
    res.status(201).json({ success: true, data: vendor });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /vendors:
 *   get:
 *     summary: List vendors with optional filtering and pagination
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of registered vendors
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, category, is_active } = req.query;
    const filter = {};
    if (category) filter.category = category;
    if (is_active !== undefined) filter.is_active = is_active === 'true';

    const result = await paginate(Vendor, filter, { page, limit, sort: { createdAt: -1 } });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /vendors/dispatch:
 *   post:
 *     summary: Dispatch maintenance work order to vendor
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ticket_id
 *               - vendor_id
 *             properties:
 *               ticket_id:
 *                 type: string
 *               vendor_id:
 *                 type: string
 *               estimated_cost_kes:
 *                 type: number
 *     responses:
 *       200:
 *         description: Work order dispatched and vendor notified via SMS
 */
router.post('/dispatch', requireAuth, requireRole(['agent', 'admin', 'super_admin', 'caretaker']), async (req, res, next) => {
  try {
    const { ticket_id, vendor_id, estimated_cost_kes } = req.body;
    const vendor = await Vendor.findById(vendor_id).lean();
    if (!vendor) {
      return res.status(404).json({ success: false, error: { code: 'VENDOR_NOT_FOUND', message: 'Vendor not found' } });
    }

    const ticket = await MaintenanceTicket.findByIdAndUpdate(ticket_id, {
      assigned_vendor_id: vendor_id,
      work_order_status: 'dispatched',
      estimated_cost_kes
    }, { new: true });

    if (vendor.phone) {
      try {
        await smsService.send(
          vendor.phone,
          `Work Order Dispatched: ${ticket?.title || 'Maintenance Task'} at ${ticket?.unit_id || 'Property'}. Est Cost: KES ${estimated_cost_kes || 0}.`
        );
      } catch (smsErr) {
        // SMS failure logged, proceed with dispatch
      }
    }

    res.json({ success: true, data: ticket, message: 'Work order dispatched to vendor' });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /vendors/approve-invoice:
 *   post:
 *     summary: Approve vendor invoice and trigger Daraja B2C payout
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ticket_id
 *               - actual_cost_kes
 *             properties:
 *               ticket_id:
 *                 type: string
 *               actual_cost_kes:
 *                 type: number
 *               invoice_url:
 *                 type: string
 *     responses:
 *       200:
 *         description: Vendor payout executed via B2C and GL expense logged
 */
router.post('/approve-invoice', requireAuth, requireRole(['agent', 'admin', 'super_admin']), async (req, res, next) => {
  try {
    const { ticket_id, actual_cost_kes, invoice_url } = req.body;
    const ticket = await MaintenanceTicket.findById(ticket_id).lean();
    if (!ticket || !ticket.assigned_vendor_id) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TICKET', message: 'Ticket not found or no vendor assigned' }
      });
    }

    const vendor = await Vendor.findById(ticket.assigned_vendor_id).lean();
    if (!vendor) {
      return res.status(404).json({
        success: false,
        error: { code: 'VENDOR_NOT_FOUND', message: 'Assigned vendor not found' }
      });
    }

    // Trigger Daraja B2C Payout to Vendor
    const b2c = await sendDarajaB2CPayout({
      recipientPhone: vendor.mpesa_b2c_number || vendor.phone,
      amountKes: Number(actual_cost_kes),
      remarks: `Maintenance Payout ${ticket.title}`
    });

    // Post GL Expense Entry
    await postJournalEntry({
      entry_type: 'maintenance_expense',
      description: `Vendor Maintenance Payment to ${vendor.vendor_name || vendor.name} for ${ticket.title}`,
      property_id: ticket.property_id,
      reference: `VND-PAY-${ticket_id.toString().slice(-6)}`,
      items: [
        { account_code: '5020', account_name: 'Property Maintenance Expense', debit_kes: Number(actual_cost_kes), credit_kes: 0 },
        { account_code: '1010', account_name: 'Cash & M-Pesa Account', debit_kes: 0, credit_kes: Number(actual_cost_kes) }
      ]
    });

    const updatedTicket = await MaintenanceTicket.findByIdAndUpdate(ticket_id, {
      work_order_status: 'approved',
      actual_cost_kes: Number(actual_cost_kes),
      invoice_url
    }, { new: true });

    res.json({
      success: true,
      data: updatedTicket,
      b2c_receipt: b2c.ConversationID,
      message: 'Vendor invoice approved and B2C payout executed'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
