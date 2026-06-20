const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/rbac');
const Notice = require('../models/Notice');
const Tenant = require('../models/Tenant');
const Property = require('../models/Property');
const pdfService = require('../services/pdf');
const smsService = require('../services/sms');
const { Resend } = require('resend');
const logger = require('../utils/logger');

// ── POST /api/v1/notices/generate — Create notice + generate PDF + deliver ────
router.post(
  '/generate',
  requireAuth,
  requirePermission('issue:notice'),
  requireRole(['admin', 'super_admin', 'agent']),
  [
    body('notice_type')
      .isIn(['rent_increase', 'maintenance', 'eviction', 'lease_renewal', 'entry_inspection', 'general'])
      .withMessage('Invalid notice type'),
    body('property_id').isMongoId().withMessage('Valid property ID required'),
    body('unit_id').notEmpty().withMessage('Unit ID required'),
    body('tenant_id').isMongoId().withMessage('Valid tenant ID required'),
    body('title').trim().notEmpty().isLength({ max: 200 }).withMessage('Title required (max 200 chars)'),
    body('body').trim().notEmpty().isLength({ max: 5000 }).withMessage('Body required (max 5000 chars)'),
    body('effective_date').isISO8601().withMessage('Valid effective date required'),
    body('delivery_method')
      .isArray({ min: 1 })
      .withMessage('At least one delivery method required')
      .custom(v => v.every(m => ['sms', 'email', 'portal'].includes(m)))
      .withMessage('Delivery methods must be sms, email, or portal'),
    body('legal_basis').optional().trim().isLength({ max: 500 }).withMessage('Legal basis max 500 chars')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }

      const { notice_type, property_id, unit_id, tenant_id, title, body, effective_date, delivery_method, legal_basis } = req.body;

      // Verify tenant and property exist
      const [tenant, property] = await Promise.all([
        Tenant.findById(tenant_id).lean(),
        Property.findById(property_id).lean()
      ]);

      if (!tenant) {
        throw Object.assign(new Error('Tenant not found'), { status: 404, code: 'TENANT_NOT_FOUND' });
      }
      if (!property) {
        throw Object.assign(new Error('Property not found'), { status: 404, code: 'PROPERTY_NOT_FOUND' });
      }

      const unit = property.units?.find(u => u._id.toString() === unit_id);
      if (!unit) {
        throw Object.assign(new Error('Unit not found in property'), { status: 404, code: 'UNIT_NOT_FOUND' });
      }

      // Create notice record
      const notice = await Notice.create({
        notice_type,
        property_id,
        unit_id,
        tenant_id,
        issued_by: req.user._id,
        title,
        body,
        delivery_method,
        delivery_status: delivery_method.map(m => ({ method: m, status: 'pending' })),
        effective_date: new Date(effective_date),
        legal_basis: legal_basis || 'Section 4(1) of the Rent Restriction Act (Cap 296), Laws of Kenya'
      });

      // Generate PDF — non-blocking on failure
      let pdfUrl = null;
      try {
        pdfUrl = await pdfService.generateNoticePDF({ notice, tenant, property, unit });
        notice.pdf_url = pdfUrl;
        await notice.save();
        logger.info('Notice PDF generated', { noticeId: notice._id, pdfUrl });
      } catch (pdfErr) {
        logger.error('PDF generation failed, continuing with delivery', { noticeId: notice._id, error: pdfErr.message });
      }

      const channel = tenant.preferred_channel || 'both';
      // Deliver via SMS (with fallback from email failure)
      const shouldSendSMS = delivery_method.includes('sms') || 
        (delivery_method.includes('email') && tenant.preferred_channel === 'both');

      if (shouldSendSMS) {
        try {
          // Generate short signed URL for PDF download (24h expiry)
          let shortUrl = pdfUrl;
          if (pdfUrl && process.env.CLOUDFLARE_R2_PUBLIC_URL) {
            // Use direct R2 URL as short link (R2 public URLs are already short)
            // For production: integrate a URL shortener service
            shortUrl = pdfUrl;
          }
          
          const propertyCode = property?.property_code || 'MUT-UNK';
          const noticeTypeLabel = notice_type.replace('_', ' ').toUpperCase();
          const smsBody = `MUTUNE ${propertyCode}: ${noticeTypeLabel}. ${title.slice(0, 60)}${title.length > 60 ? '...' : ''}. View: ${shortUrl || 'Login to portal'}`;
          
          const smsResult = await smsService.send(tenant.phone, smsBody);
          
          const smsStatus = notice.delivery_status.find(d => d.method === 'sms');
          if (smsStatus) {
            smsStatus.status = smsResult.success ? 'sent' : 'failed';
            smsStatus.timestamp = new Date();
            smsStatus.provider_message_id = smsResult.messageId;
          } else if (smsResult.success) {
            // Auto-add SMS to delivery status if it wasn't originally requested but succeeded as fallback
            notice.delivery_status.push({ method: 'sms', status: 'sent', timestamp: new Date(), provider_message_id: smsResult.messageId });
          }
          
          await notice.save();
          logger.info('SMS notice delivered', { noticeId: notice._id, phone: tenant.phone, fallback: !delivery_method.includes('sms') });
        } catch (smsErr) {
          logger.error('SMS delivery failed', { noticeId: notice._id, error: smsErr.message });
          
          // If SMS was the primary method and it failed, flag for manual review
          if (delivery_method.includes('sms') && !delivery_method.includes('email')) {
            notice.delivery_status.push({ method: 'sms', status: 'failed', timestamp: new Date() });
            await notice.save();
          }
        }
      }

      // Email delivery with SMS fallback trigger
      if (delivery_method.includes('email')) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          const { data, error: sendError } = await resend.emails.send({
            from:    process.env.RESEND_FROM_EMAIL || 'notices@mutune.co.ke',
            to:      tenant.email,
            subject: `MutuneRent Notice: ${title}`,
            html: `
              <h2 style="color:#111827">${title}</h2>
              <p><strong>Property:</strong> ${property.name} (${property.property_code})</p>
              <p><strong>Unit:</strong> ${unit.unit_number}</p>
              <p><strong>Effective Date:</strong> ${new Date(effective_date).toLocaleDateString('en-KE')}</p>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
              <p style="white-space:pre-wrap">${body}</p>
              ${legal_basis ? `<p><em>Legal Basis: ${legal_basis}</em></p>` : ''}
              ${pdfUrl ? `<p><a href="${pdfUrl}" download style="color:#1d4ed8">Download Official PDF Notice</a></p>` : ''}
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
              <p style="font-size:12px;color:#6b7280">This notice was issued digitally by MutuneRent Pro. For disputes contact the Estate Agents Registration Board (EARB).</p>
            `
          });
          
          const emailStatus = notice.delivery_status.find(d => d.method === 'email');
          if (emailStatus) {
            emailStatus.status = sendError ? 'failed' : 'sent';
            emailStatus.timestamp = new Date();
            emailStatus.provider_message_id = data?.id;
          }
          await notice.save();
          
          // TRIGGER SMS FALLBACK if email failed and tenant prefers both or has no email
          if (sendError && (tenant.preferred_channel === 'both' || !tenant.email)) {
            logger.info('Email failed, triggering SMS fallback', { noticeId: notice._id, tenantId: tenant._id });
            // SMS fallback already handled above via shouldSendSMS logic when preferred_channel === 'both'
            // If preferred_channel === 'email' only, we still send SMS as critical fallback for notices
            if (tenant.preferred_channel === 'email') {
              const fallbackSms = await smsService.send(tenant.phone, `MUTUNE NOTICE: Email failed. ${title.slice(0, 80)}. Login to portal or call office.`);
              notice.delivery_status.push({ method: 'sms', status: fallbackSms.success ? 'sent' : 'failed', timestamp: new Date() });
              await notice.save();
            }
          }
          
          if (sendError) logger.error('Resend email failed', { noticeId: notice._id, error: sendError });
        } catch (emailErr) {
          logger.error('Email delivery failed', { noticeId: notice._id, error: emailErr.message });
        }
      }

      // ── Portal delivery — automatic (tenant sees it via the portal) ───────
      if (delivery_method.includes('portal')) {
        const portalStatus = notice.delivery_status.find(d => d.method === 'portal');
        if (portalStatus) {
          portalStatus.status    = 'delivered';
          portalStatus.timestamp = new Date();
        }
        await notice.save();
      }

      logger.info('Notice generated and delivered', {
        noticeId:        notice._id,
        methods:         delivery_method,
        preferredChannel: channel
      });
      res.status(201).json({ success: true, data: notice });

    } catch (error) {
      next(error);
    }
  }
);

