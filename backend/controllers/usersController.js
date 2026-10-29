const { validationResult } = require('express-validator');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');
const { getAdminPassword, escapeRegExp, isDesignatedSuperAdmin, isDesignatedAdmin, isDesignatedAdministrativeAccount } = require('../utils/security');
const catchAsync = require('../utils/catchAsync');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    return false;
  }
  return true;
};

exports.getUserMe = catchAsync(async (req, res, next) => {
  let user = await User.findById(req.user._id)
    .select('-password_hash')
    .populate('current_property_id', 'name property_code address')
    .populate('assigned_property_ids', 'name property_code address')
    .lean();

  // Strictly designated Administrative accounts:
  // - meshachmaluki3@gmail.com => super_admin
  // - meshachmaluki@gmail.com  => admin
  // All other accounts (including meshachmaluki06@gmail.com) retain their registered roles.
  if (user && isDesignatedSuperAdmin(user)) {
    if (user.role !== 'super_admin') {
      logger.info('Assigned designated role to super_admin', { email: user.email, userId: user._id });
      await User.findByIdAndUpdate(user._id, { $set: { role: 'super_admin' } });
      user.role = 'super_admin';
    }
    if (!user.user_code || !user.user_code.startsWith('ADM-MOM-')) {
      const { generateNextRoleCode } = require('../utils/roleCode');
      const newAdminCode = await generateNextRoleCode('super_admin', User, Tenant);
      await User.findByIdAndUpdate(user._id, { $set: { user_code: newAdminCode } });
      user.user_code = newAdminCode;
    }
  } else if (user && isDesignatedAdmin(user)) {
    if (user.role !== 'admin') {
      logger.info('Assigned designated role to admin', { email: user.email, userId: user._id });
      await User.findByIdAndUpdate(user._id, { $set: { role: 'admin' } });
      user.role = 'admin';
    }
    if (!user.user_code || !user.user_code.startsWith('ADM-MOM-')) {
      const { generateNextRoleCode } = require('../utils/roleCode');
      const newAdminCode = await generateNextRoleCode('admin', User, Tenant);
      await User.findByIdAndUpdate(user._id, { $set: { user_code: newAdminCode } });
      user.user_code = newAdminCode;
    }
  }

  if (user && user.clerk_id) {
    try {
      const { clerkClient } = require('@clerk/clerk-sdk-node');
      const clerkUser = await clerkClient.users.getUser(user.clerk_id);
      const clerkRole = clerkUser?.publicMetadata?.role;
      if (clerkRole && !user.role) {
        logger.info('Role mismatch detected in /users/me, DB role is empty, syncing from Clerk', { clerkId: user.clerk_id, clerkRole });
        const updatedUser = await User.findByIdAndUpdate(
          user._id,
          { $set: { role: clerkRole, updated_at: new Date() } },
          { new: true }
        )
          .select('-password_hash')
          .populate('current_property_id', 'name property_code address')
          .populate('assigned_property_ids', 'name property_code address')
          .lean();
        if (updatedUser) user = updatedUser;
      }
    } catch (clerkErr) {
      logger.warn('Failed to fetch role from Clerk in /users/me', { clerkId: user.clerk_id, message: clerkErr.message });
    }
  }

  // Auto-migrate legacy user_code (USR-NEW-*, USR-*) to standardized role-based IDs
  if (user && (!user.user_code || user.user_code.startsWith('USR-NEW') || user.user_code.startsWith('USR-'))) {
    try {
      const { generateNextRoleCode } = require('../utils/roleCode');
      const targetRole = user.role || 'tenant';
      const newCode = await generateNextRoleCode(targetRole, User, Tenant);
      await User.findByIdAndUpdate(user._id, { $set: { user_code: newCode } });
      logger.info('Auto-healed legacy user_code to standard role ID', { userId: user._id, oldCode: user.user_code, newCode, role: targetRole });
      user.user_code = newCode;
    } catch (healErr) {
      logger.warn('Failed to auto-heal user_code', { error: healErr.message });
    }
  }

  // Pre-registered Tenant automatic discovery & binding (Meshach Maluki / validated client assignment)
  if (user && !isDesignatedAdministrativeAccount(user)) {
    try {
      let tenant = await Tenant.findOne({ user_id: user._id }).lean();
      
      // If not linked yet, search for pre-registered tenant record by email or phone
      if (!tenant && user.email) {
        tenant = await Tenant.findOne({
          email: { $regex: new RegExp('^' + escapeRegExp(user.email.trim()) + '$', 'i') }
        });
        if (tenant) {
          await Tenant.findByIdAndUpdate(tenant._id, { $set: { user_id: user._id } });
          logger.info('Auto-bound pre-registered tenant by email to user', { userId: user._id, tenantCode: tenant.tenant_code });
          tenant = tenant.toObject ? tenant.toObject() : tenant;
        }
      }

      if (!tenant && user.phone) {
        const normP = user.phone.replace(/\D/g, '').replace(/^0/, '254');
        tenant = await Tenant.findOne({
          phone: { $regex: new RegExp(normP.slice(-9) + '$') }
        });
        if (tenant) {
          await Tenant.findByIdAndUpdate(tenant._id, { $set: { user_id: user._id } });
          logger.info('Auto-bound pre-registered tenant by phone to user', { userId: user._id, tenantCode: tenant.tenant_code });
          tenant = tenant.toObject ? tenant.toObject() : tenant;
        }
      }

      // Attach tenant parameters and synchronize user_code
      if (tenant) {
        user.tenant_code = tenant.tenant_code;
        user.tenancy_status = tenant.tenancy_status || 'active';
        user.current_property_id = tenant.current_property_id || user.current_property_id;
        user.current_unit_id = tenant.current_unit_id || user.current_unit_id;

        if (user.role !== 'tenant' || !user.user_code || !user.user_code.startsWith('TEN-MOM-')) {
          user.role = 'tenant';
          user.user_code = tenant.tenant_code;
          await User.findByIdAndUpdate(user._id, {
            $set: {
              role: 'tenant',
              user_code: tenant.tenant_code,
              current_property_id: tenant.current_property_id,
              current_unit_id: tenant.current_unit_id
            }
          });
        }
      }
    } catch (tErr) {
      logger.warn('Failed to lookup/bind tenant profile in /users/me', { error: tErr.message });
    }
  }

  if (user) {
    delete user.admin_hardcoded_hash;
  }

  res.json({ success: true, data: user });
});

exports.updateProfilePicture = catchAsync(async (req, res, next) => {
  if (!validate(req, res)) return;
  const { profile_picture } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { profile_picture, updated_at: new Date() } },
    { new: true }
  ).select('-password_hash');

  if (!user) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
  }

  res.json({ success: true, data: user });
});

exports.checkTenantEmail = catchAsync(async (req, res, next) => {
  const email = req.params.email?.trim();
  if (!email) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email is required' } });
  }

  const tenant = await Tenant.findOne({
    email: { $regex: new RegExp('^' + escapeRegExp(email) + '$', 'i') }
  }).select('tenant_code user_id full_name').lean();
  
  if (!tenant) {
    return res.json({ success: true, data: { exists: false } });
  }

  return res.json({
    success: true,
    data: {
      exists: true,
      has_account: !!tenant.user_id,
      tenant_code: tenant.tenant_code,
      tenant_name: tenant.full_name
    }
  });
});
