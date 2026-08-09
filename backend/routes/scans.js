const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../middleware/auth');
const Property = require('../models/Property');

// POST /api/v1/scans/initiate - Initiates a 3D scan for a property
router.post('/initiate', requireAuth, async (req, res) => {
  try {
    const { propertyId, imageUrls } = req.body;

    if (!propertyId || !imageUrls || imageUrls.length === 0) {
      return res.status(400).json({ success: false, message: 'Property ID and image URLs are required.' });
    }

    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    const webhookUrl = process.env.MODAL_3D_SPLAT_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({ success: false, message: '3D scan webhook URL not configured.' });
    }

    // Determine the callback URL based on environment
    const callbackUrl = process.env.NODE_ENV === 'production'
      ? `https://mutunerent-api.onrender.com/api/v1/scans/callback`
      : 'https://webhook.site/placeholder-for-local-dev';

    property.splat_status = 'processing';
    await property.save();

    // Call Modal asynchronously, do not await the result of the processing
    axios.post(webhookUrl, {
      property_id: propertyId,
      images: imageUrls,
      callback_url: callbackUrl,
      api_secret: process.env.MODAL_WEBHOOK_SECRET
    }).catch(err => console.error('Error invoking Modal webhook:', err.message));

    res.json({ success: true, message: '3D scan initiated successfully', splat_status: 'processing' });
  } catch (error) {
    console.error('Error initiating scan:', error);
    res.status(500).json({ success: false, message: 'Server error initiating scan.' });
  }
});

// POST /api/v1/scans/callback - Webhook for Modal to report completion
router.post('/callback', async (req, res) => {
  try {
    const { property_id, status, splat_url, api_secret, error } = req.body;

    if (!process.env.MODAL_WEBHOOK_SECRET || api_secret !== process.env.MODAL_WEBHOOK_SECRET) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const property = await Property.findById(property_id);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    if (status === 'success' && splat_url) {
      property.splat_status = 'completed';
      property.splat_model_url = splat_url;
    } else {
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

// GET /api/v1/scans/property/:propertyId - Poll for scan status
router.get('/property/:propertyId', async (req, res) => {
  try {
    const property = await Property.findById(req.params.propertyId);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found.' });
    }

    res.json({
      success: true,
      splat_status: property.splat_status || 'none',
      splat_model_url: property.splat_model_url || null
    });
  } catch (error) {
    console.error('Error getting scan status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