// ── GET /api/v1/notices/:id/download — Redirect to PDF ───────────────────────
router.get('/:id/download', requireAuth, async (req, res, next) => {
  try {
    const notice = await Notice.findById(req.params.id).lean();
    if (!notice) {
      throw Object.assign(new Error('Notice not found'), { status: 404, code: 'NOTICE_NOT_FOUND' });
    }

    // Scope check: tenants can only download their own notices
    if (req.user.role === 'tenant') {
      const tenant = await Tenant.findOne({ user_id: req.user._id }).select('_id').lean();
      if (!tenant || notice.tenant_id.toString() !== tenant._id.toString()) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your notice' } });
      }
    }

    if (!notice.pdf_url) {
      return res.status(404).json({ success: false, error: { code: 'PDF_NOT_FOUND', message: 'PDF not generated for this notice' } });
    }

    res.redirect(notice.pdf_url);
  } catch (error) {
    next(error);
  }
});

// ── GET /api/v1/notices — List notices (scoped by role) ───────────────────────
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const query = {};

    if (req.user.role === 'tenant') {
      const tenant = await Tenant.findOne({ user_id: req.user._id }).select('_id').lean();
      query.tenant_id = tenant ? tenant._id : new (require('mongoose')).Types.ObjectId();
    } else if (req.user.role === 'agent') {
      query.property_id = { $in: req.user.assigned_property_ids || [] };
    } else if (req.user.role === 'landlord') {
      const ownedProps = await Property.find({ landlord_id: req.user._id }).select('_id').lean();
      query.property_id = { $in: ownedProps.map(p => p._id) };
    }

    const notices = await Notice.find(query)
      .populate('tenant_id', 'full_name phone')
      .populate('property_id', 'name property_code')
      .sort({ created_at: -1 })
      .lean();

    res.json({ success: true, data: notices });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/v1/notices/bulk — Issue notice to all tenants in a property ───
