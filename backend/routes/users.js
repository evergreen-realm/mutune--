const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth, verifyClerkToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const logger = require('../utils/logger');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    return false;
  }
  return true;
};

// ─── GET /users/me ────────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    let user = await User.findById(req.user._id)
      .populate('assigned_property_ids', 'name property_code address')
      .lean();

    if (user && user.clerk_id) {
      try {
        const { clerkClient } = require('@clerk/clerk-sdk-node');
        const clerkUser = await clerkClient.users.getUser(user.clerk_id);
        const clerkRole = clerkUser?.publicMetadata?.role;
        if (clerkRole && user.role !== clerkRole) {
          logger.info('Role mismatch detected in /users/me, syncing from Clerk', { clerkId: user.clerk_id, dbRole: user.role, clerkRole });
          const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { $set: { role: clerkRole, updated_at: new Date() } },
            { new: true }
          )
            .populate('assigned_property_ids', 'name property_code address')
            .lean();
          user = updatedUser;
        }
      } catch (clerkErr) {
        logger.warn('Failed to fetch/sync Clerk user role in /users/me', { clerkId: user.clerk_id, message: clerkErr.message });
      }
    }

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});


// ─── PATCH /users/me/role ─────────────────────────────────────────────────────
router.patch('/me/role',
  requireAuth,
  [
    body('role').isIn(['agent', 'admin', 'landlord', 'tenant']).withMessage('Invalid role'),
    body('phone').optional().trim().notEmpty().withMessage('Phone cannot be empty'),
    body('earb_license').optional().trim().notEmpty().withMessage('EARB license cannot be empty'),
    body('earb_verification_doc_url').optional().trim().notEmpty().withMessage('EARB document link cannot be empty'),
    body('assigned_areas').optional().isArray().withMessage('Assigned areas must be an array'),
    body('property_id').optional().isMongoId().withMessage('property_id must be a valid Mongo ID'),
    body('unit_id').optional().notEmpty().withMessage('unit_id cannot be empty')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }

      const { role, phone, earb_license, earb_verification_doc_url, assigned_areas, property_id, unit_id } = req.body;
      const userId = req.user._id;

      const updateData = { role };
      if (phone !== undefined) updateData.phone = phone;
      if (earb_license !== undefined) updateData.earb_license = earb_license;
      if (assigned_areas !== undefined) updateData.assigned_areas = assigned_areas;

      if (role === 'agent') {
        updateData.is_active = false;
        updateData.agent_approval_status = 'pending';
        updateData.earb_verification_doc_url = earb_verification_doc_url || 'https://mutunerent.s3.amazonaws.com/placeholder-earb.pdf';
      } else {
        updateData.agent_approval_status = 'n_a';
      }

      // —— Tenant-specific: auto-create Tenant document and link to unit ——
      if (role === 'tenant') {
        const existingTenant = await Tenant.findOne({ user_id: userId }).lean();
        if (!existingTenant) {
          let assignedPropertyId = property_id || null;
          let assignedUnitId = unit_id || null;

          // If admin provided a specific unit, use it; otherwise find first vacant
          if (!assignedPropertyId || !assignedUnitId) {
            const vacantProperty = await Property.findOne({ 'units.status': 'vacant' }).lean();
            if (vacantProperty) {
              const vacantUnit = vacantProperty.units.find(u => u.status === 'vacant');
              if (vacantUnit) {
                assignedPropertyId = vacantProperty._id;
                assignedUnitId = vacantUnit._id;
              }
            }
          }

          // Verify the selected unit is actually vacant (prevent race condition)
          if (assignedPropertyId && assignedUnitId) {
            const prop = await Property.findById(assignedPropertyId).lean();
            const unit = prop?.units?.find(u => u._id.toString() === assignedUnitId.toString());
            if (unit && unit.status !== 'vacant') {
              return res.status(409).json({
                success: false,
                error: { code: 'UNIT_OCCUPIED', message: 'Selected unit is no longer vacant. Please choose another.' }
              });
            }
          }

          const tenantCount = await Tenant.countDocuments();
          const tenantCode = `TNT-MOM-${String(tenantCount + 1).padStart(4, '0')}`;

          await Tenant.create({
            tenant_code: tenantCode,
            user_id: userId,
            full_name: req.user.full_name,
            phone: phone || req.user.phone || '254700000000',
            email: req.user.email,
            id_number: req.body.id_number || '',
            current_property_id: assignedPropertyId || undefined,
            current_unit_id: assignedUnitId || undefined,
            lease_start: req.body.lease_start ? new Date(req.body.lease_start) : new Date(),
            lease_end: req.body.lease_end
              ? new Date(req.body.lease_end)
              : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            rent_amount_kes: req.body.rent_amount_kes || 0,
            tenancy_status: 'pending'
          });

          // Mark unit as occupied and link tenant
          if (assignedPropertyId && assignedUnitId) {
            await Property.updateOne(
              { _id: assignedPropertyId, 'units._id': assignedUnitId },
              { $set: { 'units.$.status': 'occupied' } }
            );
          }

          // Update User with property/unit links
          if (assignedPropertyId) updateData.current_property_id = assignedPropertyId;
          if (assignedUnitId) updateData.current_unit_id = assignedUnitId;

          logger.info('Tenant auto-created during onboarding', { userId, tenantCode, assignedPropertyId, assignedUnitId });
        }
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      ).select('-password_hash');

      if (role === 'agent') {
        try {
          const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } }).select('_id');
          const adminIds = admins.map(a => a._id);
          const Notification = require('../models/Notification');
          await Notification.create({
            type: 'agent_approval',
            recipient_role: 'admin',
            recipient_ids: adminIds,
            title: 'New Agent Pending Approval',
            message: `Agent ${updatedUser.full_name} (${updatedUser.email}) has registered with EARB ${earb_license || ''} and is pending verification.`,
            related_entity_id: updatedUser._id
          });
          logger.info('Admin notification created for pending agent', { agentId: updatedUser._id });
        } catch (notifErr) {
          logger.error('Failed to create admin notification for pending agent', { message: notifErr.message });
        }
      }

      // Update Clerk publicMetadata
      try {
        const { clerkClient } = require('@clerk/clerk-sdk-node');
        if (req.user.clerk_id) {
          await clerkClient.users.updateUserMetadata(req.user.clerk_id, {
            publicMetadata: {
              role: role
            }
          });
          logger.info('Clerk publicMetadata updated with role', { clerkId: req.user.clerk_id, role });
        }
      } catch (clerkErr) {
        logger.error('Failed to update Clerk user metadata', { message: clerkErr.message });
      }

      res.json({ success: true, data: updatedUser });
    } catch (error) {
      next(error);
    }
  }
);


