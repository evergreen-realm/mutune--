const Property = require('../models/Property');
const logger = require('../utils/logger');

const permissions = {
  super_admin: ['*'],
  admin: ['*'],
  agent: ['view:assigned', 'lock:house', 'verify:payment', 'issue:notice', 'view:inventory', 'edit:inventory', 'create:maintenance', 'view:maintenance', 'ai:chat', 'checkin:property', 'view:payments', 'pay:rent'],
  landlord: ['view:own_properties', 'view:payments', 'view:reports'],
  accountant: ['view:payments', 'view:reports', 'export:kra', 'verify:payment'],
  tenant: ['view:own_unit', 'pay:rent', 'view:notices', 'create:maintenance', 'view:maintenance']
};

const requirePermission = (permission) => (req, res, next) => {
  const userPerms = permissions[req.user.role] || [];
  if (userPerms.includes('*') || userPerms.includes(permission)) return next();
  logger.warn('Permission denied', { userId: req.user._id, role: req.user.role, permission });
  return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: `Permission ${permission} required` } });
};

const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    logger.warn('Role denied', { userId: req.user._id, role: req.user.role, required: roles });
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: `Role ${req.user.role} not authorized` } });
  }
  next();
};

const enforcePropertyScope = async (req, res, next) => {
  if (['super_admin', 'admin'].includes(req.user.role)) return next();
  const propertyId = req.params.propertyId || req.params.id || req.body.property_id;
  if (req.user.role === 'agent' && propertyId) {
    const isAssigned = req.user.assigned_property_ids?.some(id => id.toString() === propertyId);
    if (!isAssigned) {
      logger.warn('Agent scope denied', { userId: req.user._id, propertyId });
      return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Property not assigned to agent' } });
    }
  }
  if (req.user.role === 'tenant' && propertyId) {
    if (req.user.current_property_id?.toString() !== propertyId) {
      return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Tenant can only access own unit' } });
    }
  }
  if (req.user.role === 'landlord' && propertyId) {
    const property = await Property.findById(propertyId).lean();
    if (property?.landlord_id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Not your property' } });
    }
  }
  next();
};

module.exports = { requirePermission, requireRole, enforcePropertyScope };
