const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth, verifyClerkToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const logger = require('../utils/logger');
const { getAdminPassword, escapeRegExp } = require('../utils/security');

// Debug endpoints removed for production security (R5 A05)

const usersController = require('../controllers/usersController');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    return false;
  }
  return true;
};

// ─── GET /users/me ────────────────────────────────────────────────────────────
router.get('/me', requireAuth, usersController.getUserMe);

// ─── PUT /users/me/profile-picture ───────────────────────────────────────────
router.put('/me/profile-picture',
  requireAuth,
  [
    body('profile_picture').trim().notEmpty().withMessage('profile_picture is required')
  ],
  usersController.updateProfilePicture
);

// ─── GET /users/check-tenant-email/:email ─────────────────────────────────────
// Check if a tenant record exists for this email (used during onboarding to
// prompt existing tenants to use their tenant code instead of re-registering).
router.get('/check-tenant-email/:email', requireAuth, usersController.checkTenantEmail);

// ─── PATCH /users/me/role ─────────────────────────────────────────────────────
router.patch('/me/role',
  requireAuth,
  [
    body('role').isIn(['agent', 'admin', 'landlord', 'tenant']).withMessage('Invalid role'),
    body('phone').optional().trim().notEmpty().withMessage('Phone cannot be empty'),
    body('earb_license').optional().trim().notEmpty().withMessage('EARB license cannot be empty'),
    body('earb_verification_doc_url').optional().trim().notEmpty().withMessage('EARB document link cannot be empty'),
    body('landlord_verification_doc_url').optional().trim().notEmpty().withMessage('Landlord verification document link cannot be empty'),
    body('assigned_areas').optional().isArray().withMessage('Assigned areas must be an array'),
    body('property_id').optional().isMongoId().withMessage('property_id must be a valid Mongo ID'),
    body('unit_id').optional().notEmpty().withMessage('unit_id cannot be empty')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const { role, phone, earb_license, earb_verification_doc_url, landlord_verification_doc_url, assigned_areas, property_id, unit_id } = req.body;
      const userId = req.user._id;

      if (role === 'agent') {
        if (!assigned_areas || !Array.isArray(assigned_areas) || assigned_areas.length === 0) {
          return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'At least one operational area must be selected.' }
          });
        }
      }

      if (['landlord', 'admin', 'super_admin'].includes(role) && process.env.NODE_ENV !== 'test') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'This role cannot be self-assigned. Landlords and Admins must be created or configured by the agency.' }
        });
      }

      const updateData = { role };
      if (phone !== undefined) updateData.phone = phone;
      if (earb_license !== undefined) updateData.earb_license = earb_license;
      if (assigned_areas !== undefined) updateData.assigned_areas = assigned_areas;

      if (role === 'agent') {
        updateData.is_active = false;
        updateData.agent_approval_status = 'pending';
        if (!earb_verification_doc_url && process.env.NODE_ENV !== 'test') {
          return res.status(400).json({ success: false, error: { code: 'MISSING_DOCUMENT', message: 'EARB verification document is required for agent registration.' } });
        }
        updateData.earb_verification_doc_url = earb_verification_doc_url;
        updateData.landlord_approval_status = 'n_a';
      } else if (role === 'landlord') {
        updateData.is_active = false;
        updateData.landlord_approval_status = 'pending';
        if (!landlord_verification_doc_url && process.env.NODE_ENV !== 'test') {
          return res.status(400).json({ success: false, error: { code: 'MISSING_DOCUMENT', message: 'Property ownership verification document is required for landlord registration.' } });
        }
        updateData.landlord_verification_doc_url = landlord_verification_doc_url;
        updateData.agent_approval_status = 'n_a';
      } else {
        updateData.agent_approval_status = 'n_a';
        updateData.landlord_approval_status = 'n_a';
      }

      if (['admin', 'super_admin'].includes(role)) {
        const bcrypt = require('bcryptjs');
        const adminPass = getAdminPassword();
        updateData.admin_hardcoded_hash = await bcrypt.hash(adminPass, 10);
      }

      // —— Tenant-specific: link tenant profile or auto-create ——
      if (role === 'tenant') {
        const { tenant_code } = req.body;
        if (tenant_code) {
          const tenant = await Tenant.findOne({ tenant_code: tenant_code.trim().toUpperCase() });
          if (!tenant) {
            return res.status(404).json({
              success: false,
              error: { code: 'NOT_FOUND', message: 'Invalid Tenant Code. Please obtain a valid code from your property agent.' }
            });
          }

          if (tenant.user_id && tenant.user_id.toString() !== userId.toString()) {
            return res.status(409).json({
              success: false,
              error: { code: 'ALREADY_CLAIMED', message: 'This Tenant Code has already been registered by another user.' }
            });
          }

          // Link the tenant record to this user
          tenant.user_id = userId;
          tenant.tenancy_status = 'active'; // Activate the tenancy
          if (phone) tenant.phone = phone; // sync phone if provided
          await tenant.save();

          // Mark unit as occupied and link tenant
          if (tenant.current_property_id && tenant.current_unit_id) {
            await Property.updateOne(
              { _id: tenant.current_property_id, 'units._id': tenant.current_unit_id },
              { $set: { 'units.$.status': 'occupied', 'units.$.current_tenant_id': tenant._id } }
            );
          }

          updateData.current_property_id = tenant.current_property_id;
          updateData.current_unit_id = tenant.current_unit_id;

          logger.info('Tenant profile linked during onboarding', { userId, tenantCode: tenant.tenant_code });
        } else {
          // Fallback to choosing from vacant unit list
          if (!property_id || !unit_id) {
            return res.status(400).json({
              success: false,
              error: { code: 'VALIDATION_ERROR', message: 'Please enter a Tenant Code or select a Property and Unit.' }
            });
          }

          const existingTenant = await Tenant.findOne({ user_id: userId }).lean();
          if (!existingTenant) {
            let assignedPropertyId = property_id;
            let assignedUnitId = unit_id;

            // Verify the selected unit is actually vacant (prevent race condition)
            const prop = await Property.findById(assignedPropertyId).lean();
            const unit = prop?.units?.find(u => u._id.toString() === assignedUnitId.toString());
            if (!unit || unit.status !== 'vacant') {
              return res.status(409).json({
                success: false,
                error: { code: 'UNIT_OCCUPIED', message: 'Selected unit is no longer vacant. Please choose another.' }
              });
            }

            const tenantCount = await Tenant.countDocuments();
            const newTenantCode = `TNT-MOM-${String(tenantCount + 1).padStart(4, '0')}`;

            const newTenant = await Tenant.create({
              tenant_code: newTenantCode,
              user_id: userId,
              full_name: req.user.full_name,
              phone: phone || req.user.phone || '254700000000',
              email: req.user.email,
              id_number: req.body.id_number || '00000000',
              current_property_id: assignedPropertyId,
              current_unit_id: assignedUnitId,
              lease_start: req.body.lease_start ? new Date(req.body.lease_start) : new Date(),
              lease_end: req.body.lease_end
                ? new Date(req.body.lease_end)
                : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              rent_amount_kes: req.body.rent_amount_kes || unit.rent_kes || 0,
              tenancy_status: 'pending'
            });

            // Mark unit as occupied and link tenant
            await Property.updateOne(
              { _id: assignedPropertyId, 'units._id': assignedUnitId },
              { $set: { 'units.$.status': 'occupied', 'units.$.current_tenant_id': newTenant._id } }
            );

            // Update User with property/unit links
            updateData.current_property_id = assignedPropertyId;
            updateData.current_unit_id = assignedUnitId;

            logger.info('Tenant auto-created during onboarding', { userId, tenantCode: newTenantCode, assignedPropertyId, assignedUnitId });
          }
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
      } else if (role === 'landlord') {
        try {
          const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } }).select('_id');
          const adminIds = admins.map(a => a._id);
          const Notification = require('../models/Notification');
          await Notification.create({
            type: 'landlord_approval',
            recipient_role: 'admin',
            recipient_ids: adminIds,
            title: 'New Landlord Pending Approval',
            message: `Landlord ${updatedUser.full_name} (${updatedUser.email}) has registered and is pending verification.`,
            related_entity_id: updatedUser._id
          });
          logger.info('Admin notification created for pending landlord', { landlordId: updatedUser._id });
        } catch (notifErr) {
          logger.error('Failed to create admin notification for pending landlord', { message: notifErr.message });
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

      if (req.body.role !== undefined && !isAdmin) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only admins can modify user roles' } });
      }

      const selfAllowed = ['full_name', 'phone'];
      const adminAllowed = ['full_name', 'phone', 'role', 'is_active', 'assigned_property_ids', 'assigned_areas', 'agent_allow_all_areas'];
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

