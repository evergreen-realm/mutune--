const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');
const User = require('../models/User');
const Property = require('../models/Property');
const logger = require('../utils/logger');

/**
 * Haversine formula — returns distance in metres between two lat/lng points.
 */
function getDistanceMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * POST /api/v1/agents/checkin
 * Geo-verify an agent is physically at a property (within 200m).
 * Records the agent's last known location on their User document.
 */
router.post('/checkin',
  requireAuth,
  requirePermission('checkin:property'),
  [
    body('property_id').isMongoId().withMessage('Valid property ID required'),
    body('location.coordinates')
      .isArray({ min: 2, max: 2 })
      .withMessage('Coordinates [lng, lat] required'),
    body('location.accuracy')
      .isFloat({ min: 0, max: 1000 })
      .withMessage('GPS accuracy required'),
    body('photo_url').trim().notEmpty().withMessage('Photo is required').isURL().withMessage('Invalid photo URL')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }

      const { property_id, location, photo_url } = req.body;
      const [lng, lat] = location.coordinates;

      const property = await Property.findById(property_id).lean();
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found' } });
      }

      // Ensure property has GPS data
      if (!property.location?.coordinates?.length) {
        return res.status(422).json({
          success: false,
          error: { code: 'PROPERTY_NO_GPS', message: 'Property has no GPS coordinates on record' }
        });
      }

      const [propLng, propLat] = property.location.coordinates;
      const distanceM = getDistanceMetres(propLat, propLng, lat, lng);

      if (distanceM > 200) {
        logger.warn('Agent check-in denied: out of range', {
          agentId: req.user._id,
          propertyId: property_id,
          distanceM: Math.round(distanceM)
        });
        return res.status(403).json({
          success: false,
          error: {
            code: 'CHECKIN_TOO_FAR',
            message: `You are ${Math.round(distanceM)}m from the property. Must be within 200m to check in.`
          }
        });
      }

      // Persist agent's last known location
      const locationUpdate = {
        'last_location.type': 'Point',
        'last_location.coordinates': [lng, lat],
        'last_location.accuracy': location.accuracy,
        'last_location.recorded_at': new Date()
      };
      if (photo_url) locationUpdate['last_checkin_photo'] = photo_url;

      await User.findByIdAndUpdate(req.user._id, { $set: locationUpdate });

      logger.info('Agent checked in successfully', {
        agentId: req.user._id,
        propertyId: property_id,
        distanceM: Math.round(distanceM),
        accuracy: location.accuracy
      });

      res.json({
        success: true,
        distance_m: Math.round(distanceM),
        verified: true,
        timestamp: new Date().toISOString(),
        property: { name: property.name, property_code: property.property_code }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/agents/location
 * Returns the authenticated agent's last recorded location.
 */
router.get('/location', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('last_location full_name')
      .lean();
    res.json({
      success: true,
      location: user?.last_location || null,
      agent: user?.full_name
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/agents/all-locations
 * Returns last known locations for all active agents (admin only).
 */
router.get('/all-locations', requireAuth, async (req, res, next) => {
  try {
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin only' } });
    }
    const agents = await User.find({ role: 'agent', is_active: true, 'last_location.coordinates': { $exists: true } })
      .select('full_name last_location')
      .lean();
    res.json({ success: true, data: agents });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