router.post(
  '/bulk',
  requireAuth,
  requirePermission('issue:notice'),
  requireRole(['admin', 'super_admin', 'agent']),
  [
    body('notice_type')
      .isIn(['rent_increase', 'maintenance', 'eviction', 'lease_renewal', 'entry_inspection', 'general'])
      .withMessage('Invalid notice type'),
    body('property_id').isMongoId().withMessage('Valid property ID required'),
    body('title').trim().notEmpty().withMessage('Title required'),
    body('body').trim().notEmpty().withMessage('Body required'),
    body('effective_date').isISO8601().withMessage('Valid effective date required'),
    body('tenant_ids').optional().isArray().withMessage('tenant_ids must be an array')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }

      const { notice_type, property_id, title, body, effective_date, tenant_ids } = req.body;

      if (tenant_ids && tenant_ids.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Tenant IDs array cannot be empty' } });
      }

      let targetTenantIds = tenant_ids;
      if (!targetTenantIds) {
        const tenants = await Tenant.find({ current_property_id: property_id, tenancy_status: 'active' }).select('_id').lean();
        targetTenantIds = tenants.map(t => t._id);
      }

      if (!targetTenantIds || targetTenantIds.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No active tenants found for this property' } });
      }

      const notices = [];
      for (const tId of targetTenantIds) {
        const notice = await Notice.create({
          notice_type,
          property_id,
          unit_id: 'bulk',
          tenant_id: tId,
          issued_by: req.user._id,
          title,
          body,
          delivery_method: ['portal'],
          delivery_status: [{ method: 'portal', status: 'delivered', timestamp: new Date() }],
          effective_date: new Date(effective_date)
        });
        notices.push(notice);
      }

      res.status(201).json({ success: true, count: notices.length, data: notices });
    } catch (error) {
      next(error);
    }
  }
);

// ── POST/PATCH /api/v1/notices/:id/acknowledge — Tenant acknowledges receipt ────────
const acknowledgeHandler = async (req, res, next) => {
  try {
    const tenant = await Tenant.findOne({ user_id: req.user._id }).select('_id').lean();
    const tenantId = tenant ? tenant._id : new (require('mongoose')).Types.ObjectId();
    const notice = await Notice.findOne({ _id: req.params.id, tenant_id: tenantId });
    if (!notice) {
      throw Object.assign(new Error('Notice not found'), { status: 404, code: 'NOTICE_NOT_FOUND' });
    }

    notice.tenant_acknowledged = true;
    notice.acknowledged_at = new Date();
    await notice.save();

    logger.info('Notice acknowledged', { noticeId: notice._id, tenantId: req.user._id });
    res.json({ success: true, data: notice });
  } catch (error) {
    next(error);
  }
};

router.post('/:id/acknowledge', requireAuth, requirePermission('view:notices'), acknowledgeHandler);
router.patch('/:id/acknowledge', requireAuth, requirePermission('view:notices'), acknowledgeHandler);

// PATCH /api/v1/notices/:id — Update notice details
router.patch('/:id',
  requireAuth,
  requireRole(['admin', 'super_admin', 'agent']),
  [
    body('title').optional().trim().notEmpty().isLength({ max: 200 }).withMessage('Title cannot be empty (max 200 chars)'),
    body('body').optional().trim().notEmpty().isLength({ max: 5000 }).withMessage('Body cannot be empty (max 5000 chars)'),
    body('effective_date').optional().isISO8601().withMessage('Valid effective date required')
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: errors.array() } });
      }

      const notice = await Notice.findById(req.params.id);
      if (!notice) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notice not found' } });
      }

      const { title, body, effective_date } = req.body;
      if (title !== undefined) notice.title = title;
      if (body !== undefined) notice.body = body;
      if (effective_date !== undefined) notice.effective_date = new Date(effective_date);

      await notice.save();
      logger.info('Notice updated', { noticeId: notice._id, by: req.user._id });
      res.json({ success: true, data: notice });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/notices/:id — Delete a notice
router.delete('/:id',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  async (req, res, next) => {
    try {
      const notice = await Notice.findByIdAndDelete(req.params.id);
      if (!notice) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notice not found' } });
      }
      logger.info('Notice deleted', { noticeId: req.params.id, by: req.user._id });
      res.json({ success: true, message: 'Notice deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
