const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const Property = require('../models/Property');
const logger = require('../utils/logger');

// Plus Code encoding — open-location-code module
let olcEncode;
try {
  const { OpenLocationCode } = require('open-location-code');
  const olc = new OpenLocationCode();
  olcEncode = (lat, lng) => olc.encode(lat, lng, 10);
} catch (_err) {
  olcEncode = () => null; // Graceful fallback if module unavailable
}

/**
 * POST /api/v1/properties/with-gps
 * Create a property using GPS coordinates captured on-site.
 * Validates GPS accuracy must be ≤ 50m.
 * Auto-generates property_code and Plus Code address.
 */
router.post('/with-gps',
  requireAuth,
  requireRole(['admin', 'super_admin', 'agent']),
  [
    body('name').trim().notEmpty().isLength({ max: 100 }).withMessage('Name required (max 100 chars)'),
    body('type').isIn(['apartment', 'single_family', 'commercial', 'mixed_use', 'bedsitter', 'studio'])
      .withMessage('Invalid property type'),
    body('address.street').trim().notEmpty().withMessage('Street address required'),
    body('address.area').trim().notEmpty().withMessage('Area required'),
    body('location.coordinates')
      .isArray({ min: 2, max: 2 })
      .withMessage('Coordinates must be [lng, lat]')
      .custom((v) => v.every((n) => typeof n === 'number' && Math.abs(n) <= 180))
      .withMessage('Coordinates out of range'),
    body('location.accuracy')
      .isFloat({ min: 0, max: 1000 })
      .withMessage('GPS accuracy required (0-1000m)'),
    body('rent_kes').optional().isInt({ min: 0 }).withMessage('Rent must be non-negative integer')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }

      const { name, type, address, location, rent_kes = 0, units = [] } = req.body;
      const [lng, lat] = location.coordinates;
      const accuracy = location.accuracy;

      // Enforce <50m accuracy for field capture
      if (accuracy > 50) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'GPS_INACCURATE',
            message: `GPS accuracy ${Math.round(accuracy)}m exceeds the 50m limit. Move closer to the building entrance and try again.`
          }
        });
      }

      // Generate Plus Code (OLC) for the location
      let plusCode = null;
      try {
        plusCode = olcEncode(lat, lng);
      } catch (_e) {
        plusCode = null;
      }

      // Auto-generate property code: MUT-{AREA}-{sequence}
      const count = await Property.countDocuments();
      const areaTag = (address.area || 'UNK').substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
      const propertyCode = `MUT-${areaTag}-${String(count + 1).padStart(3, '0')}`;

      // Build units array (default single unit if none provided)
      const propertyUnits = units.length > 0
        ? units
        : [{ unit_number: '1A', rent_kes: rent_kes, status: 'vacant', lock_status: 'unlocked' }];

      const property = await Property.create({
        property_code: propertyCode,
        name,
        type,
        address: {
          ...address,
          city: address.city || 'Mombasa',
          county: address.county || 'Mombasa County',
          plus_code: plusCode
        },
        location: { type: 'Point', coordinates: [lng, lat] },
        landlord_id: req.user._id,
        agent_ids: [req.user._id],
        units: propertyUnits,
        gps_accuracy_m: accuracy
      });

      logger.info('Property created with GPS', {
        propertyId: property._id,
        propertyCode,
        plusCode,
        accuracy,
        agentId: req.user._id
      });

      res.status(201).json({ success: true, data: property });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
