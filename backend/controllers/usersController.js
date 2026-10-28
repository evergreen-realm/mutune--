const { validationResult } = require('express-validator');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const logger = require('../utils/logger');
const { getAdminPassword, escapeRegExp } = require('../utils/security');
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
    .populate('assigned_property_ids', 'name property_code address')
    .lean();

  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'meshachmaluki3@gmail.com').toLowerCase().trim();

  // Super Admin email binding check
  if (user && user.email && user.email.toLowerCase().trim() === superAdminEmail && user.role !== 'super_admin') {
    logger.info('Promoting designated user to super_admin', { email: superAdminEmail, userId: user._id });
    await User.findByIdAndUpdate(user._id, { $set: { role: 'super_admin' } });
    user.role = 'super_admin';
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
          .populate('assigned_property_ids', 'name property_code address')
          .lean();
        user = updatedUser;
      } else if (user.role && clerkRole !== user.role) {
        logger.info('Role mismatch detected in /users/me, syncing Clerk from DB', { clerkId: user.clerk_id, dbRole: user.role, clerkRole });
        try {
          await clerkClient.users.updateUserMetadata(user.clerk_id, {
            publicMetadata: { role: user.role }
          });
        } catch (clerkErr) {
          logger.warn('Failed to update Clerk metadata in /users/me', { clerkId: user.clerk_id, message: clerkErr.message });
        }
      }
    } catch (clerkErr) {
      logger.warn('Failed to fetch/sync Clerk user role in /users/me', { clerkId: user.clerk_id, message: clerkErr.message });
    }
  }

  if (user && ['admin', 'super_admin'].includes(user.role) && !user.admin_hardcoded_hash) {
    const bcrypt = require('bcryptjs');
    const adminPass = getAdminPassword();
    const hash = await bcrypt.hash(adminPass, 10);
    await User.findByIdAndUpdate(user._id, { $set: { admin_hardcoded_hash: hash } });
    user.admin_hardcoded_hash = hash;
  }

  // Auto-heal legacy or placeholder USR- codes to standardized enterprise role codes
  if (user && user.user_code && (user.user_code.startsWith('USR-NEW') || user.user_code.startsWith('USR-'))) {
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

  // If user is a tenant, attach their tenant_code and tenancy status for seamless identity verification
  if (user && user.role === 'tenant') {
    try {
      const tenant = await Tenant.findOne({ user_id: user._id }).lean();
      if (tenant) {
        user.tenant_code = tenant.tenant_code;
        user.tenancy_status = tenant.tenancy_status;
      }
    } catch (tErr) {
      logger.warn('Failed to lookup tenant profile in /users/me', { error: tErr.message });
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
