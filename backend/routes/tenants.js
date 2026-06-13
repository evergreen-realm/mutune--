const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/rbac');
const Tenant = require('../models/Tenant');
const User   = require('../models/User');
const Property = require('../models/Property');
const logger = require('../utils/logger');

// ─── Helper ────────────────────────────────────────────────────────────────
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    return false;
  }
  return true;
};

// ─── GET /tenants ─────────────────────────────────────────────────────────────
router.get('/', requireAuth, requirePermission('view:assigned'), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, property_id, status, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};

    // Scope to assigned properties for agents
    if (req.user.role === 'agent') {
      const assignedIds = req.user.assigned_property_ids || [];
      filter.current_property_id = { $in: assignedIds };
      if (property_id) {
        const isAssigned = assignedIds.some(id => id.toString() === property_id);
        if (!isAssigned) {
          return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Property not assigned' } });
        }
        filter.current_property_id = property_id;
      }
    } else if (['admin', 'super_admin', 'accountant'].includes(req.user.role)) {
      if (property_id) filter.current_property_id = property_id;
    } else if (req.user.role === 'landlord') {
      const ownedProps = await Property.find({ landlord_id: req.user._id }).select('_id').lean();
      filter.current_property_id = { $in: ownedProps.map(p => p._id) };
    }

    if (status) filter.tenancy_status = status;
    if (search) {
      filter.$or = [
        { full_name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { id_number: { $regex: search, $options: 'i' } },
        { tenant_code: { $regex: search, $options: 'i' } }
      ];
    }

    const [tenants, total] = await Promise.all([
      Tenant.find(filter)
        .populate('current_property_id', 'name property_code address')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Tenant.countDocuments(filter)
    ]);

    logger.info('Tenants fetched', { userId: req.user._id, count: tenants.length });
    res.json({
      success: true,
      data: tenants,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /tenants/:id ────────────────────────────────────────────────────────
router.get('/:id',
  requireAuth,
  requirePermission('view:assigned'),
  [param('id').isMongoId().withMessage('Invalid tenant ID')],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const tenant = await Tenant.findById(req.params.id)
        .populate('current_property_id', 'name property_code address units')
        .lean();

      if (!tenant) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
      }

      // Agent scope: can only view tenants in assigned properties
      if (req.user.role === 'agent') {
        const isAssigned = req.user.assigned_property_ids?.some(
          id => id.toString() === tenant.current_property_id?._id?.toString()
        );
        if (!isAssigned) {
          return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Tenant not in assigned properties' } });
        }
      }

      // Landlord scope: can only view tenants in owned properties
      if (req.user.role === 'landlord') {
        const isOwned = await Property.exists({
          _id: tenant.current_property_id?._id || tenant.current_property_id,
          landlord_id: req.user._id
        });
        if (!isOwned) {
          return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Tenant not in owned properties' } });
        }
      }

      res.json({ success: true, data: tenant });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /tenants ────────────────────────────────────────────────────────────
router.post('/',
  requireAuth,
  requireRole(['admin', 'super_admin', 'agent']),
  [
    body('full_name').trim().notEmpty().withMessage('Full name required'),
    body('id_number').trim().notEmpty().withMessage('National ID required'),
    body('phone').trim().matches(/^254\d{9}$/).withMessage('Phone must be 254XXXXXXXXX format'),
    body('current_property_id').isMongoId().withMessage('Valid property ID required'),
    body('current_unit_id').notEmpty().withMessage('Unit ID required'),
    body('rent_amount_kes').isInt({ min: 1 }).withMessage('Rent must be a positive integer'),
    body('lease_start').isISO8601().withMessage('Valid lease start date required'),
    body('lease_end').isISO8601().withMessage('Valid lease end date required'),
    body('user_id').optional().isMongoId().withMessage('user_id must be a valid Mongo ID')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      // Verify property exists
      const property = await Property.findById(req.body.current_property_id).lean();
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }

      // Agent scope: can only add tenants to assigned properties
      if (req.user.role === 'agent') {
        const isAssigned = req.user.assigned_property_ids?.some(
          id => id.toString() === req.body.current_property_id
        );
        if (!isAssigned) {
          return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Cannot add tenant to unassigned property' } });
        }
      }

      // Check for duplicate ID number
      const duplicate = await Tenant.findOne({ id_number: req.body.id_number });
      if (duplicate) {
        return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Tenant with this ID number already exists' } });
      }

      // If user_id provided, validate user exists and has tenant role
      if (req.body.user_id) {
        const linkedUser = await User.findById(req.body.user_id).lean();
        if (!linkedUser) {
          return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Linked user not found' } });
        }
        // Check not already linked
        const alreadyLinked = await Tenant.findOne({ user_id: req.body.user_id });
        if (alreadyLinked) {
          return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'This user is already linked to a tenant record' } });
        }
      }

      // Auto-generate tenant code
      const count = await Tenant.countDocuments();
      const tenantCode = `TNT-MOM-${String(count + 1).padStart(4, '0')}`;

      const createPayload = {
        ...req.body,
        tenant_code: tenantCode,
        tenancy_status: 'active'
      };
      if (!req.body.user_id) delete createPayload.user_id;

      const tenant = await Tenant.create(createPayload);

      // If user_id provided, update that user's role to 'tenant' and link property
      if (req.body.user_id) {
        await User.findByIdAndUpdate(req.body.user_id, {
          $set: {
            role: 'tenant',
            current_property_id: req.body.current_property_id,
            current_unit_id: req.body.current_unit_id
          }
        });
        // Attempt to update Clerk metadata
        try {
          const linkedUser = await User.findById(req.body.user_id).lean();
          if (linkedUser?.clerk_id) {
            const { clerkClient } = require('@clerk/clerk-sdk-node');
            await clerkClient.users.updateUserMetadata(linkedUser.clerk_id, {
              publicMetadata: { role: 'tenant' }
            });
          }
        } catch (clerkErr) {
          logger.warn('Could not update Clerk metadata for linked tenant', { message: clerkErr.message });
        }
      }

      // Mark unit as occupied
      await Property.updateOne(
        { _id: req.body.current_property_id, 'units._id': req.body.current_unit_id },
        { $set: { 'units.$.status': 'occupied' } }
      );

      logger.info('Tenant created', { tenantId: tenant._id, tenantCode, by: req.user._id });
      res.status(201).json({ success: true, data: tenant });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /tenants/:id/link-user ─────────────────────────────────────────────
// Link an existing Clerk-registered User to a Tenant record (admin only)
router.post('/:id/link-user',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('id').isMongoId().withMessage('Invalid tenant ID'),
    body('user_id').isMongoId().withMessage('Valid user_id required')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const tenant = await Tenant.findById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
      }

      const user = await User.findById(req.body.user_id).lean();
      if (!user) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      }

      // Prevent double-linking
      const alreadyLinked = await Tenant.findOne({ user_id: req.body.user_id, _id: { $ne: tenant._id } });
      if (alreadyLinked) {
        return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'User is already linked to another tenant record' } });
      }

      tenant.user_id = req.body.user_id;
      await tenant.save();

      // Update the user role + property assignment
      await User.findByIdAndUpdate(req.body.user_id, {
        $set: {
          role: 'tenant',
          current_property_id: tenant.current_property_id,
          current_unit_id: tenant.current_unit_id
        }
      });

      // Update Clerk metadata
      try {
        if (user.clerk_id) {
          const { clerkClient } = require('@clerk/clerk-sdk-node');
          await clerkClient.users.updateUserMetadata(user.clerk_id, {
            publicMetadata: { role: 'tenant' }
          });
          logger.info('Clerk metadata updated for linked tenant', { clerkId: user.clerk_id });
        }
      } catch (clerkErr) {
        logger.warn('Could not update Clerk metadata for linked tenant', { message: clerkErr.message });
      }

      logger.info('User linked to tenant', { tenantId: tenant._id, userId: req.body.user_id, by: req.user._id });
      res.json({ success: true, message: 'User successfully linked to tenant', data: tenant });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PATCH /tenants/:id ───────────────────────────────────────────────────────