// ─── GET /users ───────────────────────────────────────────────────────────────
router.get('/', requireAuth, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, is_active } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = {};
    if (role) filter.role = role;
    if (is_active !== undefined) filter.is_active = is_active === 'true';

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password_hash')
        .populate('assigned_property_ids', 'name property_code')
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /users ──────────────────────────────────────────────────────────────
router.post('/',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    body('full_name').trim().notEmpty().withMessage('Full name required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('phone').trim().matches(/^254\d{9}$/).withMessage('Phone must be 254XXXXXXXXX format'),
    body('role').isIn(['admin', 'agent', 'landlord', 'accountant', 'tenant'])
      .withMessage('Invalid role'),
    body('clerk_id').trim().notEmpty().withMessage('Clerk ID required')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const existing = await User.findOne({ $or: [{ email: req.body.email }, { clerk_id: req.body.clerk_id }] });
      if (existing) {
        return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'User with this email or Clerk ID already exists' } });
      }

      const count = await User.countDocuments();
      const userCode = `USR-${req.body.role.toUpperCase().slice(0, 3)}-${String(count + 1).padStart(4, '0')}`;

      const user = await User.create({
        ...req.body,
        user_code: userCode,
        is_active: true
      });

      const safeUser = user.toObject();
      delete safeUser.password_hash;
      logger.info('User created', { userId: user._id, role: user.role, by: req.user._id });
      res.status(201).json({ success: true, data: safeUser });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PATCH /users/:id ─────────────────────────────────────────────────────────
