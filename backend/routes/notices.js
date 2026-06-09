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

      // ── Delivery matrix — evaluate against tenant's preferred_channel ──────
      const channel = tenant.preferred_channel || 'both';
      const wantsSMS   = delivery_method.includes('sms')   && (channel === 'sms'   || channel === 'both');
      const wantsEmail = delivery_method.includes('email') && (channel === 'email' || channel === 'both');

      const smsBody = `MUTUNE NOTICE: ${title}. Effective ${new Date(effective_date).toLocaleDateString('en-KE')}. View: ${pdfUrl || 'Portal'}`;

      // ── SMS dispatch ──────────────────────────────────────────────────────
      if (wantsSMS) {
        try {
          const smsResult = await smsService.send(tenant.phone, smsBody);
          const smsStatus = notice.delivery_status.find(d => d.method === 'sms');
          if (smsStatus) {
            smsStatus.status             = smsResult.success ? 'sent' : 'failed';
            smsStatus.timestamp          = new Date();
            smsStatus.provider_message_id = smsResult.messageId;
          }
          await notice.save();
          logger.info('SMS dispatch completed', { noticeId: notice._id, success: smsResult.success, phone: tenant.phone });
        } catch (smsErr) {
          logger.error('SMS delivery exception', { noticeId: notice._id, error: smsErr.message });
        }
      }

      // ── Email dispatch with automatic SMS fallback on transport dropout ──
      if (wantsEmail) {
        let emailDelivered = false;
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
          if (sendError) {
            // Transport dropout — record failure and trigger SMS fallback
            logger.error('Resend transport error — initiating SMS fallback', { noticeId: notice._id, error: sendError });
            if (emailStatus) {
              emailStatus.status        = 'failed';
              emailStatus.timestamp     = new Date();
              emailStatus.fallback_to_sms = true;
            }
            await notice.save();
          } else {
            if (emailStatus) {
              emailStatus.status             = 'sent';
              emailStatus.timestamp          = new Date();
              emailStatus.provider_message_id = data?.id;
            }
            await notice.save();
            emailDelivered = true;
            logger.info('Email dispatch completed', { noticeId: notice._id, messageId: data?.id });
          }
        } catch (emailErr) {
          // Hard exception — record failure and trigger SMS fallback
          logger.error('Email delivery exception — initiating SMS fallback', { noticeId: notice._id, error: emailErr.message });
          const emailStatus = notice.delivery_status.find(d => d.method === 'email');
          if (emailStatus) {
            emailStatus.status        = 'failed';
            emailStatus.timestamp     = new Date();
            emailStatus.fallback_to_sms = true;
          }
          await notice.save();
        }

        // Automatic SMS fallback when email transport drops out
        if (!emailDelivered && !wantsSMS) {
          try {
            logger.warn('Executing SMS fallback for failed email delivery', { noticeId: notice._id, phone: tenant.phone });
            const fallbackResult = await smsService.send(tenant.phone, smsBody);

            // Upsert or append a fallback SMS delivery_status entry
            let fallbackStatus = notice.delivery_status.find(d => d.method === 'sms');
            if (!fallbackStatus) {
              notice.delivery_status.push({ method: 'sms', status: 'pending' });
              fallbackStatus = notice.delivery_status[notice.delivery_status.length - 1];
            }
            fallbackStatus.status             = fallbackResult.success ? 'sent' : 'failed';
            fallbackStatus.timestamp          = new Date();
            fallbackStatus.provider_message_id = fallbackResult.messageId;
            fallbackStatus.is_fallback         = true;
            await notice.save();

            logger.info('SMS fallback dispatch completed', { noticeId: notice._id, success: fallbackResult.success });
          } catch (fallbackErr) {
            logger.error('SMS fallback also failed', { noticeId: notice._id, error: fallbackErr.message });
          }
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
    if (req.user.role === 'tenant' && notice.tenant_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Not your notice' } });
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
      query.tenant_id = req.user._id;
    } else if (req.user.role === 'agent') {
      const properties = await Property.find({ agent_ids: req.user._id }).select('_id').lean();
      query.property_id = { $in: properties.map(p => p._id) };
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

// ── POST /api/v1/notices/:id/acknowledge — Tenant acknowledges receipt ────────
router.post('/:id/acknowledge', requireAuth, requirePermission('view:notices'), async (req, res, next) => {
  try {
    const notice = await Notice.findOne({ _id: req.params.id, tenant_id: req.user._id });
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
});

module.exports = router;
