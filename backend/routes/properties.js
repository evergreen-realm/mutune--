const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireRole, enforcePropertyScope } = require('../middleware/rbac');
const Property = require('../models/Property');
const logger = require('../utils/logger');

// ─── Helper ────────────────────────────────────────────────────────────────
const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    return false;
  }
  return true;
};

// ─── GET /properties ────────────────────────────────────────────────────────
// Admin/super_admin: all properties.  Agent: only assigned.  Landlord: only own.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, area, type, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = {};

    if (req.user.role === 'agent') {
      filter._id = { $in: req.user.assigned_property_ids || [] };
    } else if (req.user.role === 'landlord') {
      filter.landlord_id = req.user._id;
    } else if (req.user.role === 'tenant') {
      filter._id = req.user.current_property_id;
    }

    if (area) filter['address.area'] = { $regex: area, $options: 'i' };
    if (type) filter.type = type;
    if (status) filter['units.status'] = status;

    const [properties, total] = await Promise.all([
      Property.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Property.countDocuments(filter)
    ]);

    logger.info('Properties fetched', { userId: req.user._id, role: req.user.role, count: properties.length });
    res.json({
      success: true,
      data: properties,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
    });
  } catch (error) {
    next(error);
  }
});

// ─── GET /properties/nearby ─────────────────────────────────────────────────
router.get('/nearby',
  requireAuth,
  [
    query('lng').isFloat().withMessage('Longitude required'),
    query('lat').isFloat().withMessage('Latitude required'),
    query('radius').optional().isInt({ min: 100, max: 50000 }).withMessage('Radius 100–50000m')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const { lng, lat, radius = 5000 } = req.query;
      const properties = await Property.find({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            $maxDistance: Number(radius)
          }
        }
      }).limit(50).lean();

      res.json({ success: true, data: properties, count: properties.length });
    } catch (error) {
      next(error);
    }
  }
);

// ─── GET /properties/:id ─────────────────────────────────────────────────────
router.get('/:id',
  requireAuth,
  enforcePropertyScope,
  [param('id').isMongoId().withMessage('Invalid property ID')],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const property = await Property.findById(req.params.id)
        .populate('landlord_id', 'full_name email phone')
        .populate('agent_ids', 'full_name email phone')
        .lean();
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }
      res.json({ success: true, data: property });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /properties ────────────────────────────────────────────────────────
