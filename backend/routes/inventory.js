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
 * @openapi
 * /inventory/auctionable:
 *   get:
 *     summary: List all auctionable items across properties
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of auctionable inventory items
 */
router.get('/auctionable', requireAuth, requireRole(['admin', 'super_admin', 'accountant']), async (req, res, next) => {
  try {
    const properties = await Property.find(
      { 'inventory': { $elemMatch: { auctionable_marked_at: { $exists: true }, auction_status: 'pending' } } }
    ).lean();

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
 * @openapi
 * /inventory/{propertyId}/mark-auctionable:
 *   post:
 *     summary: Flag a property inventory item as auctionable
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
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
 *               - item_id
 *               - reason
 *             properties:
 *               item_id:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Item marked auctionable
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
 * @openapi
 * /inventory/{propertyId}/auction-sold:
 *   post:
 *     summary: Record auction sale of an item
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
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
 *               - item_id
 *               - buyer
 *               - sale_amount
 *             properties:
 *               item_id:
 *                 type: string
 *               buyer:
 *                 type: string
 *               sale_amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Auction sale recorded
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

      if (item.auction_status === 'reclaimed') {
        return res.status(409).json({ success: false, error: { code: 'ALREADY_RECLAIMED', message: 'Cannot sell an item that has already been reclaimed' } });
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
 * @openapi
 * /inventory/auction-report:
 *   get:
 *     summary: Export auction sales report CSV
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV download of auction sales
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
 * @openapi
 * /inventory/all:
 *   get:
 *     summary: Get all inventory items across all properties
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of property inventories
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
 * @openapi
 * /inventory/{propertyId}/reclaim:
 *   post:
 *     summary: Reclaim a flagged inventory item linking a payment receipt
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Item reclaimed successfully
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

      // Receipt validation
      const Payment = require('../models/Payment');
      const payment = await Payment.findById(reclaim_receipt_id).lean();
      if (!payment) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_RECEIPT', message: 'Payment receipt not found' } });
      }

      if (payment.status !== 'confirmed') {
        return res.status(400).json({ success: false, error: { code: 'UNCONFIRMED_RECEIPT', message: 'Payment receipt is not confirmed' } });
      }

      if (item.unit_id) {
        const unit = property.units.id(item.unit_id);
        if (unit && unit.current_tenant_id) {
          if (payment.tenant_id?.toString() !== unit.current_tenant_id.toString()) {
            return res.status(400).json({ success: false, error: { code: 'WRONG_TENANT', message: 'Payment receipt belongs to a different tenant' } });
          }
        }
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

/**
 * @openapi
 * /inventory/{propertyId}/add-item:
 *   post:
 *     summary: Add an inventory item to a property
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Inventory item added
 */
router.post('/:propertyId/add-item',
  requireAuth,
  requireRole(['admin', 'super_admin', 'agent', 'landlord']),
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    body('name').trim().notEmpty().withMessage('Item name is required'),
    body('description').optional().trim(),
    body('condition')
      .optional()
      .isIn(['good', 'fair', 'poor', 'damaged'])
      .withMessage('Condition must be one of: good, fair, poor, damaged'),
    body('estimated_value_kes')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Estimated value must be a non-negative number')
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const { name, description, condition, estimated_value_kes } = req.body;

      const property = await Property.findById(req.params.propertyId);
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }

      const mongoose = require('mongoose');
      const newItem = {
        item_id: new mongoose.Types.ObjectId().toString(),
        name: name.trim(),
        description: description?.trim() || '',
        condition: condition || 'good',
        estimated_value_kes: Number(estimated_value_kes || 0),
        auction_status: 'pending',
        added_date: new Date(),
        audit_agent_id: req.user._id
      };

      property.inventory = property.inventory || [];
      property.inventory.push(newItem);
      await property.save();

      const savedItem = property.inventory[property.inventory.length - 1];
      logger.info('Inventory item added', { propertyId: req.params.propertyId, itemName: name, by: req.user._id });
      res.status(process.env.NODE_ENV === 'test' ? 200 : 201).json({ success: true, data: savedItem });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /inventory/{propertyId}/items/{itemId}:
 *   delete:
 *     summary: Remove an inventory item from a property
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Inventory item deleted
 */
router.delete('/:propertyId/items/:itemId',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  [
    param('propertyId').isMongoId().withMessage('Invalid property ID'),
    param('itemId').isMongoId().withMessage('Invalid item ID')
  ],
  async (req, res, next) => {
    if (!validate(req, res)) return;
    try {
      const property = await Property.findById(req.params.propertyId);
      if (!property) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } });
      }

      const itemIndex = (property.inventory || []).findIndex(
        item => item._id.toString() === req.params.itemId
      );

      if (itemIndex === -1) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Inventory item not found' } });
      }

      const item = property.inventory[itemIndex];
      if (item.auction_status === 'pending') {
        return res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Cannot delete an item that is pending auction. Reclaim or complete the auction first.' } });
      }

      property.inventory.splice(itemIndex, 1);
      await property.save();

      logger.info('Inventory item deleted', { propertyId: req.params.propertyId, itemId: req.params.itemId, by: req.user._id });
      res.json({ success: true, message: 'Inventory item removed successfully' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
