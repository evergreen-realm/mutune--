const Property = require('../models/Property');
const MaintenanceTicket = require('../models/MaintenanceTicket');
const logger = require('../utils/logger');

/**
 * Helper to safely extract all assigned properties for a caretaker or user,
 * combining assigned_properties and assigned_property_ids without truthy-empty-array fallback bugs.
 */
function getCaretakerAssignedProperties(user) {
  if (!user) return [];
  const p1 = Array.isArray(user.assigned_properties) ? user.assigned_properties : [];
  const p2 = Array.isArray(user.assigned_property_ids) ? user.assigned_property_ids : [];
  const combined = [...p1, ...p2];
  const seen = new Set();
  const result = [];
  for (const item of combined) {
    if (!item) continue;
    const str = item.toString();
    if (!seen.has(str)) {
      seen.add(str);
      result.push(item);
    }
  }
  return result;
}

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
    const rawAssigned = getCaretakerAssignedProperties(req.user);
    const assignedProps = rawAssigned.map(id => id.toString());
    let propertyId = req.params.propertyId || req.body?.property_id || req.query?.property_id;

    if (!propertyId && req.params.id) {
      const isMaintenanceRoute = (req.baseUrl && req.baseUrl.includes('maintenance')) ||
                                 (req.originalUrl && req.originalUrl.includes('/maintenance'));
      if (isMaintenanceRoute) {
        try {
          const ticket = await MaintenanceTicket.findById(req.params.id).select('property_id').lean();
          if (ticket) {
            if (ticket.property_id) {
              propertyId = ticket.property_id.toString();
            } else {
              // Ticket exists but has no associated property -> caretaker cannot access it
              return res.status(403).json({
                success: false,
                error: {
                  code: 'FORBIDDEN',
                  message: 'You are not authorized to access this unassigned ticket'
                }
              });
            }
          }
        } catch (e) {
          // Invalid ID will be handled by validators/controllers
        }
      } else {
        propertyId = req.params.id;
      }
    }

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
    req.maintenanceFilter = { property_id: { $in: rawAssigned } };
    req.scopedPropertyIds = rawAssigned;
    return next();
  }

  next();
};

module.exports = scopeToProperty;
module.exports.getCaretakerAssignedProperties = getCaretakerAssignedProperties;