router.patch('/:id',
  requireAuth,
  [param('id').isMongoId()],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      // Users can update themselves; admins can update anyone
      const isSelf = req.params.id === req.user._id.toString();
      const isAdmin = ['admin', 'super_admin'].includes(req.user.role);
      if (!isSelf && !isAdmin) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot modify other users' } });
      }

      const selfAllowed = ['full_name', 'phone'];
      const adminAllowed = ['full_name', 'phone', 'role', 'is_active', 'assigned_property_ids', 'assigned_areas'];
      const allowedFields = isAdmin ? adminAllowed : selfAllowed;

      const update = {};
      allowedFields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

      // Prevent non-super_admin from granting super_admin
      if (update.role === 'super_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only super_admin can grant super_admin role' } });
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { ...update, updated_at: new Date() } },
        { new: true, runValidators: true }
      ).select('-password_hash');

      if (!user) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      }

      logger.info('User updated', { targetId: user._id, by: req.user._id });
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /users/:id/deactivate ───────────────────────────────────────────────
router.post('/:id/deactivate',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [param('id').isMongoId()],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      if (req.params.id === req.user._id.toString()) {
        return res.status(400).json({ success: false, error: { code: 'SELF_DEACTIVATE', message: 'Cannot deactivate your own account' } });
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { $set: { is_active: false, updated_at: new Date() } },
        { new: true }
      ).select('-password_hash');

      if (!user) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      }

      logger.info('User deactivated', { targetId: user._id, by: req.user._id });
      res.json({ success: true, message: 'User deactivated', data: user });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /users/sync-clerk ───────────────────────────────────────────────────
