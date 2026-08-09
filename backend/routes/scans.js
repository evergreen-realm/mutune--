const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const Property = require('../models/Property');

// POST /api/v1/scans/initiate - Initiates a 3D scan for a property room
router.post('/initiate', requireAuth, async (req, res) => {
  try {
    const { propertyId, imageUrls, roomName } = req.body;

    if (!propertyId || !imageUrls || imageUrls.length === 0 || !roomName) {
      return res.status(400).json({ success: false, message: 'Property ID, image URLs, and room name are required.' });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    const webhookUrl = process.env.MODAL_3D_SPLAT_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({ success: false, message: '3D scan webhook URL not configured.' });
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
    }).catch(err => console.error('Error invoking Modal webhook:', err.message));

    res.json({ success: true, message: '3D scan initiated successfully', scan: newScan });
  } catch (error) {
    console.error('Error initiating scan:', error);
    res.status(500).json({ success: false, message: 'Server error initiating scan.' });
  }
});

// POST /api/v1/scans/callback - Webhook for Modal to report completion
router.post('/callback', async (req, res) => {
  try {
    const { property_id, scan_id, status, splat_url, api_secret, error } = req.body;

    if (!process.env.MODAL_WEBHOOK_SECRET || api_secret !== process.env.MODAL_WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const property = await Property.findById(property_id);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    // Find the specific scan
    let targetScan = null;
    if (scan_id) {
        targetScan = property.scans.id(scan_id);
    } else if (property.scans.length > 0) {
        // Fallback for old requests without scan_id
        targetScan = property.scans[property.scans.length - 1];
    }

    if (status === 'success' && splat_url) {
      if (targetScan) {
        targetScan.splat_status = 'completed';
        targetScan.splat_model_url = splat_url;
      }
      // Update legacy fields
      property.splat_status = 'completed';
      property.splat_model_url = splat_url;
    } else {
      if (targetScan) targetScan.splat_status = 'failed';
      property.splat_status = 'failed';
      console.error(`Splat generation failed for property ${property_id}:`, error);
    }

    await property.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/v1/scans/property/:propertyId - Get all scans for a property
router.get('/property/:propertyId', async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    res.json({
      success: true,
      scans: property.scans || [],
      splat_status: property.splat_status || 'none',
      splat_model_url: property.splat_model_url || null
    });
  } catch (error) {
    console.error('Error getting scans:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/v1/scans/property/:propertyId/:scanId - Delete a scan
router.delete('/property/:propertyId/:scanId', requireAuth, async (req, res) => {
    try {
        const property = await Property.findById(req.params.propertyId);
        if (!property) {
          return res.status(404).json({ success: false, message: 'Property not found.' });
        }
    
        property.scans.pull({ _id: req.params.scanId });
        await property.save();
        
        res.json({ success: true, message: 'Scan deleted' });
      } catch (error) {
        console.error('Error deleting scan:', error);
        res.status(500).json({ success: false, message: 'Server error' });
      }
});

// GET /api/v1/scans/share/:propertyId/:scanId - Get a shareable link
router.get('/share/:propertyId/:scanId', async (req, res) => {
    try {
        const property = await Property.findById(req.params.propertyId);
        if (!property) {
          return res.status(404).json({ success: false, message: 'Property not found.' });
        }
    
        const scan = property.scans.id(req.params.scanId);
        if (!scan || scan.splat_status !== 'completed' || !scan.splat_model_url) {
            return res.status(404).json({ success: false, message: 'Scan not found or not completed.' });
        }

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const shareUrl = `${frontendUrl}/share/scan/${property._id}/${scan._id}`;
        
        res.json({ success: true, shareUrl });
      } catch (error) {
        console.error('Error generating share link:', error);
        res.status(500).json({ success: false, message: 'Server error' });
      }
});

module.exports = router;
