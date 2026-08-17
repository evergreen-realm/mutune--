const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const logger = require('../utils/logger');
const { paginate } = require('../utils/paginate');

const MaintenanceTicket = require('../models/MaintenanceTicket');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Property = require('../models/Property');

// ─── Helper ──────────────────────────────────────────────────────────────────
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
 * /maintenance:
 *   post:
 *     summary: Create a maintenance request ticket
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MaintenanceTicket'
 *     responses:
 *       201:
 *         description: Ticket created successfully
 */
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

      if (req.user.role === 'caretaker') {
        const assigned = (req.user.assigned_properties || req.user.assigned_property_ids || []).map(id => id.toString());
        if (!assigned.includes(property_id.toString())) {
          return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot create ticket for unassigned property' } });
        }
      }

      const count = await MaintenanceTicket.countDocuments();
      const ticketCode = `MT-${Date.now().toString(36).toUpperCase()}-${String(count + 1).padStart(3, '0')}`;

      const tenant = await Tenant.findOne({ user_id: req.user._id }).select('_id').lean();
      const ticket = await MaintenanceTicket.create({
        ticket_code: ticketCode,
        property_id,
        unit_id,
        tenant_id: tenant ? tenant._id : undefined,
        created_by: req.user._id,
        category,
        priority,
        description,
        photos: photos.slice(0, 5) // max 5 photos
      });

      logger.info('Maintenance ticket created', {
        ticketId: ticket._id,
        ticketCode,
        tenantId: tenant ? tenant._id : undefined,
        category,
        priority
      });

      res.status(201).json({ success: true, data: ticket });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /maintenance/my-tickets:
 *   get:
 *     summary: Fetch maintenance tickets for logged-in tenant
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of tenant maintenance tickets
 */
router.get('/my-tickets',
  requireAuth,
  requirePermission('view:maintenance'),
  async (req, res, next) => {
    try {
      const tenant = await Tenant.findOne({ user_id: req.user._id }).select('_id').lean();
      const tenantId = tenant ? tenant._id : new (require('mongoose')).Types.ObjectId();
      const tickets = await MaintenanceTicket.find({ tenant_id: tenantId })
        .sort({ created_at: -1 })
        .lean();
      res.json({ success: true, data: tickets });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /maintenance:
 *   get:
 *     summary: List maintenance tickets with role-based filtering and pagination
 *     tags: [Maintenance]
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of maintenance tickets
 */
router.get('/',
  requireAuth,
  requirePermission('view:maintenance'),
  async (req, res, next) => {
    try {
      const { page = 1, limit = 20, status, priority, property_id } = req.query;
      const filter = {};

      if (req.user.role === 'caretaker') {
        const assigned = req.user.assigned_properties || req.user.assigned_property_ids || [];
        filter.property_id = { $in: assigned };
      } else if (req.user.role === 'agent') {
        filter.property_id = { $in: req.user.assigned_property_ids || [] };
      } else if (req.user.role === 'tenant') {
        const tenant = await Tenant.findOne({ user_id: req.user._id }).select('_id').lean();
        filter.tenant_id = tenant ? tenant._id : new (require('mongoose')).Types.ObjectId();
      } else if (req.user.role === 'landlord') {
        const ownedProps = await Property.find({ landlord_id: req.user._id }).select('_id').lean();
        filter.property_id = { $in: ownedProps.map(p => p._id) };
      }

      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (property_id) {
        if (req.user.role === 'caretaker') {
          const isAssigned = (req.user.assigned_properties || req.user.assigned_property_ids || []).some(id => id.toString() === property_id);
          if (!isAssigned) {
            return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Property not in caretaker assignments' } });
          }
          filter.property_id = property_id;
        } else if (req.user.role === 'agent') {
          const isAssigned = (req.user.assigned_property_ids || []).some(id => id.toString() === property_id);
          if (!isAssigned) {
            return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Property not assigned' } });
          }
          filter.property_id = property_id;
        } else if (req.user.role === 'landlord') {
          const isOwned = await Property.exists({ _id: property_id, landlord_id: req.user._id });
          if (!isOwned) {
            return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Property not owned' } });
          }
        }
        filter.property_id = property_id;
      }

      const result = await paginate(MaintenanceTicket, filter, {
        page,
        limit,
        sort: { priority: 1, created_at: -1 },
        populate: [
          { path: 'tenant_id', select: 'full_name phone' },
          { path: 'property_id', select: 'name property_code' }
        ]
      });

      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /maintenance/{id}:
 *   patch:
 *     summary: Update maintenance ticket status or details
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ticket updated successfully
 */
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

      const ticket = await MaintenanceTicket.findById(req.params.id);
      if (!ticket) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Ticket not found' } });
      }

      if (update.status === 'resolved') {
        update.resolved_at = new Date();
      }

      if (update.assigned_agent_id) {
        const agent = await User.findById(update.assigned_agent_id);
        if (!agent || agent.role !== 'agent') {
          return res.status(400).json({ success: false, error: { code: 'INVALID_AGENT', message: 'Assigned user is not an agent' } });
        }
        if (ticket.property_id) {
          const prop = await Property.findById(ticket.property_id).lean();
          if (prop) {
            const isAssignedProp = agent.assigned_property_ids?.some(id => id.toString() === prop._id.toString());
            const inAssignedArea = agent.assigned_areas?.some(area => prop.address?.area && area.toLowerCase() === prop.address.area.toLowerCase());
            if (!isAssignedProp && !inAssignedArea) {
              return res.status(400).json({ success: false, error: { code: 'AGENT_OUT_OF_REGION', message: 'Agent does not cover the property region' } });
            }
          }
        }
      }

      Object.assign(ticket, update);
      ticket.updated_at = new Date();
      await ticket.save();

      logger.info('Maintenance ticket updated', { ticketId: ticket._id, status: ticket.status, by: req.user._id });
      res.json({ success: true, data: ticket });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /maintenance/{id}:
 *   delete:
 *     summary: Cancel or delete maintenance ticket
 *     tags: [Maintenance]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ticket deleted
 */
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

      const tenant = await Tenant.findOne({ user_id: req.user._id }).select('_id').lean();
      const isOwner = tenant && ticket.tenant_id && ticket.tenant_id.toString() === tenant._id.toString();
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
