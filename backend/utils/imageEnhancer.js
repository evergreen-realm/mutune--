const logger = require('./logger');

let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  logger.warn('Sharp is not installed or failed to load. Image enhancement will run in pass-through mode.', { error: err.message });
}

/**
 * Programmatically enhances an image buffer.
 * Performs:
 * 1. Auto-level (contrast normalization)
 * 2. Sharpen (unsharp mask)
 * 3. Median filter (subtle noise reduction)
 * 4. Resize to target standard size (optional)
 * 5. Convert to WebP format
 *
 * @param {Buffer} buffer - Original image buffer
 * @param {object} options - Options (width, height, quality)
 * @returns {Promise<{ buffer: Buffer, contentType: string }>}
 */
async function enhanceImage(buffer, options = {}) {
  const width = options.width || 1200;
  const height = options.height || 800;
  const quality = options.quality || 85;

  if (!sharp) {
    logger.info('Pass-through mode for image enhancement (sharp unavailable)');
    return { buffer, contentType: 'image/jpeg' };
  }

  try {
    const enhancedBuffer = await sharp(buffer)
      // Resize fitting inside dimensions while maintaining aspect ratio
      .resize({
        width,
        height,
        fit: 'inside',
        withoutEnlargement: true
      })
      // Auto-level brightness/contrast
      .normalise()
      // Denoise/median filter to reduce artifacts
      .median(1)
      // Sharpen to enhance details
      .sharpen({
        sigma: 1.0,
        flat: 1.0,
        jagged: 2.0
      })
      // Output as optimized webp
      .webp({ quality })
      .toBuffer();

    return {
      buffer: enhancedBuffer,
      contentType: 'image/webp'
    };
  } catch (error) {
    logger.error('Failed to enhance image using sharp, falling back to original buffer', { error: error.message });
    return { buffer, contentType: 'image/jpeg' };
  }
}

module.exports = {
  enhanceImage
};