router.post('/',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    body('property_code').trim().notEmpty().withMessage('Property code required'),
    body('name').trim().notEmpty().withMessage('Name required'),
    body('type').isIn(['apartment', 'single_family', 'commercial', 'mixed_use', 'bedsitter', 'studio'])
      .withMessage('Invalid property type'),
    body('address.street').trim().notEmpty().withMessage('Street address required'),
    body('address.area').trim().notEmpty().withMessage('Area required'),
    body('address.city').trim().notEmpty().withMessage('City required'),
    body('location.coordinates').isArray({ min: 2, max: 2 }).withMessage('Coordinates [lng, lat] required'),
    body('landlord_id').isMongoId().withMessage('Valid landlord_id required')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const existing = await Property.findOne({ property_code: req.body.property_code });
      if (existing) {
        return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Property code already exists' } });
      }

      const property = await Property.create({
        ...req.body,
        location: { type: 'Point', coordinates: req.body.location.coordinates }
      });

      logger.info('Property created', { propertyId: property._id, by: req.user._id });
      res.status(201).json({ success: true, data: property });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PATCH /properties/:id ───────────────────────────────────────────────────
router.patch('/:id',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [param('id').isMongoId()],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const allowedFields = ['name', 'type', 'address', 'location', 'agent_ids', 'amenities', 'photos', 'notes'];
      const update = {};
      allowedFields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

      const property = await Property.findByIdAndUpdate(
        req.params.id,
        { $set: { ...update, updated_at: new Date() } },
        { new: true, runValidators: true }
      );
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }
      logger.info('Property updated', { propertyId: property._id, by: req.user._id });
      res.json({ success: true, data: property });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /properties/:id ───────────────────────────────────────────────────
router.delete('/:id',
  requireAuth,
  requireRole(['super_admin']),
  [param('id').isMongoId()],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const property = await Property.findByIdAndDelete(req.params.id);
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }
      logger.info('Property deleted', { propertyId: req.params.id, by: req.user._id });
      res.json({ success: true, message: 'Property deleted' });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /properties/:id/units ───────────────────────────────────────────────
router.post('/:id/units',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('id').isMongoId(),
    body('unit_number').trim().notEmpty().withMessage('Unit number required'),
    body('rent_kes').isInt({ min: 1 }).withMessage('Rent must be a positive integer')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const property = await Property.findById(req.params.id);
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }
      const duplicate = property.units.some(u => u.unit_number === req.body.unit_number);
      if (duplicate) {
        return res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: 'Unit number already exists in this property' } });
      }
      property.units.push({
        unit_number: req.body.unit_number,
        rent_kes: req.body.rent_kes,
        bedrooms: req.body.bedrooms || 1,
        bathrooms: req.body.bathrooms || 1,
        size_sqm: req.body.size_sqm,
        status: 'vacant',
        lock_status: 'unlocked'
      });
      await property.save();
      logger.info('Unit added', { propertyId: property._id, unit: req.body.unit_number, by: req.user._id });
      res.status(201).json({ success: true, data: property.units[property.units.length - 1] });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PATCH /properties/:id/units/:unitId ─────────────────────────────────────
router.patch('/:id/units/:unitId',
  requireAuth,
  requirePermission('view:assigned'),
  enforcePropertyScope,
  async (req, res, next) => {
    try {
      const property = await Property.findById(req.params.id);
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }
      const unit = property.units.id(req.params.unitId);
      if (!unit) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Unit not found' } });
      }
      const allowedUnitFields = ['status', 'lock_status', 'rent_kes', 'notes', 'bedrooms', 'bathrooms', 'size_sqm'];
      allowedUnitFields.forEach(f => { if (req.body[f] !== undefined) unit[f] = req.body[f]; });
      await property.save();
      logger.info('Unit updated', { propertyId: property._id, unitId: req.params.unitId, by: req.user._id });
      res.json({ success: true, data: unit });
    } catch (error) {
      next(error);
    }
  }
);


// PATCH /api/v1/properties/:id/units/:unitId/geolocation
router.patch('/:id/units/:unitId/geolocation',
  requireAuth,
  requireRole(['admin', 'super_admin', 'agent']),
  [
    param('id').isMongoId(),
    param('unitId').notEmpty(),
    body('coordinates').isArray({ min: 2, max: 2 }).custom(v => v.every(n => typeof n === 'number'))
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const property = await Property.findById(req.params.id);
      if (!property) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
      
      const unit = property.units.id(req.params.unitId);
      if (!unit) return res.status(404).json({ success: false, error: { code: 'UNIT_NOT_FOUND' } });
      
      unit.unit_geolocation = { type: 'Point', coordinates: req.body.coordinates };
      await property.save();
      
      logger.info('Unit geolocation updated', { propertyId: req.params.id, unitId: req.params.unitId });
      res.json({ success: true, data: unit });
    } catch (error) { next(error); }
  }
);

// GET /api/v1/properties/:id/units/geojson — All units as GeoJSON FeatureCollection
router.get('/:id/units/geojson', requireAuth, async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.id).lean();
    if (!property) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND' } });
    
    const features = property.units.map((u, idx) => ({
      type: 'Feature',
      properties: {
        unit_number: u.unit_number,
        status: u.status,
        rent_kes: u.rent_kes,
        index: idx
      },
      geometry: u.unit_geolocation || {
        type: 'Point',
        coordinates: [
          property.location.coordinates[0] + (Math.random() - 0.5) * 0.001, // fallback offset
          property.location.coordinates[1] + (Math.random() - 0.5) * 0.001
        ]
      }
    }));
    
    res.json({
      type: 'FeatureCollection',
      features
    });
  } catch (error) { next(error); }
});

