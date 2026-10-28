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
const logger = require('../utils/logger');

/**
 * @openapi
 * /vendors:
 *   post:
 *     summary: Register a new service vendor
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
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
 * /vendors/{id}:
 *   get:
 *     summary: Get single vendor profile and their assigned tickets
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id).lean();
    if (!vendor) {
      return res.status(404).json({ success: false, error: { code: 'VENDOR_NOT_FOUND', message: 'Vendor not found' } });
    }

    const assignedTickets = await MaintenanceTicket.find({ assigned_vendor_id: vendor._id })
      .select('ticket_code title status work_order_status priority estimated_cost_kes actual_cost_kes created_at')
      .sort({ created_at: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, data: { ...vendor, tickets: assignedTickets } });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /vendors/{id}:
 *   put:
 *     summary: Update vendor details
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', requireAuth, requireRole(['agent', 'admin', 'super_admin']), async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!vendor) {
      return res.status(404).json({ success: false, error: { code: 'VENDOR_NOT_FOUND', message: 'Vendor not found' } });
    }
    res.json({ success: true, data: vendor });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /vendors/{id}:
 *   delete:
 *     summary: Delete vendor
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', requireAuth, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) {
      return res.status(404).json({ success: false, error: { code: 'VENDOR_NOT_FOUND', message: 'Vendor not found' } });
    }
    res.json({ success: true, message: 'Vendor deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /vendors/{id}/assign-ticket:
 *   post:
 *     summary: Assign a maintenance ticket to a vendor (sets status to 'assigned')
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/assign-ticket', requireAuth, requireRole(['agent', 'admin', 'super_admin', 'caretaker']), async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id).lean();
    if (!vendor) {
      return res.status(404).json({ success: false, error: { code: 'VENDOR_NOT_FOUND', message: 'Vendor not found' } });
    }

    const { ticket_id, estimated_cost_kes, notes } = req.body;
    if (!ticket_id) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'ticket_id is required' } });
    }

    const ticket = await MaintenanceTicket.findByIdAndUpdate(ticket_id, {
      assigned_vendor_id: vendor._id,
      work_order_status: 'assigned',
      status: 'assigned',
      estimated_cost_kes: estimated_cost_kes ? Number(estimated_cost_kes) : undefined,
      agent_notes: notes || undefined
    }, { new: true });

    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } });
    }

    if (vendor.phone) {
      try {
        await smsService.send(
          vendor.phone,
          `Work Order Assigned: ${ticket.title || ticket.ticket_code}. Est Cost: KES ${estimated_cost_kes || 0}. Mutune Management.`
        );
      } catch (smsErr) {
        logger.warn('Failed to send vendor assignment SMS', { error: smsErr.message });
      }
    }

    res.json({ success: true, data: ticket, message: 'Ticket assigned to vendor' });
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
      status: 'assigned',
      estimated_cost_kes: estimated_cost_kes ? Number(estimated_cost_kes) : undefined
    }, { new: true });

    if (vendor.phone) {
      try {
        await smsService.send(
          vendor.phone,
          `Work Order Dispatched: ${ticket?.title || 'Maintenance Task'} at ${ticket?.unit_id || 'Property'}. Est Cost: KES ${estimated_cost_kes || 0}.`
        );
      } catch (smsErr) {
        logger.warn('SMS dispatch error', { error: smsErr.message });
      }
    }

    res.json({ success: true, data: ticket, message: 'Work order dispatched to vendor' });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /vendors/tickets/{ticketId}/status:
 *   patch:
 *     summary: Transition work order status ('assigned' -> 'in_progress' -> 'completed')
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 */
router.patch('/tickets/:ticketId/status', requireAuth, requireRole(['agent', 'admin', 'super_admin', 'caretaker']), async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ['assigned', 'dispatched', 'in_progress', 'completed', 'approved', 'rejected'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATUS', message: `Status must be one of: ${validStatuses.join(', ')}` }
      });
    }

    const ticket = await MaintenanceTicket.findById(req.params.ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } });
    }

    ticket.work_order_status = status;
    if (status === 'in_progress') {
      ticket.status = 'in_progress';
    } else if (status === 'completed' || status === 'approved') {
      ticket.status = 'resolved';
      ticket.resolved_at = new Date();
    }
    if (notes) {
      ticket.agent_notes = `${ticket.agent_notes || ''}\n[Status Update: ${status}] ${notes}`.trim();
    }

    await ticket.save();
    res.json({ success: true, data: ticket, message: `Work order status updated to ${status}` });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /vendors/tickets/{ticketId}/complete-work-order:
 *   post:
 *     summary: Complete vendor work order and post double-entry expense to the GL ledger
 *     tags: [Vendors]
 *     security:
 *       - bearerAuth: []
 */
