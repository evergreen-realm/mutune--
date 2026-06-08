const PDFDocument = require('pdfkit');
const { uploadImage } = require('../utils/r2');
const logger = require('../utils/logger');

class PDFService {
  constructor() {
    this.companyName = 'Mutune Estate Agency';
    this.companyAddress = 'Mombasa, Kenya';
    this.companyPhone = '+254 700 000 000';
  }

  async generateNoticePDF({ notice, tenant, property, unit }) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', async () => {
          try {
            const pdfBuffer = Buffer.concat(chunks);
            const key = `${process.env.NOTICE_PDF_PREFIX || 'notices/'}${notice._id}_${Date.now()}.pdf`;
            const upload = await uploadImage(pdfBuffer, key, 'application/pdf');
            if (upload.success) {
              resolve(upload.url);
            } else {
              reject(new Error('PDF upload to R2 failed'));
            }
          } catch (uploadErr) {
            logger.error('PDF upload error', { error: uploadErr.message });
            reject(uploadErr);
          }
        });

        doc.on('error', (err) => {
          logger.error('PDFDocument stream error', { error: err.message });
          reject(err);
        });

        // ── Header ───────────────────────────────────────────────────────────
        doc.fontSize(20).fillColor('#111827').text(this.companyName, 50, 50);
        doc.fontSize(10).fillColor('#6b7280').text(this.companyAddress, 50, 75);
        doc.text(this.companyPhone, 50, 90);
        doc.moveDown(2);

        // ── Notice Type Banner ────────────────────────────────────────────────
        const typeLabels = {
          rent_increase: 'RENT INCREASE NOTICE',
          maintenance: 'MAINTENANCE NOTICE',
          eviction: 'EVICTION NOTICE',
          lease_renewal: 'LEASE RENEWAL NOTICE',
          entry_inspection: 'ENTRY INSPECTION NOTICE',
          general: 'GENERAL NOTICE'
        };

        const bannerY = doc.y;
        doc.rect(50, bannerY, 500, 30).fill('#dc2626');
        doc.fillColor('#ffffff')
           .fontSize(13)
           .font('Helvetica-Bold')
           .text(typeLabels[notice.notice_type] || 'OFFICIAL NOTICE', 60, bannerY + 9, { width: 480 });
        doc.moveDown(2.5);

        // ── Meta ──────────────────────────────────────────────────────────────
        doc.fillColor('#111827').font('Helvetica').fontSize(10);
        doc.text(`Date Issued: ${new Date(notice.created_at).toLocaleDateString('en-KE')}`);
        doc.text(`Effective Date: ${new Date(notice.effective_date).toLocaleDateString('en-KE')}`);
        doc.text(`Notice ID: ${notice._id}`);
        doc.text(`Property: ${property?.name || 'N/A'} (${property?.property_code || 'N/A'})`);
        doc.text(`Unit: ${unit?.unit_number || 'N/A'}`);
        doc.moveDown(1);

        // ── Tenant Info ───────────────────────────────────────────────────────
        doc.font('Helvetica-Bold').fontSize(12).text('TO:', 50, doc.y, { underline: true });
        doc.font('Helvetica').fontSize(10);
        doc.text(`Name: ${tenant?.full_name || 'Tenant'}`);
        doc.text(`Phone: ${tenant?.phone || 'N/A'}`);
        doc.text(`ID Number: ${tenant?.id_number || 'N/A'}`);
        doc.moveDown(1.5);

        // ── Title ─────────────────────────────────────────────────────────────
        doc.font('Helvetica-Bold').fontSize(14).text(notice.title, { underline: true });
        doc.moveDown(0.5);

        // ── Body ──────────────────────────────────────────────────────────────
        doc.font('Helvetica').fontSize(11).text(notice.body, { align: 'left', lineGap: 4 });
        doc.moveDown(2);

        // ── Legal Basis ───────────────────────────────────────────────────────
        if (notice.legal_basis) {
          doc.font('Helvetica-Bold').fontSize(10).text('Legal Basis:', { underline: true });
          doc.font('Helvetica-Oblique').fontSize(10).text(notice.legal_basis);
          doc.moveDown(1);
        }

        // ── Signature Line ────────────────────────────────────────────────────
        const sigY = Math.max(doc.y + 20, 620);
        doc.moveTo(50, sigY).lineTo(230, sigY).strokeColor('#374151').stroke();
        doc.font('Helvetica').fontSize(9).fillColor('#374151').text('Authorised Signature / Agent', 50, sigY + 5);
        doc.moveTo(310, sigY).lineTo(545, sigY).strokeColor('#374151').stroke();
        doc.text('Date', 310, sigY + 5);

        // ── Footer ────────────────────────────────────────────────────────────
        doc.font('Helvetica').fontSize(8).fillColor('#9ca3af').text(
          'This notice was generated digitally by MutuneRent Pro. For disputes, contact the Estate Agents Registration Board (EARB) or the Rent Tribunal.',
          50, 740,
          { align: 'center', width: 500 }
        );

        doc.end();
      } catch (error) {
        logger.error('PDF generation failed', { error: error.message });
        reject(error);
      }
    });
  }
}

module.exports = new PDFService();
