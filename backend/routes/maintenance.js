const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const logger = require('../utils/logger');

const MaintenanceTicket = require('../models/MaintenanceTicket');

// ─── Helper ──────────────────────────────────────────────────────────────────
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    return false;
  }
  return true;
};

// ─── POST /maintenance ────────────────────────────────────────────────────────
router.post('/',
  requireAuth,
  requirePermission('create:maintenance'),
  [
    body('property_id').isMongoId().withMessage('Valid property ID required'),
    body('unit_id').notEmpty().withMessage('Unit ID required'),
    body('category')
      .isIn(['plumbing', 'electrical', 'structural', 'security', 'appliance', 'pest_control', 'cleaning', 'other'])
      .withMessage('Invalid category'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'emergency']),
    body('description').trim().notEmpty().isLength({ max: 2000 }).withMessage('Description required (max 2000 chars)'),
    body('photos').optional().isArray()
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const { property_id, unit_id, category, priority = 'medium', description, photos = [] } = req.body;

      const count = await MaintenanceTicket.countDocuments();
      const ticketCode = `MT-${Date.now().toString(36).toUpperCase()}-${String(count + 1).padStart(3, '0')}`;

      const ticket = await MaintenanceTicket.create({
        ticket_code: ticketCode,
        property_id,
        unit_id,
        tenant_id: req.user._id,
        category,
        priority,
        description,
        photos: photos.slice(0, 5) // max 5 photos
      });

      logger.info('Maintenance ticket created', {
        ticketId: ticket._id,
        ticketCode,
        tenantId: req.user._id,
        category,
        priority
      });

      res.status(201).json({ success: true, data: ticket });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /maintenance/my-tickets ─────────────────────────────────────────────
router.get('/my-tickets',
  requireAuth,
  requirePermission('view:maintenance'),
  async (req, res, next) => {
    try {
      const tickets = await MaintenanceTicket.find({ tenant_id: req.user._id })
        .sort({ created_at: -1 })
        .lean();
      res.json({ success: true, data: tickets });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /maintenance — admin/agent view ─────────────────────────────────────
router.get('/',
  requireAuth,
  requirePermission('view:maintenance'),
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20, status, priority, property_id } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const filter = {};

      // Agents only see tickets for their assigned properties
      if (req.user.role === 'agent') {
        filter.property_id = { $in: req.user.assigned_property_ids || [] };
      } else if (req.user.role === 'tenant') {
        filter.tenant_id = req.user._id;
      }

      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (property_id && ['admin', 'super_admin', 'accountant'].includes(req.user.role)) {
        filter.property_id = property_id;
      }

      const [tickets, total] = await Promise.all([
        MaintenanceTicket.find(filter)
          .populate('tenant_id', 'full_name phone')
          .populate('property_id', 'name property_code')
          .sort({ priority: 1, created_at: -1 }) // emergency first
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        MaintenanceTicket.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: tickets,
        pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PATCH /maintenance/:id ───────────────────────────────────────────────────
router.patch('/:id',
  requireAuth,
  requirePermission('view:maintenance'),
  [param('id').isMongoId()],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const allowedFields = ['status', 'agent_notes', 'assigned_agent_id', 'tenant_satisfaction', 'photos'];
      const update = {};
      allowedFields.forEach((f) => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

      if (update.status === 'resolved') update.resolved_at = new Date();

      const ticket = await MaintenanceTicket.findByIdAndUpdate(
        req.params.id,
        { $set: { ...update, updated_at: new Date() } },
        { new: true, runValidators: true }
      );

      if (!ticket) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
      }

      logger.info('Maintenance ticket updated', { ticketId: ticket._id, status: ticket.status, by: req.user._id });
      res.json({ success: true, data: ticket });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /maintenance/:id — only open tickets by original tenant ───────────
router.delete('/:id',
  requireAuth,
  [param('id').isMongoId()],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const ticket = await MaintenanceTicket.findById(req.params.id);
      if (!ticket) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
      }

      const isOwner = ticket.tenant_id.toString() === req.user._id.toString();
      const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot delete others\' tickets' } });
      }

      if (!isAdmin && ticket.status !== 'open') {
        return res.status(400).json({
          success: false,
          error: { code: 'TICKET_IN_PROGRESS', message: 'Only open tickets can be cancelled by tenants' }
        });
      }

      await MaintenanceTicket.findByIdAndDelete(req.params.id);
      logger.info('Maintenance ticket deleted', { ticketId: req.params.id, by: req.user._id });
      res.json({ success: true, message: 'Ticket deleted' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