router.post('/tickets/:ticketId/complete-work-order', requireAuth, requireRole(['agent', 'admin', 'super_admin']), async (req, res, next) => {
  try {
    const { actual_cost_kes, invoice_url, notes } = req.body;
    const ticket = await MaintenanceTicket.findById(req.params.ticketId);
    if (!ticket) {
      return res.status(404).json({ success: false, error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' } });
    }

    const actualCost = Number(actual_cost_kes !== undefined ? actual_cost_kes : (ticket.actual_cost_kes || ticket.estimated_cost_kes || 0));

    ticket.work_order_status = 'completed';
    ticket.status = 'resolved';
    ticket.actual_cost_kes = actualCost;
    if (invoice_url) ticket.invoice_url = invoice_url;
    ticket.resolved_at = new Date();
    if (notes) {
      ticket.agent_notes = `${ticket.agent_notes || ''}\n[Completed] ${notes}`.trim();
    }

    await ticket.save();

    let journalEntry = null;
    if (actualCost > 0) {
      let vendorName = 'Vendor';
      if (ticket.assigned_vendor_id) {
        const v = await Vendor.findById(ticket.assigned_vendor_id).lean();
        if (v) vendorName = v.vendor_name || v.name || 'Vendor';
      }

      // Post Double-Entry GL Expense:
      // Debit Account 5020 (Property Maintenance Expense)
      // Credit Account 2020 (Accounts Payable - Vendors)
      try {
        journalEntry = await postJournalEntry({
          reference_type: 'expense',
          reference_id: ticket._id,
          property_id: ticket.property_id,
          line_items: [
            {
              account_code: '5020',
              account_name: 'Property Maintenance Expense',
              debit_kes: actualCost,
              credit_kes: 0,
              description: `Completed Work Order - ${ticket.ticket_code}: ${ticket.title}`
            },
            {
              account_code: '2020',
              account_name: 'Accounts Payable - Vendors',
              debit_kes: 0,
              credit_kes: actualCost,
              description: `Payable to ${vendorName} for ${ticket.ticket_code}`
            }
          ],
          notes: `Vendor work order completed for ${ticket.ticket_code} by ${vendorName}`,
          posted_by_user_id: req.user?._id
        });
      } catch (glErr) {
        logger.error('Failed to post GL expense entry for completed work order', {
          ticketId: ticket._id,
          error: glErr.message
        });
      }
    }

    res.json({
      success: true,
      data: ticket,
      journal_entry: journalEntry,
      message: 'Work order marked completed and maintenance expense posted to GL ledger'
    });
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
 */
router.post('/approve-invoice', requireAuth, requireRole(['agent', 'admin', 'super_admin']), async (req, res, next) => {
  try {
    const { ticket_id, actual_cost_kes, invoice_url } = req.body;
    const ticket = await MaintenanceTicket.findById(ticket_id);
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

    const payoutAmount = Number(actual_cost_kes || ticket.actual_cost_kes || ticket.estimated_cost_kes || 0);

    // Trigger Daraja B2C Payout to Vendor
    const b2c = await sendDarajaB2CPayout({
      recipientPhone: vendor.mpesa_b2c_number || vendor.phone,
      amountKes: payoutAmount,
      remarks: `Maintenance Payout ${ticket.title || ticket.ticket_code}`
    });

    // Settle Accounts Payable in General Ledger:
    // Debit Account 2020 (Accounts Payable - Vendors)
    // Credit Account 1010 (Cash & M-Pesa Account)
    let journalEntry = null;
    try {
      journalEntry = await postJournalEntry({
        reference_type: 'expense',
        reference_id: ticket._id,
        property_id: ticket.property_id,
        line_items: [
          {
            account_code: '2020',
            account_name: 'Accounts Payable - Vendors',
            debit_kes: payoutAmount,
            credit_kes: 0,
            description: `Settlement of AP to ${vendor.vendor_name || 'Vendor'}`
          },
          {
            account_code: '1010',
            account_name: 'Cash & M-Pesa Account',
            debit_kes: 0,
            credit_kes: payoutAmount,
            description: `B2C Disbursement Receipt: ${b2c.ConversationID || 'N/A'}`
          }
        ],
        notes: `Vendor Maintenance Payout to ${vendor.vendor_name || vendor.name} for ${ticket.ticket_code}`,
        posted_by_user_id: req.user?._id
      });
    } catch (glErr) {
      logger.warn('Failed to post GL payout entry', { error: glErr.message });
    }

    ticket.work_order_status = 'approved';
    ticket.vendor_payout_status = 'paid';
    ticket.vendor_payout_ref = b2c.ConversationID;
    ticket.actual_cost_kes = payoutAmount;
    if (invoice_url) ticket.invoice_url = invoice_url;
    await ticket.save();

    res.json({
      success: true,
      data: ticket,
      b2c_receipt: b2c.ConversationID,
      journal_entry: journalEntry,
      message: 'Vendor invoice approved and B2C payout executed'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
