const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const crypto   = require('crypto');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { uploadImage } = require('../utils/r2');
const logger   = require('../utils/logger');
const { enhanceImage } = require('../utils/imageEnhancer');

// Memory storage — we stream directly to R2, no temp disk needed
const storage = multer.memoryStorage();

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
]);

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPEG, PNG, or WebP files are allowed.'));
    }
  }
});

const dailyUploadLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    success: false,
    error: {
      code: 'UPLOAD_LIMIT_EXCEEDED',
      message: 'Daily document upload limit reached. You can upload up to 20 documents per day.'
    }
  })
});

function validateMagicBytes(buffer, mimeType) {
  if (!buffer || buffer.length < 4) return false;
  if (mimeType === 'application/pdf') {
    return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  }
  if (mimeType === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  if (mimeType === 'image/webp') {
    return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
  }
  return false;
}

/**
 * POST /api/v1/upload/doc
 * Upload a verification document (PDF / image) to Cloudflare R2.
 * Returns the public URL of the uploaded file.
 *
 * Body: multipart/form-data — field name: "file"
 * Auth: any authenticated user
 */
router.post(
  '/doc',
  requireAuth,
  dailyUploadLimiter,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: { code: 'FILE_TOO_LARGE', message: 'File must be under 50 MB.' }
          });
        }
        return res.status(400).json({
          success: false,
          error: { code: 'UPLOAD_ERROR', message: err.message }
        });
      }
      if (err) {
        return res.status(400).json({
          success: false,
          error: { code: 'UPLOAD_ERROR', message: err.message }
        });
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file received. Send the file in the "file" field.' }
        });
      }

      if (!validateMagicBytes(req.file.buffer, req.file.mimetype)) {
        logger.warn('File magic-number content mismatch detected', { mime: req.file.mimetype, userId: req.user._id });
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_FILE_CONTENT', message: 'File content does not match declared MIME type signature.' }
        });
      }

      const ext     = path.extname(req.file.originalname).toLowerCase() || '.bin';
      const key     = `verification-docs/${req.user._id}-${crypto.randomUUID()}${ext}`;
      const result  = await uploadImage(req.file.buffer, key, req.file.mimetype);

      if (!result.success) {
        return res.status(502).json({
          success: false,
          error: { code: 'STORAGE_ERROR', message: result.error || 'Failed to store file.' }
        });
      }

      logger.info('Verification doc uploaded', { userId: req.user._id, key });
      res.status(201).json({ success: true, url: result.url, key });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/upload/enhance
 * Upload a property/unit image, programmatically enhance it via sharp.js (level/sharpen/denoise),
 * upload it to R2 as optimized WebP, and return the enhanced URL.
 */
router.post(
  '/enhance',
  requireAuth,
  dailyUploadLimiter,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: { code: 'FILE_TOO_LARGE', message: 'File must be under 50 MB.' }
          });
        }
        return res.status(400).json({
          success: false,
          error: { code: 'UPLOAD_ERROR', message: err.message }
        });
      }
      if (err) {
        return res.status(400).json({
          success: false,
          error: { code: 'UPLOAD_ERROR', message: err.message }
        });
      }
      next();
    });
  },
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { code: 'NO_FILE', message: 'No file received. Send the file in the "file" field.' }
        });
      }

      logger.info('Enhancing uploaded image...', { filename: req.file.originalname, size: req.file.size });
      
      // Perform Sharp programmatic enhancement
      const { buffer: enhancedBuffer, contentType } = await enhanceImage(req.file.buffer, {
        width: 1200,
        height: 800,
        quality: 85
      });

      // Save to R2
      const uuid = crypto.randomUUID();
      const ext = contentType === 'image/webp' ? '.webp' : (path.extname(req.file.originalname).toLowerCase() || '.jpg');
      const key = `enhanced-images/${req.user._id}-${uuid}${ext}`;
      
      const result = await uploadImage(enhancedBuffer, key, contentType);

      if (!result.success) {
        return res.status(502).json({
          success: false,
          error: { code: 'STORAGE_ERROR', message: result.error || 'Failed to store enhanced file.' }
        });
      }

      logger.info('Enhanced image stored successfully', { key, url: result.url });
      res.status(201).json({
        success: true,
        url: result.url,
        key,
        contentType
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
