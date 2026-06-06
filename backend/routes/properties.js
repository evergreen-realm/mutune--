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

module.exports = router;