router.patch('/:id',
  requireAuth,
  requireRole(['admin', 'super_admin', 'agent']),
  [param('id').isMongoId()]
  ,
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const allowedFields = ['full_name', 'phone', 'email', 'emergency_contact', 'rent_amount_kes',
        'lease_end', 'tenancy_status', 'notes', 'guarantor'];
      const update = {};
      allowedFields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

      const tenant = await Tenant.findByIdAndUpdate(
        req.params.id,
        { $set: { ...update, updated_at: new Date() } },
        { new: true, runValidators: true }
      ).populate('current_property_id', 'name property_code');

      if (!tenant) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
      }

      logger.info('Tenant updated', { tenantId: tenant._id, by: req.user._id });
      res.json({ success: true, data: tenant });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /tenants/:id/terminate ──────────────────────────────────────────────
router.post('/:id/terminate',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('id').isMongoId(),
    body('reason').trim().notEmpty().withMessage('Termination reason required'),
    body('vacate_date').isISO8601().withMessage('Valid vacate date required')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const tenant = await Tenant.findById(req.params.id);
      if (!tenant) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
      }

      const previousPropertyId = tenant.current_property_id;
      const previousUnitId = tenant.current_unit_id;

      tenant.tenancy_status = 'terminated';
      tenant.lease_end = new Date(req.body.vacate_date);
      tenant.notes = `${tenant.notes || ''}\n[TERMINATED ${new Date().toISOString()}] Reason: ${req.body.reason}`.trim();
      await tenant.save();

      // Mark unit as vacant
      if (previousPropertyId && previousUnitId) {
        await Property.updateOne(
          { _id: previousPropertyId, 'units._id': previousUnitId },
          { $set: { 'units.$.status': 'vacant', 'units.$.lock_status': 'unlocked' } }
        );
      }

      logger.info('Tenancy terminated', { tenantId: tenant._id, by: req.user._id, reason: req.body.reason });
      res.json({ success: true, message: 'Tenancy terminated and unit marked vacant', data: tenant });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /tenants/:id/payment-history ─────────────────────────────────────────
