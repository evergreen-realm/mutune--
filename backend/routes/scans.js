const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const Property = require('../models/Property');
const logger = require('../utils/logger');

/**
 * @openapi
 * /scans/initiate:
 *   post:
 *     summary: Initiate a 3D spatial room capture scan
 *     tags: [Scans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - propertyId
 *               - imageUrls
 *               - roomName
 *             properties:
 *               propertyId:
 *                 type: string
 *               imageUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *               roomName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Scan initiated and queued for processing
 */
router.post('/initiate', requireAuth, async (req, res, next) => {
  try {
    const { propertyId, imageUrls, roomName } = req.body;

    if (!propertyId || !imageUrls || imageUrls.length === 0 || !roomName) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Property ID, image URLs, and room name are required.' }
      });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found.' }
      });
    }

    const webhookUrl = process.env.MODAL_3D_SPLAT_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({
        success: false,
        error: { code: 'CONFIG_ERROR', message: '3D scan webhook URL not configured.' }
      });
    }

    // Add scan to array
    property.scans.push({
      room_name: roomName,
      scan_images: imageUrls,
      thumbnail_url: imageUrls[0],
      splat_status: 'processing'
    });
    
    // Also update legacy fields for backward compatibility
    property.splat_status = 'processing';
    
    await property.save();

    // Get the newly created scan
    const newScan = property.scans[property.scans.length - 1];
    const scanId = newScan._id.toString();

    // Determine the callback URL based on environment
    const callbackUrl = process.env.NODE_ENV === 'production'
      ? `https://mutunerent-api.onrender.com/api/v1/scans/callback`
      : 'https://webhook.site/placeholder-for-local-dev';

    // Call Modal asynchronously
    axios.post(webhookUrl, {
      property_id: propertyId,
      scan_id: scanId,
      images: imageUrls,
      callback_url: callbackUrl,
      api_secret: process.env.MODAL_WEBHOOK_SECRET
    }).catch(err => logger.error('Error invoking Modal webhook', { error: err.message }));

    res.json({ success: true, message: '3D scan initiated successfully', scan: newScan });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /scans/callback:
 *   post:
 *     summary: Webhook receiver for Modal 3D splat reconstruction completion
 *     tags: [Scans]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - property_id
 *               - status
 *             properties:
 *               property_id:
 *                 type: string
 *               scan_id:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [success, failed]
 *               splat_url:
 *                 type: string
 *               api_secret:
 *                 type: string
 *     responses:
 *       200:
 *         description: Scan completion logged
 */
router.post('/callback', async (req, res, next) => {
  try {
    const { property_id, scan_id, status, splat_url, api_secret, error } = req.body;

    if (!process.env.MODAL_WEBHOOK_SECRET || api_secret !== process.env.MODAL_WEBHOOK_SECRET) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Unauthorized webhook request' }
      });
    }

    const property = await Property.findById(property_id);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found.' }
      });
    }

    // Find the specific scan
    let targetScan = null;
    if (scan_id) {
      targetScan = property.scans.id(scan_id);
    } else if (property.scans.length > 0) {
      targetScan = property.scans[property.scans.length - 1];
    }

    if (status === 'success' && splat_url) {
      if (targetScan) {
        targetScan.splat_status = 'completed';
        targetScan.splat_model_url = splat_url;
      }
      property.splat_status = 'completed';
      property.splat_model_url = splat_url;
    } else {
      if (targetScan) targetScan.splat_status = 'failed';
      property.splat_status = 'failed';
      logger.error('Splat generation failed for property', { property_id, error });
    }

    await property.save();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /scans/property/{propertyId}:
 *   get:
 *     summary: Get all 3D scans and models for a property
 *     tags: [Scans]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of property 3D scans
 */
router.get('/property/:propertyId', async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.propertyId).lean();
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found.' }
      });
    }

    res.json({
      success: true,
      scans: property.scans || [],
      splat_status: property.splat_status || 'none',
      splat_model_url: property.splat_model_url || null
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /scans/property/{propertyId}/{scanId}:
 *   delete:
 *     summary: Delete a 3D scan
 *     tags: [Scans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: scanId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Scan deleted successfully
 */
router.delete('/property/:propertyId/:scanId', requireAuth, async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found.' }
      });
    }

    property.scans.pull({ _id: req.params.scanId });
    await property.save();
    
    res.json({ success: true, message: 'Scan deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /scans/share/{propertyId}/{scanId}:
 *   get:
 *     summary: Generate public shareable link for a 3D scan
 *     tags: [Scans]
 *     parameters:
 *       - in: path
 *         name: propertyId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: scanId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public shareable link
 */
router.get('/share/:propertyId/:scanId', async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.propertyId).lean();
    if (!property) {
      return res.status(404).json({
        success: false,
        error: { code: 'PROPERTY_NOT_FOUND', message: 'Property not found.' }
      });
    }

    const scan = (property.scans || []).find(s => s._id.toString() === req.params.scanId);
    if (!scan || scan.splat_status !== 'completed' || !scan.splat_model_url) {
      return res.status(404).json({
        success: false,
        error: { code: 'SCAN_NOT_READY', message: 'Scan not found or not completed.' }
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const shareUrl = `${frontendUrl}/share/scan/${property._id}/${scan._id}`;
    
    res.json({ success: true, shareUrl });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
