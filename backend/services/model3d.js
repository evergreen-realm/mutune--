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
  try {
    const propertyId = property._id.toString();
    const propertyCode = property.property_code;
    const floors = property.units ? Math.max(...property.units.map(u => u.floor || 1), 1) : 4;
    const units = property.units ? property.units.length : 16;
    
    logger.info('Starting automated 3D model generation...', { propertyId, propertyCode, floors, units });

    const key = `models/building_${propertyCode}.glb`;
    const tempOutPath = path.join(__dirname, '..', '..', 'frontend', 'public', 'models', `temp_${propertyCode}.glb`);

    const blenderPath = await getBlenderBinary();

    if (blenderPath) {
      logger.info(`Using Blender binary at: ${blenderPath}`);
      const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'blender_building_generator.py');

      let texturePath = null;
      if (property.photos && property.photos.length > 0) {
        try {
          const photoUrl = property.photos[0];
          const response = await axios.get(photoUrl, { responseType: 'arraybuffer' });
          texturePath = path.join(__dirname, '..', '..', 'frontend', 'public', 'models', `temp_tex_${propertyCode}.jpg`);
          fs.writeFileSync(texturePath, response.data);
          logger.info(`Downloaded texture image to: ${texturePath}`);
        } catch (err) {
          logger.warn('Failed to download texture image for blender generation', { error: err.message });
          texturePath = null;
        }
      }

      await new Promise((resolve, reject) => {
        const args = [
          '--background', 
          '--python', scriptPath,
          '--',
          '--floors', floors.toString(),
          '--units', units.toString(),
          '--output', tempOutPath
        ];
        
        if (texturePath) {
          args.push('--texture_image', texturePath);
        }
        
        execFile(blenderPath, args, (error, stdout, stderr) => {
          if (error) {
            logger.error('Blender execution failed', { error: error.message, stderr });
            return reject(error);
          }
          resolve();
        });
      });

      if (texturePath && fs.existsSync(texturePath)) {
        fs.unlinkSync(texturePath); // cleanup texture
      }

      if (fs.existsSync(tempOutPath)) {
        const buffer = fs.readFileSync(tempOutPath);
        const upload = await uploadImage(buffer, key, 'model/gltf-binary');
        fs.unlinkSync(tempOutPath); // cleanup

        if (upload.success) {
          logger.info('Successfully generated and uploaded Blender 3D model', { url: upload.url });
          return upload.url;
        }
      }
    }

    // Fallback: upload a copy of the high-fidelity pre-compiled voxel estate GLB model
    logger.info('Blender generation failed or blender not found. Falling back to default high-fidelity model.');
    return `/models/voxel_estate.glb`;
  } catch (error) {
    logger.error('Failed to generate 3D building model', { error: error.message });
    return `/models/voxel_estate.glb`; // resilient fallback
  }
}

module.exports = { generateProperty3DModel };