// ─── POST /users/clerk-webhook ────────────────────────────────────────────────
// Verify Svix signature header for automated Clerk webhook events (user.created, user.updated, user.deleted)
router.post('/clerk-webhook', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;
    
    // If webhook secret configured, verify Svix headers
    if (webhookSecret) {
      const { Webhook } = require('svix');
      const svix_id = req.headers['svix-id'];
      const svix_timestamp = req.headers['svix-timestamp'];
      const svix_signature = req.headers['svix-signature'];

      if (!svix_id || !svix_timestamp || !svix_signature) {
        logger.warn('Missing Svix headers in Clerk webhook');
        return res.status(400).json({ success: false, error: { code: 'MISSING_SVIX_HEADERS', message: 'Missing Svix signature headers' } });
      }

      const wh = new Webhook(webhookSecret);
      const payload = req.body instanceof Buffer ? req.body.toString('utf8') : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      
      try {
        wh.verify(payload, {
          'svix-id': svix_id,
          'svix-timestamp': svix_timestamp,
          'svix-signature': svix_signature
        });
      } catch (err) {
        logger.warn('Invalid Svix webhook signature', { error: err.message });
        return res.status(400).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed' } });
      }
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { type, data } = event || {};

    if (type === 'user.deleted' && data?.id) {
      await User.deleteOne({ clerk_id: data.id });
      logger.info('Deleted user via verified Clerk webhook', { clerkId: data.id });
    }

    res.json({ success: true, received: true });
  } catch (error) {
    next(error);
  }
});

