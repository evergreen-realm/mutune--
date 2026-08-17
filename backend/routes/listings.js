const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const Property = require('../models/Property');
const User = require('../models/User');
const smsService = require('../services/sms');
const logger = require('../utils/logger');

/**
 * @openapi
 * /listings:
 *   get:
 *     summary: Public searchable vacant property listings
 *     tags: [Listings]
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *       - in: query
 *         name: county
 *         schema:
 *           type: string
 *       - in: query
 *         name: minRent
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxRent
 *         schema:
 *           type: number
 *       - in: query
 *         name: bedrooms
 *         schema:
 *           type: integer
 *       - in: query
 *         name: property_type
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of vacant property listings
 */
router.get('/', async (req, res, next) => {
  try {
    const {
      city,
      county,
      minRent,
      maxRent,
      bedrooms,
      property_type,
      search
    } = req.query;

    const filter = {
      status: 'active'
    };

    if (city) filter['address.city'] = new RegExp(city, 'i');
    if (county) filter['address.county'] = new RegExp(county, 'i');
    if (property_type && property_type !== 'all') {
      filter.$or = [
        { type: property_type },
        { property_type: property_type }
      ];
    }
    if (search) {
      filter.$or = [
        { name: new RegExp(search, 'i') },
        { 'address.area': new RegExp(search, 'i') },
        { 'address.street': new RegExp(search, 'i') }
      ];
    }

    const properties = await Property.find(filter)
      .select('property_code name type property_type address location amenities photos units')
      .lean();

    // Filter and sanitize units — only return listed / vacant units, no PII
    const listings = [];

    for (const prop of properties) {
      const listedUnits = (prop.units || []).filter(u => {
        const isListed = u.listing_status === 'listed' || (u.status === 'vacant' && u.listing_status !== 'unlisted');
        if (!isListed) return false;
        if (minRent && u.rent_kes < Number(minRent)) return false;
        if (maxRent && u.rent_kes > Number(maxRent)) return false;
        if (bedrooms && u.bedrooms !== Number(bedrooms)) return false;
        return true;
      });

      if (listedUnits.length > 0) {
        const minUnitRent = Math.min(...listedUnits.map(u => u.rent_kes));
        const maxUnitRent = Math.max(...listedUnits.map(u => u.rent_kes));

        listings.push({
          property_id: prop._id,
          property_code: prop.property_code,
          name: prop.name,
          type: prop.type,
          property_type: prop.property_type || 'residential',
          address: prop.address,
          location: prop.location,
          amenities: prop.amenities || [],
          photos: prop.photos || [],
          vacant_units_count: listedUnits.length,
          price_range_kes: {
            min: minUnitRent,
            max: maxUnitRent
          },
          units: listedUnits.map(u => ({
            unit_id: u._id,
            unit_number: u.unit_number,
            unit_type: u.unit_type,
            bedrooms: u.bedrooms,
            bathrooms: u.bathrooms,
            rent_kes: u.rent_kes,
            size_sqft: u.size_sqft,
            listing_status: u.listing_status || 'listed',
            photos: u.photos || []
          }))
        });
      }
    }

    res.json({ success: true, count: listings.length, data: listings });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /listings/{propertyId}/inquire:
 *   post:
 *     summary: Public inquiry submission for a property or unit
 *     tags: [Listings]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               message:
 *                 type: string
 *               unit_id:
 *                 type: string
 *               unit_number:
 *                 type: string
 *     responses:
 *       201:
 *         description: Inquiry submitted and agents notified
 */
router.post('/:propertyId/inquire',
  [
    param('propertyId').isMongoId().withMessage('Valid propertyId required'),
    body('name').notEmpty().withMessage('Name is required'),
    body('phone').notEmpty().withMessage('Phone number is required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }

      const { propertyId } = req.params;
      const { name, phone, email, message, unit_id, unit_number } = req.body;

      const property = await Property.findById(propertyId).populate('agent_ids', 'phone full_name');
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }

      const newInquiry = {
        name,
        phone,
        email: email || '',
        message: message || 'Interested in viewing this property',
        unit_id: unit_id || null,
        unit_number: unit_number || 'General Inquiry',
        status: 'new',
        created_at: new Date()
      };

      property.inquiries = property.inquiries || [];
      property.inquiries.push(newInquiry);
      await property.save();

      // Notify managing agents via SMS
      if (property.agent_ids && property.agent_ids.length > 0) {
        for (const agent of property.agent_ids) {
          if (agent.phone) {
            try {
              await smsService.send(
                agent.phone,
                `MutuneRent Lead: ${name} (${phone}) inquired about ${property.name} (${unit_number || 'Unit'}). Message: ${message || 'Viewing request'}`
              );
            } catch (smsErr) {
              logger.warn('Failed to dispatch inquiry SMS to agent', { agent: agent._id, error: smsErr.message });
            }
          }
        }
      }

      logger.info('Public property inquiry received', { propertyId, name, phone });
      res.status(201).json({
        success: true,
        message: 'Inquiry submitted successfully. An agent will contact you shortly.',
        data: newInquiry
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /listings/{propertyId}/units/{unitId}/status:
 *   put:
 *     summary: Update listing status of a unit
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: unitId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - listing_status
 *             properties:
 *               listing_status:
 *                 type: string
 *                 enum: [listed, unlisted, reserved]
 *     responses:
 *       200:
 *         description: Unit listing status updated
 */
router.put('/:propertyId/units/:unitId/status',
  requireAuth,
  requireRole(['agent', 'admin', 'super_admin']),
  [
    body('listing_status').isIn(['listed', 'unlisted', 'reserved']).withMessage('Valid listing_status required')
  ],
  async (req, res, next) => {
    try {
      const { propertyId, unitId } = req.params;
      const { listing_status } = req.body;

      const property = await Property.findById(propertyId);
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }

      const unit = property.units.id(unitId);
      if (!unit) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Unit not found' } });
      }

      unit.listing_status = listing_status;
      await property.save();

      logger.info('Unit listing status updated', { propertyId, unitId, listing_status, by: req.user._id });
      res.json({ success: true, message: `Unit listing updated to ${listing_status}`, data: unit });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /listings/inquiries/manage:
 *   get:
 *     summary: Agent inquiries manager
 *     tags: [Listings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of inquiries for properties managed by the user
 */
router.get('/inquiries/manage',
  requireAuth,
  requireRole(['agent', 'admin', 'super_admin']),
  async (req, res, next) => {
    try {
      const filter = { status: 'active' };
      if (req.user.role === 'agent') {
        filter.agent_ids = req.user._id;
      }

      const properties = await Property.find(filter)
        .select('name property_code inquiries address')
        .lean();

      const allInquiries = [];
      properties.forEach(p => {
        (p.inquiries || []).forEach(inq => {
          allInquiries.push({
            ...inq,
            property_id: p._id,
            property_name: p.name,
            property_code: p.property_code,
            area: p.address?.area
          });
        });
      });

      allInquiries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      res.json({ success: true, count: allInquiries.length, data: allInquiries });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
