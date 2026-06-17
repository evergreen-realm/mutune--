const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const crypto   = require('crypto');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const { uploadImage } = require('../utils/r2');
const logger   = require('../utils/logger');

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
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
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
            error: { code: 'FILE_TOO_LARGE', message: 'File must be under 5 MB.' }
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

module.exports = router;