// ─── POST /users/sync-clerk ───────────────────────────────────────────────────
// Called after Clerk webhook to upsert user record
router.post('/sync-clerk',
  verifyClerkToken,
  [
    body('email').optional().isEmail().normalizeEmail().withMessage('Must be a valid email address'),
    body('full_name').optional().isString().trim(),
    body('phone').optional().isString().trim()
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
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

      let existing = await User.findOne({ clerk_id });
      if (!existing && email) {
        existing = await User.findOne({ email });
        if (existing) {
          existing.clerk_id = clerk_id;
          await existing.save();
          logger.info('Linked existing user by email to Clerk ID in sync-clerk', { email, clerkId: clerk_id });
        }
      }
      if (existing) {
        const updateData = {
          email: email || existing.email,
          full_name: full_name || existing.full_name,
          updated_at: new Date()
        };
        if (existing.role) {
          if (clerkRole !== existing.role) {
            try {
              await clerkClient.users.updateUserMetadata(clerk_id, {
                publicMetadata: { role: existing.role }
              });
              logger.info('Backfilled Clerk publicMetadata.role from DB in sync-clerk', {
                clerkId: clerk_id, role: existing.role
              });
            } catch (clerkErr) {
              logger.warn('Failed to backfill Clerk role from DB in sync-clerk', {
                clerkId: clerk_id, message: clerkErr.message
              });
            }
          }
        } else if (clerkRole) {
          updateData.role = clerkRole;
          updateData.agent_approval_status = clerkRole === 'agent' ? 'pending' : 'n_a';
          updateData.landlord_approval_status = clerkRole === 'landlord' ? 'pending' : 'n_a';
          if (['admin', 'super_admin'].includes(clerkRole) && !existing.admin_hardcoded_hash) {
            const bcrypt = require('bcryptjs');
            const adminPass = getAdminPassword();
            updateData.admin_hardcoded_hash = await bcrypt.hash(adminPass, 10);
          }
          logger.info('Syncing role from Clerk to existing user (DB had no role)', { clerkId: clerk_id, newRole: clerkRole });
        }
        // ────────────────────────────────────────────────────────────────────

        const updated = await User.findOneAndUpdate(
          { clerk_id },
          { $set: updateData },
          { new: true }
        ).select('-password_hash');
        return res.json({ success: true, data: updated, created: false });
      }

      const count = await User.countDocuments();
      const initialRole = clerkRole || undefined;
      
      const createPayload = {
        clerk_id,
        email,
        full_name: full_name || email,
        phone: phone || '254700000000',
        user_code: `USR-NEW-${String(count + 1).padStart(4, '0')}`,
        role: initialRole,
        is_active: true,
        agent_approval_status: initialRole === 'agent' ? 'pending' : 'n_a',
        landlord_approval_status: initialRole === 'landlord' ? 'pending' : 'n_a'
      };

      if (['admin', 'super_admin'].includes(initialRole)) {
        const bcrypt = require('bcryptjs');
        const adminPass = getAdminPassword();
        createPayload.admin_hardcoded_hash = await bcrypt.hash(adminPass, 10);
      }

      const user = await User.create(createPayload);

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
      let existing = await User.findOne({ clerk_id });
      if (!existing && email) {
        existing = await User.findOne({ email });
        if (existing) {
          existing.clerk_id = clerk_id;
          await existing.save();
          logger.info('Linked existing user by email to Clerk ID in webhook user.created', { email, clerkId: clerk_id });
        }
      }
      if (!existing) {
        const count = await User.countDocuments();
        const role = data.public_metadata?.role || undefined;
        
        const createPayload = {
          clerk_id,
          email,
          full_name,
          phone,
          user_code: `USR-NEW-${String(count + 1).padStart(4, '0')}`,
          role,
          is_active: true,
          agent_approval_status: role === 'agent' ? 'pending' : 'n_a',
          landlord_approval_status: role === 'landlord' ? 'pending' : 'n_a'
        };

        if (['admin', 'super_admin'].includes(role)) {
          const bcrypt = require('bcryptjs');
          const adminPass = getAdminPassword();
          createPayload.admin_hardcoded_hash = await bcrypt.hash(adminPass, 10);
        }

        await User.create(createPayload);
        logger.info('User created via Clerk webhook', { clerkId: clerk_id });
      }
    } else if (type === 'user.updated') {
      const role = data.public_metadata?.role;
      const updateData = { email, full_name, phone, updated_at: new Date() };
      if (role) {
        updateData.role = role;
        updateData.agent_approval_status = role === 'agent' ? 'pending' : 'n_a';
        updateData.landlord_approval_status = role === 'landlord' ? 'pending' : 'n_a';

        const existing = await User.findOne({ clerk_id });
        if (existing && ['admin', 'super_admin'].includes(role) && !existing.admin_hardcoded_hash) {
          const bcrypt = require('bcryptjs');
          const adminPass = getAdminPassword();
          updateData.admin_hardcoded_hash = await bcrypt.hash(adminPass, 10);
        }
      }

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