router.get('/:id/payment-history',
  requireAuth,
  requirePermission('view:payments'),
  [param('id').isMongoId()],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const tenant = await Tenant.findById(req.params.id).select('payment_history full_name tenant_code').lean();
      if (!tenant) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant not found' } });
      }
      res.json({ success: true, data: tenant.payment_history || [], tenant: { name: tenant.full_name, code: tenant.tenant_code } });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /tenants/my/payments — Tenant portal self-service ───────────────────
router.get('/my/payments', requireAuth, requirePermission('view:payments'), async (req, res, next) => {
  try {
    const Payment = require('../models/Payment');
    const payments = await Payment.find({ tenant_id: req.user._id })
      .populate('property_id', 'name property_code')
      .sort({ created_at: -1 })
      .lean();
    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
});

// ─── GET /tenants/my/notices — Tenant self-service notices ───────────────────
router.get('/my/notices', requireAuth, requirePermission('view:notices'), async (req, res, next) => {
  try {
    const Notice = require('../models/Notice');
    const notices = await Notice.find({ tenant_id: req.user._id })
      .populate('property_id', 'name property_code')
      .sort({ created_at: -1 })
      .lean();
    res.json({ success: true, data: notices });
  } catch (error) {
    next(error);
  }
});

// ─── GET /tenants/my/profile — Tenant's own lease details ────────────────────
router.get('/my/profile', requireAuth, requirePermission('view:own_unit'), async (req, res, next) => {
  try {
    const tenant = await Tenant.findOne({ user_id: req.user._id })
      .populate('current_property_id', 'name property_code address')
      .lean();
    if (!tenant) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Tenant profile not found' } });
    }
    res.json({ success: true, data: tenant });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
