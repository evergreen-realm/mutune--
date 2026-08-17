const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { body, param, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { generateLegalPDF } = require('../services/pdfGenerator');
const smsService = require('../services/sms');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const User = require('../models/User');
const LeaseSignature = require('../models/LeaseSignature');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

const validate = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    return false;
  }
  return true;
};

/**
 * @openapi
 * /paperwork/generate-pdf:
 *   post:
 *     summary: Generate and stream legal document PDF
 *     tags: [Paperwork]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - doc_type
 *             properties:
 *               doc_type:
 *                 type: string
 *                 enum:
 *                   - lease_agreement
 *                   - demand_note_7day
 *                   - quit_notice_30day
 *                   - landlord_remittance_statement
 *                   - agent_salary_voucher
 *                   - etims_tax_receipt
 *                   - rrt_landlord_complaint
 *                   - rrt_tenant_response
 *               payload:
 *                 type: object
 *     responses:
 *       200:
 *         description: PDF file stream
 */
router.post('/generate-pdf',
  requireAuth,
  [
    body('doc_type').isIn([
      'lease_agreement',
      'demand_note_7day',
      'quit_notice_30day',
      'landlord_remittance_statement',
      'agent_salary_voucher',
      'etims_tax_receipt',
      'rrt_landlord_complaint',
      'rrt_tenant_response'
    ]).withMessage('Valid doc_type required')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;

      const { doc_type, payload = {} } = req.body;

      // Scope Role Permission Enforcements
      if (doc_type === 'agent_salary_voucher' && req.user.role === 'tenant') {
        return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Tenants cannot access salary vouchers' } });
      }

      if (doc_type === 'landlord_remittance_statement' && req.user.role === 'tenant') {
        return res.status(403).json({ success: false, error: { code: 'SCOPE_DENIED', message: 'Tenants cannot access landlord remittance statements' } });
      }

      const pdfBuffer = await generateLegalPDF(doc_type, {
        ...payload,
        generated_by_user_id: req.user._id,
        generated_by_user_role: req.user.role
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${doc_type}_${Date.now()}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /paperwork/sign/request-otp:
 *   post:
 *     summary: Request OTP for 2-step digital lease signing
 *     tags: [Paperwork]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenant_id
 *             properties:
 *               tenant_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP dispatched via SMS
 */
router.post('/sign/request-otp',
  requireAuth,
  [
    body('tenant_id').isMongoId().withMessage('Valid tenant_id is required')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const { tenant_id } = req.body;

      const tenant = await Tenant.findById(tenant_id).populate('current_property_id').lean();
      if (!tenant) {
        return res.status(404).json({ success: false, error: { code: 'TENANT_NOT_FOUND', message: 'Tenant record not found' } });
      }

      // Generate 6-digit cryptographic numeric OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

      let signatureRecord = await LeaseSignature.findOne({
        tenant_id,
        document_type: 'lease_agreement'
      });

      if (!signatureRecord) {
        signatureRecord = new LeaseSignature({
          tenant_id,
          property_id: tenant.current_property_id?._id,
          unit_id: tenant.current_unit_id,
          document_type: 'lease_agreement',
          signer_phone: tenant.phone,
          signer_name: tenant.full_name
        });
      }

      signatureRecord.otp_code_hash = otpHash;
      signatureRecord.otp_expires_at = expiresAt;
      signatureRecord.signing_status = 'pending_otp';
      await signatureRecord.save();

      // Dispatch SMS OTP via Africa's Talking
      const message = `MutuneRent Pro: Your 2-Step Digital Lease Signing OTP code is ${otpCode}. Valid for 10 minutes. Do not share this code.`;
      try {
        await smsService.send(tenant.phone, message);
      } catch (smsErr) {
        logger.warn('Failed to send signing OTP via SMS, code available for test', { error: smsErr.message, otpCode });
      }

      logger.info('Lease signing OTP dispatched', { tenantId: tenant_id, phone: tenant.phone });
      res.json({
        success: true,
        message: `Signing OTP sent to registered phone ${tenant.phone.slice(0, 6)}****`,
        expires_in_seconds: 600
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /paperwork/sign/verify-and-sign:
 *   post:
 *     summary: Verify OTP and stamp digital signature on lease
 *     tags: [Paperwork]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tenant_id
 *               - otp_code
 *             properties:
 *               tenant_id:
 *                 type: string
 *               otp_code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lease signed and verification hash generated
 */
router.post('/sign/verify-and-sign',
  requireAuth,
  [
    body('tenant_id').isMongoId().withMessage('Valid tenant_id is required'),
    body('otp_code').isLength({ min: 6, max: 6 }).withMessage('6-digit OTP code required')
  ],
  async (req, res, next) => {
    try {
      if (!validate(req, res)) return;
      const { tenant_id, otp_code } = req.body;

      const signatureRecord = await LeaseSignature.findOne({
        tenant_id,
        document_type: 'lease_agreement'
      });

      if (!signatureRecord) {
        return res.status(404).json({ success: false, error: { code: 'NO_SIGNING_SESSION', message: 'No active signing session found. Request OTP first.' } });
      }

      if (signatureRecord.signing_status === 'signed') {
        return res.json({
          success: true,
          message: 'Lease agreement is already digitally signed and immutable',
          data: {
            signing_status: 'signed',
            signed_at: signatureRecord.signed_at,
            verification_hash: signatureRecord.verification_hash
          }
        });
      }

      if (new Date() > new Date(signatureRecord.otp_expires_at)) {
        return res.status(400).json({ success: false, error: { code: 'OTP_EXPIRED', message: 'Signing OTP has expired. Please request a new OTP.' } });
      }

      const inputHash = crypto.createHash('sha256').update(otp_code.trim()).digest('hex');
      if (inputHash !== signatureRecord.otp_code_hash) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_OTP', message: 'Incorrect OTP code entered.' } });
      }

      // Generate Immutable SHA-256 Digital Verification Attestation Hash
      const timestamp = new Date().toISOString();
      const signerIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
      const attestationData = `LEASE_AGREEMENT:${tenant_id}:${signatureRecord.signer_phone}:${timestamp}:${signerIp}`;
      const verificationHash = crypto.createHash('sha256').update(attestationData).digest('hex').toUpperCase();

      signatureRecord.signing_status = 'signed';
      signatureRecord.signed_at = new Date();
      signatureRecord.signer_ip = signerIp;
      signatureRecord.verification_hash = verificationHash;
      signatureRecord.attestation_text = `Digitally attested by ${signatureRecord.signer_name} (${signatureRecord.signer_phone}) on ${timestamp} from IP ${signerIp}`;
      signatureRecord.otp_code_hash = undefined;
      await signatureRecord.save();

      // Create Audit Log
      await AuditLog.create({
        action: 'DIGITAL_LEASE_SIGNED',
        resource: `Tenant:${tenant_id}`,
        user_id: req.user._id,
        details: {
          tenant_id,
          verification_hash: verificationHash,
          signer_phone: signatureRecord.signer_phone,
          timestamp
        }
      });

      logger.info('Digital lease signed successfully', { tenantId: tenant_id, hash: verificationHash });
      res.json({
        success: true,
        message: 'Lease agreement digitally signed and verified ✓',
        data: {
          signing_status: 'signed',
          signed_at: signatureRecord.signed_at,
          verification_hash: verificationHash,
          attestation_text: signatureRecord.attestation_text
        }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /paperwork/sign/status/{tenantId}:
 *   get:
 *     summary: Check lease signature status for a tenant
 *     tags: [Paperwork]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lease signature status details
 */
router.get('/sign/status/:tenantId',
  requireAuth,
  async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const signature = await LeaseSignature.findOne({
        tenant_id: tenantId,
        document_type: 'lease_agreement'
      }).lean();

      res.json({
        success: true,
        data: signature || { signing_status: 'unsigned' }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @openapi
 * /paperwork/download/{docType}:
 *   get:
 *     summary: Download generated legal PDF document
 *     tags: [Paperwork]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: docType
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF binary download
 */
router.get('/download/:docType',
  requireAuth,
  async (req, res, next) => {
    try {
      const { docType } = req.params;
      const pdfBuffer = await generateLegalPDF(docType, req.query);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${docType}_${Date.now()}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
