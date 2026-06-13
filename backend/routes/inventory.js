const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const Property = require('../models/Property');
const logger = require('../utils/logger');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    return false;
  }
  return true;
};

/**
 * GET /api/v1/inventory/auctionable
 * Returns all inventory items across all properties flagged as auctionable with status pending.
 * Admin/accountant only.
 */
router.get('/auctionable', requireAuth, requireRole(['admin', 'super_admin', 'accountant']), async (req, res, next) => {
  try {
    const properties = await Property.find(
      { 'inventory': { $elemMatch: { auctionable_marked_at: { $exists: true }, auction_status: 'pending' } } }
    ).lean();

    // Flatten into a list of inventory items with parent property context
    const items = [];
    for (const prop of properties) {
      for (const item of prop.inventory || []) {
        if (item.auctionable_marked_at && item.auction_status === 'pending') {
          items.push({
            ...item,
            property_name: prop.name,
            property_code: prop.property_code,
            property_id: prop._id
          });
        }
      }
    }

    const now = new Date();
    const enriched = items.map(item => ({
      ...item,
      days_since_flagged: item.auctionable_marked_at
        ? Math.floor((now - new Date(item.auctionable_marked_at)) / 86400000)
        : null
    }));

    res.json({ success: true, data: enriched, count: enriched.length });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/inventory/:propertyId/mark-auctionable
 * Flag a specific inventory item within a property as auctionable.
 * Body: { item_id, reason }
 */
router.post('/:propertyId/mark-auctionable',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    body('item_id').isMongoId().withMessage('Invalid inventory item ID'),
    body('reason').trim().notEmpty().withMessage('Reason is required')
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { item_id, reason } = req.body;

      const property = await Property.findById(req.params.propertyId);
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }

      const item = property.inventory.id(item_id);
      if (!item) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inventory item not found' } });
      }

      item.auction_status = 'pending';
      item.auctionable_marked_at = new Date();
      item.auctionable_reason = reason.trim();
      await property.save();

      logger.info('Inventory item marked auctionable', { propertyId: req.params.propertyId, itemId: item_id, by: req.user._id });
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/inventory/:propertyId/auction-sold
 * Record the auction sale of an inventory item.
 * Body: { item_id, buyer, sale_amount }
 */
router.post('/:propertyId/auction-sold',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    body('item_id').isMongoId().withMessage('Invalid inventory item ID'),
    body('buyer').trim().notEmpty().withMessage('Buyer name is required'),
    body('sale_amount').isFloat({ min: 0 }).withMessage('Sale amount must be a positive number')
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { item_id, buyer, sale_amount } = req.body;

      const property = await Property.findById(req.params.propertyId);
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }

      const item = property.inventory.id(item_id);
      if (!item) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inventory item not found' } });
      }

      if (item.auction_status === 'sold') {
        return res.status(409).json({ success: false, error: { code: 'ALREADY_SOLD', message: 'This item has already been sold' } });
      }

      item.auction_status = 'sold';
      item.auction_sold_at = new Date();
      item.auction_buyer = buyer.trim();
      item.auction_sale_amount = Number(sale_amount);
      await property.save();

      logger.info('Auction item sold', { propertyId: req.params.propertyId, itemId: item_id, buyer, amount: sale_amount, by: req.user._id });
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/inventory/auction-report
 * Returns a CSV-formatted list of all sold auction items (KRA-compliant).
 * Admin/accountant only.
 */
router.get('/auction-report', requireAuth, requireRole(['admin', 'super_admin', 'accountant']), async (req, res, next) => {
  try {
    const properties = await Property.find({ 'inventory': { $elemMatch: { auction_status: 'sold' } } }).lean();

    const rows = [];
    rows.push(['Property', 'Property Code', 'Item Name', 'Description', 'Condition', 'Estimated Value (KES)', 'Buyer', 'Sale Amount (KES)', 'Sale Date', 'Flagged Reason']);

    for (const prop of properties) {
      for (const item of prop.inventory || []) {
        if (item.auction_status === 'sold') {
          rows.push([
            prop.name,
            prop.property_code,
            item.name,
            item.description || '',
            item.condition || '',
            item.estimated_value_kes || 0,
            item.auction_buyer || '',
            item.auction_sale_amount || 0,
            item.auction_sold_at ? new Date(item.auction_sold_at).toISOString().split('T')[0] : '',
            item.auctionable_reason || ''
          ]);
        }
      }
    }

    const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="auction-report-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/inventory/all
 * Returns full inventory for all properties (admin view).
 */
router.get('/all', requireAuth, requireRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    const properties = await Property.find(
      { inventory: { $exists: true, $ne: [] } },
      { name: 1, property_code: 1, address: 1, inventory: 1 }
    ).lean();

    const result = properties.map(p => ({
      property_id: p._id,
      property_name: p.name,
      property_code: p.property_code,
      items: p.inventory || []
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/inventory/:propertyId/reclaim
 * Reclaim a flagged inventory item linking a payment receipt.
 */
router.post('/:propertyId/reclaim',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    body('item_id').isMongoId().withMessage('Invalid inventory item ID'),
    body('reclaim_receipt_id').isMongoId().withMessage('Invalid payment receipt ID')
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { item_id, reclaim_receipt_id } = req.body;

      const property = await Property.findById(req.params.propertyId);
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }

      const item = property.inventory.id(item_id);
      if (!item) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inventory item not found' } });
      }

      if (item.auction_status === 'sold') {
        return res.status(409).json({ success: false, error: { code: 'ALREADY_SOLD', message: 'This item has already been sold' } });
      }

      item.auction_status = 'reclaimed';
      item.reclaimed_at = new Date();
      item.reclaim_receipt_id = reclaim_receipt_id;
      item.auctionable = false;
      if (item.condition === 'auctionable') {
        item.condition = 'good';
      }

      await property.save();

      logger.info('Inventory item reclaimed', { propertyId: req.params.propertyId, itemId: item_id, reclaim_receipt_id, by: req.user._id });
      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
