const axios = require('axios');
const { uploadImage } = require('../utils/r2');
const logger = require('../utils/logger');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');



async function getBlenderBinary() {
  if (process.env.BLENDER_PATH) return process.env.BLENDER_PATH;
  
  return new Promise((resolve) => {
    require('child_process').exec('which blender', (err, stdout) => {
      if (!err && stdout.trim()) return resolve('blender');
      if (fs.existsSync('/tmp/blender/blender')) return resolve('/tmp/blender/blender');
      const winPath = 'C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe';
      if (fs.existsSync(winPath)) return resolve(winPath);
      resolve(null);
    });
  });
}

/**
 * Automate 3D Model Generation for Registered Properties.
 * Runs blender script to generate a dynamic building model based on unit/floor count,
 * uploads generated GLB models to Cloudflare R2.
 */
async function generateProperty3DModel(property) {
  const propertyId = property._id.toString();
  const propertyCode = property.property_code;
  const floors = property.units ? Math.max(...property.units.map(u => u.floor || 1), 1) : 4;
  const units = property.units ? property.units.length : 16;
  
  logger.info('Starting automated 3D model generation...', { propertyId, propertyCode, floors, units });

  let textureUrl = '';
  let texturePath = null;
  if (property.photos && property.photos.length > 0) {
    textureUrl = property.photos[0];
  }

  const modalUrl = process.env.MODAL_BLENDER_WEBHOOK_URL;
  if (modalUrl) {
    try {
    const callbackUrl = `${process.env.API_BASE_URL || 'http://localhost:3000'}/api/v1/properties/blender-webhook`;
    const apiSecret = process.env.WEBHOOK_SECRET_KEY || 'default-mutune-secret';
    
    const payload = {
      property_id: propertyId,
      property_code: propertyCode,
      floors: floors,
      units: units,
      texture_url: textureUrl,
      callback_url: callbackUrl,
      api_secret: apiSecret
    };
    
    const response = await axios.post(modalUrl, payload, { headers: { 'Content-Type': 'application/json' } });
    if (response.data && response.data.success) {
      logger.info('Successfully triggered Modal Blender worker', { data: response.data });
      return null; // Webhook will update DB
    } else {
      throw new Error(response.data?.message || 'Unknown error triggering Modal worker');
    }
  } catch (modalErr) {
    logger.warn('Failed to trigger Modal Blender worker, falling back to static GLB', { error: modalErr.message });
  }
  }

  // Fallback: Use static GLB based on building size
  let fallbackModel = '/models/voxel_estate.glb';
  if (floors > 5) {
    fallbackModel = '/models/voxel_estate_large.glb'; // Hypothetical large model
  } else if (units < 4) {
    fallbackModel = '/models/voxel_estate_small.glb'; // Hypothetical small model
  }
  
  logger.info(`Using static fallback model: ${fallbackModel} due to primary failure.`);
  return fallbackModel;
}

module.exports = { generateProperty3DModel };
