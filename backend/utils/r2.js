/* eslint-disable no-console */
/**
 * backend/utils/r2.js — Cloudflare R2 image upload utility (S3-compatible).
 * Requires: CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_ACCESS_KEY_ID,
 *           CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET,
 *           CLOUDFLARE_R2_PUBLIC_URL
 */
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const logger = require('./logger');

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
  }
});

/**
 * Upload a Buffer to Cloudflare R2.
 * @param {Buffer} buffer - File contents
 * @param {string} key - Storage key (e.g. 'properties/prop-001/photo-1.jpg')
 * @param {string} contentType - MIME type
 * @returns {{ success: boolean, url?: string, error?: string }}
 */
async function uploadImage(buffer, key, contentType = 'image/jpeg') {
  try {
    await r2.send(new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType
    }));
    const url = `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
    logger.info('Image uploaded to R2', { key, url });
    return { success: true, url };
  } catch (error) {
    logger.error('R2 upload failed', { key, message: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Delete an object from Cloudflare R2.
 * @param {string} key - Storage key to delete
 */
async function deleteImage(key) {
  try {
    await r2.send(new DeleteObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET,
      Key: key
    }));
    logger.info('Image deleted from R2', { key });
    return { success: true };
  } catch (error) {
    logger.error('R2 delete failed', { key, message: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = { uploadImage, deleteImage, r2 };