// Called after Clerk webhook to upsert user record
router.post('/sync-clerk',
  verifyClerkToken,
  async (req, res, next) => {
    try {
      const clerk_id = req.auth?.userId;
      const { email, full_name, phone } = req.body;
      if (!clerk_id) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_CLERK_ID', message: 'clerk_id required' } });
      }

      // Fetch user from Clerk to get the most up-to-date metadata/role
      const { clerkClient } = require('@clerk/clerk-sdk-node');
      let clerkUser = null;
      try {
        clerkUser = await clerkClient.users.getUser(clerk_id);
      } catch (clerkErr) {
        logger.warn('Failed to fetch user from Clerk in sync-clerk', { clerkId: clerk_id, message: clerkErr.message });
      }

      const clerkRole = clerkUser?.publicMetadata?.role;

      const existing = await User.findOne({ clerk_id });
      if (existing) {
        const updateData = {
          email: email || existing.email,
          full_name: full_name || existing.full_name,
          updated_at: new Date()
        };
        if (clerkRole && existing.role !== clerkRole) {
          updateData.role = clerkRole;
          logger.info('Syncing role from Clerk to existing user', { clerkId: clerk_id, oldRole: existing.role, newRole: clerkRole });
        }
        const updated = await User.findOneAndUpdate(
          { clerk_id },
          { $set: updateData },
          { new: true }
        ).select('-password_hash');
        return res.json({ success: true, data: updated, created: false });
      }

      const count = await User.countDocuments();
      const initialRole = clerkRole || 'agent'; // fallback to agent if no metadata role is set yet
      const user = await User.create({
        clerk_id,
        email,
        full_name: full_name || email,
        phone: phone || '254700000000',
        user_code: `USR-NEW-${String(count + 1).padStart(4, '0')}`,
        role: initialRole,
        is_active: true
      });

      const safeUser = user.toObject();
      delete safeUser.password_hash;
      logger.info('User synced from Clerk', { clerkId: clerk_id, userId: user._id, role: initialRole });
      res.status(201).json({ success: true, data: safeUser, created: true });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /users/webhook ──────────────────────────────────────────────────────
// Clerk webhook endpoint to listen for user.created and user.updated events
router.post('/webhook', async (req, res, next) => {
  try {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (secret && req.headers['x-webhook-secret'] !== secret) {
      logger.warn('Clerk webhook unauthorized check failed');
      return res.status(401).json({ success: false, message: 'Unauthorized webhook request' });
    }

    const { data, type } = req.body;
    if (!data || !type) {
      return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
    }

    const clerk_id = data.id;
    const email = data.email_addresses?.[0]?.email_address;
    const full_name = [data.first_name, data.last_name].filter(Boolean).join(' ') || email;
    const rawPhone = data.phone_numbers?.[0]?.phone_number || '254700000000';
    let phone = rawPhone.replace('+', '');
    if (!phone.startsWith('254')) phone = '254700000000';

    if (type === 'user.created') {
      const existing = await User.findOne({ clerk_id });
      if (!existing) {
        const count = await User.countDocuments();
        const role = data.public_metadata?.role || 'tenant';
        await User.create({
          clerk_id,
          email,
          full_name,
          phone,
          user_code: `USR-NEW-${String(count + 1).padStart(4, '0')}`,
          role,
          is_active: true
        });
        logger.info('User created via Clerk webhook', { clerkId: clerk_id });
      }
    } else if (type === 'user.updated') {
      const role = data.public_metadata?.role;
      const updateData = { email, full_name, phone, updated_at: new Date() };
      if (role) updateData.role = role;

      await User.findOneAndUpdate(
        { clerk_id },
        { $set: updateData },
        { new: true }
      );
      logger.info('User updated via Clerk webhook', { clerkId: clerk_id, role });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Clerk webhook handling failed', { message: error.message });
    next(error);
  }
});


/**
 * PATCH /api/v1/users/:id/disable
 * Admin deactivates a user account. Sets is_active=false and revokes all Clerk sessions.
 */
router.patch('/:id/disable',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  param('id').isMongoId().withMessage('Invalid user ID'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    try {
      const target = await User.findById(req.params.id);
      if (!target) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      if (target._id.toString() === req.user._id.toString()) {
        return res.status(400).json({ success: false, error: { code: 'SELF_DISABLE', message: 'You cannot disable your own account' } });
      }

      target.is_active = false;
      await target.save();

      // Revoke all Clerk sessions
      if (target.clerk_id) {
        try {
          const { clerkClient } = require('@clerk/clerk-sdk-node');
          const sessions = await clerkClient.sessions.getSessionList({ userId: target.clerk_id });
          for (const session of sessions.data || sessions) {
            if (session.status === 'active') {
              await clerkClient.sessions.revokeSession(session.id);
            }
          }
        } catch (clerkErr) {
          logger.warn('Failed to revoke Clerk sessions on disable', { userId: req.params.id, message: clerkErr.message });
        }
      }

      logger.info('User disabled', { targetId: req.params.id, by: req.user._id });
      res.json({ success: true, message: 'User account disabled successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/v1/users/:id/enable
 * Admin re-activates a user account.
 */
router.patch('/:id/enable',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  param('id').isMongoId().withMessage('Invalid user ID'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    try {
      const target = await User.findById(req.params.id);
      if (!target) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });

      target.is_active = true;
      await target.save();

      logger.info('User enabled', { targetId: req.params.id, by: req.user._id });
      res.json({ success: true, message: 'User account enabled successfully' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/users/:id/soft
 * Admin soft-deletes a user: anonymizes PII, deactivates, and vacates tenant unit.
 * The record is NOT physically removed — is_deleted=true is set for audit trail.
 */
router.delete('/:id/soft',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  param('id').isMongoId().withMessage('Invalid user ID'),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    try {
      const target = await User.findById(req.params.id);
      if (!target) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      if (target._id.toString() === req.user._id.toString()) {
        return res.status(400).json({ success: false, error: { code: 'SELF_DELETE', message: 'You cannot delete your own account' } });
      }

      const deletedAt = Date.now();

      // Anonymize PII
      target.full_name = `Deleted User ${deletedAt}`;
      target.email = `deleted_${deletedAt}@mutunerent.deleted`;
      target.phone = `0000000000`;
      target.is_active = false;
      target.is_deleted = true;
      await target.save();

      // Vacate tenant record if any
      const tenant = await Tenant.findOne({ user_id: target._id, tenancy_status: { $in: ['active', 'expired'] } });
      if (tenant) {
        if (tenant.current_property_id && tenant.unit_id) {
          const property = await Property.findById(tenant.current_property_id);
          if (property) {
            const unit = property.units.id(tenant.unit_id);
            if (unit) { unit.status = 'vacant'; unit.tenant_id = null; }
            await property.save();
          }
        }
        tenant.tenancy_status = 'departed';
        tenant.departed_at = new Date();
        await tenant.save();
      }

      // Revoke Clerk sessions
      if (target.clerk_id) {
        try {
          const { clerkClient } = require('@clerk/clerk-sdk-node');
          const sessions = await clerkClient.sessions.getSessionList({ userId: target.clerk_id });
          for (const session of sessions.data || sessions) {
            if (session.status === 'active') await clerkClient.sessions.revokeSession(session.id);
          }
          await clerkClient.users.deleteUser(target.clerk_id);
        } catch (clerkErr) {
          logger.warn('Clerk cleanup failed on soft-delete', { userId: req.params.id, message: clerkErr.message });
        }
      }

      logger.info('User soft-deleted', { targetId: req.params.id, by: req.user._id });
      res.json({ success: true, message: 'User account permanently removed and PII anonymized' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
