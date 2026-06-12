const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth, verifyClerkToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const User = require('../models/User');
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
    const user = await User.findById(req.user._id)
      .populate('assigned_property_ids', 'name property_code address')
      .lean();
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
    body('assigned_areas').optional().isArray().withMessage('Assigned areas must be an array')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }

      const { role, phone, earb_license, assigned_areas } = req.body;
      const userId = req.user._id;

      const updateData = { role };
      if (phone !== undefined) updateData.phone = phone;
      if (earb_license !== undefined) updateData.earb_license = earb_license;
      if (assigned_areas !== undefined) updateData.assigned_areas = assigned_areas;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true }
      ).select('-password_hash');

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

      const existing = await User.findOne({ clerk_id });
      if (existing) {
        const updated = await User.findOneAndUpdate(
          { clerk_id },
          { $set: { email: email || existing.email, full_name: full_name || existing.full_name, updated_at: new Date() } },
          { new: true }
        ).select('-password_hash');
        return res.json({ success: true, data: updated, created: false });
      }

      const count = await User.countDocuments();
      const user = await User.create({
        clerk_id,
        email,
        full_name: full_name || email,
        phone: phone || '254700000000',
        user_code: `USR-NEW-${String(count + 1).padStart(4, '0')}`,
        role: 'agent',  // Temporary — onboarding will call PATCH /users/me/role
        is_active: true
      });

      const safeUser = user.toObject();
      delete safeUser.password_hash;
      logger.info('User synced from Clerk', { clerkId: clerk_id, userId: user._id });
      res.status(201).json({ success: true, data: safeUser, created: true });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
