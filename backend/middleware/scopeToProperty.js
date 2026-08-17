const Property = require('../models/Property');
const logger = require('../utils/logger');

/**
 * Middleware enforcing strict per-property scoping for Caretaker (and scoped Agent) roles.
 * Every query from a caretaker MUST be restricted to their assigned_properties array.
 * If requesting a specific property outside their assigned properties, 403 Forbidden is returned.
 * If querying a list, req.propertyFilter is injected with { _id: { $in: assigned_properties } }.
 */
const scopeToProperty = async (req, res, next) => {
  if (!req.user) return next();

  // Super admins and admins have global access
  if (['super_admin', 'admin'].includes(req.user.role)) {
    return next();
  }

  if (req.user.role === 'caretaker') {
    const rawAssigned = req.user.assigned_properties || req.user.assigned_property_ids || [];
    const assignedProps = rawAssigned.map(id => id.toString());
    const propertyId = req.params.propertyId || req.params.id || req.body?.property_id || req.query?.property_id;

    if (propertyId) {
      if (!assignedProps.includes(propertyId.toString())) {
        logger.warn('Caretaker property access denied', {
          userId: req.user._id,
          requestedProperty: propertyId,
          assignedProps
        });
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You are not authorized to access this property'
          }
        });
      }
      return next();
    }

    // List query filter injection: sole source of truth is assigned_properties
    req.propertyFilter = { _id: { $in: rawAssigned } };
    req.scopedPropertyIds = rawAssigned;
    return next();
  }

  next();
};

module.exports = scopeToProperty;