// ─── POST /properties/:id/units/:unitId/lock ─────────────────────────────────
router.post('/:id/units/:unitId/lock',
  requireAuth,
  requireRole(['admin', 'super_admin', 'agent']),
  [
    param('id').isMongoId().withMessage('Invalid property ID'),
    param('unitId').notEmpty().withMessage('Invalid unit ID'),
    body('action').isIn(['lock', 'unlock']).withMessage('Action must be lock or unlock')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const { id, unitId } = req.params;
      const { action } = req.body;

      const property = await Property.findById(id);
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }

      const unit = property.units.id(unitId);
      if (!unit) {
        return res.status(404).json({ success: false, error: { code: 'UNIT_NOT_FOUND', message: 'Unit not found' } });
      }

      if (req.user.role === 'agent') {
        const lastLoc = req.user.last_location;
        if (!lastLoc || !lastLoc.coordinates || !lastLoc.recorded_at) {
          return res.status(403).json({
            success: false,
            error: { code: 'NO_CHECKIN', message: 'You must check in to the property first.' }
          });
        }

        const timeDiff = Date.now() - new Date(lastLoc.recorded_at).getTime();
        if (timeDiff > 30 * 60 * 1000) {
          return res.status(403).json({
            success: false,
            error: { code: 'CHECKIN_EXPIRED', message: 'Your check-in session has expired (30m limit). Please check in again.' }
          });
        }

        const [propLng, propLat] = property.location.coordinates;
        const [agentLng, agentLat] = lastLoc.coordinates;
        
        const dLat = ((agentLat - propLat) * Math.PI) / 180;
        const dLng = ((agentLng - propLng) * Math.PI) / 180;
        const R = 6371000;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((propLat * Math.PI) / 180) *
            Math.cos((agentLat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const distanceM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        if (distanceM > 200) {
          return res.status(403).json({
            success: false,
            error: { code: 'CHECKIN_TOO_FAR', message: `You are too far from the property (${Math.round(distanceM)}m). Lock operation requires you to be within 200m.` }
          });
        }
      }

      unit.lock_status = action === 'lock' ? 'locked' : 'unlocked';
      await property.save();

      logger.info('Unit digital lock toggled', {
        propertyId: id,
        unitId,
        action,
        by: req.user._id
      });

      res.json({
        success: true,
        message: `Unit successfully ${action === 'lock' ? 'locked' : 'unlocked'}.`,
        data: unit
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /properties/:id/units/:unitId ────────────────────────────────────
router.delete('/:id/units/:unitId',
  requireAuth,
  requireRole(['super_admin', 'admin']),
  [
    param('id').isMongoId().withMessage('Invalid property ID'),
    param('unitId').notEmpty().withMessage('Invalid unit ID')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const { id, unitId } = req.params;

      const Tenant = require('../models/Tenant');
      const activeTenant = await Tenant.findOne({ current_unit_id: unitId, tenancy_status: 'active' }).lean();
      if (activeTenant) {
        return res.status(400).json({
          success: false,
          error: { code: 'ACTIVE_TENANT', message: 'Cannot delete unit with an active tenant.' }
        });
      }

      const property = await Property.findById(id);
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }

      const unit = property.units.id(unitId);
      if (!unit) {
        return res.status(404).json({ success: false, error: { code: 'UNIT_NOT_FOUND', message: 'Unit not found' } });
      }

      property.units.pull(unitId);
      await property.save();

      logger.info('Unit deleted', { propertyId: id, unitId, by: req.user._id });
      res.json({ success: true, message: 'Unit deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

