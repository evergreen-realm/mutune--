const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const Property = require('../models/Property');
const { safeCompare } = require('../utils/security');
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

    // Add scan to scans and room_scans
    const scanEntry = {
      room_name: roomName,
      scan_images: imageUrls,
      thumbnail_url: imageUrls[0],
      status: 'processing',
      splat_status: 'processing'
    };
    property.scans.push(scanEntry);
    if (!property.room_scans) property.room_scans = [];
    property.room_scans.push(scanEntry);

    // Get the newly created scan
    const newScan = property.scans[property.scans.length - 1];
    const scanId = newScan._id.toString();

    // Persist scan processing state to property.assets
    if (!property.assets) property.assets = [];
    property.assets.push({
      asset_id: scanId,
      type: 'splat',
      name: `${roomName} Splat`,
      url: imageUrls[0],
      splat_url: null,
      status: 'processing'
    });
    
    // Also update legacy fields for backward compatibility
    property.splat_status = 'processing';
    
    await property.save();

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

    const expectedSecret = process.env.MODAL_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET_KEY;
    if (process.env.NODE_ENV === 'production' && !expectedSecret) {
      logger.error('MODAL_WEBHOOK_SECRET not configured in production');
      return res.status(500).json({
        success: false,
        error: { code: 'CONFIG_ERROR', message: 'Webhook secret not configured' }
      });
    }
    if (expectedSecret && (!api_secret || !safeCompare(api_secret, expectedSecret))) {
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

    // Find the specific scan in scans and room_scans
    let targetScan = null;
    if (scan_id) {
      targetScan = property.scans.id(scan_id) || (property.room_scans ? property.room_scans.id(scan_id) : null);
    } else if (property.scans.length > 0) {
      targetScan = property.scans[property.scans.length - 1];
    }

    const resolvedScanId = scan_id || (targetScan ? targetScan._id?.toString() : null);

    if (status === 'success' && splat_url) {
      if (targetScan) {
        targetScan.status = 'completed';
        targetScan.splat_status = 'completed';
        targetScan.splat_url = splat_url;
        targetScan.splat_model_url = splat_url;
      }
      if (property.room_scans && resolvedScanId) {
        const roomScan = property.room_scans.id(resolvedScanId);
        if (roomScan) {
          roomScan.status = 'completed';
          roomScan.splat_status = 'completed';
          roomScan.splat_url = splat_url;
          roomScan.splat_model_url = splat_url;
        }
      }
      property.splat_status = 'completed';
      property.splat_model_url = splat_url;

      // Update or push into property.assets
      if (!property.assets) property.assets = [];
      const assetIdx = property.assets.findIndex(a => a.type === 'splat' && (a.asset_id === resolvedScanId || a.name?.includes(targetScan?.room_name)));
      if (assetIdx >= 0) {
        property.assets[assetIdx].status = 'completed';
        property.assets[assetIdx].url = splat_url;
        property.assets[assetIdx].splat_url = splat_url;
      } else {
        property.assets.push({
          asset_id: resolvedScanId,
          type: 'splat',
          name: `${targetScan?.room_name || 'Room'} Splat`,
          url: splat_url,
          splat_url: splat_url,
          status: 'completed'
        });
      }
    } else {
      if (targetScan) {
        targetScan.status = 'failed';
        targetScan.splat_status = 'failed';
      }
      if (property.room_scans && resolvedScanId) {
        const roomScan = property.room_scans.id(resolvedScanId);
        if (roomScan) {
          roomScan.status = 'failed';
          roomScan.splat_status = 'failed';
        }
      }
      property.splat_status = 'failed';
      if (property.assets && resolvedScanId) {
        const asset = property.assets.find(a => a.asset_id === resolvedScanId);
        if (asset) asset.status = 'failed';
      }
      logger.error('Splat generation failed for property', { property_id, error });
    }

    await property.save();
    res.json({ success: true, message: 'Scan status updated successfully' });
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

    const normalizedScans = (property.scans || property.room_scans || []).map(s => ({
      ...s,
      status: s.status || s.splat_status,
      splat_status: s.splat_status || s.status,
      splat_url: s.splat_url || s.splat_model_url,
      splat_model_url: s.splat_model_url || s.splat_url
    }));

    res.json({
      success: true,
      data: normalizedScans,
      scans: normalizedScans,
      room_scans: normalizedScans,
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
